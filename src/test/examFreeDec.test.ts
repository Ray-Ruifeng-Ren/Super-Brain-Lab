// 2026-11-03 付海东:自定义出题的小数题小数点位置不限 —— 3位×3位要有 0.356×0.27、0.457×0.129、1.96×0.324、2.54×0.194 这类;
// 除法同样;保留两位小数时答案不能为 0。等级鉴定 / 比赛题型不受影响(仍按样卷)。
import { describe, it, expect } from "vitest";
import { genMdGroup, mulDecPlaces } from "@/lib/exam/generate";

const dp = (t: string) => (t.includes(".") ? t.split(".")[1].length : 0);
describe("自定义出题 · 小数点位置不限", () => {
  it("乘:3位×3位 两个因数都带小数,出现纯小数 0.xxx、两位小数、一位小数;答案非 0", () => {
    const ps = Array.from({ length: 20 }, () => genMdGroup("mul", [[3, 3, 30]], 2, [15, 15], false, false, undefined, true)).flat();
    const fac = ps.filter((p) => p.a.includes(".")).flatMap((p) => [p.a, p.b]);
    expect(fac.some((t) => /^0\.\d{3}$/.test(t))).toBe(true);         // 0.356
    expect(fac.some((t) => /^\d\.\d{2}$/.test(t))).toBe(true);         // 1.96
    expect(fac.some((t) => /^\d{2}\.\d$/.test(t))).toBe(true);         // 51.7
    for (const p of ps.filter((p) => p.a.includes("."))) {
      expect(p.b.includes("."), `${p.a}×${p.b}`).toBe(true);           // 两个都带小数
      expect(Number(p.answer.replace(/,/g, "")) > 0, `${p.a}×${p.b}=${p.answer}`).toBe(true);
      expect(dp(p.answer)).toBe(2);
    }
  });
  it("除:除数可以是纯小数;保留两位小数的答案都不为 0", () => {
    const ps = Array.from({ length: 20 }, () => genMdGroup("div", [[3, 3, 30]], 2, [15, 15], false, false, undefined, true)).flat();
    const decs = ps.filter((p) => dp(p.answer) === 2);
    expect(decs.length).toBeGreaterThan(100);
    expect(decs.some((p) => /^0\.\d{3}$/.test(p.b))).toBe(true);
    for (const p of decs) expect(Number(p.answer.replace(/,/g, "")) > 0, `${p.a}÷${p.b}=${p.answer}`).toBe(true);
  });
  // 2026-11-04 付海东「如果答案是 3 位,也可以出 0.56 除 0.13」:被除数短的题也要有,且四舍五入后答案正确
  it("除:有被除数短的题(0.56 ÷ 0.13 = 4.31 这种),答案按四舍五入核对", () => {
    const ps = Array.from({ length: 20 }, () => genMdGroup("div", [[3, 3, 30]], 2, [15, 15], false, false, undefined, true)).flat();
    const decs = ps.filter((p) => dp(p.answer) === 2);
    const sig = (t: string) => t.replace(/[,.]/g, "").replace(/^0+/, "").length;
    const short = decs.filter((p) => sig(p.a) <= 4);
    expect(short.length).toBeGreaterThan(decs.length / 4);
    // 精确核对:被除数 ÷ 除数 四舍五入到两位 = 答案
    const units = (t: string) => { const [i, f = ""] = t.replace(/,/g, "").split("."); return { v: BigInt(i + f), k: f.length }; };
    for (const p of decs) {
      const a = units(p.a), b = units(p.b), ans = units(p.answer);
      // a/10^ka ÷ b/10^kb × 100 = a·10^kb·100 / (b·10^ka);四舍五入
      const num = a.v * 10n ** BigInt(b.k + 2), den = b.v * 10n ** BigInt(a.k);
      const r = (2n * num + den) / (2n * den);
      expect(r, `${p.a}÷${p.b}=${p.answer}`).toBe(ans.v);
    }
  });
  it("等级鉴定 / 比赛题型规则不变:不出 3 位小数", () => {
    expect(mulDecPlaces(3)).not.toContain(3);
    const ps = Array.from({ length: 10 }, () => genMdGroup("mul", [[3, 3, 30]], 2, [15, 15])).flat();
    for (const p of ps) { expect(dp(p.a)).not.toBe(3); expect(dp(p.b)).not.toBe(3); }
  });
});
