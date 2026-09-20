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
