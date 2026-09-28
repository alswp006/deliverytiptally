# 디자인 품질 감사 보고서 — 배달비 누적기

- 감사일: 2026-09-29
- 대상: `src/` 전체 (7 페이지, 12 컴포넌트, lib 전체)
- 방법: 정적 코드 검사(Grep/AST 유사 패턴) + `npx tsc --noEmit` + `npx vitest run` + `npx vite build`

## 종합 점수

| 차원 | 점수 (0-4) |
|---|---|
| 접근성 (Accessibility) | **3** |
| 성능 (Performance) | **3** |
| 다크모드 (Theming) | **4** |
| TDS 준수 (Design System Compliance) | **4** |

---

## 1. 접근성 — 3/4 (대부분 충족)

**양호한 점**
- 아이콘 전용 버튼(`FloatingTabBar`, `IconButton`, `Sparkline` svg)에 전부 `aria-label` 지정됨.
- `FloatingTabBar`가 `role="tablist"` / `role="tab"` / `aria-selected`를 올바르게 사용(직접 구현했지만 네이티브 탭 시맨틱 준수).
- `MiniBar`가 `role="progressbar"` + `aria-valuenow/min/max` 지정.
- `OrderList`의 플랫폼 필터 버튼이 `aria-pressed`로 토글 상태를 노출(`src/pages/OrderList.tsx:167`).
- 폼 입력 전부 `inputMode`/`enterKeyHint` 지정(`OrderNew.tsx`, `OrderEdit.tsx`) — 규칙서의 Form Behavior 요건 충족.
- 모든 상호작용 요소가 시맨틱 HTML(`<button>`, `<input>`) 기반 — 커스텀 `onClick`-div 패턴 없음.
- 색상만으로 정보를 전달하지 않음 — `Badge`(목표 달성/임박)는 항상 텍스트 라벨 동반.
- `Top`은 어느 화면에서도 title만 사용 — 커스텀 뒤로가기/닫기 버튼 없음(토스 내비게이션 바와 중복 노출 없음, 출시 가이드 반복 위반 ① 회피 확인).
- 명암비: 모든 색상이 TDS `var(--adaptive*)` 토큰이라 WCAG AA는 TDS 디자인 시스템이 보장하는 영역(자체 하드코딩 없음 확인).

**발견된 이슈 (P2 — 보고만, 수정 안 함)**
- `FloatingTabBar`(`src/components/FloatingTabBar.tsx:46-82`)의 탭 버튼은 `<nav role="tablist">` 안의 `<button role="tab">`인데, 실제 ARIA tab 패턴은 화살표 키(←/→)로 탭 간 이동을 지원해야 한다. 현재는 기본 Tab 키 순서만 지원(각 버튼이 개별 tabstop). 라우팅 네비게이션 용도로는 통상 허용되는 변형이지만 엄격한 WAI-ARIA APG 기준으로는 미충족.
- `Card`, `SummaryHero` 등 순수 표시용 컨테이너에 `role`이 없어 스크린리더가 카드 경계를 읽어주지 않음(내용은 각 텍스트가 개별로 읽히므로 정보 손실은 아니나, 그룹핑 컨텍스트 부재).

이슈가 경미하고("대부분 충족" 수준) 비즈니스 로직/레이아웃 변경 없이 고치려면 ARIA 패턴 재설계가 필요해 자동 수정 범위(P0/P1) 밖으로 판단해 보고만 함.

---

## 2. 성능 — 3/4 (양호, 자동 수정 1건 반영)

**수정함 (P1)**
- `src/pages/Home.tsx`: `Amount` 컴포넌트를 import했지만 실제로는 어디서도 사용하지 않음 → 미사용 import 제거.
- `src/pages/Report.tsx`: 동일하게 `Amount` 미사용 import 제거.
  - `tsconfig.json`의 `noUnusedLocals: false`라 tsc가 잡지 못했던 사각지대. 두 파일 모두 제거 후 `npx tsc --noEmit` / `npx vitest run`(228 tests) / `npx vite build` 재확인 — 모두 통과.

**양호한 점**
- 파생 값 계산(`summarize`, `calcSavings`, `dateOptions` 등)에 `useMemo` 적절히 적용됨 — 렌더마다 재계산되는 무거운 로직 없음.
- `<img>` 태그 없음(아이콘은 전부 TDS `Asset.ContentIcon` SVG) — 이미지 lazy-loading 이슈 자체가 발생하지 않는 구조.
- 무거운 차트 라이브러리(D3, Three.js 등) 미사용 — `Sparkline`/`MiniBar`를 의존성 0의 인라인 SVG/div로 자체 구현(정책 준수).
- 개발 전용 `__TdsGallery` 페이지는 `import.meta.env.DEV` 정적 분기로 프로덕션 빌드에서 완전히 트리셰이킹됨(`src/App.tsx:14-16`) — 확인: `npx vite build` 산출물에 해당 청크 없음.

