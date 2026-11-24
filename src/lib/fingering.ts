// AI 陪练 · 珠心算加减指法体系(八类,加减镜像)。
// 关键规则:归类看珠不看数 —— 同一个「减6」,10−6 是普通退位减,12−6 是退位满五减。
// 判类只看个位档的珠状态(上珠 u=⌊d0/5⌋、下珠 l=d0%5),与《珠心算指法总结》一致。

export type FingeringClass =
  | "直加" | "满五加" | "进位加" | "破五进位加"
  | "直减" | "破五减" | "退位减" | "退位满五减";

/** 判定一笔(在当前累计值 total 上加/减 1–9 的个位数 x)用的指法类别。 */
export function classifyStep(total: number, delta: number): FingeringClass {
  const x = Math.abs(delta);
  const d0 = ((total % 10) + 10) % 10;
  const u = d0 >= 5 ? 1 : 0; // 上珠(5)
  const l = d0 % 5;          // 下珠(1×4)

  if (delta > 0) {
    if (d0 + x < 10) {
      // 本档不进位:珠够直接拨=直加(x≥5 时上5上(x−5) 也算直加);下珠不够=满五加
      if (x < 5) return l + x <= 4 ? "直加" : "满五加";
      return "直加"; // d0+x<10 且 x≥5 ⇒ u=0 且 l+(x−5)≤4,必可直接拨
    }
    // 进位:去补数(10−x)进1。补数能直接去=进位加;去不动(下珠不够,要拆5)=破五进位加
    const comp = 10 - x;
    const removable = comp < 5 ? l >= comp : u === 1 && l >= comp - 5;
    return removable ? "进位加" : "破五进位加";
  }

  if (d0 >= x) {
    // 本档不退位:珠够直接去=直减;下珠不够(要拆5)=破五减
    if (x < 5) return l >= x ? "直减" : "破五减";
    return "直减"; // d0≥x≥5 ⇒ u=1 且 l≥x−5,必可直接去
  }
  // 退位:退1还补数(10−x)。补数能直接上=退位减(12−5 还的正是5珠本身,也是普通退位减);
  // 上不动(下珠不够,要上5去几)=退位满五减
  const comp = 10 - x;
  const addable = comp < 5 ? l + comp <= 4 : u === 0 && l + (comp - 5) <= 4;
  return addable ? "退位减" : "退位满五减";
}

// ===== 六关进阶(用户定的顺序,先加后减) =====
export interface CoachStage {
  id: number;
  name: string;
  short: string;           // 路径节点短名
  target: FingeringClass[];
  pair: FingeringClass[];  // 镜像配对指法:目标把珠推走后,用它拉回来(专业题库规律,如 破五减↔满五加)
  rule: string;            // 口诀卡:判定
  formula: string;         // 口诀卡:公式
  count: number;           // 推荐笔数
  variantGroups: { label: string; xs: number[] }[]; // 变式小课(练习册结构:加1满五/9的进位加…);UI 另加「全部」
}

export const COACH_STAGES: CoachStage[] = [
  { id: 1, name: "直加直减", short: "直加直减", target: ["直加", "直减"], pair: [], rule: "珠够,直接拨/直接去", formula: "不借不拆,拨珠即得", count: 5, variantGroups: [{ label: "1-4", xs: [1, 2, 3, 4] }, { label: "1-6", xs: [1, 2, 3, 4, 5, 6] }, { label: "1-9", xs: [1, 2, 3, 4, 5, 6, 7, 8, 9] }] },
  { id: 2, name: "满五加", short: "满五加", target: ["满五加"], pair: [], rule: "下珠不够加,把5拨上来、去掉多余下珠(凑成5)", formula: "加X下5去(5−X)", count: 5, variantGroups: [{ label: "加1", xs: [1] }, { label: "加2", xs: [2] }, { label: "加3", xs: [3] }, { label: "加4", xs: [4] }] },
  { id: 3, name: "破五减", short: "破五减", target: ["破五减"], pair: ["满五加"], rule: "下珠不够减,把5拨走、还回若干下珠(拆开5)", formula: "减X去5还(5−X)", count: 5, variantGroups: [{ label: "减1", xs: [1] }, { label: "减2", xs: [2] }, { label: "减3", xs: [3] }, { label: "减4", xs: [4] }] },
  { id: 4, name: "进位加", short: "进位加", target: ["进位加"], pair: ["破五减", "满五加"], rule: "本档满十、补数能直接去(6+5、8+2 也算本关)", formula: "加X去(10−X)进1", count: 5, variantGroups: [{ label: "9", xs: [9] }, { label: "8、7", xs: [8, 7] }, { label: "6、5", xs: [6, 5] }, { label: "4、3", xs: [4, 3] }, { label: "2、1", xs: [2, 1] }] },
  { id: 5, name: "破五进位加", short: "破五进位加", target: ["破五进位加"], pair: ["破五减", "满五加"], rule: "满十,且去补数时下珠不够、必须拆5(如 5+7、6+6)", formula: "加X上(X−5)去5进1", count: 5, variantGroups: [{ label: "加6", xs: [6] }, { label: "加7", xs: [7] }, { label: "加8", xs: [8] }, { label: "加9", xs: [9] }] },
  { id: 6, name: "退位减", short: "退位减", target: ["退位减"], pair: ["破五进位加", "进位加"], rule: "本档不够减,退1还补数(12−5 还的正是5珠,也算本关)", formula: "减X退1还(10−X)", count: 5, variantGroups: [{ label: "9", xs: [9] }, { label: "8、7", xs: [8, 7] }, { label: "6、5", xs: [6, 5] }, { label: "4、3", xs: [4, 3] }, { label: "2、1", xs: [2, 1] }] },
  { id: 7, name: "退位满五减", short: "退位满五减", target: ["退位满五减"], pair: ["破五进位加"], rule: "退1后还补数时下珠不够、要借5(如 12−6、12−7)", formula: "减X退1上5去(X−5)", count: 5, variantGroups: [{ label: "减6", xs: [6] }, { label: "减7", xs: [7] }, { label: "减8", xs: [8] }, { label: "减9", xs: [9] }] },
];

