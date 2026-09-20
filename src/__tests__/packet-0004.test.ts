import { describe, it, expect, beforeEach, vi } from "vitest";
import type { DeliveryOrder } from "@/lib/types";

// Mock storage error handler
let storageErrorHandler: ((error: Error) => void) | null = null;

// Storage 저장소 상수
const STORAGE_KEY = "dtt:orders:v1";

describe("localStorage 안전 읽기/쓰기 래퍼 + 레코드 정제 [Packet 0004]", () => {
  beforeEach(() => {
    localStorage.clear();
    storageErrorHandler = null;
    vi.clearAllMocks();
  });

  // AC-1: 깨진 JSON 파싱 시 안전하게 실패
  describe("AC-1: 깨진 JSON 처리", () => {
    it("should return empty array when JSON is malformed, call handler once, no console.error", async () => {
      // Arrange
      localStorage.setItem(STORAGE_KEY, "{{broken");
      const handleError = vi.fn();

      // Import the function (이것이 실패할 것임 — 아직 구현이 없음)
      const { listOrders, setStorageErrorHandler } = await import(
        "@/lib/storage/core"
      );
      setStorageErrorHandler(handleError);
      const consoleErrorSpy = vi.spyOn(console, "error");

      // Act
      const result = listOrders();

      // Assert
      expect(result).toEqual([]);
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError).toHaveBeenCalledWith(expect.any(Error));
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  // AC-2: 정상 데이터만 필터링되어 반환, 길이 변했으면 재저장
  describe("AC-2: 정상/정상하지않은 데이터 섞임 처리", () => {
    it("should extract valid orders, rewrite storage when filtered length differs", async () => {
      // Arrange
      const validOrder: DeliveryOrder = {
        id: "o_1",
        date: "2026-09-21",
        platform: "BAEMIN",
        deliveryTip: 2500,
        minOrderPadding: 1000,
        foodAmount: 15000,
        pickupAvailable: false,
        memo: "주문 기록",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const rawData = [validOrder, { id: "o_2" }, "junk", null];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rawData));

      const { listOrders } = await import("@/lib/storage/core");

      // Act
      const result = listOrders();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("o_1");
      expect(result[0]?.date).toBe("2026-09-21");
      expect(result[0]?.platform).toBe("BAEMIN");

      // localStorage가 정제된 배열로 덮어써졌는지 확인
      const storedValue = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(storedValue).toHaveLength(1);
      expect(storedValue[0]?.id).toBe("o_1");
    });
  });

  // AC-3: sanitizeOrder 정제 로직 검증
  describe("AC-3: sanitizeOrder 필드 정제", () => {
    it("should sanitize delivery tip (null→0), min order padding (string→int, negative→0), pickup available (string→false)", async () => {
      // Arrange
      const raw = {
        id: "x",
        date: "2026-09-01",
        platform: "BAEMIN",
        deliveryTip: null,
        minOrderPadding: "2000",
        foodAmount: 18000,
        pickupAvailable: "yes",
        memo: "test memo",
      };

      const { sanitizeOrder } = await import("@/lib/storage/sanitize");

      // Act
      const result = sanitizeOrder(raw);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.deliveryTip).toBe(0);
      expect(result?.minOrderPadding).toBe(2000);
      expect(result?.foodAmount).toBe(18000);
      expect(result?.pickupAvailable).toBe(false);
    });

    it("should convert negative numbers to 0", async () => {
      // Arrange
      const raw = {
        id: "x",
        date: "2026-09-01",
        platform: "BAEMIN",
        deliveryTip: -500,
        minOrderPadding: -1000,
        foodAmount: 20000,
        pickupAvailable: false,
        memo: "",
      };

      const { sanitizeOrder } = await import("@/lib/storage/sanitize");

      // Act
      const result = sanitizeOrder(raw);

      // Assert
      expect(result?.deliveryTip).toBe(0);
      expect(result?.minOrderPadding).toBe(0);
    });

    it("should truncate memo to 30 chars and convert non-string to empty", async () => {
      // Arrange
      const longMemo =
        "이것은 매우 긴 메모 문자열입니다 이것은 매우 긴 메모 문자열입니다";
      const raw = {
        id: "x",
        date: "2026-09-01",
        platform: "BAEMIN",
        deliveryTip: 0,
        minOrderPadding: 0,
        foodAmount: 15000,
        pickupAvailable: true,
        memo: longMemo,
      };

      const { sanitizeOrder } = await import("@/lib/storage/sanitize");

      // Act
      const result = sanitizeOrder(raw);

      // Assert
      expect(result?.memo.length).toBeLessThanOrEqual(30);
      expect(result?.memo).toEqual(
        longMemo.substring(0, 30)
      );
    });

    it("should return null when required fields (id, date, platform) are missing", async () => {
      // Arrange
      const invalidOrder1 = {
        date: "2026-09-01",
        platform: "BAEMIN",
        deliveryTip: 0,
        minOrderPadding: 0,
        foodAmount: 15000,
        pickupAvailable: false,
        memo: "",
      };
      const invalidOrder2 = {
        id: "x",
        platform: "BAEMIN",
        deliveryTip: 0,
        minOrderPadding: 0,
        foodAmount: 15000,
        pickupAvailable: false,
        memo: "",
      };
      const invalidOrder3 = {
        id: "x",
        date: "2026-09-01",
        deliveryTip: 0,
        minOrderPadding: 0,
        foodAmount: 15000,
        pickupAvailable: false,
        memo: "",
      };

      const { sanitizeOrder } = await import("@/lib/storage/sanitize");

      // Act & Assert
      expect(sanitizeOrder(invalidOrder1 as any)).toBeNull();
      expect(sanitizeOrder(invalidOrder2 as any)).toBeNull();
      expect(sanitizeOrder(invalidOrder3 as any)).toBeNull();
    });

    it("should convert pickupAvailable to false when not === true", async () => {
      // Arrange
      const raw1 = {
        id: "x",
        date: "2026-09-01",
        platform: "BAEMIN",
        deliveryTip: 0,
        minOrderPadding: 0,
        foodAmount: 15000,
        pickupAvailable: 1, // truthy but not === true
        memo: "",
      };
      const raw2 = {
        id: "x",
        date: "2026-09-01",
        platform: "BAEMIN",
        deliveryTip: 0,
        minOrderPadding: 0,
        foodAmount: 15000,
        pickupAvailable: true,
        memo: "",
      };

      const { sanitizeOrder } = await import("@/lib/storage/sanitize");

      // Act & Assert
      expect(sanitizeOrder(raw1 as any)?.pickupAvailable).toBe(false);
      expect(sanitizeOrder(raw2)?.pickupAvailable).toBe(true);
    });
  });

  // AC-4: QuotaExceededError 처리
  describe("AC-4: QuotaExceededError 안전 처리", () => {
    it("should return {ok:false, reason:'QUOTA'} when setItem throws QuotaExceededError", async () => {
      // Arrange
      const originalSetItem = localStorage.setItem;
      const quotaError = new Error("QuotaExceededError");
      quotaError.name = "QuotaExceededError";
      vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw quotaError;
      });

      const { safeSet } = await import("@/lib/storage/core");

      // Act
      const result = safeSet("test_key", JSON.stringify({ id: "test" }));

      // Assert
      expect(result).toEqual({ ok: false, reason: "QUOTA" });
    });

    it("should not throw when QuotaExceededError occurs", async () => {
      // Arrange
      const quotaError = new Error("QuotaExceededError");
      quotaError.name = "QuotaExceededError";
      vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw quotaError;
      });

      const { safeSet } = await import("@/lib/storage/core");

      // Act & Assert
      expect(() => {
        safeSet("test_key", JSON.stringify({ id: "test" }));
      }).not.toThrow();
    });
  });

  // AC-5: 빈 저장소
  describe("AC-5: 빈 저장소 처리", () => {
    it("should return empty array when storage is empty", async () => {
      // Arrange
      localStorage.clear();

      const { listOrders } = await import("@/lib/storage/core");

      // Act
      const result = listOrders();

      // Assert
      expect(result).toEqual([]);
    });

    it("should return null when order ID does not exist", async () => {
      // Arrange
      const validOrder: DeliveryOrder = {
        id: "o_1",
        date: "2026-09-21",
        platform: "BAEMIN",
        deliveryTip: 2500,
        minOrderPadding: 1000,
        foodAmount: 15000,
        pickupAvailable: false,
        memo: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([validOrder]));

      const { getOrder } = await import("@/lib/storage/core");

      // Act
      const result = getOrder("없는id");

      // Assert
      expect(result).toBeNull();
    });
  });

  // AC-4 추가: safeGet INVALID JSON 처리
  describe("AC-4 additional: safeGet returns error when JSON is invalid", () => {
    it("should return {ok:false, reason:'INVALID'} when JSON parsing fails", async () => {
      // Arrange
      localStorage.setItem("invalid_json", "{{broken");

      const { safeGet } = await import("@/lib/storage/core");

      // Act
      const result = safeGet("invalid_json");

      // Assert
      expect(result).toEqual({ ok: false, reason: "INVALID" });
    });

    it("should return {ok:true, data:value} when JSON parsing succeeds", async () => {
      // Arrange
      const data = { id: "test", value: 123 };
      localStorage.setItem("valid_json", JSON.stringify(data));

      const { safeGet } = await import("@/lib/storage/core");

      // Act
      const result = safeGet("valid_json");

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(data);
      }
    });
  });

  // 추가: getOrder 함수가 정상적으로 order를 반환
  describe("Additional: getOrder returns correct order", () => {
    it("should return the order when ID exists", async () => {
      // Arrange
      const validOrder: DeliveryOrder = {
        id: "o_1",
        date: "2026-09-21",
        platform: "BAEMIN",
        deliveryTip: 2500,
        minOrderPadding: 1000,
        foodAmount: 15000,
        pickupAvailable: false,
        memo: "test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([validOrder]));

      const { getOrder } = await import("@/lib/storage/core");

      // Act
      const result = getOrder("o_1");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe("o_1");
      expect(result?.date).toBe("2026-09-21");
      expect(result?.platform).toBe("BAEMIN");
    });
  });
});
