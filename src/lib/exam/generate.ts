import { spreadLens } from "@/lib/spreadLens";
import { generateCoachProblem } from "@/lib/fingering";
// 出题系统(2026-10-25):按鉴定/比赛标准出题的生成器。
// 规则来自《珠算技术等级鉴定标准(2020)》《珠心算鉴定标准(2020)》的拟题要求:
//   加减:每行首位 1–9、同一行(十位以内)数码不重复、上下相邻两行同一数位数字不同;相同位数尽量隔行;减数隔行、不放首行;中间和不为负(倒减题除外)。
//   乘除:实/法、法/商首位 1–9;带小数题按「四舍 / 五入」各占指定题数;除尽题为整除,除不尽题四舍五入到保留位数。

export interface AddsubProblem { kind: "addsub"; terms: number[]; dec: boolean; answer: string; texts: string[] }
export interface MdProblem { kind: "mul" | "div"; a: string; b: string; answer: string }
export type ExamProblem = AddsubProblem | MdProblem;

const rnd = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
function shuffle<T>(xs: T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** len 位整数:首位 1–9,数码不重复(len ≤ 10);1 位数不出 0 */
export function uniqueDigits(len: number, minOne = 1): number {
  const first = rnd(Math.max(1, minOne), 9);
  const rest = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== first)).slice(0, len - 1);
  return Number([first, ...rest].join(""));
}
// ===== 数字均匀(2026-10-26 用户「所有出题规则都要保证数字均匀出现」;中珠协「数字出现频率和分布需要调整」)=====
// 依据《珠算技术等级鉴定标准》《珠心算鉴定标准》(2020)五、拟题要求:
//   加减 ① 每题 0～9 均衡出现;总字数为整十数时相邻两题互换 0～9 中一个数码,10 题内不重复交换
//        ② 同一行十位以内 0～9 不重复  ③ 每行首位 1～9 均衡;每行尾数 0 最多出现 2 次(每题);纵列相邻上下不能同一数码
//   乘   实数、法数中 0～9 各自均衡;实数、法数首位 1～9 各自均衡      除  法数、商数同上
// 计数:DC = 整卷印出来的数码(含 0.xx 的前导 0);LEAD = 加减每行首位;DCA/LA、DCB/LB = 乘的实/法、除的法/商(数码 / 首位)
const DC: number[] = Array(10).fill(0), LEAD: number[] = Array(10).fill(0);
const DCA: number[] = Array(10).fill(0), DCB: number[] = Array(10).fill(0), LA: number[] = Array(10).fill(0), LB: number[] = Array(10).fill(0);
export const resetDigitCounts = () => { for (const a of [DC, LEAD, DCA, DCB, LA, LB]) a.fill(0); };
export const digitCounts = () => [...DC];
let DRY = false; // 只是试算候选题时不计数
let FREE_DEC = false; // 自定义出题:小数点位置不限(见 specs.ts Section.freeDec)
let LOOSE = false; // 候选题后半段:放开整卷计数,只保留「本题两数不重复」,让候选更多样
const addDigits = (arr: number[], x: number | bigint | string) => { for (const ch of String(x)) if (ch >= "0" && ch <= "9") arr[+ch]++; };
const firstSig = (x: number | bigint | string) => { const m = String(x).match(/[1-9]/); return m ? +m[0] : 0; };
/** 加减一题各行入账(数码 + 每行首位) */
const tallyAdd = (vals: number[]) => { if (DRY) return; for (const v of vals) { addDigits(DC, Math.abs(v)); LEAD[firstSig(Math.abs(v))]++; } };
/** 乘(实, 法)/ 除(法, 商)入账:按卷面印出来的文本 */
const tallyMd = (a: string, b: string) => { if (DRY) return; addDigits(DC, a); addDigits(DC, b); addDigits(DCA, a); addDigits(DCB, b); LA[firstSig(a)]++; LB[firstSig(b)]++; };
interface Role { dc: number[]; lead: number[] }
const ROLE_ADD: Role = { dc: DC, lead: LEAD }, ROLE_A: Role = { dc: DCA, lead: LA }, ROLE_B: Role = { dc: DCB, lead: LB };
/** 先看本题已用次数(local),首位再看该角色首位计数,最后看整卷计数;同分随机 */
function pickBalanced(cands: number[], local: number[], loose: boolean, role: Role, first: boolean): number {
  const lMin = Math.min(...cands.map((d) => local[d]));
  let pool = cands.filter((d) => local[d] === lMin);
  if (loose) return pool[rnd(0, pool.length - 1)];
  if (first) { const m = Math.min(...pool.map((d) => role.lead[d])); pool = pool.filter((d) => role.lead[d] === m); }
  const m = Math.min(...pool.map((d) => role.dc[d]));
  pool = pool.filter((d) => role.dc[d] <= m + 1);
  return pool[rnd(0, pool.length - 1)];
}
/** len 位整数:数码不重复、首位非 0(1 位数 ≥ minOne);above = 上一行(同一位上不能相同,按个位对齐);
 *  local = 本题已用数字计数(用完会累加进去);noTailZero = 末位不能是 0(本题尾数 0 已有 2 行) */
