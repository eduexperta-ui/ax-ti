import 'dotenv/config';
import express from 'express';
import { Client } from '@notionhq/client';
import path from 'path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { getTrendAnalysisPrompt, buildStructuringPrompt } from './src/services/promptService.js';
import { parseGroundingMetadata } from './src/services/groundingParser.js';
import { isWithinPeriod, getReadablePeriodRange } from './src/services/periodValidator.js';
import { EvidenceLedgerItem } from './src/types.js';

const extractDateFromText = (text: string, url: string): string | null => {
  if (!text && !url) return null;
  const combined = `${url} ${text}`;

  const match = combined.match(/\b(202[0-9])[-./](0[1-9]|1[0-2])[-./](0[1-9]|[12][0-9]|3[01])\b/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const matchCompact = url.match(/\b(202[0-9])(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])\b/);
  if (matchCompact) {
    return `${matchCompact[1]}-${matchCompact[2]}-${matchCompact[3]}`;
  }

  const matchKorean = text.match(/(202[0-9])년\s*(0?[1-9]|1[0-2])월\s*(0?[1-9]|[12][0-9]|3[01])일/);
  if (matchKorean) {
    const m = matchKorean[2].padStart(2, '0');
    const d = matchKorean[3].padStart(2, '0');
    return `${matchKorean[1]}-${m}-${d}`;
  }

  return null;
};

/**
 * 그라운딩 응답 본문에서 Evidence List 항목을 복원한다.
 *
 * groundingMetadata의 groundingSupports[].segment.text는 모델이 출력한
 * "- title: / - url: / - published_or_updated: ..." 목록 텍스트를 임의 위치에서
 * 자른 조각이다. 이걸 그대로 claim으로 쓰면
 *   (1) 근거 카드에 "- url: https://... - published_or_updated: ..." 원문 포맷이 노출되고
 *   (2) 같은 기사가 여러 chunk에 걸쳐 E1, E2처럼 중복 등록된다.
 * 그래서 목록 텍스트 자체를 필드 단위로 파싱한다.
 */
export interface GroundedEntry {
  title: string;
  url: string;
  hasArticlePath: boolean; // 개별 글 주소인지(도메인 루트만 아닌지)
  published: string | null;
  category: string;
  claim: string;
  confidence: string;
}

const EVIDENCE_FIELD_RE =
  /[-*•]\s*(title|url|published_or_updated|category|claim|confidence)\s*[:：]\s*/gi;

