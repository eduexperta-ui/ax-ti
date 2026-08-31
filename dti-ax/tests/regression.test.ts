/**
 * 회귀 방지 테스트
 *
 * 이 프로젝트에서 실제로 여러 번 깨졌던 지점만 골라 고정한다.
 * 전부 순수 함수라 API 키도 네트워크도 필요 없다 (비용 0).
 *
 * 실행: npm test
 *
 * 왜 이 세 가지인가
 *  1. parseEvidenceListFromText — 근거 카드에 프롬프트 출력 양식이 그대로 노출되는 문제가 2회 재발
 *  2. sanitizeText             — 과장어 치환이 어미를 깨뜨려 비문을 만들고(혁신적인→새로운인),
 *                                 공백 압축이 마크다운 들여쓰기·표 정렬을 무너뜨림
 *  3. 인용 마커 변환            — [E1]의 대괄호가 사라져 "도입했습니다E4."로 붙어버린 회귀
 */

// 주의: server.ts는 import되는 순간 app.listen()을 실행하려 한다.
// ESM은 import가 최상단 코드보다 먼저 평가되므로 여기서 process.env를 세팅해도 늦다.
// 그래서 VERCEL=1은 package.json의 test 스크립트에서 넘긴다.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEvidenceListFromText, canonicalUrl, buildReferenceTable } from '../server.js';
import { sanitizeText } from '../src/services/sanitize.js';

// ---------------------------------------------------------------------------
// 1. Evidence List 파싱
// ---------------------------------------------------------------------------

test('근거 카드에 프롬프트 출력 양식이 새어나오지 않는다', () => {
  const grounded = `
## Evidence List
- title: 배포 없이 앱과 로컬 웹을 잇다
- url: https://techblog.woowahan.com/19794/
- published_or_updated: 2026.08.04
- category: 백엔드 / MSA
- claim: CloudFront 리다이렉트와 WebSocket 터널을 활용했다.
- confidence: High
`;
  const [e] = parseEvidenceListFromText(grounded);

  assert.equal(e.title, '배포 없이 앱과 로컬 웹을 잇다');
  assert.equal(e.claim, 'CloudFront 리다이렉트와 WebSocket 터널을 활용했다.');
  assert.equal(e.published, '2026-08-04', '2026.08.04 형식도 정규화되어야 한다');
  assert.equal(e.hasArticlePath, true);

  // 화면에 노출되는 두 필드에 필드 표기가 남아 있으면 안 된다
  for (const field of ['- url:', 'published_or_updated', '- claim:']) {
    assert.ok(!e.title.includes(field), `title에 "${field}"가 남았다`);
    assert.ok(!e.claim.includes(field), `claim에 "${field}"가 남았다`);
  }
});

test('URL 뒤에 붙은 괄호 주석 때문에 엉뚱한 도메인이 출처가 되지 않는다', () => {
  // 실제 사례: 카카오 기사인데 모델이 우아한형제들 주소에 괄호로 대체 주소를 덧붙였다
  const grounded = `
- title: Beyond AI That Speaks Well
- url: https://techblog.woowahan.com/ (또는 https://tech.kakao.com/posts/728)
- published_or_updated: 2026-08-03
- claim: 카카오는 Kanana-o에 시맨틱 증류를 적용했다.
`;
  const [e] = parseEvidenceListFromText(grounded);

  assert.equal(e.url, 'https://techblog.woowahan.com/', '공백 앞에서 끊겨야 한다');
  assert.equal(e.hasArticlePath, false, '도메인 루트뿐이면 원문으로 신뢰하지 않는다');
});

test('기간 외 발견 섹션도 같은 필드 형식으로 파싱된다', () => {
  // 기간 내 근거가 0건일 때 모델이 이 섹션에만 결과를 넣어, 폴백 경로로 떨어지며 깨졌던 사례
  const grounded = `
## Evidence List

## 기간 외 발견
- title: 5년 동안 못 푼 배민 다국어 숙제
- url: https://techblog.woowahan.com/22217/
- published_or_updated: 2026-04-03
- claim: AI 도구로 장기 미해결 과제를 한 달 만에 완료했다.
`;
  const entries = parseEvidenceListFromText(grounded);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, '5년 동안 못 푼 배민 다국어 숙제');
  assert.ok(!entries[0].claim.includes('기간 외 발견'), '섹션 머리말이 claim에 섞이면 안 된다');
});