/**
 * 第 stage 关允许出现的类别 = 已学累积(≤本关的全部目标) ∪ 镜像配对 ∪ 直加直减。
 * 练习册实证:9的退位减课含满五加11%/破五进位加8%/破五减4%(学过的都可当走位),
 * 但进位加课 0% 退位减 —— 没学的绝不出现(「还没学到就复习前面的」)。
 */
export function allowedClasses(stage: number, digits = 1): Set<FingeringClass> {
  void digits; // 多位数与个位同集:练习册 2 位课同样只用已学指法
  const st = COACH_STAGES.find((s) => s.id === stage) ?? COACH_STAGES[0];
  const out = new Set<FingeringClass>(["直加", "直减"]);
  for (const t of COACH_STAGES) if (t.id <= st.id) for (const c of t.target) out.add(c);
  for (const c of st.pair) out.add(c);
  return out;
}

export interface CoachProblem { terms: number[]; signs: ("+" | "-")[]; answer: number; classes: FingeringClass[] }

// 纯专项模式:每一笔能出目标指法就出目标,只在珠状态不允许时穿插最少的「走位笔」(无比例式复习混入)。
let prevProblemSig = ""; // 上一题签名(防连续两题完全相同)
let recentAnswers: number[] = []; // 最近几题答案(防连续答案相同,「怎么都是5」)

// 变式使用计数(跨题持久):保证练某关时,~100 题内该指法的所有变式(加1…加9 等口诀)都被覆盖。
const VAR_KEY = "flashmath:coachVariants";
let variantUse: Record<string, number> | null = null;
function loadVariantUse(): Record<string, number> {
  if (variantUse) return variantUse;
  try { const p = JSON.parse(window.localStorage.getItem(VAR_KEY) || "{}"); variantUse = typeof p === "object" && p ? p : {}; } catch { variantUse = {}; }
  return variantUse!;
}
function bumpVariant(cls: FingeringClass, x: number, d0?: number): void {
  const vu = loadVariantUse();
  vu[`${cls}|${x}`] = (vu[`${cls}|${x}`] ?? 0) + 1;
  vu[`#d|${x}`] = (vu[`#d|${x}`] ?? 0) + 1; // 全局数字使用计数(数字均匀)
  if (d0 != null) vu[`${cls}|${x}|@${d0}`] = (vu[`${cls}|${x}|@${d0}`] ?? 0) + 1; // 状态对(从几加几):2+3 与 3+3 分开计
  try { window.localStorage.setItem(VAR_KEY, JSON.stringify(vu)); } catch { /* noop */ }
}
function unbumpVariant(cls: FingeringClass, x: number, d0?: number): void {
  // 废稿回滚:通用引擎弃掉一次尝试时,把该尝试的计数退回去 —— 否则稀有变式(直减9)
  // 被反复"选中又弃稿"后计数虚高,均衡饥饿再也不找它,百题覆盖破功。
  const vu = loadVariantUse();
  vu[`${cls}|${x}`] = Math.max(0, (vu[`${cls}|${x}`] ?? 0) - 1);
  vu[`#d|${x}`] = Math.max(0, (vu[`#d|${x}`] ?? 0) - 1);
  if (d0 != null) vu[`${cls}|${x}|@${d0}`] = Math.max(0, (vu[`${cls}|${x}|@${d0}`] ?? 0) - 1);
  try { window.localStorage.setItem(VAR_KEY, JSON.stringify(vu)); } catch { /* noop */ }
}
const variantCount = (cls: FingeringClass, x: number) => loadVariantUse()[`${cls}|${x}`] ?? 0;
const stateCount = (cls: FingeringClass, x: number, d0: number) => loadVariantUse()[`${cls}|${x}|@${d0}`] ?? 0;
const digitCountG = (x: number) => loadVariantUse()[`#d|${x}`] ?? 0;

// 「实际出过」的变式计数:仅在题目被采纳时累加(variantUse 会被废稿尝试污染,
// 不能用于「该变式是否真出现过」的判断);镜像回吐豁免专用,内存态即可。
let emittedUse: Record<string, number> = {};
const emittedCount = (cls: FingeringClass, x: number) => emittedUse[`${cls}|${x}`] ?? 0;
function bumpEmitted(p: { terms: number[]; classes: FingeringClass[] }): void {
  for (let i = 0; i < p.terms.length; i++) {
    const k = `${p.classes[i]}|${Math.abs(p.terms[i]) % 10}`;
    emittedUse[k] = (emittedUse[k] ?? 0) + 1;
  }
}

/** 仅测试用:清空变式/数字全局计数(隔离用例)。 */
export function __resetVariantUse(): void {
  variantUse = {};
  emittedUse = {};
  try { window.localStorage.removeItem(VAR_KEY); } catch { /* noop */ }
}


/**
 * 一笔(±delta,可多位)在各档上的指法类别序列(低位→高位,进/借位折算进上一档的有效增减量)。
 * 结果为负返回 null。e=10 的档(9+进1)是纯传递,不产生指法。
 */
export function termRodClasses(total: number, delta: number): FingeringClass[] | null {
  if (total + delta < 0) return null;
  const sign = delta > 0 ? 1 : -1;
  let rest = Math.abs(delta), carry = 0, i = 0;
  const out: FingeringClass[] = [];
  while (rest > 0 || carry > 0) {
    if (i > 12) return null;
    const x = rest % 10;
    rest = Math.floor(rest / 10);
    const e = x + carry;
    const state = Math.floor(total / 10 ** i) % 10;
    if (e === 0) { carry = 0; i++; continue; }
    if (e === 10) { carry = 1; i++; continue; }
    if (sign > 0) { carry = state + e >= 10 ? 1 : 0; out.push(classifyStep(state, e)); }
    else { carry = state < e ? 1 : 0; out.push(classifyStep(state, -e)); }
    i++;
  }
  return out;
}

/** 一笔的「主指法」= 各档中最高阶的类别(给分笔归因/目标命中用)。 */
function primaryClass(rods: FingeringClass[]): FingeringClass {
  return rods.reduce((a, b) => (stageForClass(b) > stageForClass(a) ? b : a));
}

/**
 * 给个位候选补高位数字:随机采样合法组合,并从中选「目标指法档数最多」的一笔 ——
 * 让多位数练习时高位档也尽量吃到目标指法(三位数满五加 = 三个档都尽量满五加)。
 */
