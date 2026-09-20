import type { OrderInput, StorageResult, DeliveryOrder } from "@/lib/types";
import { LIMITS, STORAGE_KEYS } from "@/lib/types";
import { listOrders, safeSet } from "./core";

const MAX_FOOD = 1_000_000;
const MAX_TIP = 50_000;
const MAX_PADDING = 200_000;
const MAX_MEMO = 30;

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

function todayLocal(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 저장소를 건드리지 않고 입력만 검증한다. */
export function validateOrderInput(input: OrderInput): StorageResult<void> {
  const errors: Record<string, string> = {};

  if (!isInt(input.foodAmount) || input.foodAmount <= 0) {
    errors.foodAmount = "주문 금액을 입력해주세요";
  } else if (input.foodAmount > MAX_FOOD) {
    errors.foodAmount = "주문 금액은 1,000,000원 이하로 입력해주세요";
  }

  if (!isInt(input.deliveryTip) || input.deliveryTip < 0 || input.deliveryTip > MAX_TIP) {
    errors.deliveryTip = "배달팁은 0원 이상 50,000원 이하로 입력해주세요";
  }

  if (
    !isInt(input.minOrderPadding) ||
    input.minOrderPadding < 0 ||
    input.minOrderPadding > MAX_PADDING
  ) {
    errors.minOrderPadding = "최소주문 추가금액은 0원 이상 200,000원 이하로 입력해주세요";
  }

  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    errors.date = "날짜를 선택해주세요";
  } else if (input.date > todayLocal()) {
    errors.date = "미래 날짜는 선택할 수 없어요";
  }

  if (typeof input.memo === "string" && input.memo.length > MAX_MEMO) {
    errors.memo = "메모는 30자까지 입력할 수 있어요";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, reason: "INVALID", errors };
  }
  return { ok: true, data: undefined };
}

/** contract.ts의 getOrdersFn 이름. 저장된 주문 전체를 정제해 돌려준다(손상 시 빈 배열). */
export function getOrders(): DeliveryOrder[] {
  return listOrders();
}

function persist(orders: DeliveryOrder[]): StorageResult<void> {
  return safeSet(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
}

function newId(): string {
  return "o_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

export function addOrder(input: OrderInput): StorageResult<{ id: string }> {
  const valid = validateOrderInput(input);
  if (!valid.ok) return valid;

  const orders = listOrders();
  if (orders.length >= LIMITS.MAX_ORDERS) {
    return { ok: false, reason: "LIMIT" };
  }

  const now = Date.now();
  const order: DeliveryOrder = {
    date: input.date,
    platform: input.platform,
    foodAmount: input.foodAmount,
    deliveryTip: input.deliveryTip,
    minOrderPadding: input.minOrderPadding,
    pickupAvailable: input.pickupAvailable === true,
    memo: input.memo ?? "",
    id: newId(),
    createdAt: now,
    updatedAt: now,
  };

  const saved = persist([...orders, order]);
  if (!saved.ok) return saved;
  return { ok: true, data: { id: order.id } };
}

export function updateOrder(
  id: string,
  input: Partial<OrderInput>
): StorageResult<void> {
  const orders = listOrders();
  const index = orders.findIndex((o) => o.id === id);
  if (index < 0) return { ok: false, reason: "NOT_FOUND" };

  const current = orders[index];
  const merged: DeliveryOrder = { ...current, ...input, id: current.id, createdAt: current.createdAt, updatedAt: current.updatedAt };

  const valid = validateOrderInput(merged);
  if (!valid.ok) return valid;

  const next = [...orders];
  next[index] = { ...merged, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
  return persist(next);
}

export function deleteOrder(id: string): StorageResult<void> {
  const orders = listOrders();
  const next = orders.filter((o) => o.id !== id);
  if (next.length === orders.length) return { ok: false, reason: "NOT_FOUND" };
  return persist(next);
}