export function balancedDigits(len: number, local: number[], above?: number, minOne = 1, loose = false, role: Role = ROLE_ADD, noTailZero = false): number {
  const pd = above == null ? "" : String(Math.abs(above));
  for (let t = 0; t < 200; t++) {
    const used = new Set<number>();
    const ds: number[] = [];
    let ok = true;
    for (let i = 0; i < len; i++) {
      const place = len - 1 - i; // 从个位数起的位次
      const up = place < pd.length ? Number(pd[pd.length - 1 - place]) : -1;
      const lo = i === 0 ? (len === 1 ? minOne : 1) : 0;
      const cands = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d >= lo && !used.has(d) && d !== up && !(noTailZero && place === 0 && d === 0));
      if (!cands.length) { ok = false; break; }
      const d = t < 150 ? pickBalanced(cands, local, loose, role, i === 0) : cands[rnd(0, cands.length - 1)];
      used.add(d); ds.push(d);
    }
    if (ok) { ds.forEach((d) => local[d]++); return Number(ds.join("")); }
  }
  return uniqueDigits(len, minOne);
}
/** 兼容旧接口:与上一行同位不同的不重复数 */
export const uniqueDigitsAvoid = (len: number, prev?: number): number => balancedDigits(len, Array(10).fill(0), prev);
/** 一题各行(加减):每行数码不重复、相邻两行同位数字不同、尾数 0 最多 2 行,全题 0–9 均衡;init = 本题起始计数(相邻两题互换数码用) */
export const rowsAvoid = (lens: number[], init?: number[]): number[] => {
  const local = init ? [...init] : Array(10).fill(0);
  const out: number[] = [];
  let tailZero = 0;
  lens.forEach((len, i) => { const v = balancedDigits(len, local, i ? out[i - 1] : undefined, 1, false, ROLE_ADD, tailZero >= 2); if (v % 10 === 0) tailZero++; out.push(v); });
  return out;
};
/** 乘的实数和法数 / 除的法数和商数:各自 0～9 均衡、首位 1～9 各自均衡,两数合起来不重复(总位数 ≤ 10)。
 *  2026-10-26 用户「乘法一题里数字要平均出现」「除法看商和除数,不看被除数」 */
