🇰🇷 [English](./README.md)

# DeliveryTipTally — 배달 팁 및 주문 지출 추적

DeliveryTipTally는 토스 생태계의 미니앱으로, 사용자가 한국 배달 플랫폼 전반에서 배달 음식 주문, 팁, 지출을 추적하도록 돕습니다. 사용자는 주문을 기록하고, 월별 팁 목표를 모니터링하며, 지출 패턴 및 절약 기회에 대한 분석을 볼 수 있습니다.

## 기능

- 📝 **주문 기록** — 플랫폼, 음식 금액, 배달 팁 및 최소주문금액 보충비를 포함한 배달 주문 기록
- 💰 **지출 추적** — 총 팁, 음식 비용 및 보충비를 보여주는 월별 요약
- 🎯 **목표 관리** — 월별 팁 지출 목표를 설정하고 목표 초과 시 알림 받기
- 📊 **분석 및 리포트** — 스파클라인 차트, 플랫폼별 분석, 절약 추정액으로 월별 추이 보기
- 💾 **로컬 저장** — 모든 주문 데이터가 기기에 로컬로 저장됨(서버 불필요)
- 📱 **멀티탭 네비게이션** — 상태가 유지되는 4탭 인터페이스(홈, 주문, 리포트, 설정)
- 🌙 **다크 모드** — TDS 디자인 시스템을 통한 완전한 다크 모드 지원
- 📢 **인앱 광고** — 배너 및 리워드 광고(선택 사항, 환경 변수로 설정 가능)
- ✨ **햅틱 피드백** — 상호작용 시 네이티브 햅틱 피드백
- 📈 **이벤트 추적** — 주요 사용자 행동에 대한 내장 분석

## 기술 스택

- **Frontend:** Vite, React 18, TypeScript
- **Routing:** React Router 7
- **UI Components:** @toss/tds-mobile (Toss Design System)
- **SDK:** @apps-in-toss/web-framework
- **Styling:** Emotion, CSS variables (dark mode)
- **Icons:** Lucide React
- **Testing:** Vitest, Playwright
- **Build:** Vite (CSR/SSG only, no SSR)

## 시작하기

### 의존성 설치
```bash
npm install
```

### 타입 체크
```bash
npx tsc --noEmit
```

### 테스트 실행
```bash
npx vitest run              # Unit tests
npm run test:visual         # Visual regression tests (Playwright)
```

### 프로덕션 빌드
```bash
npx vite build              # Standard Vite build
npx ait build               # Apps-in-Toss (Toss CDN) bundle
```

표준 빌드는 로컬 테스트용으로 `dist/`에 출력됩니다. Apps-in-Toss(`ait`) 빌드는 토스 미니앱 플랫폼에 배포하기 위해 앱을 준비하며, `npx ait deploy`가 필요합니다(토스 개발자 콘솔을 통해 관리).

## 환경 변수

| 변수 | 설명 | 필수 |
|----------|-------------|----------|
| `VITE_SHARE_OG_URL` | 공유 링크의 Open Graph 이미지 URL(소셜 미리보기) | 아니요 |
| `VITE_TOSS_AD_SLOT_ID` | 토스 콘솔 리워드 광고 슬롯 ID(월별 리포트 잠금 해제) | 아니요 |
| `VITE_TOSS_AD_GROUP_ID` | 토스 콘솔 배너 광고 그룹 ID(홈/주문/절약 화면) | 아니요 |
| `VITE_TOSS_IAP_SKU` | 인앱 결제 SKU(예약됨, MVP에서 미사용) | 아니요 |
| `VITE_TOSS_PROMOTION_CODE` | 사용자 보상 프로모션 코드(예약됨, MVP에서 미사용) | 아니요 |

`.env.example`에서 `.env` 파일을 만들고 토스 개발자 콘솔에서 가져온 값으로 채웁니다. 값이 비어 있으면 기능이 우아하게 저하됩니다(예: 광고 미표시, 링크 공유는 미리보기 없이 작동).

## 프로젝트 구조

