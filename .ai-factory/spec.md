PRD 확장 SPEC입니다. 검증 오류 3건(F1/F5/F8의 에러·엣지 케이스 AC 부족)을 수정했습니다 — 각 기능에 `[W][P1]` 에러 처리 AC를 3~4개씩 명시적으로 배치하고, 기능당 AC 상한 8개를 유지하기 위해 일부 AC를 통합했습니다.

---

# SPEC — DeliveryTipTally

## Common Principles

**기술 스택 / 공통 규칙**

- Vite + React + TypeScript, 라우팅은 `react-router-dom`(BrowserRouter), 상태는 React state + localStorage.
- 모든 UI는 TDS(`@toss/tds-mobile`) 컴포넌트로만 구성한다. shadcn/ui, MUI, Ant Design, Chakra UI 사용 금지.
- 모든 화면은 템플릿의 `ScreenScaffold`(내부적으로 `PageShell`)로 감싼다. raw `div` 페이지 골격 금지.
- 간격은 TDS `Spacing`(size prop 필수)만 사용. TDS 컴포넌트에 Tailwind/인라인 스타일로 padding·margin 덮어쓰기 금지. 커스텀 CSS는 flex/grid 배치에만 허용.
- 색상은 `var(--tds-color-*)` 또는 TDS 컴포넌트 기본값만 사용. HEX 하드코딩 금지(다크모드 필수).
- 하단 탭 네비게이션은 템플릿 제공 `src/components/FloatingTabBar` 사용(TDS에 TabBar 없음). TDS `Tab`은 화면 내부 콘텐츠 전환용.
- 1차 액션 버튼은 `SubmitFooter`(하단 고정) 또는 `display="block"` 버튼. 좌측 글자폭 버튼 금지.
- 서버 없음. 모든 데이터는 localStorage. 외부 API 호출 없음.
- 인증: 토스 앱이 세션을 자동 제공. 로그인 함수 호출 없음. 사용자 식별이 필요하면 `getIsTossLoginIntegratedService()`로 연동 여부만 확인.
- 광고: 배너는 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`, 리워드는 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>{children}</TossRewardAd>`. ID는 앱인토스 콘솔 값이며 Vite가 빌드 시점에 인라인하므로 값 변경 시 재빌드·재배포 필요.
- 계측: 화면 진입/체류 로그는 `PageShell`이 자동 기록한다(화면 정의에 중복 기재 금지). 전환 버튼에만 `logClick('<snake_case>')`, "보였는지"가 중요한 결과 카드·광고 슬롯에만 `logImpression('<이름>')`. 외부 분석 툴(GA, Amplitude 등) 사용 금지.
- 금액 표기는 `Number.prototype.toLocaleString('ko-KR')` + "원" 접미사. 모든 금액은 정수 KRW.
- 월 키(monthKey)는 `YYYY-MM`, 날짜는 `YYYY-MM-DD` (KST 기준, `Asia/Seoul`).
- 에러 처리 원칙: localStorage 읽기/쓰기, 광고 SDK 호출, 공유 호출은 전부 `try/catch`로 감싸고 실패 시 `{ ok: false, reason }`로 변환한다. `console.error`를 프로덕션 경로에서 호출하지 않는다.

**전역 AC (모든 기능·화면에 적용)**

- AC-G1 [U][P0]: 모든 인터랙티브 요소(버튼, ListRow, Chip, Switch, 탭)의 렌더된 터치 영역은 44×44px 이상이다.
- AC-G2 [U][P0]: 프로덕션 빌드에서 앱의 전체 플로우(기록 → 홈 → 목록 → 리포트 → 공유)를 수행할 때 `console.error` 출력이 0개다.
- AC-G3 [W][P0]: Scenario: 외부 도메인 이탈 차단 에러 방지
  Given 어떤 화면에서든
  When 코드가 `window.location.href` 또는 `window.open`으로 `https://` 외부 URL 이동을 시도
  Then 해당 호출이 코드베이스에 존재하지 않으며(정적 검사 통과), 공유는 `shareApp()`만 사용한다
- AC-G4 [U][P0]: 소스 전체에 `#RRGGBB`/`#RGB` 형태의 HEX 색상 리터럴이 0개이며, 색상은 `var(--tds-color-*)` 또는 TDS 컴포넌트 기본값만 사용한다.
- AC-G5 [U][P1]: 외부 앱 설치 유도 문구/배너/링크("앱을 설치하세요", "다운로드", 배달앱 스토어 링크 등)가 0개다. 플랫폼명은 라벨 텍스트로만 사용하고 어떤 딥링크·외부 링크도 걸지 않는다.
- AC-G6 [U][P1]: Android 7, iOS 16 WebView에서 동작한다. `Array.prototype.at`, `Object.groupBy`, `structuredClone`, `String.replaceAll`, 정규식 lookbehind를 사용하지 않는다.
- AC-G7 [U][P1]: 외부 네트워크 요청이 0개이므로 CORS 에러(CORS error)가 0개다(외부 API 미사용).
- AC-G8 [U][P2]: 모든 화면은 세로 폭 320px에서 가로 스크롤이 발생하지 않는다.
- AC-G9 [W][P1]: Scenario: 저장소 손상 에러 복구 (storage parse error)
  Given `localStorage['dtt:orders:v1']`에 `"{{broken"` 문자열이 들어 있을 때
  When 앱을 실행
  Then 앱은 흰 화면 없이 렌더되고, 데이터는 빈 배열로 초기화되며, 토스트 "저장된 기록을 불러오지 못했어요"가 표시됨
- AC-G10 [U][P1]: `grantPromotionReward`는 MVP 범위에서 호출하지 않는다(프로모션 코드 미발급). 향후 사용 시 `amount ≤ 5000` 검증을 통과한 값만 전달한다.

> 생성형 AI 고지 의무: 본 앱은 생성형 AI를 사용하지 않는다(모든 수치는 사용자 입력 기반 결정론적 사칙연산). 따라서 AI 사전 고지·AI 결과 라벨 AC는 해당 없음(Assumptions A6 참조).

---

## Data Models

### Platform (enum)

```ts
type Platform = 'BAEMIN' | 'COUPANG_EATS' | 'YOGIYO' | 'ETC';

const PLATFORM_LABEL: Record<Platform, string> = {
  BAEMIN: '배달의민족',
  COUPANG_EATS: '쿠팡이츠',
  YOGIYO: '요기요',
  ETC: '기타',
};
```

### DeliveryOrder

| 필드 | 타입 | 제약 |
|---|---|---|
| `id` | `string` | `` `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` ``, 유니크 |
| `date` | `string` | `YYYY-MM-DD`, 오늘 이전 또는 오늘. 미래 불가 |
| `platform` | `Platform` | 필수 |
| `foodAmount` | `number` | 정수, 1 ≤ x ≤ 1,000,000 (음식 주문 금액, 배달팁 제외) |
| `deliveryTip` | `number` | 정수, 0 ≤ x ≤ 50,000 |
| `minOrderPadding` | `number` | 정수, 0 ≤ x ≤ 200,000 (최소주문금액 맞추려 추가한 금액) |
| `pickupAvailable` | `boolean` | 기본 `true` (픽업 가능했던 주문인지) |
| `memo` | `string` | 0 ≤ length ≤ 30 |
| `createdAt` | `number` | epoch ms |
| `updatedAt` | `number` | epoch ms |

```ts
interface DeliveryOrder {
  id: string;
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
```

### AppSettings

