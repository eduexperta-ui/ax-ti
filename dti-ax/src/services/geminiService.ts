import type { VerifiedSource, EnrichedClaim, EvidenceItem } from '../types';

export interface AnalyzeResponse {
  report: string;
  dashboardData?: any;
  notionPayload?: any;
  sources: VerifiedSource[];
  claims: EnrichedClaim[];
  evidenceList?: EvidenceItem[];
  factMetrics: any;
  debug?: any;
}

export class AnalyzeApiError extends Error {
  code?: string;
  status?: number;
  debug?: any;

  constructor(message: string, code?: string, status?: number, debug?: any) {
    super(message);
    this.name = 'AnalyzeApiError';
    this.code = code;
    this.status = status;
    this.debug = debug;
  }
}

export const analyzeTrend = async (
  period: string,
  selectedCategories: string[],
  targetAges: string[],
  purpose: string,
  dataSources: string[],
  keyword: string,
  articleCount: number,
  imageBase64: string | null = null
): Promise<AnalyzeResponse> => {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period, selectedCategories, targetAges, purpose, dataSources, keyword, articleCount, imageBase64 }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new AnalyzeApiError(
      data?.error || `API returned ${res.status}`,
      data?.code,
      res.status,
      data?.debug
    );
  }

  if (!data) {
    throw new AnalyzeApiError('응답 데이터를 파싱할 수 없습니다. (빈 응답)', 'EMPTY_RESPONSE');
  }

  return data as AnalyzeResponse;
};
