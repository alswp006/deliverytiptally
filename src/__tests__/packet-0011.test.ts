import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

// ── TDS: 라벨-입력 연결 + hasError/help 노출이 가능한 경량 스탠드인 ──
vi.mock("@toss/tds-mobile", () => {
  const h = React.createElement;
  const passthrough = (tag: string) => ({ children }: any) => h(tag, null, children);
  let seq = 0;
  return {
    Button: ({ children, onClick, display, variant, color, size, ...p }: any) =>
      h("button", { onClick, ...p }, children),
    FixedBottomCTA: ({ children, onClick, disabled, loading }: any) =>
      h("button", { onClick, disabled: disabled || loading || undefined }, children),
    BottomCTA: ({ children }: any) => h("div", null, children),
    ListRow: Object.assign(
      ({ children, onClick, contents, right }: any) =>
        h("div", { role: "listitem", onClick }, contents, children, right),
      {
        Texts: ({ top, bottom }: any) => h("span", null, top, bottom),
        Text: passthrough("span"),
      },
    ),
    Spacing: () => h("div"),
    Border: () => h("hr"),
    Paragraph: { Text: passthrough("span") },
    Top: Object.assign(({ title, children }: any) => h("nav", null, title, children), {
      TitleParagraph: passthrough("h1"),
    }),
    Toast: ({ open, text }: any) => (open ? h("div", { role: "status" }, text) : null),
    BottomSheet: Object.assign(
      ({ open, children }: any) => (open ? h("div", { role: "dialog" }, children) : null),
      { Header: passthrough("div") },
    ),
    // 실제 TDS 구조: Chip=그룹 컨테이너(div), ChipItem=개별 칩(button). Chip.Item은 없다.
    Chip: ({ children }: any) => h("div", { role: "group" }, children),
    ChipItem: ({ children, onClick, selected, active }: any) =>
      h("button", { type: "button", "aria-pressed": !!(selected ?? active), onClick }, children),
    Switch: ({ checked, onChange }: any) =>
      h("input", { type: "checkbox", role: "switch", checked: !!checked, onChange }),
    TextField: React.forwardRef(({ label, help, hasError, value, onChange, placeholder, inputMode }: any, ref: any) => {
      const id = "tf-" + ++seq;
      return h(
        "div",
        null,
        h("label", { htmlFor: id }, label),
        h("input", { id, ref, value: value ?? "", onChange, placeholder, inputMode, "aria-invalid": hasError ? "true" : "false" }),
        help ? h("span", { "data-help-for": id }, help) : null,
      );
    }),
    Asset: {
      Icon: () => h("span"),
      ContentIcon: () => h("span"),
      Image: () => h("span"),
      ContentImage: () => h("span"),
    },
    Skeleton: () => h("div"),
    Loader: () => h("div"),
    IconButton: ({ onClick, "aria-label": l }: any) => h("button", { onClick, "aria-label": l }),
    TextButton: ({ children, onClick }: any) => h("button", { onClick }, children),
    Badge: passthrough("span"),
    AlertDialog: Object.assign(() => null, { AlertButton: passthrough("button") }),
    Tab: Object.assign(passthrough("div"), { Item: passthrough("button") }),
  };
});

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
  Storage: { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() },
  Analytics: { screen: vi.fn(), impression: vi.fn(), click: vi.fn() },
  getSafeAreaInsets: vi.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));

import OrderNew from "@/pages/OrderNew";

const ORDERS_KEY = "dtt:orders:v1";

function renderPage() {
  return render(
    React.createElement(MemoryRouter, { initialEntries: ["/orders/new"] }, React.createElement(OrderNew)),
  );
}
const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: RegExp, v: string) => fireEvent.change(field(label), { target: { value: v } });
const save = () => fireEvent.click(screen.getByRole("button", { name: /저장/ }));
const storedOrders = () => JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]");

