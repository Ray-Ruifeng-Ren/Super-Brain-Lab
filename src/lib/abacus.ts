import { mixedLens } from "@/lib/spreadLens";
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
// 传入 usage(0-9 的已用次数,只读)时,优先选用出现次数最少的数字,
// 让整道题里相邻几笔尽量均匀覆盖 0-9(同分随机打散,不破坏其它规则)。
function genUniqueDigitNumber(
  d: number,
  forbidden: Set<number> = new Set(),
  usage?: number[],
): number {
  let pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => !forbidden.has(x));
  if (pool.length < d || pool.every((x) => x === 0)) {
    pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  }
  let chosen: number[];
  if (usage) {
    chosen = [...pool]
      .sort((a, b) => usage[a] - usage[b] || Math.random() - 0.5)
      .slice(0, d);
    chosen = shuffle(chosen); // 位置随机
  } else {
    chosen = shuffle(pool).slice(0, d);
  }
  if (chosen[0] === 0) {
    const swap = chosen.findIndex((x) => x !== 0);
    if (swap > 0) [chosen[0], chosen[swap]] = [chosen[swap], chosen[0]];
  }
  return Number(chosen.join(""));
}

// 生成一个 [10^(d-1), maxValue] 内、内部不重复、回避 forbidden 的减数;放不下返回 null。
function genSubtrahend(d: number, maxValue: number, forbidden: Set<number>, usage?: number[]): number | null {
  const lo = d === 1 ? 1 : Math.pow(10, d - 1);
  const hi = Math.min(maxValue, Math.pow(10, d) - 1);
  if (hi < lo) return null;
  for (let t = 0; t < 60; t++) {
    const n = genUniqueDigitNumber(d, forbidden, usage);
    if (n >= lo && n <= hi) return n;
  }
  for (let n = hi; n >= lo; n--) {
    if (hasInternalRepeat(n)) continue;
    if (forbidden.size && digitsOf(n).some((x) => forbidden.has(x))) continue;
    return n;
  }
  return null;
}

// 在 [1, count-1] 内挑 m 个「隔行(不相邻)」且分散的减号位置(珠算标准:减数隔行排列)。
function spacedMinusPositions(count: number, m: number): number[] {
  const out: number[] = [];
  if (m <= 0 || count < 2) return out;
  const seg = (count - 1) / m; // 把可用位置均匀切成 m 段,每段取一个
  for (let k = 0; k < m; k++) {
    const lo = 1 + Math.floor(k * seg);
    const hi = Math.min(count - 1, Math.max(lo, Math.floor(1 + (k + 1) * seg) - 1));
    let pos = lo + Math.floor(Math.random() * (hi - lo + 1));
    const prev = out.length ? out[out.length - 1] : -2;
    if (pos <= prev + 1) pos = prev + 2; // 保证不相邻
    if (pos <= count - 1) out.push(pos);
  }
  return out;
}

