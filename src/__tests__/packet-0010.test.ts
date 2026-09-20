import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const calls = vi.hoisted(() => [] as string[]);
const mockNavigate = vi.hoisted(() => vi.fn((...a: unknown[]) => { calls.push(`navigate:${a[0]}`); }));

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  logClick: vi.fn((name: string) => { calls.push(`log:${name}`); }),
}));

vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn((o: { type: string }) => { calls.push(`haptic:${o.type}`); }),
  Analytics: { screen: vi.fn(), impression: vi.fn(), click: vi.fn() },
  Storage: { getItem: vi.fn(async () => null), setItem: vi.fn(), removeItem: vi.fn() },
  TossAds: {
    initialize: Object.assign(vi.fn(), { isSupported: () => true }),
    attachBanner: Object.assign(vi.fn(() => ({ destroy: vi.fn() })), { isSupported: () => true }),
    destroy: Object.assign(vi.fn(), { isSupported: () => true }),
    destroyAll: Object.assign(vi.fn(), { isSupported: () => true }),
  },
  share: vi.fn(async () => {}),
  getTossShareLink: vi.fn(async (p: string) => p),
  requestReview: vi.fn(async () => {}),
}));

vi.mock("@toss/tds-mobile", () => {
  const h = React.createElement;
  return {
    Button: ({ children, onClick, disabled }: any) => h("button", { onClick, disabled }, children),
    FixedBottomCTA: ({ children, onClick, disabled, loading }: any) =>
      h("button", { onClick, disabled: disabled || loading || undefined }, children),
    Chip: ({ children, onClick, disabled, selected }: any) =>
      h("button", { onClick, disabled, "aria-pressed": selected }, children),
    ListRow: Object.assign(
      ({ children, onClick, right }: any) => h("div", { role: "listitem", onClick }, children, right),
      {
        Texts: ({ top, bottom }: any) => h("span", null, top, " ", bottom),
        Text: ({ children }: any) => h("span", null, children),
      },
    ),
    Spacing: () => h("div"),
    Paragraph: { Text: ({ children }: any) => h("span", null, children) },
    Toast: ({ open, text }: any) => (open ? h("div", { role: "status" }, text) : null),
    Top: Object.assign(({ title }: any) => h("h1", null, title), {
      TitleParagraph: ({ children }: any) => h("h1", null, children),
    }),
    Skeleton: () => h("div", { "data-skeleton": "true" }),
    Border: () => h("hr"),
    Badge: ({ children }: any) => h("span", null, children),
    IconButton: ({ onClick, "aria-label": l }: any) => h("button", { onClick, "aria-label": l }),
    TextButton: ({ children, onClick }: any) => h("button", { onClick }, children),
    Asset: {
      ContentIcon: ({ name }: any) => h("span", { "data-content-icon": name }),
      Icon: ({ name }: any) => h("span", { "data-asset": name }),
    },
  };
});

import Home from "@/pages/Home";
import { currentMonthKST } from "@/lib/date";

const KEY = "dtt:orders:v1";

function order(id: string, date: string, tip: number, pad: number) {
  return {
    id, date, platform: "BAEMIN", foodAmount: 20000, deliveryTip: tip,
    minOrderPadding: pad, pickupAvailable: false, memo: "", createdAt: 1, updatedAt: 1,
  };
}

function renderHome() {
  return render(React.createElement(MemoryRouter, null, React.createElement(Home)));
}

beforeEach(() => {
  calls.length = 0;
  mockNavigate.mockClear();
});

describe("홈 화면 `/` — 월 요약 대시보드", () => {
  it("AC-1[P0]: SummaryHero에 '7,000원'과 주문 횟수·평균·최소주문 추가 caption을 보여준다", async () => {
    const m = currentMonthKST();
    localStorage.setItem(KEY, JSON.stringify([order("a", `${m}-01`, 3000, 1000), order("b", `${m}-01`, 4000, 2000)]));
    renderHome();
    await waitFor(() => expect(document.body.textContent).toContain("7,000원"));
    expect(document.body.textContent).toContain("주문 2회 · 평균 3,500원 · 최소주문 추가 3,000원");
    expect(screen.queryByText("이번 달 배달 기록이 아직 없어요")).toBeNull();
  });

  it("AC-1[P0]: 다른 달 주문은 선택 월 집계에 포함되지 않는다", async () => {
    const m = currentMonthKST();
    localStorage.setItem(KEY, JSON.stringify([order("a", `${m}-01`, 3000, 0), order("z", "2019-01-05", 9000, 0)]));
    renderHome();
    await waitFor(() => expect(document.body.textContent).toContain("3,000원"));
    expect(document.body.textContent).toContain("주문 1회 · 평균 3,000원 · 최소주문 추가 0원");
    expect(document.body.textContent).not.toContain("12,000원");
  });

  it("AC-2[P0]: 이번 달에서 '다음 달' Chip은 disabled이고 눌러도 월이 그대로이며 console.error가 없다", async () => {
    const m = currentMonthKST();
    localStorage.setItem(KEY, JSON.stringify([order("a", `${m}-01`, 3000, 1000)]));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderHome();
    const next = await screen.findByRole("button", { name: /다음 달/ });
    expect((next as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(next);
    await waitFor(() => expect(document.body.textContent).toContain("3,000원"));
    expect((screen.getByRole("button", { name: /이전 달/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(errSpy).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it("AC-3[P0]: 주문 0건이면 EmptyState를 보이고 Sparkline·MiniBar는 없으며 하단 CTA는 활성이다", async () => {
    const { container } = renderHome();
    expect(await screen.findByText("이번 달 배달 기록이 아직 없어요")).toBeTruthy();
    expect(container.querySelector("svg[data-testid*='spark' i], [data-testid*='sparkline' i]")).toBeNull();
    expect(container.querySelector("[data-testid*='minibar' i], [data-testid*='mini-bar' i]")).toBeNull();
    const cta = screen.getByRole("button", { name: "배달 기록하기" }) as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
  });

  it("AC-4[P0]: localStorage가 손상되면 Toast를 띄우고 Empty 레이아웃을 흰 화면 없이 렌더한다", async () => {
    localStorage.setItem(KEY, "{not-json[[");
    renderHome();
    expect(await screen.findByText("저장된 기록을 불러오지 못했어요")).toBeTruthy();
    expect(screen.getByText("이번 달 배달 기록이 아직 없어요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "배달 기록하기" })).toBeTruthy();
  });

  it("AC-5[P0]: '배달 기록하기' 탭 시 햅틱(success) → logClick('home_add_order') → navigate('/orders/new') 순서로 실행된다", async () => {
    renderHome();
    const cta = await screen.findByRole("button", { name: "배달 기록하기" });
    fireEvent.click(cta);
    expect(calls.filter((c) => !c.startsWith("log:") || c === "log:home_add_order")).toEqual([
      "haptic:success",
      "log:home_add_order",
      "navigate:/orders/new",
    ]);
    expect(mockNavigate).toHaveBeenCalledWith("/orders/new");
  });
});
