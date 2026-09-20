import type { DeliveryOrder, Platform } from "@/lib/types";

function toInt(value: unknown): number {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return 0;
    if (value < 0) return 0;
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const num = parseInt(value, 10);
    if (Number.isNaN(num) || num < 0) return 0;
    return num;
  }
  return 0;
}

export function sanitizeOrder(raw: unknown): DeliveryOrder | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Required fields check
  const id = obj.id;
  const date = obj.date;
  const platform = obj.platform;

  if (typeof id !== "string" || !id) {
    return null;
  }
  if (typeof date !== "string" || !date) {
    return null;
  }
  if (typeof platform !== "string" || !["BAEMIN", "COUPANG_EATS", "YOGIYO", "ETC"].includes(platform)) {
    return null;
  }

  // Numeric fields → toInt (negative → 0)
  const deliveryTip = toInt(obj.deliveryTip);
  const minOrderPadding = toInt(obj.minOrderPadding);
  const foodAmount = toInt(obj.foodAmount);

  // pickupAvailable → === true only
  const pickupAvailable = obj.pickupAvailable === true;

  // memo → string, max 30 chars
  let memo = "";
  if (typeof obj.memo === "string") {
    memo = obj.memo.substring(0, 30);
  }

  // timestamps
  const createdAt = typeof obj.createdAt === "number" ? obj.createdAt : Date.now();
  const updatedAt = typeof obj.updatedAt === "number" ? obj.updatedAt : Date.now();

  return {
    id,
    date,
    platform: platform as Platform,
    deliveryTip,
    minOrderPadding,
    foodAmount,
    pickupAvailable,
    memo,
    createdAt,
    updatedAt,
  };
}
