import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText, ExternalLink, Sparkles, CheckCircle2, Copy, 
  ShieldCheck, Database, Layers, ArrowUpRight, 
  Lightbulb, Filter, AlertTriangle
} from 'lucide-react';
import { DashboardData, FactMetrics } from '../types';

interface VerifiedSource {
  title: string;
  uri: string;
  domain: string;
}

interface GroundedClaim {
  text: string;
  startIndex: number;
  endIndex: number;
  sourceIndices: number[];
}

interface ReportResultProps {
  report: string;
  dashboardData: DashboardData;
  sources?: VerifiedSource[];
  claims?: GroundedClaim[];
  evidenceList?: any[];
  notionPayload?: any;
  factMetrics?: FactMetrics;
  period?: string;
  categories?: string[];
  targetAges?: string[];
  purpose?: string;
}

/** promotionIdeas.priority는 모델이 P1/High 등으로 섞어 보낼 수 있어 양쪽 표기를 모두 받는다 */
const isTopPriority = (priority?: string): boolean => {
  const p = String(priority || '').toUpperCase();
  return p === 'P1' || p === 'HIGH';
};

export const ReportResult: React.FC<ReportResultProps> = ({
  report,
  dashboardData,
  sources = [],
  claims = [],
  evidenceList = [],
  notionPayload,
  factMetrics,
  period,
  categories,
  targetAges,
  purpose
}) => {
  const [activeTab, setActiveTab] = useState<'report' | 'notion' | 'dashboard' | 'evidence'>('report');
  const [copied, setCopied] = useState(false);
  const [savingNotion, setSavingNotion] = useState(false);
  const [notionResult, setNotionResult] = useState<{ success: boolean; url?: string; message?: string } | null>(null);

  const effectiveSources = sources.length > 0 ? sources : [];

  const handleCopyReport = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToNotion = async () => {
    setSavingNotion(true);
    setNotionResult(null);

    try {
      const response = await fetch('/api/save-to-notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown: report,
          period,
          categories: categories?.join(', '),
          targetAges: targetAges?.join(', '),
          purpose,
          notionPayload,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setNotionResult({
          success: true,
          url: data.url,
          message: 'Notion DB에 분석 리포트가 정상적으로 저장되었습니다.',
        });
      } else {
        setNotionResult({
          success: false,
          message: data.error || 'Notion 저장에 실패했습니다. API 키 및 DB 설정을 확인하세요.',
        });
      }
    } catch {
      setNotionResult({
        success: false,
        message: '서버와의 통신 오류로 Notion 저장을 완료하지 못했습니다.',
      });
    } finally {
      setSavingNotion(false);
    }
  };

  const renderWithClaims = (text: string) => {
    let modifiedText = text;
    
    // [E1], [E2] 인용 마커를 클릭 가능한 마크다운 하이퍼링크로 변환.
    // 대괄호는 반드시 유지한다. 없애면 "도입했습니다E4." 처럼 본문에 붙어 읽힌다.
    // 링크 텍스트 안에서는 \[ \] 로 이스케이프해야 파서가 중첩 링크로 오해하지 않는다.
    if (evidenceList && evidenceList.length > 0) {
      modifiedText = modifiedText.replace(/\[(E\d+)\]/g, (match, id) => {
        const ev = evidenceList.find((e: any) => e.id === id);
        return ev && ev.url ? `[**\\[${id}\\]**](${ev.url})` : match;
      });
    }

    return (
      <div className="markdown-body text-sm font-medium text-neutral-800 leading-relaxed space-y-4">
        <Markdown remarkPlugins={[remarkGfm]}>{modifiedText}</Markdown>
      </div>
    );
  };

  // 마크다운이 아닌 일반 텍스트(예: 액션 아이템의 rationale) 안의 [E1] 인용을 링크로 바꾼다.
  const renderCitations = (text: string) => {
    if (!text) return null;
    return text.split(/(\[E\d+\])/g).map((part, i) => {
      const m = part.match(/^\[(E\d+)\]$/);
      if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
      const ev = evidenceList.find((e: any) => e.id === m[1]);
      if (!ev?.url) return <React.Fragment key={i}>{part}</React.Fragment>;
      return (
        <a
          key={i}
          href={ev.url}
          target="_blank"
          rel="noreferrer"
          className="font-bold text-neutral-900 border-b border-neutral-300 hover:border-neutral-900"
        >
          {part}
        </a>
      );
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-neutral-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1.5 border ${
                factMetrics?.grounded
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {factMetrics?.grounded ? '팩트 검증 완료 (Google Search Grounded)' : '검증 제한 (검색 결과 없음)'}
              </span>
              <span className="px-3 py-1 bg-white/10 text-neutral-300 text-xs font-bold rounded-full">
                {factMetrics?.structuringModelUsed || 'Gemini'} Intelligence
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mb-2">
              AX Culture &amp; Talent Intelligence Report
            </h2>
            <p className="text-sm text-neutral-300 font-normal max-w-2xl leading-relaxed">
              수집된 실무 기술 아티클과 지식 시그널을 구글 서치 기반으로 엄격히 교차 검증하여 생성된 리포트입니다.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {factMetrics?.periodRequested && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-neutral-200">
                  요청 기간: {factMetrics.periodRequested}
                </span>
              )}
              {factMetrics?.bannedWordFilterApplied && (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold border bg-purple-50 text-purple-800 border-purple-200">
                  <Filter className="w-3.5 h-3.5 text-purple-600" />
                  <span>
                    과장 표현 필터 적용됨
                    {factMetrics?.bannedWordPolicy ? ` (${factMetrics.bannedWordPolicy})` : ''}
                  </span>
                </div>
              )}
            </div>

            {factMetrics?.periodViolationCount !== undefined && factMetrics.periodViolationCount > 0 && (
              <div className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  기간({factMetrics.periodRequested}) 밖 문서 {factMetrics.periodViolationCount}건이 함께 탐색되었습니다.
                  기간 내 근거가 부족하면 그중 일부가 "기간 외 보완" 표시와 함께 근거 목록에 포함됩니다.
                </span>
              </div>
            )}

            {factMetrics?.citationCoverageWarning && (
              <div className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  이번 리포트 본문에는 근거 인용 표시([E1] 등)가 포함되지 않았습니다. "검증된 원문 근거 소스" 탭에서 근거 목록을 직접 확인해 주세요.
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleSaveToNotion}
              disabled={savingNotion}
              className="px-5 py-3 bg-white text-neutral-900 rounded-2xl text-xs font-extrabold hover:bg-neutral-100 active:scale-95 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {savingNotion ? (
                <span className="animate-pulse">노션 저장 중...</span>
              ) : (
                <>
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Notion DB 저장</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyReport}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all"
              title="리포트 복사"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {notionResult && (
          <div className={`mt-4 p-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-2 ${
            notionResult.success ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{notionResult.message}</span>
            </div>
            {notionResult.url && (
              <a
                href={notionResult.url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0"
              >
                페이지 이동 <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeTab === 'report'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>AI 분석 브리프 리포트</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeTab === 'dashboard'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>AX 추진 대시보드</span>
          </button>

          <button
            onClick={() => setActiveTab('evidence')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeTab === 'evidence'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>검증된 원문 근거 소스 ({evidenceList && evidenceList.length > 0 ? evidenceList.length : effectiveSources.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Markdown Report */}
      {activeTab === 'report' && (
        <div className="bg-white p-8 md:p-12 rounded-3xl border border-neutral-200/90 shadow-xs space-y-8">
          {report.trim() === '해당 기간 내 검증 가능한 근거가 부족합니다.' || (factMetrics?.validEvidenceCount === 0 && evidenceList.length === 0) ? (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-8 space-y-5 text-amber-950">
              <div className="flex items-center gap-3 border-b border-amber-200/60 pb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-amber-900">선택한 기간 내 검증 가능한 근거 소스가 부족합니다</h3>
                  <p className="text-xs text-amber-700 mt-0.5">요청하신 수집 조건에 맞는 팩트 기반 근거 자료가 검색되지 않았습니다.</p>
                </div>
              </div>

              <div className="text-sm leading-relaxed text-amber-900 font-medium">
                {report}
              </div>

              <div className="bg-white p-5 rounded-xl border border-amber-200/80 text-xs text-amber-900 space-y-3">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>추천 조치 사항:</span>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-neutral-700 font-medium">
                  <li><strong>수집 기간 확장:</strong> 수집 기간을 더 길게 설정해 보세요 (예: 최근 1주 → 최근 1개월 / 90일).</li>
                  <li><strong>데이터 소스 다양화:</strong> 수집 대상 데이터 소스(글로벌 People &amp; Culture 자료, HR 리서치 등)를 추가해 보세요.</li>
                  <li><strong>검색 키워드 조정:</strong> 특정 키워드가 너무 제한적인 경우 키워드를 비우거나 범용 카테고리를 선택해 보세요.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="max-w-none">
              {renderWithClaims(report)}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: AX Dashboard */}
      {activeTab === 'dashboard' && dashboardData && (
        <div className="space-y-6">
          {/* Promotion Ideas */}
          {dashboardData.promotionIdeas && dashboardData.promotionIdeas.length > 0 && (
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-neutral-200/90 shadow-xs space-y-6">
              <div className="border-b border-neutral-100 pb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-extrabold text-neutral-900">AX 추진 과제 및 실행 아이템</h3>
                </div>
                {/* 우선순위는 근거의 성격으로만 정해지므로 P1·P3만 나오는 경우도 정상이다.
                    기준을 밝혀두지 않으면 "P2가 빠졌다"고 읽힌다. */}
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  우선순위는 근거의 성격으로 매깁니다 —
                  <span className="font-bold text-neutral-700"> P1</span> 출처 2곳 이상에서 반복 확인 ·
                  <span className="font-bold text-neutral-700"> P2</span> 단일 출처이나 실행에 필요한 내용이 구체적 ·
                  <span className="font-bold text-neutral-700"> P3</span> 단일 출처 참고 수준.
                  해당 등급이 없으면 표시되지 않습니다.
                </p>
              </div>

              <div className="space-y-3">
                {dashboardData.promotionIdeas.map((idea, i) => (
                  <div key={i} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded shrink-0 ${
                            isTopPriority(idea.priority) ? 'bg-red-100 text-red-800' : 'bg-neutral-200 text-neutral-800'
                          }`}>
                            {idea.priority}
                          </span>
                          <h4 className="font-bold text-neutral-900 text-sm">{idea.title}</h4>
                        </div>
                        <p className="text-xs text-neutral-600 leading-relaxed">{idea.description}</p>
                      </div>
                      <span className="px-3 py-1 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-xs font-bold shrink-0 self-start whitespace-nowrap">
                        타겟: {idea.target}
                      </span>
                    </div>

                    {/* 왜 해야 하는가 — 수집된 근거에서 도출된 판단 이유 */}
                    {idea.rationale && (
                      <div className="bg-white rounded-xl border border-neutral-200/80 p-3">
                        <div className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider mb-1">
                          왜 지금 이 주제인가
                        </div>
                        <p className="text-xs text-neutral-700 leading-relaxed">
                          {renderCitations(idea.rationale)}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      {idea.successMetric && (
                        <div className="flex-1 min-w-0 flex items-start gap-1.5 text-[11px] text-neutral-600">
                          <span className="font-extrabold text-neutral-500 shrink-0">성공 판단 기준</span>
                          <span className="leading-relaxed">{idea.successMetric}</span>
                        </div>
                      )}
                      {idea.evidenceIds && idea.evidenceIds.length > 0 && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-bold text-neutral-400">근거</span>
                          {idea.evidenceIds.map((id) => (
                            <span key={id} className="px-1.5 py-0.5 bg-neutral-900 text-white text-[10px] font-bold rounded">
                              {id}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Trends */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-neutral-200/90 shadow-xs space-y-6">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-4">
              <Sparkles className="w-5 h-5 text-neutral-900" />
              <h3 className="text-lg font-extrabold text-neutral-900">
                {dashboardData.topTrends && dashboardData.topTrends.length > 0
                  ? `참고: 핵심 기술 트렌드 TOP ${dashboardData.topTrends.length}`
                  : '참고: 핵심 기술 트렌드'}
              </h3>
            </div>

            {(!dashboardData.topTrends || dashboardData.topTrends.length === 0) ? (
              <p className="text-sm text-neutral-500 py-4">이번 조건에서는 클러스터링할 만큼 충분한 트렌드가 수집되지 않았습니다.</p>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dashboardData.topTrends?.map((trend, i) => (
                <div key={i} className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black px-2.5 py-1 bg-neutral-900 text-white rounded-md">
                      0{i + 1}
                    </span>
                    {typeof trend.mentionCount === 'number' && trend.mentionCount >= 2 && (
                      <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                        관련 출처 {trend.mentionCount}곳 언급
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-neutral-900 text-base">{trend.title}</h4>
                  <p className="text-xs text-neutral-600 leading-relaxed">{trend.summary}</p>

                  {trend.devrelImplication && (
                    <div className="flex items-start gap-1.5 pt-1">
                      <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider shrink-0 mt-px">
                        AX 관점
                      </span>
                      <p className="text-[11px] text-neutral-700 leading-relaxed font-medium">
                        {trend.devrelImplication}
                      </p>
                    </div>
                  )}

                  {trend.keyItems && trend.keyItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {trend.keyItems.map((item, j) => (
                        <span key={j} className="px-2 py-0.5 bg-white border border-neutral-200 rounded-md text-[11px] font-bold text-neutral-700">
                          #{item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Verified Evidence Sources */}
      {activeTab === 'evidence' && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-neutral-200/90 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 border-b border-neutral-100 pb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <h3 className="text-lg font-extrabold text-neutral-900">Google Search Grounded 원문 근거 소스</h3>
              </div>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                링크는 Google Search Grounding API가 제공하는 리다이렉트 주소로, 개별 글이 아닌 출처 사이트로 연결될 수 있습니다.
                발행일은 본문·URL에서 추출한 추정값이며 원문과 다를 수 있습니다.
              </p>
            </div>
            <span className="text-xs font-bold text-neutral-500 shrink-0 whitespace-nowrap">
              총 {evidenceList && evidenceList.length > 0 ? evidenceList.length : effectiveSources.length}건 수집 완료
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evidenceList && evidenceList.length > 0 ? (
              evidenceList.map((item, i) => (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-2xl border border-neutral-200 hover:border-neutral-900 hover:shadow-sm transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-neutral-900 text-white text-[10px] font-bold rounded">
                          {item.id}
                        </span>
                        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] font-bold rounded">
                          {item.sourceDomain || '검증된 웹사이트'}
                        </span>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                    </div>
                    <h4 className="font-bold text-neutral-900 text-sm group-hover:text-neutral-900 line-clamp-2">
                      {item.title || item.claim}
                    </h4>
                    {item.claim && item.claim !== item.title && (
                      <p className="text-[11px] text-neutral-500 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                        {item.claim}
                      </p>
                    )}
                    {item.originUrl && (
                      <p className="text-[10px] text-neutral-400 mt-1.5 truncate font-mono">
                        원문: {item.originUrl}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 gap-2">
                    <span className="text-[11px] font-medium text-neutral-500">
                      발행 추정일: {item.published_or_updated || '미상'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.periodValid === false && (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          기간 외 보완
                        </span>
                      )}
                      <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        신뢰도: {item.confidence || '보통'}
                      </span>
                    </div>
                  </div>
                </a>
              ))
            ) : (
              effectiveSources.map((source, i) => (
                <a
                  key={i}
                  href={source.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-2xl border border-neutral-200 hover:border-neutral-900 hover:shadow-sm transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] font-bold rounded">
                        {source.domain || '검증된 웹사이트'}
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                    </div>
                    {source.title && source.title.toLowerCase().trim() !== (source.domain || '').toLowerCase().trim() && (
                      <h4 className="font-bold text-neutral-900 text-sm group-hover:text-neutral-900 line-clamp-2">
                        {source.title}
                      </h4>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-3 truncate">
                    {source.uri}
                  </p>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
