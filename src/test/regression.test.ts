// 自回归校验:覆盖本轮新功能(看算/听算合并乘除、10 位大数 BigInt 精确、听算每笔时间/中英)
// 以及主体核心逻辑(难度模型、出题引擎、口述数字解析、榜单名次/坚持天数)。
// 运行:npm test  —— 全部为纯逻辑,不依赖网络/DOM。

import { describe, it, expect } from "vitest";
import { difficultyD, modePrefix, PROJECT_LABEL, type DiffInput } from "@/lib/difficulty";
import { classifyStep, generateCoachProblem, allowedClasses, COACH_STAGES, termRodClasses, __resetVariantUse } from "@/lib/fingering";
import { recordAdvisorResult, getAdvice, type AdvisorCfg } from "@/lib/advisor";
import { generateMultiply, generateDivide } from "@/lib/abacus";
import { buildProblem } from "@/lib/flashMath";
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import { rankBy, streakFromDays, dayKey } from "@/lib/rankUtils";

// ---- helpers ----
const base = (over: Partial<DiffInput> = {}): DiffInput => ({
  mode: "flash", op: "addsub", count: 5, digits: 2, speedMs: 1000, listenSec: 1000, listenSpeed: 5,
  includeSub: false, mulA: 2, mulB: 2, divD: 1, divQ: 3, ...over,
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

// ============ 0. AI 陪练 · 指法判类(看珠不看数) ============
describe("指法判类 classifyStep", () => {
  it("[F1] 直加:1+2、6+3、0+7(上5上2 也是直加)", () => {
    expect(classifyStep(1, 2)).toBe("直加");
    expect(classifyStep(6, 3)).toBe("直加");
    expect(classifyStep(0, 7)).toBe("直加");
  });
  it("[F2] 满五加:4+3=下5去2", () => expect(classifyStep(4, 3)).toBe("满五加"));
  it("[F3] 进位加:8+3、9+4、6+5、8+2(整颗5珠拿走不算拆)", () => {
    expect(classifyStep(8, 3)).toBe("进位加");
    expect(classifyStep(9, 4)).toBe("进位加");
    expect(classifyStep(6, 5)).toBe("进位加");
    expect(classifyStep(8, 2)).toBe("进位加");
  });
  it("[F4] 破五进位加:5+7、6+6、7+7、5+9(个位是整颗5珠,去补数去不动)", () => {
    expect(classifyStep(5, 7)).toBe("破五进位加");
    expect(classifyStep(6, 6)).toBe("破五进位加");
    expect(classifyStep(7, 7)).toBe("破五进位加");
    expect(classifyStep(5, 9)).toBe("破五进位加");
  });
  it("[F5] 直减/破五减:9−2 直减;5−3=去5还2 破五减", () => {
    expect(classifyStep(9, -2)).toBe("直减");
    expect(classifyStep(5, -3)).toBe("破五减");
  });
  it("[F6] 退位减:11−7、10−6、12−5(还的正是5珠本身,普通退位减)", () => {
    expect(classifyStep(11, -7)).toBe("退位减");
    expect(classifyStep(10, -6)).toBe("退位减");
    expect(classifyStep(12, -5)).toBe("退位减");
  });
  it("[F7] 退位满五减:12−7、12−6、13−8(还2时下珠不够,要借5)", () => {
    expect(classifyStep(12, -7)).toBe("退位满五减");
    expect(classifyStep(12, -6)).toBe("退位满五减");
    expect(classifyStep(13, -8)).toBe("退位满五减");
  });
  it("[F8] 看珠不看数:同是减6,10−6 退位减 vs 12−6 退位满五减", () => {
    expect(classifyStep(10, -6)).not.toBe(classifyStep(12, -6));
  });
  it("[F9] 定向出题(个位):每关500题,每笔类别 ∈ 本关允许集(目标+镜像配对+直加直减),总和正确,总值不越界", () => {
    for (const st of COACH_STAGES) {
      const allowed = allowedClasses(st.id, 1);
      for (let k = 0; k < 500; k++) {
        const p = generateCoachProblem(st.id, 6);
        let total = 0;
        p.terms.forEach((t, i) => {
          const d = p.signs[i] === "-" ? -t : t;
          expect(classifyStep(total, d)).toBe(p.classes[i]);
          expect(allowed.has(p.classes[i])).toBe(true);
          total += d;
          expect(total).toBeGreaterThanOrEqual(0); // 课本实证:总值中途可归零(1+4−5+9−5)
          expect(total).toBeLessThanOrEqual(35);   // 1位课总值封顶(五族关自然≤9,进/退位关≤35)
        });
        expect(total).toBe(p.answer);
        expect(p.answer).toBeGreaterThanOrEqual(1); // 但最终答案 ≥1
      }
    }
  }, 15000);
  it("[F10] 定向出题(多位数):每关100题×2/3位,每笔【每一档】的指法 ∈ 本关允许集", () => {
    for (const st of COACH_STAGES) {
      for (const digits of [2, 3]) {
        const allowed = allowedClasses(st.id, digits);
        const cap = 10 ** (digits + 1) - 1;
        for (let k = 0; k < 100; k++) {
          const p = generateCoachProblem(st.id, 5, digits);
          let total = 0;
          p.terms.forEach((t, i) => {
            const d = p.signs[i] === "-" ? -t : t;
            const rods = termRodClasses(total, d);
            expect(rods).not.toBeNull();
            for (const c of rods!) expect(allowed.has(c)).toBe(true);
            total += d;
            expect(total).toBeGreaterThanOrEqual(1);
            expect(total).toBeLessThanOrEqual(cap);
          });
          expect(total).toBe(p.answer);
        }
      }
    }
  });
  it("[F11] 数字分布:无数字垄断(≤20%)、1-9 全部出现(注:直加直减关里 9 只在档上为 0/9 时合法,天然偏少)", () => {
    __resetVariantUse();
    const tally: Record<number, number> = {};
    let n = 0;
    for (let k = 0; k < 300; k++) {
      const p = generateCoachProblem(1, 8);
      for (const t of p.terms) { tally[t] = (tally[t] ?? 0) + 1; n++; }
    }
    for (let x = 1; x <= 9; x++) {
      expect(tally[x] ?? 0).toBeGreaterThan(0);
      expect((tally[x] ?? 0) / n).toBeLessThan(0.2);
    }
  });
  it("[F12] 专项构成(还没学到只用前面的):满五加关无破五减;进位加关回位用破五减/满五加;每题至少一笔目标", () => {
    __resetVariantUse();
    const cases: [number, string, string[]][] = [
      [2, "满五加", ["满五加", "直加", "直减"]],
      [4, "进位加", ["进位加", "破五减", "满五加", "直加", "直减"]],
      [6, "退位减", ["退位减", "进位加", "破五进位加", "满五加", "破五减", "直加", "直减"]],
    ];
    for (const [st, target, allowed] of cases) {
      for (let k = 0; k < 50; k++) {
        const p = generateCoachProblem(st, 8);
        for (const c of p.classes) expect(allowed).toContain(c);
        expect(p.classes.filter((c) => c === target).length).toBeGreaterThan(0);
      }
    }
  });
  it("[F17] 综合滚动窗口均匀:相邻2题内单个数字出现次数 ≤ 期望+2(不许某数字扎堆)", () => {
    for (const [count, digits] of [[5, 2], [10, 1], [5, 3]] as const) {
      const probs = Array.from({ length: 60 }, () => buildProblem(count, digits, true));
      const cap = Math.ceil((2 * count * digits) / 9) + 2;
      for (let k = 0; k + 1 < probs.length; k++) {
        const tally: Record<string, number> = {};
        for (const p of [probs[k], probs[k + 1]]) for (const t of p.terms) for (const ch of String(t)) if (ch !== "0") tally[ch] = (tally[ch] ?? 0) + 1;
        expect(Math.max(...Object.values(tally))).toBeLessThanOrEqual(cap);
      }
    }
  });
  it("[F16] 综合大位数(3-9位):同一个数内数字不重复(持久袋残袋回归)", () => {
    for (const d of [3, 5, 6, 7, 9]) {
      for (let k = 0; k < 80; k++) {
        for (const t of buildProblem(8, d, true).terms) {
          const ds = String(t).split("");
          expect(new Set(ds).size).toBe(ds.length);
          expect(ds.length).toBe(d);
        }
      }
    }
  });
  it("[F15] 直加直减小课(1-4):包括首笔在内所有数字都 ≤4", () => {
    __resetVariantUse();
    for (let k = 0; k < 60; k++) {
      const p = generateCoachProblem(1, 6, 1, [1, 2, 3, 4]);
      for (const t of p.terms) expect(t).toBeLessThanOrEqual(4);
    }
  });
  it("[F14] 变式小课:加3满五课里所有满五加都是+3;9的进位加课里所有进位加都是+9", () => {
    __resetVariantUse();
    for (let k = 0; k < 40; k++) {
      const p2 = generateCoachProblem(2, 8, 1, [3]);
      p2.classes.forEach((c, i) => { if (c === "满五加") expect(p2.terms[i]).toBe(3); });
      expect(p2.classes.includes("满五加")).toBe(true);
      const p4 = generateCoachProblem(4, 8, 1, [9]);
      p4.classes.forEach((c, i) => { if (c === "进位加") expect(p4.terms[i]).toBe(9); });
      expect(p4.classes.includes("进位加")).toBe(true);
    }
  });
  it("[F13] 变式全覆盖:进位加关150题内,加1…加9 九条口诀全部出现", () => {
    __resetVariantUse();
    const seen = new Set<number>();
    for (let k = 0; k < 150; k++) {
      const p = generateCoachProblem(4, 8);
      p.classes.forEach((c, i) => { if (c === "进位加") seen.add(p.terms[i]); });
    }
    for (let x = 1; x <= 9; x++) expect(seen.has(x)).toBe(true);
  });
});

// ============ 0.5 AI 教练进阶梯子(付海东 2026-09-12 口径) ============
describe("综合训练教练建议 getAdvice", () => {
  const mk = (over: Partial<AdvisorCfg>): AdvisorCfg => ({ mode: "flash", op: "addsub", digits: 2, digitsMax: 2, includeSub: true, speedMs: 1000, count: 10, ...over });
  const feed = (cfg: AdvisorCfg, n = 20) => { window.localStorage.removeItem("flashmath:advisor"); window.localStorage.removeItem("flashmath:classStats"); for (let i = 0; i < n; i++) recordAdvisorResult(cfg, true); };
  it("[A1] 二位·10笔·1秒·全对 → 毕业:升三位、笔数回5、时间放宽", () => {
    const cfg = mk({});
    feed(cfg);
    const a = getAdvice(cfg)!;
    expect(a.patch.digits).toBe(3);
    expect(a.patch.count).toBe(5);
    expect(a.patch.speedMs).toBeGreaterThan(1000);
  });
  it("[A2] 三位·15笔·0.9秒·全对 → 升四位(全位数同构)", () => {
    const cfg = mk({ digits: 3, digitsMax: 3, count: 15, speedMs: 900 });
    feed(cfg);
    const a = getAdvice(cfg)!;
    expect(a.patch.digits).toBe(4);
    expect(a.patch.count).toBe(5);
  });
  it("[A3] 二位·5笔·全对 → 先建议笔数提到10(毕业要求10~15笔)", () => {
    const cfg = mk({ count: 5 });
    feed(cfg);
    expect(getAdvice(cfg)!.patch.count).toBe(10);
  });
  it("[A4] 二位·10笔·1.5秒·全对 → 建议压时间(未到1秒不毕业)", () => {
    const cfg = mk({ speedMs: 1500 });
    feed(cfg);
    const a = getAdvice(cfg)!;
    expect(a.patch.speedMs).toBeLessThan(1500);
    expect(a.patch.digits).toBeUndefined();
  });
  it("[A5] 准确率不足80%不给进阶建议", () => {
    const cfg = mk({});
    window.localStorage.removeItem("flashmath:advisor"); window.localStorage.removeItem("flashmath:classStats");
    for (let i = 0; i < 20; i++) recordAdvisorResult(cfg, i % 4 !== 0); // 75%
    const a = getAdvice(cfg);
    expect(a?.patch.digits).toBeUndefined();
  });
});

// ============ 1. 难度系数模型 difficultyD ============
describe("难度系数 D", () => {
  it("[01] 乘法 2×2 = 13.0(次线性,范围与加减同量级)", () => expect(difficultyD(base({ op: "mul", mulA: 2, mulB: 2 }))).toBe(13.0));
  it("[02] 乘法位数越多 D 越大,但不爆四位数", () => {
    expect(difficultyD(base({ op: "mul", mulA: 4, mulB: 4 }))).toBeGreaterThan(difficultyD(base({ op: "mul", mulA: 2, mulB: 2 })));
    expect(difficultyD(base({ op: "mul", mulA: 10, mulB: 10 }))).toBeLessThan(1000);
  });
  it("[03] 除法 除1位商3位 = 12.3(v2:只看除数和商)", () => expect(difficultyD(base({ op: "div", divD: 1, divQ: 3 }))).toBe(12.3));
  it("[03a] 除法排序:除2商2 > 除1商2 > 除2商1(商权重1.5倍)", () => {
    const D = (d: number, q: number) => difficultyD(base({ op: "div", divD: d, divQ: q }));
    expect(D(2, 2)).toBeGreaterThan(D(1, 2));
    expect(D(1, 2)).toBeGreaterThan(D(2, 1));
    expect(D(2, 3)).toBeGreaterThan(D(3, 2));
    expect(D(3, 2)).toBeGreaterThan(D(2, 2));
    expect(D(5, 6)).toBeGreaterThan(D(6, 5));
    expect(D(6, 5)).toBeGreaterThan(D(5, 5));
  });
  it("[03b] 除法与被除数无关:被除数同为10位时,除5商6 远难于 除8商3", () => {
    const D = (d: number, q: number) => difficultyD(base({ op: "div", divD: d, divQ: q }));
    expect(D(5, 6)).toBeGreaterThan(D(8, 3) * 1.5);
  });
  it("[03c] 乘法5位分水岭:4×6/7/8 仍递增但增幅小于5位以内", () => {
    const M = (a: number, b: number) => difficultyD(base({ op: "mul", mulA: a, mulB: b }));
    expect(M(4, 6)).toBeGreaterThan(M(4, 5));
    expect(M(4, 7)).toBeGreaterThan(M(4, 6));
    expect(M(4, 8)).toBeGreaterThan(M(4, 7));
    expect(M(4, 8) - M(4, 7)).toBeLessThan(M(4, 5) - M(4, 4)); // 超5位后边际收窄
  });
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
  it("[10] 听算:速度档越高 D 越大(按速度衡量,不按时间)", () =>
    expect(difficultyD(base({ mode: "listen", listenSpeed: 10 }))).toBeGreaterThan(difficultyD(base({ mode: "listen", listenSpeed: 1 }))));
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

// F18 答案分散(2026-09-12 用户实测「满五加答案都是5」修复):
// 连续出题时答案不能扎堆 —— 尤其②满五加(末笔收割天然只有5-8四个落点)。
describe("F18 陪练答案分散", () => {
  it("②满五加 10笔:最高频答案占比 ≤35%,相邻同答案 ≤5%", () => {
    __resetVariantUse();
    const n = 150;
    const dist = new Map<number, number>();
    let dup = 0;
    let prev = -1;
    for (let i = 0; i < n; i++) {
      const p = generateCoachProblem(2, 10, 1, null);
      dist.set(p.answer, (dist.get(p.answer) ?? 0) + 1);
      if (p.answer === prev) dup += 1;
      prev = p.answer;
    }
    const top = Math.max(...dist.values());
    expect(top / n).toBeLessThanOrEqual(0.35);
    expect(dup / n).toBeLessThanOrEqual(0.05);
    expect(dist.size).toBeGreaterThanOrEqual(5); // 答案至少覆盖 5 种值
  });

  it("②满五加 5笔:最高频答案占比 ≤35%", () => {
    __resetVariantUse();
    const n = 150;
    const dist = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const p = generateCoachProblem(2, 5, 1, null);
      dist.set(p.answer, (dist.get(p.answer) ?? 0) + 1);
    }
    expect(Math.max(...dist.values()) / n).toBeLessThanOrEqual(0.35);
  });
});

// F19 直加直减反「镜像回吐」(2026-09-12 用户反馈「光出9减9、7减7」):
// +x 紧跟 −x 的抵消对基本禁绝(仅未覆盖变式放行一次),且百题变式全覆盖不受影响。
describe("F19 ①关反镜像回吐", () => {
  it("①直加直减 200题:紧邻 +x−x 抵消对 ≤1%,百题内18变式全覆盖", () => {
    __resetVariantUse();
    let undo = 0, strokes = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateCoachProblem(1, 5, 1, null);
      for (let k = 1; k < p.terms.length; k++) {
        strokes += 1;
        if (p.terms[k] === p.terms[k - 1] && p.signs[k] !== p.signs[k - 1]) undo += 1;
      }
      if (i < 100) {
        for (let k = 0; k < p.terms.length; k++) seen.add(p.signs[k] + p.terms[k]);
      }
    }
    expect(undo / strokes).toBeLessThanOrEqual(0.01);
    for (let x = 1; x <= 9; x++) {
      expect(seen.has(`+${x}`), `+${x} 未覆盖`).toBe(true);
      expect(seen.has(`-${x}`), `-${x} 未覆盖`).toBe(true);
    }
  });
});

// F20 陪练进度账号级同步(2026-09-12「空山账号 27/100 不更新」——原为设备本地存储):
// 云端答题序列 → 各关窗口/通关状态的纯合并逻辑。
describe("F20 陪练进度云端重建", () => {
  it("窗口取末100题、任意连续100题≥80%判通关、与本地取更长者", async () => {
    const { mergeCloudCoachProgress } = await import("@/lib/fingering");
    window.localStorage.removeItem("flashmath:coach");
    // 27 题(对20) → recent 27;120 题前 100 全对 → 通关
    const seq: { stage: number; correct: boolean }[] = [];
    for (let i = 0; i < 27; i++) seq.push({ stage: 2, correct: i < 20 });
    for (let i = 0; i < 120; i++) seq.push({ stage: 1, correct: i < 100 });
    const p = mergeCloudCoachProgress(seq);
    expect(p.recent[2].length).toBe(27);
    expect(p.recent[2].filter(Boolean).length).toBe(20);
    expect(p.passed).toContain(1);
    expect(p.passed).not.toContain(2);
    expect(p.recent[1].length).toBe(100);
    // 本地窗口更长时保留本地(未登录练习不丢)
    const p2 = mergeCloudCoachProgress([{ stage: 2, correct: true }]);
    expect(p2.recent[2].length).toBe(27);
    window.localStorage.removeItem("flashmath:coach");
  });
});

// 2026-10-21 学生反馈:布置 2-4 位,10 题里有一题最多只有 3 位 → 区间内每种位数都必须出现
describe("混合位数:区间内每种位数至少出现一次", () => {
  it("2-4 位 14 笔:每题都含 2、3、4 位", () => {
    for (let k = 0; k < 400; k++) {
      const p = buildProblem(14, 2, true, 4);
      const lens = new Set(p.terms.map((t) => String(t).length));
      expect([...lens].sort()).toEqual([2, 3, 4]);
      expect(p.terms.length).toBe(14);
    }
  });
  it("笔数少于位数种类时也保住最大位数", () => {
    for (let k = 0; k < 200; k++) {
      const p = buildProblem(2, 1, false, 5);
      expect(Math.max(...p.terms.map((t) => String(t).length))).toBe(5);
    }
  });
});

// 2026-10-25 用户:多位混合数「两位、三位、四位要均匀分布,不要扎堆」
import { spreadLens, mixedLens, maxRun } from "@/lib/spreadLens";
describe("多位混合数均匀分布", () => {
  it("比例允许时同位数互不相邻;比例悬殊时最多两两相邻", () => {
    for (let k = 0; k < 500; k++) {
      expect(maxRun(spreadLens({ 2: 5, 3: 5, 4: 4 }))).toBe(1);
      expect(maxRun(spreadLens({ 6: 2, 5: 2, 4: 5, 3: 6 }))).toBe(1);
      // 2026-10-26 某种位数占多数时允许比最少多 1 行连着(官方鉴定样卷也有三行连着),换来顺序不固定
      expect(maxRun(spreadLens({ 4: 5, 3: 10 }))).toBeLessThanOrEqual(3);
      expect(maxRun(spreadLens({ 2: 4, 1: 2 }))).toBeLessThanOrEqual(3);
    }
  });
  it("2-4 位 14 笔:各位数行数相差不超过 1,且不扎堆;题目各笔位数与之一致", () => {
    for (let k = 0; k < 300; k++) {
      const lens = mixedLens(14, 2, 4);
      const c = [2, 3, 4].map((d) => lens.filter((x) => x === d).length);
      expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
      expect(maxRun(lens)).toBe(1);
      const p = buildProblem(14, 2, true, 4);
      expect(maxRun(p.terms.map((t) => String(t).length))).toBe(1);
    }
  });
});

// 2026-10-26 付海东「位数顺序都是固定的,每次第一个数都是 3 位」→ 位数顺序要随机(仍不相邻)
describe("多位混合数顺序随机", () => {
  it("开头位数、整列顺序每次不同;同位数仍不相邻", () => {
    const firsts = new Set<number>(), orders = new Set<string>();
    for (let k = 0; k < 200; k++) {
      const s = spreadLens({ 3: 5, 4: 5, 5: 3, 6: 2 });
      expect(maxRun(s)).toBe(1);
      firsts.add(s[0]); orders.add(s.join(""));
    }
    expect(firsts.size).toBeGreaterThanOrEqual(3);
    expect(orders.size).toBeGreaterThan(150);
  });
});

it("比例悬殊(10×3位 + 5×4位):开头位数也会变,最长连续段 ≤ 3", () => {
  const firsts = new Set<number>();
  for (let k = 0; k < 200; k++) { const s = spreadLens({ 3: 10, 4: 5 }); expect(maxRun(s)).toBeLessThanOrEqual(3); expect(s.length).toBe(15); firsts.add(s[0]); }
  expect(firsts.size).toBe(2);
});

it("鉴定占多数的位数(珠心算三级 2位6行+3位2行):顺序每题不同,最长连续 ≤ 3", () => {
  const orders = new Set<string>();
  for (let k = 0; k < 200; k++) { const s = spreadLens({ 2: 6, 3: 2 }); expect(maxRun(s)).toBeLessThanOrEqual(3); expect(s.length).toBe(8); orders.add(s.join("")); }
  expect(orders.size).toBeGreaterThanOrEqual(5);
});

// 2026-10-26 教练端/学生端与出题系统统一的规则(《鉴定标准》拟题要求)
describe("闪电心算 / 作业加减:同列上下不同数码、尾数 0 每题 ≤ 2 行", () => {
  it("定长与混合位数都满足", () => {
    for (let k = 0; k < 300; k++) {
      for (const [n, d, dm] of [[10, 3, 3], [15, 4, 4], [12, 2, 4], [8, 1, 1], [10, 5, 7]] as const) {
        const p = buildProblem(n, d, k % 2 === 0, dm);
        const ds = p.terms.map((t) => String(t));
        ds.forEach((x, i) => {
          if (!i) return;
          const u = ds[i - 1];
          for (let r = 1; r <= Math.min(u.length, x.length); r++) expect(x[x.length - r], `${u} / ${x}`).not.toBe(u[u.length - r]);
        });
        if (d > 1) expect(p.terms.filter((t) => t % 10 === 0).length, ds.join(",")).toBeLessThanOrEqual(2);
      }
    }
  });
});