function fillHigherDigits(total: number, sign: 1 | -1, onesX: number, digits: number, allowed: Set<FingeringClass>, cap: number, isTarget: (c: FingeringClass) => boolean): number | null {
  let best: number | null = null;
  let bestHits = -1;
  for (let t = 0; t < 40; t++) {
    let term = onesX;
    for (let i = 1; i < digits; i++) {
      const lo = i === digits - 1 ? 1 : 0; // 首位 ≥1
      term += (lo + Math.floor(Math.random() * (10 - lo))) * 10 ** i;
    }
    const nt = total + sign * term;
    if (nt < 1 || nt > cap) continue;
    const rods = termRodClasses(total, sign * term);
    if (!rods || !rods.every((c) => allowed.has(c))) continue;
    const hits = rods.filter(isTarget).length;
    if (hits > bestHits) { best = term; bestHits = hits; }
  }
  return best;
}

/**
 * 1位关卡规划式出题(②–⑦通用):
 * 1) 计划层:按变式/状态对生疏度安排 need 笔目标;≥③关以 50% 概率再安排 1 笔「复习笔」
 *    (本关之前最高阶的指法,如退位减关安排破五进位加 —— 课本「学过的都可复习」);
 * 2) 选一个不与最近几题重复的答案;
 * 3) 在 0..cap 总值图上走廊寻路串题(BFS 距离 + 预算剪枝,有富余时 35% 绕路增加变化)。
 * 解决贪心式出题的顽疾:答案扎堆、状态对偏科、低频指法(破五进位加)在复习中缺席。
 */
