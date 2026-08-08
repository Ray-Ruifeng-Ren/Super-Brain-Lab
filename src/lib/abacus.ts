// 珠心算出题引擎(移植自独立 abacus-trainer,已通过全规则单测)。
// 输出复用 flashMath 的 Problem 形状,以便 practiceLog / 错题本 / 算式渲染直接通用。
//
// 加减法规则(珠心算专业标准):
//   1. 单个数内部数字不重复(位数 ≥9 放宽)。
//   2. 相邻两笔数字不重复(位数较大放宽)。
//   3. 减号不相邻;加减混合时大约每 2~4 笔一个减号(8笔≈2、10笔≈3)。
//   4. 计算中间过程与最终答案都不为负。
// 采用「构造后用校验器拒绝重采样」,保证出的每道题都合规。

import type { Problem, Sign } from "./flashMath";

export type AbacusMode = "flash" | "glance" | "listen";
export type AddSubType = "add" | "sub" | "mix"; // 纯加 / 纯减 / 加减混合
export type Project = "addsub" | "multiply" | "divide" | "bead";

export interface AbacusCfg {
  project: Project;
  // 加减法
  mode: AbacusMode;
  count: number; // 笔数
  minDigits: number; // 最小位数
  maxDigits: number; // 最大位数
  speedMs: number; // 闪算单笔时间
  flashBatch: number; // 显示笔数(一次闪示多笔)
  listenLevel: number; // 听算语速 1=常规 2=较快 3=极快
  addsub: AddSubType;
  // 乘法
  aDigits: number;
  bDigits: number;
  // 除法
  divisorDigits: number;
  quotientDigits: number;
  // 看珠
  beadDigits: number;
  beadSpeedMs: number;
}

export const DEFAULT_ABACUS_CFG: AbacusCfg = {
  project: "addsub",
  mode: "flash",
  count: 5,
  minDigits: 2,
  maxDigits: 3,
  speedMs: 700,
  flashBatch: 1,
  listenLevel: 1,
  addsub: "mix",
  aDigits: 2,
  bDigits: 2,
  divisorDigits: 1,
  quotientDigits: 2,
  beadDigits: 1,
  beadSpeedMs: 2000,
};

export const PROJECTS: { id: Project; label: string; emoji: string; desc: string }[] = [
  { id: "addsub", label: "加减法", emoji: "➕", desc: "闪算 / 看算 / 听算" },
  { id: "multiply", label: "乘法", emoji: "✖️", desc: "自选位数乘算" },
  { id: "divide", label: "除法", emoji: "➗", desc: "自选位数除算" },
  { id: "bead", label: "看珠", emoji: "🧮", desc: "数珠互译" },
];

// ---- 基础工具 ----
const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function digitsOf(n: number): number[] {
  return String(Math.abs(n)).split("").map(Number);
}

function hasInternalRepeat(n: number): boolean {
  const d = digitsOf(n);
  return new Set(d).size !== d.length;
}

// 生成一个「内部数字不重复」的 d 位数,尽量回避 forbidden(可用不足时自动放宽)。
function genUniqueDigitNumber(d: number, forbidden: Set<number> = new Set()): number {
  let pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => !forbidden.has(x));
  if (pool.length < d || pool.every((x) => x === 0)) {
    pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  }
  const chosen = shuffle(pool).slice(0, d);
  if (chosen[0] === 0) {
    const swap = chosen.findIndex((x) => x !== 0);
    if (swap > 0) [chosen[0], chosen[swap]] = [chosen[swap], chosen[0]];
  }
  return Number(chosen.join(""));
}

