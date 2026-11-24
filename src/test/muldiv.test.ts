// 乘算基础 / 基础除算 约束出题(2026-10-13 付海东):特定乘数、进位组合、特定除数、够除
import { describe, it, expect } from "vitest";
import { generateMultiplyWith, generateDivideWith, carryPattern, isExact } from "@/lib/abacus";
import { answerText, parseRemAnswer } from "@/lib/homework";
import { normalizeItem, itemLabel, genProblem, decimalShifts, shift, roundTo, scrollSecFor, obstacleSpeedMs, DEFAULT_ITEM } from "@/lib/homework";
import { classesOfProblem, allowedClasses } from "@/lib/fingering";

describe("乘算基础 / 基础除算", () => {
  it("MD3 特定乘数:乘数各位只来自选中集合;2×1 进位组合全部四种可生成且判定正确", () => {
    for (let k = 0; k < 200; k++) {
      const { b } = generateMultiplyWith(2, 1, { digits: [2] });
      expect(b).toBe(2);
      const { b: b2 } = generateMultiplyWith(2, 2, { digits: [2, 3] });
      expect(String(b2).split("").every((c) => "23".includes(c))).toBe(true);
    }
    for (const c of ["cc", "cn", "nc", "nn"] as const) {
      for (let k = 0; k < 100; k++) {
        const { a, b } = generateMultiplyWith(2, 1, { carry: c });
        expect(carryPattern(a, b), `${a}×${b}`).toBe(c);
      }
    }
    expect(carryPattern(34, 2)).toBe("nn");
    expect(carryPattern(67, 2)).toBe("cc");
    expect(carryPattern(63, 2)).toBe("cn");
    expect(carryPattern(36, 2)).toBe("nc");
  });

  it("MD4 特定除数 + 够除(整除)/不够除(除不尽)", () => {
    expect(isExact(84, 2)).toBe(true);
    expect(isExact(85, 2)).toBe(false);
    for (let i = 0; i < 60; i++) {
      const q = generateDivideWith(3, 3, { enough: "no" });
      expect(q.remainder).toBeGreaterThan(0); expect(q.remainder).toBeLessThan(q.divisor);
      expect(q.dividend).toBe(q.divisor * q.quotient + q.remainder); expect(isExact(q.dividend, q.divisor)).toBe(false);
      const p = generateDivideWith(2, 2, { enough: "yes" });
      expect(p.remainder).toBe(0); expect(p.dividend).toBe(p.divisor * p.quotient);
    }
    for (let k = 0; k < 200; k++) {
      const p = generateDivideWith(1, 2, { digits: [3, 7], enough: "yes" });
      expect([3, 7]).toContain(p.divisor); expect(isExact(p.dividend, p.divisor)).toBe(true);
      const q = generateDivideWith(1, 2, { digits: [3, 7], enough: "no" });
      expect([3, 7]).toContain(q.divisor); expect(isExact(q.dividend, q.divisor)).toBe(false);
    }
    for (let i = 0; i < 50; i++) expect(generateDivideWith(2, 2, { enough: "any" }).remainder).toBe(0); // 两者均可维持整除(旧作业不受影响)
  });
  it("MD7 不够除·无小数答「商……余数」(2026-10-21 付海东);小数题答案不为 0", () => {
    for (let i = 0; i < 200; i++) {
      const pr = genProblem({ ...DEFAULT_ITEM, project: "glance", op: "div", divD: 2, divQ: 2, divEnough: "no", decimals: false, decimalPlaces: 2 });
      const [a, b] = pr.terms; expect(pr.places).toBeUndefined(); expect(a % b).not.toBe(0);
      expect(pr.answer).toBe(Math.floor(a / b)); expect(pr.rem).toBe(a % b); expect(String(pr.answer).length).toBe(2);
      for (const places of [1, 2]) {
        const m = genProblem({ ...DEFAULT_ITEM, project: "glance", op: "mul", mulA: 1, mulB: 1, decimals: true, decimalPlaces: places });
        expect(m.answer).toBeGreaterThan(0);
        const d = genProblem({ ...DEFAULT_ITEM, project: "glance", op: "div", divD: 1, divQ: 1, divEnough: "yes", decimals: true, decimalPlaces: places });
        expect(d.answer).toBeGreaterThan(0);
      }
    }
  });

  it("MD6 小数:数值落在 [0.01,100),至少一个数带小数,答案精确(无浮点尾巴)", () => {
    expect(shift(125, 2)).toBe(1.25);
    expect(shift(31625, 4)).toBe(3.1625);
    expect(shift(3, -2)).toBe(300);
    expect(roundTo(3.1625, 2)).toBe(3.16);
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(0.125, 2)).toBe(0.13);
    for (let k = 0; k < 300; k++) {
      const ks = decimalShifts([125, 253]);
      expect(ks.some((x) => x > 0)).toBe(true);
      const mul = genProblem(normalizeItem({ project: "glance", op: "mul", mulA: 3, mulB: 3, decimals: true }));
      for (const t of mul.terms) { expect(t).toBeGreaterThanOrEqual(0.01); expect(t).toBeLessThan(100); }
      expect(mul.terms.some((t) => !Number.isInteger(t))).toBe(true);
      expect(Math.abs(mul.terms[0] * mul.terms[1] - mul.answer)).toBeLessThanOrEqual(0.005 + 1e-9); // 默认保留 2 位(四舍五入误差 ≤ 0.005)
      expect(String(mul.answer)).not.toMatch(/e|\.\d{9,}/);
      const div = genProblem(normalizeItem({ project: "glance", op: "div", divD: 1, divQ: 2, decimals: true, decimalPlaces: 4 }));
      expect(Number.isInteger(div.terms[0])).toBe(false);          // 被除数带小数
      expect(Number.isInteger(div.terms[1])).toBe(false);          // 除数带小数(小数 ÷ 小数)
      expect(div.terms[1]).toBeGreaterThanOrEqual(0.01); expect(div.terms[1]).toBeLessThan(100);
      expect(div.answer).toBeGreaterThanOrEqual(0.01); expect(div.answer).toBeLessThan(100); // 商在范围内
      expect(Math.abs(div.terms[0] / div.terms[1] - div.answer)).toBeLessThan(1e-9);
      expect(String(div.terms[0])).not.toMatch(/e|\.\d{9,}/);
      const r2 = genProblem(normalizeItem({ project: "glance", op: "mul", mulA: 3, mulB: 3, decimals: true, decimalPlaces: 2 }));
      expect(String(r2.answer).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2); // 四舍五入到 2 位
    }
  });

  it("H10 分知识点作业:按关卡出题,每笔指法 ∈ 本关允许集,标签带关名", () => {
    for (const stage of [1, 2, 3, 4, 6]) {
      const it1 = normalizeItem({ project: "listen", op: "addsub", stage, count: 6, digits: 1 });
      const allowed = new Set<string>([...allowedClasses(stage, 1)]);
      for (let k = 0; k < 40; k++) {
        const p = genProblem(it1);
        expect(p.terms.length).toBe(6);
        expect(p.terms.reduce((s, t, i) => s + (p.signs[i] === "-" ? -t : t), 0)).toBe(p.answer);
        for (const c of classesOfProblem(p.terms, p.signs)) expect(allowed.has(c), `stage ${stage}: ${c}`).toBe(true);
      }
    }
    expect(itemLabel(normalizeItem({ project: "glance", op: "addsub", stage: 2, stageLesson: 0 }))).toContain("满五加·加1");
    expect(normalizeItem({ project: "glance", op: "addsub", stage: 99 }).stage).toBe(7);
  });

  it("H11 心算马拉松:整题用时加速序列、统一小数位、答案=各笔之和", () => {
    const base = normalizeItem({ project: "scroll", scrollSec: 20, scrollAccel: true });
    expect([0, 1, 2, 3, 10].map((i) => scrollSecFor(base, i))).toEqual([20, 18, 16, 14, 6]);
    expect(scrollSecFor(normalizeItem({ project: "scroll", scrollSec: 5, scrollAccel: true }), 2)).toBe(3);
    expect(scrollSecFor(normalizeItem({ project: "scroll", scrollSec: 20, scrollAccel: false }), 5)).toBe(20);
    for (let k = 0; k < 100; k++) {
      const p = genProblem(normalizeItem({ project: "scroll", count: 8, digits: 2, includeSub: true, decimals: true, decimalPlaces: 1 }));
      expect(p.terms.length).toBe(8);
      expect(p.places).toBe(1);
      for (const t of p.terms) expect(String(t).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(1);
      const sum = p.terms.reduce((s, t, i) => s + (p.signs[i] === "-" ? -t : t), 0);
      expect(Math.abs(sum - p.answer)).toBeLessThan(1e-9);
    }
    expect(normalizeItem({ project: "scroll", op: "mul" }).op).toBe("addsub");
    expect(itemLabel(normalizeItem({ project: "scroll", scrollSec: 15, scrollAccel: true }))).toContain("15s/题·加速");
  });

  it("H13 障碍算:加速序列 1s→0.8→0.6 封底 40%;参数规整;标签", () => {
    const it1 = normalizeItem({ project: "obstacle", speedMs: 1000, scrollAccel: true, obstacleLevel: "high", obstacleKind: "shapes", count: 8, digits: 3 });
    expect([0, 1, 2, 3, 9].map((i) => obstacleSpeedMs(it1, i))).toEqual([1000, 800, 600, 400, 400]);
    expect(obstacleSpeedMs(normalizeItem({ project: "obstacle", speedMs: 1000 }), 5)).toBe(1000);
    expect(it1.op).toBe("addsub");
    expect(normalizeItem({ project: "obstacle", obstacleLevel: "x" as never, obstacleKind: "y" as never }).obstacleLevel).toBe("low");
    expect(itemLabel(it1)).toContain("干扰高·形状");
    const p = genProblem(it1); expect(p.terms.length).toBe(8);
  });

  it("MD5 作业项目规整与标签", () => {
    const it1 = normalizeItem({ project: "glance", op: "mul", mulA: 2, mulB: 1, mulDigits: [3, 3, 11, 2], mulCarry: "cn" });
    expect(it1.mulDigits).toEqual([2, 3]);
    expect(itemLabel(it1)).toContain("乘数∈{2,3}");
    expect(itemLabel(it1)).toContain("十位进·个位不进");
    const it2 = normalizeItem({ project: "listen", op: "div", divDigits: [1, 9], divEnough: "no" });
    expect(it2.divDigits).toEqual([9]);
    expect(itemLabel(it2)).toContain("不够除");
    expect(normalizeItem({ project: "glance", op: "mul" }).mulCarry).toBe("any");
  });
  it("MD8 课堂演示同款配置(除数3位·商2位·不够除·小数开):每题都除不尽(付海东 2026-10-17 复测仍整除)", () => {
    for (let i = 0; i < 100; i++) {
      const p = genProblem(normalizeItem({ project: "glance", op: "div", divD: 3, divQ: 2, divEnough: "no", decimals: true, decimalPlaces: 2 }));
      expect(p.places).toBe(2); expect(Math.abs(p.answer - p.terms[0] / p.terms[1])).toBeLessThanOrEqual(0.005 + 1e-9);
      expect(Math.abs(p.terms[0] / p.terms[1] - Math.round(p.terms[0] / p.terms[1]))).toBeGreaterThan(1e-9); // 除不尽
      expect(p.terms.every((t) => !Number.isInteger(t))).toBe(true); // 小数 ÷ 小数
    }
  });
  it("MD9 小数除法全部是小数 ÷ 小数(2026-10-20 用户:不能是整数÷整数只答案带小数)", () => {
    for (const enough of ["yes", "no", "any"] as const) for (const [divD, divQ] of [[1, 1], [1, 2], [2, 2], [2, 3], [3, 2]]) for (let i = 0; i < 60; i++) {
      const p = genProblem(normalizeItem({ project: "glance", op: "div", divD, divQ, divEnough: enough, decimals: true, decimalPlaces: 2 }));
      expect(Number.isInteger(p.terms[0]), `${enough} ${divD}/${divQ}: ${p.terms}`).toBe(false);
      expect(Number.isInteger(p.terms[1]), `${enough} ${divD}/${divQ}: ${p.terms}`).toBe(false);
      expect(Math.abs(p.answer - p.terms[0] / p.terms[1])).toBeLessThanOrEqual(0.005 + 1e-9); // 浮点下 a/b 可能是 2.37499…,只比四舍五入误差
      expect(p.answer).toBeGreaterThan(0);
      for (const t of p.terms) expect(String(t).split(".")[1].length, `${p.terms}`).toBeLessThanOrEqual(4); // 题面小数位适中
      if (enough === "yes") expect(Math.abs(p.terms[0] / p.terms[1] - p.answer)).toBeLessThan(1e-9); // 够除:答案精确,不靠四舍五入
    }
    // 小数关:仍是整数 ÷ 整数(不影响原题型)
    for (let i = 0; i < 50; i++) {
      const p = genProblem(normalizeItem({ project: "glance", op: "div", divD: 2, divQ: 2, divEnough: "no", decimals: false }));
      expect(p.terms.every((t) => Number.isInteger(t))).toBe(true);
    }
  });
  it("MD10 余数作答解析与展示", () => {
    expect(parseRemAnswer("2余6")).toEqual({ q: 2, r: 6 });
    expect(parseRemAnswer("2……6")).toEqual({ q: 2, r: 6 });
    expect(parseRemAnswer("2...6")).toEqual({ q: 2, r: 6 });
    expect(parseRemAnswer("1,234余5")).toEqual({ q: 1234, r: 5 });
    expect(parseRemAnswer("2")).toBeNull();
    expect(parseRemAnswer("2余")).toBeNull();
    expect(answerText(2, 6)).toBe("2……6");
    expect(answerText(2.75)).toBe("2.75");
    expect(itemLabel(normalizeItem({ project: "glance", op: "div", divEnough: "no", decimals: false }))).toContain("不够除·带余数");
    expect(itemLabel(normalizeItem({ project: "glance", op: "div", divEnough: "no", decimals: true }))).not.toContain("带余数");
  });
  it("MD11 小数除法:商的位数 = 整数位 + 小数位(2026-10-25 付海东),答案四舍五入正确", () => {
    const sig = (x: number) => String(x).replace(".", "").replace(/^0+/, "").length;
    for (const [divD, divQ, p] of [[1, 2, 2], [1, 3, 2], [2, 2, 2], [1, 4, 2], [3, 2, 1], [2, 3, 1]] as const) for (let i = 0; i < 80; i++) {
      const pr = genProblem(normalizeItem({ project: "glance", op: "div", divD, divQ, divEnough: "no", decimals: true, decimalPlaces: p }));
      expect(pr.terms.every((t) => !Number.isInteger(t)), `${pr.terms}`).toBe(true); // 小数 ÷ 小数
      expect(pr.places).toBe(p);
      expect(Math.abs(pr.answer - pr.terms[0] / pr.terms[1])).toBeLessThanOrEqual(0.5 * 10 ** -p + 1e-9);
      expect(sig(pr.answer) === divQ || sig(pr.answer) === divQ + 1 || /0$/.test(pr.answer.toFixed(p)), `${pr.terms[0]}÷${pr.terms[1]}=${pr.answer} 商应 ${divQ} 位`).toBe(true);
      expect(pr.answer.toFixed(p).replace(".", "").replace(/^0+/, "").length, `${pr.answer}`).toBeLessThanOrEqual(divQ + 1);
    }
  });
});