const ADD_CLASSES: FingeringClass[] = ["直加", "满五加", "进位加", "破五进位加"];
function planStage1D(stage: CoachStage, count: number, variantXs?: number[] | null): CoachProblem | null {
  const target = stage.target[0];
  const allowed = allowedClasses(stage.id, 1);
  const cap = stage.id >= 4 ? 35 : 9;
  const signOf = (c: FingeringClass): 1 | -1 => (ADD_CLASSES.includes(c) ? 1 : -1);

  // 某状态 t 上、某类别 c 的全部合法加数 x
  const legalXs = (t: number, c: FingeringClass, restrict: boolean): number[] => {
    const sg = signOf(c);
    const out: number[] = [];
    for (let x = 1; x <= 9; x++) {
      if (restrict && variantXs && !variantXs.includes(x)) continue;
      const nt = t + sg * x;
      if (nt < 0 || nt > cap) continue;
      if (classifyStep(t, sg * x) === c) out.push(x);
    }
    return out;
  };

  // 走位边:允许集内、非目标类(目标只按计划出,密度可控)
  const edges = (a: number) => {
    const out: { b: number; x: number; s: 1 | -1 }[] = [];
    for (let x = 1; x <= 9; x++) {
      for (const sg of [1, -1] as const) {
        const b = a + sg * x;
        if (b < 0 || b > cap) continue;
        const c = classifyStep(a, sg * x);
        if (!allowed.has(c) || c === target) continue;
        out.push({ b, x, s: sg });
      }
    }
    return out;
  };
  const N = cap + 1;
  const dist: number[][] = Array.from({ length: N }, () => Array(N).fill(99));
  for (let a = 0; a < N; a++) {
    dist[a][a] = 0;
    const q = [a];
    while (q.length) { const u = q.shift()!; for (const e of edges(u)) if (dist[a][e.b] > dist[a][u] + 1) { dist[a][e.b] = dist[a][u] + 1; q.push(e.b); } }
  }

  const need = stage.id === 2 || stage.id === 3 ? Math.max(1, Math.round(count * 0.4)) : Math.max(1, Math.round(count * 0.3));
  // 复习笔类别:在「已学的全部高阶指法」里轮换 —— 全局出现最少的优先
  // (付海东原则:每一关都要涉及之前学过的内容,破五减/满五加/进位加轮着来,不能只盯一种)
  const reviewCands = [...allowed].filter((c) => c !== target && stageForClass(c) > 1);
  const clsTotal = (c: FingeringClass) => { let t = 0; for (let x = 1; x <= 9; x++) t += variantCount(c, x); return t; };
  reviewCands.sort((a, b) => clsTotal(a) - clsTotal(b) || Math.random() - 0.5);
  const reviewCls: FingeringClass | null = reviewCands[0] ?? null;
  const minusQuota = Math.round(count / 3); // 珠算标准:减法笔 ≈ 1/3

  let bestValid: CoachProblem | null = null; // 答案不够分散但结构合法的兜底方案
  for (let attempt = 0; attempt < 40; attempt++) {
    type PlanStroke = { cls: FingeringClass; isT: boolean };
    // 自适应降档:先按满配(目标 need + 可能的复习笔);装不下再丢复习笔;再不行目标数递减到 1
    const needEff = Math.max(1, need - Math.floor(attempt / 16));
    const plan: PlanStroke[] = Array.from({ length: needEff }, () => ({ cls: target, isT: true }));
    if (attempt < 16 && stage.id >= 3 && reviewCls && count > needEff + 1) {
      plan.splice(1 + Math.floor(Math.random() * needEff), 0, { cls: reviewCls, isT: false }); // 复习笔必排(装不下会降档丢弃)
    }
    // 每个计划笔的可收割状态集
    const goals = plan.map((ps) => {
      const set: number[] = [];
      for (let t = 0; t < N; t++) if (legalXs(t, ps.cls, ps.isT).length) set.push(t);
      return set;
    });
    if (goals.some((g) => !g.length)) return null;
    // 答案不预设:走完计划后自由收尾,末笔偏向「最近没出过的答案」——预设答案会让大量预算装不下
    const mr: number[][] = Array.from({ length: plan.length + 1 }, () => Array(N).fill(99));
    for (let t = 0; t < N; t++) mr[plan.length][t] = 0;
    for (let j = plan.length - 1; j >= 0; j--) {
      for (let t = 0; t < N; t++) {
        let m = 99;
        for (const g of goals[j]) {
          const d1 = dist[t][g];
          if (d1 >= 99) continue;
          for (const x of legalXs(g, plan[j].cls, plan[j].isT)) {
            const aft = g + signOf(plan[j].cls) * x;
            if (mr[j + 1][aft] < 99) m = Math.min(m, d1 + 1 + mr[j + 1][aft]);
          }
        }
        mr[j][t] = m;
      }
    }
    // 前几轮尝试优先「留 ≥1 笔自由收尾」的计划(答案更散);装不下就接受恰好占满(收割容差随机兜底答案分散)
    if (mr[0][0] > (attempt < 6 ? count - 1 : count)) continue;

    const terms: number[] = [];
    const signs: ("+" | "-")[] = [];
    const classes: FingeringClass[] = [];
    let state = 0, j = 0, ok = true, minusCnt = 0;
    for (let i = 0; i < count; i++) {
      const left = count - i;
      const ps = j < plan.length ? plan[j] : null;
      const harvestXs = ps
        ? legalXs(state, ps.cls, ps.isT).filter((x) => {
            const aft = state + signOf(ps.cls) * x;
            return mr[j + 1][aft] <= left - 1 && (left > 1 || aft >= 1);
          })
        : [];
      const must = ps != null && harvestXs.length > 0 && mr[j][state] === left;
      // 上下两笔不出同一个数(2026-11-07):有别的可选时去掉与上一笔相同的 x
      const lastX = terms.length ? terms[terms.length - 1] : -1;
      { const nh = harvestXs.filter((x) => x !== lastX); if (nh.length) harvestXs.splice(0, harvestXs.length, ...nh); }
      if (ps && harvestXs.length && (must || Math.random() < 0.75)) {
        // 收割:选最生疏的变式/状态对
        const sg = signOf(ps.cls);
        // 末笔收割:答案分散优先于变式均衡 —— 可选答案往往只有 4~5 个(如满五加末态只能落 5–8),
        // 用「最近出现次数最少」软均衡而非硬排除(硬排除会排空回退,重新集中)。
        let x: number;
        if (left === 1) {
          const cnt = (x2: number) => recentAnswers.filter((a) => a === state + signOf(ps.cls) * x2).length;
          const m = Math.min(...harvestXs.map(cnt));
          const xsPool = harvestXs.filter((x2) => cnt(x2) === m);
          x = xsPool[Math.floor(Math.random() * xsPool.length)];
        } else {
          const hscore = (x2: number) => variantCount(ps.cls, x2) * 10 + stateCount(ps.cls, x2, ((state % 10) + 10) % 10);
          const hmin = Math.min(...harvestXs.map(hscore));
          let hpool = harvestXs.filter((x2) => hscore(x2) <= hmin + 10); // 容差内随机,防确定性锁死
          // 倒数第二笔恰是收割:选 x 时先看它把末笔答案空间引向哪 —— 让「最近最少出现的答案」可达
          if (left === 2) {
            const finCnt = (x2: number) => {
              const b = state + sg * x2;
              const nextPs = j + 1 < plan.length ? plan[j + 1] : null;
              const opts = nextPs
                ? legalXs(b, nextPs.cls, nextPs.isT).map((x3) => b + signOf(nextPs.cls) * x3).filter((v) => v >= 1)
                : edges(b).map((e) => e.b).filter((v) => v >= 1);
              if (!opts.length) return 99;
              return Math.min(...opts.map((v) => recentAnswers.filter((a) => a === v).length));
            };
            const lo = Math.min(...hpool.map(finCnt));
            if (lo < 99) hpool = hpool.filter((x2) => finCnt(x2) === lo);
          }
          x = hpool[Math.floor(Math.random() * hpool.length)];
        }
        terms.push(x); signs.push(sg > 0 ? "+" : "-"); classes.push(ps.cls);
        if (sg < 0) minusCnt += 1;
        bumpVariant(ps.cls, x, ps.isT ? ((state % 10) + 10) % 10 : undefined);
        state += sg * x; j += 1;
        continue;
      }
      // 走位(计划完成后为自由收尾:末笔落到 ≥1 且尽量避开最近答案)
      let viable = edges(state).filter((e) => mr[j][e.b] <= left - 1 && (left > 1 || e.b >= 1));
      if (!viable.length) { ok = false; break; }
      { const nv = viable.filter((e) => e.x !== lastX); if (nv.length) viable = nv; }
      // 减法配额:减法笔不足 1/3 时优先出减法走位(加类目标关否则几乎全加法)
      if (minusCnt < minusQuota) {
        // 匀开减法笔:临近笔数不够才强制,否则五五开 —— 全程强制会把状态早早拖低,
        // 末笔收割只能从低状态出发(满五加@1 只能答 5),答案扎堆的根源之一。
        const deficit = minusQuota - minusCnt;
        if (left - 1 <= deficit * 2 || Math.random() < 0.5) {
          const neg = viable.filter((e) => e.s < 0);
          if (neg.length) viable = neg;
        }
      }
      let cpool: typeof viable;
      if (j >= plan.length && left === 1) {
        const cnt = (b: number) => recentAnswers.filter((a) => a === b).length;
        const m = Math.min(...viable.map((e) => cnt(e.b)));
        cpool = viable.filter((e) => cnt(e.b) === m);
      } else {
        const bestD = Math.min(...viable.map((e) => mr[j][e.b]));
        const hasSlack = mr[j][state] < left;
        // 倒数第二笔放开「最短路」收窄:viable 本就 mr 可行,收窄只会把落点挤回少数低状态
        cpool = left === 2 ? viable : hasSlack && Math.random() < 0.35 ? viable : viable.filter((e) => mr[j][e.b] === bestD);
        // 倒数第二笔:偏向落到「末笔能凑出最近最少答案」的状态,从根上摊平末答案
        // (满五加末态天然只有 5–8、5 最多,靠这步让 5/6/7/8 轮流出);自由收尾同样适用。
        if (left === 2) {
          const ansCnt = (b: number) => {
            const opts = j < plan.length
              ? legalXs(b, plan[j].cls, plan[j].isT).map((x) => b + signOf(plan[j].cls) * x).filter((v) => v >= 1)
              : edges(b).map((e) => e.b).filter((v) => v >= 1);
            if (!opts.length) return 99;
            return Math.min(...opts.map((v) => recentAnswers.filter((a) => a === v).length));
          };
          const lo = Math.min(...cpool.map((e) => ansCnt(e.b)));
          if (lo < 99) {
            const nar = cpool.filter((e) => ansCnt(e.b) === lo);
            if (nar.length) cpool = nar;
          }
        }
      }
      const pick = cpool[Math.floor(Math.random() * cpool.length)];
      const c = classifyStep(state, pick.s * pick.x);
      terms.push(pick.x); signs.push(pick.s > 0 ? "+" : "-"); classes.push(c);
      if (pick.s < 0) minusCnt += 1;
      bumpVariant(c, pick.x);
      state = pick.b;
    }
    if (!ok || j < plan.length || state < 1) continue;
    const sig = signs.map((sg2, i2) => sg2 + terms[i2]).join(",");
    if (sig === prevProblemSig) continue;
    // 答案分散验收:与上一题相同、或近 8 题已出过 2 次 → 整题重试(留兜底)
    const dupLast = state === recentAnswers[recentAnswers.length - 1];
    const cnt8 = recentAnswers.slice(-8).filter((a) => a === state).length;
    if (attempt < 32 && (dupLast || cnt8 >= 2)) {
      if (!bestValid) bestValid = { terms, signs, answer: state, classes };
      continue;
    }
    prevProblemSig = sig;
    recentAnswers = [...recentAnswers, state].slice(-12);
    return { terms, signs, answer: state, classes };
  }
  if (bestValid) {
    prevProblemSig = bestValid.signs.map((sg2, i2) => sg2 + bestValid!.terms[i2]).join(",");
    recentAnswers = [...recentAnswers, bestValid.answer].slice(-12);
    return bestValid;
  }
  return null;
}

