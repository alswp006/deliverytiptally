import { test, expect, type Page } from "@playwright/test";

/**
 * 제네릭 구조 스모크 — 이 앱 지식 없이도 jsdom이 못 보는 렌더 버그를 잡는다:
 *  · 흰 화면(#root 비어있음)        · <button> 안에 <button>(무효 HTML, 예: FixedBottomCTA 안에 Button)
 *  · 빈 입력칸(placeholder 없음)     · 콘솔 에러
 * 픽셀 베이스라인 없음(OS 안정). 각 화면 스크린샷을 e2e/__shots__/에 저장 → 끝내기 전 직접 열어 자가 리뷰.
 *
 * ▶ 이 앱에 맞게 customize:
 *   1) ROUTES에 핵심 화면을 추가(폼/결과/목록/설정 등)
 *   2) 데이터가 필요한 화면은 seed()에서 localStorage를 채워라
 */
const ROUTES: { path: string; name: string }[] = [
  { path: "/", name: "home" },
  { path: "/orders/new", name: "order-new" },
  { path: "/orders", name: "orders" },
  { path: "/orders/o_seed_1/edit", name: "order-edit" },
  { path: "/savings", name: "savings" },
  { path: "/report", name: "report" },
  { path: "/settings/goal", name: "goal-settings" },
];

/**
 * localStorage 시드 — 앱 스크립트보다 먼저 실행된다.
 * 빈 상태만 캡처하면 목록·집계·리포트 레이아웃을 한 장도 못 본다 → 이번 달 주문 몇 건을 깔아둔다.
 * (`/orders/o_seed_1/edit`은 여기 깔린 `o_seed_1`을 id로 조회한다.)
 */
async function seed(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const day = (d: number) => `${ym}-${String(Math.min(d, 28)).padStart(2, "0")}`;
    const order = (
      id: string,
      dayOfMonth: number,
      platform: string,
      foodAmount: number,
      deliveryTip: number,
      minOrderPadding: number,
      pickupAvailable: boolean,
      memo: string,
    ) => ({
      id,
      date: day(dayOfMonth),
      platform,
      foodAmount,
      deliveryTip,
      minOrderPadding,
      pickupAvailable,
      memo,
      createdAt: Date.parse(day(dayOfMonth)),
      updatedAt: Date.parse(day(dayOfMonth)),
    });

    window.localStorage.setItem(
      "dtt:orders:v1",
      JSON.stringify([
        order("o_seed_1", 3, "BAEMIN", 18000, 3000, 2000, true, "점심 김치찌개"),
        order("o_seed_2", 7, "COUPANG_EATS", 24500, 4500, 0, false, ""),
        order("o_seed_3", 12, "YOGIYO", 15000, 2500, 3000, true, "야식 치킨"),
        order("o_seed_4", 15, "BAEMIN", 31000, 3500, 0, false, ""),
        order("o_seed_5", 21, "ETC", 12000, 2000, 1500, true, ""),
      ]),
    );
    window.localStorage.setItem(
      "dtt:settings:v1",
      JSON.stringify({
        monthlyTipGoal: 30000,
        defaultPlatform: "BAEMIN",
        goalAlertedMonths: [],
        // 리포트는 광고 게이트 뒤에 있다 — 해제된 상태로 깔아야 본문 레이아웃이 찍힌다.
        reportUnlockedMonths: [ym],
        reviewRequested: false,
        schemaVersion: 1,
      }),
    );
  });
}

// 토스 WebView 밖(일반 브라우저)에서만 나는 알려진 dev 에러 — 무시(실기기 WebView엔 안 남)
const IGNORED_CONSOLE = [/SafeAreaInsets/i, /getSafeAreaInsets/i];

for (const route of ROUTES) {
  test(`visual smoke: ${route.name} (${route.path})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !IGNORED_CONSOLE.some((re) => re.test(m.text()))) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    await seed(page);
    await page.goto(route.path);
    await page.waitForTimeout(1000); // React 렌더 + effect 정착

    // 1) 흰 화면 방지 — #root에 실제 콘텐츠가 있어야(SDK 가드 누락 시 트리 언마운트 → 흰 화면)
    const rootText = (await page.locator("#root").innerText().catch(() => "")).trim();
    expect(rootText.length, `${route.name}: #root가 비어있음 → 흰 화면`).toBeGreaterThan(0);

    // 2) <button> 안에 <button> 금지 — 무효 HTML. FixedBottomCTA/BottomCTA/CTAButton은 자체가 button이니
    //    안에 Button을 넣지 마라(SubmitFooter는 올바르게 처리됨).
    expect(
      await page.locator("button button").count(),
      `${route.name}: <button> 안에 <button>(무효 HTML — CTA류 안에 Button 중첩)`,
    ).toBe(0);

    // 3) 입력칸은 placeholder가 보여야 — box/line variant는 빈 칸+비포커스에서 라벨이 떠 숨어 빈 회색 박스가 됨
    const inputs = page.getByRole("textbox");
    const n = await inputs.count();
    for (let i = 0; i < n; i++) {
      const ph = (await inputs.nth(i).getAttribute("placeholder")) ?? "";
      expect(ph.trim().length, `${route.name}: 입력칸 #${i}에 placeholder 없음 → 빈 회색 박스`).toBeGreaterThan(0);
    }

    // 4) 콘솔 에러 0 (알려진 dev 에러 제외) — 토스 검수는 console.error 0개 요구
    expect(errors, `${route.name}: 콘솔 에러`).toEqual([]);

    // 5) 스크린샷 저장 → 끝내기 전 직접 열어 자가 리뷰(휑함/솔리드 알약 탭/부유 CTA/앵커 없음)
    await page.screenshot({ path: `e2e/__shots__/${route.name}.png`, fullPage: true });
  });
}
