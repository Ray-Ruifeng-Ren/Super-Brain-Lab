// 出题系统版面:把一套题排成 A4 页(仿中珠协鉴定模拟题版式),产出与打印预览 / Excel 共用的 SheetSpec。
// 20 列等宽网格:加减每行 10 题(每题 2 列)或 5 题(每题 4 列,长数);乘除两栏列表(每栏 10 列);答案表每行 4 个。
import { A4, type CellSpec, type PaperFont, type RowSpec, type SheetSpec } from "@/lib/paper";
import type { ExamSpec } from "./specs";
import type { AddsubProblem, GenSection, MdProblem } from "./generate";

const NC = 20;
const PW = A4.w - 2 * A4.mx, PH = A4.h - 2 * A4.my;
const CW = PW / NC;
const BOX: CellSpec["border"] = ["t", "b", "l", "r"];
const KIND_LABEL = { addsub: "加减算", mul: "乘算", div: "除算" } as const;
const placesNote = (p: number) => (p ? `要求保留${["", "一", "两", "三", "四"][p]}位小数，以下四舍五入` : "");

export interface ExamLayoutOpts { fontPt: number; only?: "addsub" | "mul" | "div"; font?: PaperFont; setNo?: number; _fsRec?: Record<string, number>; _fsCap?: Record<string, number> }
// 2026-10-26 付海东「字体大小不能改变」(段位第 2 张数字长,之前自动缩小字号):同一份卷子里同一项目(加减 / 乘 / 除)所有页用同一个字号 ——
// 先排一遍记下每个项目各页能用的最大字号,取最小值再排一遍;长数多的那张只是排得紧凑些,字不变小。
const capFs = (o: ExamLayoutOpts, kind: string, fs: number) => { const v = Math.min(fs, o._fsCap?.[kind] ?? Infinity); if (o._fsRec) o._fsRec[kind] = Math.min(o._fsRec[kind] ?? Infinity, v); return v; };

/** 文本在给定宽度里放得下的字号(数字约 0.6em 宽) */
/** 乘除一栏(细网格 20 列,每列约 13pt):序号 2 | 算式「a × b =」| 答题位
 *  2026-10-25 用户「等号靠左一些」;随后「尽量保证写答案位置充足」(鉴定样卷「=」后约留 4 成空白)→ 答题位至少 8 列(4 成)。
 *  2026-10-27 付海东「所有的字体大小要统一」:先保字号 —— 数字放不下按用户字号时,答题位最少让到 6 列(3 成),仍放不下才缩字 */
interface MdAlloc { fs: number; W: number }
function mdAlloc(F: number, ps: MdProblem[]): MdAlloc {
  let best: MdAlloc | null = null;
  for (let wc = 8; wc >= 6; wc--) {
    const W = (18 - wc) * FINE;
    best = { fs: fitMdFs(Math.min(F, mdFsMax(W, ps)), W, ps, "hand", FINE, 1), W };
    if (best.fs >= F - 1e-9) return best;
  }
  return best!;
}
function mdCells(c: (CellSpec | undefined)[], base: number, no: number, p: MdProblem, op: string, g: MdGeo) {
  const x = base * 2; // base 是 20 列网格的位置
  c[x] = { v: no, span: 2, size: 9, align: "center", border: BOX };
  exprCells(c, x + 2, x + 20, FINE, 1, p, op, g);
}

