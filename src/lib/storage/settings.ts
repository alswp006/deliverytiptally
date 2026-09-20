import type { AppSettings, Platform, StorageResult } from "@/lib/types";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "@/lib/types";
import { safeGet, safeSet } from "./core";

export { DEFAULT_SETTINGS };

const MAX_MONTHS = 24;
const GOAL_MIN = 1000;
const GOAL_MAX = 1000000;

function defaults(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    goalAlertedMonths: [],
    reportUnlockedMonths: [],
  };
}

/** 중복 제거 후 최근 24개만 유지 (오래된 순 제거) */
function normalizeMonths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of value) {
    if (typeof m === "string" && !seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out.slice(-MAX_MONTHS);
}

export function getSettings(): AppSettings {
  const result = safeGet(STORAGE_KEYS.SETTINGS);
  if (!result.ok || result.data === null || typeof result.data !== "object") {
    return defaults();
  }
  const raw = result.data as Record<string, unknown>;
  if (Array.isArray(raw) || raw.schemaVersion !== 1) return defaults();

  const goal = raw.monthlyTipGoal;
  const platform = raw.defaultPlatform;
  return {
    monthlyTipGoal:
      typeof goal === "number" && Number.isFinite(goal) && goal >= GOAL_MIN && goal <= GOAL_MAX
        ? goal
        : DEFAULT_SETTINGS.monthlyTipGoal,
    defaultPlatform:
      typeof platform === "string" && platform.length > 0
        ? (platform as Platform)
        : DEFAULT_SETTINGS.defaultPlatform,
    goalAlertedMonths: normalizeMonths(raw.goalAlertedMonths),
    reportUnlockedMonths: normalizeMonths(raw.reportUnlockedMonths),
    reviewRequested: raw.reviewRequested === true,
    schemaVersion: 1,
  };
}

export function saveSettings(
  patch: Partial<AppSettings>
): StorageResult<AppSettings> {
  const current = getSettings();
  const next: AppSettings = {
    ...current,
    ...patch,
    goalAlertedMonths: normalizeMonths(patch.goalAlertedMonths ?? current.goalAlertedMonths),
    reportUnlockedMonths: normalizeMonths(
      patch.reportUnlockedMonths ?? current.reportUnlockedMonths
    ),
    schemaVersion: 1,
  };
  const res = safeSet(STORAGE_KEYS.SETTINGS, JSON.stringify(next));
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, data: next };
}

export function markGoalAlerted(month: string): StorageResult<AppSettings> {
  const current = getSettings();
  return saveSettings({
    goalAlertedMonths: [...current.goalAlertedMonths.filter((m) => m !== month), month],
  });
}

export function markReportUnlocked(month: string): StorageResult<AppSettings> {
  const current = getSettings();
  return saveSettings({
    reportUnlockedMonths: [...current.reportUnlockedMonths.filter((m) => m !== month), month],
  });
}

export function isReportUnlocked(month: string): boolean {
  return getSettings().reportUnlockedMonths.includes(month);
}

export function markReviewRequested(): StorageResult<AppSettings> {
  return saveSettings({ reviewRequested: true });
}

export function setDefaultPlatform(p: Platform): StorageResult<AppSettings> {
  return saveSettings({ defaultPlatform: p });
}

export function validateGoal(value: number): StorageResult<void> {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      ok: false,
      reason: "INVALID",
      errors: { monthlyTipGoal: "목표 금액을 숫자로 입력해주세요" },
    };
  }
  if (value < GOAL_MIN) {
    return {
      ok: false,
      reason: "INVALID",
      errors: { monthlyTipGoal: "목표 금액은 1,000원 이상으로 입력해주세요" },
    };
  }
  if (value > GOAL_MAX) {
    return {
      ok: false,
      reason: "INVALID",
      errors: { monthlyTipGoal: "목표 금액은 1,000,000원 이하로 입력해주세요" },
    };
  }
  return { ok: true, data: undefined };
}