/**
 * 定向出题(对齐付海东专业题库的「目标+镜像配对」规律):count 笔 digits 位数加减。
 * 每一笔逐档指法 ∈ 本关允许集;逐笔优先级:目标指法 > 镜像配对(把珠拉回目标状态区) > 直加直减走位。
 * 数字/变式按全局使用次数均衡。全程 total ∈ [1, 10^(digits+1)−1]。
 */
/** 上下相邻两笔是同一个数(不论加减号)—— 2026-11-07 付海东「上下不要出现一模一样的数字」 */
const hasAdjDup = (terms: number[]) => terms.some((t, i) => i > 0 && Math.abs(t) === Math.abs(terms[i - 1]));
export function generateCoachProblem(stageId: number, count: number, digits = 1, variantXs?: number[] | null): CoachProblem {
  let p = generateCoachProblemOnce(stageId, count, digits, variantXs);
  for (let k = 0; k < 30 && hasAdjDup(p.terms); k++) p = generateCoachProblemOnce(stageId, count, digits, variantXs);
  return p;
}
function generateCoachProblemOnce(stageId: number, count: number, digits = 1, variantXs?: number[] | null): CoachProblem {
  const stage = COACH_STAGES.find((s) => s.id === stageId) ?? COACH_STAGES[0];
  const isTarget = (c: FingeringClass) => (stage.target as string[]).includes(c);
  // 变式小课(练习册结构,如「加1满五」「9的进位加」):目标只出指定变式,其余变式的目标类整笔弃用
  const isTargetPick = (c: FingeringClass, x: number) => isTarget(c) && (!variantXs || variantXs.includes(x));
  const isPair = (c: FingeringClass) => (stage.pair as string[]).includes(c);
  const d = Math.min(6, Math.max(1, Math.round(digits)));
  // 1 位关卡(②–⑦):规划式出题(目标密度/状态对/答案/复习笔全面可控);失败再落回通用引擎
  if (d === 1 && stage.id >= 2) {
    const planned = planStage1D(stage, count, variantXs);
    if (planned) return planned;
  }
  const allowed = allowedClasses(stage.id, d);
  // 总值范围对齐练习册:1位五族课永不跨10(cap=9 天然如此);1位进位/退位课压在 ~39 内
  // (课本中位 18-22、90分位 26-35,不让 +9+9+9+9 无限爬高);多位数按位数值域。
  const cap = d === 1 ? (stage.id >= 4 ? 35 : 9) : 10 ** (d + 1) - 1;

  let bestSeen: CoachProblem | null = null;
  let bestHitsSeen = -1;
  let bestSeenBumps: [FingeringClass, number, number | undefined][] = [];
  for (let attempt = 0; attempt < 60; attempt++) {
    const bumps: [FingeringClass, number, number | undefined][] = []; // 本次尝试的计数,弃稿时回滚
    const usage: Record<number, number> = {}; // 个位数字使用次数(均衡分布)
    // 首笔个位优先落在「目标指法下一步就能出」的状态区(如满五加关 → 个位 1–4)
    const enabling: number[] = [];
    for (let f = 1; f <= 9; f++) {
      for (let x2 = 1; x2 <= 9; x2++) {
        if (isTargetPick(classifyStep(f, x2), x2) || (f > x2 && isTargetPick(classifyStep(f, -x2), x2))) { enabling.push(f); break; }
      }
    }
    // 首笔自身也是一笔:若首笔类别属于目标类(如直加直减关),须服从小课变式过滤
    const firstOk = (f: number) => { const c = classifyStep(0, f); return !isTarget(c) || isTargetPick(c, f); };
    let onesPool = (enabling.length ? enabling : [1, 2, 3, 4, 5, 6, 7, 8, 9]).filter(firstOk);
    if (!onesPool.length) onesPool = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(firstOk);
    if (!onesPool.length) onesPool = [1];
    const firstOnes = onesPool[Math.floor(Math.random() * onesPool.length)];
    const first = d === 1 ? firstOnes : fillHigherDigits(0, 1, firstOnes, d, allowed, cap, variantXs ? () => false : isTarget);
    if (first == null) continue;
    const terms = [first];
    const signs: ("+" | "-")[] = ["+"];
    const firstRods = termRodClasses(0, first)!;
    const classes: FingeringClass[] = [primaryClass(firstRods)];
    usage[firstOnes] = 1;
    let total = first;
    let ok = true;

    const needTargets = stage.id === 2 || stage.id === 3 ? Math.max(1, Math.round(count * 0.4)) : 1;
    let hitsSoFar = 0;
    let minusCntG = 0;
    const minusQuotaG = Math.round(count / 3); // 珠算标准:减法笔 ≈ 1/3(多位数加类关否则几乎全加法)
    for (let i = 1; i < count; i++) {
      // 个位候选(±1..9)按类别分成 目标/镜像配对/走位 三池
      let targets: { x: number; s: 1 | -1; c: FingeringClass }[] = [];
      let pairs: { x: number; s: 1 | -1; c: FingeringClass }[] = [];
      let walks: { x: number; s: 1 | -1; c: FingeringClass }[] = [];
      const floorNow = i === count - 1 ? 1 : 0; // 中途允许归零(课本实证 1+4−5+9−5),末笔答案 ≥1
      for (let x = 1; x <= 9; x++) {
        for (const s of [1, -1] as const) {
          if (d === 1) { const nt = total + s * x; if (nt < floorNow || nt > cap) continue; }
          const c = classifyStep(total, s * x);
          if (!allowed.has(c)) continue;
          if (isTarget(c)) { if (isTargetPick(c, x)) targets.push({ x, s, c }); continue; }
          (isPair(c) ? pairs : walks).push({ x, s, c });
        }
      }
      // 反「镜像回吐」:上一笔 +x 紧接 −x(或反之)是无聊的抵消对 —— 直加直减关的变式均衡
      // 会疯抢稀有变式(直减9只在总值9可出),一到状态就立收,满屏 +9−9/+7−7(2026-09-12 用户反馈)。
      // 有其他选择时一律排除;稀有变式仍可经 +5+4−9 这类自然路径覆盖。三池同滤,滤空则保留原池。
      if (d === 1) {
        const lastX = Math.abs(terms[terms.length - 1]) % 10;
        const lastS: 1 | -1 = signs[signs.length - 1] === "+" ? 1 : -1;
        // 例外:该变式在已采纳的题里还从未出现过时放行(emitted 计数不受废稿污染) —— 保「百题内变式全覆盖」铁律
        // (直减9只能从总值9出,若9恰由+9而来,不放行就可能整窗缺课)。
        const noUndo = <T extends { x: number; s: 1 | -1; c: FingeringClass }>(arr: T[]): T[] =>
          arr.filter((p) => !(p.x === lastX && p.s === -lastS) || emittedCount(p.c, p.x) === 0);
        const t2 = noUndo(targets), p2 = noUndo(pairs), w2 = noUndo(walks);
        if (t2.length + p2.length + w2.length > 0) { targets = t2; pairs = p2; walks = w2; }
      }
      // 练习册节奏:目标约 65% 概率出手(防连打贪心);回位/走位笔在「配对+已学」里换花样,
      // 偏好:能让目标下一步可落子 > 镜像配对 > 其他已学;总值压在课本区间(高了偏减、低了偏加)。
      const helpers = pairs.concat(walks);
      let pool: { x: number; s: 1 | -1; c: FingeringClass }[];
      // 加类目标(进位加/破五进位加)在总值偏高时降频出手,让回位笔把总值拉回课本区间(中位~18)
      const addTarget = stage.id === 4 || stage.id === 5;
      // 五族关(满五加/破五减)按付海东要求提密度:目标能出就出(5笔至少2笔);进/退位关维持课本节奏
      // 末笔且目标额度已满 → 一半概率用走位收尾,让答案落点分散(不总停在满五加后的 5/6)
      const quotaMet = i === count - 1 && hitsSoFar >= needTargets;
      const pTarget =
        quotaMet ? 0.4 :
        addTarget && d === 1 ? (total >= 20 ? 0.3 : total >= 12 ? 0.55 : 0.8) :
        stage.id === 2 || stage.id === 3 ? 0.95 : 0.65;
      const useTarget = targets.length > 0 && (helpers.length === 0 || Math.random() < pTarget);
      let poolIsTargets = false; // 减法配额过滤会换掉 pool 数组,不能再用引用比较判断打分分支
      if (useTarget) { pool = targets; poolIsTargets = true; }
      else if (helpers.length) pool = helpers;
      else if (targets.length) { pool = targets; poolIsTargets = true; }
      else { ok = false; break; }
      // 减法配额:不足 1/3 时,优先从当前池挑减法;池里没有就从 配对∪走位 找减法(复习已学减类)
      if (minusCntG < minusQuotaG) {
        const negIn = pool.filter((p) => p.s < 0);
        if (negIn.length) pool = negIn;
        else {
          const negAlt = helpers.filter((p) => p.s < 0);
          if (negAlt.length && Math.random() < 0.6) pool = negAlt;
        }
      }
      const enablesNext = (p: { x: number; s: 1 | -1 }) => {
        const nt = total + p.s * p.x;
        if (nt < 0 || nt > cap) return false;
        for (let x2 = 1; x2 <= 9; x2++) {
          if (nt + x2 <= cap && isTargetPick(classifyStep(nt, x2), x2)) return true;
          if (nt - x2 >= 0 && isTargetPick(classifyStep(nt, -x2), x2)) return true;
        }
        return false;
      };
      // 两步寻路:一步到不了目标状态区时,偏好「下下步能到」的走位(加1满五这类窄状态课必需)
      const enablesTwo = (p: { x: number; s: 1 | -1 }) => {
        const nt = total + p.s * p.x;
        if (nt < 0 || nt > cap) return false;
        for (let x2 = 1; x2 <= 9; x2++) {
          for (const s2 of [1, -1] as const) {
            const c2 = classifyStep(nt, s2 * x2);
            if (!allowed.has(c2)) continue;
            const n2 = nt + s2 * x2;
            if (n2 < 0 || n2 > cap) continue;
            for (let x3 = 1; x3 <= 9; x3++) {
              if (n2 + x3 <= cap && isTargetPick(classifyStep(n2, x3), x3)) return true;
              if (n2 - x3 >= 0 && isTargetPick(classifyStep(n2, -x3), x3)) return true;
            }
          }
        }
        return false;
      };
      // 分层打分:目标笔以「变式覆盖」为主;走位笔以「寻路(几步能回目标状态区)」为主,
      // 均衡项(全局数字/反单调/题内)只作次级;总值压力在高位偏减、低位偏加。
      const prev = terms.length ? { x: Math.abs(terms[terms.length - 1]) % 10, c: classes[classes.length - 1] } : null;
      const midHi = stage.id >= 4 && d === 1;
      const d0Now = ((total % 10) + 10) % 10;
      // 走位落点的「状态对生疏度」:落到 nt 后,那里可出的目标里最少练的(从几加几)有多生 —— 
      // 引导走位去没去过的状态(2+3 练多了就去铺 3+3、3+4 的场)。
      const stateNeed = (nt: number): number => {
        const dd = ((nt % 10) + 10) % 10;
        let m = Infinity;
        for (let x2 = 1; x2 <= 9; x2++) {
          if (nt + x2 <= cap && isTargetPick(classifyStep(nt, x2), x2)) m = Math.min(m, stateCount(classifyStep(nt, x2), x2, dd));
          if (nt - x2 >= 0 && isTargetPick(classifyStep(nt, -x2), x2)) m = Math.min(m, stateCount(classifyStep(nt, -x2), x2, dd));
        }
        return Number.isFinite(m) ? Math.min(m, 8) : 9; // 封顶:生疏度只作 tier 内排序,不得冲破层级(×100 后 <1000)
      };
      const score = (p: { x: number; s: 1 | -1; c: FingeringClass }) => {
        const lastStroke = i === count - 1;
        const base =
          digitCountG(p.x) * 10 +
          (prev && p.x === prev.x ? 30 : 0) + (prev && p.c === prev.c ? 10 : 0) +
          (midHi && total >= 16 && p.s > 0 ? 100 : 0) + (midHi && total <= 8 && p.s < 0 ? 100 : 0) +
          (lastStroke && recentAnswers.includes(total + p.s * p.x) ? 300 : 0) + // 答案别和最近几题一样
          (usage[p.x] ?? 0) * 2;
        if (poolIsTargets) return variantCount(p.c, p.x) * 1000 + stateCount(p.c, p.x, d0Now) * 300 + base;
        // 剩余笔数感知:只剩 ≤2 笔时,走位必须一步直达目标状态区(两步寻路来不及收割)
        const remaining = count - i;
        const tier = enablesNext(p) ? 0 : remaining > 2 && enablesTwo(p) ? 1 : 2;
        return tier * 1000 + (isPair(p.c) ? 0 : 300) + (tier === 0 ? stateNeed(total + p.s * p.x) * 100 : 0) + base;
      };
      // 上下两笔不出一模一样的数(2026-11-07 付海东截图「−32 下面紧接 32」):1 位数时直接排除与上一笔同数的候选(有别的可选时)
      const prevAbs = terms.length ? Math.abs(terms[terms.length - 1]) : -1;
      if (d === 1) { const np = pool.filter((p) => p.x !== prevAbs); if (np.length) pool = np; }
      const minScore = Math.min(...pool.map(score));
      // 容差 25 内视为同分随机选:留出路线随机性,避免确定性打分在小解空间里(如加1满五)锁死
      pool = pool.filter((p) => score(p) <= minScore + 25);
      // 打乱后逐个尝试(多位数需要高位补齐成功)
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      let placed = false;
      for (const pick of shuffled) {
        // 多位数:高位随机补齐,补出来和上一笔一模一样就重补(最多 8 次),仍相同则换下一个候选
        let term: number | null = null;
        for (let r = 0; r < (d === 1 ? 1 : 8); r++) {
          const t = d === 1 ? pick.x : fillHigherDigits(total, pick.s, pick.x, d, allowed, cap, variantXs ? () => false : isTarget);
          if (t == null) break;
          if (t !== prevAbs || d === 1) { term = t; break; }
        }
        if (term == null) continue;
        const rods = termRodClasses(total, pick.s * term)!;
        const d0Before = ((total % 10) + 10) % 10;
        total += pick.s * term;
        terms.push(term);
        signs.push(pick.s > 0 ? "+" : "-");
        classes.push(d === 1 ? pick.c : primaryClass(rods));
        usage[pick.x] = (usage[pick.x] ?? 0) + 1;
        if (pick.s < 0) minusCntG += 1;
        const bd0 = isTarget(pick.c) ? d0Before : undefined;
        bumpVariant(pick.c, pick.x, bd0);
        bumps.push([pick.c, pick.x, bd0]);
        if (isTargetPick(pick.c, pick.x)) hitsSoFar += 1;
        placed = true;
        break;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) {
      // 质检:目标笔数下限 —— 五族关(②③)每题 ≥40%(5笔≥2笔,付海东要求);其余关 ≥1 笔。
      // 达不到时保留「目标最多的一次尝试」兜底;并防止与上一题完全相同。
      let hits = needTargets;
      if (stage.id > 1) {
        let t2 = 0;
        hits = 0;
        for (let i = 0; i < terms.length; i++) {
          const dlt = signs[i] === "-" ? -terms[i] : terms[i];
          const onesX = Math.abs(dlt) % 10;
          const rods = termRodClasses(t2, dlt) ?? [];
          if (variantXs) { if (rods.length && isTargetPick(rods[0], onesX)) hits += 1; }
          else hits += rods.filter(isTarget).length;
          t2 += dlt;
        }
      }
      const made: CoachProblem = { terms, signs, answer: total, classes };
      const sig = signs.map((sg, i) => sg + terms[i]).join(",");
      if (sig !== prevProblemSig && hits > bestHitsSeen) { bestSeen = made; bestHitsSeen = hits; bestSeenBumps = [...bumps]; }
      if (hits < needTargets || sig === prevProblemSig) {
        for (const [c2, x2, d02] of bumps) unbumpVariant(c2, x2, d02); // 弃稿回滚
        continue;
      }
      prevProblemSig = sig;
      recentAnswers = [...recentAnswers, made.answer].slice(-12);
      bumpEmitted(made);
      return made;
    }
    if (!ok) for (const [c2, x2, d02] of bumps) unbumpVariant(c2, x2, d02); // 走不通的尝试同样回滚
  }
  if (bestSeen) {
    prevProblemSig = bestSeen.signs.map((sg, i) => sg + bestSeen!.terms[i]).join(",");
    recentAnswers = [...recentAnswers, bestSeen.answer].slice(-12);
    for (const [c2, x2, d02] of bestSeenBumps) bumpVariant(c2, x2, d02); // 兜底方案的计数补回
    bumpEmitted(bestSeen);
    return bestSeen;
  }
  // 兜底(理论到不了):纯直加
  const terms = [1, 2, 1].slice(0, Math.max(1, Math.min(3, count)));
  let t = 0;
  const classes = terms.map((x) => { const c = classifyStep(t, x); t += x; return c; });
  return { terms, signs: terms.map(() => "+" as const), answer: t, classes };
}

// ===== 关卡进度(v1 本地存储;付海东定的通关标准:近 100 题正确率 ≥80%,百题内变式全覆盖) =====
const PASS_WINDOW = 100;
const PASS_RATE = 0.8;
const KEY = "flashmath:coach";

export interface CoachProgress { stage: number; recent: Record<number, boolean[]>; passed: number[] }

export function loadCoachProgress(): CoachProgress {
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return {
      stage: Math.min(COACH_STAGES.length, Math.max(1, Number(p.stage) || 1)),
      recent: typeof p.recent === "object" && p.recent ? p.recent : {},
      passed: Array.isArray(p.passed) ? p.passed.filter((n: unknown) => typeof n === "number") : [],
    };
  } catch {
    return { stage: 1, recent: {}, passed: [] };
  }
}