// 生成一个 [10^(d-1), maxValue] 内、内部不重复、回避 forbidden 的减数;放不下返回 null。
function genSubtrahend(d: number, maxValue: number, forbidden: Set<number>): number | null {
  const lo = d === 1 ? 1 : Math.pow(10, d - 1);
  const hi = Math.min(maxValue, Math.pow(10, d) - 1);
  if (hi < lo) return null;
  for (let t = 0; t < 60; t++) {
    const n = genUniqueDigitNumber(d, forbidden);
    if (n >= lo && n <= hi) return n;
  }
  for (let n = hi; n >= lo; n--) {
    if (hasInternalRepeat(n)) continue;
    if (forbidden.size && digitsOf(n).some((x) => forbidden.has(x))) continue;
    return n;
  }
  return null;
}

// 减号排布:首笔恒加。
//   add → 全加;sub(纯减)→ 首笔加、其余全减;mix → 每隔 2~4 笔一个减号,减号不相邻。
function planSigns(count: number, addsub: AddSubType): Sign[] {
  const plan: Sign[] = Array(count).fill("+");
  if (addsub === "add") return plan;
  if (addsub === "sub") {
    for (let i = 1; i < count; i++) plan[i] = "-";
    return plan;
  }
  let i = randInt(2, 3);
  while (i < count) {
    plan[i] = "-";
    i += randInt(2, 4);
  }
  return plan;
}

// 校验一道加减题是否满足全部规则。
export function validateProblem(p: Problem, cfg: Pick<AbacusCfg, "minDigits" | "maxDigits" | "addsub">): string[] {
  const errs: string[] = [];
  const hi = Math.max(cfg.minDigits, cfg.maxDigits);
  const relaxInternal = hi >= 9;
  const strictAdjacent = hi * 2 <= 10;
  const { terms, signs } = p;

  if (signs[0] !== "+") errs.push("首笔非加");

  terms.forEach((v, i) => {
    if (!relaxInternal && hasInternalRepeat(v)) errs.push(`第${i + 1}笔内部重复`);
    if (strictAdjacent && i > 0) {
      const prev = new Set(digitsOf(terms[i - 1]));
      if (digitsOf(v).some((x) => prev.has(x))) errs.push(`第${i}~${i + 1}笔重叠`);
    }
  });

  // 减号不相邻(纯减模式本身连续为减,豁免)
  if (cfg.addsub !== "sub") {
    for (let i = 1; i < signs.length; i++) {
      if (signs[i] === "-" && signs[i - 1] === "-") errs.push(`第${i}~${i + 1}笔减号相邻`);
    }
  }

  let running = 0;
  const steps: number[] = [];
  terms.forEach((v, i) => {
    running += signs[i] === "-" ? -v : v;
    steps.push(running);
  });
  if (steps.some((s) => s < 0)) errs.push("中间过程为负");
  if (running < 0) errs.push("答案为负");
  if (running !== p.answer) errs.push("答案不一致");

  return errs;
}

/** 生成一道珠心算加减题(Problem 形状)。位数在 [minDigits, maxDigits] 间随机。 */
export function buildAbacusProblem(cfg: AbacusCfg): Problem {
  const lo = Math.max(1, Math.min(9, Math.min(cfg.minDigits, cfg.maxDigits)));
  const hi = Math.max(1, Math.min(9, Math.max(cfg.minDigits, cfg.maxDigits)));
  const count = Math.max(2, cfg.count);
  const strictAdjacent = hi * 2 <= 10;

  const attempt = (): Problem | null => {
    const signs = planSigns(count, cfg.addsub);
    const terms: number[] = [];
    let running = 0;

    for (let i = 0; i < count; i++) {
      const forbidden =
        strictAdjacent && terms.length ? new Set(digitsOf(terms[terms.length - 1])) : new Set<number>();
      const d = randInt(lo, hi);

      if (signs[i] === "-") {
        let placed = false;
        for (let dd = d; dd >= 1; dd--) {
          const v = genSubtrahend(dd, running, forbidden);
          if (v !== null) {
            terms.push(v);
            running -= v;
            placed = true;
            break;
          }
        }
        if (!placed) return null;
      } else {
        const v = genUniqueDigitNumber(d, forbidden);
        terms.push(v);
        running += v;
      }
    }

    const problem: Problem = { terms, signs, answer: running };
    if (validateProblem(problem, cfg).length) return null;
    return problem;
  };

  for (let k = 0; k < 400; k++) {
    const r = attempt();
    if (r) return r;
  }
  // 兜底:强制纯加
  return buildAbacusProblem({ ...cfg, addsub: "add" });
}

