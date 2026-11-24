import { mixedLens } from "@/lib/spreadLens";
// Professional flash mental arithmetic question generation.
//
// Rules (per user spec):
//   1. Each TERM contains all distinct digits (no digit repeats within one number).
//      e.g. 35247 ✓   33434 ✗
//   2. Across the WHOLE problem, every digit 0-9 appears at each "place"
//      with as-equal-as-possible frequency. We use a positional shuffle bag:
//      for each place we maintain a 0-9 bag that reshuffles when exhausted.
//   3. For multi-digit terms the leading digit is never 0.
//   4. Adjacent terms must not be identical.
//   5. Optional single subtraction: at most one minus sign, never on the
//      first term, placed only where the running sum stays >= 0.
//
// This guarantees both per-term digit diversity AND long-run uniformity
// at every place — the kind of distribution professional 闪电心算
// instructors expect.

function makeBag(exclude?: number): number[] {
  const arr: number[] = [];
  for (let d = 0; d <= 9; d++) if (d !== exclude) arr.push(d);
  // Fisher–Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

class ShuffleBag {
  private bag: number[] = [];
  constructor(private exclude?: number) {}
  next(): number {
    if (this.bag.length === 0) this.bag = makeBag(this.exclude);
    return this.bag.pop()!;
  }
  /**
   * 取一个不在 used 里的数字:把撞重的暂存、扫到合格为止,撞重的再随机塞回袋中;
   * 整袋扫空仍无合格(残袋全是重复数字)→ 重灌一整袋继续。位数 ≤9 时必然成功。
   * (持久袋的关键配套:旧的「重试9次」在残袋上会撞死,导致大位数同数内重复。)
   */
  nextAvoiding(used: Set<number>): number {
    for (let refill = 0; refill < 2; refill++) {
      // 在当前袋里的「未用过」数字中,选全局计数最小的(同分随机)——袋保证周期,全局计数平滑窗口
      const cands = this.bag.filter((d) => !used.has(d));
      if (cands.length) {
        const minC = Math.min(...cands.map((d) => globalDigitCount[d]));
        const pool = cands.filter((d) => globalDigitCount[d] === minC);
        const d = pool[Math.floor(Math.random() * pool.length)];
        this.bag.splice(this.bag.indexOf(d), 1);
        globalDigitCount[d] += 1;
        return d;
      }
      this.bag = makeBag(this.exclude).concat(this.bag);
    }
    // 位数 >9 等极端情形:接受重复(与旧行为一致)
    const d = this.bag.length ? this.bag.pop()! : 0;
    globalDigitCount[d] += 1;
    return d;
  }
}

// 全局数字计数(所有数位共享):选数时「最近出得少的优先」,让 1-9 在相邻几题的滚动窗口内也均匀。
// 只有袋(每数位各自轮转)时,各数位互不通气 —— 9 可以同时挤在几个数位的袋口,相邻两题就扎堆。
const globalDigitCount: number[] = Array(10).fill(0);
// 持久洗牌袋(跨题记忆):同一(位数,数位)共用一个袋,保证长程均匀。
// 旧实现每题重建袋 → 跨题无记忆,某数字可能连着几题不出现;混合位数路径更是逐笔建袋 = 纯随机。
const bagStore = new Map<string, ShuffleBag>();
function bagFor(digits: number, place: number, exclude?: number): ShuffleBag {
  const key = `${digits}|${place}|${exclude ?? "-"}`;
  let b = bagStore.get(key);
  if (!b) { b = new ShuffleBag(exclude); bagStore.set(key, b); }
  return b;
}

/** Generate `count` numbers, each `digits` long, with the rules above.
 *  2026-10-26 与出题系统统一(《鉴定标准》拟题要求):纵列相邻上下不出同一数码(按个位对齐,prev = 上一行),
 *  每题尾数 0 最多 2 行(tailZero = 本题已有几行以 0 结尾)。 */
export function generateTerms(count: number, digits: number, prev?: number, tailZero0 = 0): number[] {
  // One bag per place. Place 0 = leading; if digits >= 2 it excludes 0.
  // Additionally: for 1-digit problems, exclude 0 entirely (single "0" terms
  // are not useful). For 2-digit problems, exclude 0 from every place to avoid
  // any zero digit (per spec: "尽量别出 0").
  const excludeZeroAllPlaces = digits <= 2;
  const bags: ShuffleBag[] = [];
  for (let p = 0; p < digits; p++) {
    const exclude =
      excludeZeroAllPlaces || (p === 0 && digits > 1) ? 0 : undefined;
    bags.push(bagFor(digits, p, exclude));
  }

  const terms: number[] = [];
  let tailZero = tailZero0;
  for (let i = 0; i < count; i++) {
    let term = 0;
    let attempts = 0;
    const above = String(i ? terms[i - 1] : prev ?? "");
    // Try to satisfy "all-distinct digits" within one term.
    // Up to 40 attempts; if impossible (digits >= 10 is impossible anyway),
    // fall back to a relaxed sample so we never block.
    while (true) {
      attempts++;
      const used = new Set<number>();
      const placeDigits: number[] = [];
      let ok = true;
      for (let p = 0; p < digits; p++) {
        // 从该数位的持久袋里取一个「本数内没用过」的数字(残袋自动重灌,位数≤9 必成功);同时避开上一行同一数位的数码
        const r = digits - 1 - p; // 从个位起的位次
        const up = r < above.length ? Number(above[above.length - 1 - r]) : -1;
        const avoid = up >= 0 && digits <= 9 ? new Set([...used, up]) : used;
        const d = digits <= 9 ? bags[p].nextAvoiding(avoid) : bags[p].next();
        if (used.has(d) || d === up) ok = false; // 仅位数>9 或袋子凑不出时可能发生
        used.add(d);
        placeDigits.push(d);
      }
      term = placeDigits.reduce((acc, d) => acc * 10 + d, 0);
      // Guarantee no two adjacent terms are equal.
      if (terms.length > 0 && terms[terms.length - 1] === term) ok = false;
      if (digits > 1 && term % 10 === 0 && tailZero >= 2) ok = false; // 尾数 0 每题最多 2 行
      // For digits >= 10 the unique-digit rule is impossible; accept after a few tries.
      if (ok || attempts >= 40) break;
    }
    if (term % 10 === 0 && digits > 1) tailZero++;
    terms.push(term);
  }
  return terms;
}

export type Sign = "+" | "-";

export interface Problem {
  terms: number[];
  signs: Sign[];
  answer: number;
}

// 在 [1, count-1] 内挑 m 个「隔行(不相邻)」且分散的减号位置(珠算标准:减数隔行排列)。
function spacedMinusPositions(count: number, m: number): number[] {
  const out: number[] = [];
  if (m <= 0 || count < 2) return out;
  const seg = (count - 1) / m;
  for (let k = 0; k < m; k++) {
    const lo = 1 + Math.floor(k * seg);
    const hi = Math.min(count - 1, Math.max(lo, Math.floor(1 + (k + 1) * seg) - 1));
    let pos = lo + Math.floor(Math.random() * (hi - lo + 1));
    const prev = out.length ? out[out.length - 1] : -2;
    if (pos <= prev + 1) pos = prev + 2;
    if (pos <= count - 1) out.push(pos);
  }
  return out;
}

/** Does this sign assignment keep every running partial sum >= 0? */
function runningNonNegative(terms: number[], signs: Sign[]): boolean {
  let running = 0;
  for (let i = 0; i < terms.length; i++) {
    running += signs[i] === "-" ? -terms[i] : terms[i];
    if (running < 0) return false;
  }
  return true;
}

// digitsMax 默认=digits(定长);当 digitsMax>digits 时,每笔位数在 [digits, digitsMax] 均匀随机(混合位数)。
export function buildProblem(count: number, digits: number, includeSub: boolean, digitsMax = digits): Problem {
  const dMin = Math.min(digits, digitsMax), dMax = Math.max(digits, digitsMax);
  let terms: number[];
  if (dMax <= dMin) {
    terms = generateTerms(count, dMin);
  } else {
    let tz = 0;
    terms = [];
    // 位数:区间内各位数行数尽量相等,并均匀铺开(2026-10-25 用户「两位、三位、四位要均匀分布,不要扎堆」;
    // 之前 10-21 只保证每种至少出现一次,随机打乱后仍会三位扎堆、四位扎堆)
    const lens = mixedLens(count, dMin, dMax);
    for (let i = 0; i < count; i++) {
      const d = lens[i];
      // 相邻两笔不同(与定长路径同规则);持久袋保证各位数字长程均匀
      const prevT = terms.length ? terms[terms.length - 1] : undefined;
      let t = generateTerms(1, d, prevT, tz)[0];
      for (let r = 0; r < 6 && terms.length && t === terms[terms.length - 1]; r++) t = generateTerms(1, d, prevT, tz)[0];
      if (d > 1 && t % 10 === 0) tz++;
      terms.push(t);
    }
  }
  let signs: Sign[] = terms.map(() => "+");

  if (includeSub && terms.length >= 2) {
    // 珠算标准:减数字码 ≈ 该题总字数的 1/3,减数隔行(不相邻)排列,首笔恒加,
    // 且保证每一步中间和 >= 0。放不下就自动减少减号数量。
    const target = Math.min(terms.length - 1, Math.max(1, Math.round(count / 3)));

    let assigned: Sign[] | null = null;
    for (let m = target; m >= 1 && !assigned; m--) {
      for (let attempt = 0; attempt < 120; attempt++) {
        const minus = new Set(spacedMinusPositions(terms.length, m));
        if (minus.size < m) continue; // 隔行放不下这么多,换更少的
        const trial: Sign[] = terms.map((_, i) => (minus.has(i) ? "-" : "+"));
        if (runningNonNegative(terms, trial)) {
          assigned = trial;
          break;
        }
      }
    }
    if (assigned) signs = assigned;
  }

  let answer = 0;
  terms.forEach((t, i) => (answer += signs[i] === "+" ? t : -t));
  return { terms, signs, answer };
}
