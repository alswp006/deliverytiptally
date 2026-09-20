import type { DeliveryOrder } from "@/lib/types";
import { normalizeMonthParam } from "@/lib/date";

export interface SavingsResult {
  /** 포장했다면 아낄 수 있었던 금액 (배달팁 + 최소주문 추가지출) */
  savable: number;
  /** savable / 총지출 (0~1) */
  ratio: number;
  /** savable * 12 */
  yearly: number;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function calcSavings(orders: DeliveryOrder[], month: string): SavingsResult {
  const key = normalizeMonthParam(month);
  const list = Array.isArray(orders) ? orders : [];

  let savable = 0;
  let totalSpend = 0;
  for (const o of list) {
    if (!o || typeof o.date !== "string" || o.date.slice(0, 7) !== key) continue;
    const tip = num(o.deliveryTip);
    const pad = num(o.minOrderPadding);
    totalSpend += num(o.foodAmount) + tip + pad;
    if (o.pickupAvailable === true) savable += tip + pad;
  }

  const ratio = totalSpend === 0 ? 0 : savable / totalSpend;
  return {
    savable,
    ratio: Number.isFinite(ratio) ? ratio : 0,
    yearly: savable * 12,
  };
}

export interface SavingsSummary {
  /** 포장했다면 아꼈을 금액 (픽업 가능 주문의 배달팁 + 최소주문 추가금 합) */
  savedKrw: number;
  /** 픽업 가능으로 기록된 주문 건수 */
  pickupCount: number;
  /** 12개월 환산 추정액. targetKrw(연 목표)가 있으면 그 이상 잡지 않는다 */
  estimatedRewardKrw: number;
}

/** 전달된 주문 전체를 대상으로 절약액을 계산한다(월 필터는 호출부 몫). 계약: contract.ts calculateSavingsFn */
export function calculateSavings(orders: DeliveryOrder[], targetKrw?: number): SavingsSummary {
  const list = Array.isArray(orders) ? orders : [];
  let savedKrw = 0;
  let pickupCount = 0;
  for (const o of list) {
    if (!o || o.pickupAvailable !== true) continue;
    savedKrw += num(o.deliveryTip) + num(o.minOrderPadding);
    pickupCount += 1;
  }
  const yearly = savedKrw * 12;
  const cap = num(targetKrw);
  return {
    savedKrw,
    pickupCount,
    estimatedRewardKrw: cap > 0 ? Math.min(yearly, cap) : yearly,
  };
}