export const parseEvidenceListFromText = (text: string): GroundedEntry[] => {
  if (!text) return [];

  const marks: Array<{ key: string; start: number; end: number }> = [];
  EVIDENCE_FIELD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EVIDENCE_FIELD_RE.exec(text)) !== null) {
    marks.push({ key: m[1].toLowerCase(), start: m.index, end: EVIDENCE_FIELD_RE.lastIndex });
  }
  if (marks.length === 0) return [];

  // 같은 키가 다시 등장하면 새 항목의 시작으로 본다.
  // (모델이 줄바꿈을 넣든 한 줄로 붙여 쓰든 동일하게 동작한다)
  const buckets: Array<Record<string, string>> = [];
  let current: Record<string, string> | null = null;

  for (let i = 0; i < marks.length; i++) {
    const valueEnd = i + 1 < marks.length ? marks[i + 1].start : text.length;
    const value = text.slice(marks[i].end, valueEnd).replace(/\s+/g, ' ').trim();

    if (!current || current[marks[i].key] !== undefined) {
      if (current) buckets.push(current);
      current = {};
    }
    current[marks[i].key] = value;
  }
  if (current) buckets.push(current);

  const entries: GroundedEntry[] = [];
  for (const b of buckets) {
    // 모델이 "https://a.com/ (또는 https://b.com/...)" 처럼 URL 뒤에 주석을 붙이는 경우가 있다.
    // 공백이 나오면 거기서 끊어야 엉뚱한 도메인이 출처로 붙는 것을 막을 수 있다.
    const rawUrl = (b.url || '').split(/[\s<>"']/)[0].replace(/[)\]},.;]+$/, '');
    if (!/^https?:\/\//i.test(rawUrl)) continue;

    // 개별 글 주소인지(경로가 있는지) 판정한다. 도메인 루트만 있으면 원문으로 신뢰하지 않는다.
    let hasArticlePath = false;
    try {
      hasArticlePath = new URL(rawUrl).pathname.replace(/\/+$/, '').length > 0;
    } catch {
      continue;
    }

    entries.push({
      title: b.title || '',
      url: rawUrl,
      hasArticlePath,
      published: extractDateFromText(b.published_or_updated || '', rawUrl),
      category: b.category || '',
      claim: b.claim || b.title || '',
      confidence: b.confidence || 'Medium',
    });
  }

  return entries;
};

/** 쿼리스트링/해시/끝 슬래시를 제거한 중복 판정용 키 */
export const canonicalUrl = (u: string): string =>
  (u || '').trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');

/**
 * 리포트 하단에 붙는 "참고 근거" 블록을 서버가 직접 만든다.
 *
 * 모델에게 이 표를 쓰게 하면 원장에 없는 출처를 지어내거나 형식이 매번 달라진다.
 * Evidence Ledger에서 그대로 생성하면 근거 탭과 항상 일치하고 토큰도 쓰지 않는다.
 * 제목은 원문을 인용한 값이므로 과장 표현 치환을 적용하지 않는다.
 */
const escapeTableCell = (s: string) => (s || '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();

export const buildReferenceTable = (ledger: EvidenceLedgerItem[]): string => {
  if (!ledger || ledger.length === 0) return '';
  const rows = ledger.map((e) => {
    const date = e.publishedDate || '날짜 미확인';
    const mark = e.periodValid ? '' : ' *(기간 외)*';
    return `| [${e.id}] | ${escapeTableCell(e.sourceDomain)} | ${escapeTableCell(e.title) || 'Untitled'} | ${date}${mark} |`;
  });
  return [
    '',
    '---',
    '',
    '## 참고 근거',
    '',
    '| # | 출처 | 제목 | 발행 추정일 |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
};

/** 노션용 목록 버전. 노션 변환기는 마크다운 표를 블록으로 못 바꾸므로 불릿으로 낸다. */
export const buildReferenceList = (ledger: EvidenceLedgerItem[]): string => {
  if (!ledger || ledger.length === 0) return '';
  const rows = ledger.map((e) => {
    const date = e.publishedDate || '날짜 미확인';
    const mark = e.periodValid ? '' : ' (기간 외)';
    return `- [${e.id}] ${e.sourceDomain} — ${e.title || 'Untitled'} (${date}${mark})`;
  });
  return ['', '---', '', '## 참고 근거', '', ...rows, ''].join('\n');
};

import { ANALYSIS_RESPONSE_SCHEMA } from './src/schemas/analysisSchema.js';
import {
  sanitizeText,
  sanitizeDashboardData,
  sanitizeClaims,
  sanitizeEvidenceList,
  resetReplacementCount,
  getReplacementCount,
} from './src/services/sanitize.js';

// Main Express Application Entry Point
export const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;

const cleanEnv = (value: string | undefined) =>
  (value || '').trim().replace(/^[\"\']|[\"\']$/g, '');

const extractNotionId = (input: string) => {
  const match = input.match(
    /[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i
  );
  return match ? match[0].replace(/-/g, '') : '';
};

const extractReportTitle = (markdown: string, fallback: string): string => {
  if (!markdown) return fallback;

  // 마크다운 장식 기호를 걷어내는 헬퍼
  const clean = (s: string) =>
    s
      .replace(/^#{1,6}\s*/, '')      // 앞쪽 # 기호 제거
      .replace(/\*\*/g, '')           // 굵은 글씨 기호 제거
      .replace(/^[-*>\s]+/, '')       // 목록/인용 기호 제거
      .trim();

  // 1순위: # ~ ###### 형태의 제목 줄
  const headingMatch = markdown.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch && clean(headingMatch[1])) {
    // 인용 마커([E1] 등)는 제목에서 걷어낸다
    const heading = clean(headingMatch[1]).replace(/\[E\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
    if (heading) return heading.slice(0, 120);
  }

  // 2순위: 첫 번째 비어있지 않은 줄의 "첫 문장"만 사용한다.
  // (줄 전체를 쓰면 헤딩 없는 리포트에서 노션 제목이 본문 200자로 들어간다)
  const firstLine = markdown
    .split('\n')
    .map((l) => clean(l))
    .find((l) => l.length > 0);

  if (firstLine) {
    const firstSentence =
      firstLine.split(/(?<=[.!?。])\s+/)[0] || firstLine;
    return firstSentence.replace(/\[E\d+\]/g, '').trim().slice(0, 80) || fallback;
  }

  return fallback;
};

export const normalizePeriod = (period?: string): string => {
  if (!period) return 'recent30';
  const validPeriods = ['recent7', 'recent14', 'recent30', 'recent60', 'recent90'];
  if (validPeriods.includes(period)) {
    return period;
  }
  const periodMap: Record<string, string> = {
    '최근 1주': 'recent7',
    '최근 2주': 'recent14',
    '최근 1개월': 'recent30',
    '최근 60일': 'recent60',
    '최근 90일': 'recent90',
  };
  return periodMap[period] || 'recent30';
};

export const getPeriodLabel = (safePeriod: string): string => {
  const labelMap: Record<string, string> = {
    recent7: '최근 1주',
    recent14: '최근 2주',
    recent30: '최근 1개월',
    recent60: '최근 60일',
    recent90: '최근 90일',
  };
  return labelMap[safePeriod] || '최근 1개월';
};

export const SOURCE_DOMAIN_MAP: Record<string, string[]> = {
  '글로벌 기업 People & Culture 자료 (Google re:Work, MS WorkLab, GitLab 등)': [
    'rework.withgoogle.com',
    'withgoogle.com',
    'blog.google',
    'microsoft.com',
    'gitlab.com',
    'atlassian.com',
    'netflix.com',
    'aboutamazon.com',
    'shopify.com',
    'hubspot.com',
    'slack.com',
    'notion.so',
    'openai.com',
    'anthropic.com',
    'medium.com',
  ],
  '국내 선도기업 조직문화 · 일하는 방식 (네이버, 카카오, 토스, SK, 삼성 등)': [
    'naver.com',
    'navercorp.com',
    'kakaocorp.com',
    'kakao.com',
    'toss.tech',
    'tossbank.com',
    'woowahan.com',
    'line.me',
    'sk.com',
    'skhynix.com',
    'sktelecom.com',
    'samsung.com',
    'samsungsds.com',
    'lg.com',
    'lgcns.com',
    'hyundai.com',
    'posco.com',
    'daangn.com',
    'kurly.com',
    'brunch.co.kr',
    'publy.co',
    'tistory.com',
    'wanted.co.kr',
    'saramin.co.kr',
    'jobkorea.co.kr',
  ],
  'HR · 경영 리서치 (HBR, McKinsey, Gartner, Deloitte 등)': [
    'hbr.org',
    'mckinsey.com',
    'gartner.com',
    'deloitte.com',
    'pwc.com',
    'bcg.com',
    'bain.com',
    'mercer.com',
    'shrm.org',
    'weforum.org',
    'joshbersin.com',
    'linkedin.com',
    'sloanreview.mit.edu',
    'mit.edu',
    'accenture.com',
  ],
  'HR · AX 컨퍼런스 & 발표자료 (ATD, HR Summit 등)': [
    'td.org',
    'youtube.com',
    'slideshare.net',
    'speakerdeck.com',
    'festa.io',
    'weforum.org',
    'eventbrite.com',
    'onoffmix.com',
  ],
};

export const isAllowedDomain = (domain: string, selectedDataSources: string[]): boolean => {
  if (!selectedDataSources || selectedDataSources.length === 0) return true;

  const allowedDomains: string[] = [];
  for (const ds of selectedDataSources) {
    if (SOURCE_DOMAIN_MAP[ds]) {
      allowedDomains.push(...SOURCE_DOMAIN_MAP[ds]);
    }
  }

  if (allowedDomains.length === 0) return true;

  const cleanDomain = domain.toLowerCase().trim().replace(/^www\./, '');
  return allowedDomains.some((allowed) => {
    const cleanAllowed = allowed.toLowerCase().trim().replace(/^www\./, '');
    return (
      cleanDomain === cleanAllowed ||
      cleanDomain.endsWith('.' + cleanAllowed)
    );
  });
};

export const dedupeSources = (sources: Array<{ title: string; uri: string; domain: string }>) => {
  const seen = new Set<string>();
  const result: Array<{ title: string; uri: string; domain: string }> = [];
  for (const s of sources) {
    if (!s.uri) continue;
    const key = s.uri.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        title: s.title || 'Untitled',
        uri: s.uri,
        domain: s.domain || '',
      });
    }
  }
  return result;
};

const parseRichText = (text: string) => {
  const result: any[] = [];
  const regex =
    /(!?\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ text: { content: text.substring(lastIndex, match.index) } });
    }

    if (match[1]) {
      result.push({
        text: {
          content: match[2],
          link: { url: match[3] },
        },
      });
    } else if (match[4]) {
      result.push({
        text: { content: match[5] },
        annotations: { bold: true },
      });
    } else if (match[6] || match[8]) {
      result.push({
        text: { content: match[7] || match[9] },
        annotations: { italic: true },
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push({ text: { content: text.substring(lastIndex) } });
  }

  return result.length > 0 ? result : [{ text: { content: text } }];
};

const toPlainTextRichText = (text: string) => {
  const cleaned = text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim();

  if (!cleaned) return [];

  const chunks: any[] = [];
  for (let i = 0; i < cleaned.length; i += 1800) {
    chunks.push({
      type: 'text',
      text: {
        content: cleaned.substring(i, i + 1800),
      },
    });
  }

  return chunks;
};

const parseMarkdownToNotionBlocks = (markdown: string) => {
  const blocks: any[] = [];
  const lines = markdown.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: toPlainTextRichText(line.replace('### ', '')) },
      });
    } else if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: toPlainTextRichText(line.replace('## ', '')) },
      });
    } else if (line.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: toPlainTextRichText(line.replace('# ', '')) },
      });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: toPlainTextRichText(line.replace(/^[-*]\s/, '')),
        },
      });
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: toPlainTextRichText(line.replace(/^\d+\.\s/, '')),
        },
      });
    } else if (line.startsWith('> ')) {
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: { rich_text: toPlainTextRichText(line.replace('> ', '')) },
      });
    } else if (line === '---' || line === '***') {
      blocks.push({ object: 'block', type: 'divider', divider: {} });
    } else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: toPlainTextRichText(line) },
      });
    }
  }

  return blocks;
};

