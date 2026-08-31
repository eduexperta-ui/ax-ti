export const buildGroundingPrompt = (
  period: string,
  selectedCategories: string[],
  targetAges: string[],
  purpose: string,
  dataSources: string[],
  keyword: string,
  articleCount: number
) => {
  const currentDateStr = new Date().toISOString().slice(0, 10);
  const DATA_SOURCE_DOMAIN_HINTS: Record<string, string> = {
    '글로벌 기업 People & Culture 자료 (Google re:Work, MS WorkLab, GitLab 등)':
      'rework.withgoogle.com, microsoft.com, gitlab.com, atlassian.com, aboutamazon.com',
    '국내 선도기업 조직문화 · 일하는 방식 (네이버, 카카오, 토스, SK, 삼성 등)':
      'navercorp.com, kakaocorp.com, toss.tech, sk.com, samsung.com, brunch.co.kr, publy.co',
    'HR · 경영 리서치 (HBR, McKinsey, Gartner, Deloitte 등)':
      'hbr.org, mckinsey.com, gartner.com, deloitte.com, weforum.org, joshbersin.com',
    'HR · AX 컨퍼런스 & 발표자료 (ATD, HR Summit 등)':
      'td.org, youtube.com, slideshare.net, speakerdeck.com, festa.io',
  };
  return `
너는 AX Culture & Talent Intelligence 리서치 에이전트다.
조직문화·일하는 방식·스킬 기반 HR·AI 역량 강화에 관한 기업 사례와 리서치 자료를 수집한다.

[절대 규칙]
1. 반드시 Google Search로 실제 검색한 문서만 사용한다.
2. 오늘은 ${currentDateStr}이다. "${period}" 이내에 발행/업데이트된 문서를 우선 채택하라.
   기간 밖 문서는 "## Evidence List"가 아니라 "## 기간 외 발견" 섹션에 분리해서 쓴다.
   두 섹션 모두 아래 [출력 형식]의 6개 필드를 똑같이 채워야 한다.
   기간 외 항목이라고 해서 필드를 생략하거나 줄글로 쓰지 마라.
3. 각 항목마다 발행일 또는 최신 업데이트일을 반드시 표기하라. 날짜를 알 수 없으면 "날짜 미확인"이라고 써라.
4. 과장 표현("혁신적", "압도적", "게임체인저", "필수적", "폭발적", "완벽한", "최고의")을 쓰지 마라. 사실과 수치 중심으로 서술하라.
5. 근거가 부족하면 추측하지 말고 "근거 부족"이라고 써라.

[조건]
- 카테고리: ${selectedCategories.join(', ')}
- 타겟: ${targetAges.join(', ')}
- 목적: ${purpose}
- 다음 도메인들을 우선 검색하라: ${dataSources.map(label => DATA_SOURCE_DOMAIN_HINTS[label] || label).join(', ')}
- 위 도메인을 최우선으로 검색하라. 검색 결과가 부족하면 관련성 높은 다른 기업 사례·리서치 자료로 보완할 수 있다.
- 키워드: ${keyword?.trim() || '없음'}
  키워드는 우선 탐색 힌트이지 필수 조건이 아니다. 해당 키워드로 위 조건을 만족하는 문서가
  2건 미만이면, 키워드를 완화해 카테고리 범위 전체에서 수집하라. 결과를 비우지 마라.
- 목표 수집 건수: 최대 ${articleCount}건

[출력 형식]
아래 두 섹션을 쓴다. 해당 항목이 없으면 섹션 제목만 쓰고 비워 둔다.

## Evidence List        ← "${period}" 이내 발행 문서
## 기간 외 발견          ← 기간 밖이지만 주제 관련성이 높은 문서

두 섹션 모두 각 항목을 아래 6개 필드로, 항목마다 줄을 바꿔서 쓴다.
- title: (원문 글 제목 그대로)
- url: (개별 글의 전체 주소 하나만. 괄호 주석·대체 주소·설명을 절대 덧붙이지 마라. 예: "https://a.com/ (또는 https://b.com)" 같은 표기 금지. 개별 글 주소를 모르면 그 항목 자체를 빼라)
- published_or_updated: (YYYY-MM-DD. 모르면 "날짜 미확인")
- category: (${selectedCategories.join(' | ')} 중 하나만 선택)
- claim: (한 문장, 과장 없이)
- confidence: High | Medium | Low

url의 도메인은 반드시 그 글이 실제로 실린 사이트여야 한다.
A사 사례에 B사 주소를 쓰는 식의 불일치는 규칙 위반이다.
`;
};

