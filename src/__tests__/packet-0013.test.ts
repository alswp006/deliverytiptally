import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ── TDS: 라벨-입력 연결 + 다이얼로그(닫기=왼쪽 / 삭제=오른쪽) 스탠드인 ──
vi.mock("@toss/tds-mobile", () => {
  const h = React.createElement;
  const passthrough = (tag: string) => ({ children }: any) => h(tag, null, children);
  const btn = ({ children, onClick }: any) => h("button", { type: "button", onClick }, children);
  let seq = 0;
  const dialog = (role: string) => ({ open, title, description, alertButton, cancelButton, confirmButton, onClose }: any) =>
    open
      ? h(
          "div",
          { role },
          h("div", null, title),
          h("div", null, description),
          // 왼쪽 → 오른쪽 순서: 취소(닫기) 다음 확인(삭제)
          alertButton ?? null,
          cancelButton ?? null,
          confirmButton ?? null,
          !alertButton && !cancelButton && !confirmButton
            ? h("button", { type: "button", onClick: onClose }, "닫기")
            : null,
        )
      : null;
  return {
    Button: ({ children, onClick, display, variant, color, size, ...p }: any) =>
      h("button", { type: "button", onClick, ...p }, children),
    FixedBottomCTA: ({ children, onClick, disabled, loading }: any) =>
      h("button", { type: "button", onClick, disabled: disabled || loading || undefined }, children),
    BottomCTA: Object.assign(({ children }: any) => h("div", null, children), {
      Double: ({ leftButton, rightButton }: any) => h("div", null, leftButton, rightButton),
    }),
    CTAButton: ({ children, onClick, disabled, loading }: any) =>
      h("button", { type: "button", onClick, disabled: disabled || loading || undefined }, children),
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
    Chip: ({ children, onClick, selected, active }: any) =>
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
    TextButton: ({ children, onClick }: any) => h("button", { type: "button", onClick }, children),
    Badge: passthrough("span"),
    AlertDialog: Object.assign(dialog("alertdialog"), { AlertButton: btn }),
    ConfirmDialog: Object.assign(dialog("alertdialog"), {
      Title: passthrough("span"),
      Description: passthrough("span"),
      CancelButton: btn,
      ConfirmButton: btn,
    }),
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

import OrderEdit from "@/pages/OrderEdit";

const ORDERS_KEY = "dtt:orders:v1";
const CREATED = 1_700_000_000_000;

const SEED = {
  id: "o_edit_1",
  date: "2026-09-03",
  platform: "COUPANG_EATS",
  foodAmount: 18000,
  deliveryTip: 3000,
  minOrderPadding: 2000,
  pickupAvailable: false,
  memo: "야식",
  createdAt: CREATED,
  updatedAt: CREATED,
};
const OTHER = { ...SEED, id: "o_edit_2", memo: "회식", foodAmount: 25000 };

function seed() {
  localStorage.setItem(ORDERS_KEY, JSON.stringify([SEED, OTHER]));
}
const stored = () => JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]");

function renderAt(id: string, state?: unknown) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: `/orders/${id}/edit`, state }] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: "/orders/:id/edit", element: React.createElement(OrderEdit) }),
      ),
    ),
  );
}

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const digits = (el: HTMLInputElement) => el.value.replace(/\D/g, "");

beforeEach(() => {
  mockNavigate.mockClear();
  seed();
});

describe("주문 수정/삭제 화면 `/orders/:id/edit`", () => {
  it("AC-1[P0]: 저장된 주문의 날짜·플랫폼·금액·팁·추가금액·메모·픽업이 폼에 채워진다", () => {
    renderAt("o_edit_1");

    expect(digits(field(/주문 금액/))).toBe("18000");
    expect(digits(field(/배달팁/))).toBe("3000");
    expect(digits(field(/최소주문 추가금액/))).toBe("2000");
    expect(field(/메모/).value).toBe("야식");
    expect(screen.getByText(/2026년 9월 3일/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "쿠팡이츠" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "배달의민족" }).getAttribute("aria-pressed")).toBe("false");
    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(false);
  });

  it("AC-1[P0]: location.state.order가 있으면 그 값으로 채운다(저장소에 없어도 흰 화면 아님)", () => {
    renderAt("o_edit_1", { order: { ...SEED, foodAmount: 33000, memo: "state값" } });

    expect(digits(field(/주문 금액/))).toBe("33000");
    expect(field(/메모/).value).toBe("state값");
  });

  it("AC-2[P0]: 금액을 바꿔 저장하면 updateOrder로 반영되고 updatedAt이 갱신되며 /orders로 focusMonth와 함께 이동한다", async () => {
    renderAt("o_edit_1");
    fireEvent.change(field(/주문 금액/), { target: { value: "20000" } });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith("/orders", { state: { focusMonth: "2026-09" } });

    const saved = stored().find((o: any) => o.id === "o_edit_1");
    expect(saved.foodAmount).toBe(20000);
    expect(saved.deliveryTip).toBe(3000);
    expect(saved.createdAt).toBe(CREATED);
    expect(saved.updatedAt).toBeGreaterThan(CREATED);
    expect(stored()).toHaveLength(2);
  });

  it("AC-2[P0]: 주문 금액을 0으로 저장하면 에러 문구가 뜨고 이동·저장하지 않는다", async () => {
    renderAt("o_edit_1");
    fireEvent.change(field(/주문 금액/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    expect(await screen.findByText("주문 금액을 입력해주세요")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(stored().find((o: any) => o.id === "o_edit_1").foodAmount).toBe(18000);
  });

  it("AC-3[P0]: '삭제' 탭 시 다이얼로그가 뜨고 왼쪽 '닫기'·오른쪽 '삭제'이며, 닫기는 아무것도 지우지 않는다", () => {
    renderAt("o_edit_1");
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog");
    const labels = within(dialog).getAllByRole("button").map((b) => b.textContent?.trim());
    expect(labels).toEqual(["닫기", "삭제"]);

    fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(stored()).toHaveLength(2);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-4[P0]: 삭제 확정 시 deleteOrder 후 /orders로 deletedId와 함께 이동하고 저장소에서 사라진다", async () => {
    renderAt("o_edit_1");
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith("/orders", { state: { deletedId: "o_edit_1" } });
    expect(stored().map((o: any) => o.id)).toEqual(["o_edit_2"]);
  });

  it("AC-5[P0]: 존재하지 않는 id면 '기록을 찾을 수 없어요'와 '목록으로' 버튼을 보이고, 누르면 /orders로 이동한다", () => {
    renderAt("o_missing");

    expect(screen.getByText("기록을 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.queryByLabelText(/주문 금액/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "목록으로" }));
    expect(mockNavigate).toHaveBeenCalledWith("/orders");
    expect(stored()).toHaveLength(2);
  });
});