app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV });
});

app.get(['/api/config-check', '/config-check'], (req, res) => {
  const notionApiKey = cleanEnv(process.env.NOTION_API_KEY);
  const notionDbIdRaw = cleanEnv(process.env.NOTION_DATABASE_ID);
  const geminiApiKey = cleanEnv(process.env.Gemini_API_Key || process.env.GEMINI_API_KEY);

  const normalizedNotionDbId = extractNotionId(notionDbIdRaw);
  const notionDbIdFormatValid = /^[a-f0-9]{32}$/i.test(normalizedNotionDbId);
  const notionDbUrl = notionDbIdFormatValid ? `https://www.notion.so/${normalizedNotionDbId}` : null;

  res.json({
    notionApiKeyPresent: !!notionApiKey,
    notionDbIdPresent: !!notionDbIdRaw,
    notionDbIdFormatValid,
    notionDbUrl,
    geminiApiKeyPresent: !!geminiApiKey,
    nodeEnv: process.env.NODE_ENV,
    debug: {
      notionApiKeyStatus: notionApiKey ? 'exists' : 'missing-or-empty',
      notionDbIdRawPreview: notionDbIdRaw ? `${notionDbIdRaw.slice(0, 8)}...` : 'missing',
      normalizedNotionDbIdPreview: normalizedNotionDbId
        ? `${normalizedNotionDbId.slice(0, 8)}...`
        : 'invalid',
    },
  });
});