// ---------- 乘除算式「a × b =」等距排版(鉴定 / 自定义 / 世界 / 全国比赛共用)----------
// 2026-11-03 付海东「两边与乘号的距离要一致」→「所有的题都是一样的,全国和世界比赛里的符号间距也要一致」(附全国比赛样题):
// 第一个数靠右、第二个数靠左、「=」对成一列(按最长的第二个数),数 ↔ 运算符 ↔ 数 ↔「=」三处空隙相等,样题约 1.5 个数字宽;
// 放不下时空隙收到不小于半个字,再不够才缩字号。格子边界取最近的网格线(Excel 照格子对齐),预览 / PDF 再按 dx 平移到精确位置。
const OP_EM = 0.605, OP_K = 0.85, EQ_EM = 0.605; // 运算符、等号用普通字体(PingFang / 微软雅黑 ≈ 0.6em),运算符字号 0.85
const GAP_EM = 1.1, GAP_MIN = 0.5, LEAD_EM = 0.4;
/** 数字墨迹宽度(pt,实测):手写体数字 0.635em + 字距 0.08em、逗号小数点 0.352em;黑体 0.554 / 0.277 */
const inkW = (t: string, fs: number, font: PaperFont) => {
  const hand = font !== "hei";
  const em = [...t].reduce((n, ch) => n + (ch === "," || ch === "." ? (hand ? 0.432 : 0.277) : hand ? 0.715 : 0.554), 0);
  return Math.max(0, em - (hand ? 0.08 : 0)) * fs;
};
/** 宽 W(pt,不含答题位)里放得下的最大字号(数字宽按 tlen × CHAR_EM 保守估) */
function mdFsMax(W: number, ps: MdProblem[]) {
  const lenA = Math.max(...ps.map((p) => tlen(p.a))), lenB = Math.max(...ps.map((p) => tlen(p.b)));
  return Math.max(4.5, W / ((lenA + lenB) * CHAR_EM + OP_EM * OP_K + EQ_EM + LEAD_EM + 3 * GAP_MIN));
}
interface MdGeo { fs: number; gap: number; lead: number; aw: number; bw: number; font: PaperFont }
function mdGeo(fs: number, W: number, ps: MdProblem[], font: PaperFont): MdGeo {
  const aw = Math.max(...ps.map((p) => inkW(p.a, fs, font))), bw = Math.max(...ps.map((p) => inkW(p.b, fs, font)));
  const lead0 = LEAD_EM * fs, fixed = lead0 + aw + bw + OP_EM * OP_K * fs + EQ_EM * fs;
  // 多出来的宽度先给空隙(留一点给左边距,第一个数别贴着题号格),空隙到 1.1 个字为止,再多的一部分给左边距、其余留给答题位
  const gap = Math.max(GAP_MIN * fs, Math.min(GAP_EM * fs, (W - fixed) / 3.5));
  const spare = Math.max(0, W - fixed - 3 * gap);
  return { fs, gap, lead: lead0 + Math.min(spare * 0.5, 1.2 * fs), aw, bw, font };
}
/** 算式各段的格子边界(相对第一个数的起点,单位:列):[第一个数 | 运算符 | 第二个数 | = | 答题位起点] */
function exprCuts(g: MdGeo, unit: number, step: number) {
  const { fs, gap } = g, ls = g.font !== "hei" ? 0.08 * fs : 0; // 手写体字距加在每个字后面,靠右时末尾多出一个字距
  const opW = OP_EM * OP_K * fs, eqW = EQ_EM * fs;
  const Ra = g.lead + g.aw, P = Ra + gap + opW / 2, Lb = P + opW / 2 + gap, Q = Lb + g.bw + gap + eqW / 2;
  const snap = (pt: number) => step * Math.round(pt / unit / step);
  const need = (w: number) => step * Math.ceil((w + ls + 4.2) / unit / step); // 格子至少装得下数字(含末尾字距、两边 2pt 内边距;Excel 里窄了会显示 ###)
  const c1 = Math.max(snap(Ra + gap / 2), need(g.aw));
  const c2 = Math.max(snap(Lb - gap / 2), c1 + step);
  const c3 = Math.max(snap(Lb + g.bw + gap / 2), c2 + need(g.bw));
  const c4 = Math.max(snap(Q + eqW / 2 + gap / 2), c3 + step);
  return { c1, c2, c3, c4, Ra, P, Lb, Q, ls };
}
/** 格子取整后整个算式要占满 W(pt)以内(不挤占答题位),放不下就把字号再收一点 */
function fitMdFs(fs: number, W: number, ps: MdProblem[], font: PaperFont, unit: number, step: number) {
  while (fs > 4.5 && exprCuts(mdGeo(fs, W, ps, font), unit, step).c4 * unit > W + 0.01) fs = Math.max(4.5, fs - 0.25);
  return fs;
}
/** 网格 [x0, x1)(每列 unit pt,格子边界步长 step)里排一题:第一个数 | 运算符 | 第二个数 | = | 答题位 */
function exprCells(c: (CellSpec | undefined)[], x0: number, x1: number, unit: number, step: number, p: MdProblem, op: string, g: MdGeo) {
  const { fs } = g;
  const k = exprCuts(g, unit, step), { Ra, P, Lb, Q, ls } = k;
  const c1 = x0 + k.c1, c2 = x0 + k.c2, c3 = x0 + k.c3, c4 = Math.min(x1 - step, x0 + k.c4);
  const pt = (x: number) => (x - x0) * unit;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const tb: CellSpec["border"] = ["t", "b"];
  c[x0] = { v: p.a, span: c1 - x0, size: fs, align: "right", border: tb, num: true, dx: r2(Ra + ls - (pt(c1) - 2)) };
  c[c1] = { v: op, span: c2 - c1, size: fs * OP_K, align: "center", border: tb, dx: r2(P - (pt(c1) + pt(c2)) / 2) };
  c[c2] = { v: p.b, span: c3 - c2, size: fs, align: "left", border: tb, num: true, dx: r2(Lb - (pt(c2) + 2)) };
  c[c3] = { v: "=", span: c4 - c3, size: fs, align: "center", border: tb, dx: r2(Q - (pt(c3) + pt(c4)) / 2) };
  c[c4] = { v: "", span: x1 - c4, size: fs, align: "left", border: ["t", "b", "r"] };
}
const FINE = CW / 2;
/** 20 列网格的行 → 40 列细网格(乘除行直接按细网格排) */
const widen2 = (r: RowSpec): RowSpec => { const cells: (CellSpec | undefined)[] = []; r.cells.forEach((c, i) => { if (c) cells[i * 2] = { ...c, span: (c.span ?? 1) * 2 }; }); return { ...r, cells }; };
// 每字宽(em):手写体 ZHKJ Number 数字 0.635em + 字距 0.08em ≈ 0.72em(2026-10-26 用户「字号一放大,长一点的乘数第一个数就没了」:
// 之前按 0.6em 估,长数实际比格子宽、右对齐时左边被裁掉)。逗号小数点更窄,按数字算偏保守,保证放得下。
const CHAR_EM = 0.72;
/** 文字的「视觉长度」(以一个数字宽为 1):逗号、小数点实测只有数字的 0.6(手写体 0.352em+字距 vs 数字 0.635em+字距)。
 *  2026-10-27 字号统一后,段位除法 3,143,588.292 按 13 个整字算,整卷被拉到 7.7pt;按实际宽度算能大一号 */
export const tlen = (t: string) => [...t].reduce((n, ch) => n + (ch === "," || ch === "." ? 0.6 : 1), 0);
const fitFont = (F: number, width: number, len: number) => Math.max(4.5, Math.min(F, (width - 6) / (Math.max(1, len) * CHAR_EM)));

