# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** (구현: 패킷 0001) */
export type Order = { id: string; date: string; amountKrw: number; memo?: string; category: string; source: "direct" | "delivery" };

/** (구현: 패킷 0001) */
export type AppSettings = { monthlyGoalKrw: number; currency: "KRW" | "USD"; locale: "ko-KR" | "en-US" };

/** (구현: 패킷 0001) */
export type ValidationError = { field: string; message: string };

/** (구현: 패킷 0001) */
export type MonthlySummary = { year: number; month: number; totalKrw: number; count: number; orders: Order[]; percentOfGoal: number };

/** (구현: 패킷 0005) */
export type getOrdersFn = () => Order[];

/** (구현: 패킷 0005) */
export type addOrderFn = (data: Omit<Order, "id">) => Order;

/** (구현: 패킷 0005) */
export type updateOrderFn = (id: string, data: Partial<Omit<Order, "id">>) => Order | null;

/** (구현: 패킷 0005) */
export type deleteOrderFn = (id: string) => boolean;

/** (구현: 패킷 0005) */
export type validateOrderInputFn = (data: Partial<Order>) => ValidationError[];

/** (구현: 패킷 0006) */
export type getSettingsFn = () => AppSettings;

/** (구현: 패킷 0006) */
export type updateSettingsFn = (data: Partial<AppSettings>) => AppSettings;

/** (구현: 패킷 0006) */
export type validateGoalFn = (amountKrw: number) => ValidationError[];

/** (구현: 패킷 0003) */
export type formatAmountFn = (amount: number, opts?: { currency?: string; compact?: boolean }) => string;

/** (구현: 패킷 0003) */
export type formatPercentFn = (value: number, decimals?: number) => string;

/** (구현: 패킷 0007) */
export type summarizeFn = (orders: Order[], year: number, month: number) => MonthlySummary;

/** (구현: 패킷 0007) */
export type summarizePaddingFn = (orders: Order[]) => { yearMonths: Array<{ year: number; month: number }> };

/** (구현: 패킷 0008) */
export type calculateSavingsFn = (orders: Order[], targetKrw?: number) => { savedKrw: number; pickupCount: number; estimatedRewardKrw: number };

/** (구현: 패킷 0009) */
export type logClickFn = (event: { action: string; page: string; metadata?: Record<string, unknown> }) => void;

/** (구현: 패킷 0009) */
export type logImpressionFn = (event: { page: string; componentName: string; metadata?: Record<string, unknown> }) => void;

```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
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

/** 화면 간 navigate state 계약 — 경로별 location.state 형태 */
export interface RouteState {
  "/": Record<string, never> | null;
  "/orders/new": Record<string, never> | null;
  "/orders": Record<string, never> | null;
  /** order는 수정 대상. state가 없으면(직접 진입) null */
  "/orders/:id/edit": { order?: DeliveryOrder } | null;
  "/savings": Record<string, never> | null;
  "/settings/goal": Record<string, never> | null;
  "/report": Record<string, never> | null;
}

```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    analytics.ts
    contract.ts
    date.ts
    format.ts
    review.ts
    savings.ts
    share.ts
    storage/
    storage.ts
    summary.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    GoalSettings.tsx
    Home.tsx
    OrderEdit.tsx
    OrderList.tsx
    OrderNew.tsx
    Report.tsx
    Savings.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- analytics.ts: export type LogFields = Record<string, string | number | boolean | null>; export const DWELL_MS = 3000; export function fireAndForget(call: () => unknown): void; export function logScreen(page: string, extra?: LogFields): void; export function logClick(name: string, extra?: LogFields): void; export function logImpression(name: string, extra?: LogFields): void; export function useScreenLog(page: string): void
