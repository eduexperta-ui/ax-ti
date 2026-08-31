export interface Category {
  id: string;
  label: string;
}

export type Period = string;

/** constants.ts의 PURPOSES와 항상 일치해야 한다. */
export type AnalysisPurpose =
  | 'AX 조직문화 / 일하는 방식 개선'
  | '스킬 기반 HR 체계 설계'
  | '전사 AI 역량 교육 기획'
  | '변화관리 / 구성원 몰입 강화';

export interface FactMetrics {
  requestId?: string;
  grounded?: boolean;
  periodCode?: string;
  periodLabel?: string;
  startDate?: string;
  endDate?: string;
  totalSourcesCollected: number;
  searchQueriesExecuted: string[];
  periodRequested?: string;
  periodFilteredCount?: number;
  periodViolationCount?: number;
  dateUnverifiedCount?: number;
  domainFilteredCount?: number;
  validEvidenceCount?: number;
  citedEvidenceCount?: number;
  citationCoverageWarning?: boolean;
  groundingModelUsed?: string;
  structuringModelUsed?: string;
  groundingRetried?: boolean;
  groundingFinishReason?: string | null;
  structuringFinishReason?: string | null;
  groundingOutputLength?: number;
  structuringOutputLength?: number;
  jsonParseSuccess?: boolean;
  executionTimeMs?: number;
  articleCount?: number;
  bannedWordFilterApplied?: boolean;
  bannedWordPolicy?: string;
  bannedWordReplacedCount?: number;
  tokenUsage?: unknown;
}

/**
 * 서버 주도 Evidence Ledger 표준 타입
 */
export interface EvidenceLedgerItem {
  id: string; // E1, E2, E3 ...
  title: string;
  url: string; // Google Search Grounding이 제공한 리다이렉트 주소 (검증된 링크)
  originUrl?: string; // 모델이 보고한 원문 기사 주소 (참고 표기용)
  sourceDomain: string;
  publishedDate: string | null;
  category: string;
  claim: string;
  confidence: "High" | "Medium" | "Low";
  periodValid: boolean;
  sourceAllowed: boolean;
}

/**
 * 근거 자료 항목 (기간 필터링 및 출처 검증 적용)
 */
export interface EvidenceItem {
  title: string;
  url: string;
  publishedDate?: string;
  sourceDomain?: string;
  summary?: string;
  category?: string;
  periodValid?: boolean;
}

/**
 * 포착된 개별 기술 시그널
 */
export interface TrendSignal {
  signal: string;
  source: string;
  impact: 'High' | 'Medium' | 'Low';
  categories: string[]; // 연결된 기술 카테고리
  targetAges: string[]; // 대상 연령대/개발 직급
  description?: string;
}

/**
 * 클러스터링된 주요 기술 트렌드
 */
export interface TrendCluster {
  id: string;
  title: string;
  summary: string;
  signals: TrendSignal[];
  keyItems: string[]; // 주요 기술 키워드/라이브러리/아키텍처
  keyColors: string[]; // 관련 패키지/툴/태그
  mentionCount?: number;
  devrelImplication?: string; // 이 흐름이 AX 추진·인재개발 실무에 왜 의미 있는지
}

/**
 * AX 추진을 위한 구체적 실행 아이템
 */
export interface MDActionItem {
  title: string;
  description: string;
  target: string;
  priority: 'P1' | 'P2' | 'P3';
  /** 왜 지금 이걸 해야 하는가 — 수집 근거에서 도출, [E1] 인용 포함 */
  rationale?: string;
  /** 무엇으로 성공을 판단할 것인가 — 측정 방법 (결과 수치 예측 아님) */
  successMetric?: string;
  /** 근거가 된 Evidence Ledger ID (서버가 유효성 검증 후 남긴 것만) */
  evidenceIds?: string[];
  type?: 'Blog' | 'Training' | 'Branding' | 'Documentation' | 'Strategy';
}

/**
 * AX 추진 액션 보드 데이터 구조
 */
export interface DashboardData {
  topTrends: TrendCluster[];
  categoryPriorities: { category: string; mentionCount: number; priority: number }[];
  ageInsights: { ageGroup: string; insight: string }[];
  promotionIdeas: MDActionItem[];
  thumbnailCopies: string[];
  sourcingPoints: string[];
  marketSignals: TrendSignal[];
}

export interface VerifiedSource {
  title: string;
  uri: string;
  domain: string;
  publishedGuess?: string;
}

export interface GroundedClaim {
  text: string;
  startIndex: number;
  endIndex: number;
  sourceIndices: number[];
}

export interface EnrichedClaim {
  text: string;
  startIndex: number;
  endIndex: number;
  sourceIndices: number[];
  sources: VerifiedSource[];
}