**발견된 이슈 (P2 — 보고만)**
- `npx vite build` 산출물이 단일 청크 1,520KB(gzip 486KB)로, Vite 기본 경고 임계값(500KB)을 초과. 라우트 단위 코드 스플리팅(`React.lazy` + `Suspense`)을 적용하면 초기 로드 시 필요한 화면만 받아 개선 가능. 다만 TDS/이모지 프레임워크 자체가 번들의 큰 비중을 차지하고(플랫폼 필수 의존성이라 제거 불가), 라우트 스플리팅은 각 화면의 로딩 상태·Suspense 경계 설계가 필요한 구조 변경이라 이번 감사의 자동 수정 범위(P0/P1, 비즈니스 로직 불변경)를 벗어난다고 판단해 보고만 함. 번들 크기는 여전히 앱인토스 100MB 제한에는 크게 못 미침.

---

## 3. 다크모드 — 4/4 (완전 토큰화)

**검증 결과**
- 전체 `src/` 트리에서 하드코딩된 HEX 값(`#RGB`/`#RRGGBB`/`#RRGGBBAA`) **0건**.
- `rgba()`/`rgb()`/리터럴 `"white"`/`"black"` 색상 **0건**.
- 커스텀 CSS(`style={{...}}`)에서 사용된 색상은 전부 `var(--adaptive*)` 토큰(`--adaptiveBackground`, `--adaptiveGrey100/200/700`, `--adaptiveBlue500`, `--adaptiveLayeredBackground`) — `Card`, `MiniBar`, `Sparkline`, `FloatingTabBar` 전부 확인.
- `src/styles/globals.css`에도 색상 관련 하드코딩 없음(레이아웃/safe-area 규칙만 존재).
- `src/main.tsx`(`@AI:ANCHOR`)의 `TDSMobileAITProvider` 래핑 유지 확인 — `--adaptive*`/`--toss-safe-area-*` CSS 변수 자동 주입 경로가 손상되지 않음.

수정할 항목 없음.

---

## 4. TDS 준수 — 4/4 (TDS 모범 사례)

**검증 결과**
- Tailwind 클래스(`className=`) 사용 **0건** — 전체 `src/`에서 미검출.
- `Button` variant는 전 사용처에서 `'fill' | 'weak'`만 사용(`OrderList.tsx`, `Home.tsx`, `OrderEdit.tsx`, `Report.tsx`, `Savings.tsx`, `GoalSettings.tsx` 등 전수 확인) — 존재하지 않는 variant 사용 없음.
- `TextField`는 모든 사용처에서 `variant` 필수 prop 지정(`box`) + `placeholder` 동반(빈 칸이 라벨 없이 뜨는 문제 없음, `OrderNew.tsx`/`OrderEdit.tsx`/`GoalSettings.tsx` 확인).
- `ListRow`에 `padding` prop을 준 사례 **0건**(금지 규칙 준수) — 간격은 전부 `Spacing`으로 처리.
- 버튼 중첩(`<button><button>`) 패턴 없음 — `FixedBottomCTA`(`OrderNew.tsx`, `OrderEdit.tsx`)는 children에 라벨 텍스트만 직접 전달, 내부에 `<Button>` 미포함.
- `ListRow onClick` 방식(주문 목록 → 수정 이동)은 `right` 슬롯에 텍스트만 두고 별도 액션 버튼을 넣지 않아 `<li><button>` 중첩 이슈 자체가 없음.
- Pre-built 컴포넌트(`ScreenScaffold`, `Card`, `SummaryHero`, `FloatingTabBar`, `StateView`, `MiniBar`, `Sparkline`, `Amount`, `CountUp`, `AdSlot`)를 재구현하지 않고 그대로 조립해 사용 — raw div 골격 없음(레이아웃 목적의 flex 컨테이너 `style={{ display: 'flex', gap }}`만 존재, 규칙상 허용 범위).
- SDK 호출(`generateHapticFeedback`, `TossAds.*`)은 전부 try/catch 가드 확인(`AdSlot.tsx`, `FloatingTabBar.tsx`) — WebView 밖 throw로 인한 흰 화면 위험 없음.

수정할 항목 없음.

---

## 적용한 수정 (P0/P1만)

| 파일 | 변경 | 근거 |
|---|---|---|
| `src/pages/Home.tsx` | 미사용 `import { Amount } from '../components/Amount'` 제거 | 성능 체크리스트 "미사용 import/의존성" |
| `src/pages/Report.tsx` | 미사용 `import { Amount } from "@/components/Amount"` 제거 | 동일 |

수정 후 검증:
- `npx tsc --noEmit` — 통과 (에러 0)
- `npx vitest run` — 228/228 통과
- `npx vite build` — 통과 (dist 1.52MB, gzip 486KB, 100MB 제한 내)

## 보고만 하고 수정하지 않은 항목 (P2/P3)

1. **[P2/성능]** 단일 JS 청크 1.5MB(gzip 486KB) — 라우트 단위 `React.lazy` 코드 스플리팅 여지 있음. 각 화면에 Suspense 경계를 새로 설계해야 하는 구조 변경이라 이번 감사 범위 밖.
2. **[P2/접근성]** `FloatingTabBar`가 `role="tab"`을 쓰지만 화살표 키 이동(WAI-ARIA APG tab 패턴)은 미지원. 라우팅 네비게이션 용도로는 실질적 임팩트가 낮아 P2로 분류.
3. **[P3/접근성]** `Card`/`SummaryHero` 컨테이너에 그룹 role 부재 — 텍스트 개별 낭독에는 문제없으나 스크린리더 사용자의 카드 단위 탐색 편의성은 다소 떨어짐.