```
src/
├── pages/                      # 화면 컴포넌트
│   ├── Home.tsx               # 당월 요약이 있는 대시보드
│   ├── OrderNew.tsx           # 새 주문 생성
│   ├── OrderList.tsx          # 주문 목록 및 검색
│   ├── OrderEdit.tsx          # 기존 주문 편집/삭제
│   ├── Savings.tsx            # 절약 추정액 및 플랫폼 분석
│   ├── Report.tsx             # 월별 분석(리워드 광고 게이트됨)
│   └── GoalSettings.tsx       # 월별 팁 목표 설정
├── components/                 # 사전 구성된 UI 컴포넌트
│   ├── ScreenScaffold.tsx     # 페이지 레이아웃 래퍼
│   ├── SummaryHero.tsx        # 큰 헤드라인 숫자 표시
│   ├── Card.tsx               # 콘텐츠 카드 컨테이너
│   ├── Amount.tsx             # 형식화된 통화 표시
│   ├── FloatingTabBar.tsx     # 4탭 네비게이션
│   ├── StateView.tsx          # 빈/로딩 상태
│   ├── Sparkline.tsx          # 추이 스파클라인 차트
│   ├── MiniBar.tsx            # 인라인 진행 표시줄
│   ├── AdSlot.tsx             # 배너 광고 래퍼
│   └── TossRewardAd.tsx       # 리워드 광고 게이트 컴포넌트
├── lib/                        # 유틸리티 및 비즈니스 로직
│   ├── storage/               # 오류 처리 기능이 있는 LocalStorage 헬퍼
│   ├── analytics.ts           # 이벤트 추적(클릭, 노출)
│   ├── summary.ts             # 월별 요약 계산
│   ├── date.ts                # 날짜 유틸리티(YYYY-MM-DD, YYYY-MM 키)
│   ├── format.ts              # 형식화 헬퍼(KRW, 백분율, 날짜)
│   ├── types.ts               # 도메인 타입 및 상수
│   └── review.ts              # 앱 리뷰 요청
├── __tests__/                  # 단위 및 통합 테스트
├── App.tsx                     # 라우트 정의
└── main.tsx                    # React 루트(고정, 수정 금지)
```

## 배포

### 로컬 테스트
```bash
npm run build
npx vite preview     # Serve production build locally
```

### 토스 미니앱 배포
1. Apps-in-Toss용 빌드:
   ```bash
   npx ait build
   ```
2. `apps-in-toss.config.ts` 구성:
   - `appName`이 토스 콘솔 등록과 일치하는지 확인(대소문자 구분)
   - `brand.primaryColor`를 토스 브랜드 색상으로 설정
3. 토스 개발자 콘솔을 사용하여:
   - 빌드 아티팩트 업로드
   - 광고 슬롯/그룹 ID 및 환경 변수 구성
   - 토스 CDN에 대한 검수 및 배포 트리거

앱은 `https://<appName>.web.tossmini.com`(프로덕션) 및 `https://<appName>.private-web.tossmini.com`(QR 테스트)에 배포됩니다.

## 코드 표준

- **TDS 컴포넌트만:** 모든 UI는 토스 디자인 시스템(`@toss/tds-mobile`)을 사용합니다. 사용자 정의 CSS 프레임워크 없음.
- **외부 API 없음:** 모든 데이터가 브라우저 localStorage에 저장됩니다. 서버 불필요.
- **오류 처리:** 저장소 실패, SDK 호출 및 공유 작업은 try/catch 가드를 사용합니다(프로덕션에서 콘솔에 throw하지 않음).
- **분석:** 주요 전환에 대한 내장 이벤트 추적; 외부 분석 도구 없음(GA, Amplitude 등).
- **햅틱 및 접근성:** CTA의 네이티브 SDK 햅틱 피드백; 모든 터치 대상 ≥44px.
- **다크 모드:** `var(--tds-color-*)` CSS 변수를 통한 색상; 하드코딩된 HEX 값 없음.

## 라이선스

MIT
