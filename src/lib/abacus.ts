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

export interface AbacusCfg {
  mode: AbacusMode;
  count: number; // 笔数
  minDigits: number; // 最小位数
  maxDigits: number; // 最大位数
  speedMs: number; // 闪算单笔时间
  flashBatch: number; // 显示笔数(一次闪示多笔)
  listenLevel: number; // 听算语速 1=常规 2=较快 3=极快
  addsub: AddSubType;
}

export const DEFAULT_ABACUS_CFG: AbacusCfg = {
  mode: "flash",
  count: 5,
  minDigits: 2,
  maxDigits: 3,
  speedMs: 700,
  flashBatch: 1,
  listenLevel: 1,
  addsub: "mix",
};

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

// ---- 计分 ----
const DIGIT_WEIGHT = [0, 1, 1.4, 2, 2.8, 3.8, 5, 6.5, 8, 10];
// 模式系数:看算最易 ×1,闪算 ×1.15,听算最难 ×1.3
const MODE_FACTOR: Record<AbacusMode, number> = { glance: 1, flash: 1.15, listen: 1.3 };

export function previewScore(cfg: AbacusCfg): number {
  const avgDigits = Math.round((cfg.minDigits + cfg.maxDigits) / 2);
  const w = DIGIT_WEIGHT[avgDigits] ?? avgDigits;
  const speed =
    cfg.mode === "flash" ? Math.min(8, Math.max(0.4, 1000 / Math.max(cfg.speedMs, 100))) : 1;
  const sub = cfg.addsub === "add" ? 1 : 1.3;
  // 一次闪多笔更难,略给系数
  const batch = cfg.mode === "flash" && cfg.flashBatch > 1 ? 1 + (cfg.flashBatch - 1) * 0.15 : 1;
  return Math.round(cfg.count * w * speed * sub * MODE_FACTOR[cfg.mode] * batch * 10);
}

export function computeScore(cfg: AbacusCfg, correct: boolean): number {
  return correct ? previewScore(cfg) : 0;
}

/** leaderboard 的 mode 字符串:同一模式+配置的人互相比。 */
export function abacusMode(cfg: AbacusCfg): string {
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
