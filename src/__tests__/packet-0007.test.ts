/**
 * TDD: Monthly Summary Pure Functions — Red Phase
 *
 * Tests for src/lib/summary.ts:
 *   - summarize(orders, month): MonthlySummary
 *   - summarizePadding(orders, month): PaddingSummary
 *
 * Acceptance Criteria (each AC ≥ 1 test):
 *   AC-2: 2026-09 2건 픽스처 → orderCount:2, totalTip:7000, totalPadding:2000, totalFood:35000, totalSpend:42000, avgTip:3500, pickupSavable:5000
 *   AC-2: byPlatform 정렬 (tip 내림차순, 동점시 라벨 가나다순), ratio 소수 4자리 반올림
 *   AC-3: totalTip === 0 → 모든 ratio === 0, NaN/Infinity 없음, avgTip === 0
 *   AC-4: 빈 배열 → orderCount:0, totalTip:0, totalSpend:0, avgTip:0, pickupSavable:0, byPlatform:[], dailyTips 길이 30/전부 0
 *   AC-5: summarizePadding → 총 추가지출 2000, pickupAvailable===true 주문만 pickupSavable 합산
 */

import { describe, it, expect } from "vitest";
import type { DeliveryOrder, MonthlySummary } from "@/lib/types";
import { summarize, summarizePadding } from "@/lib/summary";

// ── Fixture: 2026-09 2건 + 2026-08 1건 ──
const fixtureOrders: DeliveryOrder[] = [
  // 2026-09-01: BAEMIN, 3000팁, 1000 minOrderPadding, pickupAvailable=false
  {
    id: "o1",
    date: "2026-09-01",
    platform: "BAEMIN",
    foodAmount: 18000,
    deliveryTip: 3000,
    minOrderPadding: 1000,
    pickupAvailable: false,
    memo: "테스트 주문 1",
    createdAt: 1000,
    updatedAt: 1000,
  },
  // 2026-09-02: YOGIYO, 4000팁, 1000 minOrderPadding, pickupAvailable=true
  {
    id: "o2",
    date: "2026-09-02",
    platform: "YOGIYO",
    foodAmount: 17000,
    deliveryTip: 4000,
    minOrderPadding: 1000,
    pickupAvailable: true,
    memo: "테스트 주문 2",
    createdAt: 2000,
    updatedAt: 2000,
  },
  // 2026-08-15: COUPANG_EATS (2026-09 집계에서 제외됨)
  {
    id: "o3",
    date: "2026-08-15",
    platform: "COUPANG_EATS",
    foodAmount: 10000,
    deliveryTip: 1000,
    minOrderPadding: 500,
    pickupAvailable: true,
    memo: "이전 달 주문",
    createdAt: 500,
    updatedAt: 500,
  },
];

