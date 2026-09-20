# TASK — DeliveryTipTally

> **AC ID 표기 규칙(고정)**: 기능 AC는 `F<번호>-AC-<번호>`, 전역 AC는 `AC-G<번호>`. 범위 표기(`AC-1~8`) 금지 — 모든 Covers는 개별 ID를 전부 나열한다.

---

## Epic 1. 타입 정의 (Types & Contracts)

**Risk Assessment**
- Complexity: Low
- Risk factors: `RouteState`가 없으면 페이지 간 `location.state` 형태가 제각각이 되어 F5-AC-8(잘못된 월 파라미터), S4(order 전달) 계약이 깨진다. `Platform` 라벨/정렬 기준이 분산 정의되면 F6-AC-7(동점 가나다순) 판정이 화면마다 달라진다.
- Mitigation: 모든 엔티티·`StorageResult`·`RouteState`를 런타임 코드 없는 단일 모듈에 먼저 고정하고, 이후 모든 패킷이 이 모듈만 import 하도록 강제한다.

### Task 1.1 엔티티 타입 + 상수 정의
- Description: `Platform` 유니온과 `PLATFORM_LABEL`, `PLATFORM_ORDER`(라벨 가나다순), `DeliveryOrder`, `AppSettings`, `MonthlySummary`, `StorageFailReason`, `StorageResult<T>`, `OrderInput`(id/createdAt/updatedAt 제외), 검증 상한 상수 `LIMITS = { MAX_ORDERS: 2000, FOOD_MAX: 1000000, TIP_MAX: 50000, PADDING_MAX: 200000, MEMO_MAX: 30, GOAL_MIN: 1000, GOAL_MAX: 1000000 }`, `STORAGE_KEYS = { ORDERS:'dtt:orders:v1', SETTINGS:'dtt:settings:v1', ONBOARD:'dtt:onboard:v1', SCROLL:'dtt:scroll:/orders' }`, `DEFAULT_SETTINGS` 상수를 정의한다. 런타임 로직 없음(타입 + 상수만).
- DoD:
  - `npx tsc --noEmit` 0 에러.
  - `PLATFORM_LABEL`에 4종(배달의민족/쿠팡이츠/요기요/기타) 매핑 존재.
  - `PLATFORM_ORDER === ['ETC','BAEMIN','YOGIYO','COUPANG_EATS']`(기타 ㄱ → 배달의민족 ㅂ → 요기요 ㅇ → 쿠팡이츠 ㅋ), F6-AC-7 동점 처리에 사용.
  - `StorageResult<T>`가 `{ ok:true; data:T } | { ok:false; reason:StorageFailReason; errors?:Record<string,string> }` 판별 유니온.
  - `DEFAULT_SETTINGS`가 `{ monthlyTipGoal:30000, defaultPlatform:'BAEMIN', goalAlertedMonths:[], reportUnlockedMonths:[], reviewRequested:false, schemaVersion:1 }`.
  - 파일에 `#RRGGBB` 리터럴 0개.
- Covers: [F1-AC-8, F6-AC-7, AC-G4, AC-G6]
- Files: `src/lib/types.ts`
- Depends on: none

### Task 1.2 RouteState 계약 + 날짜/포맷 유틸
- Description: 화면 간 `location.state` 계약을 `RouteState`로 정의하고 KST 날짜 유틸·금액 포맷 유틸을 구현한다.
  ```ts
  export type RouteState = {
    "/": { savedOrderId?: string } | null;
    "/orders/new": { presetDate?: string } | null;
    "/orders": { focusMonth?: string } | { deletedId?: string } | null;
    "/orders/:id/edit": { order: DeliveryOrder } | null;
    "/savings": { month: string } | null;
    "/settings/goal": { currentGoal: number } | null;
    "/report": { month: string } | null;
  };
  ```
  유틸: `todayKST()`, `currentMonthKST()`, `isValidMonthKey(v): v is string`(`/^\d{4}-\d{2}$/`), `normalizeMonthParam(v): string`(무효 시 `currentMonthKST()`), `daysInMonth(month)`, `monthOf(date)`, `shiftMonth(month, delta)`, `isFutureMonth(month)`, `isFutureDate(date)`, `formatKRW(n)`(`toLocaleString('ko-KR')+'원'`, 비정상값 `0원`), `formatMonthLabel('2026-09')→'2026년 9월'`, `formatDayLabel('2026-09-21')→'9월 21일'`, `formatPercent(ratio, digits)`(비정상값 `0%`).
- DoD:
  - `normalizeMonthParam("9월") === currentMonthKST()`, `normalizeMonthParam(null) === currentMonthKST()`, `normalizeMonthParam("2026-09") === "2026-09"`.
  - `daysInMonth("2026-09") === 30`, `daysInMonth("2026-02") === 28`.
  - `formatKRW(NaN) === "0원"`, `formatKRW(null as any) === "0원"`, `formatKRW(18000) === "18,000원"`.
  - `formatPercent(Infinity,1) === "0%"`, `formatPercent(0.119,1) === "11.9%"`.
  - `Array.prototype.at` / `Object.groupBy` / `structuredClone` / `String.replaceAll` / lookbehind 정규식 미사용, 외부 네트워크 호출 0개.
  - `npx tsc --noEmit` 0 에러.
- Covers: [F5-AC-8, F5-AC-7, AC-G6, AC-G7]
- Files: `src/lib/types.ts`(RouteState 추가), `src/lib/date.ts`, `src/lib/format.ts`
- Depends on: Task 1.1

---

## Epic 2. 데이터 레이어 (Storage · Validation · Aggregation)

**Risk Assessment**
- Complexity: Medium
- Risk factors: (1) `QuotaExceededError` 미포착 시 화면 크래시(F1-AC-6), (2) 손상 JSON/레코드가 화면까지 흘러가 `NaN`·`undefined` 노출(F1-AC-7, F5-AC-4, F6-AC-6), (3) 2,000건 상한 미적용 시 저장소 팽창(F1-AC-5), (4) `totalTip === 0`일 때 `ratio` NaN(F1-AC-3).
- Mitigation: 읽기 정제 → 쓰기(try/catch + 한도) → 집계(순수 함수) 3패킷으로 분리. 집계는 정제된 배열만 입력받는 순수 함수라 방어 로직이 한 곳에 모인다. UI 패킷은 이 레이어 완료 후 시작.