test('한 줄로 붙여 쓴 응답도 파싱된다', () => {
  const oneLine =
    '- title: 토스의 디바이스 팜 - url: https://toss.tech/article/1 ' +
    '- published_or_updated: 2026-07-30 - claim: 가상화 드라이버를 구축했다.';
  const [e] = parseEvidenceListFromText(oneLine);

  assert.equal(e.title, '토스의 디바이스 팜');
  assert.equal(e.claim, '가상화 드라이버를 구축했다.');
});

test('같은 기사가 중복 등재되지 않도록 URL이 정규화된다', () => {
  // E1/E2에 같은 글이 두 번 올라갔던 사례 — 리다이렉트 URL이 chunk마다 달라서 생겼다
  assert.equal(canonicalUrl('https://A.com/x/?utm=1#top'), 'https://a.com/x');
  assert.equal(
    canonicalUrl('https://d2.naver.com/helloworld/9091568/'),
    canonicalUrl('https://d2.naver.com/helloworld/9091568'),
  );
});

// ---------------------------------------------------------------------------
// 2. 과장 표현 필터
// ---------------------------------------------------------------------------

test('과장어 치환이 어미를 깨뜨려 비문을 만들지 않는다', () => {
  // 어간만 치환하던 시절: 혁신적인 → "새로운인", 압도적으로 → "높은으로"
  const cases: Array<[string, string]> = [
    ['혁신적인 아키텍처', '새로운 아키텍처'],
    ['압도적으로 빠른 응답', '크게 빠른 응답'],
    ['필수적인 절차', '중요한 절차'],
    ['완벽하게 동작', '안정적으로 동작'],
    ['폭발적으로 증가', '가파르게 증가'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(sanitizeText(input), expected);
  }
});

test('마크다운 들여쓰기와 표 정렬이 보존된다', () => {
  // 연속 공백을 1칸으로 압축하던 로직이 중첩 목록(2·4칸)과 표를 무너뜨렸다
  const nestedList = '- 상위\n  - 하위\n    - 더하위';
  assert.equal(sanitizeText(nestedList), nestedList);

  const table = '| A | B |\n| --- | --- |\n| 1 | 2 |';
  assert.equal(sanitizeText(table), table);
});

// ---------------------------------------------------------------------------
// 3. 인용 마커 / 참고 근거 표
// ---------------------------------------------------------------------------

test('인용 마커의 대괄호가 유지된다', () => {
  // 회귀 사례: [E4] → E4 로 바뀌어 "도입했습니다E4." 처럼 본문에 붙어버렸다
  // ReportResult.tsx의 renderWithClaims와 동일한 변환
  const evidenceList = [{ id: 'E4', url: 'https://ex.com/e4' }];
  const transform = (text: string) =>
    text.replace(/\[(E\d+)\]/g, (match, id) => {
      const ev = evidenceList.find((e) => e.id === id);
      return ev && ev.url ? `[**\\[${id}\\]**](${ev.url})` : match;
    });

  const out = transform('SSE를 도입했습니다[E4]. 다음 문장.');

  assert.ok(out.includes('\\[E4\\]'), '이스케이프된 대괄호가 있어야 화면에 [E4]로 보인다');
  assert.ok(out.includes('](https://ex.com/e4)'), '링크로 변환되어야 한다');
  assert.ok(!/습니다E4/.test(out), '대괄호 없이 본문에 붙으면 안 된다');
});

test('참고 근거 표는 원장 그대로 생성된다', () => {
  const ledger: any = [
    { id: 'E1', title: '제목 A', sourceDomain: 'd2.naver.com', publishedDate: '2026-08-05', periodValid: true },
    { id: 'E2', title: '파이프 | 가 든 제목', sourceDomain: 'toss.tech', publishedDate: null, periodValid: false },
  ];
  const table = buildReferenceTable(ledger);

  assert.ok(table.includes('## 참고 근거'));
  assert.ok(table.includes('| [E1] |') && table.includes('| [E2] |'));
  assert.ok(table.includes('파이프 \\| 가 든 제목'), '표를 깨뜨리는 파이프는 이스케이프되어야 한다');
  assert.ok(table.includes('날짜 미확인'));
  assert.ok(table.includes('*(기간 외)*'), '보완으로 들어온 근거는 표시되어야 한다');
  assert.equal(buildReferenceTable([]), '', '근거가 없으면 표를 만들지 않는다');
});