```ts
interface AppSettings {
  monthlyTipGoal: number;         // 정수, 1,000 ≤ x ≤ 1,000,000, 기본 30000
  defaultPlatform: Platform;      // 기본 'BAEMIN'
  goalAlertedMonths: string[];    // 목표 초과 다이얼로그를 이미 띄운 월 키, 최대 24개
  reportUnlockedMonths: string[]; // 리워드 광고로 해제된 월 키, 최대 24개
  reviewRequested: boolean;       // requestReviewOnce 호출 여부, 기본 false
  schemaVersion: 1;
}
```

### StorageResult (모든 쓰기 함수의 반환 타입)

```ts
type StorageFailReason = 'LIMIT' | 'QUOTA' | 'INVALID' | 'NOT_FOUND';
type StorageResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: StorageFailReason; errors?: Record<string, string> };
```

### MonthlySummary (파생 — 저장하지 않고 계산)

```ts
interface MonthlySummary {
  month: string;                 // 'YYYY-MM'
  orderCount: number;
  totalTip: number;
  totalPadding: number;
  totalFood: number;
  totalSpend: number;            // totalFood + totalTip
  avgTip: number;                // orderCount === 0 ? 0 : Math.round(totalTip / orderCount)
  pickupSavable: number;         // pickupAvailable === true 주문의 (deliveryTip + minOrderPadding) 합
  byPlatform: Array<{ platform: Platform; count: number; tip: number; ratio: number }>;
  dailyTips: number[];           // 길이 = 해당 월의 일수, index 0 = 1일
}
```

### localStorage 키 / 크기 산정

| 키 | 값 형태 | 크기 |
|---|---|---|
| `dtt:orders:v1` | `DeliveryOrder[]` (JSON) | 1건 ≈ 190 bytes. 상한 2,000건 → 약 380KB |
| `dtt:settings:v1` | `AppSettings` (JSON) | ≈ 400 bytes |
| `dtt:onboard:v1` | `"1"` | 2 bytes |

총계 상한 약 **0.38MB < 5MB**. 주문 2,000건 도달 시 신규 저장을 거부한다(F1 AC-5).

---

## Feature List

### F1. 데이터 레이어 — 저장소 · 검증 · 월별 집계

- Description: `DeliveryOrder`/`AppSettings`의 CRUD와 JSON 직렬화, 스키마 검증, 월별 집계(`MonthlySummary`) 순수 함수를 제공한다. UI가 없는 순수 TypeScript 모듈로, 모든 화면이 이 레이어만 통해 데이터에 접근한다. 손상된 JSON·용량 초과·잘못된 필드 등 모든 저장소 에러(storage error)를 이 레이어에서 흡수해 `StorageResult`로 변환한다.
- Data: `DeliveryOrder`, `AppSettings`, `MonthlySummary` / 키 `dtt:orders:v1`, `dtt:settings:v1`
- API: 없음 (외부 API 미사용)
- Requirements: `listOrders()`, `getOrder(id)`, `addOrder(input)`, `updateOrder(id, patch)`, `deleteOrder(id)`, `getSettings()`, `saveSettings(patch)`, `summarize(orders, month)`, `validateOrderInput(input)`

- AC-1 [E][P0]: Scenario: 주문 저장 성공
  Given `dtt:orders:v1`가 비어 있을 때
  When `addOrder({ date: "2026-09-21", platform: "BAEMIN", foodAmount: 18000, deliveryTip: 3000, minOrderPadding: 2000, pickupAvailable: true, memo: "점심" })` 호출
  Then 반환값이 `{ ok: true, data: { id: <"o_"로 시작>, createdAt === updatedAt } }`이고
  And `JSON.parse(localStorage['dtt:orders:v1']).length === 1`
- AC-2 [U][P0]: Scenario: 월별 집계 계산
  Given 주문이 `[{date:"2026-09-01",deliveryTip:3000,minOrderPadding:2000,foodAmount:15000,pickupAvailable:true,platform:"BAEMIN"}, {date:"2026-09-02",deliveryTip:4000,minOrderPadding:0,foodAmount:20000,pickupAvailable:false,platform:"YOGIYO"}, {date:"2026-08-31",deliveryTip:9000,minOrderPadding:0,foodAmount:10000,pickupAvailable:true,platform:"BAEMIN"}]` 일 때
  When `summarize(orders, "2026-09")` 호출
  Then `{ orderCount: 2, totalTip: 7000, totalPadding: 2000, totalFood: 35000, totalSpend: 42000, avgTip: 3500, pickupSavable: 5000 }`이고
  And `dailyTips.length === 30`, `dailyTips[0] === 3000`
- AC-3 [U][P0]: Scenario: 플랫폼별 비중 정렬
  Given 위 AC-2의 2026-09 주문일 때
  When `summarize(orders, "2026-09").byPlatform` 확인
  Then `tip` 내림차순으로 `[{platform:"YOGIYO",count:1,tip:4000,ratio:0.5714},{platform:"BAEMIN",count:1,tip:3000,ratio:0.4286}]`이고
  And `totalTip === 0`인 월에서는 모든 `ratio`가 `0`이며 `NaN`이 발생하지 않음
- AC-4 [W][P1]: Scenario: 잘못된 입력 검증 에러 (invalid input error)
  Given 검증 함수가 있을 때
  When `validateOrderInput({ date: "2026-09-21", platform: "BAEMIN", foodAmount: 0, deliveryTip: 60000, minOrderPadding: 0, pickupAvailable: true, memo: "" })` 호출
  Then `{ ok: false, reason: "INVALID", errors: { foodAmount: "주문 금액을 입력해주세요", deliveryTip: "배달팁은 0원 이상 50,000원 이하로 입력해주세요" } }`를 반환하고
  And `localStorage['dtt:orders:v1']`의 값이 호출 전과 동일함
- AC-5 [W][P1]: Scenario: 저장 한도 초과 에러 (limit error)
  Given `dtt:orders:v1`에 주문이 2,000건 있을 때
  When `addOrder({ date: "2026-09-21", platform: "BAEMIN", foodAmount: 18000, deliveryTip: 3000, minOrderPadding: 0, pickupAvailable: true, memo: "" })` 호출
  Then `{ ok: false, reason: "LIMIT" }`를 반환하고 저장 건수는 2,000건으로 유지되며 예외가 throw되지 않음
- AC-6 [W][P1]: Scenario: 저장 실패 — QuotaExceededError 처리 (quota error)
  Given `localStorage.setItem`이 `QuotaExceededError`를 던지도록 스텁된 환경일 때
  When `addOrder({ date: "2026-09-21", platform: "BAEMIN", foodAmount: 18000, deliveryTip: 3000, minOrderPadding: 0, pickupAvailable: true, memo: "" })` 호출
  Then 예외가 호출자에게 전파되지 않고 `{ ok: false, reason: "QUOTA" }`를 반환하며 `console.error`가 0회 호출됨
- AC-7 [W][P1]: Scenario: 손상 레코드 읽기 에러 정제 (corrupted record error)
  Given `dtt:orders:v1` 값이 `'[{"id":"o_1","date":"2026-09-21","platform":"BAEMIN","foodAmount":18000,"deliveryTip":3000,"minOrderPadding":0,"pickupAvailable":true,"memo":"","createdAt":1,"updatedAt":1},{"id":"o_2"},"junk",null]'` 일 때
  When `listOrders()` 호출
  Then 길이 1인 배열(`id === "o_1"`)을 반환하고, 정제된 배열 1건을 즉시 다시 저장하며, 예외가 throw되지 않음
- AC-8 [S][P1]: Scenario: 빈 저장소 기본값 (empty state)
  Given `dtt:orders:v1`와 `dtt:settings:v1`가 모두 없을 때
  When `listOrders()`와 `getSettings()` 호출
  Then 각각 `[]`와 `{ monthlyTipGoal: 30000, defaultPlatform: 'BAEMIN', goalAlertedMonths: [], reportUnlockedMonths: [], reviewRequested: false, schemaVersion: 1 }`를 반환함