### Task 2.1 localStorage 안전 읽기/쓰기 + 레코드 정제
- Description: 저수준 저장소 래퍼와 레코드 정제기를 구현한다.
  - `safeGet(key): { ok:true; raw:string|null } | { ok:false; reason:'INVALID' }` — try/catch, `console.error` 호출 금지.
  - `safeSet(key, value): StorageResult<true>` — `QuotaExceededError`(name 체크 포함) → `{ ok:false, reason:'QUOTA' }`.
  - `sanitizeOrder(raw: unknown): DeliveryOrder | null` — 객체가 아니거나 `id`/`date`/`platform` 누락·형식 불일치면 `null`. 숫자 필드는 `toInt(v)`(`null`/`"2000"`/`NaN`/음수 → `0`), `pickupAvailable`은 `=== true`만 `true`(문자열 `"yes"` → `false`), `memo`는 문자열 아니면 `""` + 30자 절단.
  - `listOrders(): DeliveryOrder[]` — parse 실패 시 `[]` + `setStorageErrorHandler(fn)`으로 등록된 핸들러 1회 호출. 정제 후 길이가 원본과 다르면 정제본을 즉시 `safeSet`으로 재저장.
  - `getOrder(id): DeliveryOrder | null`.
- DoD:
  - `dtt:orders:v1 = "{{broken"` → `listOrders() === []`, throw 0회, `console.error` 0회, 에러 핸들러 1회 호출.
  - F1-AC-7 픽스처(`[정상1건, {"id":"o_2"}, "junk", null]`) → 길이 1(`id==='o_1'`) 반환 + 저장소가 1건 배열로 덮어써짐.
  - `sanitizeOrder({id:'x',date:'2026-09-01',platform:'BAEMIN',deliveryTip:null,minOrderPadding:"2000",foodAmount:18000,pickupAvailable:"yes"})` → `{deliveryTip:0, minOrderPadding:0, pickupAvailable:false}`.
  - `minOrderPadding:-1000` → `0`으로 정제.
  - `setItem` 스텁이 `QuotaExceededError`를 던질 때 `safeSet` → `{ok:false, reason:'QUOTA'}`.
  - 빈 저장소에서 `listOrders()` → `[]`.
- Covers: [F1-AC-6, F1-AC-7, F1-AC-8, F5-AC-4, F6-AC-6, AC-G9]
- Files: `src/lib/storage/core.ts`, `src/lib/storage/sanitize.ts`
- Depends on: Task 1.2

### Task 2.2 주문 CRUD + 입력 검증 (한도·쿼터 에러 포함)
- Description: `validateOrderInput`, `addOrder`, `updateOrder`, `deleteOrder`를 구현한다.
  - `validateOrderInput(input): StorageResult<OrderInput>` — 고정 메시지: `foodAmount` 빈값/0 → `"주문 금액을 입력해주세요"`, 상한 초과 → `"주문 금액은 1,000,000원 이하로 입력해주세요"`, `deliveryTip` 범위 밖 → `"배달팁은 0원 이상 50,000원 이하로 입력해주세요"`, `minOrderPadding` 범위 밖 → `"최소주문 추가금액은 0원 이상 200,000원 이하로 입력해주세요"`, 미래 날짜 → `"미래 날짜는 선택할 수 없어요"`, 메모 30자 초과 → `"메모는 30자까지 입력할 수 있어요"`.
  - `addOrder(input)` — 검증 → **저장 건수 ≥ `LIMITS.MAX_ORDERS`(2,000)면 `{ok:false, reason:'LIMIT'}`로 즉시 반환(저장소 불변, throw 금지)** → `id = 'o_' + Date.now() + '_' + Math.random().toString(36).slice(2,8)`, `createdAt === updatedAt = Date.now()` → `safeSet`. **`safeSet`이 `QUOTA`를 반환하면 그대로 `{ok:false, reason:'QUOTA'}`를 전파하고 예외는 절대 throw하지 않으며 `console.error`를 호출하지 않는다.**
  - `updateOrder(id, patch)` — 대상 없으면 `{ok:false, reason:'NOT_FOUND'}`, 성공 시 `updatedAt` 갱신.
  - `deleteOrder(id)` — 대상 없으면 `NOT_FOUND`, 성공 시 잔여 배열 저장.
- DoD:
  - **F1-AC-1**: 빈 저장소에서 지정 입력으로 `addOrder` → `{ok:true}`, `id`가 `"o_"`로 시작, `createdAt === updatedAt`, `JSON.parse(localStorage['dtt:orders:v1']).length === 1`.
  - **F1-AC-4**: `{foodAmount:0, deliveryTip:60000, ...}` → `{ok:false, reason:'INVALID', errors:{foodAmount:"주문 금액을 입력해주세요", deliveryTip:"배달팁은 0원 이상 50,000원 이하로 입력해주세요"}}` 이고 `dtt:orders:v1` 값이 호출 전과 바이트 단위로 동일.
  - **F1-AC-5(저장 한도 초과 에러)**: 2,000건이 저장된 상태에서 유효 입력으로 `addOrder` 호출 → 반환값 `{ok:false, reason:'LIMIT'}`, 저장 건수 2,000 유지, 예외 throw 0회.
  - **F1-AC-6(QuotaExceededError 처리)**: `localStorage.setItem`이 `QuotaExceededError`를 던지도록 스텁된 상태에서 유효 입력으로 `addOrder` 호출 → 반환값 `{ok:false, reason:'QUOTA'}`, 예외가 호출자에게 전파되지 않음, `console.error` 0회.
  - `updateOrder('o_none', {})` → `{ok:false, reason:'NOT_FOUND'}`; `deleteOrder('o_none')` → `{ok:false, reason:'NOT_FOUND'}`.
- Covers: [F1-AC-1, F1-AC-4, F1-AC-5, F1-AC-6]
- Files: `src/lib/storage/orders.ts`
- Depends on: Task 2.1

### Task 2.3 설정(AppSettings) 저장소 + 목표 검증
- Description: `getSettings()`, `saveSettings(patch)` 및 편의 함수 `markGoalAlerted(month)`, `markReportUnlocked(month)`, `isReportUnlocked(month)`, `markReviewRequested()`, `setDefaultPlatform(p)`, `validateGoal(value)`를 구현한다.
  - `getSettings()` — 값 없음/parse 실패/`schemaVersion !== 1`이면 `DEFAULT_SETTINGS` 반환(주문 데이터는 건드리지 않음).
  - `goalAlertedMonths`/`reportUnlockedMonths`는 중복 제거 후 최근 24개만 유지(초과분은 오래된 순 제거).
  - `validateGoal(v)` — `< 1000` → `"목표 금액은 1,000원 이상으로 입력해주세요"`, `> 1000000` → `"목표 금액은 1,000,000원 이하로 입력해주세요"`.