/** 记一局结果;返回是否本次通关 + 最新进度(已落盘)。 */
export function recordCoachResult(stageId: number, correct: boolean): { justPassed: boolean; progress: CoachProgress } {
  const p = loadCoachProgress();
  const arr = [...(p.recent[stageId] ?? []), correct].slice(-PASS_WINDOW);
  p.recent[stageId] = arr;
  let justPassed = false;
  if (!p.passed.includes(stageId) && arr.length >= PASS_WINDOW && arr.filter(Boolean).length / arr.length >= PASS_RATE) {
    p.passed.push(stageId);
    justPassed = true;
    // 注意:通关只点亮徽章,不自动切关 —— 连续场次练到一半题型突变很打断人;切关由用户自己点。
  }
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* noop */ }
  return { justPassed, progress: p };
}

/**
 * 云端陪练序列(按时间正序的 {关卡,对错})合并进本地进度 —— 账号级进度的纯计算部分。
 * 通关判定与实时口径一致:任意连续 100 题窗口正确率 ≥80% 即视为通关(通关不撤销)。
 * recent 取云端末 100 题;与本地已有窗口取「更长者」(本地可能含未登录练习,跨设备时云端更全)。
 */
export function mergeCloudCoachProgress(seq: { stage: number; correct: boolean }[]): CoachProgress {
  const p = loadCoachProgress();
  const byStage: Record<number, boolean[]> = {};
  for (const r of seq) (byStage[r.stage] ??= []).push(r.correct);
  for (const sidStr of Object.keys(byStage)) {
    const sid = Number(sidStr);
    const arr = byStage[sid];
    let run = 0;
    for (let i = 0; i < arr.length; i++) {
      run += arr[i] ? 1 : 0;
      if (i >= PASS_WINDOW) run -= arr[i - PASS_WINDOW] ? 1 : 0;
      if (i >= PASS_WINDOW - 1 && run / PASS_WINDOW >= PASS_RATE && !p.passed.includes(sid)) p.passed.push(sid);
    }
    const recent = arr.slice(-PASS_WINDOW);
    if (recent.length >= (p.recent[sid]?.length ?? 0)) p.recent[sid] = recent;
  }
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* noop */ }
  return p;
}

