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
