import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DeliveryOrder, Platform } from "@/lib/types";
import { currentMonthKST } from "@/lib/date";
import { formatKRW } from "@/lib/format";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const mockShareApp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/share", () => ({ shareApp: mockShareApp }));

// 광고 게이트 스텁: 버튼을 누르면 onRewarded 호출 후 children 공개. 라벨은 buttonText prop을 따른다.
vi.mock("@/components/TossRewardAd", () => {
  const h = React.createElement;
  function TossRewardAd({ children, buttonText, description, onRewarded }: any) {
    const [open, setOpen] = React.useState(false);
    if (open) return h(React.Fragment, null, children);
    return h(
      "div",
      { "data-testid": "reward-gate" },
      h("p", null, description),
      h("button", { onClick: () => { setOpen(true); onRewarded?.(); } }, buttonText),
    );
  }
  return { TossRewardAd, default: TossRewardAd };
});

vi.mock("@toss/tds-mobile", () => {
  const h = React.createElement;
  const ListRow = Object.assign(
    ({ contents, right, onClick, children, ...p }: any) =>
      h("div", { role: "listitem", onClick, ...p }, contents, right, children),
    { Texts: ({ top, bottom }: any) => h("span", null, h("span", null, top), h("span", null, bottom)) },
  );
  return {
    ListRow,
    Button: ({ children, onClick, display, variant, size, ...p }: any) => h("button", { onClick, ...p }, children),
    FixedBottomCTA: ({ children, onClick, loading, ...p }: any) => h("button", { onClick, ...p }, children),
    Chip: ({ children, onClick }: any) => h("button", { onClick }, children),
    Paragraph: { Text: ({ children }: any) => h("span", null, children) },
    Spacing: () => h("div"),
    Border: () => h("hr"),
    Skeleton: () => h("div"),
    Top: Object.assign(({ title, children }: any) => h("nav", null, title && h("h1", null, title), children), {
      TitleParagraph: ({ children }: any) => h("h1", null, children),
    }),
    IconButton: ({ "aria-label": l, onClick }: any) => h("button", { "aria-label": l, onClick }),
    TextButton: ({ children, onClick }: any) => h("button", { onClick }, children),
    Asset: {
      ContentIcon: ({ name }: any) => h("span", { "data-content-icon": name }),
      Icon: ({ name }: any) => h("span", { "data-asset": name }),
    },
    Badge: ({ children }: any) => h("span", null, children),
  };
});