export const buildStructuringPrompt = ({
  groundedText,
  groundingSources,
  evidenceLedger = [],
  period,
  readablePeriod,
  selectedCategories,
  targetAges,
  purpose,
  keyword,
}: {
  groundedText: string;
  groundingSources: Array<{ title: string; uri: string; domain?: string }>;
  evidenceLedger?: Array<{
    id: string;
    title: string;
    url: string;
    sourceDomain: string;
    publishedDate: string | null;
    category: string;
    claim: string;
  }>;
  period: string;
  readablePeriod?: string;
  selectedCategories: string[];
  targetAges: string[];
  purpose: string;
  keyword: string;
}) => {
  const ledgerText =
    evidenceLedger.length > 0
      ? evidenceLedger
          .map(
            (e) =>
              `[${e.id}] 제목: ${e.title} | URL: ${e.url} | 발행일: ${
                e.publishedDate || '날짜미상'
              } | 출처: ${e.sourceDomain} | 핵심사실: ${e.claim}`
          )
          .join('\n')
      : '검증된 Evidence Ledger 항목 없음';

  const periodDisplay = readablePeriod || period;

  return `
너는 구조화 전문 분석기다.
아래의 Evidence Ledger, grounded research text, source list만 사용해서 JSON 하나만 출력하라.
절대 새로운 출처나 사실을 추가하지 마라. 과장 표현을 쓰지 마라.

[작성 규칙]
1. reportMarkdown은 900자 이상 2200자 이하다.
2. topTrends는 3~4개다.
3. categoryPriorities는 최대 4개다.
4. promotionIdeas는 3~4개다. 근거가 3건 미만이면 2개까지 줄일 수 있다.
5. 각 제목은 최대 80자다.
6. summary, description, target, rationale은 각각 최대 180자다. successMetric은 최대 100자다.
7. reportMarkdown 안의 사실에 기반한 문장은 예외 없이 전부 끝에 Evidence Ledger의 [E1], [E2] 형식 ID를 인용하여 붙여야 한다. 인용 없이 사실을 서술하는 문장을 쓰지 마라. 여러 근거를 종합한 문장이면 관련된 ID를 전부 붙여라(예: [E1][E3]). 하나의 리포트에 인용이 하나도 없는 것은 규칙 위반이다.
8. Evidence Ledger에 존재하지 않는 ID([E999] 등), 미확인 사실, URL, 날짜, 숫자, 회사명, 출처를 추가하지 마라.
9. 근거가 부족하면 "해당 기간 내 검증 가능한 근거가 부족합니다."라고 쓰고 내용을 지어내지 않는다.
10. JSON 외의 텍스트나 markdown code fence를 출력하지 않는다.
11. reportMarkdown은 반드시 "# "로 시작하는 한 줄 제목으로 시작한다. 제목은 40자 이내이며, 제목 줄에는 인용 ID를 붙이지 않는다.
11-1. 제목에는 이번 수집분에서 실제로 확인된 구체적 소재를 최소 1개 넣는다.
     기술명·조직명·문제 영역 중 무엇이든 좋다.
     · 좋은 예: "AI 도입 초기 저항을 줄인 제조 조직의 변화관리 방식"
     · 좋은 예: "직무 중심에서 스킬 중심으로 옮겨간 HR 체계 사례"
     · 나쁜 예: "최근 1개월 HR 동향 분석 보고서" (어느 리포트에나 붙일 수 있음)
     · 나쁜 예: "주요 기업 조직문화 트렌드" (수집 내용이 드러나지 않음)
     기간 표기("최근 1개월")만으로 제목을 시작하지 마라.
12. 제목 다음 본문은 아래 네 섹션을 이 순서대로 포함한다.
    ## 핵심 요약
      - 불릿 3~4개. 각 불릿은 "무엇이 관찰되었는가"를 사실로 쓰고 인용 ID를 붙인다.
    ## 선도기업 벤치마킹
      - 근거별로 서술한다. 각 사례마다 (a) 어떤 조직이 무엇을 도입·시행했는가 (b) 어떤 조직적 과제를 풀려던 것인가
        두 가지를 쓴다. (b)를 근거에서 알 수 없으면 쓰지 말고 (a)만 쓴다.
    ## 관찰된 공통 흐름
      - 2개 이상의 출처에서 반복되는 패턴만 쓴다. 반복 패턴이 없으면
        "이번 수집분에서는 여러 출처에 걸친 공통 패턴이 관찰되지 않았습니다."라고만 쓴다.
    ## AX 추진 시사점
      - 불릿 2~3개. 각 불릿은 "이 근거들이 있으므로 → 어떤 제도·프로그램을 검토할 만하다" 형태로 쓴다.
        단정적 효과 예측("~하면 몰입도가 올라간다")은 쓰지 않는다.
13. 표는 "여러 대상을 같은 기준으로 비교할 때"만 쓴다. GitHub 마크다운 표 문법을 쓰고 앞뒤에 빈 줄을 넣는다.
    · 쓸 만한 표: 조직별로 같은 과제를 어떻게 다르게 풀었는지 비교 (열: 조직 | 도입한 제도·툴 | 선택한 트레이드오프)
    비교할 대상이 2개 미만이면 표를 만들지 말고 문장으로 쓴다.
14. 참고 근거 목록("출처 | 제목 | 발행일" 형태의 표나 목록)은 절대 직접 만들지 마라.
    서버가 검증된 원장에서 리포트 맨 끝에 "## 참고 근거"를 자동으로 붙인다.
    직접 만들면 같은 내용이 두 번 나온다. "## 참고 근거"라는 제목도 쓰지 마라.

[객관적 데이터 추출 지침]
1. 임의의 점수(score)를 부여하지 마라. 대신 객관적인 언급 횟수(mentionCount)를 산출하라.
2. 해당 트렌드 및 카테고리가 [Evidence Ledger] 내에서 총 몇 개의 서로 다른 출처(sourceDomain)에서 언급되었는지 정확히 세어서 정수로 기입하라. (예: 마이크로소프트와 SK 2곳에서 언급되었다면 2)
3. topTrends의 devrelImplication: 이 흐름이 전사 AX 추진·인재개발 실무에 왜 의미 있는지 한 문장으로 쓴다.
   근거에서 알 수 없으면 빈 문자열로 둔다. 추측해서 채우지 마라.

[promotionIdeas 작성 지침 — AX 추진 실무 기준]
AX 추진 과제는 "무엇을 할지"만 있으면 쓸모가 없다. 아래 4개를 모두 채워라.

1. title / description — 무엇을 할 것인가.
   실행 형식을 구체적으로 지정한다. 아래 중에서 근거 성격에 맞는 것을 고른다.
     · 사내 핸즈온 워크숍 (직접 따라 해볼 수 있는 AI 툴·업무 방식일 때)
     · 파일럿 프로젝트 (특정 조직에 먼저 적용해보고 확산할 성격일 때)
     · 스킬 맵핑·역량 진단 가이드 (직무·스킬 체계와 관련된 근거일 때)
     · 리더십 라운드테이블 (경영진·부서장의 정렬이 먼저 필요할 때)
     · 전사 캠페인·커뮤니케이션 (구성원 인식과 참여를 넓혀야 할 때)

2. rationale — 왜 지금 이걸 해야 하는가. 가장 중요한 필드다.
   반드시 아래 두 가지를 근거에 기반해 쓰고, 문장 끝에 [E1] 형식으로 인용을 붙인다.
     (a) 어떤 사실이 관찰되었기에 이 주제를 고르는가
     (b) 그 사실이 이 조직·오디언스에게 왜 지금 시점에 유효한가
   근거 없이 "요즘 트렌드라서", "중요하기 때문에" 같은 문장은 규칙 위반이다.
   예: "글로벌 2개 기업이 같은 분기에 AI 툴 확산을 부서장 주도 방식으로 전환했다[E1][E4].
        우리도 현장 리더의 참여 없이는 정착이 어렵다면 먼저 대조할 만한 레퍼런스가 된다."

3. successMetric — 무엇으로 성공을 판단할 것인가.
   측정 "방법"만 쓴다. 결과 수치를 예측하거나 약속하지 마라.
     · 좋은 예: "워크숍 종료 4주 후 대상 조직의 AI 툴 실사용률 집계"
     · 좋은 예: "파일럿 조직과 비대상 조직의 스킬 진단 완료율 비교"
     · 나쁜 예: "구성원 몰입도 30% 향상" (지어낸 수치)
     · 나쁜 예: "조직문화 개선" (측정 방법이 없음)

4. evidenceIds — 이 아이템의 출처가 된 Evidence Ledger ID 배열. 예: ["E1", "E4"]
   rationale에서 인용한 ID와 일치해야 한다. Ledger에 없는 ID를 쓰면 서버가 제거한다.

5. priority는 반드시 "P1", "P2", "P3" 중 하나만 쓴다. High/Medium/Low 표기는 금지한다.
   아래 기준을 그대로 적용한다. 근거의 성격으로만 정하고, 등급을 임의로 조정하지 마라.
     · P1 — 서로 다른 출처 2곳 이상에서 반복 확인된 주제 (evidenceIds가 2개 이상)
     · P2 — 단일 출처지만 근거에 실행에 필요한 구체적 내용(구조·수치·절차)이 담겨 바로 착수 가능한 주제
     · P3 — 단일 출처이고 참고 수준이어서 추가 조사가 더 필요한 주제
   기준에 맞다면 P2가 하나도 없거나 P1이 여러 개여도 정상이다.
   등급이 연속으로 보이게 하려고 억지로 P2를 만들지 마라.

6. target은 [조건]의 타겟 중에서 고르고, 왜 그 대상인지가 description이나 rationale에서 드러나게 하라.

[조건]
- 기간: ${periodDisplay}
- 카테고리: ${selectedCategories.join(', ')}
- 타겟: ${targetAges.join(', ')}
- 목적: ${purpose}
- 키워드: ${keyword?.trim() || '없음'}

[Evidence Ledger (서버 검증 완료된 근거 원장 - 아래 ID만 인용할 것)]
${ledgerText}

[grounded research text]
${groundedText}

[source list]
${groundingSources.map((s, i) => `${i + 1}. ${s.title} | ${s.uri} | ${s.domain || ''}`).join('\n')}

제공된 응답 스키마(Schema) 구조에 맞추어 완전하고 유효한 JSON 형식으로만 출력하라.
`;
};

// server.ts 호환용 export
export const getTrendAnalysisPrompt = buildGroundingPrompt;