---

### F2. 주문 기록 입력 (10초 입력 폼)

- Description: 날짜·플랫폼·주문금액·배달팁·최소주문 추가금액·픽업가능 여부를 한 화면에서 입력해 저장한다. 기본값(오늘 날짜, 최근 사용 플랫폼, 픽업가능 ON)을 채워두고 숫자 키패드를 띄워 탭 수를 최소화한다. 저장 즉시 홈으로 돌아가 갱신된 월 누적을 보여준다.
- Data: `DeliveryOrder`(생성), `AppSettings.defaultPlatform`(갱신)
- API: 없음
- Requirements: 화면 `/orders/new`. F1의 `validateOrderInput` + `addOrder` 사용.

- AC-1 [E][P0]: Scenario: 주문 기록 성공
  Given `/orders/new` 진입 상태에서
  When 날짜 `2026-09-21`, 플랫폼 Chip "배달의민족", 주문금액 `18000`, 배달팁 `3000`, 최소주문 추가금액 `2000`, 픽업가능 Switch ON으로 "저장하기" 탭
  Then localStorage `dtt:orders:v1`에 해당 주문 1건이 추가되고
  And TDS Toast "기록했어요 · 배달팁 3,000원"이 표시되며
  And `navigate('/', { replace: true })`로 홈 이동, 홈의 이번 달 배달팁 합계가 3,000원 증가함
- AC-2 [U][P0]: Scenario: 기본값 프리필과 플랫폼 기억
  Given `settings.defaultPlatform === 'YOGIYO'`이고 오늘이 `2026-09-21`일 때
  When `/orders/new` 진입
  Then 날짜 = `2026-09-21`, 플랫폼 Chip = "요기요" 선택, 금액 3종 = 빈 값, 픽업가능 Switch = ON 상태이고
  And 플랫폼을 "쿠팡이츠"로 바꿔 저장하면 `dtt:settings:v1.defaultPlatform === 'COUPANG_EATS'`로 갱신됨
- AC-3 [U][P0]: Scenario: 숫자 입력 포맷
  Given `/orders/new`의 금액 TextField 3종에서
  When 주문금액에 `1a8b000`을 입력
  Then 화면 표시값은 `18,000`이고(`inputMode="numeric"`, `type="text"`, 숫자 외 문자 즉시 제거), 저장 시 `foodAmount === 18000` 정수로 변환됨
- AC-4 [W][P1]: Scenario: 빈 주문금액 검증 에러
  Given `/orders/new`에서
  When 주문금액을 빈 값으로 둔 채 `{ platform: "BAEMIN", deliveryTip: 3000 }` 상태로 "저장하기" 탭
  Then TextField 하단에 에러 텍스트 "주문 금액을 입력해주세요"가 표시되고, `dtt:orders:v1`에 레코드가 추가되지 않으며, 해당 TextField로 포커스가 이동함
- AC-5 [W][P1]: Scenario: 배달팁 상한 초과 에러
  Given `/orders/new`에서
  When 배달팁에 `60000`을 입력하고 "저장하기" 탭
  Then 에러 텍스트 "배달팁은 0원 이상 50,000원 이하로 입력해주세요"가 표시되고 저장되지 않음
- AC-6 [W][P1]: Scenario: 미래 날짜 선택 에러
  Given 오늘이 `2026-09-21`일 때
  When 날짜 BottomSheet에서 `2026-09-22`를 선택
  Then 에러 텍스트 "미래 날짜는 선택할 수 없어요"가 표시되고 "저장하기" 버튼이 `disabled` 상태가 됨
- AC-7 [S][P1]: Scenario: 저장 중 로딩 상태와 중복 제출 방지
  Given "저장하기"를 탭해 저장이 진행 중일 때
  While 저장이 끝나지 않은 동안 "저장하기" 버튼은 `loading` + `disabled` 상태이고, 연속 3회 탭해도 `dtt:orders:v1`에 생성되는 레코드는 1건뿐임
- AC-8 [W][P1]: Scenario: 저장 공간 부족 에러 안내
  Given F1 `addOrder`가 `{ ok: false, reason: "QUOTA" }`를 반환하는 상태일 때
  When "저장하기" 탭
  Then AlertDialog 제목 "저장 공간이 부족해요", 본문 "오래된 기록을 삭제한 뒤 다시 시도해주세요"가 표시되고 화면은 `/orders/new`에 머무르며 입력값이 유지됨

---

### F3. 홈 대시보드 — 월 누적 배달팁 · 주문 횟수

- Description: 이번 달 누적 배달팁을 히어로 숫자로 보여주고, 주문 횟수·평균 배달팁·최소주문 추가금을 함께 요약한다. 일자별 배달팁 추이 Sparkline과 플랫폼별 비중 MiniBar로 "어디서 얼마나 새는지"를 한눈에 드러낸다. 하단에 최근 주문 3건과 배너 광고를 배치한다.
- Data: `DeliveryOrder[]`(읽기), `MonthlySummary`(파생), `AppSettings.monthlyTipGoal`
- API: 없음
- Requirements: 화면 `/`. F1 `summarize` 사용. 월 이동(이전/다음)은 MVP 범위이며 미래 월 이동은 불가.

- AC-1 [U][P0]: Scenario: 이번 달 누적 표시
  Given `2026-09` 주문이 `[{deliveryTip:3000,minOrderPadding:2000,foodAmount:18000},{deliveryTip:4000,minOrderPadding:0,foodAmount:20000}]` 일 때
  When 홈 진입
  Then `data-testid="tip-summary-hero"`에 "7,000원"이 표시되고
  And 요약 카드에 "주문 2회", "평균 3,500원", "최소주문 추가 2,000원"이 표시됨
- AC-2 [U][P0]: Scenario: 홈 레이아웃 계약
  Given 이번 달 주문이 1건 이상일 때
  When 홈 진입
  Then 홈은 `ScreenScaffold`로 감싸이고 `data-testid="tip-summary-hero"`(SummaryHero·CountUp, t2 이상 강조 타이포), `data-testid="goal-progress-card"`, `data-testid="tip-trend-sparkline"`, `data-testid="platform-minibar"`, `data-testid="recent-orders-card"` 5개 요소가 이 순서로 DOM에 존재함
- AC-3 [E][P0]: Scenario: 기록하기 전환
  Given 홈에서
  When 하단 고정 `SubmitFooter`의 "배달 기록하기" 버튼 탭
  Then `logClick('home_add_order')`가 1회 호출되고 `navigate('/orders/new')`로 이동함
- AC-4 [S][P1]: Scenario: 빈 상태
  Given 이번 달 주문이 0건일 때
  When 홈 진입
  Then 히어로는 "0원", `Asset.ContentIcon`과 문구 "이번 달 배달 기록이 아직 없어요"가 표시되고, Sparkline·MiniBar는 렌더되지 않으며, "배달 기록하기" 버튼은 활성 상태임
- AC-5 [S][P1]: Scenario: 로딩 상태
  Given localStorage 읽기가 완료되기 전
  While 데이터 로딩 중 홈은 TDS Skeleton 3개(히어로·목표 카드·최근 주문)를 표시하고 "0원" 숫자를 먼저 노출하지 않음
- AC-6 [E][P1]: Scenario: 이전 달 조회
  Given 오늘이 `2026-09-21`이고 홈 상단 월 선택이 "2026년 9월"일 때
  When "이전 달" Chip 탭
  Then 표시 월이 "2026년 8월"로 바뀌고 히어로 값이 8월 집계로 갱신됨
