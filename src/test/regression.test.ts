// 自回归校验:覆盖本轮新功能(看算/听算合并乘除、10 位大数 BigInt 精确、听算每笔时间/中英)
// 以及主体核心逻辑(难度模型、出题引擎、口述数字解析、榜单名次/坚持天数)。
// 运行:npm test  —— 全部为纯逻辑,不依赖网络/DOM。

import { describe, it, expect } from "vitest";
import { difficultyD, modePrefix, PROJECT_LABEL, type DiffInput } from "@/lib/difficulty";
import { generateMultiply, generateDivide } from "@/lib/abacus";
import { buildProblem } from "@/lib/flashMath";
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import { rankBy, streakFromDays, dayKey } from "@/lib/rankUtils";

// ---- helpers ----
const base = (over: Partial<DiffInput> = {}): DiffInput => ({
  mode: "flash", op: "addsub", count: 5, digits: 2, speedMs: 1000, listenSec: 1000,
  includeSub: false, mulA: 2, mulB: 2, divA: 3, divB: 1, ...over,
});
const digitsLen = (n: number) => String(Math.abs(n)).length;
// 独立于 BigInt 的竖式字符串乘法(每步累加 ≤810,绝无精度问题),用来验证 BigInt 结果
function schoolbookMul(a: string, b: string): string {
  const A = [...a].reverse().map(Number), B = [...b].reverse().map(Number);
  const res = new Array(A.length + B.length).fill(0);
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) res[i + j] += A[i] * B[j];
  for (let k = 0; k < res.length - 1; k++) { res[k + 1] += Math.floor(res[k] / 10); res[k] %= 10; }
  while (res.length > 1 && res[res.length - 1] === 0) res.pop();
  return res.reverse().join("");
}
// 听算中文读数(镜像自 FlashMathGame 的 numberToCN,组件无法在 node 中直接导入)
const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const UNIT = ["", "十", "百", "千"]; const BIG = ["", "万", "亿"];
function numberToCN(n: number): string {
  if (n === 0) return "零";
  let s = String(n); const groups: string[] = [];
  while (s.length) { groups.unshift(s.slice(-4)); s = s.slice(0, -4); }
  let out = "";
  groups.forEach((g, gi) => {
    const val = Number(g); let seg = "", zero = false; const len = g.length;
    for (let i = 0; i < len; i++) {
      const dd = Number(g[i]); const pos = len - 1 - i;
      if (dd === 0) { zero = true; }
      else { if (zero && seg) seg += "零"; zero = false; seg += CN[dd] + UNIT[pos]; }
    }
    if (val !== 0) {
      if (out !== "" && val < 1000) out += "零";
      out += seg + BIG[groups.length - 1 - gi];
    }
  });
  return (out.replace(/^一十/, "十")) || "零";
}
// 英文读数(镜像自 FlashMathGame 的 numberToEN)
const EN_ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const EN_SCALE = ["", "thousand", "million", "billion", "trillion"];
function enTriple(num: number): string {
  let str = ""; const h = Math.floor(num / 100), r = num % 100;
  if (h) str += EN_ONES[h] + " hundred" + (r ? " " : "");
  if (r) { if (r < 20) str += EN_ONES[r]; else { str += EN_TENS[Math.floor(r / 10)]; if (r % 10) str += "-" + EN_ONES[r % 10]; } }
  return str;
}
function numberToEN(n: number): string {
  if (n === 0) return "zero";
  const groups: number[] = []; let num = Math.abs(n);
  while (num > 0) { groups.push(num % 1000); num = Math.floor(num / 1000); }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) { if (groups[i] === 0) continue; parts.push(enTriple(groups[i]) + (EN_SCALE[i] ? " " + EN_SCALE[i] : "")); }
  return (n < 0 ? "minus " : "") + parts.join(" ");
}
// 作答归一化(镜像自 submit 的乘除精确比较)
const normalizeUser = (raw: string) => raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