app.post(['/api/analyze', '/analyze'], async (req, res) => {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const isDev = process.env.NODE_ENV !== 'production';

  try {
    const {
      period,
      selectedCategories = [],
      targetAges = [],
      purpose = 'AX 조직문화 / 일하는 방식 개선',
      dataSources = [],
      keyword = '',
      articleCount = 20,
      imageBase64,
    } = req.body;

    const safePeriod = normalizePeriod(period);
    const periodLabel = getPeriodLabel(safePeriod);

    const now = new Date();
    const daysMap: Record<string, number> = {
      '최근 1주': 7,
      '최근 2주': 14,
      '최근 1개월': 30,
      '최근 60일': 60,
      '최근 90일': 90,
      recent7: 7,
      recent14: 14,
      recent30: 30,
      recent60: 60,
      recent90: 90,
    };
    const days = daysMap[safePeriod] || 30;
    const startDateObj = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const startDate = startDateObj.toISOString().slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);

    const apiKey = cleanEnv(process.env.Gemini_API_Key || process.env.GEMINI_API_KEY);
    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY가 서버에 설정되지 않았습니다.',
        code: 'MISSING_API_KEY',
        factMetrics: { requestId, executionTimeMs: Date.now() - startTime },
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const groundingPrompt = getTrendAnalysisPrompt(
      safePeriod,
      selectedCategories,
      targetAges,
      purpose,
      dataSources,
      keyword,
      articleCount
    );

    const parts: any[] = [{ text: groundingPrompt }];
    if (imageBase64) {
      parts.push({
        inlineData: {
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg',
        },
      });
    }

    const groundingModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
    let groundingResponse: any = null;
    let groundingModelUsed: string | null = null;
    let groundingError: any = null;

    const callGrounding = async (callParts: any[]) => {
      for (const model of groundingModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: { parts: callParts },
            config: {
              tools: [{ googleSearch: {} }],
              maxOutputTokens: 8192,
              // 사고 레벨 3단계 실측 완료 (LOW 7차 / MINIMAL 8차 / HIGH 9차).
              // 측정 기록: docs/thinking-level-experiment.md
              //
              // HIGH는 기각됐다. maxOutputTokens(8192)는 "사고 + 출력"을 함께 세는 상한이라,
              // HIGH가 사고에만 6,183토큰을 쓰면서 상한에 걸려(finishReason=MAX_TOKENS)
              // 응답이 잘렸고, 정작 검색은 0회였다. 99초가 걸려 재시도 시간 예산(25초)도
              // 넘겨 안전망까지 무력화됐다.
              //
              // 가설("사고를 높이면 검색 판단이 신중해질 것")은 반증됐다.
              // 사고량과 검색 실행 여부 사이에 양의 상관이 관찰되지 않았다.
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            },
          });
          console.log('[DEBUG][TOKENS] grounding usageMetadata:', model, JSON.stringify(response?.usageMetadata));
          console.log('[DEBUG] grounding finishReason:', response?.candidates?.[0]?.finishReason);
          return { response, model };
        } catch (err: any) {
          groundingError = err;
        }
      }
      return null;
    };

    let grounded = await callGrounding(parts);

    // 같은 요청을 반복해도 모델이 googleSearch 도구를 아예 호출하지 않는 경우가 있다.
    // (webSearchQueries가 비고 groundingChunks도 0건 → 근거 부족으로 조기 종료)
    // 실측상 동일 조건 3회 중 2회가 이 상태였으므로, 검색이 일어나지 않았을 때만 1회 재시도한다.
    //
    // 예산 25초 -> 45초 (11차):
    // 그라운딩 1회가 실측 약 24초라 25초 예산은 경계에 걸쳐 있었다. 1초만 느려져도
    // 검색 미실행을 감지하고서도 재시도를 포기해 안전망이 무력화됐다.
    // Fluid Compute 환경의 실제 상한이 300초임을 확인했으므로 예산을 늘린다.
    // 최악의 경우(45초 + 재시도 30초 + 구조화 15초 = 약 90초)에도 210초 여유가 남는다.
    let groundingRetried = false;
    const RETRY_TIME_BUDGET_MS = 45000;

    if (grounded) {
      const firstPass = parseGroundingMetadata(grounded.response);
      const searchSkipped =
        (firstPass.searchQueriesExecuted?.length || 0) === 0 && (firstPass.sources?.length || 0) === 0;

      if (searchSkipped && Date.now() - startTime < RETRY_TIME_BUDGET_MS) {
        groundingRetried = true;
        console.warn('[WARN] 그라운딩이 검색 없이 응답했습니다. 검색을 강제해 1회 재시도합니다.');

        const retryParts = [
          {
            text:
              groundingPrompt +
              '\n\n[재시도 지시]\n' +
              '직전 응답은 Google Search를 한 번도 실행하지 않았다. 이는 규칙 위반이다.\n' +
              '반드시 googleSearch 도구로 실제 검색을 먼저 수행하고, 검색 결과에 나온 문서만으로 목록을 작성하라.\n' +
              '기억이나 사전 지식에 의존해 답하지 마라. 검색 없이 작성한 목록은 폐기된다.',
          },
          ...parts.slice(1),
        ];

        const retry = await callGrounding(retryParts);
        if (retry) {
          const retryPass = parseGroundingMetadata(retry.response);
          if ((retryPass.sources?.length || 0) > 0) {
            grounded = retry;
            console.log(`[INFO] 재시도로 출처 ${retryPass.sources.length}건을 확보했습니다.`);
          }
        }
      }
    }

    if (!grounded) {
      return res.status(500).json({
        error: 'Grounding 호출 실패',
        code: 'GROUNDING_FAILED',
        factMetrics: { requestId, executionTimeMs: Date.now() - startTime },
        debug: isDev ? { groundingError: groundingError?.message } : undefined,
      });
    }

    groundingResponse = grounded.response;
    groundingModelUsed = grounded.model;

    const groundingFinishReason = groundingResponse?.candidates?.[0]?.finishReason || null;
    const groundedText =
      groundingResponse?.output_text ||
      groundingResponse?.text ||
      groundingResponse?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ||
      '';

    const parsedGrounding = parseGroundingMetadata(groundingResponse);
    const rawSources = (parsedGrounding.sources || []).map((s: any) => {
      let domain = (s.domain || '').toLowerCase().trim().replace(/^www\./, '');
      if (!domain && s.uri) {
        try {
          domain = new URL(s.uri).hostname.toLowerCase().trim().replace(/^www\./, '');
        } catch {
          domain = '';
        }
      }
      return {
        title: s.title || 'Untitled',
        uri: s.uri || '',
        domain,
      };
    });

    const allowedSources: typeof rawSources = [];
    const filteredOutSources: typeof rawSources = [];

    for (const s of rawSources) {
      if (isAllowedDomain(s.domain, dataSources)) {
        allowedSources.push(s);
      } else {
        filteredOutSources.push(s);
      }
    }

    const extractedSources = dedupeSources(allowedSources);
    const readablePeriodInfo = getReadablePeriodRange(safePeriod);

    // 1. Evidence Ledger 생성
    const rawLedgerItems: EvidenceLedgerItem[] = [];
    const defaultCategory =
      selectedCategories.length === 1
        ? selectedCategories[0]
        : selectedCategories.join(' / ') || 'IT/기술';

    // 1-A. 우선 경로: 모델이 출력한 Evidence List를 파싱해서 원장을 만들고, 서버가 사후 검증한다.
    const groundedEntries = parseEvidenceListFromText(groundedText);
    const seenCanonicalUrls = new Set<string>();
    const usedBackingIdx = new Set<number>();
    let ledgerSource: 'parsed-evidence-list' | 'grounding-chunks' = 'parsed-evidence-list';

    for (const entry of groundedEntries) {
      const key = canonicalUrl(entry.url);
      if (!key || seenCanonicalUrls.has(key)) continue; // 같은 기사가 E1/E2로 중복되던 문제 차단
      seenCanonicalUrls.add(key);

      let host = '';
      try {
        host = new URL(entry.url).hostname.toLowerCase().replace(/^www\./, '');
      } catch {
        continue;
      }

      // 실제로 Google Search가 반환한 도메인인지 교차 검증한다 (모델이 지어낸 URL 차단).
      // 같은 도메인 글이 여러 건이면 아직 쓰지 않은 chunk를 먼저 배정해서
      // 서로 다른 근거가 동일한 리다이렉트 링크를 공유하지 않게 한다.
      const matches = (i: number) => {
        const d = rawSources[i].domain;
        return !!d && (host === d || host.endsWith('.' + d) || d.endsWith('.' + host));
      };
      let backingIdx = rawSources.findIndex((_, i) => matches(i) && !usedBackingIdx.has(i));
      if (backingIdx === -1) backingIdx = rawSources.findIndex((_, i) => matches(i));
      if (backingIdx === -1) continue;
      usedBackingIdx.add(backingIdx);
      const backing = rawSources[backingIdx];

      const periodValid = isWithinPeriod(entry.published, safePeriod, now);
      const sourceAllowed = isAllowedDomain(host, dataSources);

      rawLedgerItems.push({
        id: '',
        title: entry.title || backing.title || 'Untitled',
        url: backing.uri, // 링크는 검증된 그라운딩 리다이렉트 주소를 유지한다
        // 도메인 루트만 적어온 경우는 개별 글 주소가 아니므로 원문으로 노출하지 않는다
        originUrl: entry.hasArticlePath ? entry.url : '',
        sourceDomain: host,
        publishedDate: entry.published,
        category: entry.category || defaultCategory,
        claim: entry.claim.slice(0, 200),
        // 원문 주소가 개별 글까지 특정되지 않으면 High로 올리지 않는다
        confidence: periodValid && sourceAllowed && entry.hasArticlePath ? 'High' : 'Medium',
        periodValid,
        sourceAllowed,
      });
    }

    // 1-B. 폴백: 모델이 출력 형식을 지키지 않아 파싱이 실패한 경우 chunk 기반으로 만든다.
    if (rawLedgerItems.length === 0) {
      ledgerSource = 'grounding-chunks';
      const seenFallbackText = new Set<string>();

      for (let i = 0; i < rawSources.length; i++) {
        const s = rawSources[i];
        const url = s.uri ? s.uri.trim() : '';
        const sourceDomain = s.domain ? s.domain.trim() : '';
        const sourceAllowed = isAllowedDomain(sourceDomain, dataSources);

        const matchingClaim = (parsedGrounding.claims || []).find((c: any) =>
          c.sourceIndices?.includes(i)
        );
        const claimText = matchingClaim?.text || s.title || '';

        // 폴백에서는 그라운딩 본문 조각이 그대로 들어온다.
        // 마크다운 제목·섹션 머리말·필드 표기·URL을 걷어내야 사람이 읽을 문장만 남는다.
        const cleanedClaim = claimText
          .replace(/^#{1,6}\s*/gm, ' ')
          .replace(/기간\s*외\s*발견\s*(\([^)]*\))?/g, ' ')
          .replace(/Evidence\s*List/gi, ' ')
          .replace(EVIDENCE_FIELD_RE, ' ')
          .replace(/https?:\/\/\S+/g, ' ')
          .replace(/^[\s\-*•]+/, '')
          .replace(/\s+/g, ' ')
          .trim();

        // 같은 본문 조각이 여러 chunk에 붙어 E1/E2로 중복되던 것을 막는다.
        const dedupeKey = cleanedClaim.slice(0, 80) || url;
        if (seenFallbackText.has(dedupeKey)) continue;
        seenFallbackText.add(dedupeKey);

        const publishedDate = extractDateFromText(`${s.title} ${claimText}`, url);
        const periodValid = publishedDate ? isWithinPeriod(publishedDate, safePeriod, now) : false;

        // 조각에서 제목을 못 살리면 도메인이라도 쓰되, claim과 같은 값이 중복 노출되지 않게 한다.
        const fallbackTitle =
          s.title && s.title !== sourceDomain ? s.title : cleanedClaim.slice(0, 80) || sourceDomain;

        rawLedgerItems.push({
          id: '',
          title: fallbackTitle || 'Untitled',
          url,
          sourceDomain,
          publishedDate,
          category: defaultCategory,
          claim: cleanedClaim.slice(0, 200),
          confidence: periodValid && sourceAllowed ? 'High' : 'Medium',
          periodValid,
          sourceAllowed,
        });
      }
    }

    console.log(
      `[INFO] Evidence Ledger source=${ledgerSource} parsedEntries=${groundedEntries.length} ledgerItems=${rawLedgerItems.length}`
    );

    const dateUnverifiedCount = rawLedgerItems.filter((item) => item.publishedDate === null).length;
    const periodFilteredCount = rawLedgerItems.filter(
      (item) => item.publishedDate !== null && !item.periodValid
    ).length;

    // 2. 필수 정책에 따른 최종 evidenceList 필터링
    const filteredLedger = rawLedgerItems.filter(
      (item) => item.periodValid === true && item.sourceAllowed === true && !!item.url
    );

    const finalEvidenceLedger: EvidenceLedgerItem[] = [];
    const seenLedgerUrls = new Set<string>();

    for (const item of filteredLedger) {
      if (!seenLedgerUrls.has(item.url)) {
        seenLedgerUrls.add(item.url);
        finalEvidenceLedger.push({
          ...item,
          id: `E${finalEvidenceLedger.length + 1}`,
        });
      }
    }
    
