import { describe, it, expect } from "vitest";
import { buildAbacusProblem, validateProblem, type AbacusCfg } from "@/lib/abacus";

const base: AbacusCfg = {
  mode: "flash", count: 5, minDigits: 2, maxDigits: 3, speedMs: 700, flashBatch: 1, listenLevel: 1, addsub: "mix",
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
    });
  }
});