export const pairDigits = (a: number, b: number, loose = false): [number, number] => {
  const local = Array(10).fill(0);
  const A = balancedDigits(a, local, undefined, 2, loose, ROLE_A);
  return [A, balancedDigits(b, local, undefined, 2, loose, ROLE_B)];
};
/** 千分位(只给整数部分加逗号) */
export function commas(intStr: string): string { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
/** 整数单位 v(含 k 位小数)→ 文本,如 (123456, 2) → "1,234.56";(4657, 4) → "0.4657" */
export function fmtUnits(v: number | bigint, k: number): string {
  const neg = v < 0;
  let s = (neg ? -BigInt(v) : BigInt(v)).toString();
  if (k > 0) { s = s.padStart(k + 1, "0"); s = `${commas(s.slice(0, -k))}.${s.slice(-k)}`; } else s = commas(s);
  return (neg ? "-" : "") + s;
}

// ===== 加减 =====
/** n 题;d = {位数: 行数};m = 混合题减号行数;dec = 全部两位小数 / decN = 末尾 decN 题为两位小数;
 *  mixN = 末尾 mixN 题为加减混合(默认每 5 题后 2 题混合);reverse = 本部分最后一题为倒减题(能手级) */
export interface AddsubPart { n: number; d: Record<number, number>; m: number; dec?: boolean; decN?: number; mixN?: number; reverse?: "pos" | "neg";
  /** 指法知识点(2026-11-06 用户「把指法分类做到出题系统里」,仅自定义出题):1–7 = fingering.COACH_STAGES,
   *  用 AI 陪练同一套定向出题(generateCoachProblem);每笔同为「最大位数」(≤6),加减由该指法决定 */
  stage?: number;
  /** 分数字(2026-11-12 付海东「分类分数字 123456789」):只练这几个数(如满五加只练加4),空 = 本指法全部数字 */
  xs?: number[] }

/** 行位数排列:各位数等间距铺开、尽量不相邻(lib/spreadLens) */
const arrangeLens = (d: Record<number, number>): number[] => spreadLens(d);
/** 从 1..R-1 里取 m 个互不相邻的位置 */
function spacedPositions(R: number, m: number): number[] | null {
  const cand = shuffle(Array.from({ length: R - 1 }, (_, i) => i + 1));
  const out: number[] = [];
  for (const c of cand) { if (out.length >= m) break; if (!out.some((x) => Math.abs(x - c) <= 1)) out.push(c); }
  return out.length === m ? out.sort((a, b) => a - b) : null;
}

export function genAddsub(part: AddsubPart, mixed: boolean, reverse?: "pos" | "neg", dec = !!part.dec, init?: number[]): AddsubProblem {
  const R = Object.values(part.d).reduce((a, b) => a + b, 0);
  const m = mixed ? Math.min(part.m, Math.floor(R / 2)) : 0;
  for (let attempt = 0; attempt < 600; attempt++) {
    const lens = arrangeLens(part.d);
    // 每题 0～9 是否达到目标(含相邻两题互换的 ±1):试几组,取最贴近的一组
    let vals = rowsAvoid(lens, init);
    const devOf = (vs: number[]) => {
      const c = init ? [...init] : Array(10).fill(0);
      for (const v of vs) addDigits(c, v);
      const xs = vs.every((v) => v < 10) ? c.slice(1) : c; // 全是 1 位数时 0 不可能出现
      return Math.max(...xs) - Math.min(...xs);
    };
    for (let k = 0, d = devOf(vals); k < 6 && d > 0; k++) { const v2 = rowsAvoid(lens, init), d2 = devOf(v2); if (d2 < d) { vals = v2; d = d2; } }
    if (!m) return finishAddsub(vals, [], dec);
    for (let t = 0; t < 40; t++) {
      const pos = spacedPositions(R, m);
      if (!pos) break;
      // 2026-10-26 比赛题型标准「加减混合题减数字码约占该题总字数的 1/3」(精英组表上写明每题减号字数 40 = 120 的 1/3):
      // 先要求正好 ⅓(四舍五入),多次凑不出再放宽到 ±5%
      if (!reverse) {
        const T = vals.reduce((n, v) => n + String(v).length, 0), md = pos.reduce((n, i) => n + String(vals[i]).length, 0);
        if (Math.abs(md - Math.round(T / 3)) > (attempt < 300 ? 0 : Math.max(1, Math.round(T * 0.05)))) continue;
      }
      let run = 0, wentNeg = false, ok = true;
      for (let i = 0; i < R; i++) {
        run += pos.includes(i) ? -vals[i] : vals[i];
        if (run < 0) { if (!reverse) { ok = false; break; } wentNeg = true; }
      }
      if (!ok) continue;
      if (reverse) {
        // 倒减题:中间出现一次负数;第 10 题得数为正、第 20 题得数为负(能手级)
        if (!wentNeg) continue;
        if (reverse === "pos" && run <= 0) continue;
        if (reverse === "neg" && run >= 0) continue;
      }
      return finishAddsub(vals, pos, dec);
    }
  }
  // 兜底(极少):放宽为不带减号
  return finishAddsub(rowsAvoid(arrangeLens(part.d), init), [], dec);
}
function finishAddsub(vals: number[], minus: number[], dec?: boolean): AddsubProblem {
  tallyAdd(vals);
  const terms = vals.map((v, i) => (minus.includes(i) ? -v : v));
  const k = dec ? 2 : 0;
  const sum = terms.reduce((a, b) => a + b, 0);
  return { kind: "addsub", terms, dec: !!dec, answer: fmtUnits(sum, k), texts: terms.map((t) => fmtUnits(t, k)) };
}

/** 一个加减部分的 n 道题:每 5 题里后 2 题为加减混合(纯加 : 混合 = 3 : 2,与标准一致);倒减题放在本部分最后一题 */
export function genAddsubPart(part: AddsubPart): AddsubProblem[] {
  if (part.stage) {
    const R = Object.values(part.d).reduce((a, b) => a + b, 0);
    const digits = Math.min(6, Math.max(...Object.keys(part.d).map(Number)));
    return Array.from({ length: part.n }, () => {
      const cp = generateCoachProblem(part.stage!, R, digits, part.xs?.length ? part.xs : null);
      const minus = cp.signs.flatMap((sg, i) => (sg === "-" ? [i] : []));
      return finishAddsub(cp.terms.map(Math.abs), minus, false);
    });
  }
  // 拟题要求「每题 0～9 均衡出现,若总字数为整十数的相邻两题互换 0～9 其中一个数码,10 题内不重复交换」:
  //   每题字数 = 10k:第 1、2 题一对、3、4 题一对……每对选一组数码 X↔Y,前一题 X 多一次 Y 少一次、后一题反过来;
  //   每 10 题(5 对)的 5 组交换正好用遍 0～9(随机配对),10 题内不重复;
  //   字数不是整十(如 15 字):前一题尽量均匀,后一题接着补齐,使两题合起来 0～9 各出现同样次数。
  const T = Object.entries(part.d).reduce((n, [len, k]) => n + Number(len) * k, 0);
  const swaps: [number, number][] = [];
  const out: AddsubProblem[] = [];
  for (let i = 0; i < part.n; i++) {
    const mixed = part.m > 0 && (part.mixN != null ? i >= part.n - part.mixN : i % 5 >= 3);
    const rev = part.reverse && i === part.n - 1 ? part.reverse : undefined;
    const dec = !!part.dec || (part.decN != null && i >= part.n - part.decN);
    let init: number[] | undefined;
    if (T % 10 === 0 && Math.max(...Object.keys(part.d).map(Number)) > 1) { // 全是 1 位数(十级)时 0 不可能出现,不做交换
      if (i % 10 === 0) { const sh = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); swaps.length = 0; for (let k = 0; k < 10; k += 2) swaps.push([sh[k], sh[k + 1]]); }
      const pair = i % 2 === 1 || i + 1 < part.n ? swaps[Math.floor((i % 10) / 2)] : undefined; // 最后落单的一题不交换
      if (pair) { init = Array(10).fill(0); const [x, y] = pair; init[x] = i % 2 ? 1 : -1; init[y] = i % 2 ? -1 : 1; }
    } else if (i % 2 === 1) {
      init = Array(10).fill(0);
      for (const t of out[i - 1].terms) addDigits(init, Math.abs(t));
    }
    out.push(genAddsub(part, mixed || !!rev, rev, dec, init));
  }
  return out;
}