// 2.5 근거가 너무 적으면 날짜 미확인/기간 외 항목을 최신순으로 최대 3개까지 보완한다.
    if (finalEvidenceLedger.length < 2) {
      const backupCandidates = rawLedgerItems.filter(
        (item) => item.sourceAllowed && item.url && !seenLedgerUrls.has(item.url)
      );
      backupCandidates.sort((a, b) => {
        if (!a.publishedDate) return 1;
        if (!b.publishedDate) return -1;
        return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
      });
      const needed = 3 - finalEvidenceLedger.length;
      for (const item of backupCandidates.slice(0, Math.max(needed, 0))) {
        seenLedgerUrls.add(item.url);
        finalEvidenceLedger.push({ ...item, id: `E${finalEvidenceLedger.length + 1}` });
      }
    }
    // 3. 근거 0개일 때 안전한 결과 반환
    if (finalEvidenceLedger.length === 0) {
      console.log('[INFO] 최종 유효 Evidence Ledger 항목이 0건입니다. 근거 부족 결과를 반환합니다.');
      const emptyReport = '해당 기간 내 검증 가능한 근거가 부족합니다.';
      const executionTimeMs = Date.now() - startTime;

      return res.json({
        report: emptyReport,
        evidenceList: [],
        dashboardData: {
          topTrends: [],
          categoryPriorities: [],
          promotionIdeas: [],
          ageInsights: [],
          thumbnailCopies: [],
          sourcingPoints: [],
          marketSignals: [],
        },
        notionPayload: {
          database_properties: {
            Title: `${periodLabel} AX Intelligence Report`,
            Period: periodLabel,
            Impact: 'Low',
            Keywords: keyword?.trim() || '없음',
            Categories: selectedCategories.join(', '),
            Purpose: purpose,
            TargetAges: targetAges.join(', '),
          },
          markdown_body: emptyReport,
        },
        sources: extractedSources,
        claims: [],
        factMetrics: {
          requestId,
          grounded: false,
          periodCode: safePeriod,
          periodLabel,
          startDate,
          endDate,
          periodRequested: readablePeriodInfo.rangeText,
          articleCount: Number(articleCount) || 20,
          executionTimeMs,
          groundingModelUsed,
          structuringModelUsed: 'none',
          groundingFinishReason,
          structuringFinishReason: 'SKIPPED',
          groundingOutputLength: groundedText ? groundedText.length : 0,
          structuringOutputLength: 0,
          totalSourcesCollected: rawSources.length,
          domainFilteredCount: filteredOutSources.length,
          dateUnverifiedCount,
          periodFilteredCount,
          periodViolationCount: periodFilteredCount,
          validEvidenceCount: 0,
          citedEvidenceCount: 0,
          jsonParseSuccess: true,
          searchQueriesExecuted: parsedGrounding.searchQueriesExecuted || [],
          groundingRetried,
          bannedWordFilterApplied: false,
          bannedWordPolicy: 'Pass',
          tokenUsage: {
            grounding: groundingResponse?.usageMetadata || null,
            structuring: null,
          },
        },
        debug: isDev
          ? {
              requestId,
              filteredOutSourcesCount: filteredOutSources.length,
            }
          : undefined,
      });
    }

    // 4. structuring 프롬프트 구성 (Evidence Ledger 포함)
    const structuringPrompt = buildStructuringPrompt({
      groundedText,
      groundingSources: extractedSources,
      evidenceLedger: finalEvidenceLedger,
      period: safePeriod,
      readablePeriod: readablePeriodInfo.rangeText,
      selectedCategories,
      targetAges,
      purpose,
      keyword,
    });

    let structuringResponse: any = null;
    let structuringModelUsed: string | null = null;
    let structuringError: any = null;

    try {
      structuringResponse = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: structuringPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: ANALYSIS_RESPONSE_SCHEMA,
          maxOutputTokens: 8192,
          // 실측상 LOW에서도 이 단계는 사고 토큰을 거의 안 썼다(응답 스키마에 값만 채우는
          // 구조라 여지가 적음). MINIMAL로 내려도 잃을 게 거의 없다.
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      });
      console.log('[DEBUG][TOKENS] structuring(3.6-flash) usageMetadata:', JSON.stringify(structuringResponse?.usageMetadata));
      console.log('[DEBUG] structuring(3.6-flash) finishReason:', structuringResponse?.candidates?.[0]?.finishReason);
      structuringModelUsed = 'gemini-3.6-flash';
    } catch (err: any) {
      structuringError = err;
      try {
        structuringResponse = await ai.models.generateContent({
          model: 'gemini-3.5-flash-lite',
          contents: structuringPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: ANALYSIS_RESPONSE_SCHEMA,
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          },
        });
        console.log('[DEBUG][TOKENS] structuring(3.5-flash-lite) usageMetadata:', JSON.stringify(structuringResponse?.usageMetadata));
        console.log('[DEBUG] structuring(3.5-flash-lite) finishReason:', structuringResponse?.candidates?.[0]?.finishReason);
        structuringModelUsed = 'gemini-3.5-flash-lite';
      } catch (err2: any) {
        structuringError = err2;
      }
    }

    if (!structuringResponse) {
      const executionTimeMs = Date.now() - startTime;
      return res.status(500).json({
        error: '구조화 호출 실패',
        code: 'STRUCTURING_FAILED',
        factMetrics: {
          requestId,
          periodCode: safePeriod,
          periodLabel,
          startDate,
          endDate,
          articleCount: Number(articleCount) || 20,
          executionTimeMs,
          groundingModelUsed,
          structuringModelUsed: 'none',
          groundingFinishReason,
          structuringFinishReason: null,
          groundingOutputLength: groundedText ? groundedText.length : 0,
          structuringOutputLength: 0,
          totalSourcesCollected: rawSources.length,
          domainFilteredCount: filteredOutSources.length,
          dateUnverifiedCount,
          periodFilteredCount,
          periodViolationCount: periodFilteredCount,
          validEvidenceCount: finalEvidenceLedger.length,
          citedEvidenceCount: 0,
          jsonParseSuccess: false,
        },
        debug: isDev ? { structuringError: structuringError?.message } : undefined,
      });
    }

    const structuringFinishReason = structuringResponse?.candidates?.[0]?.finishReason || null;
    const structuredText =
      structuringResponse?.text ||
      structuringResponse?.output_text ||
      '';
    const outputLength = structuredText ? structuredText.length : 0;

    if (structuringFinishReason === 'MAX_TOKENS') {
      const executionTimeMs = Date.now() - startTime;
      return res.status(422).json({
        error: '구조화 응답이 최대 길이를 초과했습니다.',
        code: 'STRUCTURING_OUTPUT_TRUNCATED',
        factMetrics: {
          requestId,
          periodCode: safePeriod,
          periodLabel,
          startDate,
          endDate,
          articleCount: Number(articleCount) || 20,
          executionTimeMs,
          groundingModelUsed,
          structuringModelUsed,
          groundingFinishReason,
          structuringFinishReason,
          groundingOutputLength: groundedText ? groundedText.length : 0,
          structuringOutputLength: outputLength,
          totalSourcesCollected: rawSources.length,
          domainFilteredCount: filteredOutSources.length,
          dateUnverifiedCount,
          periodFilteredCount,
          periodViolationCount: periodFilteredCount,
          validEvidenceCount: finalEvidenceLedger.length,
          citedEvidenceCount: 0,
          jsonParseSuccess: false,
        },
        debug: {
          requestId,
          finishReason: structuringFinishReason,
          outputLength,
          model: structuringModelUsed,
        },
      });
    }

    if (!structuredText || structuredText.trim() === '') {
      const executionTimeMs = Date.now() - startTime;
      return res.status(502).json({
        error: '구조화 응답이 비어있습니다.',
        code: 'EMPTY_STRUCTURING_RESPONSE',
        factMetrics: {
          requestId,
          periodCode: safePeriod,
          periodLabel,
          startDate,
          endDate,
          articleCount: Number(articleCount) || 20,
          executionTimeMs,
          groundingModelUsed,
          structuringModelUsed,
          groundingFinishReason,
          structuringFinishReason,
          groundingOutputLength: groundedText ? groundedText.length : 0,
          structuringOutputLength: 0,
          totalSourcesCollected: rawSources.length,
          domainFilteredCount: filteredOutSources.length,
          dateUnverifiedCount,
          periodFilteredCount,
          periodViolationCount: periodFilteredCount,
          validEvidenceCount: finalEvidenceLedger.length,
          citedEvidenceCount: 0,
          jsonParseSuccess: false,
        },
        debug: {
          requestId,
          finishReason: structuringFinishReason,
          outputLength,
          model: structuringModelUsed,
        },
      });
    }

    let structured: any = {};
    let jsonParseSuccess = true;

    try {
      structured = JSON.parse(structuredText);
    } catch {
      jsonParseSuccess = false;
      const executionTimeMs = Date.now() - startTime;
      return res.status(502).json({
        error: '구조화 응답 JSON 파싱에 실패했습니다.',
        code: 'INVALID_STRUCTURING_JSON',
        factMetrics: {
          requestId,
          periodCode: safePeriod,
          periodLabel,
          startDate,
          endDate,
          articleCount: Number(articleCount) || 20,
          executionTimeMs,
          groundingModelUsed,
          structuringModelUsed,
          groundingFinishReason,
          structuringFinishReason,
          groundingOutputLength: groundedText ? groundedText.length : 0,
          structuringOutputLength: outputLength,
          totalSourcesCollected: rawSources.length,
          domainFilteredCount: filteredOutSources.length,
          dateUnverifiedCount,
          periodFilteredCount,
          periodViolationCount: periodFilteredCount,
          validEvidenceCount: finalEvidenceLedger.length,
          citedEvidenceCount: 0,
          jsonParseSuccess: false,
        },
        debug: {
          requestId,
          finishReason: structuringFinishReason,
          outputLength,
          model: structuringModelUsed,
          ...(isDev ? { outputPreview: structuredText.slice(0, 1000) } : {}),
        },
      });
    }

    const enrichedClaims = (parsedGrounding.claims || []).map((claim: any) => ({
      text: claim.text,
      startIndex: claim.startIndex,
      endIndex: claim.endIndex,
      sourceIndices: claim.sourceIndices,
      sources: (claim.sourceIndices || [])
        .map((idx: number) => parsedGrounding.sources[idx])
        .filter(Boolean),
    }));

    // 주의: 예전에는 여기서 리포트 본문의 기간 표현("최근 1주간" 등)을 선택 기간으로
    // 강제 치환했다. 모델이 근거에 맞게 정확히 쓴 문장까지 바꿔버려 사실을 왜곡하므로 제거했다.
    // 기간 정보는 리포트 상단의 "요청 기간" 배지로만 전달한다.
    resetReplacementCount();
    const sanitizedReport = sanitizeText(structured.reportMarkdown || groundedText);

    // 5. Evidence Citation ID 검증 ([E1], [E2] 등)
    const matches = sanitizedReport.match(/\[E\d+\]/g) || [];
    const citedIds = Array.from(new Set(matches.map((m) => m.replace(/[\[\]]/g, ''))));
    const validLedgerIds = new Set(finalEvidenceLedger.map((item) => item.id));

    const invalidCitations = citedIds.filter((id) => !validLedgerIds.has(id));

    const hasCitationCoverageIssue = citedIds.length === 0 && finalEvidenceLedger.length > 0;
    if (hasCitationCoverageIssue) {
      console.warn('[WARN] 근거는 있지만 리포트 본문에 인용 표시가 전혀 없습니다.');
    }

    if (invalidCitations.length > 0) {
      console.error('[ERROR] INVALID_EVIDENCE_CITATION detected:', invalidCitations);
      const executionTimeMs = Date.now() - startTime;
      return res.status(422).json({
        error: '리포트에 존재하지 않는 Evidence ID 인용이 포함되어 있습니다.',
        code: 'INVALID_EVIDENCE_CITATION',
        factMetrics: {
          requestId,
          periodCode: safePeriod,
          periodLabel,
          startDate,
          endDate,
          articleCount: Number(articleCount) || 20,
          executionTimeMs,
          groundingModelUsed,
          structuringModelUsed,
          groundingFinishReason,
          structuringFinishReason,
          groundingOutputLength: groundedText ? groundedText.length : 0,
          structuringOutputLength: outputLength,
          totalSourcesCollected: rawSources.length,
          domainFilteredCount: filteredOutSources.length,
          dateUnverifiedCount,
          periodFilteredCount,
          periodViolationCount: periodFilteredCount,
          validEvidenceCount: finalEvidenceLedger.length,
          citedEvidenceCount: citedIds.length,
          jsonParseSuccess: true,
        },
        debug: {
          requestId,
          invalidCitations,
          validLedgerIds: Array.from(validLedgerIds),
          ...(isDev ? { reportMarkdownPreview: sanitizedReport.slice(0, 300) } : {}),
        },
      });
    }

    // 인용 검증이 끝난 뒤에 참고 근거 블록을 붙인다.
    // (먼저 붙이면 표 안의 [E1]이 "본문에 인용이 있다"고 잘못 집계된다)
    const reportWithReferences = sanitizedReport + buildReferenceTable(finalEvidenceLedger);
    const notionMarkdown = sanitizedReport + buildReferenceList(finalEvidenceLedger);

    // 액션 아이템이 인용한 Evidence ID도 리포트 본문과 같은 기준으로 검증한다.
    // 다만 대시보드는 부가 정보이므로 요청 전체를 422로 막지 않고, 유효하지 않은 ID만 제거한다.
    let droppedIdeaCitations = 0;
    const verifyIdeaCitations = (ideas: any[]) =>
      (Array.isArray(ideas) ? ideas : []).map((idea: any) => {
        const ids: string[] = Array.isArray(idea?.evidenceIds) ? idea.evidenceIds : [];
        const kept = ids.filter((id) => validLedgerIds.has(String(id).replace(/[[\]]/g, '')));
        droppedIdeaCitations += ids.length - kept.length;
        return { ...idea, evidenceIds: kept };
      });

    const rawDashboard = {
      topTrends: structured?.dashboardData?.topTrends || [],
      categoryPriorities: structured?.dashboardData?.categoryPriorities || [],
      promotionIdeas: verifyIdeaCitations(structured?.dashboardData?.promotionIdeas),
      ageInsights: [],
      thumbnailCopies: [],
      sourcingPoints: [],
      marketSignals: [],
    };

    const sanitizedDashboardData = sanitizeDashboardData(rawDashboard);
    const sanitizedClaims = sanitizeClaims(enrichedClaims);

    const responseEvidenceList = finalEvidenceLedger.map((e) => ({
      id: e.id,
      title: e.title,
      url: e.url,
      originUrl: e.originUrl || '',
      sourceDomain: e.sourceDomain,
      published_or_updated: e.publishedDate || '날짜 미확인',
      category: e.category,
      claim: e.claim,
      confidence: e.confidence,
      periodValid: e.periodValid,
    }));

    const sanitizedEvidence = sanitizeEvidenceList(responseEvidenceList);

    const impact =
      finalEvidenceLedger.length >= 5
        ? 'High'
        : finalEvidenceLedger.length >= 2
        ? 'Medium'
        : 'Low';

    const notionPayload = {
      database_properties: {
        Title: extractReportTitle(sanitizedReport, `${periodLabel} AX Intelligence Report`),
        Period: periodLabel,
        Impact: impact,
        Keywords: keyword?.trim() || '없음',
        Categories: selectedCategories.join(', '),
        Purpose: purpose,
        TargetAges: targetAges.join(', '),
      },
      markdown_body: notionMarkdown,
    };

    const executionTimeMs = Date.now() - startTime;

    return res.json({
      report: reportWithReferences,
      evidenceList: sanitizedEvidence,
      dashboardData: sanitizedDashboardData,
      notionPayload,
      sources: extractedSources,
      claims: sanitizedClaims,
      factMetrics: {
        requestId,
        grounded: extractedSources.length > 0,
        periodCode: safePeriod,
        periodLabel,
        startDate,
        endDate,
        periodRequested: readablePeriodInfo.rangeText,
        articleCount: Number(articleCount) || 20,
        executionTimeMs,
        groundingModelUsed,
        structuringModelUsed,
        groundingFinishReason,
        structuringFinishReason,
        groundingOutputLength: groundedText ? groundedText.length : 0,
        structuringOutputLength: outputLength,
        totalSourcesCollected: rawSources.length,
        domainFilteredCount: filteredOutSources.length,
        dateUnverifiedCount,
        periodFilteredCount,
        periodViolationCount: periodFilteredCount,
        validEvidenceCount: finalEvidenceLedger.length,
        citedEvidenceCount: citedIds.length,
        jsonParseSuccess,
        searchQueriesExecuted: parsedGrounding.searchQueriesExecuted || [],
        groundingRetried,
        bannedWordFilterApplied: getReplacementCount() > 0,
        bannedWordPolicy: 'replacement-map-v2',
        bannedWordReplacedCount: getReplacementCount(),
        citationCoverageWarning: hasCitationCoverageIssue,
        droppedIdeaCitations,
        tokenUsage: {
          grounding: groundingResponse?.usageMetadata || null,
          structuring: structuringResponse?.usageMetadata || null,
        },
      },
      debug: isDev
        ? {
            requestId,
            filteredOutSourcesCount: filteredOutSources.length,
            validLedgerIds: Array.from(validLedgerIds),
          }
        : undefined,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || '분석 중 오류가 발생했습니다.',
      code: 'INTERNAL_SERVER_ERROR',
      factMetrics: {
        requestId,
        executionTimeMs: Date.now() - startTime,
      },
    });
  }
});

