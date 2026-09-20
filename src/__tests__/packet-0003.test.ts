import { describe, it, expect } from "vitest";
import { formatKRW, formatPercent, formatMonthLabel, formatDayLabel } from "@/lib/format";
import type { RouteState } from "@/lib/types";

describe("packet-0003: 금액/퍼센트 포맷 유틸 + RouteState 계약", () => {
  describe("AC-1: formatKRW 정상 값 및 예외값 처리", () => {
    it("AC-1[P0]: should format normal integer as KRW with comma", () => {
      const result = formatKRW(18000);
      expect(result).toBe("18,000원");
      expect(typeof result).toBe("string");
    });

    it("AC-1[P0]: should return '0원' for NaN", () => {
      const result = formatKRW(NaN);
      expect(result).toBe("0원");
      expect(result).not.toEqual("NaN원");
    });

    it("AC-1[P0]: should return '0원' for null", () => {
      const result = formatKRW(null as any);
      expect(result).toBe("0원");
      expect(typeof result).toBe("string");
    });

    it("AC-1[P0]: should return '0원' for Infinity", () => {
      const result = formatKRW(Infinity);
      expect(result).toBe("0원");
      expect(result).not.toContain("Infinity");
    });

    it("AC-1[P1]: should handle large numbers correctly", () => {
      const result = formatKRW(1000000);
      expect(result).toBe("1,000,000원");
      expect(result).toContain(",");
    });
  });

  describe("AC-2: formatPercent 퍼센트 포맷팅 및 예외값 처리", () => {
    it("AC-2[P0]: should format ratio as percentage with specified digits", () => {
      const result = formatPercent(0.119, 1);
      expect(result).toBe("11.9%");
      expect(result).toContain("%");
    });

    it("AC-2[P0]: should return '0%' for Infinity", () => {
      const result = formatPercent(Infinity, 1);
      expect(result).toBe("0%");
      expect(result).not.toContain("Infinity");
    });

    it("AC-2[P0]: should return '0%' for zero", () => {
      const result = formatPercent(0, 1);
      expect(result).toBe("0%");
      expect(typeof result).toBe("string");
    });

    it("AC-2[P1]: should handle different digit precision", () => {
      const result = formatPercent(0.12345, 2);
      expect(result).toContain("%");
      expect(result.endsWith("%")).toBe(true);
    });

    it("AC-2[P1]: should handle ratio 1.0", () => {
      const result = formatPercent(1.0, 0);
      expect(result).toBe("100%");
      expect(result).toContain("100");
    });
  });

  describe("AC-3: formatMonthLabel 및 formatDayLabel 날짜 포맷팅", () => {
    it("AC-3[P0]: should format month label as '년월'", () => {
      const result = formatMonthLabel("2026-09");
      expect(result).toBe("2026년 9월");
      expect(result).toContain("년");
      expect(result).toContain("월");
    });

    it("AC-3[P0]: should format day label as '월일'", () => {
      const result = formatDayLabel("2026-09-21");
      expect(result).toBe("9월 21일");
      expect(result).toContain("월");
      expect(result).toContain("일");
    });

    it("AC-3[P1]: should handle different months correctly", () => {
      const result = formatMonthLabel("2026-01");
      expect(result).toBe("2026년 1월");
      expect(result).toContain("2026년");
    });

    it("AC-3[P1]: should handle single-digit days", () => {
      const result = formatDayLabel("2026-09-05");
      expect(result).toBe("9월 5일");
      expect(result).not.toContain("09");
    });
  });

  describe("AC-4: RouteState 타입 계약", () => {
    it("AC-4[P0]: should define RouteState type with all required route keys", () => {
      const mockHomeState: RouteState["/"] = {};
      const mockNewOrderState: RouteState["/orders/new"] = {};
      const mockOrdersState: RouteState["/orders"] = {};
      const mockEditOrderState: RouteState["/orders/:id/edit"] = {};
      const mockSavingsState: RouteState["/savings"] = {};
      const mockSettingsGoalState: RouteState["/settings/goal"] = {};
      const mockReportState: RouteState["/report"] = {};

      expect(mockHomeState).toBeDefined();
      expect(mockNewOrderState).toBeDefined();
      expect(mockOrdersState).toBeDefined();
      expect(mockEditOrderState).toBeDefined();
      expect(mockSavingsState).toBeDefined();
      expect(mockSettingsGoalState).toBeDefined();
      expect(mockReportState).toBeDefined();
    });

    it("AC-4[P0]: should allow RouteState type to be used for typed navigation", () => {
      type AllKeys = keyof RouteState;
      const allRoutes: AllKeys[] = [
        "/",
        "/orders/new",
        "/orders",
        "/orders/:id/edit",
        "/savings",
        "/settings/goal",
        "/report",
      ];

      expect(allRoutes.length).toBe(7);
      allRoutes.forEach((route) => {
        expect(typeof route).toBe("string");
        expect(route.length).toBeGreaterThan(0);
      });
    });
  });
});