// ===== 乘除 =====
/** [位数1, 位数2, 题数]:乘 = [实, 法, n];除 = [法(除数), 商, n] */
export type Combo = [number, number, number];

/** 带 k 位小数的展示:整数 v、小数位 k(k = len 时形如 0.xxxx) */
const decText = (v: number, k: number) => fmtUnits(v, k);
const pow10 = (k: number) => 10n ** BigInt(k);

/** 小数题因数的小数位数(2026-10-27 付海东「乘除法小数点还得规范」,对照官方样题 114 道小数乘法题):
 *  ① 两个因数都带小数(样题从没有 432×0.129 这种整数乘小数);② 小数位只有 1、2、4、5 位或纯小数(0.84、0.8294),
 *  从不出 3 位小数(0.491、0.129 这种 3 位纯小数样题里一道都没有)。凑不出「积要舍入」时才放宽到 1～位数。 */
export function mulDecPlaces(len: number): number[] {
  const ks = [1, 2, 4, 5].filter((k) => k <= len && k !== 3);
  if (len !== 3 && !ks.includes(len)) ks.push(len); // 纯小数(0.xx / 0.xxxx / 0.xxxxxxx)
  return ks.length ? ks : [len];
}
/** 乘:dec = 是否带小数;round = 要求的舍入类别 */
export function genMul(a: number, b: number, places: number, round?: "down" | "up"): MdProblem {
  for (let t = 0; t < 4000; t++) {
    // 前 1500 次按「数字均匀」挑;实在凑不出要求的舍入类别,再放开整卷计数、只保留「本题两数不重复」(更随机,保证小数题数量不少)
    const [A, B] = pairDigits(a, b, LOOSE || t >= 1500);
    if (!round) { tallyMd(commas(String(A)), commas(String(B))); return { kind: "mul", a: commas(String(A)), b: commas(String(B)), answer: commas(String(BigInt(A) * BigInt(B))) }; }
    // 答案不能是 0.0x(样题里没有这种,如 0.746×0.125=0.09)
    const strict = t < 3000;
    // 自定义出题:3 位数可以是 51.7 / 2.87 / 0.356,都包含(付海东:3位×3位应有 0.356×0.27、0.457×0.129、1.96×0.324、2.54×0.194)
    const free = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    const ra = FREE_DEC ? free(a) : strict ? mulDecPlaces(a) : [rnd(1, a)], rb = FREE_DEC ? free(b) : strict ? mulDecPlaces(b) : [rnd(1, b)];
    const ka = ra[rnd(0, ra.length - 1)], kb = rb[rnd(0, rb.length - 1)];
    const K = ka + kb;
    if (K <= places) continue;
    const P = BigInt(A) * BigInt(B);
    const shift = K - places;
    if (P % pow10(shift) === 0n) continue; // 保留位以后全是 0(如 1.25×0.4=0.500):其实不用舍入,不算四舍/五入题
    const q = P / pow10(shift), next = Number((P / pow10(shift - 1)) % 10n);
    if ((next >= 5) !== (round === "up")) continue;
    const rounded = q + (next >= 5 ? 1n : 0n);
    if (rounded < pow10(Math.max(0, places - 1))) continue;
    const ta = decText(A, ka), tb = decText(B, kb);
    if (/\.\d*0$/.test(ta) || /\.\d*0$/.test(tb)) continue; // 小数末尾是 0(21.0)官方卷不这么写,重抽
    tallyMd(ta, tb);
    return { kind: "mul", a: ta, b: tb, answer: fmtUnits(rounded, places) };
  }
  return genMul(a, b, places);
}