export function setCoachStage(stageId: number): CoachProgress {
  const p = loadCoachProgress();
  p.stage = Math.min(COACH_STAGES.length, Math.max(1, stageId));
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* noop */ }
  return p;
}

/** 本关窗口内进度(题数/正确数),给路径节点「进行中 12/20」用。 */
export function stageWindow(p: CoachProgress, stageId: number): { done: number; correct: number; need: number } {
  const arr = p.recent[stageId] ?? [];
  return { done: arr.length, correct: arr.filter(Boolean).length, need: PASS_WINDOW };
}

// ===== 指法分类错误统计(错哪类→推荐去哪关专项) =====
// 按「题包含的类别」归因:答错的题,其每一笔的类别都记一次错误暴露。粗粒度但方向正确。
const CLS_KEY = "flashmath:classStats";
type ClassStats = Record<string, { n: number; wrong: number }>;

function loadClassStats(): ClassStats {
  try { const p = JSON.parse(window.localStorage.getItem(CLS_KEY) || "{}"); return typeof p === "object" && p ? p : {}; } catch { return {}; }
}

/** 每答完一题(加减)记一笔:题中出现的每个类别 n++,答错则 wrong++。 */
export function recordClassOutcome(classes: FingeringClass[], correct: boolean): void {
  const st = loadClassStats();
  for (const c of new Set(classes)) {
    const e = st[c] ?? { n: 0, wrong: 0 };
    e.n += 1;
    if (!correct) e.wrong += 1;
    st[c] = e;
  }
  try { window.localStorage.setItem(CLS_KEY, JSON.stringify(st)); } catch { /* noop */ }
}

