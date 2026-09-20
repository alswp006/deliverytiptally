import { describe, it, expect } from "vitest";
import { DeliveryOrder } from "@/lib/types";

/**
 * savings.ts — calcSavings 순수 함수 테스트
 *
 * AC-1 [P0]: 픽스처로 절약액·비율·연연금을 정확히 계산한다
 * AC-2 [P0]: 주문 0건 월에서 NaN/Infinity 없이 모두 0을 반환한다
 * AC-3 [P1]: pickupAvailable=false인 주문만 있으면 savable=0이다
 * AC-4 [P1]: 월 파라미터 무효값('9월', null 등)을 안전하게 처리한다
 * AC-5 [P1]: 입력 배열을 변형하지 않는다 (불변성)
 */

describe("calcSavings — 픽업 절약 계산 로직", () => {
  /**
   * AC-1 [P0]: 픽스처로 절약액·비율·연연금을 정확히 계산한다
   *
   * 픽스처 (2026-09):
   *   주문1: foodAmount=15000, deliveryTip=3000, minOrderPadding=2000, pickupAvailable=true
   *   주문2: foodAmount=18000, deliveryTip=4000, minOrderPadding=0, pickupAvailable=false
   *
   * 예상:
   *   - savable = 3000 + 2000 = 5000 (pickup:true인 것만)
   *   - totalSpend = 15000+3000+2000 + 18000+4000+0 = 42000
   *   - ratio = 5000 / 42000 ≈ 0.1190476
   *   - yearly = 5000 * 12 = 60000
   */
  it("AC-1[P0]: 픽스처로 절약액·비율·연연금을 정확히 계산한다", async () => {
    const orders: DeliveryOrder[] = [
      {
        id: "o1",
        date: "2026-09-15",
        platform: "BAEMIN",
        foodAmount: 15000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "test",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "o2",
        date: "2026-09-20",
        platform: "COUPANG_EATS",
        foodAmount: 18000,
        deliveryTip: 4000,
        minOrderPadding: 0,
        pickupAvailable: false,
        memo: "",
        createdAt: 2,
        updatedAt: 2,
      },
    ];

    const { calcSavings } = await import("@/lib/savings");
    const result = calcSavings(orders, "2026-09");

    expect(result.savable).toBe(5000);
    expect(result.yearly).toBe(60000);
    expect(result.ratio).toBeCloseTo(5000 / 42000, 3);
  });

  /**
   * AC-1 추가 [P0]: 월별 필터링 검증
   *
   * 여러 달의 주문이 섞여 있을 때 특정 월만 정확히 계산하는지 검증
   *
   * 픽스처:
   *   2026-08: foodAmount=10000, deliveryTip=1000, minOrderPadding=500, pickupAvailable=true
   *   2026-09: foodAmount=15000, deliveryTip=2000, minOrderPadding=1000, pickupAvailable=true
   *   2026-09: foodAmount=18000, deliveryTip=3000, minOrderPadding=0, pickupAvailable=false
   *   2026-10: foodAmount=20000, deliveryTip=2500, minOrderPadding=500, pickupAvailable=true
   *
   * 2026-09만 계산하면:
   *   - savable = 2000 + 1000 = 3000 (09의 pickup:true만)
   *   - totalSpend = 15000+2000+1000 + 18000+3000+0 = 39000
   *   - ratio = 3000 / 39000 ≈ 0.0769
   *   - yearly = 3000 * 12 = 36000
   */
  it("AC-1[P0]: 월별 필터링 검증 — 여러 달 주문이 섞여 있을 때 특정 월만 계산한다", async () => {
    const orders: DeliveryOrder[] = [
      {
        id: "o_08",
        date: "2026-08-15",
        platform: "BAEMIN",
        foodAmount: 10000,
        deliveryTip: 1000,
        minOrderPadding: 500,
        pickupAvailable: true,
        memo: "",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "o_09_1",
        date: "2026-09-10",
        platform: "BAEMIN",
        foodAmount: 15000,
        deliveryTip: 2000,
        minOrderPadding: 1000,
        pickupAvailable: true,
        memo: "",
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: "o_09_2",
        date: "2026-09-20",
        platform: "COUPANG_EATS",
        foodAmount: 18000,
        deliveryTip: 3000,
        minOrderPadding: 0,
        pickupAvailable: false,
        memo: "",
        createdAt: 3,
        updatedAt: 3,
      },
      {
        id: "o_10",
        date: "2026-10-05",
        platform: "YOGIYO",
        foodAmount: 20000,
        deliveryTip: 2500,
        minOrderPadding: 500,
        pickupAvailable: true,
        memo: "",
        createdAt: 4,
        updatedAt: 4,
      },
    ];

    const { calcSavings } = await import("@/lib/savings");
    const result = calcSavings(orders, "2026-09");

    // 2026-09만 필터링: savable = 2000 + 1000 = 3000
    expect(result.savable).toBe(3000);
    expect(result.yearly).toBe(36000);

    // totalSpend = 15000+2000+1000 + 18000+3000+0 = 39000
    const totalSpend09 = 15000 + 2000 + 1000 + 18000 + 3000 + 0;
    expect(totalSpend09).toBe(39000);
    expect(result.ratio).toBeCloseTo(3000 / 39000, 3);
  });

  /**
   * AC-2 [P0]: 주문 0건 월에서 NaN/Infinity 없이 모두 0을 반환한다
   */
  it("AC-2[P0]: 주문 0건 월에서 NaN/Infinity 없이 모두 0을 반환한다", async () => {
    const { calcSavings } = await import("@/lib/savings");
    const result = calcSavings([], "2026-09");

    expect(result.savable).toBe(0);
    expect(result.ratio).toBe(0);
    expect(result.yearly).toBe(0);

    // NaN/Infinity 검증
    expect(Number.isNaN(result.savable)).toBe(false);
    expect(Number.isNaN(result.ratio)).toBe(false);
    expect(Number.isFinite(result.ratio)).toBe(true);
  });

  /**
   * AC-2 추가: 다른 달 주문만 있는 경우 (필터링 검증)
   */
  it("AC-2 variant: 다른 달 주문만 있으면 해당 월은 0을 반환한다", async () => {
    const orders: DeliveryOrder[] = [
      {
        id: "o1",
        date: "2026-08-15",
        platform: "BAEMIN",
        foodAmount: 10000,
        deliveryTip: 1000,
        minOrderPadding: 500,
        pickupAvailable: true,
        memo: "",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const { calcSavings } = await import("@/lib/savings");
    const result = calcSavings(orders, "2026-09");

    expect(result.savable).toBe(0);
    expect(result.ratio).toBe(0);
    expect(result.yearly).toBe(0);
  });

  /**
   * AC-3 [P1]: pickupAvailable=false인 주문만 있으면 savable=0이다
   */
  it("AC-3[P1]: pickupAvailable=false인 주문만 있으면 savable=0이다", async () => {
    const orders: DeliveryOrder[] = [
      {
        id: "o1",
        date: "2026-09-10",
        platform: "BAEMIN",
        foodAmount: 10000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: false,
        memo: "",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "o2",
        date: "2026-09-15",
        platform: "YOGIYO",
        foodAmount: 20000,
        deliveryTip: 4000,
        minOrderPadding: 1000,
        pickupAvailable: false,
        memo: "",
        createdAt: 2,
        updatedAt: 2,
      },
    ];

    const { calcSavings } = await import("@/lib/savings");
    const result = calcSavings(orders, "2026-09");

    expect(result.savable).toBe(0);
    // ratio와 yearly도 0이어야 함
    expect(result.ratio).toBe(0);
    expect(result.yearly).toBe(0);
  });

  /**
   * AC-4 [P1]: 월 파라미터 무효값을 안전하게 처리한다
   * - 한글 월명 '9월'
   * - null
   * - undefined
   * - 임의의 값
   *
   * 예상: throw 없이 현재 월(currentMonthKST()) 기준으로 처리
   */
  it("AC-4[P1]: 한글 월명 '9월'을 throw 없이 처리한다", async () => {
    const orders: DeliveryOrder[] = [
      {
        id: "o1",
        date: "2026-09-15",
        platform: "BAEMIN",
        foodAmount: 10000,
        deliveryTip: 1000,
        minOrderPadding: 500,
        pickupAvailable: true,
        memo: "",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const { calcSavings } = await import("@/lib/savings");
    expect(() => calcSavings(orders, "9월" as any)).not.toThrow();

    const result = calcSavings(orders, "9월" as any);
    expect(typeof result.savable).toBe("number");
    expect(typeof result.ratio).toBe("number");
    expect(typeof result.yearly).toBe("number");
  });

  it("AC-4[P1]: null 파라미터를 throw 없이 처리한다", async () => {
    const orders: DeliveryOrder[] = [
      {
        id: "o1",
        date: "2026-09-15",
        platform: "BAEMIN",
        foodAmount: 10000,
        deliveryTip: 2000,
        minOrderPadding: 500,
        pickupAvailable: true,
        memo: "",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const { calcSavings } = await import("@/lib/savings");
    expect(() => calcSavings(orders, null as any)).not.toThrow();

    const result = calcSavings(orders, null as any);
    expect(typeof result.savable).toBe("number");
    expect(typeof result.ratio).toBe("number");
    expect(typeof result.yearly).toBe("number");
  });

  it("AC-4[P1]: undefined 파라미터를 throw 없이 처리한다", async () => {
    const orders: DeliveryOrder[] = [
      {
        id: "o1",
        date: "2026-09-15",
        platform: "BAEMIN",
        foodAmount: 10000,
        deliveryTip: 2000,
        minOrderPadding: 500,
        pickupAvailable: true,
        memo: "",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const { calcSavings } = await import("@/lib/savings");
    expect(() => calcSavings(orders, undefined as any)).not.toThrow();

    const result = calcSavings(orders, undefined as any);
    expect(typeof result.savable).toBe("number");
    expect(typeof result.ratio).toBe("number");
    expect(typeof result.yearly).toBe("number");
  });

  /**
   * AC-5 [P1]: 함수가 입력 배열을 변형하지 않는다 (불변성)
   */
  it("AC-5[P1]: 입력 배열을 변형하지 않는다", async () => {
    const orders: DeliveryOrder[] = [
      {
        id: "o1",
        date: "2026-09-15",
        platform: "BAEMIN",
        foodAmount: 15000,
        deliveryTip: 3000,
        minOrderPadding: 2000,
        pickupAvailable: true,
        memo: "test",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    // 원본 복사 (깊은 복사)
    const ordersCopy = JSON.parse(JSON.stringify(orders));

    const { calcSavings } = await import("@/lib/savings");
    calcSavings(orders, "2026-09");

    // 함수 호출 후에도 배열이 동일해야 함
    expect(orders).toEqual(ordersCopy);
  });

  /**
   * 추가 테스트: 혼합된 주문들 (pickup:true & false)
   * savable과 ratio를 정확히 계산하는지 검증
   */
  it("혼합: pickup:true 여러 개 + false 여러 개", async () => {
    const orders: DeliveryOrder[] = [
      {
        id: "o1",
        date: "2026-09-10",
        platform: "BAEMIN",
        foodAmount: 10000,
        deliveryTip: 2000,
        minOrderPadding: 1000,
        pickupAvailable: true,
        memo: "",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "o2",
        date: "2026-09-15",
        platform: "COUPANG_EATS",
        foodAmount: 10000,
        deliveryTip: 2000,
        minOrderPadding: 0,
        pickupAvailable: true,
        memo: "",
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: "o3",
        date: "2026-09-20",
        platform: "YOGIYO",
        foodAmount: 10000,
        deliveryTip: 1000,
        minOrderPadding: 500,
        pickupAvailable: false,
        memo: "",
        createdAt: 3,
        updatedAt: 3,
      },
    ];

    const { calcSavings } = await import("@/lib/savings");
    const result = calcSavings(orders, "2026-09");

    // savable = (2000+1000) + (2000+0) = 5000 (o1, o2만 카운트)
    expect(result.savable).toBe(5000);
    expect(result.yearly).toBe(60000);

    // totalSpend = (10000+2000+1000) + (10000+2000+0) + (10000+1000+500) = 13000 + 12000 + 11500 = 36500
    const totalSpend = 13000 + 12000 + 11500;
    expect(result.ratio).toBeCloseTo(5000 / totalSpend, 3);
  });
});
