// 打印试题(2026-10-25 用户:课堂演示「开始演示」下面加「打印试题」→ 生成 Excel,用户自己打印;右上角二维码扫码看答案,教练和学生都能扫)
// 版式参考教练发来的 .xls(乘法_2位乘3位 / 除法_除2位商2位 / 加减算_3-3位10笔):
//   乘除:标题 + 考号/单位 + 姓名/得分,题目 3 组并排(序号 | 数 | ╳/÷ | 数 | = | 答题格),第二张表是答案;
//   加减:姓名/用时/得分,每 8 题一排竖式((1)…(8),减数写负号),下面留答题格;第二张表是答案。
// 答案存一条 scores(game='hw', mode='paper'),二维码 = https://superbrainlab.org/key/<id>(公开可读,不用登录);
// 存不上(没登录/断网)就把答案直接编进二维码链接(/key#…)。
import { writeToDir, type DirHandle } from "@/lib/saveDir";
import { supabase } from "@/integrations/supabase/client";
import { answerText, itemLabel, type HwItem, type HwProblem } from "@/lib/homework";

// 二维码给手机扫,指线上;2026-11-08 印度 WiFi 拦主域名(备用地址能开):从备用地址 *.netlify.app 出的卷,二维码也指备用地址
export const KEY_ORIGIN = typeof location !== "undefined" && /\.netlify\.app$/.test(location.hostname) ? location.origin : "https://superbrainlab.org";

export interface PaperKey { title: string; label: string; kind: "md" | "addsub"; answers: string[]; exprs: string[]; labels?: string[] }

const num = (t: number, places?: number): string => (places ? Math.abs(t).toFixed(places) : String(Math.abs(t)));
const answerOf = (p: HwProblem): string => answerText(p.answer, p.rem, (x) => (p.places ? x.toFixed(p.places) : String(x))); // 小数保留位数照写(2.70 不写成 2.7)
const exprOf = (p: HwProblem): string =>
  p.op ? `${num(p.terms[0], undefined)} ${p.op} ${num(p.terms[1], undefined)}` : p.terms.map((t, i) => (i === 0 ? num(t, p.places) : `${p.signs[i] === "-" ? "−" : "+"} ${num(t, p.places)}`)).join(" ");

/** 试卷标题(仿参考件):2位×3位乘算练习 / ÷2位=2位除算练习 / 加减算 3-3位10笔 */
export function paperTitle(it: HwItem): string {
  if (it.op === "mul") return `${it.mulA}位×${it.mulB}位乘算练习${it.decimals ? "(小数)" : ""}`;
  if (it.op === "div") return `÷${it.divD}位=${it.divQ}位除算练习${it.divEnough === "no" ? (it.decimals ? "(不够除)" : "(带余数)") : ""}${it.decimals ? "(小数)" : ""}`;
  const d = it.digitsMax > it.digits ? `${it.digits}-${it.digitsMax}` : `${it.digits}-${it.digits}`;
  return `加减算 ${d}位${it.count}笔`;
}

export const canPrint = (it: HwItem): boolean => it.project !== "bead";

/** 把答案存起来,返回扫码链接 */
export async function savePaperKey(it: HwItem, problems: HwProblem[]): Promise<string> {
  return saveAnswerKey({
    title: paperTitle(it), label: itemLabel(it), kind: it.op === "addsub" ? "addsub" : "md",
    answers: problems.map(answerOf), exprs: problems.map(exprOf),
  });
}
/** 答案页按试卷顺序分块(2026-10-31 布施「答案是不是竖着下来好一点,横着排跟试卷顺序不一样,对答案难受」):
 *  按题号标签分部分(加减 / 乘 / 除 / 第N套…);乘除试卷是竖排(左栏 1–25、右栏 26–50)→ vertical;加减试卷是横排 → 不竖排。 */