app.post(['/api/save-to-notion', '/save-to-notion'], async (req, res) => {
  try {
    const { markdown, period, categories, targetAges, purpose, notionPayload } = req.body;

    const notionApiKey = cleanEnv(process.env.NOTION_API_KEY);
    const notionDbIdRaw = cleanEnv(process.env.NOTION_DATABASE_ID);
    const notionDbId = extractNotionId(notionDbIdRaw);

    if (!notionApiKey || !notionDbIdRaw) {
      return res.status(400).json({
        success: false,
        error: '노션 설정(API Key 또는 Database ID)이 누락되었습니다.',
      });
    }

    if (!/^[a-f0-9]{32}$/i.test(notionDbId)) {
      return res.status(400).json({
        success: false,
        error: `노션 데이터베이스 ID 형식이 올바르지 않습니다. 현재 값: "${notionDbIdRaw}"`,
      });
    }

    const notion = new Client({ auth: notionApiKey });
    const payloadProps = notionPayload?.database_properties || {};

    let contentToParse = markdown || notionPayload?.markdown_body || '';
    if (!contentToParse.includes('분석 기간:')) {
      contentToParse =
        `> **분석 기간:** ${period || '1주일'}\n` +
        `> **분석 카테고리:** ${categories || '전체'}\n` +
        `> **타겟 연령:** ${targetAges || '전체'}\n` +
        `> **분석 목적:** ${purpose || '트렌드 분석'}\n\n` +
        contentToParse;
    }

    const blocks = parseMarkdownToNotionBlocks(contentToParse);

    const nowIso = new Date().toISOString();

    const titleValue =
      payloadProps?.Title ||
      `[${period || '기간 미지정'}] ${categories || '전체'} 트렌드 분석 - ${
        purpose || '트렌드 분석'
      } (${targetAges || '전체'})`;

    const pValue = payloadProps?.Period || period || '최근 1주';
    const cValue = payloadProps?.Categories || categories || '전체';
    const tValue = payloadProps?.TargetAges || targetAges || '전체';
    const purpValue = payloadProps?.Purpose || purpose || '트렌드 분석';

    const properties: Record<string, any> = {
      Title: {
        title: [
          {
            type: 'text',
            text: {
              content: String(titleValue).substring(0, 2000),
            },
          },
        ],
      },
      Period: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: String(pValue).substring(0, 2000),
            },
          },
        ],
      },
      Categories: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: String(cValue).substring(0, 2000),
            },
          },
        ],
      },
      TargetAges: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: String(tValue).substring(0, 2000),
            },
          },
        ],
      },
      Purpose: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: String(purpValue).substring(0, 2000),
            },
          },
        ],
      },
      Date: {
        date: {
          start: nowIso,
        },
      },
    };

    console.log('Hardcoded Notion properties:', JSON.stringify(properties, null, 2));
    console.log('Parsed block count:', blocks.length);

    const firstBlockChildren = [
      {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `이 리포트는 ${period || '선택 기간'} 동안의 데이터를 바탕으로 생성된 AX Culture & Talent Intelligence 브리프입니다.`,
              },
            },
          ],
          icon: { emoji: '📊' as any },
          color: 'blue_background',
        },
      },
      { object: 'block', type: 'divider', divider: {} },
      ...blocks.slice(0, 95),
    ];

    let notionResponse: any;
    let fallbackUsed = false;
    let fallbackMessage = '';

    try {
      notionResponse = await notion.pages.create({
        parent: { database_id: notionDbId },
        properties,
        children: firstBlockChildren,
      } as any);
    } catch (e: any) {
      if (e.status === 400 || (e.message && e.message.includes('400'))) {
        fallbackUsed = true;
        fallbackMessage = e.message;

        console.warn(
          'First pages.create failed with properties, retrying with ONLY title. Error:',
          e.message
        );

        notionResponse = await notion.pages.create({
          parent: { database_id: notionDbId },
          properties: { Title: properties['Title'] },
          children: firstBlockChildren,
        } as any);
      } else {
        throw e;
      }
    }

    const pageId = notionResponse.id;
    const successProperties = fallbackUsed ? ['Title'] : Object.keys(properties);

    if (blocks.length > 95) {
      for (let i = 95; i < blocks.length; i += 80) {
        await notion.blocks.children.append({
          block_id: pageId,
          children: blocks.slice(i, i + 80),
        });
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    return res.json({
      success: true,
      url: notionResponse.url,
      mappedProperties: successProperties,
      debugMappedProperties: properties,
      debugFallbackUsed: fallbackUsed,
      blockCount: blocks.length,
      message: fallbackUsed
        ? `전체 속성 매핑 실패(제목+리포트 본문만 저장됨): ${fallbackMessage}`
        : undefined,
    });
  } catch (error: any) {
    console.error('Error saving to Notion:', error);

    let errorMessage = error?.message || '노션 저장 중 오류가 발생했습니다.';

    if (
      error?.code === 'restricted_resource' ||
      error?.status === 403 ||
      errorMessage.includes('403')
    ) {
      errorMessage =
        '노션 데이터베이스 접근 권한이 없습니다 (403). 데이터베이스 페이지에서 Integration을 연결해주세요.';
    } else if (
      error?.code === 'object_not_found' ||
      error?.status === 404 ||
      errorMessage.includes('404')
    ) {
      errorMessage =
        '노션 데이터베이스를 찾을 수 없습니다. Database ID와 Integration 연결 상태를 다시 확인해주세요.';
    } else if (errorMessage.includes('The string did not match the expected pattern')) {
      errorMessage = '노션 데이터베이스 ID 형식이 올바르지 않습니다.';
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

const isVercel = !!process.env.VERCEL;
const isProd = process.env.NODE_ENV === 'production';

const startServer = async () => {
  if (isVercel) return;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

if (!isVercel) {
  startServer();
}

export default app;