// ============ 乘法 ============
// 规则:乘数与被乘数合计数字不重复(位数和≤10);位数大时各自内部不重复。
export function generateMultiply(aDigits: number, bDigits: number): { a: number; b: number; answer: number } {
  const unique = aDigits + bDigits <= 10;
  const fixLead = (arr: number[]) => {
    if (arr[0] === 0) {
      const j = arr.findIndex((x) => x !== 0);
      if (j > 0) [arr[0], arr[j]] = [arr[j], arr[0]];
      else return false;
    }
    return true;
  };
  for (let k = 0; k < 200; k++) {
    if (unique) {
      const digs = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, aDigits + bDigits);
      const aArr = digs.slice(0, aDigits), bArr = digs.slice(aDigits);
      if (!fixLead(aArr) || !fixLead(bArr)) continue;
      const a = Number(aArr.join("")), b = Number(bArr.join(""));
      return { a, b, answer: a * b };
    }
    const a = genUniqueDigitNumber(aDigits), b = genUniqueDigitNumber(bDigits);
    return { a, b, answer: a * b };
  }
  const a = genUniqueDigitNumber(aDigits), b = genUniqueDigitNumber(bDigits);
  return { a, b, answer: a * b };
}

// ============ 除法 ============
// 规则:整除;除数与商数字不重复(位数和≤10)。指定除数位数 + 商位数,被除数自动推导。
export function generateDivide(divisorDigits: number, quotientDigits: number): { dividend: number; divisor: number; quotient: number } {
  const unique = divisorDigits + quotientDigits <= 10;
  for (let k = 0; k < 200; k++) {
    const divisor = genUniqueDigitNumber(divisorDigits);
    if (divisor === 0) continue;
    const forbidden = unique ? new Set(digitsOf(divisor)) : new Set<number>();
    const quotient = genUniqueDigitNumber(quotientDigits, forbidden);
    return { dividend: divisor * quotient, divisor, quotient };
  }
  const divisor = genUniqueDigitNumber(divisorDigits) || 2;
  const quotient = genUniqueDigitNumber(quotientDigits);
  return { dividend: divisor * quotient, divisor, quotient };
}

// ============ 看珠 ============
export function generateBead(digits: number): { value: number } {
  return { value: digits <= 1 ? randInt(0, 9) : genUniqueDigitNumber(digits) };
}

// ============ 统一回合模型 ============
export interface Round {
  project: Project;
  answer: number;
  exprStr: string; // 结果展示 / 记录用(不含答案)
  terms?: number[];
  signs?: Sign[];
  a?: number;
  b?: number;
  op?: "×" | "÷";
  beadValue?: number;
  beadDigits?: number;
}

function addsubExpr(terms: number[], signs: Sign[]): string {
  return terms.map((t, i) => (i === 0 ? `${t}` : signs[i] === "-" ? ` − ${t}` : ` + ${t}`)).join("");
}

/** 依配置生成一个回合(任意项目)。 */
export function buildRound(cfg: AbacusCfg): Round {
  if (cfg.project === "multiply") {
    const { a, b, answer } = generateMultiply(cfg.aDigits, cfg.bDigits);
    return { project: "multiply", answer, a, b, op: "×", exprStr: `${a} × ${b}` };
  }
  if (cfg.project === "divide") {
    const { dividend, divisor, quotient } = generateDivide(cfg.divisorDigits, cfg.quotientDigits);
    return { project: "divide", answer: quotient, a: dividend, b: divisor, op: "÷", exprStr: `${dividend} ÷ ${divisor}` };
  }
  if (cfg.project === "bead") {
    const { value } = generateBead(cfg.beadDigits);
    return { project: "bead", answer: value, beadValue: value, beadDigits: cfg.beadDigits, exprStr: `算盘 = ${value}` };
  }
  const p = buildAbacusProblem(cfg);
  return { project: "addsub", answer: p.answer, terms: p.terms, signs: p.signs, exprStr: addsubExpr(p.terms, p.signs) };
}

