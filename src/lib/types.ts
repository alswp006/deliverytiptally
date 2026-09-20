// Domain types — 순수 타입/상수 모듈 (런타임 로직 없음)

export type Platform = "BAEMIN" | "COUPANG_EATS" | "YOGIYO" | "ETC";

export const PLATFORM_LABEL: Record<Platform, string> = {
  BAEMIN: "배달의민족",
  COUPANG_EATS: "쿠팡이츠",
  YOGIYO: "요기요",
  ETC: "기타",
};

/** 라벨 가나다순 */
export const PLATFORM_ORDER: Platform[] = ["ETC", "BAEMIN", "YOGIYO", "COUPANG_EATS"];

export interface DeliveryOrder {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  platform: Platform;
  foodAmount: number;
  deliveryTip: number;
  minOrderPadding: number;
  pickupAvailable: boolean;
  memo: string;
  createdAt: number;
  updatedAt: number;
}

export type OrderInput = Omit<DeliveryOrder, "id" | "createdAt" | "updatedAt">;

export interface AppSettings {
  monthlyTipGoal: number;
  defaultPlatform: Platform;
  goalAlertedMonths: string[];
  reportUnlockedMonths: string[];
  reviewRequested: boolean;
  schemaVersion: 1;
}

export interface MonthlySummary {
  /** YYYY-MM */
  month: string;
  orderCount: number;
  totalTip: number;
  totalPadding: number;
  totalFood: number;
  totalSpend: number;
  avgTip: number;
  pickupSavable: number;
  byPlatform: { platform: Platform; count: number; tip: number; ratio: number }[];
  dailyTips: number[];
}

export type StorageFailReason = "LIMIT" | "QUOTA" | "INVALID" | "NOT_FOUND";

export type StorageResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: StorageFailReason; errors?: Record<string, string> };

export const LIMITS = {
  MAX_ORDERS: 2000,
} as const;

export const STORAGE_KEYS = {
  ORDERS: "dtt:orders:v1",
  SETTINGS: "dtt:settings:v1",
  ONBOARD: "dtt:onboard:v1",
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  monthlyTipGoal: 30000,
  defaultPlatform: "BAEMIN",
  goalAlertedMonths: [],
  reportUnlockedMonths: [],
  reviewRequested: false,
  schemaVersion: 1,
};