- DoD:
  - **F1-AC-8(settings)**: 빈 저장소에서 `getSettings()`가 `{monthlyTipGoal:30000, defaultPlatform:'BAEMIN', goalAlertedMonths:[], reportUnlockedMonths:[], reviewRequested:false, schemaVersion:1}` 반환.
  - `dtt:settings:v1 = "{{broken"` → 기본값 반환, throw 0회, `console.error` 0회.
  - `schemaVersion:0` 저장값 → 기본값 재초기화되고 `dtt:orders:v1`은 변경되지 않음.
  - **F8-AC-2(해제 저장 경로)**: `markReportUnlocked('2026-09')` 후 `isReportUnlocked('2026-09') === true`이며 재호출해도 중복 없이 길이 1 유지. 25개월 연속 호출 시 길이 24, 가장 오래된 월 제거.
  - **F8-AC-4(리뷰 플래그)**: `markReviewRequested()` 후 `dtt:settings:v1.reviewRequested === true`.
  - **F7-AC-5 / F7-AC-6**: `validateGoal(0)` → `"목표 금액은 1,000원 이상으로 입력해주세요"`, `validateGoal(2000000)` → `"목표 금액은 1,000,000원 이하로 입력해주세요"`, 두 경우 모두 저장 호출 없음.
- Covers: [F1-AC-8, F7-AC-5, F7-AC-6, F8-AC-2, F8-AC-4]
- Files: `src/lib/storage/settings.ts`
- Depends on: Task 2.1

### Task 2.4 월별 집계 순수 함수 `summarize` / `summarizePadding`
- Description: `summarize(orders, month): MonthlySummary` 순수 함수 — 월 필터 → 합계 → `avgTip = orderCount===0 ? 0 : Math.round(totalTip/orderCount)` → `pickupSavable`(`pickupAvailable===true`인 주문의 `deliveryTip+minOrderPadding` 합) → `byPlatform`(tip 내림차순, `ratio = totalTip===0 ? 0 : Number((tip/totalTip).toFixed(4))`) → `dailyTips`(길이 `daysInMonth`, 0 초기화 후 누적). 추가로 `summarizePadding(orders, month)` → `{ total, count(padding>0 건수), avg(count===0?0:Math.round(total/count)), topPlatform: Platform|null, byPlatform: Array<{platform, amount, ratio}> }`, 동점 시 `PLATFORM_ORDER` 기준 앞선 1개만.
- DoD:
  - **F1-AC-2**: 지정 픽스처 → `{orderCount:2, totalTip:7000, totalPadding:2000, totalFood:35000, totalSpend:42000, avgTip:3500, pickupSavable:5000}`, `dailyTips.length===30`, `dailyTips[0]===3000`.
  - **F1-AC-3**: `byPlatform === [{platform:'YOGIYO',count:1,tip:4000,ratio:0.5714},{platform:'BAEMIN',count:1,tip:3000,ratio:0.4286}]`; `totalTip===0`인 월은 모든 `ratio === 0`이고 결과 JSON에 `NaN` 없음.
  - `summarize([], '2026-09')` → 모든 수치 0, `dailyTips.length === 30`.
  - **F6-AC-1 / F6-AC-2**: `[{padding:2000,BAEMIN},{padding:3000,BAEMIN},{padding:0,YOGIYO}]` → `{total:5000, count:2, avg:2500, topPlatform:'BAEMIN'}`; `count===0`이면 `avg===0`.
  - **F6-AC-7**: 두 플랫폼 padding이 각 3000 동점일 때 `topPlatform`이 `PLATFORM_ORDER` 기준 1개만 반환되며 절대 `null`/`undefined`가 아님.
  - 순수 함수: 내부 localStorage 접근 0회.
- Covers: [F1-AC-2, F1-AC-3, F6-AC-1, F6-AC-2, F6-AC-7]
- Files: `src/lib/summary.ts`
- Depends on: Task 2.1

---

## Epic 3. 상태 관리 + 공통 위젯

**Risk Assessment**
- Complexity: Medium
- Risk factors: 페이지마다 개별로 `listOrders()`를 호출하면 저장 후 홈 합계가 갱신되지 않고(F2-AC-1), 손상 토스트가 화면마다 중복 노출된다(AC-G9). 로딩 상태가 없으면 "0원"이 먼저 깜빡여 F3-AC-5 / F5-AC-6 위반.
- Mitigation: 단일 Provider가 orders/settings/loading을 소유하고 뮤테이션 후 즉시 상태를 갱신하도록 먼저 만든 뒤 페이지를 붙인다. 차트 위젯과 주문 폼도 페이지보다 먼저 만들어 각 페이지 패킷이 10분 내 끝나게 한다.

### Task 3.1 AppDataProvider (전역 상태)
- Description: `src/state/AppDataProvider.tsx`에 Context Provider와 `useAppData()` 훅 구현. 상태: `orders`, `settings`, `loading`(초기 `true`, 읽기 완료 후 `false`), `storageError`. 액션: `refresh()`, `createOrder(input)`, `editOrder(id, patch)`, `removeOrder(id)`, `updateSettings(patch)` — 모두 `StorageResult`를 그대로 반환하고 성공 시 in-memory 상태 즉시 갱신. 마운트 시 `setStorageErrorHandler` 등록 → 손상 감지 시 TDS Toast `"저장된 기록을 불러오지 못했어요"`를 중복 억제 플래그로 1회만 노출. `main.tsx`에서 앱 전체를 감싼다.
- DoD:
  - 손상된 `dtt:orders:v1`로 앱 실행 시 흰 화면 없이 렌더, `orders === []`, 토스트 1회, `console.error` 0회.
  - `createOrder`가 `{ok:true}`를 반환한 직후 `useAppData().orders.length`가 +1.
  - `createOrder`가 `{ok:false, reason:'QUOTA'}`/`{reason:'LIMIT'}`일 때 `orders` 불변.
  - 초기 1프레임에서 `loading === true`.
  - `npx tsc --noEmit` + `npm run build` 통과.
- Covers: [F1-AC-8, F2-AC-1, AC-G9]
- Files: `src/state/AppDataProvider.tsx`, `src/main.tsx`
- Depends on: Task 2.2, Task 2.3, Task 2.4

### Task 3.2 차트/요약 표시 위젯
- Description: TDS 위에 얹는 얇은 프레젠테이션 컴포넌트 3종(로직 없음, props만).
  - `Sparkline({ values, testId })` — SVG 폴리라인, 색상은 `var(--tds-color-*)`만. 전부 0이면 평평한 baseline, 빈 배열이면 `null`.
  - `MiniBar({ items: Array<{label,value,ratio}>, testId })` — flex 가로 막대 + 비율 % 텍스트, `items.length===0`이면 `null`, 비율 합 100% 표기.
  - `SummaryHero({ amount, testId, caption? })` — CountUp(0→amount, 600ms, `requestAnimationFrame`), t2 이상 강조 타이포, `formatKRW` 사용.
  - 여백은 TDS `Spacing`만. TDS 컴포넌트에 padding/margin 오버라이드 금지. 커스텀 CSS는 flex/grid 배치에만.
