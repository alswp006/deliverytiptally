import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DeliveryOrder, Platform } from "@/lib/types";
import { currentMonthKST, shiftMonth } from "@/lib/date";
import { formatKRW } from "@/lib/format";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// ListRow의 contents/right 슬롯까지 렌더하는 TDS 스텁 (공용 mockTds는 right를 버린다)
vi.mock("@toss/tds-mobile", () => {
  const h = React.createElement;
  const ListRow = Object.assign(
    ({ contents, right, onClick, children, ...p }: any) =>
      h("div", { role: "listitem", onClick, ...p }, contents, right, children),
    {
      Texts: ({ top, bottom }: any) =>
        h("span", null, h("span", null, top), h("span", null, bottom)),
    },
  );
  return {
    ListRow,
    Button: ({ children, onClick, display, variant, size, ...p }: any) =>
      h("button", { onClick, ...p }, children),
    FixedBottomCTA: ({ children, onClick, loading, ...p }: any) =>
      h("button", { onClick, ...p }, children),
    Chip: ({ children, selected, onClick }: any) =>
      h("button", { "aria-pressed": !!selected, onClick }, children),
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
const PREV = shiftMonth(MONTH, -1);

function order(id: string, month: string, platform: Platform, tip: number, pad: number, pickup: boolean, food = 20000): DeliveryOrder {
  return {
    id,
    date: `${month}-10`,
    platform,
    foodAmount: food,
    deliveryTip: tip,
    minOrderPadding: pad,
    pickupAvailable: pickup,
    memo: "",
    createdAt: 1,
    updatedAt: 1,
  };
}

function seed(orders: DeliveryOrder[]) {
  localStorage.setItem("dtt:orders:v1", JSON.stringify(orders));
}

async function renderSavings(state?: unknown) {
  const { default: Savings } = await import("@/pages/Savings");
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/savings", state }] },
      React.createElement(Savings),
    ),
  );
}

const bodyText = () => document.body.textContent ?? "";

const SAMPLE = () => [
  order("a", MONTH, "BAEMIN", 3000, 2000, true, 20000),
  order("b", MONTH, "COUPANG_EATS", 2500, 1500, true, 15000),
  order("c", MONTH, "YOGIYO", 0, 0, false, 30000),
  order("d", PREV, "BAEMIN", 9000, 9000, true, 10000),
];

describe("픽업 절약 시뮬레이션 화면 `/savings`", () => {
  it("AC-1[P0]: 픽업 가능 주문의 (배달팁+추가금액) 합이 절약액, 연 환산이 함께 보인다", async () => {
    seed(SAMPLE());
    await renderSavings();
    // savable = 3000+2000+2500+1500 = 9000 → yearly 108000 (이전 달 주문 제외)
    expect(bodyText()).toContain(formatKRW(9000));
    expect(bodyText()).toContain(formatKRW(108000));
    expect(bodyText()).not.toContain(formatKRW(216000));
  });

  it("AC-1[P0]: location.state.month로 다른 달을 지정하면 그 달 기준으로 계산한다", async () => {
    seed(SAMPLE());
    await renderSavings({ month: PREV });
    // PREV: 9000+9000 = 18000 → yearly 216000
    expect(bodyText()).toContain(formatKRW(18000));
    expect(bodyText()).toContain(formatKRW(216000));
    expect(bodyText()).not.toContain(formatKRW(108000));
  });

  it("AC-2[P0]: totalSpend가 0이면 비율은 0%이고 NaN/Infinity가 노출되지 않는다", async () => {
    seed([order("z", MONTH, "ETC", 0, 0, true, 0)]);
    await renderSavings();
    expect(bodyText()).not.toMatch(/NaN|Infinity/);
    expect(bodyText()).toContain("0%");
  });

  it("AC-2[P0]: 주문이 하나도 없어도 NaN/Infinity 없이 렌더된다", async () => {
    await renderSavings();
    expect(bodyText()).not.toMatch(/NaN|Infinity/);
    expect(bodyText()).toContain("0%");
  });

  it("AC-3[P0]: 잘못된 month('9월', null)로 진입해도 현재 월 데이터가 렌더된다", async () => {
    seed(SAMPLE());
    for (const state of [{ month: "9월" }, { month: null }, null, undefined]) {
      const { unmount } = await renderSavings(state);
      expect(bodyText()).toContain(formatKRW(9000));
      expect(bodyText()).toContain(formatKRW(108000));
      unmount();
    }
  });

  it("AC-4[P0]: padding-section에 추가지출 합계와 발생 건수가 표시된다", async () => {
    seed(SAMPLE());
    await renderSavings();
    const section = screen.getByTestId("padding-section");
    // 추가지출 2000 + 1500 = 3500, 2건 (플랫폼별: 배민 2,000 / 쿠팡이츠 1,500)
    expect(section.textContent).toContain(formatKRW(3500));
    expect(section.textContent).toContain("발생 2회");
    expect(section.textContent).toContain(formatKRW(2000));
    expect(section.textContent).toContain(formatKRW(1500));
  });

  it("AC-4[P0]: 추가지출이 0이면 '추가 지출이 없었어요'가 보인다", async () => {
    seed([order("a", MONTH, "BAEMIN", 3000, 0, true)]);
    await renderSavings();
    const section = screen.getByTestId("padding-section");
    expect(within(section).getByText(/추가 지출이 없었어요/)).toBeInTheDocument();
    expect(section.textContent).not.toMatch(/[1-9]\d*건/);
  });

  it("AC-5[P0]: 픽업 가능 주문이 0건이면 EmptyState 안내와 절약액 0원이 보인다", async () => {
    seed([order("c", MONTH, "YOGIYO", 3000, 1000, false)]);
    await renderSavings();
    expect(bodyText()).toContain("0원");
    expect(bodyText()).toMatch(/픽업/);
    expect(bodyText()).not.toContain(formatKRW(4000));
    expect(bodyText()).not.toContain(formatKRW(48000));
  });
});
