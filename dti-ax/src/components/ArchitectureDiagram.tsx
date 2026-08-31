import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Radar, Briefcase, Database, Layout, ArrowRight, Info, Target } from 'lucide-react';

interface StepDetail {
  id: number;
  title: string;
  description: string;
  details: string[];
  sources?: string[];
  outputs?: string[];
  color: string;
}

const STEPS: StepDetail[] = [
  {
    id: 1,
    title: "단계 01: 기술 시그널 스캐닝",
    description: "글로벌 기업 People & Culture 자료, HR·경영 리서치, 국내 선도기업 조직문화 사례에서 최신 시그널을 수집합니다.",
    details: [
      "글로벌·국내 조직문화 자료 (Google re:Work, HBR, SK 등) 스캐닝",
      "기술 커뮤니티 (GeekNews, Hacker News, Velog) 핫 토픽 추출",
      "마크다운 본문 파싱 및 키워드·카테고리 분류"
    ],
    sources: ["글로벌 기업 People & Culture 자료", "HR · 경영 리서치", "국내 선도기업 조직문화 사례"],
    color: "#2563eb"
  },
  {
    id: 2,
    title: "단계 02: AX 큐레이션 & 팩트체크",
    description: "수집된 지식 아티클을 구글 서치 그라운딩과 서버 검증으로 확인하고, 확보된 검증 근거의 수에 따라 리포트 신뢰도(Impact)를 산정합니다.",
    details: [
      "Google Search Grounding 기반 독립 원문 상호 교차 검증 (환각 필터링)",
      "검증 통과 근거 수에 따른 리포트 신뢰도(Impact: High/Medium/Low) 산정",
      "유사 조직·HR 주제 클러스터링 및 노이즈 제거"
    ],
    color: "#059669"
  },
  {
    id: 3,
    title: "단계 03: 지식 자산화 & 리포트 생성",
    description: "검증된 근거를 바탕으로 리포트 본문과 실행 아이템 대시보드를 생성하고 노션 DB에 자동 저장합니다.",
    details: [
      "우선순위(P1~P3)가 매겨진 실행 아이템 제안",
      "선택한 목적(일하는 방식 개선 / 스킬 HR 설계 / AI 역량 교육 등)에 맞춰 제안 방향 조정",
      "웹 대시보드 리포트 구성 및 노션 DB 자동 연동"
    ],
    outputs: ["AX 추진 대시보드 리포트", "Notion DB 자동 저장"],
    color: "#111111"
  }
];