/** 除:round 省略 = 除尽(整数商);否则除不尽,四舍五入到 places 位并满足舍入类别 */
export function genDiv(d: number, q: number, places: number, round?: "down" | "up"): MdProblem {
  for (let t = 0; t < 5000; t++) {
    // 除数 D 和答案 A 一起挑:两数各自数码不重复、互不重复(2026-10-26 付海东「除法看商和除数」「答案自己也不能重复(53.83 不行)」
    // 「除法小数最后的答案,数字也不能和除数重复」)。被除数不管。
    const [D, A] = pairDigits(d, q, t >= 2000);
    if (!round) { tallyMd(commas(String(D)), String(A)); return { kind: "div", a: commas(String(D * A)), b: commas(String(D)), answer: commas(String(A)) }; }
    // 除不尽(2026-10-25 付海东:商的位数含小数位):答案 A 恰好 q 位、小数点落在倒数第 places 位。
    //   先定答案再反推被除数:五入题 商整数部分 Q = A − 1、余数 R ≥ D/2;四舍题 Q = A、0 < R < D/2;
    //   N = D×Q + R,被除数缩 kv+places 位、除数缩 kv 位 → N/D 四舍五入到整数 = A(答案显示时小数点落在倒数第 places 位)
    const up = round === "up";
    // 自定义出题:约一半是「被除数短」的题(2026-11-04 付海东「答案是 3 位也可以出 0.56 除 0.13」= 4.31,被除数不必是 除数×商 凑出来的长数)
    if (FREE_DEC && Math.random() < 0.5) {
      const kv = rnd(1, d);
      const ta = shortDividend(BigInt(A), BigInt(D), places + kv, up, d + 1);
      if (!ta) continue;
      const tb = fmtUnits(D, kv);
      if (/\.\d*0$/.test(tb)) continue;
      tallyMd(tb, String(A));
      return { kind: "div", a: ta, b: tb, answer: fmtUnits(A, places) };
    }
    const lo = up ? Math.ceil(D / 2) : 1, hi = up ? D - 1 : Math.ceil(D / 2) - 1;
    if (hi < lo) continue;
    const R = rnd(lo, hi);
    const Q = BigInt(A) - (up ? 1n : 0n);
    const N = BigInt(D) * Q + BigInt(R);
    // 除数最多两位小数(样题:2.14、0.24、6.72,没有 0.123 这种);自定义出题不限,除数也可以是 0.356 这种纯小数
    const kv = FREE_DEC ? rnd(1, d) : rnd(0, Math.min(d, 2));
    const ta = fmtUnits(N, kv + places), tb = fmtUnits(D, kv);
    if (/\.\d*0$/.test(ta) || /\.\d*0$/.test(tb)) continue; // 题面小数末尾不带 0
    if (/^0\.0/.test(ta)) continue; // 被除数不出 0.0xxx
    tallyMd(tb, String(A)); // 商按自身数码计(0.5683 的前导 0 是格式,答案也不印在试卷上)
    return { kind: "div", a: ta, b: tb, answer: fmtUnits(A, places) };
  }
  return genDiv(d, q, places);
}

