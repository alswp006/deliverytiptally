import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

/** <TextField ... /> 여는 태그부터 자기 닫힘(/>)까지 잘라낸다. */
function textFieldTags(source: string): string[] {
  const tags: string[] = [];
  const re = /<TextField\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 0;
    let i = m.index;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (depth === 0 && source.startsWith("/>", i)) {
        i += 2;
        break;
      }
    }
    tags.push(source.slice(m.index, i));
  }
  return tags;
}

const css = read("styles/reward-ad.css");
const orderNew = read("pages/OrderNew.tsx");
const orderEdit = read("pages/OrderEdit.tsx");

describe("[개선] TDS 컴포넌트 3곳을 벤더 모양대로 고치기", () => {
  it("AC-1[P0]: reward-ad.css에 var(--tds-color-*)가 0건이다", () => {
    const hits = css.match(/var\(\s*--tds-color-[\w-]+/g) ?? [];
    expect(hits).toEqual([]);
    expect(css).toContain(".reward-ad-button--loading");
  });

  it("AC-2[P0]: reward-ad.css는 --adaptive* 변수로 색을 지정한다", () => {
    const vars = css.match(/var\(\s*--[\w-]+/g) ?? [];
    expect(vars.length).toBeGreaterThanOrEqual(4);
    for (const v of vars) {
      expect(v).toMatch(/var\(\s*--adaptive[A-Za-z0-9]+/);
    }
    // 배경·글자색 선언이 통째로 무효가 되지 않도록 4곳 모두 남아 있어야 한다
    expect(css).toMatch(/color:\s*var\(--adaptive/);
    expect(css).toMatch(/background-color:\s*var\(--adaptive/);
  });

  it("AC-4[P0]: OrderEdit의 TextField 4칸 모두 labelOption=\"sustain\"이다", () => {
    const tags = textFieldTags(orderEdit);
    expect(tags).toHaveLength(4);
    for (const tag of tags) {
      expect(tag).toMatch(/labelOption=["{]+\s*["']?sustain/);
    }
  });

  it("AC-5[P0]: OrderEdit은 라벨과 placeholder를 함께 유지한다", () => {
    const tags = textFieldTags(orderEdit);
    const labels = tags.map((t) => /label="([^"]+)"/.exec(t)?.[1]);
    expect(labels).toEqual(["주문 금액", "배달팁", "최소주문 추가금액", "메모"]);
    for (const tag of tags) {
      expect(tag).toMatch(/placeholder="[^"]+"/);
    }
  });

  it("AC-7[P0]: OrderNew의 TextField 4칸 모두 labelOption=\"sustain\"이다", () => {
    const tags = textFieldTags(orderNew);
    expect(tags).toHaveLength(4);
    for (const tag of tags) {
      expect(tag).toMatch(/labelOption=["{]+\s*["']?sustain/);
    }
  });

  it("AC-8[P0]: OrderNew는 라벨과 placeholder를 함께 유지한다", () => {
    const tags = textFieldTags(orderNew);
    const labels = tags.map((t) => /label="([^"]+)"/.exec(t)?.[1]);
    expect(labels).toEqual(["주문 금액", "배달팁", "최소주문 추가금액", "메모"]);
    for (const tag of tags) {
      expect(tag).toMatch(/placeholder="[^"]+"/);
    }
  });

  it("AC-3/6/9[P1]: 이 수정으로 `as any`·`as unknown as` 캐스트를 새로 들이지 않는다", () => {
    expect(css).not.toMatch(/\bas (any|unknown)\b/);
    for (const source of [orderEdit, orderNew]) {
      // TextField 태그 안에는 캐스트가 없다
      for (const tag of textFieldTags(source)) {
        expect(tag).not.toMatch(/\bas (any|unknown)\b/);
      }
      // 기존 ChipGroup 캐스트 1건 외에 늘리지 않는다(범위 밖이라 그대로 둔다)
      expect(source.match(/\bas any\b/g) ?? []).toHaveLength(0);
      expect((source.match(/\bas unknown as\b/g) ?? []).length).toBeLessThanOrEqual(1);
    }
    expect(orderNew).toContain("@toss/tds-mobile");
    expect(orderEdit).toContain("@toss/tds-mobile");
  });
});
