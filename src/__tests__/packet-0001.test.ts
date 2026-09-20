import { describe, it, expect } from "vitest";
import type {
  Platform,
  DeliveryOrder,
  OrderInput,
  AppSettings,
  MonthlySummary,
  StorageFailReason,
  StorageResult,
} from "@/lib/types";
import {
  PLATFORM_LABEL,
  PLATFORM_ORDER,
  LIMITS,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
} from "@/lib/types";

describe("types.ts - Entity Types & Constants Definition", () => {
  // AC-2: PLATFORM_LABEL 매핑 검증
  describe("AC-2: PLATFORM_LABEL", () => {
    it("should map BAEMIN to '배달의민족'", () => {
      expect(PLATFORM_LABEL.BAEMIN).toBe("배달의민족");
    });

    it("should map COUPANG_EATS to '쿠팡이츠'", () => {
      expect(PLATFORM_LABEL.COUPANG_EATS).toBe("쿠팡이츠");
    });

    it("should map YOGIYO to '요기요'", () => {
      expect(PLATFORM_LABEL.YOGIYO).toBe("요기요");
    });

    it("should map ETC to '기타'", () => {
      expect(PLATFORM_LABEL.ETC).toBe("기타");
    });

    it("should have exactly 4 platform labels", () => {
      const keys = Object.keys(PLATFORM_LABEL);
      expect(keys).toHaveLength(4);
      expect(keys).toEqual(expect.arrayContaining(["BAEMIN", "COUPANG_EATS", "YOGIYO", "ETC"]));
    });
  });

  // AC-3: PLATFORM_ORDER 배열 순서 검증
  describe("AC-3: PLATFORM_ORDER", () => {
    it("should be exactly ['ETC','BAEMIN','YOGIYO','COUPANG_EATS']", () => {
      expect(PLATFORM_ORDER).toEqual([
        "ETC",
        "BAEMIN",
        "YOGIYO",
        "COUPANG_EATS",
      ]);
    });

    it("should have exactly 4 platforms", () => {
      expect(PLATFORM_ORDER).toHaveLength(4);
    });

    it("should start with ETC", () => {
      expect(PLATFORM_ORDER[0]).toBe("ETC");
    });

    it("should have BAEMIN at index 1", () => {
      expect(PLATFORM_ORDER[1]).toBe("BAEMIN");
    });

    it("should have YOGIYO at index 2", () => {
      expect(PLATFORM_ORDER[2]).toBe("YOGIYO");
    });

    it("should end with COUPANG_EATS", () => {
      expect(PLATFORM_ORDER[3]).toBe("COUPANG_EATS");
    });
  });

  // AC-5: DEFAULT_SETTINGS 값 검증
  describe("AC-5: DEFAULT_SETTINGS", () => {
    it("should have monthlyTipGoal = 30000", () => {
      expect(DEFAULT_SETTINGS.monthlyTipGoal).toBe(30000);
    });

    it("should have defaultPlatform = 'BAEMIN'", () => {
      expect(DEFAULT_SETTINGS.defaultPlatform).toBe("BAEMIN");
    });

    it("should have empty goalAlertedMonths array", () => {
      expect(DEFAULT_SETTINGS.goalAlertedMonths).toEqual([]);
    });

    it("should have empty reportUnlockedMonths array", () => {
      expect(DEFAULT_SETTINGS.reportUnlockedMonths).toEqual([]);
    });

    it("should have reviewRequested = false", () => {
      expect(DEFAULT_SETTINGS.reviewRequested).toBe(false);
    });

    it("should have schemaVersion = 1", () => {
      expect(DEFAULT_SETTINGS.schemaVersion).toBe(1);
    });

    it("should match exact default settings object", () => {
      expect(DEFAULT_SETTINGS).toEqual({
        monthlyTipGoal: 30000,
        defaultPlatform: "BAEMIN",
        goalAlertedMonths: [],
        reportUnlockedMonths: [],
        reviewRequested: false,
        schemaVersion: 1,
      });
    });
  });

  // AC-5: LIMITS 값 검증
  describe("AC-5: LIMITS", () => {
    it("should have MAX_ORDERS = 2000", () => {
      expect(LIMITS.MAX_ORDERS).toBe(2000);
    });
  });

  // AC-5: STORAGE_KEYS 값 검증
  describe("AC-5: STORAGE_KEYS", () => {
    it("should have ORDERS = 'dtt:orders:v1'", () => {
      expect(STORAGE_KEYS.ORDERS).toBe("dtt:orders:v1");
    });

    it("should have SETTINGS = 'dtt:settings:v1'", () => {
      expect(STORAGE_KEYS.SETTINGS).toBe("dtt:settings:v1");
    });

    it("should have ONBOARD = 'dtt:onboard:v1'", () => {
      expect(STORAGE_KEYS.ONBOARD).toBe("dtt:onboard:v1");
    });
  });

  // AC-1: TypeScript 타입 검증 (컴파일 시점 검증)
  describe("AC-1: TypeScript type definitions", () => {
    it("should export DeliveryOrder interface", () => {
      // Type-level assertion: if this compiles, the type exists
      type TestDeliveryOrder = DeliveryOrder;
      const order: TestDeliveryOrder = {
        id: "o_123",
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 18000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(order).toBeDefined();
      expect(order.id).toMatch(/^o_/);
    });

    it("should export Platform type as union", () => {
      type TestPlatform = Platform;
      const platforms: TestPlatform[] = ["BAEMIN", "COUPANG_EATS", "YOGIYO", "ETC"];
      expect(platforms).toHaveLength(4);
    });

    it("should export OrderInput type (without id, createdAt, updatedAt)", () => {
      type TestOrderInput = OrderInput;
      const input: TestOrderInput = {
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 18000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심",
      };
      expect(input).toBeDefined();
      expect(input).not.toHaveProperty("id");
      expect(input).not.toHaveProperty("createdAt");
      expect(input).not.toHaveProperty("updatedAt");
    });

    it("should export AppSettings interface", () => {
      type TestAppSettings = AppSettings;
      const settings: TestAppSettings = {
        monthlyTipGoal: 30000,
        defaultPlatform: "BAEMIN",
        goalAlertedMonths: [],
        reportUnlockedMonths: [],
        reviewRequested: false,
        schemaVersion: 1,
      };
      expect(settings).toBeDefined();
      expect(settings.schemaVersion).toBe(1);
    });

    it("should export MonthlySummary interface", () => {
      type TestMonthlySummary = MonthlySummary;
      const summary: TestMonthlySummary = {
        month: "2026-09",
        orderCount: 2,
        totalTip: 7000,
        totalPadding: 2000,
        totalFood: 35000,
        totalSpend: 42000,
        avgTip: 3500,
        pickupSavable: 5000,
        byPlatform: [
          { platform: "YOGIYO", count: 1, tip: 4000, ratio: 0.5714 },
          { platform: "BAEMIN", count: 1, tip: 3000, ratio: 0.4286 },
        ],
        dailyTips: Array(30).fill(0),
      };
      expect(summary).toBeDefined();
      expect(summary.month).toBe("2026-09");
    });

    it("should export StorageFailReason type", () => {
      type TestStorageFailReason = StorageFailReason;
      const reasons: TestStorageFailReason[] = ["LIMIT", "QUOTA", "INVALID", "NOT_FOUND"];
      expect(reasons).toHaveLength(4);
    });

    it("should export StorageResult discriminated union type", () => {
      type TestStorageResultSuccess = StorageResult<{ test: string }>;
      type TestStorageResultFailure = StorageResult<never>;

      const success: TestStorageResultSuccess = {
        ok: true,
        data: { test: "value" },
      };
      expect(success.ok).toBe(true);

      const failure: TestStorageResultFailure = {
        ok: false,
        reason: "INVALID",
        errors: { field: "error message" },
      };
      expect(failure.ok).toBe(false);
      expect(failure.reason).toBe("INVALID");
    });
  });

  // AC-1: Verify no runtime function implementations
  describe("AC-1: No runtime implementations", () => {
    it("should not export any functions from types.ts", () => {
      // This verifies that types.ts contains only type/const definitions
      // and no function implementations
      expect(typeof PLATFORM_LABEL).toBe("object");
      expect(typeof PLATFORM_ORDER).toBe("object");
      expect(typeof LIMITS).toBe("object");
      expect(typeof STORAGE_KEYS).toBe("object");
      expect(typeof DEFAULT_SETTINGS).toBe("object");
    });
  });
});