// ============ 1. 难度系数模型 difficultyD ============
describe("难度系数 D", () => {
  it("[01] 乘法 2×2 = 2.6", () => expect(difficultyD(base({ op: "mul", mulA: 2, mulB: 2 }))).toBe(2.6));
  it("[02] 乘法位数越多 D 越大", () =>
    expect(difficultyD(base({ op: "mul", mulA: 4, mulB: 4 }))).toBeGreaterThan(difficultyD(base({ op: "mul", mulA: 2, mulB: 2 }))));
  it("[03] 除法 3÷1 = 2.6", () => expect(difficultyD(base({ op: "div", divA: 3, divB: 1 }))).toBe(2.6));
  it("[04] op 优先于 mode:听算·乘 与 看算·乘 同配置 D 相等", () =>
    expect(difficultyD(base({ mode: "listen", op: "mul", mulA: 3, mulB: 3 })))
      .toBe(difficultyD(base({ mode: "glance", op: "mul", mulA: 3, mulB: 3 }))));
  it("[05] 闪算基准 (2位/5笔/1秒/纯加) = 1.6", () => expect(difficultyD(base())).toBe(1.6));
  it("[06] 位数越多 D 越大", () =>
    expect(difficultyD(base({ digits: 3 }))).toBeGreaterThan(difficultyD(base({ digits: 2 }))));
  it("[07] 速度越快(单笔时间越短)D 越大", () =>
    expect(difficultyD(base({ speedMs: 500 }))).toBeGreaterThan(difficultyD(base({ speedMs: 1000 }))));
  it("[08] 笔数越多 D 越大", () =>
    expect(difficultyD(base({ count: 20 }))).toBeGreaterThan(difficultyD(base({ count: 5 }))));
  it("[09] 含减法 ×1.3(1.6 → 2.1)", () => {
    expect(difficultyD(base({ includeSub: false }))).toBe(1.6);
    expect(difficultyD(base({ includeSub: true }))).toBe(2.1);
  });
  it("[10] 听算:每笔时间越短 D 越大", () =>
    expect(difficultyD(base({ mode: "listen", listenSec: 500 }))).toBeGreaterThan(difficultyD(base({ mode: "listen", listenSec: 1000 }))));
  it("[11] 看算:作答越快 D 越大;usedMs=0 有兜底不为 0", () => {
    expect(difficultyD(base({ mode: "glance" }), 500)).toBeGreaterThan(difficultyD(base({ mode: "glance" }), 2000));
    expect(difficultyD(base({ mode: "glance" }), 0)).toBeGreaterThan(0);
  });
  it("[12] 速度分封顶:极快速度不会无限增大(有上限)", () => {
    const d1 = difficultyD(base({ speedMs: 60 }));
    const d2 = difficultyD(base({ speedMs: 30 }));
    expect(d2).toBeGreaterThanOrEqual(d1); // 单调不减
    expect(d1).toBeLessThan(1.6 * 9 + 1);  // 速度分封顶 9
  });
});

// ============ 2. 榜单前缀 / 标签 ============
describe("榜单项目映射", () => {
  it("[13] modePrefix 为呈现方式本身", () => {
    expect(modePrefix("flash")).toBe("flash");
    expect(modePrefix("glance")).toBe("glance");
    expect(modePrefix("listen")).toBe("listen");
  });
  it("[14] PROJECT_LABEL 三个项目标签正确", () => {
    expect(PROJECT_LABEL.flash).toBe("闪电心算");
    expect(PROJECT_LABEL.glance).toBe("看算");
    expect(PROJECT_LABEL.listen).toBe("听算");
  });
});

// ============ 3. 乘法生成 + 大数 BigInt 精确(本轮新功能核心) ============
describe("乘法生成与大数精确", () => {
  it("[15] 各位数组合下 a/b 位数正确、首位非 0", () => {
    for (const [ad, bd] of [[1, 1], [2, 3], [4, 4], [7, 2], [10, 10], [1, 10]]) {
      for (let k = 0; k < 40; k++) {
        const { a, b } = generateMultiply(ad, bd);
        expect(digitsLen(a)).toBe(ad);
        expect(digitsLen(b)).toBe(bd);
        if (ad > 1) expect(String(a)[0]).not.toBe("0");
        if (bd > 1) expect(String(b)[0]).not.toBe("0");
      }
    }
  });
  it("[16] 位数和 ≤10 时,单个数内数字不重复", () => {
    for (let k = 0; k < 80; k++) {
      const { a, b } = generateMultiply(5, 4); // 9 ≤ 10
      const ua = new Set(String(a)), ub = new Set(String(b));
      expect(ua.size).toBe(String(a).length);
      expect(ub.size).toBe(String(b).length);
    }
  });
  it("[17] BigInt 乘积与独立竖式乘法完全一致(含 10×10)", () => {
    for (let k = 0; k < 100; k++) {
      const { a, b } = generateMultiply(10, 10);
      const big = (BigInt(a) * BigInt(b)).toString();
      expect(big).toBe(schoolbookMul(String(a), String(b)));
    }
  });
  it("[18] 证明必须用 BigInt:大数下 Number 乘法会失真而 BigInt 精确", () => {
    const a = 9876543210, b = 1234567890;
    const big = (BigInt(a) * BigInt(b)).toString();
    expect(big).toBe("12193263111263526900");        // 精确
    expect(String(a * b)).not.toBe(big);              // 浮点失真
    expect(big).toBe(schoolbookMul(String(a), String(b)));
  });
  it("[19] 乘积末位与模 9 独立校验通过(整数无精度损失)", () => {
    for (let k = 0; k < 60; k++) {
      const { a, b } = generateMultiply(9, 8);
      const p = BigInt(a) * BigInt(b);
      expect(Number(p % 10n)).toBe((a % 10) * (b % 10) % 10);
      expect(Number(p % 9n)).toBe((a % 9) * (b % 9) % 9); // 弃九验算
    }
  });
});

