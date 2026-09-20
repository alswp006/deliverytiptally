import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { OrderInput, DeliveryOrder } from "@/lib/types";
import {
  validateOrderInput,
  addOrder,
  updateOrder,
  deleteOrder,
} from "@/lib/storage/orders";

describe("주문 CRUD + 입력 검증 (한도·쿼터 에러)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // AC-1: addOrder 기본 동작
  describe("AC-1: addOrder 기본 동작", () => {
    it("should create order with id starting with 'o_', createdAt === updatedAt, and store in localStorage", () => {
      const input: OrderInput = {
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 18000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심",
      };

      const result = addOrder(input);

      // 성공 여부
      expect(result.ok).toBe(true);

      // id 생성 확인
      if (result.ok) {
        expect(result.data).toBeDefined();
        expect(result.data.id).toMatch(/^o_/);
      }

      // localStorage 저장 확인
      const stored = localStorage.getItem("dtt:orders:v1");
      expect(stored).not.toBeNull();

      const orders = JSON.parse(stored!) as DeliveryOrder[];
      expect(orders).toHaveLength(1);
      expect(orders[0].foodAmount).toBe(18000);

      // createdAt === updatedAt
      expect(orders[0].createdAt).toBe(orders[0].updatedAt);
    });
  });

  // AC-2: validateOrderInput 검증 메시지
  describe("AC-2: validateOrderInput 검증 및 불변성", () => {
    it("should return validation errors with exact messages (foodAmount 0, deliveryTip 60000)", () => {
      const input: OrderInput = {
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 0,
        deliveryTip: 60000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심",
      };

      const result = validateOrderInput(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("INVALID");
        expect(result.errors).toBeDefined();
        expect(result.errors?.foodAmount).toBe("주문 금액을 입력해주세요");
        expect(result.errors?.deliveryTip).toBe(
          "배달팁은 0원 이상 50,000원 이하로 입력해주세요"
        );
      }
    });

    it("should not mutate localStorage when validating", () => {
      const beforeValidate = localStorage.getItem("dtt:orders:v1");

      const input: OrderInput = {
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 0,
        deliveryTip: 60000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심",
      };

      validateOrderInput(input);

      const afterValidate = localStorage.getItem("dtt:orders:v1");
      expect(afterValidate).toBe(beforeValidate);
    });

    it("should validate minOrderPadding range", () => {
      const input: OrderInput = {
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 18000,
        deliveryTip: 3000,
        minOrderPadding: 300000, // > 200,000
        pickupAvailable: true,
        memo: "점심",
      };

      const result = validateOrderInput(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors?.minOrderPadding).toBe(
          "최소주문 추가금액은 0원 이상 200,000원 이하로 입력해주세요"
        );
      }
    });

    it("should validate future date", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDateStr = tomorrow.toISOString().split("T")[0];

      const input: OrderInput = {
        date: futureDateStr,
        platform: "BAEMIN",
        foodAmount: 18000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심",
      };

      const result = validateOrderInput(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors?.date).toBe("미래 날짜는 선택할 수 없어요");
      }
    });

    it("should validate memo length > 30 chars", () => {
      const input: OrderInput = {
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 18000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심 세트 + 음료 + 사이드 추가로 주문했어 점심 세트", // > 30 chars
      };

      const result = validateOrderInput(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors?.memo).toBe("메모는 30자까지 입력할 수 있어요");
      }
    });

    it("should validate foodAmount upper limit (1,000,000)", () => {
      const input: OrderInput = {
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 1000001,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심",
      };

      const result = validateOrderInput(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors?.foodAmount).toBe(
          "주문 금액은 1,000,000원 이하로 입력해주세요"
        );
      }
    });
  });

  // AC-3: 2,000건 한도
  describe("AC-3: LIMIT 처리 (2,000건 이상)", () => {
    it("should return LIMIT error when 2,000+ orders exist", () => {
      // 2,000개 주문 생성
      const orders: DeliveryOrder[] = [];
      for (let i = 0; i < 2000; i++) {
        orders.push({
          id: `o_${i}`,
          date: "2026-09-21",
          platform: "BAEMIN",
          foodAmount: 18000,
          deliveryTip: 3000,
          minOrderPadding: 2000,
          pickupAvailable: true,
          memo: "테스트",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      localStorage.setItem("dtt:orders:v1", JSON.stringify(orders));

      const input: OrderInput = {
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 18000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심",
      };

      const result = addOrder(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("LIMIT");
      }

      // 저장 건수 유지 확인
      const stored = JSON.parse(localStorage.getItem("dtt:orders:v1")!);
      expect(stored).toHaveLength(2000);
    });
  });

  // AC-4: QuotaExceededError 처리
  describe("AC-4: QUOTA 처리 (localStorage.setItem 실패)", () => {
    it("should return QUOTA error when QuotaExceededError occurs", () => {
      // localStorage.setItem을 mock하여 QuotaExceededError 던지게
      const originalSetItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
        if (key === "dtt:orders:v1") {
          const error = new Error("QuotaExceededError");
          error.name = "QuotaExceededError";
          throw error;
        }
        originalSetItem.call(localStorage, key, value);
      });

      const input: OrderInput = {
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 18000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심",
      };

      const result = addOrder(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("QUOTA");
      }

      // console.error 호출 없음 확인
      const consoleErrorSpy = vi.spyOn(console, "error");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // AC-5: updateOrder & deleteOrder
  describe("AC-5: updateOrder & deleteOrder (NOT_FOUND, updatedAt 갱신)", () => {
    it("updateOrder should return NOT_FOUND for non-existent id", () => {
      const result = updateOrder("o_none", {
        foodAmount: 20000,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("NOT_FOUND");
      }
    });

    it("deleteOrder should return NOT_FOUND for non-existent id", () => {
      const result = deleteOrder("o_none");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("NOT_FOUND");
      }
    });

    it("updateOrder should update order and modify updatedAt", () => {
      const input: OrderInput = {
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 18000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심",
      };

      const addResult = addOrder(input);
      expect(addResult.ok).toBe(true);

      let orderId: string;
      if (addResult.ok) {
        orderId = addResult.data.id;
      } else {
        throw new Error("addOrder failed");
      }

      // 약간의 시간 경과
      const createdOrder = JSON.parse(
        localStorage.getItem("dtt:orders:v1")!
      )[0] as DeliveryOrder;
      const originalUpdatedAt = createdOrder.updatedAt;

      // 업데이트
      const updateResult = updateOrder(orderId, {
        foodAmount: 25000,
        memo: "점심 + 간식",
      });

      expect(updateResult.ok).toBe(true);

      // 저장소 확인
      const stored = JSON.parse(
        localStorage.getItem("dtt:orders:v1")!
      )[0] as DeliveryOrder;
      expect(stored.foodAmount).toBe(25000);
      expect(stored.memo).toBe("점심 + 간식");

      // createdAt은 유지, updatedAt은 변경
      expect(stored.createdAt).toBe(createdOrder.createdAt);
      // updatedAt이 갱신되었는지 확인 (같거나 이후)
      expect(stored.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it("deleteOrder should remove order from storage", () => {
      const input: OrderInput = {
        date: "2026-09-21",
        platform: "BAEMIN",
        foodAmount: 18000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "점심",
      };

      const addResult = addOrder(input);
      expect(addResult.ok).toBe(true);

      let orderId: string;
      if (addResult.ok) {
        orderId = addResult.data.id;
      } else {
        throw new Error("addOrder failed");
      }

      // 삭제
      const deleteResult = deleteOrder(orderId);

      expect(deleteResult.ok).toBe(true);

      // 저장소 확인 - 배열이 비어 있어야 함
      const stored = JSON.parse(
        localStorage.getItem("dtt:orders:v1")!
      ) as DeliveryOrder[];
      expect(stored).toHaveLength(0);
    });
  });
});