- DoD:
  - `<SummaryHero amount={NaN} />` → 화면 텍스트 `"0원"`, `"NaN"` 0개.
  - `<MiniBar items={[]} />` → 렌더 결과 없음. `<Sparkline values={[]} />` → `null`.
  - 소스에 `#RRGGBB` 리터럴 0개.
  - 320px 폭에서 가로 스크롤 0.
- Covers: [F6-AC-3, AC-G4, AC-G8]
- Files: `src/components/Sparkline.tsx`, `src/components/MiniBar.tsx`, `src/components/SummaryHero.tsx`
- Depends on: Task 1.2

### Task 3.3 주문 입력 폼 공통 컴포넌트 `OrderForm`
- Description: `/orders/new`와 `/orders/:id/edit`가 공유하는 폼. props `{ initial: OrderInput; submitLabel: string; submitting: boolean; errors: Record<string,string>; onSubmit(input): void; footerExtra?: ReactNode }`.
  - 레이아웃: 날짜 ListRow(탭 시 BottomSheet) → 플랫폼 Chip 4개 → 금액 TextField 3종 + 메모 TextField → 픽업 가능 ListRow + Switch → `SubmitFooter` 버튼(display="block").
  - 금액 입력: `type="text"`, `inputMode="numeric"`, `enterKeyHint="next"`(마지막 `"done"`), 숫자 외 문자 즉시 제거 후 `toLocaleString('ko-KR')` 표시, 내부 상태는 정수. 메모 `maxLength={30}`.
  - 포커스 시 `scrollIntoView({ block:'center' })`, `SubmitFooter`는 키보드 위 유지. 미래 날짜 선택 시 인라인 에러 `"미래 날짜는 선택할 수 없어요"` + 제출 버튼 `disabled`.
  - `errors` 키에 해당하는 TextField 하단 에러 텍스트 + 첫 에러 필드로 포커스 이동.
  - Chip/Switch 터치 영역 ≥44px, 제출 버튼 56px, `safe-area-inset-bottom` 반영.
- DoD:
  - **F2-AC-3**: 주문금액에 `1a8b000` 입력 → 표시 `18,000`, `onSubmit` 인자 `foodAmount === 18000`.
  - **F2-AC-6**: 오늘 이후 날짜 선택 → `"미래 날짜는 선택할 수 없어요"` 표시 + 버튼 `disabled`.
  - **F2-AC-7**: `submitting===true`면 버튼 `loading` + `disabled`, 연속 3회 탭해도 `onSubmit` 1회만 호출.
  - `errors={{foodAmount:'주문 금액을 입력해주세요'}}` 전달 시 해당 필드 하단 문구 + 포커스 이동.
  - 모든 인터랙티브 요소 렌더 터치 영역 ≥44×44px, TDS 인라인 padding/margin 오버라이드 0개(간격은 `Spacing`만).
- Covers: [F2-AC-3, F2-AC-6, F2-AC-7, AC-G1]
- Files: `src/components/OrderForm.tsx`
- Depends on: Task 3.1

---

## Epic 4. UI 페이지 (한 패킷 = 한 화면)

**Risk Assessment**
- Complexity: High
- Risk factors: (1) `location.state`를 null 체크 없이 구조분해/캐스팅하면 새로고침·직접 진입 시 즉시 크래시(실사고 2026-08-03 SplitMate), (2) 리워드 광고 실패 경로 누락 시 리포트가 영구 잠김(F8-AC-5), (3) 빈/로딩 상태 누락으로 "0원" 선노출(F3-AC-5, F5-AC-6).
- Mitigation: Epic 1의 `RouteState` + `normalizeMonthParam`을 모든 수신 화면이 반드시 통과시키고, 각 페이지 DoD에 "state 없이 직접 진입해도 크래시하지 않는다"를 필수 항목으로 포함. 화면당 1패킷으로 분리.

### Task 4.1 홈 화면 `/`
- Description: `src/pages/HomePage.tsx`. `ScreenScaffold` → 월 선택 Chip 행(이전/다음, 이번 달이면 다음 `disabled`) → `data-testid="tip-summary-hero"` → `data-testid="goal-progress-card"` → `data-testid="tip-trend-sparkline"` → `data-testid="platform-minibar"` → `data-testid="recent-orders-card"`(최근 3건 ListRow) → `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` → `SubmitFooter`("배달 기록하기"). "픽업했다면?" 카드, "월간 리포트 보기", "목표 수정" 전환 포함. 파생값은 `useAppData()` + `summarize`.
  - state 수신: `const state = (useLocation().state as RouteState["/"]) ?? null;` — 표시에 쓰지 않고 무시.
  - 목표 카드: `"{totalTip} / {goal}"`, `"{pct}%"`, 진행바 너비 `Math.min(ratio,1)`, 0.8≤ratio<1.0이면 Badge "목표 임박", "목표 수정" 텍스트 버튼.
  - 계측: `logClick('home_add_order')`, `logClick('open_pickup_savings')`, `logClick('open_monthly_report')`, `logClick('edit_goal')`, AdSlot 렌더 시 `logImpression('home_banner')` 1회.
- DoD:
  - **F3-AC-1**: hero "7,000원", 요약 "주문 2회"/"평균 3,500원"/"최소주문 추가 2,000원".
  - **F3-AC-2**: 5개 testid가 명시 순서로 DOM에 존재, `ScreenScaffold`로 감쌈, hero는 SummaryHero+CountUp에 t2 이상 타이포.
  - **F3-AC-3**: "배달 기록하기" 탭 → `logClick('home_add_order')` 1회 + `navigate('/orders/new')`.
  - **F3-AC-4**: 이번 달 0건 → hero "0원" + `Asset.ContentIcon` + "이번 달 배달 기록이 아직 없어요", Sparkline·MiniBar 미렌더, 기록 버튼 활성.
  - **F3-AC-5**: `loading===true`일 때 Skeleton 3개, "0원" 숫자 미노출.
  - **F3-AC-6**: "이전 달" Chip 탭 → 라벨 "2026년 8월" + hero 8월 집계.
  - **F3-AC-7**: 이번 달에서 "다음 달" Chip `disabled`, 탭해도 월 불변, `console.error` 0회.
  - **F3-AC-8**: `<AdSlot />`이 `recent-orders-card` 뒤에 위치 + `logImpression('home_banner')` 정확히 1회(StrictMode 중복 방지).
  - **F5-AC-3**: "픽업했다면?" 카드 탭 → `logClick('open_pickup_savings')` 1회 + `navigate('/savings', { state:{ month } })`.
  - **F7-AC-2**: goal 30000 / totalTip 24000 → "24,000원 / 30,000원", "80%", 진행바 비율 0.8.
  - **F7-AC-3**: 0.8≤ratio<1.0 구간에서 Badge "목표 임박" 표시, 경고 다이얼로그 미표시.
  - **F7-AC-7**: 로딩 중 목표 카드 자리 Skeleton 1개 → 로딩 후 "0원 / 30,000원", "0%", 진행바 0 너비, "목표 수정" 버튼.
  - **F7-AC-8**: "목표 수정" 탭 → `logClick('edit_goal')` 1회 + `navigate('/settings/goal', { state:{ currentGoal } })`.
  - `/`에 state 없이 직접 진입/새로고침해도 크래시 없음.