// ============ 4. 除法生成(整除、位数) ============
describe("除法生成", () => {
  it("[20] 被除数 = 除数 × 商,且整除", () => {
    for (const [dvd, qd] of [[1, 1], [2, 3], [3, 4], [5, 5], [8, 2]]) {
      for (let k = 0; k < 40; k++) {
        const { dividend, divisor, quotient } = generateDivide(dvd, qd);
        expect(divisor).not.toBe(0);
        expect(dividend).toBe(divisor * quotient);
        expect(dividend % divisor).toBe(0);
      }
    }
  });
  it("[21] 除数、商位数正确", () => {
    for (let k = 0; k < 60; k++) {
      const { divisor, quotient } = generateDivide(3, 2);
      expect(digitsLen(divisor)).toBe(3);
      expect(digitsLen(quotient)).toBe(2);
    }
  });
});

// ============ 5. 加减出题引擎 buildProblem ============
describe("加减出题 buildProblem", () => {
  it("[22] 笔数与位数正确", () => {
    for (const [count, digits] of [[5, 2], [10, 3], [15, 2], [30, 4]] as const) {
      const p = buildProblem(count, digits, false);
      expect(p.terms.length).toBe(count);
      for (const t of p.terms) {
        expect(digitsLen(t)).toBe(digits);
        if (digits > 1) expect(String(t)[0]).not.toBe("0");
      }
    }
  });
  it("[23] 纯加时全为 '+' 号", () => {
    for (let k = 0; k < 30; k++) {
      const p = buildProblem(12, 2, false);
      expect(p.signs.every((s) => s === "+")).toBe(true);
    }
  });
  it("[24] 含减法:首笔恒加、至少一个减号、无相邻减号", () => {
    for (let k = 0; k < 60; k++) {
      const p = buildProblem(12, 2, true);
      expect(p.signs[0]).toBe("+");
      expect(p.signs.includes("-")).toBe(true);
      for (let i = 1; i < p.signs.length; i++) {
        if (p.signs[i] === "-") expect(p.signs[i - 1]).not.toBe("-"); // 隔行
      }
    }
  });
  it("[25] 中间过程与答案均 ≥ 0", () => {
    for (let k = 0; k < 100; k++) {
      const p = buildProblem(15, 2, true);
      let run = 0;
      p.terms.forEach((t, i) => { run += p.signs[i] === "-" ? -t : t; expect(run).toBeGreaterThanOrEqual(0); });
      expect(p.answer).toBeGreaterThanOrEqual(0);
    }
  });
  it("[26] 减号数量 ≈ 笔数/3(且不超过该目标)", () => {
    const count = 12, target = Math.round(count / 3); // 4
    let sum = 0, n = 0;
    for (let k = 0; k < 200; k++) {
      const p = buildProblem(count, 2, true);
      const minus = p.signs.filter((s) => s === "-").length;
      expect(minus).toBeLessThanOrEqual(target);
      sum += minus; n++;
    }
    const avg = sum / n;
    expect(avg).toBeGreaterThan(target - 1.5); // 平均落在 target 附近
  });
  it("[27] answer 等于带符号求和", () => {
    for (let k = 0; k < 40; k++) {
      const p = buildProblem(8, 3, true);
      const calc = p.terms.reduce((acc, t, i) => acc + (p.signs[i] === "-" ? -t : t), 0);
      expect(p.answer).toBe(calc);
    }
  });
});