/** 位数尽量少的被除数 X:X ÷ (D/10^e 的除数) 四舍五入到保留位后恰好是答案 A(答案以最小单位计,e = 保留位 + 除数小数位)。
 *  五入题 X ∈ [(A−½)·D, A·D),四舍题 X ∈ (A·D, (A+½)·D)(都除以 10^e;不取整除的 A·D)。从小数位最少的精度找,随机挑一个、
 *  有效数字 2 ~ maxSig 位,题面不带末尾 0、不出 0.0x;找不到返回 null */
function shortDividend(A: bigint, D: bigint, e: number, up: boolean, maxSig: number): string | null {
  const lo = (2n * A - 1n) * D, mid = 2n * A * D, hi = (2n * A + 1n) * D; // 都是 X·2·10^e
  const T = 2n * 10n ** BigInt(e);
  const ceilDiv = (x: bigint, y: bigint) => (x + y - 1n) / y;
  for (let pa = 0; pa <= e + 1; pa++) {
    const P = 10n ** BigInt(pa);
    // m / 10^pa 落在区间里:m·T ∈ [lo·P, mid·P)(五入)或 (mid·P, hi·P)(四舍)
    const mLo = up ? ceilDiv(lo * P, T) : (mid * P) / T + 1n;
    const mHi = up ? ceilDiv(mid * P, T) - 1n : ceilDiv(hi * P, T) - 1n;
    if (mHi < mLo) continue;
    const cands: bigint[] = [];
    for (let m = mLo; m <= mHi && cands.length < 50; m++) if (pa === 0 || m % 10n !== 0n) cands.push(m);
    if (!cands.length) continue;
    const m = cands[Math.floor(Math.random() * cands.length)];
    const sig = m.toString().length;
    if (sig < 2 || sig > maxSig) return null;
    const ta = fmtUnits(m, pa);
    return /^0\.0/.test(ta) ? null : ta;
  }
  return null;
}

