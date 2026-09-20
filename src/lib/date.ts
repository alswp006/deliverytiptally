// Asia/Seoul 기준 날짜/월 유틸 — 순수 함수, 예외 없음

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 오늘 날짜 (YYYY-MM-DD, KST) */
export function todayKST(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const y = get("year");
    const m = get("month");
    const d = get("day");
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fall through to fixed-offset calculation
  }
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}-${pad2(k.getUTCMonth() + 1)}-${pad2(k.getUTCDate())}`;
}

/** 이번 달 (YYYY-MM, KST) */
export function currentMonthKST(): string {
  return todayKST().slice(0, 7);
}

export function isValidMonthKey(v: unknown): v is string {
  return typeof v === "string" && MONTH_RE.test(v);
}

/** 무효/null/undefined면 이번 달 */
export function normalizeMonthParam(v: string | null | undefined): string {
  return isValidMonthKey(v) ? v : currentMonthKST();
}

function parseMonth(month: string): { y: number; m: number } | null {
  if (!isValidMonthKey(month)) return null;
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  if (m < 1 || m > 12) return null;
  return { y, m };
}

export function daysInMonth(month: string): number {
  const p = parseMonth(month);
  if (!p) return 30;
  return new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
}

/** 'YYYY-MM-DD' → 'YYYY-MM' (형식이 틀리면 이번 달) */
export function monthOf(date: string): string {
  if (typeof date === "string" && DATE_RE.test(date)) return date.slice(0, 7);
  return currentMonthKST();
}

export function shiftMonth(month: string, delta: number): string {
  const p = parseMonth(month) ?? parseMonth(currentMonthKST());
  if (!p) return currentMonthKST();
  const d = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  const idx = p.y * 12 + (p.m - 1) + d;
  const y = Math.floor(idx / 12);
  const m = idx - y * 12 + 1;
  return `${String(y).padStart(4, "0")}-${pad2(m)}`;
}

export function isFutureMonth(month: string): boolean {
  if (!isValidMonthKey(month)) return false;
  return month > currentMonthKST();
}

export function isFutureDate(date: string): boolean {
  if (typeof date !== "string" || !DATE_RE.test(date)) return false;
  return date.slice(0, 10) > todayKST();
}
