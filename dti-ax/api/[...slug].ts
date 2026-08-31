import { app } from '../server.js';

// Vercel Hobby 플랜 + Fluid Compute 환경의 실제 상한이 300초다.
// 이전 값(60)은 실제 동작과 어긋나 있었다 — 99.3초/62.7초 요청이 타임아웃 없이
// 완료된 것으로 보아 이 export가 적용되지 않고 기본값으로 동작 중일 가능성이 크다.
// 300으로 두면 (a) 이 설정이 적용될 경우와 (b) 무시되고 기본값이 쓰일 경우가
// 모두 300초로 수렴하므로, "적용되는지 아닌지 모른다"는 불확실성 자체가 사라진다.
export const maxDuration = 300;
export default app;
