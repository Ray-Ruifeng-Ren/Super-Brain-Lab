// 2026-11-03 数珠互译位数放到 15:超过 10 位允许数字重复,生成的数位数必须等于设定(原先 11/12 位只出 10 位)
import { generateBead } from "@/lib/abacus";
import { normalizeItem } from "@/lib/homework";
import { test, expect } from "vitest";
test("bead digits up to 100 (2026-11-08)", () => {
  for (const d of [1, 2, 10, 11, 12, 15]) for (let k = 0; k < 200; k++) { const v = generateBead(d).value; expect(String(v).length, `${d}`).toBe(d === 1 ? 1 : d); }
  expect(normalizeItem({ project: "bead", beadDigits: 120 } as never).beadDigits).toBe(100);
  for (const d of [16, 40, 100]) { const g = generateBead(d); expect(g.str).toMatch(new RegExp(`^[1-9]\\d{${d - 1}}$`)); }
  expect(normalizeItem({ project: "bead", beadDir: "see" } as never).beadDir).toBe("see");
  expect(normalizeItem({ project: "bead", beadLimitSec: 30 } as never).beadLimitSec).toBe(30);
});
