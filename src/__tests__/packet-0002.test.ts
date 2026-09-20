import { describe, it, expect } from "vitest";
import {
  todayKST,
  currentMonthKST,
  isValidMonthKey,
  normalizeMonthParam,
  daysInMonth,
  monthOf,
  shiftMonth,
  isFutureMonth,
  isFutureDate,
} from "@/lib/date";

describe("KST 날짜 유틸 (date.ts)", () => {
  // AC-1: normalizeMonthParam
  it("AC-1[P0]: normalizeMonthParam handles invalid input and valid month key", () => {
    const current = currentMonthKST();
    // Invalid format '9월' should normalize to current month
    expect(normalizeMonthParam("9월")).toBe(current);
    // null should normalize to current month
    expect(normalizeMonthParam(null)).toBe(current);
    // Valid YYYY-MM format should pass through
    expect(normalizeMonthParam("2026-09")).toBe("2026-09");
  });

  // AC-2: daysInMonth
  it("AC-2[P0]: daysInMonth returns correct days for different months", () => {
    // September has 30 days
    expect(daysInMonth("2026-09")).toBe(30);
    // February in non-leap year has 28 days
    expect(daysInMonth("2026-02")).toBe(28);
    // February in leap year has 29 days
    expect(daysInMonth("2024-02")).toBe(29);
  });

  // AC-3: shiftMonth
  it("AC-3[P0]: shiftMonth handles month wraparound in both directions", () => {
    // Shifting January backward one month should give December of previous year
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    // Shifting December forward one month should give January of next year
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  // AC-4: monthOf, isFutureDate, isFutureMonth
  it("AC-4[P0]: monthOf extracts month from date correctly", () => {
    expect(monthOf("2026-09-21")).toBe("2026-09");
    expect(monthOf("2026-01-01")).toBe("2026-01");
    expect(monthOf("2026-12-31")).toBe("2026-12");
  });

  it("AC-4[P0]: isFutureDate and isFutureMonth return false for current/today", () => {
    // Today should not be in the future
    expect(isFutureDate(todayKST())).toBe(false);
    // Current month should not be in the future
    expect(isFutureMonth(currentMonthKST())).toBe(false);
  });

  it("AC-4[P0]: isFutureDate and isFutureMonth correctly identify future dates/months", () => {
    // A date far in the future should be identified as future
    expect(isFutureDate("2099-12-31")).toBe(true);
    // A month far in the future should be identified as future
    expect(isFutureMonth("2099-12")).toBe(true);
  });

  // AC-5: isValidMonthKey type guard
  it("AC-5[P0]: isValidMonthKey validates YYYY-MM format correctly", () => {
    // Valid format YYYY-MM
    expect(isValidMonthKey("2026-09")).toBe(true);
    expect(isValidMonthKey("2024-02")).toBe(true);
    // Invalid format - Korean text
    expect(isValidMonthKey("9월")).toBe(false);
    // Invalid format - incomplete month
    expect(isValidMonthKey("2026-9")).toBe(false);
    // Invalid format - no separator
    expect(isValidMonthKey("202609")).toBe(false);
  });

  // Format validation for todayKST and currentMonthKST
  it("should return properly formatted KST dates and months", () => {
    const today = todayKST();
    // todayKST should return YYYY-MM-DD format
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const currentMonth = currentMonthKST();
    // currentMonthKST should return YYYY-MM format
    expect(currentMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  // Edge case: large month shifts with wraparound
  it("should handle large month shifts correctly", () => {
    // Shift forward 24 months (2 years)
    expect(shiftMonth("2020-01", 24)).toBe("2022-01");
    // Shift backward 36 months (3 years)
    expect(shiftMonth("2025-12", -36)).toBe("2022-12");
  });
});