- contract.ts: export type Order =; export type AppSettings =; export type ValidationError =; export type MonthlySummary =; export type getOrdersFn = () => Order[]; export type addOrderFn = (data: Omit<Order, "id">) => Order; export type updateOrderFn = (id: string, data: Partial<Omit<Order, "id">>) => Order | null; export type deleteOrderFn = (id: string) => boolean
- date.ts: export function todayKST(): string; export function currentMonthKST(): string; export function isValidMonthKey(v: unknown): v is string; export function normalizeMonthParam(v: string | null | undefined): string; export function daysInMonth(month: string): number; export function monthOf(date: string): string; export function shiftMonth(month: string, delta: number): string; export function isFutureMonth(month: string): boolean
- format.ts: export function formatKRW(n: number): string; export function formatPercent(ratio: number, digits = 0): string; export function formatMonthLabel(month: string): string; export function formatDayLabel(date: string): string; export function formatAmount(amount: number, opts?:
- review.ts: export function requestReviewOnce(key: string = REVIEW_REQUESTED_KEY): void
- savings.ts: export interface SavingsResult; export function calcSavings(orders: DeliveryOrder[], month: string): SavingsResult; export interface SavingsSummary; export function calculateSavings(orders: DeliveryOrder[], targetKrw?: number): SavingsSummary
- share.ts: export interface ShareAppOptions; export async function shareApp(opts: ShareAppOptions): Promise<void>
- storage/core.ts: export function setStorageErrorHandler( handler: ((error: Error) => void) | null ): void; export function safeGet( key: string ): StorageResult<unknown>; export function safeSet( key: string, value: string ): StorageResult<void>; export function listOrders(): DeliveryOrder[]; export function getOrder(id: string): DeliveryOrder | null
- storage/orders.ts: export function validateOrderInput(input: OrderInput): StorageResult<void>; export function getOrders(): DeliveryOrder[]; export function addOrder(input: OrderInput): StorageResult<; export function updateOrder( id: string, input: Partial<OrderInput> ): StorageResult<void>; export function deleteOrder(id: string): StorageResult<void>
- storage/sanitize.ts: export function sanitizeOrder(raw: unknown): DeliveryOrder | null
- storage/settings.ts: export function getSettings(): AppSettings; export function saveSettings( patch: Partial<AppSettings> ): StorageResult<AppSettings>; export function markGoalAlerted(month: string): StorageResult<AppSettings>; export function markReportUnlocked(month: string): StorageResult<AppSettings>; export function isReportUnlocked(month: string): boolean; export function markReviewRequested(): StorageResult<AppSettings>; export function setDefaultPlatform(p: Platform): StorageResult<AppSettings>; export function validateGoal(value: number): StorageResult<void>
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- summary.ts: export interface PaddingSummary; export function summarize(orders: DeliveryOrder[], month: string): MonthlySummary; export function summarizePadding(orders: DeliveryOrder[], month: string): PaddingSummary
- types.ts: export type Platform = "BAEMIN" | "COUPANG_EATS" | "YOGIYO" | "ETC"; export const PLATFORM_LABEL: Record<Platform, string> =; export const PLATFORM_ORDER: Platform[] = ["ETC", "BAEMIN", "YOGIYO", "COUPANG_EATS"]; export interface DeliveryOrder; export type OrderInput = Omit<DeliveryOrder, "id" | "createdAt" | "updatedAt">; export interface AppSettings; export interface MonthlySummary; export type StorageFailReason = "LIMIT" | ...
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 엔티티 타입 + 상수 정의 (types.ts) (files: src/lib/types.ts)
- 0002: KST 날짜 유틸 (date.ts) (files: src/lib/date.ts)
- 0003: 금액/퍼센트 포맷 유틸 + RouteState 계약 (files: src/lib/types.ts, src/lib/format.ts)
- 0004: localStorage 안전 읽기/쓰기 래퍼 + 레코드 정제 (files: src/lib/storage/core.ts, src/lib/storage/sanitize.ts)
- 0005: 주문 CRUD + 입력 검증 (한도·쿼터 에러) (files: src/lib/storage/orders.ts)
- 0006: AppSettings 저장소 + 목표 검증 (files: src/lib/storage/settings.ts)
- 0007: 월별 집계 순수 함수 summarize / summarizePadding (files: src/lib/summary.ts)
- 0008: 픽업 절약 계산 로직 (savings.ts) (files: src/lib/savings.ts)