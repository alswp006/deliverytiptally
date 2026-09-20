import { describe, it, expect } from "vitest";
import React from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import App from "@/App";

mockAll();

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) return f === "__tests__" ? [] : walk(full);
    return /\.tsx?$/.test(f) ? [full] : [];
  });
}

const appSrc = read("App.tsx");
const routePaths = [...appSrc.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

describe("라우팅 와이어링 + Provider 연결 + 통합 폴리시", () => {
  it("AC-1[P0]: App.tsx가 7개 페이지 Route를 모두 정의한다", () => {
    const expected: Record<string, string> = {
      "/": "Home",
      "/orders/new": "OrderNew",
      "/orders": "OrderList",
      "/orders/:id/edit": "OrderEdit",
      "/savings": "Savings",
      "/report": "Report",
      "/settings/goal": "GoalSettings",
    };
    for (const [path, comp] of Object.entries(expected)) {
      expect(routePaths).toContain(path);
      expect(appSrc).toContain(`<Route path="${path}" element={<${comp} />} />`);
      expect(appSrc).toContain(`from './pages/${comp}'`);
    }
    expect(routePaths.filter((p) => p !== "*" && !p.startsWith("/__")).length).toBe(7);
  });

  it("AC-1[P0]: 라우트에 쓰인 페이지 파일이 모두 존재하고 자리 페이지 마커가 없다", () => {
    for (const f of ["Home", "OrderNew", "OrderList", "OrderEdit", "Savings", "Report", "GoalSettings"]) {
      const code = read(`pages/${f}.tsx`);
      expect(code).toMatch(/export default/);
      expect(code).not.toContain("@ai-factory:placeholder");
    }
    expect(appSrc).toContain('<Route path="*" element={<Navigate to="/" replace />} />');
  });

  it("AC-2[P0]: 모든 navigate() 정적 대상 경로에 매칭되는 Route가 있다", () => {
    const matches = (target: string) =>
      routePaths.filter((p) => p !== "*").some((p) => {
        const re = new RegExp("^" + p.replace(/:[^/]+/g, "[^/]+") + "$");
        return re.test(target);
      });
    const targets = new Set<string>();
    for (const file of walk(SRC)) {
      const code = readFileSync(file, "utf8");
      for (const m of code.matchAll(/navigate\(\s*(["'`])(\/[^"'`]*)\1(?!\s*\+)/g)) targets.add(m[2]);
      for (const m of code.matchAll(/navigate\(\s*(["'])(\/orders\/)\1\s*\+/g)) targets.add(m[2] + "x/edit");
    }
    expect(targets.size).toBeGreaterThanOrEqual(6);
    expect(targets.has("/orders/new")).toBe(true);
    for (const t of targets) expect(matches(t), `no Route for ${t}`).toBe(true);
  });

  it("AC-2[P0]: 하단 탭 등 path 상수 대상도 Route에 존재한다", () => {
    const tabs = read("components/FloatingTabBar.tsx") + read("pages/Home.tsx");
    const paths = [...tabs.matchAll(/path:\s*["'](\/[^"']*)["']/g)].map((m) => m[1]);
    for (const p of paths) expect(routePaths, `no Route for ${p}`).toContain(p);
    expect(routePaths).toContain("/");
  });

  it("AC-3[P0]: main.tsx가 TDSMobileAITProvider와 BrowserRouter(basename)를 유지한다", () => {
    const main = read("main.tsx");
    expect(main).toContain("@AI:ANCHOR");
    expect(main).toContain("<TDSMobileAITProvider>");
    expect(main).toContain("<BrowserRouter basename={import.meta.env.BASE_URL}>");
    expect(main.indexOf("<TDSMobileAITProvider>")).toBeLessThan(main.indexOf("<BrowserRouter"));
    expect(main).toContain("<App />");
  });

  it("AC-3[P1]: App.tsx는 자체 Router를 만들지 않는다(중첩 Router 방지)", () => {
    expect(appSrc).not.toMatch(/<(Browser|Memory|Hash)Router/);
    expect(appSrc).toContain("<Routes>");
  });

  it("AC-4[P0]: '/' 경로에서 App이 크래시 없이 렌더된다", () => {
    const { container } = render(
      React.createElement(MemoryRouter, { initialEntries: ["/"] }, React.createElement(App)),
    );
    expect(container.innerHTML.length).toBeGreaterThan(100);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("AC-4[P0]: 미정의 경로는 홈으로 리다이렉트되어 렌더된다", () => {
    const { container } = render(
      React.createElement(MemoryRouter, { initialEntries: ["/no-such-page"] }, React.createElement(App)),
    );
    expect(container.innerHTML.length).toBeGreaterThan(100);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
  });
});