/** 一组乘/除题:combos 按实法(法商)位数合计由易到难排;dec = [四舍题数, 五入题数] 随机落在组内 */
/** decHard = 小数题固定给位数最多的几题(排在最后,珠心算段位样卷如此) */
/** prodRatio(全国比赛乘算标准):积的位数 ÷ 实法位数和 ≈ 83%(80%–86%)——每题试几个候选,挑让本组累计比例最接近目标的 */
export function genMdGroup(kind: "mul" | "div", combos: Combo[], places: number, dec?: [number, number], mixed = false, decHard = false, prodRatio?: number, freeDec = false): MdProblem[] {
  FREE_DEC = freeDec;
  try { return genMdGroupInner(kind, combos, places, dec, mixed, decHard, prodRatio); } finally { FREE_DEC = false; }
}
function genMdGroupInner(kind: "mul" | "div", combos: Combo[], places: number, dec?: [number, number], mixed = false, decHard = false, prodRatio?: number): MdProblem[] {
  // 由易到难(位数合计升序);同位数合计的题型随机穿插。mixed = 不排序、各种位数随机穿插(世界比赛样卷)
  const all = shuffle(combos.flatMap(([x, y, n]) => Array(n).fill([x, y]) as [number, number][]));
  const slots = mixed ? all : all.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
  const rounds: ("down" | "up" | undefined)[] = Array(slots.length).fill(undefined);
  if (dec) {
    const order = decHard ? slots.map((_, i) => slots.length - 1 - i) : shuffle(slots.map((_, i) => i));
    // 除法小数题只给「商的位数 ≥ 保留位数」的题(否则答案是 0.0xx;样题保留四位时都是 0.5683 这种)
    const ok = (i: number) => kind !== "div" || slots[i][1] >= places;
    const idx = [...order.filter(ok), ...order.filter((i) => !ok(i)).slice(0, 0)];
    let k = 0;
    for (let i = 0; i < dec[0] && k < idx.length; i++) rounds[idx[k++]] = "down";
    for (let i = 0; i < dec[1] && k < idx.length; i++) rounds[idx[k++]] = "up";
  }
  if (kind === "mul" && prodRatio) {
    const nd = (t: string) => t.replace(/[^0-9]/g, "").replace(/^0+/, "").length;
    let fd = 0, ad = 0;
    return slots.map(([x, y], i) => {
      let best: MdProblem | null = null, err = Infinity;
      DRY = true;
      for (let t = 0; t < 40; t++) {
        LOOSE = t >= 8;
        const p = genMul(x, y, places, rounds[i]);
        // 同时照顾「实数、法数首位 1～9 各自均衡」:首位已经偏多的候选加罚分(否则为凑 83% 会偏爱 1 开头的小数)
        const fa = firstSig(p.a), fb = firstSig(p.b);
        const leadPen = (LA[fa] - Math.min(...LA.slice(1))) + (LB[fb] - Math.min(...LB.slice(1)));
        // 首位均衡优先(用户:数字均匀尤其重要;官方样卷 A 组第 1 张积位比 91% 也没硬凑 83%),在此前提下尽量靠近 83%
        const e = Math.abs((ad + nd(p.answer)) / (fd + nd(p.a) + nd(p.b)) - prodRatio) + 0.01 * leadPen;
        if (e < err) { err = e; best = p; }
        if (err < 0.004 && t >= 3) break;
      }
      DRY = false; LOOSE = false;
      tallyMd(best!.a, best!.b);
      fd += nd(best!.a) + nd(best!.b); ad += nd(best!.answer);
      return best!;
    });
  }
  return slots.map(([x, y], i) => (kind === "mul" ? genMul(x, y, places, rounds[i]) : genDiv(x, y, places, rounds[i])));
}

// ===== 整卷 =====
import type { ExamSpec, Section } from "./specs";
export interface GenSection { sec: Section; problems: ExamProblem[] }
export function genExam(spec: ExamSpec): GenSection[] {
  resetDigitCounts(); // 每套卷子单独统计数字均匀
  return spec.sections.map((sec) => ({
    sec,
    problems: sec.kind === "addsub"
      ? sec.parts.flatMap(genAddsubPart)
      : sec.groups.flatMap((g) => genMdGroup(sec.kind, g.combos, sec.places, g.dec, sec.shuffle, g.decHard, sec.prodRatio, !!sec.freeDec)),
  }));
}