- Covers: [F3-AC-1, F3-AC-2, F3-AC-3, F3-AC-4, F3-AC-5, F3-AC-6, F3-AC-7, F3-AC-8, F5-AC-3, F7-AC-2, F7-AC-3, F7-AC-7, F7-AC-8, AC-G1]
- Files: `src/pages/HomePage.tsx`
- Depends on: Task 3.1, Task 3.2

### Task 4.2 주문 기록 화면 `/orders/new`
- Description: `src/pages/OrderNewPage.tsx`. `OrderForm`을 `initial = { date: state?.presetDate ?? todayKST(), platform: settings.defaultPlatform, foodAmount:0, deliveryTip:0, minOrderPadding:0, pickupAvailable:true, memo:'' }`로 렌더. 제출 시 `logClick('save_order')` → `validateOrderInput` → `createOrder` 분기:
  - `ok` → `setDefaultPlatform(platform)` → Toast `"기록했어요 · 배달팁 {tip}원"` → 목표 초과 체크(저장 후 해당 월 `totalTip > goal` && 월이 `goalAlertedMonths`에 없으면 AlertDialog "이번 달 배달팁 목표를 넘었어요" / 본문 "{total}원 / 목표 {goal}원" → `markGoalAlerted(month)`; 닫은 뒤 이동) → `navigate('/', { replace:true, state:{ savedOrderId } })`.
  - `INVALID` → `errors`를 `OrderForm`에 전달.
  - `QUOTA`/`LIMIT` → AlertDialog "저장 공간이 부족해요" / "오래된 기록을 삭제한 뒤 다시 시도해주세요", 경로 유지 + 입력값 보존.
  - state 수신: `const state = (useLocation().state as RouteState["/orders/new"]) ?? null;`
- DoD:
  - **F2-AC-1**: 지정 입력 저장 → `dtt:orders:v1`에 1건 추가 + Toast "기록했어요 · 배달팁 3,000원" + `/`로 replace 이동 + 홈 이번 달 합계 +3,000원.
  - **F2-AC-2**: `defaultPlatform='YOGIYO'`, 오늘 2026-09-21 진입 → 날짜 프리필, "요기요" Chip 선택, 금액 3종 빈 값, 픽업 Switch ON. "쿠팡이츠"로 저장 후 `dtt:settings:v1.defaultPlatform === 'COUPANG_EATS'`.
  - **F2-AC-4**: 주문금액 빈 값 제출 → "주문 금액을 입력해주세요" + 레코드 미추가 + 해당 필드 포커스.
  - **F2-AC-5**: 배달팁 `60000` 제출 → "배달팁은 0원 이상 50,000원 이하로 입력해주세요" + 미저장.
  - **F2-AC-8**: `addOrder`가 `QUOTA` 반환 시 AlertDialog 2문구 표시 + `/orders/new` 유지 + 입력값 보존.
  - **F7-AC-4**: goal 30000, 기존 totalTip 28000에서 3,000원 저장 → AlertDialog "이번 달 배달팁 목표를 넘었어요"/"31,000원 / 목표 30,000원" 1회, `goalAlertedMonths`에 `"2026-09"` 추가, 같은 달 재저장 시 미표시.
  - state 없이 직접 진입해도 크래시 없음.
- Covers: [F2-AC-1, F2-AC-2, F2-AC-4, F2-AC-5, F2-AC-8, F7-AC-4]
- Files: `src/pages/OrderNewPage.tsx`
- Depends on: Task 3.3

### Task 4.3 주문 목록 화면 `/orders`
- Description: `src/pages/OrderListPage.tsx`. `ScreenScaffold` → 월 `Tab` → 월 섹션 헤더 → ListRow 목록(최신순) → 10번째 뒤 `<AdSlot />`(10건 이하면 목록 끝) → `IntersectionObserver` 센티널(30개씩 추가). ListRow 좌측 `"{PLATFORM_LABEL} · {formatDayLabel(date)}"`, 우측 `"팁 {tip}원"`, 보조 `"주문 {food}원 · 추가 {padding}원"`, 높이 ≥64px. 탭 시 `navigate('/orders/'+id+'/edit', { state:{ order } })`. 빈 상태 CTA. 스크롤 위치 `sessionStorage['dtt:scroll:/orders']` 저장·복원.
  - state 수신: `const state = (useLocation().state as RouteState["/orders"]) ?? null;` — `focusMonth`가 유효 월 키면 초기 Tab, 아니면 이번 달.
- DoD:
  - **F4-AC-1**: 지정 픽스처 → ListRow 1개, 좌측 "배달의민족 · 9월 21일", 우측 "팁 3,000원", 보조 "주문 18,000원 · 추가 2,000원".
  - **F4-AC-4**: 200건 → 초기 ListRow 30개, 센티널 교차 시 60개.
  - **F4-AC-5**: 0건 → `Asset.ContentIcon` + "아직 기록이 없어요" + `display="block"` "첫 배달 기록하기", 탭 시 `/orders/new`.
  - **F4-AC-8**: 25건 → `<AdSlot />` 정확히 1개, 10번째 ListRow 바로 뒤. 8건 → 목록 마지막 뒤 1개. ListRow를 덮지 않음.
  - `loading` 중 ListRow Skeleton 5개.
  - state 없이 `/orders` 직접 진입 → 이번 달 탭으로 크래시 없이 렌더.
  - 320px 폭 가로 스크롤 0.
- Covers: [F4-AC-1, F4-AC-4, F4-AC-5, F4-AC-8, AC-G8]
- Files: `src/pages/OrderListPage.tsx`
- Depends on: Task 3.1, Task 3.2

### Task 4.4 주문 수정/삭제 화면 `/orders/:id/edit`
- Description: `src/pages/OrderEditPage.tsx`. state의 `order`를 우선 쓰되 **반드시 null 체크 후** `useParams().id`로 `getOrder(id)` 폴백. 둘 다 없으면 Toast "기록을 찾을 수 없어요" → `navigate('/orders', { replace:true })`(흰 화면 금지). `OrderForm`(submitLabel="수정하기") + 본문 최하단 "삭제" 텍스트 버튼(weak, ≥44px). 수정 성공 → Toast "수정했어요" + `navigate(-1)`. 삭제 → AlertDialog "이 기록을 삭제할까요?" 확인 시 `removeOrder` → Toast "삭제했어요" + `navigate('/orders', { replace:true, state:{ deletedId } })`.
  - 수신 패턴: `const state = (useLocation().state as RouteState["/orders/:id/edit"]) ?? null;` — 구조분해 직접 사용 금지.