- AC-7 [W][P1]: Scenario: 미래 달 이동 차단 에러 방지
  Given 표시 월이 이번 달(`2026-09`)일 때
  When "다음 달" Chip을 탭
  Then 버튼은 `disabled`이고 표시 월이 `2026-10`으로 바뀌지 않으며 `console.error`가 호출되지 않음
- AC-8 [U][P1]: Scenario: 배너 광고 배치
  Given 홈이 렌더된 상태에서
  When DOM 순서를 확인
  Then `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`는 `data-testid="recent-orders-card"` 아래에 위치해 요약·추이 콘텐츠를 가리지 않고, 렌더 시 `logImpression('home_banner')`가 1회 호출됨

---

### F4. 주문 목록 · 수정 · 삭제

- Description: 월별로 묶인 주문 목록을 최신순으로 보여주고, 각 항목을 눌러 수정하거나 상세 화면에서 삭제할 수 있다. 긴 목록은 30개 단위 무한 스크롤로 점진 렌더해 초기 렌더 비용을 제한한다. 목록 10번째 항목 뒤에 배너 광고 1개를 삽입한다.
- Data: `DeliveryOrder[]`(읽기/수정/삭제)
- API: 없음
- Requirements: 화면 `/orders`, `/orders/:id/edit`

- AC-1 [U][P0]: Scenario: 목록 렌더
  Given 주문이 `[{id:"o_1",date:"2026-09-21",platform:"BAEMIN",foodAmount:18000,deliveryTip:3000,minOrderPadding:2000,memo:"점심"}]` 일 때
  When `/orders` 진입
  Then TDS ListRow 1개가 렌더되고 좌측 텍스트 "배달의민족 · 9월 21일", 우측 텍스트 "팁 3,000원", 보조 텍스트 "주문 18,000원 · 추가 2,000원"이 표시됨
- AC-2 [E][P0]: Scenario: 주문 수정 성공
  Given `/orders`에서 `id: "o_1"` ListRow를 탭해 `/orders/o_1/edit`에 진입했을 때
  When 배달팁을 `3000` → `5000`으로 바꾸고 "수정하기" 탭
  Then `dtt:orders:v1`의 `o_1.deliveryTip === 5000`이고 `updatedAt`이 갱신되며, Toast "수정했어요" 표시 후 `navigate(-1)`로 목록에 복귀하고 해당 ListRow 우측이 "팁 5,000원"으로 갱신됨
- AC-3 [E][P0]: Scenario: 주문 삭제 성공
  Given `/orders/o_1/edit`에서
  When "삭제" 버튼 탭 → AlertDialog "이 기록을 삭제할까요?"에서 "삭제" 확인
  Then `dtt:orders:v1`에서 `o_1`이 제거되고 Toast "삭제했어요" 표시 후 `navigate('/orders', { replace: true })`로 이동하며 목록에 `o_1`이 없음
- AC-4 [U][P1]: Scenario: 무한 스크롤
  Given 주문이 200건 있을 때
  When `/orders` 진입 직후 DOM을 확인
  Then ListRow 개수는 30개이고, 센티널이 뷰포트에 들어오면 `IntersectionObserver` 콜백으로 30개씩 추가 렌더됨
- AC-5 [S][P1]: Scenario: 빈 상태
  Given 주문이 0건일 때
  When `/orders` 진입
  Then `Asset.ContentIcon`과 "아직 기록이 없어요", `display="block"` TDS Button "첫 배달 기록하기"가 표시되고 탭 시 `/orders/new`로 이동함
- AC-6 [W][P1]: Scenario: 존재하지 않는 주문 진입 에러
  Given `dtt:orders:v1`에 `o_999`가 없을 때
  When `/orders/o_999/edit`로 직접 진입
  Then Toast "기록을 찾을 수 없어요"가 표시되고 `navigate('/orders', { replace: true })`로 즉시 이동하며 흰 화면이 렌더되지 않음
- AC-7 [W][P1]: Scenario: 수정 검증 에러
  Given `/orders/o_1/edit`에서
  When 주문금액을 빈 값으로 만들고 "수정하기" 탭
  Then 에러 텍스트 "주문 금액을 입력해주세요"가 표시되고 `dtt:orders:v1`의 `o_1`은 변경되지 않음
- AC-8 [U][P2]: Scenario: 목록 내 배너 배치
  Given 주문이 25건일 때
  When `/orders` 렌더
  Then `<AdSlot />`은 10번째 ListRow 바로 뒤에 1개만 삽입되고, 주문이 10건 이하이면 목록 마지막 뒤에 1개 배치되며 ListRow를 덮지 않음

---

### F5. 픽업 절약 시뮬레이션

- Description: "픽업 가능"으로 기록한 주문의 배달팁과 최소주문 추가금을 합산해, 직접 픽업했다면 아꼈을 금액을 계산해 보여준다. 선택한 달 기준 절약 가능액, 전체 배달지출 대비 비율, 12개월 환산액을 카드로 제시한다. 계산은 전부 결정론적 사칙연산이며 추정치임을 화면에 명시하고, 0 나눗셈·손상 데이터·잘못된 파라미터 에러는 화면 폴백으로 흡수한다.
- Data: `DeliveryOrder[]`(읽기), `MonthlySummary.pickupSavable`
- API: 없음
- Requirements: 화면 `/savings`. 공식: `savable = Σ(deliveryTip + minOrderPadding)` for `pickupAvailable === true`; `ratio = totalSpend === 0 ? 0 : savable / totalSpend`; `yearly = savable * 12`.

- AC-1 [U][P0]: Scenario: 절약액 계산
  Given `2026-09` 주문이 `[{deliveryTip:3000,minOrderPadding:2000,foodAmount:18000,pickupAvailable:true},{deliveryTip:4000,minOrderPadding:0,foodAmount:20000,pickupAvailable:false}]` 일 때
  When `/savings` 진입(대상 월 `2026-09`)
  Then `data-testid="savings-hero"`에 "5,000원", "연 환산 60,000원", "이번 달 배달지출의 11.9%"가 표시됨 (`5000 / 42000 = 0.119`, 소수 첫째 자리 반올림)
- AC-2 [U][P0]: Scenario: 절약 화면 레이아웃 계약
  Given `/savings`가 렌더된 상태에서
  When DOM을 확인
  Then 화면은 `ScreenScaffold`로 감싸이고 `data-testid="savings-card"` Card가 정확히 2개(카드1 = 픽업 시 절약 가능액, 카드2 = 최소주문 채우기 추가금) 존재하며, 각 카드의 핵심 금액은 t3 이상 강조 타이포이고, 절약액 옆에 TDS Badge "추정"과 하단 `Paragraph.Text` "실제 픽업 시 이동 시간·교통비는 반영되지 않은 추정값이에요"가 표시됨
- AC-3 [E][P0]: Scenario: 시뮬레이션 진입 계측
  Given 홈에서
  When "픽업했다면?" 카드 탭
  Then `logClick('open_pickup_savings')`가 1회 호출되고 `navigate('/savings', { state: { month: '2026-09' } })`로 이동함
- AC-4 [W][P1]: Scenario: 손상 레코드 계산 에러 방어 (corrupted record error)
  Given `2026-09` 저장 데이터에 `{deliveryTip:null, minOrderPadding:"2000", foodAmount:18000, pickupAvailable:"yes"}` 레코드가 포함돼 있을 때
  When `/savings` 진입
  Then 해당 레코드는 `deliveryTip=0`, `minOrderPadding=0`, `pickupAvailable=false`로 취급되어 합계에 0원만 기여하고, 화면에 "NaN"·"null"·"undefined" 문자열이 0개이며 `console.error`가 0회 호출됨
