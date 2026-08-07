import { describe, it, expect } from "vitest";
import { buildAbacusProblem, validateProblem, type AbacusCfg } from "@/lib/abacus";

const base: AbacusCfg = {
  mode: "flash", count: 5, digits: 2, speedMs: 700, listenLevel: 6, includeSub: true,
};

describe("珠心算出题引擎 · 全规则回归", () => {
  const cases: Partial<AbacusCfg>[] = [
    { digits: 1, count: 10, includeSub: true },
    { digits: 2, count: 8, includeSub: true },
    { digits: 3, count: 10, includeSub: true },
    { digits: 5, count: 15, includeSub: true },
    { digits: 4, count: 20, includeSub: false },
    { digits: 5, count: 5, includeSub: true },
  ];

  for (const c of cases) {
    const cfg = { ...base, ...c };
    it(`${cfg.digits}位 ${cfg.count}笔 ${cfg.includeSub ? "混合" : "纯加"} — 500题全部合规`, () => {
      let bad = 0;
      for (let i = 0; i < 500; i++) {
        const p = buildAbacusProblem(cfg);
        if (validateProblem(p, cfg.digits, cfg.includeSub).length) bad++;
      }
      expect(bad).toBe(0);
    });
  }
});