describe("월별 집계 순수 함수 summarize / summarizePadding", () => {
  // ──── AC-2: 2026-09 2건 픽스처 기본 집계 ────
  it("AC-2[P0]: summarize returns correct totals for 2026-09 fixture", () => {
    const result = summarize(fixtureOrders, "2026-09");

    // 기본 집계 — 2건만 포함
    expect(result.orderCount).toBe(2);
    expect(result.totalTip).toBe(7000);
    expect(result.totalPadding).toBe(2000);
    expect(result.totalFood).toBe(35000);
    expect(result.totalSpend).toBe(42000); // foodAmount + deliveryTip
    expect(result.avgTip).toBe(3500);
    expect(result.month).toBe("2026-09");
  });

  it("AC-2[P0]: dailyTips array has correct length and first day sum", () => {
    const result = summarize(fixtureOrders, "2026-09");

    // 2026-09는 30일
    expect(result.dailyTips).toHaveLength(30);
    // 첫 번째 날(09-01): BAEMIN 3000팁
    expect(result.dailyTips[0]).toBe(3000);
    // 두 번째 날(09-02): YOGIYO 4000팁
    expect(result.dailyTips[1]).toBe(4000);
    // 나머지 날짜는 0
    for (let i = 2; i < 30; i++) {
      expect(result.dailyTips[i]).toBe(0);
    }
  });

  it("AC-2[P0]: pickupSavable sums (tip + minOrderPadding) only for pickupAvailable=true", () => {
    const result = summarize(fixtureOrders, "2026-09");

    // YOGIYO만 pickupAvailable=true: 4000 + 1000 = 5000
    expect(result.pickupSavable).toBe(5000);
  });

  // ──── AC-2: byPlatform 정렬 + ratio 반올림 ────
  it("AC-2[P0]: byPlatform sorted by tip DESC, ratio rounded to 4 decimals", () => {
    const result = summarize(fixtureOrders, "2026-09");

    // 2개 플랫폼: YOGIYO (4000팁, 4/7 ≈ 0.5714), BAEMIN (3000팁, 3/7 ≈ 0.4286)
    expect(result.byPlatform).toHaveLength(2);

    // tip 내림차순
    expect(result.byPlatform[0]).toMatchObject({
      platform: "YOGIYO",
      count: 1,
      tip: 4000,
      ratio: 0.5714,
    });
    expect(result.byPlatform[1]).toMatchObject({
      platform: "BAEMIN",
      count: 1,
      tip: 3000,
      ratio: 0.4286,
    });
  });

  // ──── AC-3: totalTip === 0 → no NaN, all ratio === 0 ────
  it("AC-3[P0]: totalTip=0 → all byPlatform.ratio are 0, no NaN/Infinity", () => {
    // 주문 3개, 모두 팁 0원
    const zeroPlatformOrders: DeliveryOrder[] = [
      {
        id: "z1",
        date: "2026-09-01",
        platform: "BAEMIN",
        foodAmount: 10000,
        deliveryTip: 0,
        minOrderPadding: 500,
        pickupAvailable: false,
        memo: "",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "z2",
        date: "2026-09-02",
        platform: "YOGIYO",
        foodAmount: 12000,
        deliveryTip: 0,
        minOrderPadding: 1000,
        pickupAvailable: true,
        memo: "",
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: "z3",
        date: "2026-09-03",
        platform: "COUPANG_EATS",
        foodAmount: 15000,
        deliveryTip: 0,
        minOrderPadding: 800,
        pickupAvailable: false,
        memo: "",
        createdAt: 3,
        updatedAt: 3,
      },
    ];

    const result = summarize(zeroPlatformOrders, "2026-09");

    // totalTip === 0
    expect(result.totalTip).toBe(0);
    expect(result.avgTip).toBe(0);

    // 모든 ratio === 0 (NaN 아님)
    for (const platform of result.byPlatform) {
      expect(platform.ratio).toBe(0);
      expect(Number.isNaN(platform.ratio)).toBe(false);
      expect(Number.isFinite(platform.ratio)).toBe(true);
    }

    // 전체 객체에 NaN/Infinity 없음
    expect(Number.isFinite(result.totalTip)).toBe(true);
    expect(Number.isFinite(result.avgTip)).toBe(true);
    expect(Number.isFinite(result.totalFood)).toBe(true);
  });

  // ──── AC-4: 빈 배열 ────
  it("AC-4[P1]: empty array → all zeros, empty byPlatform, dailyTips all 0", () => {
    const result = summarize([], "2026-09");

    expect(result.orderCount).toBe(0);
    expect(result.totalTip).toBe(0);
    expect(result.totalPadding).toBe(0);
    expect(result.totalFood).toBe(0);
    expect(result.totalSpend).toBe(0);
    expect(result.avgTip).toBe(0);
    expect(result.pickupSavable).toBe(0);
    expect(result.byPlatform).toEqual([]);

    // dailyTips는 길이 30, 전부 0
    expect(result.dailyTips).toHaveLength(30);
    expect(result.dailyTips.every((t) => t === 0)).toBe(true);
  });

  // ──── AC-5: summarizePadding ────
  it("AC-5[P1]: summarizePadding returns total padding and pickup-savable sum", () => {
    const result = summarizePadding(fixtureOrders, "2026-09");

    // 2026-09: 2건, totalPadding = 1000 + 1000 = 2000
    expect(result.totalPadding).toBe(2000);

    // pickupAvailable=true 주문만: YOGIYO (1000)
    expect(result.pickupSavable).toBe(1000); // minOrderPadding만 합산
  });

  // ──── Bonus: byPlatform 정렬 — 동점시 라벨 가나다순 ────
  it("BONUS: byPlatform tied ratio sorted by PLATFORM_ORDER (label가나다순)", () => {
    // 같은 금액 팁을 받은 주문들
    const tiedOrders: DeliveryOrder[] = [
      {
        id: "t1",
        date: "2026-09-01",
        platform: "YOGIYO",
        foodAmount: 10000,
        deliveryTip: 2000,
        minOrderPadding: 0,
        pickupAvailable: false,
        memo: "",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "t2",
        date: "2026-09-02",
        platform: "BAEMIN",
        foodAmount: 10000,
        deliveryTip: 2000,
        minOrderPadding: 0,
        pickupAvailable: false,
        memo: "",
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: "t3",
        date: "2026-09-03",
        platform: "ETC",
        foodAmount: 10000,
        deliveryTip: 2000,
        minOrderPadding: 0,
        pickupAvailable: false,
        memo: "",
        createdAt: 3,
        updatedAt: 3,
      },
      {
        id: "t4",
        date: "2026-09-04",
        platform: "COUPANG_EATS",
        foodAmount: 10000,
        deliveryTip: 2000,
        minOrderPadding: 0,
        pickupAvailable: false,
        memo: "",
        createdAt: 4,
        updatedAt: 4,
      },
    ];

    const result = summarize(tiedOrders, "2026-09");

    // 모두 ratio === 0.25, 정렬은 PLATFORM_ORDER: ETC, BAEMIN, YOGIYO, COUPANG_EATS
    expect(result.byPlatform).toHaveLength(4);
    expect(result.byPlatform.map((p) => p.platform)).toEqual([
      "ETC",
      "BAEMIN",
      "YOGIYO",
      "COUPANG_EATS",
    ]);
  });

  // ──── Edge case: 월 경계 필터링 ────
  it("BONUS: correctly filters by month (YYYY-MM format)", () => {
    const mixedMonthOrders: DeliveryOrder[] = [
      {
        id: "m1",
        date: "2026-08-31",
        platform: "BAEMIN",
        foodAmount: 10000,
        deliveryTip: 1000,
        minOrderPadding: 0,
        pickupAvailable: false,
        memo: "",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "m2",
        date: "2026-09-01",
        platform: "YOGIYO",
        foodAmount: 20000,
        deliveryTip: 2000,
        minOrderPadding: 500,
        pickupAvailable: true,
        memo: "",
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: "m3",
        date: "2026-10-01",
        platform: "COUPANG_EATS",
        foodAmount: 15000,
        deliveryTip: 1500,
        minOrderPadding: 0,
        pickupAvailable: false,
        memo: "",
        createdAt: 3,
        updatedAt: 3,
      },
    ];

    const sep2026 = summarize(mixedMonthOrders, "2026-09");
    const aug2026 = summarize(mixedMonthOrders, "2026-08");
    const oct2026 = summarize(mixedMonthOrders, "2026-10");

    // 2026-09: 1건만
    expect(sep2026.orderCount).toBe(1);
    expect(sep2026.totalTip).toBe(2000);
    expect(sep2026.byPlatform[0].platform).toBe("YOGIYO");

    // 2026-08: 1건만
    expect(aug2026.orderCount).toBe(1);
    expect(aug2026.totalTip).toBe(1000);

    // 2026-10: 1건만
    expect(oct2026.orderCount).toBe(1);
    expect(oct2026.totalTip).toBe(1500);
  });

  // ──── Bonus: ratio 정확도 (4자리) ────
  it("BONUS: ratio rounding to 4 decimal places (not 2, not 3)", () => {
    // 1/3 = 0.3333..., 반올림하면 0.3333 (4자리)
    const oneThirdOrders: DeliveryOrder[] = [
      {
        id: "r1",
        date: "2026-09-01",
        platform: "BAEMIN",
        foodAmount: 10000,
        deliveryTip: 1000,
        minOrderPadding: 0,
        pickupAvailable: false,
        memo: "",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "r2",
        date: "2026-09-02",
        platform: "YOGIYO",
        foodAmount: 10000,
        deliveryTip: 1000,
        minOrderPadding: 0,
        pickupAvailable: false,
        memo: "",
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: "r3",
        date: "2026-09-03",
        platform: "COUPANG_EATS",
        foodAmount: 10000,
        deliveryTip: 1000,
        minOrderPadding: 0,
        pickupAvailable: false,
        memo: "",
        createdAt: 3,
        updatedAt: 3,
      },
    ];

    const result = summarize(oneThirdOrders, "2026-09");

    // 1/3 = 0.3333... → 0.3333 (소수 4자리)
    for (const platform of result.byPlatform) {
      expect(platform.ratio).toBeCloseTo(0.3333, 4);
    }
  });
});