// ---- 计分 ----
const DIGIT_WEIGHT = [0, 1, 1.4, 2, 2.8, 3.8, 5, 6.5, 8, 10];
// 模式系数:看算最易 ×1,闪算 ×1.15,听算最难 ×1.3
const MODE_FACTOR: Record<AbacusMode, number> = { glance: 1, flash: 1.15, listen: 1.3 };

export function previewScore(cfg: AbacusCfg): number {
  const wOf = (d: number) => DIGIT_WEIGHT[d] ?? d;
  if (cfg.project === "multiply") return Math.round((wOf(cfg.aDigits) + wOf(cfg.bDigits)) * 12);
  if (cfg.project === "divide") return Math.round((wOf(cfg.divisorDigits) + wOf(cfg.quotientDigits)) * 12);
  if (cfg.project === "bead") return Math.round(wOf(cfg.beadDigits) * (2200 / Math.max(cfg.beadSpeedMs, 300)) * 12);
  const avgDigits = Math.round((cfg.minDigits + cfg.maxDigits) / 2);
  const w = wOf(avgDigits);
  const speed =
    cfg.mode === "flash" ? Math.min(8, Math.max(0.4, 1000 / Math.max(cfg.speedMs, 100))) : 1;
  const sub = cfg.addsub === "add" ? 1 : 1.3;
  const batch = cfg.mode === "flash" && cfg.flashBatch > 1 ? 1 + (cfg.flashBatch - 1) * 0.15 : 1;
  return Math.round(cfg.count * w * speed * sub * MODE_FACTOR[cfg.mode] * batch * 10);
}

export function computeScore(cfg: AbacusCfg, correct: boolean): number {
  return correct ? previewScore(cfg) : 0;
}

/** leaderboard 的 mode 字符串:同一项目+配置的人互相比。 */
export function abacusMode(cfg: AbacusCfg): string {
  if (cfg.project === "multiply") return `mul-${cfg.aDigits}x${cfg.bDigits}`;
  if (cfg.project === "divide") return `div-${cfg.divisorDigits}_${cfg.quotientDigits}`;
  if (cfg.project === "bead") return `bead-${cfg.beadDigits}d`;
  const dig = cfg.minDigits === cfg.maxDigits ? `${cfg.minDigits}d` : `${cfg.minDigits}_${cfg.maxDigits}d`;
  const b = cfg.mode === "flash" && cfg.flashBatch > 1 ? `-b${cfg.flashBatch}` : "";
  return `${cfg.mode}-${cfg.count}q-${dig}-${cfg.addsub}${b}`;
}

// ---- 中文数字读法(听算 TTS) ----
const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const UNIT = ["", "十", "百", "千"];
const BIG = ["", "万", "亿"];

export function numberToCN(n: number): string {
  if (n === 0) return "零";
  let s = String(n);
  const groups: string[] = [];
  while (s.length) {
    groups.unshift(s.slice(-4));
    s = s.slice(0, -4);
  }
  let out = "";
  groups.forEach((g, gi) => {
    const val = Number(g);
    let seg = "";
    let zero = false;
    const len = g.length;
    for (let i = 0; i < len; i++) {
      const dd = Number(g[i]);
      const pos = len - 1 - i;
      if (dd === 0) {
        zero = true;
      } else {
        if (zero && seg) seg += "零";
        zero = false;
        seg += CN[dd] + UNIT[pos];
      }
    }
    if (val !== 0) out += seg + BIG[groups.length - 1 - gi];
  });
  out = out.replace(/^一十/, "十");
  return out || "零";
}
