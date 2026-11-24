// 2026-11-06 出题系统自定义加减「知识点」:每一笔逐档指法都在本关允许集里,且每题都出现目标指法;题面与答案一致
import { describe, it, expect } from "vitest";
import { genAddsubPart } from "@/lib/exam/generate";
import { COACH_STAGES, allowedClasses, termRodClasses } from "@/lib/fingering";

describe("出题系统 · 按指法知识点出题", () => {
  for (const st of COACH_STAGES) {
    it(`${st.name}:2 位 5 笔 × 40 题`, () => {
      const ps = genAddsubPart({ n: 40, d: { 2: 5 }, m: 0, stage: st.id });
      const ok = allowedClasses(st.id, 2);
      let hit = 0;
      for (const p of ps) {
        expect(p.terms).toHaveLength(5);
        expect(p.terms.every((t) => Math.abs(t) >= 10 && Math.abs(t) < 100)).toBe(true);
        const sum = p.terms.reduce((a, b) => a + b, 0);
        expect(p.answer.replace(/,/g, "")).toBe(String(sum));
        // 逐笔逐档判类(多位数时十位也算,同 AI 陪练 [F10] 测试)
        let total = 0; const cls: string[] = [];
        for (const t of p.terms) { const r = termRodClasses(total, t); expect(r, `${p.texts.join(" ")}`).not.toBeNull(); cls.push(...(r ?? [])); total += t; }
        for (const c of cls) expect(ok.has(c as never), `${p.texts.join(" ")} → ${c}`).toBe(true);
        if (cls.some((c) => (st.target as string[]).includes(c))) hit++;
      }
      expect(hit).toBeGreaterThanOrEqual(38);
    });
  }
});

// 2026-11-07 付海东「上下不要出现一模一样的数字」(截图 −32 下面紧接 32)
describe("按指法出题 · 上下两笔不相同", () => {
  it("七关 × 1/2/3 位 × 各 80 题,相邻两笔绝对值都不相等", async () => {
    const { generateCoachProblem } = await import("@/lib/fingering");
    let dup = 0, total = 0;
    for (const st of COACH_STAGES) for (const d of [1, 2, 3]) for (let i = 0; i < 80; i++) {
      const p = generateCoachProblem(st.id, 8, d); total++;
      if (p.terms.some((t, k) => k > 0 && Math.abs(t) === Math.abs(p.terms[k - 1]))) dup++;
    }
    expect(dup, `${dup}/${total}`).toBe(0);
  }, 120_000);
});
