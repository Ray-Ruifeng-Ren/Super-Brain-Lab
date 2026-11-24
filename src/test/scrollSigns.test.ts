// 心算马拉松 加减混合(2026-10-14 付海东「选了加减混合还是纯加」):出题必须含减号
import { describe, it, expect } from "vitest";
import { normalizeItem, genProblem, genProblems } from "@/lib/homework";

describe("马拉松加减混合", () => {
  it("H12 includeSub=true 时 3位×30笔 每题都有减号;纯加时没有", () => {
    const mix = normalizeItem({ project: "scroll", count: 30, digits: 3, digitsMax: 3, includeSub: true });
    for (let k = 0; k < 30; k++) {
      const p = genProblem(mix);
      expect(p.signs.filter((s) => s === "-").length, JSON.stringify(p.signs)).toBeGreaterThan(0);
    }
    const ps = genProblems(normalizeItem({ project: "scroll", n: 5, count: 10, digits: 2, includeSub: true }));
    expect(ps.every((p) => p.signs.includes("-"))).toBe(true);
    const add = normalizeItem({ project: "scroll", count: 10, digits: 2, includeSub: false });
    expect(genProblem(add).signs.every((s) => s === "+")).toBe(true);
  });
});