- AC-5 [S][P1]: Scenario: 빈 상태
  Given 선택한 달에 `pickupAvailable === true` 주문이 0건일 때
  When `/savings` 진입
  Then `Asset.ContentIcon`과 "픽업 가능으로 기록한 주문이 없어요", 보조 문구 "기록할 때 '픽업 가능'을 켜면 절약액을 계산해드려요"가 표시되고 두 Card의 금액은 "0원"으로 표시됨
- AC-6 [S][P1]: Scenario: 로딩 상태
  Given localStorage 읽기가 완료되기 전
  While 데이터 로딩 중 `data-testid="savings-card"` 2개 자리에 TDS Skeleton이 표시되고 금액 숫자는 노출되지 않음
- AC-7 [W][P1]: Scenario: 0 나눗셈 에러 방지 (division-by-zero error)
  Given 선택한 달의 `totalSpend === 0` 일 때
  When `/savings` 진입
  Then 비율은 "0%"로 표시되고 화면 텍스트에 "NaN"·"Infinity"가 0개이며, 연 환산액은 "0원"으로 표시됨
- AC-8 [W][P1]: Scenario: 잘못된 월 파라미터 에러 복구 (invalid param error)
  Given `location.state = { month: "9월" }` 로 `/savings`에 진입했을 때
  When 화면이 렌더됨
  Then 대상 월은 오늘 기준 이번 달(`2026-09`)로 대체되고, 화면은 크래시 없이 정상 렌더되며 에러 바운더리 화면이 표시되지 않음

---

### F6. 최소주문금액 추가지출 집계

- Description: 최소주문금액을 맞추려고 원치 않게 더 담은 금액(`minOrderPadding`)만 따로 모아, 월 합계·건수·평균·최다 발생 플랫폼을 보여준다. 배달팁과 분리해 "숨은 지출"로 인식시키는 것이 목적이며, `/savings` 화면의 두 번째 섹션과 홈 요약 항목으로 노출된다.
- Data: `DeliveryOrder.minOrderPadding`, `MonthlySummary.totalPadding`
- API: 없음
- Requirements: `/savings` 내 `data-testid="padding-section"` 섹션 + 홈 요약 1줄.

- AC-1 [U][P0]: Scenario: 추가지출 집계
  Given `2026-09` 주문이 `[{minOrderPadding:2000,platform:"BAEMIN"},{minOrderPadding:3000,platform:"BAEMIN"},{minOrderPadding:0,platform:"YOGIYO"}]` 일 때
  When `/savings` 진입
  Then `data-testid="padding-section"`에 "총 5,000원", "발생 2회", "평균 2,500원", "가장 많은 곳: 배달의민족"이 표시됨
- AC-2 [U][P0]: Scenario: 평균 분모 규칙
  Given 위 AC-1의 주문일 때
  When 평균을 계산
  Then `minOrderPadding > 0`인 주문 2건만 분모로 사용해 `5000 / 2 = 2500`이 되고, 해당 주문이 0건이면 평균은 "0원"으로 표시됨
- AC-3 [U][P1]: Scenario: 플랫폼별 비중 시각화
  Given `minOrderPadding > 0`인 주문이 2개 플랫폼에 분포할 때
  When `/savings` 렌더
  Then `data-testid="padding-minibar"` MiniBar의 막대 개수가 2개이고 합계 비율이 100%로 표시됨
- AC-4 [S][P1]: Scenario: 빈 상태
  Given 선택한 달의 `totalPadding === 0` 일 때
  When `/savings` 진입
  Then `data-testid="padding-section"`에 "최소주문 때문에 더 쓴 돈이 없어요 👍"가 표시되고 MiniBar는 렌더되지 않음
- AC-5 [S][P1]: Scenario: 로딩 상태
  While 데이터 로딩 중 `data-testid="padding-section"`은 TDS Skeleton 1개를 표시하고 합계 숫자를 노출하지 않음
- AC-6 [W][P1]: Scenario: 음수·비정상 값 에러 방어
  Given 저장된 주문 중 `minOrderPadding` 값이 `-1000` 또는 `null`인 레코드가 있을 때
  When 집계 수행
  Then 해당 값은 `0`으로 취급되어 합계에 영향을 주지 않고, 화면에 "-1,000원"·"NaN"이 표시되지 않음
- AC-7 [W][P1]: Scenario: 동점 플랫폼 처리 에러 방지
  Given 두 플랫폼의 추가지출 합계가 모두 `3000`으로 같을 때
  When "가장 많은 곳"을 계산
  Then `PLATFORM_LABEL` 기준 가나다순으로 앞선 플랫폼 1개만 표시되고, 두 플랫폼명이 동시에 표시되거나 "undefined"가 표시되지 않음

---

### F7. 월 배달비 목표 설정 · 초과 경고

- Description: 한 달 배달팁 목표 금액을 설정하고, 홈에서 목표 대비 사용률을 진행바와 함께 보여준다. 80% 도달 시 주의 배지, 100% 초과 시 해당 월 1회만 경고 다이얼로그를 띄운다. 목표는 `AppSettings.monthlyTipGoal` 한 값으로 모든 달에 공통 적용한다.
- Data: `AppSettings.monthlyTipGoal`, `AppSettings.goalAlertedMonths`, `MonthlySummary.totalTip`
- API: 없음
- Requirements: 화면 `/settings/goal`, 홈의 `data-testid="goal-progress-card"`

- AC-1 [E][P0]: Scenario: 목표 저장
  Given `/settings/goal`에서 현재 목표가 `30000`일 때
  When 값을 `50000`으로 바꾸고 "저장하기" 탭
  Then `dtt:settings:v1`의 `monthlyTipGoal === 50000`이 되고 Toast "목표를 저장했어요" 표시 후 `navigate(-1)`로 복귀함
- AC-2 [U][P0]: Scenario: 진행률 표시
  Given `monthlyTipGoal = 30000`, 이번 달 `totalTip = 24000` 일 때
  When 홈 진입
  Then `data-testid="goal-progress-card"`에 "24,000원 / 30,000원", "80%"가 표시되고 진행바 너비 비율이 `0.8`임
- AC-3 [S][P1]: Scenario: 주의 구간
  While `totalTip / monthlyTipGoal`이 0.8 이상 1.0 미만인 동안 목표 카드에 TDS Badge "목표 임박"이 표시되고 경고 다이얼로그는 표시되지 않음
- AC-4 [E][P0]: Scenario: 목표 초과 경고 1회
  Given `monthlyTipGoal = 30000`, 이번 달 `totalTip = 28000`, `goalAlertedMonths = []` 일 때
  When 배달팁 `3000`짜리 주문을 저장해 합계가 `31000`이 됨
  Then AlertDialog "이번 달 배달팁 목표를 넘었어요"(본문 "31,000원 / 목표 30,000원")가 1회 표시되고
  And `goalAlertedMonths`에 `"2026-09"`가 추가되며, 같은 달에 주문을 추가 저장해도 다이얼로그가 다시 표시되지 않음
- AC-5 [W][P1]: Scenario: 목표 하한 미만 검증 에러
  Given `/settings/goal`에서
  When 목표 값을 `0`으로 입력하고 "저장하기" 탭
  Then 에러 텍스트 "목표 금액은 1,000원 이상으로 입력해주세요"가 표시되고 `dtt:settings:v1.monthlyTipGoal`은 변경되지 않음
- AC-6 [W][P1]: Scenario: 목표 상한 초과 검증 에러
  Given `/settings/goal`에서
  When 목표 값을 `2000000`으로 입력하고 "저장하기" 탭
  Then 에러 텍스트 "목표 금액은 1,000,000원 이하로 입력해주세요"가 표시되고 저장되지 않음
