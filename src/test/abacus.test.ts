import { describe, it, expect } from "vitest";
import { buildAbacusProblem, validateProblem, DEFAULT_ABACUS_CFG, type AbacusCfg } from "@/lib/abacus";

const base: AbacusCfg = {
  ...DEFAULT_ABACUS_CFG, mode: "flash", count: 5, minDigits: 2, maxDigits: 3, speedMs: 700, flashBatch: 1, listenLevel: 1, addsub: "mix",
};

describe("珠心算出题引擎 · 全规则回归", () => {
  const cases: Partial<AbacusCfg>[] = [
    { minDigits: 1, maxDigits: 1, count: 10, addsub: "mix" },
    { minDigits: 2, maxDigits: 3, count: 8, addsub: "mix" },
    { minDigits: 3, maxDigits: 5, count: 10, addsub: "mix" }, // 位数范围
    { minDigits: 5, maxDigits: 5, count: 15, addsub: "mix" },
    { minDigits: 4, maxDigits: 4, count: 20, addsub: "add" }, // 纯加
    { minDigits: 3, maxDigits: 4, count: 12, addsub: "sub" }, // 纯减
    { minDigits: 3, maxDigits: 5, count: 6, addsub: "sub" },
  ];

  for (const c of cases) {
    const cfg = { ...base, ...c };
    it(`${cfg.minDigits}-${cfg.maxDigits}位 ${cfg.count}笔 ${cfg.addsub} — 500题全部合规`, () => {
      let bad = 0;
      for (let i = 0; i < 500; i++) {
        const p = buildAbacusProblem(cfg);
        if (validateProblem(p, cfg).length) bad++;
      }
      expect(bad).toBe(0);
    }, 30_000); // 500 题全量校验,机器忙时 5s 默认超时不够
  }
});

// 2026-10-11 付海东:一位数乘数/除数/商不能出 0、1;商不为 0
describe("乘除出题边界", () => {
  it("MD1 乘法一位数操作数 ∈ [2,9];多位数无前导零", async () => {
    const { generateMultiply } = await import("@/lib/abacus");
    for (let i = 0; i < 300; i++) {
      const { a, b, answer } = generateMultiply(4, 1);
      expect(b).toBeGreaterThanOrEqual(2); expect(b).toBeLessThanOrEqual(9);
      expect(a).toBeGreaterThanOrEqual(1000); expect(answer).toBe(a * b);
      const m = generateMultiply(1, 1);
      expect(m.a).toBeGreaterThanOrEqual(2); expect(m.b).toBeGreaterThanOrEqual(2);
    }
  });
  it("MD2 除法:除数/商一位数 ∈ [2,9],多位商不为 0,整除", async () => {
    const { generateDivide } = await import("@/lib/abacus");
    for (let i = 0; i < 300; i++) {
      const d1 = generateDivide(3, 1);
      expect(d1.quotient).toBeGreaterThanOrEqual(2); expect(d1.quotient).toBeLessThanOrEqual(9);
      expect(d1.dividend).toBe(d1.divisor * d1.quotient); expect(d1.dividend).toBeGreaterThan(0);
      const d2 = generateDivide(1, 2);
      expect(d2.divisor).toBeGreaterThanOrEqual(2); expect(d2.quotient).toBeGreaterThanOrEqual(10);
    }
  });
});