export function examSheets(spec: ExamSpec, gen: GenSection[], opts: ExamLayoutOpts): SheetSpec[] {
  if (!opts._fsCap) { const rec: Record<string, number> = {}; examSheets(spec, gen, { ...opts, _fsRec: rec, _fsCap: {} }); return examSheets(spec, gen, { ...opts, _fsCap: rec }); }
  const F = opts.fontPt, font = opts.font ?? "hand";
  const secs = gen.filter((g) => !opts.only || g.sec.kind === opts.only);
  const kinds = [...new Set(secs.map((g) => g.sec.kind))];
  if (spec.style) return [waamaQuestion(spec, secs, opts), answerSheet(spec, secs, F, opts.font, opts.setNo)];

  // ---------- 试题 ----------
  const rows: RowSpec[] = [];
  let used = 0;
  const fineRows = new Set<RowSpec>();
  // 空白间隔行放不下就省掉(2026-10-26 复查:能手级第 2 页被末尾间隔行顶出 A4 2pt)
  const push = (r: RowSpec) => { if (!r.cells.some(Boolean) && used + r.h > PH) return; rows.push(r); used += r.h; };
  const pushFine = (r: RowSpec) => { fineRows.add(r); push(r); };
  const breakPage = () => { if (rows.length) rows[rows.length - 1].brk = true; used = 0; };
  const fits = (h: number) => used + h <= PH;

  const titleRow = (): RowSpec => ({ h: 30, cells: [{ v: spec.title, span: NC, size: 15, bold: true, align: "center" }] });
  const infoRow = (): RowSpec => {
    const c: (CellSpec | undefined)[] = [];
    const lab = (i: number, v: string) => { c[i] = { v, span: 2, size: 10, align: "center", border: BOX }; };
    const blank = (i: number, span: number) => { c[i] = { v: "", span, size: 10, align: "left", border: BOX }; };
    lab(0, "考号"); blank(2, 4); lab(6, "姓名"); blank(8, 5); lab(13, "单位"); blank(15, 5);
    return { h: 22, cells: c };
  };
  /** 成绩表(左)+ 级别/限时(中);first = 第一页(右边放二维码) */
  const scoreBlock = (ks: string[], first: boolean) => {
    const tabRows = Math.max(3, 1 + ks.length);
    for (let i = 0; i < tabRows; i++) {
      const c: (CellSpec | undefined)[] = [];
      const head = i === 0;
      const hd = (col: number, span: number, v: string) => { c[col] = { v, span, size: 9, bold: head, align: "center", border: BOX }; };
      if (i < 1 + ks.length) {
        hd(0, 2, head ? "" : KIND_LABEL[ks[i - 1] as keyof typeof KIND_LABEL]);
        hd(2, 2, head ? "计算题" : ""); hd(4, 1, head ? "对题" : ""); hd(5, 1, head ? "错题" : "");
        hd(6, 1, head ? "初评" : ""); hd(7, 1, head ? "复核" : ""); hd(8, 1, head ? "等级" : "");
      }
      const info = (first ? [spec.level, spec.minutes ? `限时 ${spec.minutes} 分钟` : "", "扫码看答案 →"] : [spec.level])[i];
      if (info) c[9] = { v: info, span: 7, size: i === 0 ? 12 : 10, bold: i === 0, align: "center" };
      push({ h: 19, cells: c });
    }
    push({ h: 8, cells: [] });
  };
  // 第一页:标题 + 考号姓名单位 + 成绩表(左)+ 级别/限时(中)+ 二维码(右)
  push(titleRow()); push(infoRow()); push({ h: 8, cells: [] });
  const qrRow = rows.length;
  scoreBlock(kinds, true);
  // 2026-10-26 付海东「鉴定试题里加减是一张试卷,乘、除放在一张试卷里」:加减之后的乘除另起一页(同官方鉴定模拟题第 2 页:
  // 标题 + 考号姓名单位 + 乘算/除算成绩表),乘、除排在同一页
  let mdPage = false;
  let mdRH: number | null = null; // 乘除页统一行高(第一次排乘除列表时算)
  const startMdPage = (si: number) => {
    if (mdPage) return false;
    mdPage = true;
    if (!secs.slice(0, si).some((g) => g.sec.kind === "addsub")) return false;
    breakPage(); push(titleRow()); push(infoRow()); push({ h: 8, cells: [] });
    scoreBlock([...new Set(secs.slice(si).map((g) => g.sec.kind).filter((k) => k !== "addsub"))], false);
    return true;
  };

  const counters: Record<string, number> = { addsub: 0, mul: 0, div: 0 };
  const secHeader = (title: string, note: string, minutes?: number): RowSpec => {
    const c: (CellSpec | undefined)[] = [{ v: title, span: 6, size: 12, bold: true, align: "left" }];
    if (note) c[6] = { v: note, span: 10, size: 9, align: "left" };
    if (minutes) c[16] = { v: `限时 ${minutes} 分钟`, span: 4, size: 9, align: "right" };
    return { h: 22, cells: c };
  };

  // 乘算、除算都不超过 12 题且相邻:并排成左右两栏(仿官方鉴定卷,一页放得下)
  const paired = new Set<number>();
  secs.forEach((g, si) => {
    const nx = secs[si + 1];
    if (g.sec.kind === "mul" && nx && nx.sec.kind === "div" && !nx.sec.newPage && g.problems.length <= 12 && nx.problems.length <= 12) paired.add(si);
  });
  secs.forEach(({ sec, problems }, si) => {
    if (paired.has(si - 1)) return; // 已和左栏乘算一起排了
    if (sec.resetNo) counters[sec.kind] = 0;
    if (paired.has(si)) {
      startMdPage(si);
      const div = secs[si + 1];
      if (div.sec.resetNo) counters.div = 0;
      const L = problems as MdProblem[], R = div.problems as MdProblem[];
      const all = [...L, ...R];
      const al0 = mdAlloc(F, all), fs = capFs(opts, "num", al0.fs);
      const geo = { L: mdGeo(fs, al0.W, L, font), R: mdGeo(fs, al0.W, R, font) };
      const rowH = Math.max(20, fs * 1.75);
      const n = Math.max(L.length, R.length);
      const hp = sec.kind === "addsub" ? 0 : sec.places, dp = div.sec.kind === "addsub" ? 0 : div.sec.places;
      const hc: (CellSpec | undefined)[] = [];
      hc[0] = { v: `${sec.title}${hp ? `（${placesNote(hp)}）` : ""}`, span: 10, size: hp ? 10 : 12, bold: true, align: "left" };
      hc[10] = { v: `${div.sec.title}${dp ? `（${placesNote(dp)}）` : ""}`, span: 10, size: dp ? 10 : 12, bold: true, align: "left" };
      if (!fits(22 + rowH * Math.min(n, 3))) breakPage();
      push({ h: 22, cells: hc });
      // 乘除是卷子最后一块时行高撑满到页底(最高 36pt),同官方鉴定样卷第 2 页
      // 乘除并排(各 10 题)只有 10 行:行高放宽到 60pt,铺满整页、写答案的地方更大(之前封顶 36pt,页面下半截空着)
      const rh = si + 1 === secs.length - 1 && fits(22 + rowH * n) ? Math.min(60, Math.max(rowH, (PH - used - 10) / n)) : rowH;
      for (let r = 0; r < n; r++) {
        if (!fits(rh)) breakPage();
        const c: (CellSpec | undefined)[] = [];
        ([[L, "×", 0, "mul", geo.L], [R, "÷", 10, "div", geo.R]] as const).forEach(([list, op, base, kind, g]) => {
          const p = list[r]; if (!p) return;
          mdCells(c, base, counters[kind] + r + 1, p, op, g);
        });
        pushFine({ h: rh, cells: c });
      }
      counters.mul += L.length; counters.div += R.length;
      push({ h: 8, cells: [] });
      return;
    }
    const newMd = sec.kind !== "addsub" && startMdPage(si);
    if (!newMd && sec.newPage && si > 0) { breakPage(); push(titleRow()); push(infoRow()); push({ h: 6, cells: [] }); }
    const places = sec.kind === "addsub" ? 0 : sec.places;
    const header = secHeader(sec.title, placesNote(places), sec.minutes);
    if (sec.kind === "addsub") {
      const ps = problems as AddsubProblem[];
      const maxLen = Math.max(...ps.flatMap((p) => p.texts.map(tlen)), ...ps.map((p) => tlen(p.answer)));
      // onePage(自定义固定 20 题):只要每排 10 题时字号还能 ≥ 10pt 就排 10 题一排(2 排),比 5 题一排(4 排)省一半高度
      const rawLen = Math.max(...ps.flatMap((p) => p.texts.map((t) => t.length)), ...ps.map((p) => p.answer.length)); // 每排几题仍按字符数(已对照样卷)
      const per = rawLen * CHAR_EM * Math.min(F, 12) <= 2 * CW - 6 || (sec.onePage && fitFont(F, 2 * CW, maxLen) >= 10) ? 10 : 5;
      const span = NC / per;
      let fs0 = fitFont(F, span * CW, maxLen);
      // 自定义出题每张固定题数(2026-10-27 付海东「加减固定 20 题」):onePage = 尽量排进一页 —— 放不下就把字号往下收(最小 10pt),
      // 还放不下才排到第二页(10 位 20 笔这种大题)
      if (sec.onePage) {
        const rowsOf = (b: number) => Math.max(...ps.slice(b * per, b * per + per).map((p) => p.terms.length));
        const nb = Math.ceil(ps.length / per);
        const total = (f: number) => header.h + Array.from({ length: nb }, (_, b) => Math.max(14, f * 1.15) + rowsOf(b) * f * 1.3 + Math.max(22, f * 2) + 6).reduce((x, y) => x + y, 0);
        // 字号下限:短数(每排 10 题)10pt;长数(每排 5 题)8.5pt —— 2026-11-04 付海东「六位 15 笔一张只有 10 题,模拟题里一张能排 15 题,参考模拟题排版」
        // (世界比赛选手组加减样卷 8.4pt)
        const minFs = per === 5 ? 8.4 : 10;
        while (fs0 > minFs && used + total(fs0) > PH - 1) fs0 = Math.max(minFs, fs0 - 0.25);
      }
      const fs = capFs(opts, "num", fs0);
      const hdrH = Math.max(14, fs * 1.15);
      const termH0 = fs * 1.3, ansH0 = Math.max(22, fs * 2);
      // 2026-10-26 付海东「页边距要相等」:先按自然高度把各横排分到各页,再把每页剩下的空白匀给该页各行和答题格,
      // 内容铺满整页、上下边距一致(行高最多到字号 2.6 倍、答题格最多 56pt;题少的级别如珠算八级不硬撑满)。
      // 只在本部分之后另起一页(乘除另页 / 卷子结束 / 下一部分 newPage)时撑最后一页,否则最后一页给后面的部分留位置。
      const bandsRows: number[] = [];
      for (let b = 0; b * per < ps.length; b++) bandsRows.push(Math.max(...ps.slice(b * per, b * per + per).map((p) => p.terms.length)));
      const nat = (b: number) => hdrH + bandsRows[b] * termH0 + ansH0 + 6;
      const pageOf: number[] = [];
      const newFirst = !fits(header.h + nat(0)); // 第一排在当前页放不下 → 整个部分从新页开始
      const base0 = newFirst ? 0 : used;
      { let pg = 0, u = base0 + header.h; bandsRows.forEach((_, b) => { if (u + nat(b) > PH && b > 0) { pg++; u = 0; } pageOf.push(pg); u += nat(b); }); }
      const nx = secs[si + 1];
      const endsPage = !nx || nx.sec.kind !== "addsub" || !!nx.sec.newPage;
      const lastPg = pageOf[pageOf.length - 1];
      const stretch: { t: number; a: number }[] = bandsRows.map(() => ({ t: termH0, a: ansH0 }));
      // 2026-10-26 用户「同类型的题间距要保持一致」:同一部分跨几页时,各页用同一个行高 / 答题格高(取各页能撑到的最小值),
      // 不再每页各撑各的(第 1 页有表头空间少、第 2 页空间多 → 两页疏密不一)
      if (endsPage || lastPg === 0) {
        let tU = Infinity, aU = Infinity;
        for (let pg = 0; pg <= lastPg; pg++) {
          if (pg === lastPg && !endsPage) break;
          const bs = bandsRows.map((_, b) => b).filter((b) => pageOf[b] === pg);
          const availPg = (pg === 0 ? PH - base0 - header.h : PH) - bs.reduce((h, b) => h + nat(b), 0) - 4;
          const R = bs.reduce((n, b) => n + bandsRows[b], 0);
          const t2 = Math.min(fs * 2.6, termH0 + (Math.max(0, availPg) * 0.85) / R);
          const a2 = Math.min(56, ansH0 + (Math.max(0, availPg) - (t2 - termH0) * R) / bs.length);
          tU = Math.min(tU, t2); aU = Math.min(aU, a2);
        }
        if (Number.isFinite(tU)) stretch.forEach((x) => { x.t = tU; x.a = aU; });
      }
      let first = true;
      for (let b = 0; b * per < ps.length; b++) {
        const band = ps.slice(b * per, b * per + per);
        const nRows = bandsRows[b], termH = stretch[b].t, ansH = stretch[b].a;
        if (b > 0 && pageOf[b] !== pageOf[b - 1]) breakPage();
        else if (first && newFirst) breakPage();
        if (first) { push(header); first = false; }
        const hc: (CellSpec | undefined)[] = [];
        band.forEach((_, i) => { hc[i * span] = { v: ++counters.addsub, span, size: 9, align: "center", border: BOX }; });
        push({ h: hdrH, cells: hc });
        for (let k = 0; k < nRows; k++) {
          const c: (CellSpec | undefined)[] = [];
          band.forEach((p, i) => { c[i * span] = { v: p.texts[k] ?? "", span, size: fs, align: "right", border: ["l", "r"], num: true }; });
          push({ h: termH, cells: c });
        }
        const ac: (CellSpec | undefined)[] = [];
        band.forEach((_, i) => { ac[i * span] = { v: "", span, size: fs, align: "right", border: BOX }; });
        push({ h: ansH, cells: ac });
        push({ h: 6, cells: [] });
      }
    } else {
      const ps = problems as MdProblem[];
      const op = sec.kind === "mul" ? "×" : "÷";
      // onePage(自定义出题每张固定 60 题):30 行排进一页 —— 行高按剩余高度平分,字号跟着收(最小 10pt)
      const oneRH = sec.onePage ? (PH - used - header.h - 8 - 1) / Math.ceil(ps.length / 2) : 0;
      // 2026-10-27 付海东「段位的乘除法字体大小不一致」:乘算、除算共用一个字号上限(键 "md",取两者较小的)——
      // 之前各算各的,除法被除数长(642,590,207)字小、乘法字大,同一页两种字号
      const al0 = mdAlloc(F, ps), fs = capFs(opts, "num", oneRH ? Math.min(al0.fs, Math.max(10, oneRH / 1.5)) : al0.fs);
      const geo = mdGeo(fs, al0.W, ps, font);
      const rowH = oneRH ? Math.min(36, Math.max(oneRH, fs * 1.45)) : Math.max(20, fs * 1.75);
      if (oneRH) mdRH = rowH;
      // 2026-10-26 付海东「乘除法的间距也要相等」:同一页上乘算、除算用同一个行高,一起铺满到页底(之前只撑最后一块,乘算矮、除算高)
      if (mdRH == null) {
        const rest = secs.slice(si).filter((g) => g.sec.kind !== "addsub");
        const rowsAll = rest.reduce((n, g) => n + Math.ceil(g.problems.length / 2), 0), over = rest.length * (22 + 8);
        const baseH = Math.max(...rest.map((g) => Math.max(20, mdAlloc(F, g.problems as MdProblem[]).fs * 1.75)));
        mdRH = rowsAll * baseH + over <= PH - used ? Math.min(36, Math.max(baseH, (PH - used - over - 4) / rowsAll)) : rowH;
      }
      let i = 0, first = true;
      while (i < ps.length) {
        if (!fits((first ? header.h : 0) + rowH * 2)) breakPage();
        if (first) { push(header); first = false; }
        const avail = Math.max(1, Math.floor((PH - used + 0.01) / (mdRH ?? rowH)));
        const left = ps.length - i;
        const rowsHere = Math.min(avail, Math.ceil(left / 2));
        const count = Math.min(left, rowsHere * 2);
        const half = Math.ceil(count / 2);
        // 本页最后一块(后面没有别的部分)时行高撑满到页底(最高 36pt):同官方单项样卷,写答案的空间更大
        const rh = mdRH ?? rowH;
        for (let r = 0; r < rowsHere; r++) {
          const c: (CellSpec | undefined)[] = [];
          [r, half + r].forEach((k, side) => {
            if (k >= count) return;
            const p = ps[i + k], base = side * 10;
            mdCells(c, base, counters[sec.kind] + k + 1, p, op, geo);
          });
          pushFine({ h: rh, cells: c });
        }
        counters[sec.kind] += count;
        i += count;
      }
      push({ h: 8, cells: [] });
    }
  });
  const question: SheetSpec = { name: "试题", cols: Array(NC * 2).fill(FINE), rows: rows.map((r) => (fineRows.has(r) ? r : widen2(r))), scale: 1, font: opts.font ?? "hand", qr: { r: qrRow, c: 32, rows: 3, cols: 8, caption: 3 } };
  return [question, answerSheet(spec, secs, F, opts.font)];
}

