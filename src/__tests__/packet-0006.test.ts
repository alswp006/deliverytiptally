import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSettings,
  saveSettings,
  markGoalAlerted,
  markReportUnlocked,
  isReportUnlocked,
  markReviewRequested,
  setDefaultPlatform,
  validateGoal,
  DEFAULT_SETTINGS,
} from "@/lib/storage/settings";

describe("AppSettings 저장소 + 목표 검증", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // AC-1: 빈 저장소에서 getSettings()가 DEFAULT_SETTINGS를 반환
  describe("AC-1: Default settings on empty storage", () => {
    it("should return DEFAULT_SETTINGS when storage is empty", () => {
      const settings = getSettings();
      expect(settings.monthlyTipGoal).toBe(30000);
      expect(settings.defaultPlatform).toBe("BAEMIN");
      expect(settings.goalAlertedMonths).toEqual([]);
      expect(settings.reportUnlockedMonths).toEqual([]);
      expect(settings.reviewRequested).toBe(false);
      expect(settings.schemaVersion).toBe(1);
    });

    it("should return exact DEFAULT_SETTINGS object on empty storage", () => {
      const settings = getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  // AC-2: 손상된 데이터나 schemaVersion 불일치 시 DEFAULT_SETTINGS 반환, 주문 데이터 건드리지 않음
  describe("AC-2: Corrupt or mismatched schema returns DEFAULT_SETTINGS without touching orders", () => {
    it("should return DEFAULT_SETTINGS when settings data is broken JSON", () => {
      localStorage.setItem("dtt:settings:v1", "{{broken");
      localStorage.setItem("dtt:orders:v1", '[{"id":"order1"}]');

      const settings = getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);

      // Verify orders data is not touched
      const orders = localStorage.getItem("dtt:orders:v1");
      expect(orders).toBe('[{"id":"order1"}]');
    });

    it("should return DEFAULT_SETTINGS when schemaVersion is not 1", () => {
      localStorage.setItem(
        "dtt:settings:v1",
        JSON.stringify({
          monthlyTipGoal: 50000,
          defaultPlatform: "COUPANG_EATS",
          goalAlertedMonths: ["2026-09"],
          reportUnlockedMonths: [],
          reviewRequested: true,
          schemaVersion: 99,
        })
      );
      localStorage.setItem("dtt:orders:v1", '[{"id":"order2"}]');

      const settings = getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);

      // Verify orders data is not touched
      const orders = localStorage.getItem("dtt:orders:v1");
      expect(orders).toBe('[{"id":"order2"}]');
    });

    it("should return DEFAULT_SETTINGS when settings is missing schemaVersion", () => {
      localStorage.setItem(
        "dtt:settings:v1",
        JSON.stringify({
          monthlyTipGoal: 30000,
          defaultPlatform: "BAEMIN",
        })
      );

      const settings = getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  // AC-3: markGoalAlerted 중복 제거 + 최근 24개만 유지
  describe("AC-3: markGoalAlerted deduplicates and keeps only recent 24 months", () => {
    it("should deduplicate when same month is marked twice", () => {
      markGoalAlerted("2026-09");
      markGoalAlerted("2026-09");

      const settings = getSettings();
      expect(settings.goalAlertedMonths).toEqual(["2026-09"]);
      expect(settings.goalAlertedMonths.length).toBe(1);
    });

    it("should keep only recent 24 months when adding 25th month", () => {
      // Add 25 months (2024-01 through 2026-01)
      for (let i = 0; i < 25; i++) {
        const year = 2024 + Math.floor(i / 12);
        const month = String((i % 12) + 1).padStart(2, "0");
        markGoalAlerted(`${year}-${month}`);
      }

      const settings = getSettings();
      expect(settings.goalAlertedMonths.length).toBe(24);
    });

    it("should remove oldest month when exceeding 24", () => {
      // Add months 1-24 first
      for (let i = 1; i <= 24; i++) {
        markGoalAlerted(`2024-${String(i).padStart(2, "0")}`);
      }

      const settingsBefore = getSettings();
      expect(settingsBefore.goalAlertedMonths[0]).toBe("2024-01");

      // Add 25th month
      markGoalAlerted("2024-25");

      const settingsAfter = getSettings();
      expect(settingsAfter.goalAlertedMonths.length).toBe(24);
      expect(settingsAfter.goalAlertedMonths[0]).not.toBe("2024-01");
    });
  });

  // AC-4: validateGoal 검증
  describe("AC-4: validateGoal validates goal amount correctly", () => {
    it("should return error when goal is below minimum (500)", () => {
      const result = validateGoal(500);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("INVALID");
        expect(result.errors?.monthlyTipGoal).toContain("1,000원");
      }
    });

    it("should return error message with correct minimum amount", () => {
      const result = validateGoal(500);
      if (!result.ok) {
        expect(result.errors?.monthlyTipGoal).toContain("1,000원");
      }
    });

    it("should return error when goal exceeds maximum (1,000,000)", () => {
      const result = validateGoal(1000001);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("INVALID");
        expect(result.errors?.monthlyTipGoal).toContain("1,000,000원");
      }
    });

    it("should return success for valid goal (30,000)", () => {
      const result = validateGoal(30000);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeUndefined();
      }
    });

    it("should return success for minimum boundary (1,000)", () => {
      const result = validateGoal(1000);
      expect(result.ok).toBe(true);
    });

    it("should return success for maximum boundary (1,000,000)", () => {
      const result = validateGoal(1000000);
      expect(result.ok).toBe(true);
    });
  });

  // AC-5: markReportUnlocked / isReportUnlocked
  describe("AC-5: markReportUnlocked and isReportUnlocked work correctly", () => {
    it("should return true for unlocked month after markReportUnlocked", () => {
      markReportUnlocked("2026-09");
      const isUnlocked = isReportUnlocked("2026-09");
      expect(isUnlocked).toBe(true);
    });

    it("should return false for locked month", () => {
      const isUnlocked = isReportUnlocked("2026-08");
      expect(isUnlocked).toBe(false);
    });

    it("should distinguish between different months", () => {
      markReportUnlocked("2026-09");
      expect(isReportUnlocked("2026-09")).toBe(true);
      expect(isReportUnlocked("2026-08")).toBe(false);
      expect(isReportUnlocked("2026-10")).toBe(false);
    });

    it("should maintain report unlocked months with deduplication", () => {
      markReportUnlocked("2026-09");
      markReportUnlocked("2026-09");

      const settings = getSettings();
      expect(settings.reportUnlockedMonths).toEqual(["2026-09"]);
      expect(settings.reportUnlockedMonths.length).toBe(1);
    });

    it("should keep only recent 24 months in reportUnlockedMonths", () => {
      for (let i = 0; i < 25; i++) {
        const year = 2024 + Math.floor(i / 12);
        const month = String((i % 12) + 1).padStart(2, "0");
        markReportUnlocked(`${year}-${month}`);
      }

      const settings = getSettings();
      expect(settings.reportUnlockedMonths.length).toBe(24);
    });
  });

  // Additional helper functions
  describe("Additional settings helpers", () => {
    it("should mark review as requested", () => {
      expect(getSettings().reviewRequested).toBe(false);
      markReviewRequested();
      expect(getSettings().reviewRequested).toBe(true);
    });

    it("should set default platform", () => {
      expect(getSettings().defaultPlatform).toBe("BAEMIN");
      setDefaultPlatform("COUPANG_EATS");
      expect(getSettings().defaultPlatform).toBe("COUPANG_EATS");
    });

    it("should persist platform change via saveSettings", () => {
      setDefaultPlatform("ETC");
      const settings = getSettings();
      expect(settings.defaultPlatform).toBe("ETC");
    });
  });

  // saveSettings patch behavior
  describe("saveSettings patch behavior", () => {
    it("should apply patch to existing settings", () => {
      const initial = getSettings();
      expect(initial.monthlyTipGoal).toBe(30000);

      saveSettings({ monthlyTipGoal: 50000 });

      const updated = getSettings();
      expect(updated.monthlyTipGoal).toBe(50000);
      expect(updated.defaultPlatform).toBe("BAEMIN"); // unchanged
    });

    it("should preserve other fields when patching", () => {
      markGoalAlerted("2026-09");
      saveSettings({ defaultPlatform: "COUPANG_EATS" });

      const settings = getSettings();
      expect(settings.goalAlertedMonths).toEqual(["2026-09"]);
      expect(settings.defaultPlatform).toBe("COUPANG_EATS");
    });

    it("should maintain schemaVersion when saving", () => {
      saveSettings({ monthlyTipGoal: 100000 });
      const settings = getSettings();
      expect(settings.schemaVersion).toBe(1);
    });
  });
});