/** 从一道加减题推出每笔的(个位档)指法类别 —— 综合训练的题也能归因。 */
export function classesOfProblem(terms: number[], signs: string[]): FingeringClass[] {
  const out: FingeringClass[] = [];
  let total = 0;
  terms.forEach((t, i) => {
    const d = (signs[i] === "-" ? -1 : 1) * t;
    const u = Math.abs(d) % 10;
    if (u > 0 && total >= 0 && total + d >= 0) out.push(classifyStep(total, Math.sign(d) * u));
    total += d;
  });
  return out;
}

export function stageForClass(cls: FingeringClass): number {
  return COACH_STAGES.find((s) => (s.target as FingeringClass[]).includes(cls))?.id ?? 1;
}

/** 八类指法各自的作答记录(AI 陪练可视化「指法掌握度」用,2026-11-08) */
export function classMastery(): Record<string, { n: number; wrong: number }> { return loadClassStats(); }

/** 最弱指法类别:暴露 ≥minN 且错误率最高;低于 minRate 不报。 */
export function weakestClass(minN = 15, minRate = 0.3): { cls: FingeringClass; rate: number; n: number; stageId: number } | null {
  const st = loadClassStats();
  let best: { cls: FingeringClass; rate: number; n: number } | null = null;
  for (const [cls, e] of Object.entries(st)) {
    if (e.n < minN) continue;
    const rate = e.wrong / e.n;
    if (rate < minRate) continue;
    if (!best || rate > best.rate) best = { cls: cls as FingeringClass, rate, n: e.n };
  }
  return best ? { ...best, stageId: stageForClass(best.cls) } : null;
}