- DoD:
  - **F4-AC-2**: `o_1` 배달팁 3000→5000 → 저장값 `deliveryTip===5000`, `updatedAt` 증가, Toast "수정했어요", `navigate(-1)` 후 목록 우측 "팁 5,000원".
  - **F4-AC-3**: 삭제 확인 → 저장소에서 `o_1` 제거, Toast "삭제했어요", `/orders` replace, 목록에 없음.
  - **F4-AC-6**: `/orders/o_999/edit` 직접 진입 → Toast "기록을 찾을 수 없어요" + 즉시 `/orders` replace, 흰 화면 0, `console.error` 0회.
  - **F4-AC-7**: 주문금액 비우고 "수정하기" → "주문 금액을 입력해주세요" + `o_1` 값 불변.
  - state 없이 `/orders/o_1/edit` 새로고침 진입 → `getOrder` 폴백으로 정상 렌더.
- Covers: [F4-AC-2, F4-AC-3, F4-AC-6, F4-AC-7]
- Files: `src/pages/OrderEditPage.tsx`
- Depends on: Task 3.3

### Task 4.5 픽업 절약 시뮬레이션 화면 `/savings`
- Description: `src/pages/SavingsPage.tsx`.
  ```ts
  const raw = (useLocation().state as RouteState["/savings"]) ?? null;
  const [month, setMonth] = useState(normalizeMonthParam(raw ? raw.month : null));
  ```
  `ScreenScaffold` → 월 이동 Chip(≥44px) → `data-testid="savings-hero"`(절약액 / 연 환산 `savable*12` / 비율 `totalSpend===0?0:savable/totalSpend`를 소수 첫째 자리 반올림 %) → `data-testid="savings-card"` Card **정확히 2개**(카드1 = 픽업 시 절약 가능액 + Badge "추정", 카드2 = 최소주문 채우기 추가금 `data-testid="padding-section"`) → `data-testid="padding-minibar"` → 고지 `Paragraph.Text` "실제 픽업 시 이동 시간·교통비는 반영되지 않은 추정값이에요" → `<AdSlot />`. 절약 Card 최초 렌더 시 `logImpression('savings_card')` 1회. "이번 달 리포트 보기" → `logClick('savings_to_report')` + `navigate('/report', { state:{ month } })`.
  - padding 섹션은 `summarizePadding` 결과로 "총 {total}원", "발생 {count}회", "평균 {avg}원", "가장 많은 곳: {label}".
- DoD:
  - **F5-AC-1**: 지정 픽스처 → "5,000원", "연 환산 60,000원", "이번 달 배달지출의 11.9%".
  - **F5-AC-2(레이아웃 계약)**: 화면이 `ScreenScaffold`로 감싸이고 `data-testid="savings-card"` Card가 **정확히 2개**(카드1 절약 가능액 / 카드2 최소주문 추가금), 각 카드 핵심 금액이 t3 이상 강조 타이포, 절약액 옆 TDS Badge "추정", 하단 `Paragraph.Text` 고지 문구가 정확한 문자열로 렌더됨.
  - **F5-AC-4**: `{deliveryTip:null, minOrderPadding:"2000", pickupAvailable:"yes"}` 레코드 포함 시 합계 기여 0원, 화면 텍스트에 "NaN"/"null"/"undefined" 0개, `console.error` 0회.
  - **F5-AC-5**: `pickupAvailable===true` 주문 0건 → `Asset.ContentIcon` + "픽업 가능으로 기록한 주문이 없어요" + "기록할 때 '픽업 가능'을 켜면 절약액을 계산해드려요", 두 카드 금액 "0원".
  - **F5-AC-6**: `loading` 중 `savings-card` 2개 자리 Skeleton, 금액 숫자 미노출.
  - **F5-AC-7**: `totalSpend===0` → 비율 "0%", 연 환산 "0원", "NaN"/"Infinity" 0개.
  - **F5-AC-8**: `state={ month:"9월" }` 진입 → 대상 월이 이번 달(`2026-09`)로 대체, 크래시·에러 바운더리 없음. state 없이 직접 진입해도 동일.
  - **F6-AC-3**: 2개 플랫폼 분포 시 `padding-minibar` 막대 2개 + 비율 합 100%.
  - **F6-AC-4**: `totalPadding===0` → `padding-section`에 "최소주문 때문에 더 쓴 돈이 없어요 👍" + MiniBar 미렌더.
  - **F6-AC-5**: `loading` 중 `padding-section`에 Skeleton 1개, 합계 숫자 미노출.
  - **F6-AC-6**: `minOrderPadding`이 `-1000`/`null`인 레코드 포함 시 "-1,000원"/"NaN" 미표시.
  - F6-AC-1 픽스처 → padding 섹션 "총 5,000원"/"발생 2회"/"평균 2,500원"/"가장 많은 곳: 배달의민족".
- Covers: [F5-AC-1, F5-AC-2, F5-AC-4, F5-AC-5, F5-AC-6, F5-AC-7, F5-AC-8, F6-AC-1, F6-AC-3, F6-AC-4, F6-AC-5, F6-AC-6]
- Files: `src/pages/SavingsPage.tsx`
- Depends on: Task 3.1, Task 3.2

### Task 4.6 목표 설정 화면 `/settings/goal`
- Description: `src/pages/GoalSettingPage.tsx`. 초기값 = **null 체크 후** `state?.currentGoal ?? settings.monthlyTipGoal`. `ScreenScaffold` → 목표 TextField(`inputMode="numeric"`, `enterKeyHint="done"`, 천단위 콤마) → 빠른 선택 Chip 3개(30,000 / 50,000 / 100,000, ≥44px) → `Paragraph.Text` "기록은 이 기기에만 저장돼요" → `SubmitFooter`("저장하기", 56px). 저장 시 `logClick('save_goal')` → `validateGoal` → 성공 시 `updateSettings({ monthlyTipGoal })` + Toast "목표를 저장했어요" + `navigate(-1)`, 실패 시 인라인 에러.
- DoD:
  - **F7-AC-1**: 30000 → 50000 저장 → `dtt:settings:v1.monthlyTipGoal === 50000`, Toast "목표를 저장했어요", `navigate(-1)` 호출.
  - **F7-AC-5**: `0` 저장 시도 → "목표 금액은 1,000원 이상으로 입력해주세요" + `monthlyTipGoal` 불변.
  - **F7-AC-6**: `2000000` 저장 시도 → "목표 금액은 1,000,000원 이하로 입력해주세요" + 미저장.
  - Chip 탭 시 TextField 값 즉시 반영, `loading` 중 TextField Skeleton 1개.
  - state 없이 `/settings/goal` 직접 진입 → `getSettings().monthlyTipGoal`로 프리필, 크래시 없음.
  - `logClick('save_goal')` 1회.
