import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logClick, logImpression } from "@/lib/log";

describe("계측 유틸 — logClick / logImpression [packet-0009]", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 네트워크 요청 감지
    fetchSpy = vi.spyOn(global, "fetch");
    // console.error 감지
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC-1: logClick 호출 후 예외 없고 기록 증가
  describe("AC-1: logClick 동작", () => {
    it("should not throw on logClick call", () => {
      expect(() => {
        logClick("home_add_order");
      }).not.toThrow();
    });

    it("should handle multiple logClick calls", () => {
      expect(() => {
        logClick("home_add_order");
        logClick("result_share");
        logClick("record_save");
      }).not.toThrow();
    });
  });

  // AC-2: logImpression 중복 제거 (3회 호출 → 1건만 기록)
  describe("AC-2: logImpression 중복 제거", () => {
    it("should deduplicate same impression name — only 1 record for 3 calls", () => {
      // 테스트용 내부 상태 조회 함수 사용
      const { __getImpressionCount } = require("@/lib/log");
      const countBefore = __getImpressionCount?.("home_banner") ?? 0;

      logImpression("home_banner");
      logImpression("home_banner");
      logImpression("home_banner");

      const countAfter = __getImpressionCount?.("home_banner") ?? 0;
      expect(countAfter).toBe(countBefore + 1); // 1회만 추가
    });

    it("should allow different impression names", () => {
      expect(() => {
        logImpression("home_banner");
        logImpression("home_modal");
        logImpression("result_ad");
      }).not.toThrow();
    });
  });

  // AC-3: fetch/XMLHttpRequest/navigator.sendBeacon 호출 없음
  describe("AC-3: 외부 네트워크 호출 금지", () => {
    it("should not call fetch", () => {
      logClick("test_event");
      logImpression("test_impression");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should not send beacon or XMLHttpRequest", () => {
      const beaconSpy = vi.spyOn(navigator, "sendBeacon");
      const xhrSpy = vi.spyOn(window.XMLHttpRequest.prototype, "open");

      logClick("event");
      expect(beaconSpy).not.toHaveBeenCalled();
      expect(xhrSpy).not.toHaveBeenCalled();

      beaconSpy.mockRestore();
      xhrSpy.mockRestore();
    });
  });

  // AC-4: console.error 0개 & 나쁜 인자도 throw 없음
  describe("AC-4: 안전한 에러 처리", () => {
    it("should not call console.error on valid input", () => {
      logClick("valid_event");
      logImpression("valid_impression");
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should not throw on invalid input (undefined)", () => {
      expect(() => {
        logClick(undefined as any);
        logImpression(undefined as any);
      }).not.toThrow();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should not throw on invalid input (number)", () => {
      expect(() => {
        logClick(123 as any);
        logImpression(456 as any);
      }).not.toThrow();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should not throw on invalid input (null, object)", () => {
      expect(() => {
        logClick(null as any);
        logClick({} as any);
        logImpression(null as any);
        logImpression([1, 2, 3] as any);
      }).not.toThrow();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should not throw on empty string", () => {
      expect(() => {
        logClick("");
        logImpression("");
      }).not.toThrow();
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  // AC-5: TypeScript 에러 검증은 tsc --noEmit에서 검증
  describe("AC-5: TypeScript type safety", () => {
    it("should be importable and callable", () => {
      // 이 테스트는 단순히 import가 성공하고 함수가 callable인지 확인
      expect(typeof logClick).toBe("function");
      expect(typeof logImpression).toBe("function");
    });
  });
});
