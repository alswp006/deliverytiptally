import type { DeliveryOrder, StorageResult } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";
import { sanitizeOrder } from "./sanitize";

const ORDERS_KEY = STORAGE_KEYS.ORDERS;

let errorHandler: ((error: Error) => void) | null = null;

export function setStorageErrorHandler(
  handler: ((error: Error) => void) | null
): void {
  errorHandler = handler;
}

export function safeGet(
  key: string
): StorageResult<unknown> {
  try {
    const value = localStorage.getItem(key);
    if (value === null) {
      return { ok: true, data: null };
    }
    const data = JSON.parse(value);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, reason: "INVALID" };
  }
}

export function safeSet(
  key: string,
  value: string
): StorageResult<void> {
  try {
    localStorage.setItem(key, value);
    return { ok: true, data: undefined };
  } catch (error) {
    const err = error as Error;
    if (err.name === "QuotaExceededError") {
      return { ok: false, reason: "QUOTA" };
    }
    return { ok: false, reason: "INVALID" };
  }
}

export function listOrders(): DeliveryOrder[] {
  const result = safeGet(ORDERS_KEY);

  if (!result.ok) {
    if (errorHandler) {
      errorHandler(new Error("Failed to parse orders from storage"));
    }
    return [];
  }

  const raw = result.data as unknown[];
  if (!Array.isArray(raw)) {
    return [];
  }

  const sanitized: DeliveryOrder[] = [];
  for (const item of raw) {
    const order = sanitizeOrder(item);
    if (order !== null) {
      sanitized.push(order);
    }
  }

  // 정제 후 길이가 다르면 재저장
  if (sanitized.length !== raw.length) {
    safeSet(ORDERS_KEY, JSON.stringify(sanitized));
  }

  return sanitized;
}

export function getOrder(id: string): DeliveryOrder | null {
  const orders = listOrders();
  return orders.find((order) => order.id === id) ?? null;
}