beforeEach(() => {
  mockNavigate.mockClear();
  vi.mocked(generateHapticFeedback).mockClear();
});

describe("주문 기록 화면 `/orders/new`", () => {
  it("AC-1[P0]: 주문 금액 0·배달팁 60000 저장 시 두 필드에 에러 문구가 뜨고 이동하지 않는다", async () => {
    renderPage();
    type(/주문 금액/, "0");
    type(/배달팁/, "60000");
    save();

    expect(await screen.findByText("주문 금액을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("배달팁은 0원 이상 50,000원 이하로 입력해주세요")).toBeInTheDocument();
    expect(field(/주문 금액/).getAttribute("aria-invalid")).toBe("true");
    expect(field(/배달팁/).getAttribute("aria-invalid")).toBe("true");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(storedOrders()).toHaveLength(0);
  });

  it("AC-2[P0]: 저장 성공 시 success 햅틱 후 navigate('/', { state: { savedOrderId } })", async () => {
    renderPage();
    type(/주문 금액/, "18000");
    type(/배달팁/, "3000");
    save();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    const saved = storedOrders();
    expect(saved).toHaveLength(1);
    expect(mockNavigate).toHaveBeenCalledWith("/", { state: { savedOrderId: saved[0].id }, replace: true });
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
  });

  it("AC-3[P0]: LIMIT 이면 '기록은 2,000건까지 저장할 수 있어요' Toast, 화면 유지", async () => {
    const now = Date.now();
    const orders = Array.from({ length: 2000 }, (_, i) => ({
      id: `o_seed_${i}`, date: "2025-01-01", platform: "BAEMIN", foodAmount: 10000, deliveryTip: 2000,
      minOrderPadding: 0, pickupAvailable: false, memo: "", createdAt: now, updatedAt: now,
    }));
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    renderPage();
    type(/주문 금액/, "18000");
    type(/배달팁/, "3000");
    save();

    expect(await screen.findByText("기록은 2,000건까지 저장할 수 있어요")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(storedOrders()).toHaveLength(2000);
  });

  it("AC-3[P0]: QUOTA 이면 '저장 공간이 부족해요' Toast, 화면 유지", async () => {
    renderPage();
    type(/주문 금액/, "18000");
    type(/배달팁/, "3000");
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation((k: string) => {
      if (k === ORDERS_KEY) throw new DOMException("full", "QuotaExceededError");
    });
    save();

    expect(await screen.findByText("저장 공간이 부족해요")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("AC-4[P0]: 숫자 입력은 천단위 콤마로 보이고 저장 값은 정수 18000", async () => {
    renderPage();
    type(/주문 금액/, "18000");
    type(/배달팁/, "3000");

    expect(field(/주문 금액/).value).toBe("18,000");
    expect(field(/주문 금액/).getAttribute("inputmode")).toBe("numeric");
    expect(field(/배달팁/).value).toBe("3,000");

    save();
    await waitFor(() => expect(storedOrders()).toHaveLength(1));
    expect(storedOrders()[0].foodAmount).toBe(18000);
    expect(storedOrders()[0].deliveryTip).toBe(3000);
    expect(typeof storedOrders()[0].foodAmount).toBe("number");
  });

  it("AC-5[P1]: Chip 초기 선택은 defaultPlatform, 탭하면 tickWeak 햅틱과 선택 이동", () => {
    localStorage.setItem(
      "dtt:settings:v1",
      JSON.stringify({ monthlyTipGoal: 30000, defaultPlatform: "YOGIYO", goalAlertedMonths: [],
        reportUnlockedMonths: [], reviewRequested: false, schemaVersion: 1 }),
    );
    renderPage();
    expect(screen.getByRole("button", { name: "요기요" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "배달의민족" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "쿠팡이츠" }));
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
    expect(screen.getByRole("button", { name: "쿠팡이츠" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "요기요" }).getAttribute("aria-pressed")).toBe("false");
  });
});