- Covers: [F7-AC-1, F7-AC-5, F7-AC-6]
- Files: `src/pages/GoalSettingPage.tsx`
- Depends on: Task 3.1

### Task 4.7 월간 리포트 화면 `/report` (리워드 광고 게이트)
- Description: `src/pages/ReportPage.tsx`. 대상 월 = state **null 체크 후** `normalizeMonthParam`. 월 `Tab` 전환.
  - `orderCount === 0` → 광고 게이트 없이 `Asset.ContentIcon` + "이 달은 배달 기록이 없어요", "리포트 보기"·"공유하기" 미렌더.
  - 미해제 월 → 안내 Card + `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`로 감싼 "리포트 보기" 버튼(56px). 탭 시 `logClick('view_monthly_report')`. 광고 완료 → `markReportUnlocked(month)` + 카드 공개 + `logImpression('report_card')` 1회 + (`reviewRequested===false`일 때만) `requestReviewOnce()` 1회 후 `markReviewRequested()`.
  - 해제된 월 → 광고 없이 즉시 `data-testid="report-card"` 표시, "리포트 보기" 버튼 미렌더.
  - 광고 실패/중도 종료 → Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요" + "다시 시도" 버튼(≥44px), 카드 미렌더, `reportUnlockedMonths` 불변, 모든 SDK 호출 try/catch로 `console.error` 0회.
  - 카드 내용: `SummaryHero`(CountUp) + `data-testid="report-sparkline"`(dailyTips) + "주문 {n}회", "전월 대비 {±diff}원 ({±pct}%)"(전월 `orderCount===0`이면 "전월 기록 없음"), "픽업했다면 {savable}원 절약", "최소주문 추가 {padding}원", "가장 많이 쓴 곳: {label}".
  - `SubmitFooter`("공유하기") → `logClick('share_report')` → `try { await shareApp() } catch` → 실패 시 Toast "공유하지 못했어요. 다시 시도해주세요"(카드 유지, 해제 상태 불변). `window.open`/`window.location.href` 사용 금지.
  - "기록 더 보기" → `navigate('/orders', { state:{ focusMonth: month } })`.
- DoD:
  - **F8-AC-1**: 미해제 월에서 "리포트 보기" 탭 → `logClick('view_monthly_report')` 1회, 광고 완료 후 `report-card` 표시 + `reportUnlockedMonths`에 `"2026-09"` 추가 + `logImpression('report_card')` 1회.
  - **F8-AC-2(해제된 달 재열람)**: `reportUnlockedMonths`에 `"2026-09"`가 있는 상태로 `/report` 대상 월 `2026-09` 진입 → `TossRewardAd` 호출 0회, `data-testid="report-card"` 즉시 표시, "리포트 보기" 버튼 렌더 0개.
  - **F8-AC-3**: 지정 픽스처 → `report-card` Card 1개 안에 "31,000원", `report-sparkline`, "주문 9회", "전월 대비 +7,000원 (+29.2%)", "픽업했다면 12,000원 절약", "최소주문 추가 5,000원", "가장 많이 쓴 곳: 배달의민족".
  - **F8-AC-4**: "공유하기" 탭 → `logClick('share_report')` 후 `shareApp()` 1회, `window.open`/`window.location.href` 0회. 공개 시점에 `requestReviewOnce()` 1회 + `dtt:settings:v1.reviewRequested === true`.
  - **F8-AC-5**: 광고 실패 콜백 → 지정 Toast + "다시 시도" 버튼(≥44px) 표시 + 카드 미렌더 + `reportUnlockedMonths` 불변 + `console.error` 0회.
  - **F8-AC-6**: `shareApp()` reject/throw 시 Toast "공유하지 못했어요. 다시 시도해주세요" + 카드 유지 + 크래시 없음 + 해제 상태 불변.
  - **F8-AC-7**: `orderCount===0` 월 → 로딩 중 Skeleton 1개 → 빈 상태 표시, 두 버튼 미렌더.
  - **F8-AC-8**: 전월 주문 0건 → "전월 기록 없음" 표시, "NaN"/"Infinity"/"%NaN" 0개.
  - state 없이 `/report` 직접 진입/새로고침 → 이번 달로 정상 렌더, 크래시 없음.
- Covers: [F8-AC-1, F8-AC-2, F8-AC-3, F8-AC-4, F8-AC-5, F8-AC-6, F8-AC-7, F8-AC-8, AC-G3]
- Files: `src/pages/ReportPage.tsx`
- Depends on: Task 3.1, Task 3.2

---

## Epic 5. 통합 · 라우팅 · 최종 점검

**Risk Assessment**
- Complexity: Medium
- Risk factors: 라우팅 배선 누락 시 탭 이동 404, 딥링크/새로고침 시 state 유실 크래시, 전역 AC(HEX·console.error·외부 URL·WebView 호환) 위반은 검수 즉시 반려로 직결.
- Mitigation: 페이지 완성 후 마지막에 라우터·탭바를 한 번에 배선하고, 별도 패킷에서 grep 기반 정적 검사와 320px 폭 점검으로 전역 AC를 일괄 검증한다.

### Task 5.1 라우터 배선 + FloatingTabBar
- Description: `src/App.tsx`에 `BrowserRouter` + `Routes` 7개 경로(`/`, `/orders`, `/orders/new`, `/orders/:id/edit`, `/savings`, `/settings/goal`, `/report`)와 `*` → `<Navigate to="/" replace />` 배선. 템플릿 `FloatingTabBar` 4탭(홈/기록/리포트/설정) 연결 + 현재 경로 하이라이트. 모든 페이지가 `ScreenScaffold`(PageShell)로 감싸졌는지 확인(진입·체류 로그 자동).
- DoD:
  - 7개 경로 전부 새로고침(직접 진입)해도 흰 화면·크래시 0, 각 화면 state 폴백 동작.
  - `/unknown` → `/`로 replace 이동.
  - FloatingTabBar 4탭 이동 정상, 현재 탭 활성 표시, 탭 터치 영역 ≥44×44px.
  - `npm run build` 성공 + `npx tsc --noEmit` 0 에러.
- Covers: [AC-G1]
- Files: `src/App.tsx`, `src/routes.tsx`
- Depends on: Task 4.1, Task 4.2, Task 4.3, Task 4.4, Task 4.5, Task 4.6, Task 4.7