export const ArchitectureDiagram: React.FC = () => {
  const [selectedStep, setSelectedStep] = useState<StepDetail | null>(null);

  return (
    <div className="w-full max-w-4xl mx-auto mb-16 space-y-8">
      {/* Portfolio Context Section */}
      <section className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-neutral-200 shadow-xs flex items-start gap-4">
            <div className="w-11 h-11 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-900 border border-neutral-200/80 shadow-xs shrink-0 mt-0.5">
              <Target className="w-5 h-5 text-neutral-800" />
            </div>
            <div>
              <h3 className="text-neutral-900 font-bold text-base sm:text-lg mb-1">프로젝트 목표</h3>
              <p className="text-neutral-600 text-xs sm:text-sm font-normal leading-relaxed">
                글로벌 기업 People & Culture 자료·HR 리서치·국내 선도기업 사례에서 조직문화와 일하는 방식의 변화를 수집하고, 발행 시점과 출처를 서버에서 검증해 확인된 근거만 인용된 리포트를 만듭니다. AX 추진·인재개발 담당자가 근거를 직접 확인하며 제도와 프로그램을 기획할 수 있도록 돕습니다.
              </p>
            </div>
          </div>
          
          <div className="bg-neutral-900 p-6 sm:p-7 rounded-2xl border border-neutral-900 text-white shadow-sm flex items-start gap-4">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center text-white border border-white/10 shadow-xs shrink-0 mt-0.5">
              <Radar className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base sm:text-lg mb-1">핵심 기능</h3>
              <p className="text-neutral-300 text-xs sm:text-sm font-normal leading-relaxed">
                선택한 기간·카테고리·소스 조건으로 Google Search 기반 실제 문서를 검색하고, 서버에서 발행일과 출처를 검증해 확인된 근거만 리포트에 인용되도록 강제합니다. 결과는 리포트·실행 아이템 대시보드·근거 소스 목록으로 정리되어 노션 DB에 자동 저장됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Diagram */}
      <div className="bg-white rounded-3xl p-6 md:p-10 border border-neutral-200 relative overflow-hidden shadow-xs">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-neutral-500 mb-6 text-center">
          <Info className="w-4 h-4 text-neutral-400" />
          각 단계를 클릭하면 세부 동작 및 팩트체크 로직을 확인할 수 있습니다
        </div>
        
        <div className="text-center mb-8 md:mb-10">
          <h3 className="text-2xl md:text-3xl font-extrabold text-neutral-900 tracking-tight">
            Agent Architecture
          </h3>
        </div>
        
        {/* Desktop Interactive SVG */}
        <div className="hidden md:block w-full">
          <svg viewBox="0 0 800 560" className="w-full h-auto mx-auto" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#737373" />
              </marker>
            </defs>

            {/* 1. User Input */}
            <g className="transition-opacity duration-150 hover:opacity-90">
              <rect x="160" y="10" width="480" height="60" rx="16" fill="#fafafa" stroke="#e5e5e5" strokeWidth="1.5"/>
              <text x="400" y="35" fontFamily="sans-serif" fontSize="13" fontWeight="700" fill="#171717" textAnchor="middle">수집 조건 설정</text>
              <text x="400" y="53" fontFamily="sans-serif" fontSize="11" fontWeight="500" fill="#737373" textAnchor="middle">기간 / 수집 대상 / 타겟 오디언스 / 키워드</text>
            </g>
            
            <line x1="400" y1="70" x2="400" y2="100" stroke="#a3a3a3" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow)" />

            {/* 2. Step 1: Data Scan */}
            <motion.g 
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="cursor-pointer origin-center"
              onClick={() => setSelectedStep(STEPS[0])}
            >
              <rect x="160" y="100" width="480" height="90" rx="16" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5"/>
              <text x="400" y="130" fontFamily="sans-serif" fontSize="14" fontWeight="700" fill="#1e293b" textAnchor="middle">단계 01: 기술 시그널 스캐닝 (Data Sensing)</text>
              <text x="400" y="153" fontFamily="sans-serif" fontSize="11" fontWeight="500" fill="#64748b" textAnchor="middle">글로벌·국내 조직문화 및 HR 리서치 자료 수집</text>
              <text x="400" y="171" fontFamily="sans-serif" fontSize="11" fontWeight="500" fill="#64748b" textAnchor="middle">마크다운 본문 파싱 및 기술 키워드 추출</text>
              <circle cx="615" cy="120" r="10" fill="#eff6ff" />
              <text x="615" y="123.5" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#2563eb" textAnchor="middle">+</text>
            </motion.g>

            <line x1="400" y1="190" x2="400" y2="220" stroke="#a3a3a3" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* 3. Step 2: Core Curation & Factcheck */}
            <motion.g 
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="cursor-pointer origin-center"
              onClick={() => setSelectedStep(STEPS[1])}
            >
              <rect x="160" y="220" width="480" height="90" rx="16" fill="#0f172a" stroke="#0f172a" strokeWidth="1.5"/>
              <text x="400" y="250" fontFamily="sans-serif" fontSize="14" fontWeight="700" fill="#ffffff" textAnchor="middle">단계 02: AX 큐레이션 &amp; 팩트체크</text>
              <text x="400" y="273" fontFamily="sans-serif" fontSize="11" fontWeight="500" fill="#94a3b8" textAnchor="middle">Google Search Grounding 기반 원문 교차 검증 및 미검증 인용 자동 거부</text>
              <text x="400" y="291" fontFamily="sans-serif" fontSize="11" fontWeight="500" fill="#94a3b8" textAnchor="middle">기간·출처 검증 통과분만 근거 원장에 등재, 미검증 인용은 거부</text>
              <circle cx="615" cy="240" r="10" fill="#1e293b" />
              <text x="615" y="243.5" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#10b981" textAnchor="middle">+</text>
            </motion.g>

            <line x1="400" y1="310" x2="400" y2="340" stroke="#a3a3a3" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* 4. Step 3: Report & JSON */}
            <motion.g 
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="cursor-pointer origin-center"
              onClick={() => setSelectedStep(STEPS[2])}
            >
              <rect x="160" y="340" width="480" height="90" rx="16" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5"/>
              <text x="400" y="370" fontFamily="sans-serif" fontSize="14" fontWeight="700" fill="#1e293b" textAnchor="middle">단계 03: 지식 자산화 &amp; 리포트 생성</text>
              <text x="400" y="393" fontFamily="sans-serif" fontSize="11" fontWeight="500" fill="#64748b" textAnchor="middle">우선순위(P1~P3)가 매겨진 AX 추진 과제 도출</text>
              <text x="400" y="411" fontFamily="sans-serif" fontSize="11" fontWeight="500" fill="#64748b" textAnchor="middle">웹 대시보드 리포트 생성 및 노션 DB 자동 저장</text>
              <circle cx="615" cy="360" r="10" fill="#f8fafc" />
              <text x="615" y="363.5" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#334155" textAnchor="middle">+</text>
            </motion.g>

            <line x1="400" y1="430" x2="400" y2="460" stroke="#a3a3a3" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow)" />

            {/* 5. Notion Integration */}
            <g className="transition-opacity duration-150 hover:opacity-90">
              <rect x="160" y="460" width="480" height="55" rx="16" fill="#171717" stroke="#171717" strokeWidth="1.5"/>
              <text x="400" y="493" fontFamily="sans-serif" fontSize="13" fontWeight="700" fill="#ffffff" textAnchor="middle">Notion DB 자동 저장</text>
            </g>
          </svg>
        </div>

        {/* Mobile Vertical Architecture Timeline */}
        <div className="block md:hidden w-full space-y-3">
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-center">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Entry</span>
            <h4 className="text-sm font-bold text-neutral-900">수집 조건 설정</h4>
            <p className="text-xs text-neutral-500 mt-0.5">기간, 수집 대상, 타겟 오디언스, 키워드</p>
          </div>

          <div className="w-0.5 h-4 bg-neutral-200 mx-auto" />

          {/* STEP 1 */}
          <div 
            onClick={() => setSelectedStep(STEPS[0])}
            className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs active:scale-98 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider px-2 py-0.5 bg-blue-50 rounded">Step 01</span>
              <span className="text-[11px] text-neutral-400 font-semibold flex items-center gap-1">상세보기 <ArrowRight className="w-3 h-3"/></span>
            </div>
            <h4 className="text-sm font-bold text-neutral-900">{STEPS[0].title}</h4>
            <p className="text-xs text-neutral-600 mt-1 leading-relaxed">{STEPS[0].description}</p>
          </div>

          <div className="w-0.5 h-4 bg-neutral-200 mx-auto" />

          {/* STEP 2 */}
          <div 
            onClick={() => setSelectedStep(STEPS[1])}
            className="bg-neutral-900 text-white p-4 rounded-xl shadow-xs active:scale-98 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider px-2 py-0.5 bg-emerald-500/20 rounded">Step 02</span>
              <span className="text-[11px] text-neutral-400 font-semibold flex items-center gap-1">상세보기 <ArrowRight className="w-3 h-3"/></span>
            </div>
            <h4 className="text-sm font-bold text-white">{STEPS[1].title}</h4>
            <p className="text-xs text-neutral-300 mt-1 leading-relaxed">{STEPS[1].description}</p>
          </div>

          <div className="w-0.5 h-4 bg-neutral-200 mx-auto" />

          {/* STEP 3 */}
          <div 
            onClick={() => setSelectedStep(STEPS[2])}
            className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs active:scale-98 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider px-2 py-0.5 bg-neutral-100 rounded">Step 03</span>
              <span className="text-[11px] text-neutral-400 font-semibold flex items-center gap-1">상세보기 <ArrowRight className="w-3 h-3"/></span>
            </div>
            <h4 className="text-sm font-bold text-neutral-900">{STEPS[2].title}</h4>
            <p className="text-xs text-neutral-600 mt-1 leading-relaxed">{STEPS[2].description}</p>
          </div>

          <div className="w-0.5 h-4 bg-neutral-200 mx-auto" />

          {/* Notion Sync */}
          <div className="bg-neutral-900 text-white p-4 rounded-xl text-center">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
              <Database className="w-3 h-3" /> Sync
            </span>
            <h4 className="text-xs font-bold">Notion DB 자동 저장</h4>
          </div>
        </div>
      </div>

      {/* Step Detail Modal */}
      <AnimatePresence>
        {selectedStep && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStep(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 md:p-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <span 
                      className="inline-block px-3 py-1 rounded-full text-[10px] font-black text-white mb-3"
                      style={{ backgroundColor: selectedStep.color }}
                    >
                      STEP {selectedStep.id.toString().padStart(2, '0')}
                    </span>
                    <h4 className="text-2xl font-black text-brand-black tracking-tight">{selectedStep.title}</h4>
                  </div>
                  <button 
                    onClick={() => setSelectedStep(null)}
                    className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-neutral-400" />
                  </button>
                </div>

                <p className="text-neutral-500 font-medium mb-8 leading-relaxed">
                  {selectedStep.description}
                </p>

                <div className="space-y-8">
                  {/* Logic Details */}
                  <div>
                    <h5 className="text-[11px] font-black text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Radar className="w-3 h-3" /> 주요 처리 로직
                    </h5>
                    <ul className="space-y-3">
                      {selectedStep.details.map((detail, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-bold text-brand-black">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-black" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Sources (if Step 1) */}
                  {selectedStep.sources && (
                    <div>
                      <h5 className="text-[11px] font-black text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Database className="w-3 h-3" /> 인텔리전스 소스
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {selectedStep.sources.map((source, i) => (
                          <span key={i} className="px-3 py-1.5 bg-neutral-100 rounded-lg text-[11px] font-bold text-neutral-600">
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outputs (if Step 3) */}
                  {selectedStep.outputs && (
                    <div>
                      <h5 className="text-[11px] font-black text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Layout className="w-3 h-3" /> 출력 포맷
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {selectedStep.outputs.map((output, i) => (
                          <span key={i} className="px-3 py-1.5 bg-neutral-100 rounded-lg text-[11px] font-bold text-brand-black">
                            {output}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setSelectedStep(null)}
                  className="w-full mt-10 py-4 bg-brand-black text-white rounded-2xl font-black text-sm hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
                >
                  확인 완료
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