// 减号排布:首笔恒加。
//   add → 全加;sub(纯减)→ 首笔加、其余全减;
//   mix → 减数字码 ≈ 该题总字数的 1/3,减数隔行(不相邻)排列(珠算标准)。
function planSigns(count: number, addsub: AddSubType): Sign[] {
  const plan: Sign[] = Array(count).fill("+");
  if (addsub === "add") return plan;
  if (addsub === "sub") {
    for (let i = 1; i < count; i++) plan[i] = "-";
    return plan;
  }
  // 加减混合:减号约占 1/3(至少 1 个,不整题直加),隔行排列
  const minusCount = Math.min(count - 1, Math.max(1, Math.round(count / 3)));
  for (const p of spacedMinusPositions(count, minusCount)) plan[p] = "-";
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

  // 加减混合允许减号相邻(顺序打乱),故不再校验减号相邻。

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
    const usage = new Array(10).fill(0); // 0-9 已用次数,驱动均匀分布
    const lens = mixedLens(count, lo, hi); // 多位混合:各位数行数相等、均匀铺开,不扎堆(2026-10-25)

    for (let i = 0; i < count; i++) {
      const forbidden =
        strictAdjacent && terms.length ? new Set(digitsOf(terms[terms.length - 1])) : new Set<number>();
      const d = lens[i];

      if (signs[i] === "-") {
        let placed = false;
        for (let dd = d; dd >= 1; dd--) {
          const v = genSubtrahend(dd, running, forbidden, usage);
          if (v !== null) {
            terms.push(v);
            running -= v;
            for (const x of digitsOf(v)) usage[x]++;
            placed = true;
            break;
          }
        }
        if (!placed) return null;
      } else {
        const v = genUniqueDigitNumber(d, forbidden, usage);
        terms.push(v);
        running += v;
        for (const x of digitsOf(v)) usage[x]++;
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
  // 一位数的乘数/被乘数不出 0 和 1(2026-10-11 付海东:8590×1 没有练习意义)
  const okOne = (v: number, d: number) => d !== 1 || v >= 2;
  for (let k = 0; k < 300; k++) {
    if (unique) {
      const digs = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, aDigits + bDigits);
      const aArr = digs.slice(0, aDigits), bArr = digs.slice(aDigits);
      if (!fixLead(aArr) || !fixLead(bArr)) continue;
      const a = Number(aArr.join("")), b = Number(bArr.join(""));
      if (!okOne(a, aDigits) || !okOne(b, bDigits)) continue;
      return { a, b, answer: a * b };
    }
    const a = genUniqueDigitNumber(aDigits), b = genUniqueDigitNumber(bDigits);
    if (!okOne(a, aDigits) || !okOne(b, bDigits)) continue;
    return { a, b, answer: a * b };
  }
  const a = aDigits === 1 ? 2 + randInt(0, 7) : genUniqueDigitNumber(aDigits);
  const b = bDigits === 1 ? 2 + randInt(0, 7) : genUniqueDigitNumber(bDigits);
  return { a, b, answer: a * b };
}

// ============ 除法 ============
// 规则:整除;除数与商数字不重复(位数和≤10)。指定除数位数 + 商位数,被除数自动推导。
export function generateDivide(divisorDigits: number, quotientDigits: number): { dividend: number; divisor: number; quotient: number } {
  const unique = divisorDigits + quotientDigits <= 10;
  // 一位数的除数/商不出 0 和 1;商任何位数都不为 0(2026-10-11 付海东:曾出「0 ÷ 981」)
  const okOne = (v: number, d: number) => (d === 1 ? v >= 2 : v >= Math.pow(10, d - 1));
  for (let k = 0; k < 300; k++) {
    const divisor = genUniqueDigitNumber(divisorDigits);
    if (!okOne(divisor, divisorDigits)) continue;
    const forbidden = unique ? new Set(digitsOf(divisor)) : new Set<number>();
    const quotient = genUniqueDigitNumber(quotientDigits, forbidden);
    if (!okOne(quotient, quotientDigits)) continue;
    return { dividend: divisor * quotient, divisor, quotient };
  }
  const divisor = divisorDigits === 1 ? 2 + randInt(0, 7) : genUniqueDigitNumber(divisorDigits);
  const quotient = quotientDigits === 1 ? 2 + randInt(0, 7) : genUniqueDigitNumber(quotientDigits);
  return { dividend: divisor * quotient, divisor, quotient };
}

// ============ 看珠 ============
export function generateBead(digits: number): { value: number; str: string } {
  if (digits > 10) {
    // 不重复的数字只有 10 个:超过 10 位时允许重复(首位非 0)。2026-11-08 用户「不要限制 15 位,可以有 100 位」:
    // 超过 15 位 JS 数字不精确,一律以数字串 str 为准(value 只是近似值)
    const ds = Array.from({ length: digits }, (_, i) => (i === 0 ? randInt(1, 9) : randInt(0, 9)));
    return { value: Number(ds.join("")), str: ds.join("") };
  }
  const value = digits <= 1 ? randInt(0, 9) : genUniqueDigitNumber(digits);
  return { value, str: String(value) };
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
  return terms.map((t, i) => (i === 0 ? `${t}` : signs[i] === "-" ? ` − ${t}` : `  ${t}`)).join("");
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
    if (gi > 0 && val !== 0 && g[0] === "0") seg = "零" + seg; // 跨组补零:10015 → 一万零一十五(曾读成「一万一十五」)
    if (val !== 0) out += seg + BIG[groups.length - 1 - gi];
  });
  out = out.replace(/^一十/, "十");
  return out || "零";
}

// ============ 乘算基础 / 基础除算(2026-10-13 付海东:参考其它珠心算软件的「特定乘数 / 进位组合 / 特定除数 / 够除」) ============
/** 两位数×一位数的进位组合:十位积是否进位 + 个位积是否进位。any=不限 */
export type Carry2 = "any" | "cc" | "cn" | "nc" | "nn";
export interface MulOpts { digits?: number[]; carry?: Carry2 }
export interface DivOpts { digits?: number[]; enough?: "any" | "yes" | "no" }

/** 从指定数字集合里取 len 位数:集合够用时各位不重复(2026-11-24 用户「乘法总出现重复数字,如 35×455」——
 *  之前是有放回随机取,选 3 个数字出 3 位乘数时 77% 会重复);集合不够 len 个时才允许重复,且相邻两位不同。 */