// ---------- 答案 ----------
// 2026-10-26 付海东「生成答案的排版也要跟样题的排版一致,加减乘除」:按全国 / 世界比赛样题答案页:
//   加减:和试题同样每排 10 题或 5 题,题号格在上、答案格在下;
//   乘除:4 组「题号 | 答案」竖排(1–30、31–60…),每页 120 题,栏上方注明保留几位小数;
//   比赛卷每个项目单独一页答案(标题 + 组别 + 项目 + 大字「答 案」,世界比赛加 Answer);鉴定卷同样排法,全部放在一页接着排。
function answerSheet(spec: ExamSpec, secs: GenSection[], F: number, font?: PaperFont, setNo?: number): SheetSpec {
  const rows: RowSpec[] = [];
  let used = 0;
  const push = (r: RowSpec) => { rows.push(r); used += r.h; };
  const breakPage = () => { if (rows.length) rows[rows.length - 1].brk = true; used = 0; };
  const fits = (h: number) => used + h <= PH;
  const comp = !!spec.style, en = spec.style === "waama";
  const KIND_CN = { addsub: "加减算", mul: "乘  算", div: "除  算" } as const;
  const KIND_EN = { addsub: "Addition-and-Subtraction Calculation", mul: "Multiplication Calculation", div: "Division Calculation" } as const;
  const header = (kind?: "addsub" | "mul" | "div") => {
    if (comp) {
      if (en) push({ h: 12, cells: [{ v: "Sample Examination Questions of the Mental Arithmetic Competition", span: WN, size: 8.5, align: "center" }] });
      push({ h: 20, cells: [{ v: `${spec.title}${setNo ? `（${setNo}）` : ""}`, span: WN, size: 14, bold: true, align: "center" }] });
      if (spec.group?.[0]) push({ h: 11, cells: [{ v: spec.group[0], span: WN, size: 8, align: "center" }] });
      if (spec.group?.[1]) push({ h: 14, cells: [{ v: spec.group[1], span: WN, size: 10, bold: true, align: "center" }] });
      if (kind && en) push({ h: 11, cells: [{ v: KIND_EN[kind], span: WN, size: 7.5, bold: true, align: "center" }] });
      if (kind) push({ h: 15, cells: [{ v: KIND_CN[kind], span: WN, size: 10, bold: true, align: "center" }] });
      if (en) push({ h: 22, cells: [{ v: "Answer", span: WN, size: 18, bold: true, align: "center" }] });
      push({ h: 34, cells: [{ v: "答    案", span: WN, size: 24, align: "center" }] });
      push({ h: 6, cells: [] });
    } else {
      push({ h: 28, cells: [{ v: `${spec.title} · 答案`, span: WN, size: 15, bold: true, align: "center" }] });
      push({ h: 16, cells: [{ v: spec.level, span: WN, size: 10, align: "center" }] });
      push({ h: 6, cells: [] });
    }
  };
  const kinds = [...new Set(secs.map((g) => g.sec.kind))];
  if (!comp) header();
  const no: Record<string, number> = { addsub: 0, mul: 0, div: 0 };
  kinds.forEach((kind, ki) => {
    if (comp) { if (ki > 0) breakPage(); header(kind); }
    else push({ h: 20, cells: [{ v: KIND_LABEL[kind], span: 10, size: 12, bold: true, align: "left" }] });
    const ks = secs.filter((g) => g.sec.kind === kind);
    if (kind === "addsub") {
      for (const { sec, problems } of ks) {
        if (sec.resetNo) no.addsub = 0;
        const ps = problems as AddsubProblem[];
        const per = Math.max(...ps.flatMap((p) => p.texts.map((t) => t.length))) <= 6 ? 10 : 5, span = WN / per;
        const maxLen = Math.max(...ps.map((p) => tlen(p.answer)));
        const fs = Math.min(13, fitFont(F, span * WCW, maxLen));
        const ah = Math.max(20, fs * 1.6);
        for (let b = 0; b < ps.length; b += per) {
          if (!fits(13 + ah + 6)) { breakPage(); if (comp) header(kind); }
          const band = ps.slice(b, b + per);
          const hc: (CellSpec | undefined)[] = [], ac: (CellSpec | undefined)[] = [];
          band.forEach((p, i) => {
            hc[i * span] = { v: ++no.addsub, span, size: 8, align: "center", border: BOX };
            ac[i * span] = { v: p.answer, span, size: fs, align: "right", border: BOX, num: true };
          });
          push({ h: 13, cells: hc }); push({ h: ah, cells: ac }); push({ h: 6, cells: [] });
        }
      }
    } else {
      // 同一项目的所有题(跨张连续编号),每页最多 120 题 = 4 组 × 30 行,组内竖排
      const list: { n: number; ans: string; places: number }[] = [];
      for (const { sec, problems } of ks) {
        if (sec.resetNo) no[kind] = 0;
        const places = sec.kind === "addsub" ? 0 : sec.places;
        for (const p of problems) list.push({ n: ++no[kind], ans: p.answer, places });
      }
      const maxLen = Math.max(...list.map((x) => tlen(x.ans)));
      const fs = Math.min(13, fitFont(F, 12 * WCW, maxLen));
      for (let c0 = 0; c0 < list.length; c0 += 120) {
        const chunk = list.slice(c0, c0 + 120);
        const R = comp ? Math.min(30, Math.ceil(chunk.length / 4)) : Math.ceil(chunk.length / 4);
        let rh = Math.max(16, Math.min(24, fs * 1.6));
        if (!fits(14 + R * 16)) { breakPage(); if (comp) header(kind); }
        if (comp) rh = Math.max(16, Math.min(24, (PH - used - 14 - 8 - 4) / R));
        // 栏上方:保留几位小数(相邻同样的栏合并成一格)
        const note: (CellSpec | undefined)[] = [];
        let g = 0;
        while (g < 4) {
          const pl = chunk[g * R]?.places ?? 0;
          let e = g + 1;
          while (e < 4 && chunk[e * R] && chunk[e * R].places === pl) e++;
          if (pl && chunk[g * R]) note[g * 15] = { v: placesNote(pl), span: (e - g) * 15, size: 7.5, align: "left" };
          g = e;
        }
        push({ h: 14, cells: note });
        for (let r = 0; r < R; r++) {
          const c: (CellSpec | undefined)[] = [];
          for (let k = 0; k < 4; k++) {
            const x = chunk[k * R + r];
            if (!x) continue;
            c[k * 15] = { v: x.n, span: 3, size: 7.5, align: "left", border: BOX };
            c[k * 15 + 3] = { v: x.ans, span: 12, size: fs, align: "right", border: BOX, num: true };
          }
          push({ h: rh, cells: c });
        }
        push({ h: 8, cells: [] });
      }
    }
  });
  return { name: "答案", cols: Array(WN).fill(WCW), rows, scale: 1, font: font ?? "hand" };
}

