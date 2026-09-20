import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getSettings, saveSettings } from "@/lib/storage/settings";
import GoalSettings from "@/pages/GoalSettings";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const mockHaptic = vi.hoisted(() => vi.fn());
vi.mock("@apps-in-toss/web-framework", () => ({
  Storage: { setItem: vi.fn(), getItem: vi.fn(async () => null), removeItem: vi.fn() },
  Analytics: { screen: vi.fn(async () => {}), impression: vi.fn(async () => {}), click: vi.fn(async () => {}) },
  generateHapticFeedback: mockHaptic,
  getSafeAreaInsets: vi.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));

vi.mock("@toss/tds-mobile", () => {
  const h = React.createElement;
  return {
    TextField: React.forwardRef(({ label, help, hasError, variant, prefix, suffix, ...p }: any, ref: any) =>
      h("div", null, h("label", null, label), h("input", { ref, ...p }), hasError && help ? h("span", { role: "alert" }, help) : null),
    ),
    // 실제 TDS 구조: Chip=그룹 컨테이너(div), ChipItem=개별 칩(button). Chip.Item은 없다.
    Chip: ({ children }: any) => h("div", { role: "group" }, children),
    ChipItem: ({ children, onClick }: any) => h("button", { onClick }, children),
    Button: ({ children, onClick, display, variant, size, ...p }: any) => h("button", { onClick, ...p }, children),
    FixedBottomCTA: ({ children, onClick, loading, ...p }: any) => h("button", { onClick, ...p }, children),
    Paragraph: { Text: ({ children }: any) => h("span", null, children) },
    Spacing: () => h("div"),
    Border: () => h("hr"),
    Skeleton: () => h("div"),
    Top: Object.assign(({ title, children }: any) => h("nav", null, title && h("h1", null, title), children), {
      TitleParagraph: ({ children }: any) => h("h1", null, children),
    }),
    IconButton: ({ "aria-label": l, onClick }: any) => h("button", { "aria-label": l, onClick }),
    TextButton: ({ children, onClick }: any) => h("button", { onClick }, children),
    Asset: { ContentIcon: () => h("span"), Icon: () => h("span") },
    Badge: ({ children }: any) => h("span", null, children),
  };
});

function renderPage(state?: unknown) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/settings/goal", state }] },
      React.createElement(GoalSettings),
    ),
  );
}

const input = () => screen.getByRole("textbox") as HTMLInputElement;
const save = () => fireEvent.click(screen.getByRole("button", { name: /저장/ }));

beforeEach(() => {
  mockNavigate.mockClear();
  mockHaptic.mockClear();
  saveSettings({ monthlyTipGoal: 50000 });
});

describe("[부가] 목표 설정 화면 `/settings/goal`", () => {
  it("AC-1[P0]: location.state.currentGoal이 콤마 형식으로 채워진다", () => {
    renderPage({ currentGoal: 30000 });
    expect(input().value).toBe("30,000");
    expect(input().getAttribute("inputmode")).toBe("numeric");
  });

  it("AC-1[P0]: state가 없으면 getSettings() 값을 콤마 형식으로 채운다", () => {
    renderPage();
    expect(input().value).toBe("50,000");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("AC-2[P0]: 999원 저장 시 최소 금액 에러가 뜨고 저장·이동하지 않는다", () => {
    renderPage();
    fireEvent.change(input(), { target: { value: "999" } });
    save();
    expect(screen.getByText("목표 금액은 1,000원 이상으로 입력해주세요")).toBeTruthy();
    expect(getSettings().monthlyTipGoal).toBe(50000);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-3[P0]: 1,000,001원 저장 시 최대 금액 에러가 뜬다", () => {
    renderPage();
    fireEvent.change(input(), { target: { value: "1000001" } });
    save();
    expect(screen.getByText("목표 금액은 1,000,000원 이하로 입력해주세요")).toBeTruthy();
    expect(getSettings().monthlyTipGoal).toBe(50000);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-4[P1]: 추천 금액 Chip 탭 시 값이 바뀌고 tickWeak 햅틱이 실행된다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "3만원" }));
    expect(input().value).toBe("30,000");
    expect(mockHaptic).toHaveBeenCalledWith({ type: "tickWeak" });
    fireEvent.click(screen.getByRole("button", { name: "5만원" }));
    expect(input().value).toBe("50,000");
    fireEvent.click(screen.getByRole("button", { name: "2만원" }));
    expect(input().value).toBe("20,000");
  });

  it("AC-5[P0]: 정상 저장 시 settings가 갱신되고 navigate('/')로 이동한다", () => {
    renderPage();
    fireEvent.change(input(), { target: { value: "75000" } });
    save();
    expect(getSettings().monthlyTipGoal).toBe(75000);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("AC-5[P1]: 기본 플랫폼 Chip 선택이 저장에 반영된다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "배달의민족" }));
    save();
    expect(getSettings().defaultPlatform).toBe("BAEMIN");
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
