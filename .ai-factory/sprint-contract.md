# Sprint Contract: 라우팅 와이어링 + Provider 연결 + 광고/결제 연동

## 목표
App.tsx 진입점 완성: 모든 화면 라우팅 검증, 전역 Provider 추가(광고/결제 SDK), 최종 UX 폴리시 적용

## 만들 항목

### 1. src/App.tsx
- **변경 내용**: `@ai-factory:providers` 마크 위치에 전역 Provider 추가
  - 광고/결제 SDK 초기화 Provider (필요 시)
  - AppState Provider (useState 또는 Context)
  - 라우팅: Home / OrderNew / OrderList / OrderEdit / Savings / Report / GoalSettings 모두 연결 ✅ (이미 완성)
- **절대 금지**: 라우트 경로 변경/삭제, 기존 import 제거

### 2. src/lib/types.ts
- **import 대상** (사용): `DeliveryOrder`, `OrderInput`, `AppSettings`, `MonthlySummary`, `RouteState`, `Platform`, `PLATFORM_LABEL`
- **상태**: 이미 완성 (수정 불필요)

## 검증 방법

1. **TypeScript**: `npx tsc --noEmit` — 0 errors
2. **라우팅**: 각 경로가 올바른 화면을 렌더하는지 확인 (`/` → Home, `/orders/new` → OrderNew 등)
3. **빌드**: `npx vite build` — dist/ 생성됨
4. **스모크**: `npm run test:visual` — 흰 화면/콘솔 에러 없음

## 절대 금지 사항

- ❌ `src/main.tsx` 수정 (@AI:ANCHOR)
- ❌ 라우트 경로 변경 (화면 파일이 이 경로로 navigate함)
- ❌ 스토리지/타입 재정의 (types.ts의 단일 소스)
- ❌ SDK 임포트를 App.tsx에서 직접 호출 (Provider로만)

## 컨텍스트

- 모든 화면 파일 완성: Home.tsx, OrderNew.tsx, OrderList.tsx, OrderEdit.tsx, Savings.tsx, Report.tsx, GoalSettings.tsx
- 스토리지/계산 로직 완성: src/lib/store, src/lib/analytics, src/lib/review, src/lib/share
- 스캐폴드 라우트 이미 깔림: @ai-factory:wiring-first 적용
