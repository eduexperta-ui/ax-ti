export const getReadablePeriodRange = (
  period: string,
  now: Date = new Date()
): { label: string; rangeText: string } => {
  const dayMap: Record<string, { label: string; days: number }> = {
    '최근 1주': { label: '최근 1주', days: 7 },
    '최근 2주': { label: '최근 2주', days: 14 },
    '최근 1개월': { label: '최근 1개월', days: 30 },
    '최근 60일': { label: '최근 60일', days: 60 },
    '최근 90일': { label: '최근 90일', days: 90 },
    recent7: { label: '최근 1주', days: 7 },
    recent14: { label: '최근 2주', days: 14 },
    recent30: { label: '최근 1개월', days: 30 },
    recent60: { label: '최근 60일', days: 60 },
    recent90: { label: '최근 90일', days: 90 },
  };

  const config = dayMap[period] || { label: '최근 1개월', days: 30 };
  const startDate = new Date(now.getTime() - config.days * 24 * 60 * 60 * 1000);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = now.toISOString().slice(0, 10);

  return {
    label: config.label,
    rangeText: `${config.label} (${startStr} ~ ${endStr})`,
  };
};

export const isWithinPeriod = (dateStr: string | null, period: string, now: Date): boolean => {
  if (!dateStr) return false;
  const dayMap: Record<string, number> = {
    '최근 1주': 7,
    '최근 2주': 14,
    '최근 1개월': 30,
    '최근 60일': 60,
    '최근 90일': 90,
    recent7: 7,
    recent14: 14,
    recent30: 30,
    recent60: 60,
    recent90: 90,
  };
  const days = dayMap[period] ?? 30;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return false;
  const diffDays = (now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);
  // -1 완충: 날짜 문자열은 UTC 자정으로 파싱되므로, 한국 시간 기준 오늘 발행된 글이
  // 미래(diffDays < 0)로 계산되어 탈락하는 것을 막는다.
  return diffDays >= -1 && diffDays <= days;
};