- AC-7 [S][P1]: Scenario: 목표 미달성 빈 상태 / 로딩
  Given `monthlyTipGoal`이 기본값 `30000`이고 이번 달 주문이 0건일 때
  When 홈 진입
  Then 로딩 중에는 목표 카드 자리에 Skeleton 1개가 표시되고, 로딩 후 "0원 / 30,000원", "0%", "목표 수정" 텍스트 버튼이 표시되며 진행바는 0 너비로 렌더됨
- AC-8 [E][P2]: Scenario: 목표 수정 진입 계측
  Given 홈 목표 카드에서
  When "목표 수정" 탭
  Then `logClick('edit_goal')`가 1회 호출되고 `navigate('/settings/goal', { state: { currentGoal: 30000 } })`로 이동함

---

### F8. 월간 리포트 (리워드 광고 게이트) · 공유 카드

- Description: 선택한 달의 배달팁 총액, 주문 횟수, 플랫폼 1위, 픽업 절약 가능액, 최소주문 추가금, 전월 대비 증감을 하나의 리포트 카드로 만든다. 리포트 본문은 `TossRewardAd`로 게이트하여 광고 시청 후 공개하며, 한 번 해제한 달은 재시청 없이 다시 볼 수 있다. 공개 후 `shareApp()` 공유 버튼과 `requestReviewOnce()`를 노출하고, 광고 실패·공유 실패·전월 데이터 없음 에러를 각각 화면에서 복구한다.
- Data: `MonthlySummary`(현재 월/전월), `AppSettings.reportUnlockedMonths`, `AppSettings.reviewRequested`
- API: 없음
- Requirements: 화면 `/report`. 공유는 `shareApp()`만 사용(외부 URL 금지).

- AC-1 [E][P0]: Scenario: 결과 보기 전 보상형 광고
  Given `/report`에서 대상 월 `2026-09`가 `reportUnlockedMonths`에 없을 때
  When "리포트 보기" 버튼을 탭해 `logClick('view_monthly_report')`가 호출되고 `TossRewardAd` 광고 시청이 완료됨
  Then `data-testid="report-card"`가 표시되고 `reportUnlockedMonths`에 `"2026-09"`가 추가되며 `logImpression('report_card')`가 1회 호출됨
- AC-2 [S][P0]: Scenario: 해제된 달 재열람
  Given `reportUnlockedMonths`에 `"2026-09"`가 있을 때
  While `/report`의 대상 월이 `2026-09`인 동안 광고 시청 없이 `data-testid="report-card"`가 즉시 표시되고 "리포트 보기" 버튼은 렌더되지 않음
- AC-3 [U][P0]: Scenario: 리포트 수치와 카드 레이아웃
  Given `2026-09`의 `totalTip = 31000`, `orderCount = 9`, `pickupSavable = 12000`, `totalPadding = 5000`, 1위 플랫폼 `BAEMIN`이고 `2026-08`의 `totalTip = 24000` 일 때
  When 리포트가 공개됨
  Then `data-testid="report-card"` TDS Card 1개 안에 `SummaryHero`(CountUp, "31,000원")와 `data-testid="report-sparkline"`(일자별 `dailyTips`)이 포함되고
  And "주문 9회", "전월 대비 +7,000원 (+29.2%)", "픽업했다면 12,000원 절약", "최소주문 추가 5,000원", "가장 많이 쓴 곳: 배달의민족"이 표시됨
- AC-4 [E][P0]: Scenario: 공유 및 리뷰 요청
  Given 리포트가 공개된 상태이고 `reviewRequested === false` 일 때
  When "공유하기" 버튼 탭
  Then `logClick('share_report')` 호출 후 `shareApp()`이 1회 호출되고 `window.open`·`window.location.href`는 0회 호출되며
  And 리포트 공개 시점에 `requestReviewOnce()`가 1회 호출되고 `dtt:settings:v1.reviewRequested === true`로 저장됨
- AC-5 [W][P1]: Scenario: 광고 로드/시청 실패 에러 (reward ad error)
  Given `TossRewardAd`가 로드 실패하거나 사용자가 광고를 중도 종료했을 때
  When 실패 콜백이 발생
  Then Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"가 표시되고, `data-testid="report-card"`는 렌더되지 않으며, `reportUnlockedMonths`는 변경되지 않고 "다시 시도" 버튼(44px 이상)이 표시되며 `console.error`는 0회 호출됨
- AC-6 [W][P1]: Scenario: 공유 실패 에러 (share error)
  Given 리포트가 공개된 상태에서 `shareApp()`이 reject 되거나 예외를 던질 때
  When "공유하기" 버튼 탭
  Then 예외가 화면 크래시로 이어지지 않고 Toast "공유하지 못했어요. 다시 시도해주세요"가 표시되며, 리포트 카드는 계속 표시되고 `reportUnlockedMonths`는 변경되지 않음
- AC-7 [S][P1]: Scenario: 기록 없는 달 빈 상태 / 로딩
  Given 대상 월의 `orderCount === 0` 일 때
  When `/report` 진입
  Then 로딩 중에는 리포트 Card 자리에 Skeleton 1개가 표시되고, 로딩 후 광고 게이트 없이 `Asset.ContentIcon`과 "이 달은 배달 기록이 없어요"가 표시되며 "리포트 보기"·"공유하기" 버튼은 렌더되지 않음
- AC-8 [W][P1]: Scenario: 전월 데이터 없음 — 계산 에러 방지
  Given `2026-08` 주문이 0건이고 `2026-09`의 `totalTip = 31000` 일 때
  When 리포트가 공개됨
  Then "전월 대비" 항목은 "전월 기록 없음"으로 표시되고 화면 텍스트에 "NaN"·"Infinity"·"%NaN"이 0개임

---

## Screen Definitions

공통: 모든 화면은 `ScreenScaffold`로 감싸고 상단은 TDS `Top`을 사용한다. 하단 탭은 `FloatingTabBar` 4탭 — 홈(`/`), 기록(`/orders`), 리포트(`/report`), 설정(`/settings/goal`). 화면 진입·체류 로그는 `PageShell`이 자동 기록한다.

### S1. 홈 (`/`)

- TDS 컴포넌트: `Top`(타이틀 "이번 달 배달팁"), `SummaryHero`(CountUp), `Card` ×3, `Sparkline`, `MiniBar`, `ListRow` ×3(최근 주문), `Badge`, `Button`(display="block", `SubmitFooter` 내), `Chip`(이전/다음 달), `Skeleton`, `Asset.ContentIcon`, `Spacing`
- 레이아웃 계약: `ScreenScaffold` → 월 선택 Chip 행 → `data-testid="tip-summary-hero"`(t2 강조) → `data-testid="goal-progress-card"`(진행바+Badge) → `data-testid="tip-trend-sparkline"` → `data-testid="platform-minibar"` → `data-testid="recent-orders-card"` → `<AdSlot />` → `SubmitFooter`("배달 기록하기", display="block")
- 상태: 로딩 = Skeleton 3개 / 빈 상태 = `Asset.ContentIcon` + "이번 달 배달 기록이 아직 없어요" / 에러 = Toast "저장된 기록을 불러오지 못했어요" 후 빈 상태 렌더
- 터치: 모든 Chip·ListRow·버튼 높이 ≥ 48px. `SubmitFooter` 버튼 높이 56px, `safe-area-inset-bottom` 반영
- Navigation state contract
  - Outgoing: "배달 기록하기" → `navigate('/orders/new')`
  - Outgoing: "픽업했다면?" 카드 → `navigate('/savings', { state: { month: string } })`
  - Outgoing: "목표 수정" → `navigate('/settings/goal', { state: { currentGoal: number } })`
  - Outgoing: 최근 주문 ListRow → `navigate('/orders/' + id + '/edit', { state: { order: DeliveryOrder } })`
  - Outgoing: "월간 리포트 보기" → `navigate('/report', { state: { month: string } })`
  - Incoming: `location.state = { savedOrderId?: string } | null` (표시에 사용하지 않고 무시 가능)