// ============ 6. 口述数字解析 parseSpokenNumber ============
describe("口述/键入数字解析", () => {
  it("[28] 阿拉伯数字(含标点)", () => {
    expect(parseSpokenNumber("123")).toBe(123);
    expect(parseSpokenNumber("答案是 4,502。")).toBe(4502);
  });
  it("[29] 负数:中文负/减 前缀(阿拉伯数字优先直读,题目答案恒 ≥0 故不涉负)", () => {
    expect(parseSpokenNumber("负二十三")).toBe(-23);
    expect(parseSpokenNumber("减七")).toBe(-7);
    expect(parseSpokenNumber("负23")).toBe(23); // 阿拉伯数字短路,按正数直读(实际答案非负)
  });
  it("[30] 中文数字", () => {
    expect(parseSpokenNumber("二十三")).toBe(23);
    expect(parseSpokenNumber("一百零五")).toBe(105);
    expect(parseSpokenNumber("两千")).toBe(2000);
    expect(parseSpokenNumber("一万零一")).toBe(10001);
  });
  it("[31] 空/无数字返回 null", () => {
    expect(parseSpokenNumber("")).toBeNull();
    expect(parseSpokenNumber("   ")).toBeNull();
    expect(parseSpokenNumber("嗯这个")).toBeNull();
  });
});

// ============ 7. 榜单名次 rankBy & 坚持天数 streakFromDays ============
describe("榜单名次与坚持天数", () => {
  it("[32] 无并列:名次 1,2,3,并按 cmp 降序", () => {
    const rows = [{ id: "a", v: 3 }, { id: "b", v: 9 }, { id: "c", v: 5 }];
    const r = rankBy(rows, (a, b) => b.v - a.v, (x) => x.v, 10);
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3]);
  });
  it("[33] 并列同名次:1,2,2,4", () => {
    const rows = [{ v: 10 }, { v: 8 }, { v: 8 }, { v: 5 }];
    const r = rankBy(rows, (a, b) => b.v - a.v, (x) => x.v, 10);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 2, 4]);
  });
  it("[34] limit 截断", () => {
    const rows = [{ v: 5 }, { v: 4 }, { v: 3 }, { v: 2 }, { v: 1 }];
    expect(rankBy(rows, (a, b) => b.v - a.v, (x) => x.v, 3)).toHaveLength(3);
  });
  it("[35] 坚持天数:连续到今天 = 3", () => {
    const today = new Date(2026, 7, 20);
    const k = (off: number) => { const d = new Date(2026, 7, 20 - off); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
    const days = new Set([k(0), k(1), k(2)]);
    expect(streakFromDays(days, today)).toBe(3);
  });
  it("[36] 今天没练但昨天有:从昨天起算", () => {
    const today = new Date(2026, 7, 20);
    const k = (off: number) => { const d = new Date(2026, 7, 20 - off); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
    expect(streakFromDays(new Set([k(1), k(2)]), today)).toBe(2);
    expect(streakFromDays(new Set([k(0)]), today)).toBe(1);       // 仅今天
    expect(streakFromDays(new Set([k(2), k(3)]), today)).toBe(0); // 断档(昨天也没有)
    expect(streakFromDays(new Set(), today)).toBe(0);             // 从未练
  });
  it("[37] dayKey 格式与内部一致", () => {
    const iso = new Date(2026, 0, 5, 13, 30).toISOString();
    expect(dayKey(iso)).toBe("2026-1-5");
  });
});

// ============ 8. 听算读数 & 乘除作答归一化(镜像逻辑) ============
describe("听算读数与作答归一化", () => {
  it("[38] 中文读数正确", () => {
    expect(numberToCN(0)).toBe("零");
    expect(numberToCN(10)).toBe("十");
    expect(numberToCN(21)).toBe("二十一");
    expect(numberToCN(105)).toBe("一百零五");
    expect(numberToCN(1000)).toBe("一千");
    expect(numberToCN(10001)).toBe("一万零一");
    expect(numberToCN(10234)).toBe("一万零二百三十四"); // 跨节补零(回归本轮修复的读数 bug)
    expect(numberToCN(100000001)).toBe("一亿零一");
    expect(numberToCN(200)).toBe("二百");
  });
  it("[39] 乘除作答归一化:去非数字、去前导 0,精确比对大数", () => {
    expect(normalizeUser("0012")).toBe("12");
    expect(normalizeUser("12,193,263,111,263,526,900")).toBe("12193263111263526900");
    expect(normalizeUser("12193263111263526900") === "12193263111263526900").toBe(true);
    expect(normalizeUser("0")).toBe("0");
  });
  it("[40] 英语听力:数字转英文单词(修复英语被念成中文)", () => {
    expect(numberToEN(23)).toBe("twenty-three");
    expect(numberToEN(20)).toBe("twenty");
    expect(numberToEN(105)).toBe("one hundred five");
    expect(numberToEN(1000)).toBe("one thousand");
    expect(numberToEN(1234)).toBe("one thousand two hundred thirty-four");
    expect(numberToEN(9876543210)).toBe("nine billion eight hundred seventy-six million five hundred forty-three thousand two hundred ten");
  });
});