### Task 5.2 전역 AC 정적 검증 + 마감 점검
- Description: 전역 AC를 코드 전체에 대해 검증하고 위반 지점을 수정한다.
  - `grep -rn "#[0-9a-fA-F]\{3,6\}" src/` → 0건이 될 때까지 `var(--tds-color-*)`로 교체.
  - `grep -rn "window.open\|window.location.href\|console.error" src/` → 0건. 공유는 `shareApp()`만.
  - `grep -rn "\.at(\|Object.groupBy\|structuredClone\|replaceAll" src/` + lookbehind 정규식 → 0건.
  - 외부 앱 설치 유도 문구·딥링크("설치", "다운로드", 스토어 링크) 0건 — 플랫폼명은 라벨 텍스트로만.
  - `grantPromotionReward`, `TossPurchase` 사용 0건(MVP 범위 밖).
  - `fetch`/`XMLHttpRequest`/`axios` 0건.
  - shadcn/MUI/Ant/Chakra 의존성 0건, TDS 컴포넌트 인라인 padding/margin 오버라이드 0건.
  - 320px 뷰포트 7개 화면 가로 스크롤 0, 인터랙티브 요소 터치 영역 ≥44×44px 확인.
  - 전체 플로우(기록 → 홈 → 목록 → 리포트 → 공유) 1회 수행하며 콘솔 확인.
- DoD:
  - 위 grep 검사 전부 0건.
  - 전체 플로우 수행 중 `console.error` 0개.
  - 320px에서 7개 화면 가로 스크롤 0.
  - 다크모드 토글 시 대비가 깨지는 화면 0개.
  - `npm run build` 성공, 점검 결과를 `docs/qa-checklist.md`에 기록.
- Covers: [AC-G1, AC-G2, AC-G3, AC-G4, AC-G5, AC-G6, AC-G7, AC-G8, AC-G10]
- Files: `src/**`(위반 지점 수정), `docs/qa-checklist.md`
- Depends on: Task 5.1

---

## AC Coverage

- **Total ACs in SPEC: 63** (F1 8 + F2 8 + F3 8 + F4 8 + F5 8 + F6 7 + F7 8 + F8 8) *(별도 전역 AC 10개는 아래 표 하단에 추가 집계)*
- **Covered by tasks: 63**
- **Uncovered: 0**

| AC ID | 담당 Task |
|---|---|
| F1-AC-1 | Task 2.2 |
| F1-AC-2 | Task 2.4 |
| F1-AC-3 | Task 2.4 |
| F1-AC-4 | Task 2.2 |
| F1-AC-5 | Task 2.2 |
| F1-AC-6 | Task 2.1, Task 2.2 |
| F1-AC-7 | Task 2.1 |
| F1-AC-8 | Task 1.1, Task 2.1, Task 2.3, Task 3.1 |
| F2-AC-1 | Task 3.1, Task 4.2 |
| F2-AC-2 | Task 4.2 |
| F2-AC-3 | Task 3.3 |
| F2-AC-4 | Task 4.2 |
| F2-AC-5 | Task 4.2 |
| F2-AC-6 | Task 3.3 |
| F2-AC-7 | Task 3.3 |
| F2-AC-8 | Task 4.2 |
| F3-AC-1 | Task 4.1 |
| F3-AC-2 | Task 4.1 |
| F3-AC-3 | Task 4.1 |
| F3-AC-4 | Task 4.1 |
| F3-AC-5 | Task 4.1 |
| F3-AC-6 | Task 4.1 |
| F3-AC-7 | Task 4.1 |
| F3-AC-8 | Task 4.1 |
| F4-AC-1 | Task 4.3 |
| F4-AC-2 | Task 4.4 |
| F4-AC-3 | Task 4.4 |
| F4-AC-4 | Task 4.3 |
| F4-AC-5 | Task 4.3 |
| F4-AC-6 | Task 4.4 |
| F4-AC-7 | Task 4.4 |
| F4-AC-8 | Task 4.3 |
| F5-AC-1 | Task 4.5 |
| F5-AC-2 | Task 4.5 |
| F5-AC-3 | Task 4.1 |
| F5-AC-4 | Task 2.1, Task 4.5 |
| F5-AC-5 | Task 4.5 |
| F5-AC-6 | Task 4.5 |
| F5-AC-7 | Task 1.2, Task 4.5 |
| F5-AC-8 | Task 1.2, Task 4.5 |
| F6-AC-1 | Task 2.4, Task 4.5 |
| F6-AC-2 | Task 2.4 |
| F6-AC-3 | Task 3.2, Task 4.5 |
| F6-AC-4 | Task 4.5 |
| F6-AC-5 | Task 4.5 |
| F6-AC-6 | Task 2.1, Task 4.5 |
| F6-AC-7 | Task 1.1, Task 2.4 |
| F7-AC-1 | Task 4.6 |
| F7-AC-2 | Task 4.1 |
| F7-AC-3 | Task 4.1 |
| F7-AC-4 | Task 4.2 |
| F7-AC-5 | Task 2.3, Task 4.6 |
| F7-AC-6 | Task 2.3, Task 4.6 |
| F7-AC-7 | Task 4.1 |
| F7-AC-8 | Task 4.1 |
| F8-AC-1 | Task 4.7 |
| F8-AC-2 | Task 2.3, Task 4.7 |
| F8-AC-3 | Task 4.7 |
| F8-AC-4 | Task 2.3, Task 4.7 |
| F8-AC-5 | Task 4.7 |
| F8-AC-6 | Task 4.7 |
| F8-AC-7 | Task 4.7 |
| F8-AC-8 | Task 4.7 |

**전역 AC (10개, 전부 커버)**

| AC ID | 담당 Task |
|---|---|
| AC-G1 | Task 3.3, Task 4.1, Task 5.1, Task 5.2 |
| AC-G2 | Task 5.2 |
| AC-G3 | Task 4.7, Task 5.2 |
| AC-G4 | Task 1.1, Task 3.2, Task 5.2 |
| AC-G5 | Task 5.2 |
| AC-G6 | Task 1.1, Task 1.2, Task 5.2 |
| AC-G7 | Task 1.2, Task 5.2 |
| AC-G8 | Task 3.2, Task 4.3, Task 5.2 |
| AC-G9 | Task 2.1, Task 3.1 |
| AC-G10 | Task 5.2 |

**수정 요약**: 이전 출력의 `F1-AC5` 형태 축약 ID와 `AC-1~8` 범위 표기를 전부 `F1-AC-5` 형식의 개별 ID로 정규화했고, 특히 미검출된 **F1-AC-5(LIMIT), F1-AC-6(QUOTA), F5-AC-2(절약 화면 레이아웃 계약), F8-AC-2(해제된 달 재열람)** 을 각각 Task 2.2 / Task 2.2·2.1 / Task 4.5 / Task 2.3·4.7의 Covers와 DoD에 명시적 검증 항목으로 추가했다. 총 AC 집계도 기능 AC 63개 기준으로 정정했다.