export interface AnswerGroup { title: string; idx: number[]; vertical: boolean }
export function answerGroups(n: number, labels: string[] | undefined, kind: "addsub" | "md"): AnswerGroup[] {
  const out: AnswerGroup[] = [];
  for (let i = 0; i < n; i++) {
    const title = labels?.[i]?.replace(/\s*\d+$/, "") ?? "";
    const last = out[out.length - 1];
    if (last && last.title === title) last.idx.push(i);
    else out.push({ title, idx: [i], vertical: title ? !title.includes("加减") : kind !== "addsub" });
  }
  return out;
}

/** 存答案,返回扫码链接(出题系统也用):登录了存 scores(game='hw', mode='paper'),否则把答案编进链接 */
export async function saveAnswerKey(key: PaperKey): Promise<string> {
  try {
    const me = (await supabase.auth.getSession()).data.session?.user.id;
    if (!me) throw new Error("no-login");
    const { data, error } = await supabase.from("scores").insert({ user_id: me, game: "hw", mode: "paper", value: key.answers.length, meta: key as never }).select("id").single();
    if (error || !data) throw error ?? new Error("no-id");
    return `${KEY_ORIGIN}/key/${data.id}`;
  } catch {
    // 兜底:只编答案(不编算式),链接短一些、二维码好扫
    const payload = JSON.stringify({ t: key.title, k: key.kind, a: key.answers, l: key.labels });
    return `${KEY_ORIGIN}/key#${b64url(payload)}`;
  }
}
const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unB64url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

