import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, Loader2, ImagePlus, X, Calendar, Target, Briefcase, 
  Database, Layers, FileText, Radar, Sparkles, SlidersHorizontal, 
  ChevronDown, ChevronUp, CheckCircle2, Globe, Cpu
} from 'lucide-react';
import { CATEGORIES, PERIODS, TARGET_AGES, PURPOSES, DATA_SOURCES, DEVREL_PRESETS, DevRelPreset } from '../constants';
import { AnalysisPurpose, Period } from '../types';

interface IntelligenceConfigPanelProps {
  period: Period;
  setPeriod: (period: Period) => void;
  selectedCategories: string[];
  setSelectedCategories: (categories: string[]) => void;
  targetAges: string[];
  setTargetAges: (ages: string[]) => void;
  purpose: AnalysisPurpose;
  setPurpose: (purpose: AnalysisPurpose) => void;
  dataSources: string[];
  setDataSources: (sources: string[]) => void;
  keyword: string;
  setKeyword: (keyword: string) => void;
  articleCount: number;
  setArticleCount: (count: number) => void;
  image: string | null;
  setImage: (image: string | null) => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
}

export const IntelligenceConfigPanel: React.FC<IntelligenceConfigPanelProps> = ({
  period,
  setPeriod,
  selectedCategories,
  setSelectedCategories,
  targetAges,
  setTargetAges,
  purpose,
  setPurpose,
  dataSources,
  setDataSources,
  keyword,
  setKeyword,
  articleCount,
  setArticleCount,
  image,
  setImage,
  isAnalyzing,
  onAnalyze,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePresetId, setActivePresetId] = useState<string>('k-tech-leaders');
  const [showExpertMode, setShowExpertMode] = useState<boolean>(false);

  const activePreset = DEVREL_PRESETS.find(p => p.id === activePresetId) || DEVREL_PRESETS[0];

  const applyPreset = (preset: DevRelPreset) => {
    setActivePresetId(preset.id);
    setPeriod(preset.period as Period);
    setSelectedCategories(preset.selectedCategories);
    setTargetAges(preset.targetAges);
    setPurpose(preset.purpose as AnalysisPurpose);
    setDataSources(preset.dataSources);
    setKeyword(''); // Clear typed keyword so preset's example keyword does NOT force auto-filtering
    setArticleCount(preset.articleCount);
  };

  // 페이지가 처음 열렸을 때, 화면에 "선택됨"으로 표시되는 기본 프리셋을
  // 실제 period/dataSources 등 상태값에도 반영한다.
  // (이전에는 배지만 선택된 것처럼 보이고 실제 값은 App.tsx의 별도 기본값이라
  //  사용자가 카드를 직접 클릭하지 않으면 조건이 서로 어긋나는 버그가 있었다.)
  useEffect(() => {
    applyPreset(activePreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleItem = (list: string[], item: string, setter: (newList: string[]) => void) => {
    // Modify fine-tuning will set preset to custom
    setActivePresetId('custom');
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mb-12 space-y-4">
      
      {/* Horizontal Bookmark / Tab Navigation Header (Equal 50:50 Width) */}
      <div className="grid grid-cols-2 gap-2 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => setShowExpertMode(false)}
          className={`flex items-center justify-center gap-2 sm:gap-2.5 py-3 sm:py-3.5 px-3 sm:px-6 rounded-t-2xl text-xs sm:text-sm font-bold transition-all border-t-2 border-x border-b-0 ${
            !showExpertMode
              ? 'bg-white border-t-neutral-900 border-x-neutral-200 text-neutral-900 relative z-10 shadow-xs -mb-px'
              : 'bg-neutral-100/70 hover:bg-neutral-100 border-t-transparent border-x-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <Sparkles className={`w-4 h-4 ${!showExpertMode ? 'text-amber-500 fill-amber-500' : 'text-neutral-400'}`} />
          <span>추천 분석 템플릿</span>
          <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold ${
            !showExpertMode ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-600'
          }`}>
            4종
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowExpertMode(true)}
          className={`flex items-center justify-center gap-2 sm:gap-2.5 py-3 sm:py-3.5 px-3 sm:px-6 rounded-t-2xl text-xs sm:text-sm font-bold transition-all border-t-2 border-x border-b-0 ${
            showExpertMode
              ? 'bg-white border-t-blue-600 border-x-neutral-200 text-neutral-900 relative z-10 shadow-xs -mb-px'
              : 'bg-neutral-100/70 hover:bg-neutral-100 border-t-transparent border-x-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <SlidersHorizontal className={`w-4 h-4 ${showExpertMode ? 'text-blue-600' : 'text-neutral-400'}`} />
          <span>상세 조건 직접 설정</span>
        </button>
      </div>

      {/* 1. AX Quick Start Presets & Configuration Panel Container */}
      <div className="bg-white p-6 sm:p-8 rounded-b-3xl rounded-t-xl border border-neutral-200/90 shadow-xs relative z-0">
        <div className="mb-5 pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 text-white text-[11px] font-bold rounded-md ${showExpertMode ? 'bg-blue-600' : 'bg-neutral-900'}`}>
              {showExpertMode ? '상세 필터' : '추천 템플릿'}
            </span>
            <h2 className="text-lg font-bold text-neutral-900">
              {showExpertMode ? '세부 수집 파라미터 직접 설정' : 'AX 목적별 추천 템플릿'}
            </h2>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {showExpertMode
              ? '수집 기간, 카테고리, 오디언스, 데이터 소스 등 세부 조건과 키워드를 자유롭게 지정하세요.'
              : 'AX 목표(일하는 방식, 스킬 기반 HR, AI 역량 교육, 변화관리)에 맞는 추천 템플릿을 선택하세요.'}
          </p>
        </div>

        {/* Preset Cards Grid (Only shown in Scenario Mode) */}
        {!showExpertMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DEVREL_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`p-4 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-neutral-900 border-neutral-900 text-white shadow-md'
                      : 'bg-neutral-50/50 border-neutral-200 hover:bg-white hover:border-neutral-300 text-neutral-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isSelected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-neutral-200/80 text-neutral-700'
                      }`}>
                        {preset.badge}
                      </span>
                      {isSelected && (
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 선택됨
                        </span>
                      )}
                    </div>
                    <h3 className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-neutral-900'}`}>
                      {preset.title}
                    </h3>
                    <p className={`text-xs mt-1 leading-relaxed line-clamp-2 ${isSelected ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      {preset.description}
                    </p>
                  </div>

                  {/* 예전엔 여기에 "추천 키워드"가 있었지만, applyPreset()이 프리셋 클릭 시
                      키워드를 항상 비운다(자동 필터링 방지) — 즉 이 라벨은 실제 검색에는
                      전혀 반영되지 않는 표시뿐인 문구였다. 동작 안 하는 UI라 삭제한다. */}
                  <div className={`mt-3 pt-2.5 border-t text-[11px] flex items-center justify-end ${
                    isSelected ? 'border-neutral-800' : 'border-neutral-200'
                  }`}>
                    <span className={`shrink-0 font-medium text-[11px] ${
                      isSelected ? 'text-neutral-400' : 'text-neutral-500'
                    }`}>
                      {preset.period}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Detailed Filter Grid (Shown in Detailed Filter Mode) */
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-neutral-50/70 p-5 rounded-2xl border border-neutral-200/80">
              {/* Left Section: Core Filters (4 cols) */}
              <div className="lg:col-span-4 space-y-5">
                {/* 수집 대상 기간 */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-neutral-900" />
                    <label className="text-[11px] font-extrabold text-neutral-900 uppercase tracking-wider">수집 대상 기간</label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PERIODS.map((p) => (
                      <button
                        key={p}
                        onClick={() => { setPeriod(p as Period); setActivePresetId('custom'); }}
                        className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                          period === p
                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Article Count */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-3.5 h-3.5 text-neutral-900" />
                    <label className="text-[11px] font-extrabold text-neutral-900 uppercase tracking-wider">최대 데이터 수집건수</label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {/* 50/100건은 그라운딩 검색 시간을 늘려 60초 서버리스 제한에 가까워지고,
                        검증 통과 근거 수가 목표치만큼 늘지도 않아 실익이 없어 제거했다. */}
                    {[10, 20, 30].map((count) => (
                      <button
                        key={count}
                        onClick={() => {
                          setArticleCount(count);
                          setActivePresetId('custom');
                        }}
                        className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                          articleCount === count
                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900'
                        }`}
                      >
                        {count}건
                      </button>
                    ))}
                  </div>
                </section>

                {/* Target Audience */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-3.5 h-3.5 text-neutral-900" />
                    <label className="text-[11px] font-extrabold text-neutral-900 uppercase tracking-wider">타겟 독자 오디언스</label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TARGET_AGES.map((age) => (
                      <button
                        key={age}
                        onClick={() => toggleItem(targetAges, age, setTargetAges)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                          targetAges.includes(age)
                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900'
                        }`}
                      >
                        {age}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {/* Middle Section: Purpose & Categories (5 cols) */}
              <div className="lg:col-span-5 space-y-5 lg:border-l border-neutral-200/80 lg:pl-6">
                {/* Purpose */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="w-3.5 h-3.5 text-neutral-900" />
                    <label className="text-[11px] font-extrabold text-neutral-900 uppercase tracking-wider">AX 기획 목적</label>
                  </div>
                  <div className="relative">
                    <select
                      value={purpose}
                      onChange={(e) => {
                        setPurpose(e.target.value as AnalysisPurpose);
                        setActivePresetId('custom');
                      }}
                      className="w-full p-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-bold focus:border-neutral-900 outline-none transition-all appearance-none cursor-pointer text-neutral-900 pr-10"
                    >
                      {PURPOSES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </section>

                {/* Categories */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-3.5 h-3.5 text-neutral-900" />
                    <label className="text-[11px] font-extrabold text-neutral-900 uppercase tracking-wider">집중 기술 카테고리</label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => toggleItem(selectedCategories, cat.label, setSelectedCategories)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                          selectedCategories.includes(cat.label)
                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {/* Right Section: Data Sources (3 cols) */}
              <div className="lg:col-span-3 space-y-3 lg:border-l border-neutral-200/80 lg:pl-6">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-3.5 h-3.5 text-neutral-900" />
                  <label className="text-[11px] font-extrabold text-neutral-900 uppercase tracking-wider">수집 대상 소스</label>
                </div>
                <div className="space-y-1.5">
                  {DATA_SOURCES.map((src) => (
                    <button
                      key={src.id}
                      onClick={() => toggleItem(dataSources, src.label, setDataSources)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        dataSources.includes(src.label)
                          ? 'bg-white border-neutral-900 shadow-2xs'
                          : 'bg-white/50 border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <span className={`text-[11px] font-bold text-left leading-tight shrink-1 ${dataSources.includes(src.label) ? 'text-neutral-900' : 'text-neutral-500'}`}>
                        {src.label}
                      </span>
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ml-1.5 ${
                        dataSources.includes(src.label) ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-300 bg-white'
                      }`}>
                        {dataSources.includes(src.label) && <div className="w-1 h-1 bg-white rounded-full" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Input & Action Button Bar (Located at the bottom of both modes) */}
        <div className="mt-5 pt-4 border-t border-neutral-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <label className="text-[11px] font-extrabold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>{!showExpertMode ? '보조 탐색 키워드 추가' : '세부 탐색 키워드 입력'}</span>
            </label>
          </div>

          <div className="flex flex-col md:flex-row gap-2.5">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setActivePresetId('custom');
                }}
                onKeyDown={(e) => e.key === 'Enter' && onAnalyze()}
                placeholder="[선택] 직접 입력 시에만 탐색 키워드로 제한됩니다 (예: LLM, MSA, Kafka)"
                className="w-full pl-11 pr-20 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-none focus:bg-white focus:border-neutral-900 transition-all placeholder:text-neutral-400"
                disabled={isAnalyzing}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {keyword && (
                  <button
                    type="button"
                    onClick={() => setKeyword('')}
                    className="p-1 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-full transition-colors"
                    title="입력 키워드 삭제"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors bg-white rounded-lg border border-neutral-200"
                  title="참고 이미지 첨부"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="px-6 py-3 bg-neutral-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm hover:bg-neutral-800 active:scale-95 disabled:opacity-50 shrink-0"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>분석 진행 중...</span>
                </>
              ) : (
                <>
                  <Radar className="w-4 h-4 text-emerald-400" />
                  <span>리포트 생성</span>
                </>
              )}
            </button>
          </div>

          {/* Image Preview */}
          {image && (
            <div className="mt-3 relative inline-block">
              <img src={image} alt="Preview" className="h-12 w-auto rounded-lg border border-neutral-300 object-cover shadow-xs" />
              <button onClick={() => setImage(null)} className="absolute -top-1.5 -right-1.5 bg-neutral-900 text-white p-1 rounded-full shadow-md hover:bg-neutral-800 transition-colors">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

