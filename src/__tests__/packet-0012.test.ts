import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DeliveryOrder, Platform } from "@/lib/types";
import { currentMonthKST } from "@/lib/date";
import { formatKRW, formatDayLabel } from "@/lib/format";

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

function seed(orders: DeliveryOrder[]) {
  localStorage.setItem("dtt:orders:v1", JSON.stringify(orders));
}

async function renderList() {
  const { default: OrderList } = await import("@/pages/OrderList");
  return render(React.createElement(MemoryRouter, { initialEntries: ["/orders"] }, React.createElement(OrderList)));
}

const rows = () => screen.queryAllByTestId("order-row");

describe("주문 목록 화면 `/orders`", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("AC-1: 선택 월 주문이 date 내림차순으로 정렬되고 각 행에 플랫폼·날짜·팁이 보인다", async () => {
    seed([
      order("a", 3, "BAEMIN", 3000),
      order("b", 20, "YOGIYO", 3500),
      order("c", 11, "COUPANG_EATS", 2500),
    ]);
    await renderList();
    const r = rows();
    expect(r).toHaveLength(3);
    expect(r[0].textContent).toContain(formatDayLabel(`${MONTH}-20`));
    expect(r[1].textContent).toContain(formatDayLabel(`${MONTH}-11`));
    expect(r[2].textContent).toContain(formatDayLabel(`${MONTH}-03`));
    expect(r[0].textContent).toContain("요기요");
    expect(r[0].textContent).toContain(formatKRW(3500));
    expect(r[1].textContent).toContain("쿠팡이츠");
    expect(r[2].textContent).toContain("배달의민족");
  });

  it("AC-1: 다른 달 주문은 표시되지 않는다", async () => {
    seed([
      order("a", 5, "BAEMIN", 3000),
      order("old", 5, "BAEMIN", 9999, { date: "2020-01-05" }),
    ]);
    await renderList();
    expect(rows()).toHaveLength(1);
    expect(screen.queryByText(new RegExp(formatKRW(9999)))).toBeNull();
  });

  it("AC-2: 플랫폼 Chip 선택 시 해당 플랫폼만 남고 다시 탭하면 전체로 돌아온다", async () => {
    seed([
      order("a", 3, "BAEMIN", 3000),
      order("b", 4, "YOGIYO", 3500),
      order("c", 5, "BAEMIN", 2500),
    ]);
    await renderList();
    expect(rows()).toHaveLength(3);
    const filter = screen.getByTestId("platform-filter");
    const chip = within(filter).getByRole("button", { name: "배달의민족" });
    fireEvent.click(chip);
    expect(rows()).toHaveLength(2);
    rows().forEach((row) => expect(row.textContent).toContain("배달의민족"));
    fireEvent.click(within(screen.getByTestId("platform-filter")).getByRole("button", { name: "배달의민족" }));
    expect(rows()).toHaveLength(3);
  });

  it("AC-3: 해당 월 주문이 0건이면 EmptyState와 '배달 기록하기' 버튼이 보이고 목록은 없다", async () => {
    seed([order("old", 5, "BAEMIN", 3000, { date: "2020-01-05" })]);
    await renderList();
    expect(rows()).toHaveLength(0);
    expect(screen.queryByTestId("order-list")).toBeNull();
    const btn = screen.getByRole("button", { name: "배달 기록하기" });
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith("/orders/new");
  });

  it("AC-4: 행을 탭하면 수정 화면으로 order를 state로 전달한다", async () => {
    const target = order("ord-42", 9, "YOGIYO", 4000);
    seed([order("x", 2, "BAEMIN", 3000), target]);
    await renderList();
    const row = rows().find((r) => r.textContent?.includes("요기요"))!;
    fireEvent.click(row);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/orders/ord-42/edit", { state: { order: target } });
  });

  it("AC-5: 주문이 50건 이상이어도 렌더 항목 수가 제한되고 목록이 렌더된다", async () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      order(`o${i}`, (i % 28) + 1, "BAEMIN", 1000 + i, { createdAt: i }),
    );
    seed(many);
    await renderList();
    const n = rows().length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(120);
    expect(n).toBeLessThanOrEqual(60);
    expect(screen.getByTestId("order-list")).toBeInTheDocument();
  });
});
