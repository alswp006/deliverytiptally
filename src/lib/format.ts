function toFinite(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** 정수 KRW로 반올림해 "18,000원" 형태로. 비정상값은 "0원" */
export function formatKRW(n: number): string {
  const v = toFinite(n);
  if (v === null) return "0원";
  const r = Math.round(v);
  return `${(r === 0 ? 0 : r).toLocaleString("ko-KR")}원`;
}

/** 0.119, 1 → "11.9%". 비정상값·0은 "0%" */
export function formatPercent(ratio: number, digits = 0): string {
  const v = toFinite(ratio);
  if (v === null || v === 0) return "0%";
  const d = Math.min(Math.max(Math.floor(toFinite(digits) ?? 0), 0), 20);
  const p = Number((v * 100).toFixed(d));
  return `${p === 0 ? 0 : p}%`;
}

/** "2026-09" → "2026년 9월" */
export function formatMonthLabel(month: string): string {
  const m = /^(\d{4})-(\d{1,2})/.exec(String(month ?? ""));
  if (!m) return "";
  return `${Number(m[1])}년 ${Number(m[2])}월`;
}

/** "2026-09-21" → "9월 21일" */
export function formatDayLabel(date: string): string {
  const m = /^\d{4}-(\d{1,2})-(\d{1,2})/.exec(String(date ?? ""));
  if (!m) return "";
  return `${Number(m[1])}월 ${Number(m[2])}일`;
}

/**
 * 금액 표기. 기본 KRW "18,000원", compact면 "1.2만원"·"3억 2,000만원".
 * 다른 통화(currency)는 Intl로 표기. 비정상값은 0으로 취급.
 */
export function formatAmount(amount: number, opts?: { currency?: string; compact?: boolean }): string {
  const currency = opts?.currency ?? "KRW";
  const v = toFinite(amount) ?? 0;
  if (currency !== "KRW") {
    try {
      return new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency,
        notation: opts?.compact ? "compact" : "standard",
      }).format(v);
    } catch {
      return formatKRW(v);
    }
  }
  if (!opts?.compact) return formatKRW(v);
  const r = Math.round(v);
  const abs = Math.abs(r);
  if (abs < 10000) return formatKRW(r);
  const sign = r < 0 ? "-" : "";
  const eok = Math.floor(abs / 100000000);
  const man = Math.round((abs % 100000000) / 10000);
  if (eok === 0) return `${sign}${man.toLocaleString("ko-KR")}만원`;
  if (man === 0 || man === 10000) return `${sign}${(eok + (man === 10000 ? 1 : 0)).toLocaleString("ko-KR")}억원`;
  return `${sign}${eok.toLocaleString("ko-KR")}억 ${man.toLocaleString("ko-KR")}만원`;
}