- Instrumentation: `logClick('home_add_order')`(기록하기), `logClick('open_pickup_savings')`(픽업 카드), `logClick('open_monthly_report')`(리포트 진입), `logClick('edit_goal')`(목표 수정), `logImpression('home_banner')`(AdSlot 렌더 시 1회)

### S2. 주문 기록 (`/orders/new`)

- TDS 컴포넌트: `Top`("배달 기록"), `TextField` ×4(주문금액/배달팁/최소주문 추가금액/메모), `Chip` ×4(플랫폼), `ListRow`+`Switch`(픽업 가능), 날짜 선택 `BottomSheet`, `Button`(`SubmitFooter`), `Toast`, `AlertDialog`
- 레이아웃 계약: `ScreenScaffold` → 날짜 ListRow → 플랫폼 Chip 행 → 금액 입력 Card → 픽업 Switch ListRow → `SubmitFooter`("저장하기", display="block")
- 모바일 키보드: 금액 TextField는 `inputMode="numeric"`, `enterKeyHint="next"`, 마지막 필드는 `"done"`. 포커스 시 해당 필드를 `scrollIntoView({ block: 'center' })`하고 `SubmitFooter`는 키보드 위에 유지된다. 메모는 `maxLength={30}`
- 상태: 로딩 = 초기값 준비 중 폼 Skeleton 1개 / 빈 상태 해당 없음 / 에러 = 필드 하단 인라인 에러 텍스트 + 저장 실패 시 AlertDialog "저장 공간이 부족해요"
- 터치: Chip 높이 44px 이상, Switch 터치 영역 48px, 저장 버튼 56px
- Navigation state contract
  - Outgoing: 저장 성공 → `navigate('/', { replace: true, state: { savedOrderId: string } })`
  - Outgoing: 뒤로 → `navigate(-1)`
  - Incoming: `location.state = { presetDate?: string } | null`
- Instrumentation: `logClick('save_order')`(저장하기 탭 시 1회)

### S3. 주문 목록 (`/orders`)

- TDS 컴포넌트: `Top`("기록"), `Tab`(월 전환), `ListRow`(항목), `Badge`(플랫폼), `Skeleton`, `Asset.ContentIcon`, `Button`(빈 상태 CTA, display="block"), `Spacing`
- 레이아웃 계약: `ScreenScaffold` → 월 `Tab` → 월별 섹션 헤더 → ListRow 목록 → (10번째 뒤) `<AdSlot />` → 무한 스크롤 센티널
- 스크롤: 초기 30개 렌더, `IntersectionObserver`로 30개씩 추가 로드. 스크롤 위치는 뒤로가기 시 복원(`sessionStorage['dtt:scroll:/orders']`)
- 상태: 로딩 = ListRow Skeleton 5개 / 빈 상태 = `Asset.ContentIcon` + "아직 기록이 없어요" + "첫 배달 기록하기" / 에러 = Toast "저장된 기록을 불러오지 못했어요"
- 터치: ListRow 높이 ≥ 64px
- Navigation state contract
  - Outgoing: ListRow 탭 → `navigate('/orders/' + id + '/edit', { state: { order: DeliveryOrder } })`
  - Outgoing: 빈 상태 CTA → `navigate('/orders/new')`
  - Incoming: `location.state = { focusMonth?: string } | { deletedId?: string } | null`
- Instrumentation: 없음(전환 지점 아님, 진입·체류는 PageShell 자동)

### S4. 주문 수정 (`/orders/:id/edit`)

- TDS 컴포넌트: S2와 동일 + `Button`(weak, "삭제"), `AlertDialog`(삭제 확인), `Toast`
- 레이아웃 계약: S2와 동일 폼 구성. `SubmitFooter`에 "수정하기"(display="block"), 그 위 본문 최하단에 "삭제" 텍스트 버튼
- 모바일 키보드: S2와 동일
- 상태: 로딩 = 폼 Skeleton / 대상 없음 = Toast "기록을 찾을 수 없어요" 후 `/orders`로 replace / 에러 = 인라인 에러 텍스트
- 터치: 삭제 버튼 44px 이상, 수정 버튼 56px
- Navigation state contract
  - Incoming: `location.state = { order: DeliveryOrder } | null` — `null`이면 `useParams().id`로 F1 `getOrder(id)` 조회, 없으면 `/orders`로 replace
  - Outgoing: 수정 성공 → `navigate(-1)`
  - Outgoing: 삭제 성공 → `navigate('/orders', { replace: true, state: { deletedId: string } })`
- Instrumentation: 없음

### S5. 픽업 절약 시뮬레이션 (`/savings`)

- TDS 컴포넌트: `Top`("픽업했다면"), `Card` ×2, `Badge`("추정"), `SummaryHero`(CountUp), `MiniBar`, `Paragraph.Text`(고지), `Skeleton`, `Asset.ContentIcon`, `Chip`(월 이동)
- 레이아웃 계약: `ScreenScaffold` → `data-testid="savings-hero"` → `data-testid="savings-card"` Card 2개(절약 가능액 / 최소주문 추가금 `data-testid="padding-section"`) → `data-testid="padding-minibar"` → 고지 `Paragraph.Text` → `<AdSlot />`
- 상태: 로딩 = Card 2개 자리 Skeleton / 빈 상태 = `Asset.ContentIcon` + "픽업 가능으로 기록한 주문이 없어요" / 에러 = 모든 금액 "0원" 폴백 + Toast "저장된 기록을 불러오지 못했어요"
- 터치: 월 이동 Chip 44px 이상
- Navigation state contract
  - Incoming: `location.state = { month: string } | null` — 형식이 `^\d{4}-\d{2}$`가 아니거나 `null`이면 이번 달로 대체
  - Outgoing: "이번 달 리포트 보기" → `navigate('/report', { state: { month: string } })`
- Instrumentation: `logImpression('savings_card')`(절약 Card 최초 렌더 1회), `logClick('savings_to_report')`

### S6. 목표 설정 (`/settings/goal`)

- TDS 컴포넌트: `Top`("월 배달비 목표"), `TextField`(금액), `Chip` ×3(30,000 / 50,000 / 100,000 빠른 선택), `Button`(`SubmitFooter`, "저장하기"), `Paragraph.Text`(데이터 보관 고지), `Toast`, `Skeleton`
- 레이아웃 계약: `ScreenScaffold` → 목표 TextField → 빠른 선택 Chip 행 → 설명 `Paragraph.Text`("기록은 이 기기에만 저장돼요") → `SubmitFooter`
- 모바일 키보드: `inputMode="numeric"`, `enterKeyHint="done"`, 포커스 시 `SubmitFooter`가 키보드 위 유지
- 상태: 로딩 = TextField Skeleton 1개 / 빈 상태 = 기본값 30,000 프리필 / 에러 = 인라인 에러 텍스트("목표 금액은 1,000원 이상으로 입력해주세요")
- 터치: Chip 44px, 저장 버튼 56px
- Navigation state contract
  - Incoming: `location.state = { currentGoal: number } | null` — `null`이면 `getSettings().monthlyTipGoal` 사용
  - Outgoing: 저장 성공 → `navigate(-1)`
- Instrumentation: `logClick('save_goal')`

### S7. 월간 리포트 (`/report`)