/** 读答案(扫码页用):id → scores 行;无 id → 解 hash */
export async function loadPaperKey(id: string | undefined, hash: string): Promise<(PaperKey & { createdAt?: string }) | null> {
  if (id) {
    const { data } = await supabase.from("scores").select("meta,created_at").eq("id", id).eq("game", "hw").eq("mode", "paper").maybeSingle();
    if (!data?.meta) return null;
    const m = data.meta as unknown as PaperKey;
    return { ...m, answers: m.answers ?? [], exprs: m.exprs ?? [], createdAt: data.created_at };
  }
  try {
    const o = JSON.parse(unB64url(hash.replace(/^#/, ""))) as { t: string; k: PaperKey["kind"]; a: string[]; l?: string[] };
    return { title: o.t, label: "", kind: o.k, answers: o.a, exprs: [], labels: o.l };
  } catch { return null; }
}

export function qrDataUrl(text: string): Promise<string> {
  return import("qrcode-generator").then(({ default: qrcode }) => {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    return q.createDataURL(8, 2); // GIF
  });
}

const stamp = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`; };

// ===== 版面模型(预览和 Excel 共用同一份:列宽/行高/分页/缩放都在这里算,预览所见 = 打印所得)=====
// 2026-10-25 用户「点打印试题后先出 A4 预览,能改题量和字号,实时更新,再确认下载」
export interface PaperOpts { fontPt: number; font?: "hand" | "hei" }
export const defaultFontPt = (it: HwItem): number => (it.op === "addsub" ? 12 : 14);
/** A4(pt)与页边距:左右 0.4in、上下 0.5in */
export const A4 = { w: 595.3, h: 841.9, mx: 28.8, my: 36 };
// 2026-10-25 用户「全国比赛和世界比赛的题用 B4 纸,能否 A4、B4 两种自适应」:
// 版面一律按 A4 排,B4 整页等比放大(B4 与 A4 长宽比几乎相同,k≈1.224)→ 预览、打印、Excel(打印缩放 122%)三处一致。
// B4 取国内打印店常用的 JIS B4 257×364mm(Excel paperSize 12)。
export type PaperSize = "A4" | "B4";
export const PAPERS: Record<PaperSize, { w: number; h: number; k: number; xl: number; mm: [number, number] }> = {
  A4: { w: 595.3, h: 841.9, k: 1, xl: 9, mm: [210, 297] },
  B4: { w: 728.5, h: 1031.8, k: 728.5 / 595.3, xl: 12, mm: [257, 364] },
};
/** 纸张尺寸 + 等比放大后的页边距(pt) */
export const paperGeom = (p?: PaperSize) => { const P = PAPERS[p ?? "A4"]; return { w: P.w, h: P.h, mx: A4.mx * P.k, my: A4.my * P.k }; };
/** 把按 A4 排好的版面放到指定纸张上(B4 = 整页放大) */
export const onPaper = (sheets: SheetSpec[], paper: PaperSize): SheetSpec[] => (paper === "A4" ? sheets : sheets.map((s) => ({ ...s, paper, scale: s.scale * PAPERS[paper].k })));
const PW = A4.w - 2 * A4.mx, PH = A4.h - 2 * A4.my;
type Edge = "t" | "b" | "l" | "r";
/** num = 题目数字/答案(用卷面字体:手写体或黑体);其余(标题、表头、题号)一律普通字体 */
/** dx:预览 / PDF 里文字在对齐位置上再水平平移 dx pt(乘除算式等距排版用,允许稍微越出格子;Excel 只按格子对齐) */
export interface CellSpec { v: string | number; span?: number; size: number; bold?: boolean; align: "left" | "center" | "right"; border?: Edge[]; num?: boolean; dx?: number }
export interface RowSpec { h: number; cells: (CellSpec | undefined)[]; brk?: boolean }
/** font:hand = 手写体数字(站内 ZHKJ Number,同 App 题面);hei = 黑体。鉴定标准:「正文字体通常采用国际通用的手写体或黑体」 */
export type PaperFont = "hand" | "hei";
export interface SheetSpec { name: string; cols: number[]; rows: RowSpec[]; scale: number; font?: PaperFont; paper?: PaperSize; qr?: { r: number; c: number; rows: number; cols: number; caption: number; url?: string } }
const BOX: Edge[] = ["t", "b", "l", "r"];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const maxLen = (xs: string[]) => Math.max(1, ...xs.map((x) => x.length));
const DIGIT = 0.72; // 手写体数字 0.635em + 字距 0.08em(2026-10-26 改:原按 Arial 0.6em 估,大字号时长数会溢出被裁)
/** 按页容量切分:返回每页条目数 */
function paginate(total: number, firstCap: number, cap: number): number[] {
  const out: number[] = []; let left = total, c = Math.max(1, firstCap);
  while (left > 0) { const k = Math.min(left, c); out.push(k); left -= k; c = Math.max(1, cap); }
  return out.length ? out : [0];
}

function mdSheets(it: HwItem, ps: HwProblem[], F: number, title: string): SheetSpec[] {
  const sym = it.op === "mul" ? "×" : "÷"; // 2026-10-25 用户「乘号太大,有点生硬」:参考件的 ╳(制表符)换成标准乘号 ×
  const A = ps.map((p) => num(p.terms[0])), B = ps.map((p) => num(p.terms[1])), ANS = ps.map(answerOf);
  const w = [Math.max(14, F * 1.1), maxLen(A) * F * DIGIT + 8, F * 1.1, maxLen(B) * F * DIGIT + 8, F, Math.max(F * 3, maxLen(ANS) * F * DIGIT + 12)];
  // 字号大了一行放不下 3 组 → 改 2 组(题目多翻页,字是真的变大);2 组还放不下才整体缩
  const G = 3 * sum(w) <= PW ? 3 : 2;
  let total = G * sum(w);
  if (total < PW) { w[5] += (PW - total) / G; total = PW; } // 页宽有富余 → 加给答题格(写字空间)
  const scale = Math.min(1, PW / total);
  const cols = Array.from({ length: G }, () => w).flat();
  const NC = 6 * G, QC = 4; // 右上角二维码占最后 4 列
  const usable = PH / scale, rowH = F * 1.75;
  const probRow = (withAns: boolean, pg: { per: number; count: number }, row: number, start: number): RowSpec => {
    const cells: (CellSpec | undefined)[] = [];
    for (let g = 0; g < G; g++) {
      const k = start + g * pg.per + row;
      if (g * pg.per + row >= pg.count) continue; // 本页最后一组可能不满
      const c = g * 6;
      cells[c] = { v: k + 1, size: F * 0.7, align: "center", border: BOX }; // 序号单独一格,右边竖线和题目隔开(2026-10-25 用户)
      cells[c + 1] = { v: A[k], size: F, align: "right", border: ["t", "b"], num: true };
      cells[c + 2] = { v: sym, size: F * 0.85, align: "center", border: ["t", "b"] }; // 运算符比数字略小,不抢眼
      cells[c + 3] = { v: B[k], size: F, align: "right", border: ["t", "b"], num: true }; // 右对齐,等号紧跟(2026-10-25 用户「等号靠左一些」)
      cells[c + 4] = { v: "=", size: F, align: "left", border: ["t", "b"] };
      cells[c + 5] = { v: withAns ? ANS[k] : "", size: F, bold: withAns, align: "center", border: BOX, num: true };
    }
    return { h: rowH, cells };
  };
  const build = (withAns: boolean): SheetSpec => {
    const rows: RowSpec[] = [];
    let qr: SheetSpec["qr"];
    if (!withAns) {
      const fieldH = Math.max(22, F * 1.8), fs = Math.max(10, Math.min(16, F * 0.85));
      rows.push({ h: Math.max(28, F * 2), cells: [{ v: title, span: NC - QC, size: Math.max(14, Math.min(24, F * 1.25)), bold: true, align: "center" }] });
      rows.push({ h: fieldH, cells: [{ v: "考号______________    单位________________", span: NC - QC, size: fs, align: "left" }] });
      rows.push({ h: fieldH, cells: [{ v: "姓名______________    得分________________", span: NC - QC, size: fs, align: "left" }] });
      rows.push({ h: 12, cells: Object.assign([], { [NC - QC]: { v: "扫码看答案", span: QC, size: 8, align: "center" } as CellSpec }) });
      qr = { r: 0, c: NC - QC, rows: 3, cols: QC, caption: 3 };
    } else {
      rows.push({ h: Math.max(26, F * 1.8), cells: [{ v: `${title} · 答案`, span: NC, size: Math.max(13, Math.min(22, F * 1.1)), bold: true, align: "center" }] });
    }
    const headerH = sum(rows.map((r) => r.h));
    // 每页按「列优先」排:本页 per 行 × G 组(第 1–20 题在第一组…),和参考件一致
    const pages = paginate(Math.ceil(ps.length / G), Math.floor((usable - headerH) / rowH), Math.floor(usable / rowH));
    let start = 0;
    pages.forEach((per, pi) => {
      const count = Math.min(ps.length - start, per * G);
      const pg = { per: Math.ceil(count / G), count };
      for (let r = 0; r < pg.per; r++) rows.push(probRow(withAns, pg, r, start));
      if (pi < pages.length - 1) rows[rows.length - 1].brk = true;
      start += count;
    });
    return { name: withAns ? (it.op === "mul" ? "乘算答案" : "除算答案") : (it.op === "mul" ? "乘算题" : "除算题"), cols, rows, scale, qr };
  };
  return [build(false), build(true)];
}

function addsubSheets(ps: HwProblem[], F: number, title: string): SheetSpec[] {
  const T = ps.map((p) => p.terms.map((t, k) => (p.signs[k] === "-" ? "-" : "") + num(t, p.places)));
  const ANS = ps.map(answerOf);
  const need = Math.max(F * 3, maxLen([...T.flat(), ...ANS]) * F * DIGIT + 12);
  // 默认每排 8 题(参考件);字号大了放不下就少放几题(最少 4),字是真的变大
  const COLS = Math.max(4, Math.min(8, Math.floor(PW / need)));
  const colW = Math.max(need, PW / COLS);
  const scale = Math.min(1, PW / (COLS * colW));
  const cols = Array(COLS).fill(colW);
  const usable = PH / scale;
  const nTerms = Math.max(...ps.map((p) => p.terms.length));
  const hdrH = F * 1.6, termH = F * 1.3, ansH = F * 2.2, gapH = F * 0.8;
  const build = (withAns: boolean): SheetSpec => {
    const rows: RowSpec[] = [];
    let qr: SheetSpec["qr"];
    if (!withAns) {
      rows.push({ h: Math.max(30, F * 2.6), cells: [{ v: title, span: COLS - 2, size: Math.max(14, Math.min(24, F * 1.3)), bold: true, align: "left" }] });
      rows.push({ h: Math.max(30, F * 2.6), cells: [{ v: "姓名_____________     用时________     得分_____", span: COLS - 2, size: Math.max(11, Math.min(18, F * 1.05)), align: "left" }] });
      rows.push({ h: 12, cells: Object.assign([], { [COLS - 2]: { v: "扫码看答案", span: 2, size: 8, align: "center" } as CellSpec }) });
      qr = { r: 0, c: COLS - 2, rows: 2, cols: 2, caption: 2 };
    } else {
      rows.push({ h: Math.max(26, F * 2), cells: [{ v: `${title} · 答案`, span: COLS, size: Math.max(13, Math.min(22, F * 1.2)), bold: true, align: "center" }] });
    }
    const bandH = hdrH + (withAns ? 0 : nTerms * termH) + ansH + gapH;
    const headerH = sum(rows.map((r) => r.h));
    const bands = Math.ceil(ps.length / COLS);
    const pages = paginate(bands, Math.floor((usable - headerH) / bandH), Math.floor(usable / bandH));
    let b = 0;
    pages.forEach((nb, pi) => {
      for (let q = 0; q < nb; q++, b++) {
        const idx = (c: number) => b * COLS + c;
        const hdr: (CellSpec | undefined)[] = [];
        for (let c = 0; c < COLS; c++) if (idx(c) < ps.length) hdr[c] = { v: `(${idx(c) + 1})`, size: F * 0.9, bold: true, align: "center", border: BOX };
        rows.push({ h: hdrH, cells: hdr });
        if (!withAns) for (let k = 0; k < nTerms; k++) {
          const cells: (CellSpec | undefined)[] = [];
          for (let c = 0; c < COLS; c++) if (idx(c) < ps.length) cells[c] = { v: T[idx(c)][k] ?? "", size: F, align: "right", border: ["l", "r"], num: true };
          rows.push({ h: termH, cells });
        }
        const ans: (CellSpec | undefined)[] = [];
        for (let c = 0; c < COLS; c++) if (idx(c) < ps.length) ans[c] = { v: withAns ? ANS[idx(c)] : "", size: F * 1.05, bold: true, align: "right", border: BOX, num: true };
        rows.push({ h: ansH, cells: ans });
        rows.push({ h: gapH, cells: [] });
      }
      if (pi < pages.length - 1) rows[rows.length - 1].brk = true;
    });
    return { name: withAns ? "加减算答案" : "加减算题", cols, rows, scale, qr };
  };
  return [build(false), build(true)];
}

/** 试题 + 答案两张表的版面 */
export function paperSheets(it: HwItem, problems: HwProblem[], opts: PaperOpts): SheetSpec[] {
  const F = Math.max(8, Math.min(32, opts.fontPt));
  return it.op === "addsub" ? addsubSheets(problems, F, paperTitle(it)) : mdSheets(it, problems, F, paperTitle(it));
}
/** 一张表按分页符切成若干页(预览用) */
export function sheetPages(sh: SheetSpec): RowSpec[][] {
  const pages: RowSpec[][] = [[]];
  for (const r of sh.rows) { pages[pages.length - 1].push(r); if (r.brk) pages.push([]); }
  return pages.filter((p) => p.length);
}

/** 生成 Excel(试题 + 答案两张表),返回 Blob、字节和文件名 */
export async function buildPaperXlsx(it: HwItem, problems: HwProblem[], keyUrl: string, opts: PaperOpts = { fontPt: defaultFontPt(it) }): Promise<{ blob: Blob; filename: string; bytes: ArrayBuffer }> {
  return sheetsToXlsx(paperSheets(it, problems, opts).map((x) => ({ ...x, font: opts.font })), keyUrl, paperTitle(it));
}
/** 合并从不被单独用到的细网格列(2026-10-26:120 列每列不到 1 个字宽,手机 WPS 按自己的规则取整 → 总宽失真、被切页)。
 *  只保留单元格 / 二维码真正用到的列边界,列数通常降到几十、每列都够宽,换算误差小得多;版面几何完全不变。 */
export function compactCols(sh: SheetSpec): SheetSpec {
  const N = sh.cols.length;
  const B = new Set<number>([0, N]);
  for (const r of sh.rows) r.cells.forEach((c, i) => { if (c) { B.add(i); B.add(Math.min(N, i + (c.span ?? 1))); } });
  if (sh.qr) { B.add(sh.qr.c); B.add(sh.qr.c + sh.qr.cols); }
  const bs = [...B].sort((a, b) => a - b);
  if (bs.length - 1 === N) return sh;
  const at = new Map(bs.map((b, k) => [b, k]));
  const cols = bs.slice(0, -1).map((b, k) => sh.cols.slice(b, bs[k + 1]).reduce((x, y) => x + y, 0));
  const rows = sh.rows.map((r) => {
    const cells: (CellSpec | undefined)[] = [];
    r.cells.forEach((c, i) => { if (c) { const s0 = at.get(i)!, s1 = at.get(Math.min(N, i + (c.span ?? 1)))!; cells[s0] = { ...c, span: s1 - s0 }; } });
    return { ...r, cells };
  });
  const qr = sh.qr && { ...sh.qr, c: at.get(sh.qr.c)!, cols: at.get(sh.qr.c + sh.qr.cols)! - at.get(sh.qr.c)! };
  return { ...sh, cols, rows, qr };
}
/** pt → Excel 列宽(字符数)。默认字体最大数字宽 7px:宽 ≥1 字符时 像素 = 7×宽 + 5(每列自带 5px 边距);不足 1 字符时 像素 ≈ 12×宽 */
export const xlColWidth = (pt: number) => { const px = pt / 0.75; return px >= 12 ? (px - 5) / 7 : px / 12; };
/** Excel 列宽(字符数)→ 实际像素(与上式互逆,测试用) */
export const xlColPx = (w: number) => (w >= 1 ? 7 * w + 5 : 12 * w);
/** 版面(SheetSpec[])→ Excel;每张表一个工作表,有 qr 的表在指定区域放二维码 */
export async function sheetsToXlsx(sheets: SheetSpec[], keyUrl: string, titleBase: string): Promise<{ blob: Blob; filename: string; bytes: ArrayBuffer }> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "珠象";
  const thin = { style: "thin" as const, color: { argb: "FF555555" } };
  const qrImg = wb.addImage({ base64: (await qrDataUrl(keyUrl)).split(",")[1], extension: "gif" });
  for (const sh0 of sheets) {
    const sh = compactCols(sh0);
    const ws = wb.addWorksheet(sh.name);
    const g = paperGeom(sh.paper);
    // 2026-10-26 付海东「A4 纸装不下、打印出来 16 页」:旧算法列宽 = pt/5.25,没算 Excel 每列自带的 5px 边距,
    // 出题系统 120 列细网格 → 实际宽度差不多翻倍,右边被切成细条单独成页。现在:① 列宽按 Excel 公式精确换算;
    // ② 纸宽兜底:A4 用「宽度缩放到 1 页、高度按分页符」,B4 放大打印时留 2% 余量。
    const enlarge = sh.scale > 1.001;
    ws.pageSetup = { paperSize: PAPERS[sh.paper ?? "A4"].xl, orientation: "portrait", horizontalCentered: true,
      ...(enlarge ? { fitToPage: false, scale: Math.floor(sh.scale * 98) } : { fitToPage: true, fitToWidth: 1, fitToHeight: 0, scale: Math.max(10, Math.floor(sh.scale * 100)) }),
      margins: { left: g.mx / 72, right: g.mx / 72, top: g.my / 72, bottom: g.my / 72, header: 0.2, footer: 0.2 } };
    ws.columns = sh.cols.map((pt) => ({ width: xlColWidth(pt * 0.98) })); // 再留 2%:手机 WPS 等软件的默认字宽和 Excel 略有出入
    sh.rows.forEach((r, ri) => {
      const row = ws.getRow(ri + 1);
      row.height = r.h;
      r.cells.forEach((c, ci) => {
        if (!c) return;
        if (c.span && c.span > 1) ws.mergeCells(ri + 1, ci + 1, ri + 1, ci + c.span);
        const cell = ws.getCell(ri + 1, ci + 1);
        cell.value = typeof c.v === "string" && /^-?\d+$/.test(c.v) ? Number(c.v) : c.v;
        // 含中文的格子明确用黑体(2026-10-26 打印复查:写 Arial 时部分软件不回退中文字体,标题、姓名等中文整段打不出来)
        const cjk = typeof c.v === "string" && /[\u3000-\u9fff\uff00-\uffef]/.test(c.v);
        cell.font = { name: cjk || (c.num && sh.font === "hei") ? "SimHei" : "Arial", size: Math.round(c.size * 10) / 10, bold: !!c.bold, ...(cjk ? { charset: 134 } : {}) };
        cell.alignment = { vertical: "middle", horizontal: c.align };
        if (c.border?.length) {
          const b: Record<string, typeof thin> = {};
          for (const e of c.border) b[{ t: "top", b: "bottom", l: "left", r: "right" }[e]] = thin;
          // 合并格的边框要落到每个被合并的格上
          for (let k = 0; k < (c.span ?? 1); k++) ws.getCell(ri + 1, ci + 1 + k).border = b;
        }
      });
      if (r.brk) row.addPageBreak();
    });
    if (sh.qr) {
      const { r, c, rows, cols } = sh.qr;
      ws.mergeCells(r + 1, c + 1, r + rows, c + cols);
      const hPt = sum(sh.rows.slice(r, r + rows).map((x) => x.h)), wPt = sum(sh.cols.slice(c, c + cols));
      const side = Math.min(hPt, wPt) - 4; // pt
      const px = side / 0.75;
      // 放在合并区中间(锚点用列/行的小数位置)
      const offX = (wPt - side) / 2, offY = (hPt - side) / 2;
      const colAt = (pt: number) => { let k = c, acc = 0; while (k < sh.cols.length && acc + sh.cols[k] < pt) { acc += sh.cols[k]; k++; } return k + (pt - acc) / sh.cols[k]; };
      const rowAt = (pt: number) => { let k = r, acc = 0; while (k < sh.rows.length && acc + sh.rows[k].h < pt) { acc += sh.rows[k].h; k++; } return k + (pt - acc) / sh.rows[k].h; };
      const img = sh.qr.url ? wb.addImage({ base64: (await qrDataUrl(sh.qr.url)).split(",")[1], extension: "gif" }) : qrImg; // 多套题:每套各自的二维码
      ws.addImage(img, { tl: { col: colAt(offX), row: rowAt(offY) }, ext: { width: px, height: px } });
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { blob, bytes: buf as ArrayBuffer, filename: `${titleBase.replace(/[\\/:*?"<>| ·]/g, "_")}_${stamp()}.xlsx` };
}

/** 下载(网页);App 壳里走系统分享(WKWebView 不支持 a[download]) */
/** 交付文件。dir = prepareSaveDir() 拿到的文件夹(电脑版 Edge/Chrome)→ 直接写进去不弹窗;返回实际走的方式 */
export async function deliverFile(blob: Blob, filename: string, dir?: DirHandle | null): Promise<"dir" | "download" | "share"> {
  if (dir) {
    try { await writeToDir(dir, blob, filename); return "dir"; } catch { /* 写失败(文件夹被删等)→ 退回浏览器下载 */ }
  }
  // App 内(iOS/Android):WKWebView 不能 <a download>,网页分享也不一定支持文件 →
  // 用 Capacitor Filesystem 写到缓存目录,再弹系统分享面板(里面有「打印」「存储到文件」「微信」等)。2026-10-26
  if ((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const safe = filename.replace(/[\\/:*?"<>|]/g, "_");
    const { uri } = await Filesystem.writeFile({ path: safe, data: btoa(bin), directory: Directory.Cache });
    await Share.share({ title: filename, files: [uri] });
    return "share";
  }
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "download";
}
