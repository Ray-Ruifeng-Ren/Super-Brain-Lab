// 多位混合数的排列(2026-10-25 用户「既有两位、三位、四位的要均匀分布,不要三位扎堆、四位扎堆」):
// 每种位数按「等间距」铺到整列里(各自带一点随机偏移,不至于每题都一个样),再把仍然相邻的同位数交换开。
// 结果:比例允许的情况下同位数互不相邻;比例悬殊时(如 4位5行+3位10行)也只会两两相邻、均匀散开。

/** counts = {位数: 行数};返回长度为行数总和的位数序列。
 *  ① 能做到同位数互不相邻时(最多的一种 ≤ 其余 + 1):每次在「和上一行不同、取了之后剩下的仍排得开」的位数里按剩余行数加权随机挑 → 不相邻、均匀、每题顺序都不同;
 *  ② 某种位数太多(如 4位5行 + 3位10行):把它平均切成「其余行数 + 1」段,段与段之间夹其余位数 → 最长连续段 = ⌈多 ÷ (其余+1)⌉,已是最优。 */
export function spreadLens(counts: Record<number, number>): number[] {
  const entries = Object.entries(counts).map(([l, c]) => [Number(l), c] as [number, number]).filter(([, c]) => c > 0);
  const N = entries.reduce((s, [, c]) => s + c, 0);
  if (!N) return [];
  const maxC = Math.max(...entries.map(([, c]) => c));
  const doms = entries.filter(([, c]) => c === maxC);
  const [dom, a] = doms[Math.floor(Math.random() * doms.length)];
  const b = N - a;
  if (a > b + 1) {
    const others = spreadLens(Object.fromEntries(entries.filter(([l]) => l !== dom)));
    // 2026-10-26 付海东「鉴定的加减也是,位数要打乱顺序」:某种位数占多数(如珠心算三级 2位6行 + 3位2行)时,
    // 平均分段会每题都是同一个样子(22 3 22 3 22)。官方鉴定样卷也有三行连着同位数(五级:2,57,39,70,8,46,60,14),
    // 所以段长允许比最少的多 1 行,并随机挪动段长、首尾段可空 → 顺序每题不同,又不会长串扎堆。
    const slots = b + 1;
    const cap = Math.ceil(a / slots) + 1;
    const sizes = Array.from({ length: slots }, (_, i) => Math.floor(((i + 1) * a) / slots) - Math.floor((i * a) / slots));
    const minOf = (i: number) => (i === 0 || i === slots - 1 ? 0 : 1); // 中间段至少 1 行(否则两个「其他位数」挨着)
    for (let t = 0; t < slots * 3; t++) {
      const i = Math.floor(Math.random() * slots), j = Math.floor(Math.random() * slots);
      if (i !== j && sizes[i] > minOf(i) && sizes[j] < cap) { sizes[i]--; sizes[j]++; }
    }
    const seq: number[] = [];
    sizes.forEach((sz, i) => { for (let t = 0; t < sz; t++) seq.push(dom); if (i < b) seq.push(others[i]); });
    return seq;
  }
  // 2026-10-26 付海东「随机生成的位数顺序都是固定的,每次第一个数都是 3 位,第二张都是 5 位,要打乱」:
  // 之前每步固定取「剩余最多」的位数 → 每题开头、整列走向几乎一样。改为:在「和上一行不同、且取了之后剩下的还能排开」的位数里,
  // 按剩余行数加权随机挑 → 每题顺序都不一样,但仍保证同位数不相邻、各位数均匀铺开。
  const rem = new Map(entries);
  const seq: number[] = [];
  let prev: number | null = null;
  // 剩余 rem、上一行是 prev 时还能否排成「相邻不同」:最多的那种 ≤ 其余 + 1(若它就是 prev,则 ≤ 其余)
  const canFinish = (r: Map<number, number>, p: number | null) => {
    const R = [...r.values()].reduce((x, y) => x + y, 0);
    for (const [l, c] of r) { if (c > (l === p ? R - c : R - c + 1)) return false; }
    return true;
  };
  for (let k = 0; k < N; k++) {
    let cands = [...rem.entries()].filter(([l, c]) => c > 0 && l !== prev && canFinish(new Map(rem).set(l, c - 1), l));
    if (!cands.length) cands = [...rem.entries()].filter(([l, c]) => c > 0 && l !== prev);
    if (!cands.length) cands = [...rem.entries()].filter(([, c]) => c > 0);
    const tot = cands.reduce((x, [, c]) => x + c, 0);
    let pick = Math.random() * tot, l = cands[0][0];
    for (const [cl, c] of cands) { if ((pick -= c) < 0) { l = cl; break; } }
    seq.push(l); rem.set(l, rem.get(l)! - 1); prev = l;
  }
  return seq;
}

/** n 笔、位数在 [lo, hi] 之间:各位数行数尽量相等(多出来的随机给几种),再均匀排开 */
export function mixedLens(n: number, lo: number, hi: number): number[] {
  const span = hi - lo + 1;
  if (span <= 1) return Array(n).fill(lo);
  const counts: Record<number, number> = {};
  const base = Math.floor(n / span), extra = n - base * span;
  const extraLens = Array.from({ length: span }, (_, i) => lo + i).sort(() => Math.random() - 0.5).slice(0, extra);
  for (let d = lo; d <= hi; d++) counts[d] = base + (extraLens.includes(d) ? 1 : 0);
  // 笔数少于位数种类时保住最大位数(之前的承诺:布置 2-4 位就一定出现 4 位)
  if (n < span && !counts[hi]) { const give = Object.keys(counts).map(Number).find((d) => counts[d] > 0)!; counts[give]--; counts[hi] = 1; }
  return spreadLens(counts);
}

/** 最长同位数连续段(测试/校验用) */
export const maxRun = (seq: number[]): number => { let best = 0, run = 0; seq.forEach((x, i) => { run = i && x === seq[i - 1] ? run + 1 : 1; best = Math.max(best, run); }); return best; };
