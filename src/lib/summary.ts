import type { DeliveryOrder, MonthlySummary, Platform } from "@/lib/types";
import { PLATFORM_ORDER } from "@/lib/types";
import { daysInMonth } from "@/lib/date";

export interface PaddingSummary {
  month: string;
  totalPadding: number;
  /** 최소주문 추가지출이 있는 주문 건수 */
  count: number;
  /** 포장 가능 주문의 추가지출 합계 */
  pickupSavable: number;
  byPlatform: { platform: Platform; count: number; padding: number }[];
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function inMonth(orders: DeliveryOrder[], month: string): DeliveryOrder[] {
  return (Array.isArray(orders) ? orders : []).filter(
    (o) => o && typeof o.date === "string" && o.date.slice(0, 7) === month,
  );
}

function orderIdx(p: Platform): number {
  const i = PLATFORM_ORDER.indexOf(p);
  return i < 0 ? PLATFORM_ORDER.length : i;
}

export function summarize(orders: DeliveryOrder[], month: string): MonthlySummary {
  const list = inMonth(orders, month);
  const dailyTips = new Array<number>(daysInMonth(month)).fill(0);
  let totalTip = 0;
  let totalPadding = 0;
  let totalFood = 0;
  let pickupSavable = 0;
  const plat = new Map<Platform, { count: number; tip: number }>();

  for (const o of list) {
    const tip = num(o.deliveryTip);
    const pad = num(o.minOrderPadding);
    totalTip += tip;
    totalPadding += pad;
    totalFood += num(o.foodAmount);
    if (o.pickupAvailable === true) pickupSavable += tip + pad;
    const day = Number(o.date.slice(8, 10));
    if (day >= 1 && day <= dailyTips.length) dailyTips[day - 1] += tip;
    const cur = plat.get(o.platform) ?? { count: 0, tip: 0 };
    cur.count += 1;
    cur.tip += tip;
    plat.set(o.platform, cur);
  }

  const byPlatform = [...plat.entries()]
    .map(([platform, v]) => ({
      platform,
      count: v.count,
      tip: v.tip,
      ratio: totalTip > 0 ? Math.round((v.tip / totalTip) * 10000) / 10000 : 0,
    }))
    .sort((a, b) => b.tip - a.tip || orderIdx(a.platform) - orderIdx(b.platform));

  return {
    month,
    orderCount: list.length,
    totalTip,
    totalPadding,
    totalFood,
    totalSpend: totalFood + totalTip,
    avgTip: list.length > 0 ? Math.round(totalTip / list.length) : 0,
    pickupSavable,
    byPlatform,
    dailyTips,
  };
}

export function summarizePadding(orders: DeliveryOrder[], month: string): PaddingSummary {
  const list = inMonth(orders, month);
  let totalPadding = 0;
  let count = 0;
  let pickupSavable = 0;
  const plat = new Map<Platform, { count: number; padding: number }>();

  for (const o of list) {
    const pad = num(o.minOrderPadding);
    totalPadding += pad;
    if (pad > 0) count += 1;
    if (o.pickupAvailable === true) pickupSavable += pad;
    if (pad > 0) {
      const cur = plat.get(o.platform) ?? { count: 0, padding: 0 };
      cur.count += 1;
      cur.padding += pad;
      plat.set(o.platform, cur);
    }
  }

  const byPlatform = [...plat.entries()]
    .map(([platform, v]) => ({ platform, ...v }))
    .sort((a, b) => b.padding - a.padding || orderIdx(a.platform) - orderIdx(b.platform));

  return { month, totalPadding, count, pickupSavable, byPlatform };
}
