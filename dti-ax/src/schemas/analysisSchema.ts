import { Type } from '@google/genai';

export const ALLOWED_CATEGORIES = [
  'Backend',
  'Frontend',
  'Cloud/DevOps',
  'AI/ML',
  'Mobile',
  'Data Engineering',
  'Engineering Culture',
] as const;

export const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reportMarkdown: { type: Type.STRING },
    dashboardData: {
      type: Type.OBJECT,
      properties: {
        topTrends: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              keyItems: { type: Type.ARRAY, items: { type: Type.STRING } },
              keyColors: { type: Type.ARRAY, items: { type: Type.STRING } },
              mentionCount: { type: Type.NUMBER },
              // 이 흐름이 AX 추진·인재개발 실무에 왜 의미 있는지 한 문장
              devrelImplication: { type: Type.STRING },
            },
            required: ['title', 'summary'],
          },
        },
        categoryPriorities: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              mentionCount: { type: Type.NUMBER },
              priority: { type: Type.NUMBER },
            },
            required: ['category', 'mentionCount', 'priority'],
          },
        },
        promotionIdeas: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              target: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ['P1', 'P2', 'P3'] },
              // 왜 지금 이걸 해야 하는가 — 수집된 근거에서만 도출하고 [E1] 형식으로 인용한다
              rationale: { type: Type.STRING },
              // 무엇으로 성공을 판단할 것인가 — 측정 방법. 결과 수치를 예측하지 않는다
              successMetric: { type: Type.STRING },
              // 이 아이템의 출처가 된 Evidence Ledger ID 목록 (서버가 유효성 검증)
              evidenceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['title', 'description', 'rationale'],
          },
        },
      },
      required: ['topTrends', 'categoryPriorities', 'promotionIdeas'],
    },
  },
  required: ['reportMarkdown', 'dashboardData'],
};