const fromDigitSet = (len: number, set: number[]): number => {
  const pool = [...new Set(set)];
  if (pool.length >= len) {
    const ds = shuffle(pool).slice(0, len);
    return Number(ds.join(""));
  }
  const ds: number[] = [];
  for (let i = 0; i < len; i++) {
    const cands = pool.length > 1 ? pool.filter((d) => d !== ds[i - 1]) : pool;
    ds.push(cands[randInt(0, cands.length - 1)]);
  }
  return Number(ds.join(""));
};
/** 进位组合判定(仅 2位×1位 有意义):[十位×乘数 ≥10, 个位×乘数 ≥10] */
export function carryPattern(a: number, b: number): Carry2 {
  const tens = Math.floor(a / 10) % 10, ones = a % 10;
  const c1 = tens * b >= 10, c2 = ones * b >= 10;
  return c1 ? (c2 ? "cc" : "cn") : c2 ? "nc" : "nn";
}
/** 够除 = 整除(除尽),不够除 = 除不尽(2026-10-16 付海东经用户确认:「够除就是只能除尽,不够除就是除不尽」;
 *  之前按珠算「首位够除」理解,出的题全是整除,他说「点不够除,出的还是够除的题」) */
export function isExact(dividend: number, divisor: number): boolean { return dividend % divisor === 0; }
/** @deprecated 旧名,等于 isExact */
export const isEnough = isExact;
/** 带约束的乘法出题:乘数各位只从 digits 里取(空=不限);carry 仅 2位×1位 生效。约束无解时退回普通出题。 */
export function generateMultiplyWith(aDigits: number, bDigits: number, opts: MulOpts = {}): { a: number; b: number; answer: number } {
  const set = (opts.digits ?? []).filter((d) => d >= 1 && d <= 9);
  const carry = aDigits === 2 && bDigits === 1 ? (opts.carry ?? "any") : "any";
  if (!set.length && carry === "any") return generateMultiply(aDigits, bDigits);
  for (let k = 0; k < 400; k++) {
    const b = set.length ? fromDigitSet(bDigits, set) : generateMultiply(aDigits, bDigits).b;
    const forbidden = aDigits + new Set(digitsOf(b)).size <= 10 ? new Set(digitsOf(b)) : new Set<number>(); // 两数合计不重复(总位数 ≤10)
    const a = genUniqueDigitNumber(aDigits, forbidden);
    if (a < Math.pow(10, aDigits - 1) && aDigits > 1) continue;
    if (aDigits === 1 && a < 2) continue;
    if (carry !== "any" && carryPattern(a, b) !== carry) continue;
    return { a, b, answer: a * b };
  }
  return generateMultiply(aDigits, bDigits);
}
/** 带约束的除法出题:除数各位只从 digits 里取(空=不限);enough:yes/any=整除(any 维持旧行为,已布置的作业不受影响)、no=除不尽(带余数,quotient 为整数部分)。
 *  除不尽时 remainder ∈ [1, divisor−1],被除数 = 除数×商 + 余数;答案由上层按保留位数四舍五入。 */
export function generateDivideWith(divisorDigits: number, quotientDigits: number, opts: DivOpts = {}): { dividend: number; divisor: number; quotient: number; remainder: number } {
  const set = (opts.digits ?? []).filter((d) => d >= 1 && d <= 9);
  const enough = opts.enough ?? "any";
  const wantRemainder = enough === "no";
  for (let k = 0; k < 400; k++) {
    const base = generateDivide(divisorDigits, quotientDigits);
    const divisor = set.length ? fromDigitSet(divisorDigits, set) : base.divisor;
    if (divisor < 2) continue;
    // 指定除数数字时 base.quotient 只避开了 base.divisor,要按真正的除数重新出商(两数合计不重复,总位数 ≤10)
    const quotient = set.length ? genUniqueDigitNumber(quotientDigits, divisorDigits + quotientDigits <= 10 ? new Set(digitsOf(divisor)) : new Set<number>()) : base.quotient;
    if (set.length && (quotientDigits === 1 ? quotient < 2 : quotient < Math.pow(10, quotientDigits - 1))) continue;
    if (!wantRemainder) return { dividend: divisor * quotient, divisor, quotient, remainder: 0 };
    const remainder = randInt(1, divisor - 1);
    return { dividend: divisor * quotient + remainder, divisor, quotient, remainder };
  }
  const b = generateDivide(divisorDigits, quotientDigits); return { ...b, remainder: 0 };
}
