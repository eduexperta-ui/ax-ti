/**
 * 과장 표현 치환 규칙.
 *
 * 어간만 치환하면 "혁신적인" -> "새로운인", "압도적으로" -> "높은으로" 처럼
 * 비문이 만들어진다. 그래서 어미가 붙은 형태를 먼저(긴 것부터) 치환한다.
 * 순서가 곧 우선순위이므로 배열 순서를 바꾸지 말 것.
 */
export const BANNED_RULES: Array<[RegExp, string]> = [
  [/혁신적으로/g, '새롭게'],
  [/혁신적인/g, '새로운'],
  [/혁신적/g, '새로운'],
  [/압도적으로/g, '크게'],
  [/압도적인/g, '높은'],
  [/압도적/g, '높은'],
  [/게임체인저/g, '주요 변수'],
  [/필수적으로/g, '반드시'],
  [/필수적인/g, '중요한'],
  [/필수적/g, '중요한'],
  [/폭발적으로/g, '가파르게'],
  [/폭발적인/g, '가파른'],
  [/폭발적/g, '가파른'],
  [/완벽하게/g, '안정적으로'],
  [/완벽한/g, '안정적인'],
  [/최고의/g, '우수한'],
  [/독보적으로/g, '차별화된 방식으로'],
  [/독보적인/g, '차별화된'],
  [/독보적/g, '차별화된'],
];

/** 이번 요청에서 실제로 치환이 일어난 횟수 (배지 표기를 정직하게 하기 위함) */
let replacementCount = 0;
export const resetReplacementCount = () => {
  replacementCount = 0;
};
export const getReplacementCount = (): number => replacementCount;

export const sanitizeText = (text: string): string => {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  for (const [pattern, replacement] of BANNED_RULES) {
    result = result.replace(pattern, () => {
      replacementCount++;
      return replacement;
    });
  }

  // 주의: 여기서 연속 공백을 뭉개면 마크다운 중첩 목록 들여쓰기(2·4칸),
  // 줄 끝 두 칸(줄바꿈), 표 정렬이 전부 깨진다. 공백 압축은 하지 않는다.
  return result
    .replace(/[ \t]+([,.!?:])/g, '$1')
    .replace(/\(\s*/g, '(')
    .replace(/[ \t]+\)/g, ')')
    .trim();
};

export const sanitizeDashboardData = (dashboardData: any) => {
  if (!dashboardData || typeof dashboardData !== 'object') return dashboardData;

  return {
    ...dashboardData,
    topTrends: Array.isArray(dashboardData.topTrends)
      ? dashboardData.topTrends.map((item: any) => ({
          ...item,
          title: sanitizeText(item?.title || ''),
          summary: sanitizeText(item?.summary || ''),
          devrelImplication: sanitizeText(item?.devrelImplication || ''),
          keyItems: Array.isArray(item?.keyItems)
            ? item.keyItems.map((v: string) => sanitizeText(v))
            : [],
          keyColors: Array.isArray(item?.keyColors) ? item.keyColors : [],
        }))
      : [],
    categoryPriorities: Array.isArray(dashboardData.categoryPriorities)
      ? dashboardData.categoryPriorities
      : [],
    ageInsights: Array.isArray(dashboardData.ageInsights)
      ? dashboardData.ageInsights.map((item: any) => ({
          ...item,
          ageGroup: sanitizeText(item?.ageGroup || ''),
          insight: sanitizeText(item?.insight || ''),
        }))
      : [],
    promotionIdeas: Array.isArray(dashboardData.promotionIdeas)
      ? dashboardData.promotionIdeas.map((item: any) => ({
          ...item,
          title: sanitizeText(item?.title || ''),
          description: sanitizeText(item?.description || ''),
          target: sanitizeText(item?.target || ''),
          rationale: sanitizeText(item?.rationale || ''),
          successMetric: sanitizeText(item?.successMetric || ''),
          evidenceIds: Array.isArray(item?.evidenceIds) ? item.evidenceIds : [],
        }))
      : [],
    thumbnailCopies: Array.isArray(dashboardData.thumbnailCopies)
      ? dashboardData.thumbnailCopies.map((v: string) => sanitizeText(v))
      : [],
    sourcingPoints: Array.isArray(dashboardData.sourcingPoints)
      ? dashboardData.sourcingPoints.map((v: string) => sanitizeText(v))
      : [],
    marketSignals: Array.isArray(dashboardData.marketSignals)
      ? dashboardData.marketSignals.map((item: any) => ({
          ...item,
          signal: sanitizeText(item?.signal || ''),
          source: sanitizeText(item?.source || ''),
          categories: Array.isArray(item?.categories) ? item.categories : [],
          targetAges: Array.isArray(item?.targetAges) ? item.targetAges : [],
        }))
      : [],
  };
};

export const sanitizeClaims = (claims: any[]) => {
  if (!Array.isArray(claims)) return [];
  return claims.map((claim) => ({
    ...claim,
    text: sanitizeText(claim?.text || ''),
  }));
};

export const sanitizeEvidenceList = (items: any[]) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    title: item?.title || '',              // 그대로 유지
    url: item?.url || '',                  // 그대로 유지
    sourceDomain: item?.sourceDomain || '', // 그대로 유지
    summary: sanitizeText(item?.summary || ''),
  }));
};