vi.mock("@apps-in-toss/web-framework", () => ({
  Storage: { setItem: vi.fn(), getItem: vi.fn(async () => null), removeItem: vi.fn() },
  Analytics: { screen: vi.fn(async () => {}), impression: vi.fn(async () => {}), click: vi.fn(async () => {}) },
  TossAds: {
    initialize: Object.assign(vi.fn(), { isSupported: () => true }),
    attachBanner: Object.assign(vi.fn(() => ({ destroy: vi.fn() })), { isSupported: () => true }),
  },
  generateHapticFeedback: vi.fn(),
  getSafeAreaInsets: vi.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));

const MONTH = currentMonthKST();
const GATE_LABEL = "광고 보고 리포트 확인하기";

function order(id: string, day: number, platform: Platform, tip: number, extra: Partial<DeliveryOrder> = {}): DeliveryOrder {
  return {
    id,
    date: `${MONTH}-${String(day).padStart(2, "0")}`,
    platform,
    foodAmount: 20000,
    deliveryTip: tip,
    minOrderPadding: 0,
    pickupAvailable: false,
    memo: "",
    createdAt: day,
    updatedAt: day,
    ...extra,
  };
}

// 총 배달팁 9,000 · 3건 · 평균 3,000 · 1위 배달의민족(7,000) · 포장 절약 5,000(4,000+1,000)
const ORDERS = [
  order("a", 2, "BAEMIN", 3000),
  order("b", 5, "BAEMIN", 4000, { minOrderPadding: 1000, pickupAvailable: true }),
  order("c", 9, "YOGIYO", 2000),
];

function seedOrders(orders: DeliveryOrder[]) {
  localStorage.setItem("dtt:orders:v1", JSON.stringify(orders));
}
function seedUnlocked(months: string[]) {
  localStorage.setItem(
    "dtt:settings:v1",
    JSON.stringify({
      monthlyTipGoal: 30000,
      defaultPlatform: "BAEMIN",
      goalAlertedMonths: [],
      reportUnlockedMonths: months,
      reviewRequested: false,
      schemaVersion: 1,
    }),
  );
}
function unlockedMonths(): string[] {
  const raw = localStorage.getItem("dtt:settings:v1");
  return raw ? JSON.parse(raw).reportUnlockedMonths : [];
}

async function renderReport() {
  const { default: Report } = await import("@/pages/Report");
  return render(React.createElement(MemoryRouter, { initialEntries: ["/report"] }, React.createElement(Report)));
}

describe("월간 리포트 화면 `/report` (리워드 광고 게이트)", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockShareApp.mockClear();
  });

  it("AC-1: 미해제 월이면 리포트 본문 대신 광고 게이트와 '광고 보고 리포트 확인하기' 버튼이 보인다", async () => {
    seedOrders(ORDERS);
    const { container } = await renderReport();
    expect(screen.getByTestId("reward-gate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: GATE_LABEL })).toBeInTheDocument();
    expect(container.textContent).not.toContain(formatKRW(9000));
    expect(unlockedMonths()).not.toContain(MONTH);
  });

  it("AC-2: 광고 시청 완료 시 markReportUnlocked(month)가 저장되고 리포트 카드가 즉시 렌더된다", async () => {
    seedOrders(ORDERS);
    const { container } = await renderReport();
    fireEvent.click(screen.getByRole("button", { name: GATE_LABEL }));
    await waitFor(() => expect(screen.queryByTestId("reward-gate")).toBeNull());
    expect(unlockedMonths()).toContain(MONTH);
    const text = container.textContent ?? "";
    expect(text).toContain(formatKRW(9000)); // 월 총 배달팁
    expect(text).toContain("3건"); // 주문 수
    expect(text).toContain(formatKRW(3000)); // 평균
    expect(text).toContain("배달의민족"); // 플랫폼 1위
    expect(text).toContain(formatKRW(5000)); // 픽업 절약액
  });

  it("AC-3: 이미 해제된 월로 재진입하면 광고 게이트 없이 리포트 본문이 바로 보인다", async () => {
    seedOrders(ORDERS);
    seedUnlocked([MONTH]);
    const { container } = await renderReport();
    expect(screen.queryByTestId("reward-gate")).toBeNull();
    expect(screen.queryByRole("button", { name: GATE_LABEL })).toBeNull();
    expect(container.textContent).toContain(formatKRW(9000));
    expect(container.textContent).toContain(formatKRW(5000));
  });

  it("AC-4: 공유 버튼 탭 시 shareApp()이 호출되고 window.open은 호출되지 않는다", async () => {
    seedOrders(ORDERS);
    seedUnlocked([MONTH]);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    await renderReport();
    fireEvent.click(screen.getByRole("button", { name: /공유/ }));
    expect(mockShareApp).toHaveBeenCalledTimes(1);
    expect(typeof mockShareApp.mock.calls[0][0].message).toBe("string");
    expect(mockShareApp.mock.calls[0][0].message.length).toBeGreaterThan(0);
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("AC-4: Report.tsx 소스에 window.open / location.href 외부 이동 코드가 없다", () => {
    const src = readFileSync("src/pages/Report.tsx", "utf8");
    expect(src).not.toMatch(/window\.open/);
    expect(src).not.toMatch(/location\.href/);
    expect(src).toMatch(/shareApp/);
  });

  it("AC-5: 해당 월 주문이 0건이면 빈 안내와 '배달 기록하기' 버튼이 보이고 광고 게이트는 없다", async () => {
    seedOrders([]);
    const { container } = await renderReport();
    expect(container.textContent).toContain("이 달에는 기록이 없어요");
    expect(screen.queryByTestId("reward-gate")).toBeNull();
    expect(screen.queryByRole("button", { name: GATE_LABEL })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "배달 기록하기" }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(String(mockNavigate.mock.calls[0][0])).toContain("/orders/new");
  });

  it("AC-5: 다른 달 주문만 있어도 이번 달은 0건이라 빈 안내가 보인다", async () => {
    seedOrders([{ ...order("z", 1, "BAEMIN", 3000), date: "2020-01-05" }]);
    const { container } = await renderReport();
    expect(container.textContent).toContain("이 달에는 기록이 없어요");
    expect(screen.queryByTestId("reward-gate")).toBeNull();
  });
});