- TDS 컴포넌트: `Top`("월간 리포트"), `Tab`(월 선택), `TossRewardAd`(게이트), `Card`(리포트), `SummaryHero`(CountUp), `Sparkline`, `MiniBar`, `Badge`(증감), `Button`(display="block", "공유하기" / "다시 시도"), `Toast`, `Skeleton`, `Asset.ContentIcon`
- 레이아웃 계약: `ScreenScaffold` → 월 `Tab` → (미해제 시) 안내 Card + `TossRewardAd`로 감싼 "리포트 보기" 버튼 → (해제 시) `data-testid="report-card"` Card 1개 안에 `SummaryHero` + `data-testid="report-sparkline"` + 지표 MiniBar + 증감 Badge → `SubmitFooter`("공유하기", display="block")
- 상태: 로딩 = 리포트 Card Skeleton 1개 / 빈 상태 = `Asset.ContentIcon` + "이 달은 배달 기록이 없어요" / 광고 에러 = Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요" + "다시 시도" 버튼 / 공유 에러 = Toast "공유하지 못했어요. 다시 시도해주세요"
- 터치: 월 Tab 44px 이상, "리포트 보기"·"공유하기"·"다시 시도" 56px
- Navigation state contract
  - Incoming: `location.state = { month: string } | null` — 형식 불일치·`null`이면 이번 달
  - Outgoing: "기록 더 보기" → `navigate('/orders', { state: { focusMonth: string } })`
- Instrumentation: `logClick('view_monthly_report')`(리포트 보기 버튼), `logImpression('report_card')`(리포트 공개 1회), `logClick('share_report')`(공유), 리포트 공개 직후 `requestReviewOnce()` 1회

---

## Data Storage

| 키 | 타입 | 기본값 | 쓰기 시점 | 크기 |
|---|---|---|---|---|
| `dtt:orders:v1` | `DeliveryOrder[]` | `[]` | 주문 추가/수정/삭제, 손상 레코드 정제 | 190B × 최대 2,000 ≈ **380KB** |
| `dtt:settings:v1` | `AppSettings` | `{ monthlyTipGoal: 30000, defaultPlatform: 'BAEMIN', goalAlertedMonths: [], reportUnlockedMonths: [], reviewRequested: false, schemaVersion: 1 }` | 목표 저장, 플랫폼 기본값 갱신, 목표 경고 표시, 리포트 해제, 리뷰 요청 | ≈ **400B** |
| `dtt:onboard:v1` | `"1"` | 없음 | 최초 진입 안내 확인 시 | **2B** |
| `sessionStorage['dtt:scroll:/orders']` | `string`(px) | 없음 | 목록 스크롤 이탈 시 | ≈ **8B** |

- 총 사용량 상한 ≈ **0.38MB** (5MB 한도의 8%).
- `goalAlertedMonths`·`reportUnlockedMonths`는 각각 최근 24개만 유지하고 초과분은 오래된 순으로 제거한다.
- 모든 쓰기는 `try/catch`로 감싸고 `QuotaExceededError`는 `{ ok: false, reason: "QUOTA" }`로 변환한다(F1 AC-6).
- 마이그레이션: `schemaVersion !== 1`이면 설정을 기본값으로 재초기화하고 주문 데이터는 보존한다.

## API Contract

외부 API 호출 없음. 모든 데이터는 클라이언트 localStorage에 저장되며 서버·네트워크 의존성이 0이다. 따라서 엔드포인트·에러 코드 정의가 없고, CORS 설정 대상도 없다(AC-G7). 향후 기기 간 동기화가 필요해지면 별도 Railway API 서버를 신설하고, 에러 응답은 `{ error: string }` 단일 형태로 통일한다.

## Assumptions

- A1. 사용자는 배달 주문 직후 수동으로 기록한다. 배달앱 연동·영수증 파싱·문자 스크래핑은 범위 밖이다.
- A2. 기기 1대 기준 로컬 저장만 지원한다. 앱 삭제·브라우저 저장소 삭제 시 데이터는 복구되지 않으며, 설정 화면에 이 사실을 문구로 고지한다.
- A3. 목표 금액은 월별 개별 설정이 아니라 전 기간 공통 단일 값(`monthlyTipGoal`)이다.
- A4. `pickupAvailable`은 사용자가 기록 시 직접 판단해 입력하는 값이며, 앱이 매장 픽업 가능 여부를 검증하지 않는다.
- A5. 픽업 절약액은 배달팁 + 최소주문 추가금의 단순 합이며 이동 시간·교통비를 반영하지 않는다(화면 고지, F5 AC-2).
- A6. 본 앱은 생성형 AI를 사용하지 않는다(모든 수치는 사용자 입력에 대한 결정론적 사칙연산). 따라서 AI 사전 고지·AI 결과 라벨 요구사항은 적용 대상이 아니다. 향후 AI 코멘트 기능을 추가하면 해당 AC를 신설해야 한다.
- A7. 수익화는 배너 광고(홈·목록·절약)와 리포트 리워드 광고만 사용한다. IAP(`TossPurchase`)와 프로모션 리워드(`grantPromotionReward`)는 MVP 범위 밖이다.
- A8. 시간대는 `Asia/Seoul` 고정이며, 월 경계는 KST 자정 기준으로 판정한다.
- A9. 플랫폼 목록은 4종(배달의민족/쿠팡이츠/요기요/기타) 고정이며 사용자 커스텀 추가는 없다.

## Open Questions

- Q1. 리포트 리워드 광고를 "월 1회 해제 후 영구 열람"으로 할지, "매달 재시청"으로 할지 — 현재 SPEC은 월 단위 1회 해제(F8 AC-2)로 확정했으나, eCPM 목표에 따라 변경 가능.
- Q2. 주문 2,000건 상한 도달 시 정책 — 현재는 저장 거부(F1 AC-5). 24개월 초과분 자동 아카이브로 바꿀지 결정 필요.
- Q3. 최소주문 추가금액을 매번 입력받는 것이 10초 입력 목표를 해치는지 — 대안: "최소주문 채우려 더 담았어요" Switch만 켜고 금액은 선택 입력.
- Q4. 월간 리포트 공유가 `shareApp()` 텍스트 공유로 충분한지, 이미지 카드(Canvas 렌더 후 공유)까지 필요한지 — 후자는 별도 패킷 필요.
- Q5. 재방문 유도 수단(푸시 없음) — 홈 진입 시 "어제 배달 기록하셨나요?" 배너를 둘지 여부.
- Q6. 배달앱 멤버십 구독료를 별도 필드로 받을지 — PRD 범위 밖이지만 월 합계 정확도에 영향.

---

**수정 사항 요약 (검증 오류 대응)**

| 오류 | 수정 |
|---|---|
| F1 에러/엣지 AC 부족 (1개) | AC-4(invalid input error), AC-5(limit error), AC-6(quota error), AC-7(corrupted record error) — 모두 `[W][P1]`로 명시, 시나리오명에 에러 유형 표기 |
| F5 에러/엣지 AC 부족 (0개) | AC-4(손상 레코드 계산 에러 방어) 신설, AC-7(0 나눗셈 에러), AC-8(잘못된 월 파라미터 에러 복구) — 3개 `[W][P1]`. 기존 고지 문구 AC는 AC-2 레이아웃 계약으로 통합해 AC 8개 유지 |
| F8 에러/엣지 AC 부족 (0개) | AC-5(리워드 광고 실패 에러), AC-6(공유 실패 에러 — 신설), AC-8(전월 데이터 없음 계산 에러) — 3개 `[W][P1]`. 기존 레이아웃 AC는 AC-3에 통합 |

추가로 `StorageResult` 타입을 Data Models에 명시해 에러 반환 형태(`reason: 'LIMIT' | 'QUOTA' | 'INVALID' | 'NOT_FOUND'`)를 기능 간 일관되게 고정했고, F3·F4·F6·F7의 에러 AC 시나리오명에도 에러 유형을 명시했습니다.