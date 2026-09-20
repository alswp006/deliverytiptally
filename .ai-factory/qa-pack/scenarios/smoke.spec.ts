import { test, expect } from '@playwright/test';

// nightcrew Sentinel smoke 팩 — Factory 산출(§7.1)
// 핵심 막: 주문 금액, 배달팁, 플랫폼을 10초 안에 기록, 월 누적 배달팁과 주문 횟수 표시, 직접 픽업했다면 아꼈을 금액 시뮬레이션, 최소주문금액 맞추려고 추가한 금액 별도 집계, 월 배달비 목표 설정과 초과 경고
// 토스 브릿지 의존 구간(로그인·결제)은 외부 재현 불가 — 화면 도달 확인까지만.
const ROUTES = ["/","/GoalSettings","/Home","/OrderEdit","/OrderList"];
// WebView 밖 실행에서만 나는 콘솔 에러는 무시(앱인토스 관례 — toss visual-smoke 템플릿 계승)
const IGNORED_CONSOLE = [/SafeAreaInsets/i, /granite/i, /apps-in-toss/i];

for (const route of ROUTES) {
  test(`smoke: ${route} 렌더링과 콘솔 에러 없음`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !IGNORED_CONSOLE.some((re) => re.test(msg.text()))) errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(route);
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