// ---------- 世界珠心算比赛样卷版式(2026-10-25,对照第九届模拟题样卷)----------
// 60 列细网格(每列约 9pt);每个部分独占一页,页眉 = 中英标题 + 组别 + 单位/姓名/考号 + 成绩表(本页/合计),第一页左上放扫码看答案。
// 加减:10 行以内短数每行 10 题、长数每行 5 题;乘除:cols 栏 × 30 行,按栏竖排编号(1–30 | 31–60 …),题量每张固定。
const WN = 60, WCW = PW / WN;
// 实际网格再细一倍(120 列,每列约 4.5pt):乘除一栏能按字数精细分配「两个数 + 答题位」;页眉、加减仍按 60 列写,push 时自动换算
const FN = WN * 2, FCW = PW / FN;
const widen = (r: RowSpec): RowSpec => {
  const cells: (CellSpec | undefined)[] = [];
  r.cells.forEach((c, i) => { if (c) cells[i * 2] = { ...c, span: (c.span ?? 1) * 2 }; });
  return { ...r, cells };
};
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
const W_KIND_EN = { addsub: "Addition-and-Subtraction Calculation", mul: "Multiplication Calculation", div: "Division Calculation" } as const;

function waamaQuestion(spec: ExamSpec, secs: GenSection[], opts: ExamLayoutOpts): SheetSpec {
  const F = opts.fontPt;
  const rows: RowSpec[] = [];
  let used = 0;
  const pushFine = (r: RowSpec) => { rows.push(r); used += r.h; };
  const push = (r: RowSpec) => pushFine(widen(r));
  let qrRow = 0;
  const seen = new Set<string>();
  secs.forEach(({ sec, problems }, si) => {
    if (si > 0) { rows[rows.length - 1].brk = true; used = 0; }
    const firstOfKind = !seen.has(sec.kind); seen.add(sec.kind);
    // ① 页眉
    const en = spec.style === "waama"; // 世界比赛中英双语;全国比赛只有中文
    if (en) push({ h: 12, cells: [{ v: "Sample Examination Questions of the Mental Arithmetic Competition", span: WN, size: 8.5, align: "center" }] });
    push({ h: 22, cells: [{ v: `${spec.title}${opts.setNo ? `（${opts.setNo}）` : ""}`, span: WN, size: 15, bold: true, align: "center" }] });
    if (spec.group) {
      if (spec.group[0]) push({ h: 11, cells: [{ v: spec.group[0], span: WN, size: 8, align: "center" }] });
      push({ h: 14, cells: [{ v: spec.group[1], span: WN, size: 10, bold: true, align: "center" }] });
    }
    const info: (CellSpec | undefined)[] = [];
    const lab = (i: number, v: string) => { info[i] = { v, span: 4, size: 9, bold: true, align: "center", border: BOX }; };
    const blank = (i: number, span: number) => { info[i] = { v: "", span, size: 9, align: "left", border: BOX }; };
    lab(0, "单位"); blank(4, 12); lab(16, "姓名"); blank(20, 10); lab(30, "考号"); blank(34, 7);
    if (firstOfKind && sec.minutes) info[41] = { v: `${en ? `${sec.minutes} minutes for this page  ` : ""}限时 ${sec.minutes} 分钟`, span: 19, size: 7.5, bold: true, align: "right" };
    push({ h: 20, cells: info });
    push({ h: 6, cells: [] });
    // ② 成绩表(右)+ 部分标题(左);第一页左边放二维码
    const roman = ROMAN[sheetNo(sec.title)] ?? "";
    const places = sec.kind === "addsub" ? 0 : sec.places;
    const T0 = 24, heads = ["计算题", "错题", "对题", "初评", "复核", "成绩"];
    const tStart = rows.length;
    for (let i = 0; i < 3; i++) {
      const c: (CellSpec | undefined)[] = [];
      const showRow = i < 2 || firstOfKind;
      if (showRow) {
        c[T0] = { v: ["", "本页", "合计"][i], span: 6, size: 9, bold: true, align: "center", border: i ? BOX : undefined };
        heads.forEach((h, k) => { c[T0 + 6 + k * 5] = { v: i === 0 ? h : "", span: 5, size: 9, bold: i === 0, align: "center", border: BOX }; });
      }
      const L = si === 0 ? 7 : 0; // 第一页左侧 0–6 列是二维码
      if (i === 0 && en) c[L] = { v: `${W_KIND_EN[sec.kind]}${roman ? ` (${roman})` : ""}`, span: T0 - L, size: 8, align: "left" };
      if (i === 1) c[L] = { v: sec.title, span: T0 - L, size: 12, bold: true, align: "left" };
      if (i === 2 && places) c[L] = { v: placesNote(places), span: T0 - L, size: 7.5, align: "left" };
      push({ h: 18, cells: c });
    }
    if (si === 0) qrRow = tStart;
    push({ h: 8, cells: [] });
    const avail = PH - used - 2;

    // ③ 题目
    if (sec.kind === "addsub") {
      const ps = problems as AddsubProblem[];
      const maxLen = Math.max(...ps.flatMap((p) => p.texts.map(tlen)));
      const per = Math.max(...ps.flatMap((p) => p.texts.map((t) => t.length))) <= 6 ? 10 : 5, span = WN / per; // 每排几题按样卷(字符数)不变
      const bands = Math.ceil(ps.length / per);
      // 每一横排按本排题目的行数排(2026-10-26 付海东「第一行排版不对」:精英组前 5 题 15 行、后 5 题 20 行,
      // 之前两排都按 20 行画,第一排空出 5 行;样题是各排各自的行数、答题格紧跟在最后一行下面)
      const bandRows = Array.from({ length: bands }, (_, b) => Math.max(...ps.slice(b * per, b * per + per).map((p) => p.terms.length)));
      const hdrH = 14, ansH = 26, gap = 4; // 答案格 26pt:留够写字的高度(教练反馈写字位置太小)
      // 行高铺满整页(和样卷一样整张排满),字号只受「字号」设置和格子大小限制
      const termH = (avail - bands * (hdrH + ansH + gap)) / bandRows.reduce((a, b) => a + b, 0);
      const fs = capFs(opts, "num", Math.min(F, termH / 1.3, fitFont(F, span * WCW, maxLen)));
      for (let b = 0; b < bands; b++) {
        const band = ps.slice(b * per, b * per + per);
        const hc: (CellSpec | undefined)[] = [];
        band.forEach((_, i) => { hc[i * span] = { v: b * per + i + 1 + counterBase(secs, si), span, size: 9, align: "center", border: BOX }; });
        push({ h: hdrH, cells: hc });
        for (let k = 0; k < bandRows[b]; k++) {
          const c: (CellSpec | undefined)[] = [];
          band.forEach((p, i) => { c[i * span] = { v: p.texts[k] ?? "", span, size: fs, align: "right", border: ["l", "r"], num: true }; });
          push({ h: termH, cells: c });
        }
        const ac: (CellSpec | undefined)[] = [];
        band.forEach((_, i) => { ac[i * span] = { v: "", span, size: fs, align: "right", border: BOX }; });
        push({ h: ansH, cells: ac });
        push({ h: gap, cells: [] });
      }
    } else {
      const ps = problems as MdProblem[];
      const op = sec.kind === "mul" ? "×" : "÷";
      const nc = sec.cols ?? 2, block = FN / nc, perCol = Math.ceil(ps.length / nc);
      const lenA = Math.max(...ps.map((p) => tlen(p.a))), lenB = Math.max(...ps.map((p) => tlen(p.b)));
      const lenC = Math.max(...ps.map((p) => p.answer.length));
      // 一栏(120 列网格):序号 4 | 算式「a × b =」| 答题位
      // 2026-10-25 教练「留的位置要够写字」(圈出样卷「=」后面那块空白):答题位按最长答案的字数分,且至少占一栏宽度的 30%(样卷约 1/4)
      const NO = 4, room = block - NO;
      const wc = Math.max(Math.round((room * lenC) / (lenA + lenB + lenC + 3)), Math.ceil(block * (nc >= 4 ? 0.25 : 0.3))); // 4 栏(A4 上很挤)答题位至少 1/4,2 栏至少 3 成
      // 宽度一律取偶数格(9pt 的整数倍):和页眉的列边界对齐,导出 Excel 时不会冒出 4.5pt 的细列(手机 WPS 会按自己的规则取整、打乱宽度)
      const wc0 = 2 * Math.ceil(wc / 2);
      const W = (room - wc0) * FCW;
      const rowH = avail / perCol;
      const fs = capFs(opts, "num", fitMdFs(Math.min(F, rowH / 1.45, mdFsMax(W, ps)), W, ps, "hand", FCW, 2));
      const geo = mdGeo(fs, W, ps, opts.font ?? "hand");
      const base = counterBase(secs, si);
      for (let r = 0; r < perCol; r++) {
        const c: (CellSpec | undefined)[] = [];
        for (let k = 0; k < nc; k++) {
          const idx = k * perCol + r, p = ps[idx];
          if (!p) continue;
          const x = k * block;
          c[x] = { v: base + idx + 1, span: NO, size: 7.5, align: "center", border: BOX };
          exprCells(c, x + NO, x + block, FCW, 2, p, op, geo);
        }
        pushFine({ h: rowH, cells: c });
      }
    }
  });
  return { name: "试题", cols: Array(FN).fill(FCW), rows, scale: 1, font: opts.font ?? "hand", qr: { r: qrRow, c: 0, rows: 3, cols: 14, caption: 3 } };
}
const sheetNo = (title: string) => { const m = title.match(/（(.)）/); return m ? ["", "一", "二", "三", "四", "五", "六"].indexOf(m[1]) : 0; };
/** 同一项目前面几张已经出到第几题(题号跨张连续:加减 31–50、乘 121–240) */
const counterBase = (secs: GenSection[], si: number) => secs.slice(0, si).filter((g) => g.sec.kind === secs[si].sec.kind).reduce((n, g) => n + g.problems.length, 0);

/** 扫码页用的答案清单(带「加减 1」这样的标签) */
export function examAnswerList(gen: GenSection[], only?: ExamLayoutOpts["only"]): { labels: string[]; answers: string[]; exprs: string[] } {
  const labels: string[] = [], answers: string[] = [], exprs: string[] = [];
  const n: Record<string, number> = { addsub: 0, mul: 0, div: 0 };
  for (const { sec, problems } of gen) {
    if (only && sec.kind !== only) continue;
    if (sec.resetNo) n[sec.kind] = 0;
    const set = sec.resetNo ? (sec.title.match(/第\d+套/)?.[0] ?? "") : "";
    for (const p of problems) {
      labels.push(`${set}${KIND_LABEL[sec.kind].replace("算", "")} ${++n[sec.kind]}`);
      answers.push(p.answer);
      exprs.push(p.kind === "addsub" ? p.texts.join(" ").replace(/ -/g, " − ") : `${p.a} ${p.kind === "mul" ? "×" : "÷"} ${p.b}`);
    }
  }
  return { labels, answers, exprs };
}
