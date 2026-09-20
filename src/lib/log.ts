/**
 * 경량 계측 버퍼 — 전환 클릭·노출을 메모리에만 기록한다.
 * 외부 전송(네트워크·분석 툴)은 하지 않으며, 모든 공개 함수는 throw하지 않는다.
 * SDK 행동 로그는 `@/lib/analytics`가 담당한다.
 */

export type LogKind = "click" | "impression";

export interface LogRecord {
  kind: LogKind;
  name: string;
  at: number;
}

const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const MAX_RECORDS = 500;

const records: LogRecord[] = [];
const seenImpressions = new Set<string>();

function isValidName(name: unknown): name is string {
  return typeof name === "string" && SNAKE_CASE.test(name);
}

function push(kind: LogKind, name: string): void {
  records.push({ kind, name, at: Date.now() });
  if (records.length > MAX_RECORDS) records.shift();
}

export function logClick(name: string): void {
  try {
    if (!isValidName(name)) return;
    push("click", name);
  } catch {
    /* 계측 실패는 무시 */
  }
}

export function logImpression(name: string): void {
  try {
    if (!isValidName(name)) return;
    if (seenImpressions.has(name)) return;
    seenImpressions.add(name);
    push("impression", name);
  } catch {
    /* 계측 실패는 무시 */
  }
}

/** 테스트용 — 기록된 노출 건수(이름별). */
export function __getImpressionCount(name: string): number {
  return records.filter((r) => r.kind === "impression" && r.name === name).length;
}

/** 테스트용 — 기록 스냅샷. */
export function __getRecords(): readonly LogRecord[] {
  return records.slice();
}
