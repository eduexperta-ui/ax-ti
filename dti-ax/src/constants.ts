import { Category } from './types';

export const CATEGORIES: Category[] = [
  { id: 'work_tools', label: '일하는 방식 / AI 협업 툴' },
  { id: 'skill_hr', label: '스킬 기반 HR / 직무 체계' },
  { id: 'learning', label: '학습 조직 / 역량 교육' },
  { id: 'change', label: '변화관리 / 리더십' },
  { id: 'people_data', label: '피플 애널리틱스 / HR 데이터' },
  { id: 'rnd_culture', label: 'R&D · 제조 현장 문화' },
  { id: 'ai_literacy', label: 'AI 리터러시 / 생성형 AI 활용' },
];

// 서버(normalizePeriod)와 periodValidator가 지원하는 전체 기간을 노출한다.
// 근거 부족 시 "기간을 넓혀보라"고 안내하므로 60/90일 선택지가 UI에 있어야 한다.
export const PERIODS: string[] = ['최근 1주', '최근 2주', '최근 1개월', '최근 60일', '최근 90일'];

// 변수명은 유지한다 — 여러 컴포넌트가 이 이름으로 import한다.
export const TARGET_AGES = [
  '전사 임직원',
  '팀 리더 / 부서장',
  'R&D · 제조 현장',
  'C-Level / AX 추진 조직',
  '신규 입사자',
];

export const PURPOSES = [
  'AX 조직문화 / 일하는 방식 개선',
  '스킬 기반 HR 체계 설계',
  '전사 AI 역량 교육 기획',
  '변화관리 / 구성원 몰입 강화',
] as const;

// 주의: 아래 label 문자열은 server.ts의 SOURCE_DOMAIN_MAP 키,
// promptService.ts의 DATA_SOURCE_DOMAIN_HINTS 키와 반드시 글자까지 일치해야 한다.
// 어긋나면 도메인 검증이 조용히 무력화된다(에러 없이 전부 통과).
export const DATA_SOURCES = [
  { id: 'global_people', label: '글로벌 기업 People & Culture 자료 (Google re:Work, MS WorkLab, GitLab 등)' },
  { id: 'k_corp', label: '국내 선도기업 조직문화 · 일하는 방식 (네이버, 카카오, 토스, SK, 삼성 등)' },
  { id: 'research', label: 'HR · 경영 리서치 (HBR, McKinsey, Gartner, Deloitte 등)' },
  { id: 'conference', label: 'HR · AX 컨퍼런스 & 발표자료 (ATD, HR Summit 등)' },
];

export interface DevRelPreset {
  id: string;
  badge: string;
  title: string;
  description: string;
  period: string;
  selectedCategories: string[];
  targetAges: string[];
  purpose: string;
  dataSources: string[];
  articleCount: number;
}

export const DEVREL_PRESETS: DevRelPreset[] = [
  {
    id: 'ax-ways-of-working',
    badge: '일하는 방식',
    title: '글로벌 선도기업 AX 일하는 방식',
    description: 'AI 도입에 따른 협업·문서·회의 방식 변화와 전사 생산성 혁신 사례 수집',
    period: '최근 1개월',
    selectedCategories: ['일하는 방식 / AI 협업 툴', 'AI 리터러시 / 생성형 AI 활용', '변화관리 / 리더십'],
    targetAges: ['전사 임직원', '팀 리더 / 부서장'],
    purpose: 'AX 조직문화 / 일하는 방식 개선',
    dataSources: [
      '글로벌 기업 People & Culture 자료 (Google re:Work, MS WorkLab, GitLab 등)',
      'HR · 경영 리서치 (HBR, McKinsey, Gartner, Deloitte 등)',
    ],
    articleCount: 20,
  },
  {
    id: 'skill-based-hr',
    badge: '스킬 HR',
    title: '스킬 기반 HR & 직무 역량 체계',
    description: '직무 중심에서 스킬 중심으로의 HR 전환, 스킬 맵핑·배치·성장 경로 설계 사례',
    period: '최근 1개월',
    selectedCategories: ['스킬 기반 HR / 직무 체계', '피플 애널리틱스 / HR 데이터'],
    targetAges: ['C-Level / AX 추진 조직', '팀 리더 / 부서장'],
    purpose: '스킬 기반 HR 체계 설계',
    dataSources: [
      'HR · 경영 리서치 (HBR, McKinsey, Gartner, Deloitte 등)',
      '글로벌 기업 People & Culture 자료 (Google re:Work, MS WorkLab, GitLab 등)',
    ],
    articleCount: 20,
  },
  {
    id: 'ai-capability-learning',
    badge: '역량 강화',
    title: '전사 AI 역량 강화 & 학습조직',
    description: '직무별 AI 리터러시 교육, 사내 핸즈온·해커톤, 학습 커뮤니티(CoP) 운영 사례',
    period: '최근 2주',
    selectedCategories: ['학습 조직 / 역량 교육', 'AI 리터러시 / 생성형 AI 활용'],
    targetAges: ['전사 임직원', '신규 입사자'],
    purpose: '전사 AI 역량 교육 기획',
    dataSources: [
      '국내 선도기업 조직문화 · 일하는 방식 (네이버, 카카오, 토스, SK, 삼성 등)',
      'HR · AX 컨퍼런스 & 발표자료 (ATD, HR Summit 등)',
    ],
    articleCount: 20,
  },
  {
    id: 'change-management',
    badge: '변화관리',
    title: 'AX 변화관리 & 구성원 몰입',
    description: 'AI 전환기의 구성원 저항 관리, 경영진-현장 얼라인먼트, 몰입도 진단 사례',
    period: '최근 1개월',
    selectedCategories: ['변화관리 / 리더십', '피플 애널리틱스 / HR 데이터', 'R&D · 제조 현장 문화'],
    targetAges: ['팀 리더 / 부서장', 'R&D · 제조 현장'],
    purpose: '변화관리 / 구성원 몰입 강화',
    dataSources: [
      '국내 선도기업 조직문화 · 일하는 방식 (네이버, 카카오, 토스, SK, 삼성 등)',
      'HR · 경영 리서치 (HBR, McKinsey, Gartner, Deloitte 등)',
    ],
    articleCount: 20,
  },
];
