// 出题系统(2026-10-25):题型库每一项都能出题,题量/位数/减号/中间和/乘除答案与舍入类别全部校验
import { describe, it, expect } from "vitest";
import { EXAM_TABS, type ExamSpec, type Section } from "@/lib/exam/specs";
import { genExam, genMdGroup, genAddsub, genMul, genDiv, type AddsubProblem, type MdProblem } from "@/lib/exam/generate";
import { examSheets, examAnswerList } from "@/lib/exam/layout";
import { sheetPages, sheetsToXlsx } from "@/lib/paper";
import ExcelJS from "exceljs";

const ALL = EXAM_TABS.flatMap((t) => t.groups.flatMap((g) => g.specs));
const units = (s: string) => { const t = s.replace(/,/g, ""); const k = t.includes(".") ? t.split(".")[1].length : 0; return { v: BigInt(t.replace(".", "")), k }; };
const fmt = (v: bigint, k: number) => { const neg = v < 0n; let s = (neg ? -v : v).toString(); if (k) { s = s.padStart(k + 1, "0"); s = `${s.slice(0, -k)}.${s.slice(-k)}`; } return (neg ? "-" : "") + s; };
const strip = (s: string) => s.replace(/,/g, "");

/** 精确重算乘/除答案(四舍五入到 places),并返回舍入类别 */
function check(p: MdProblem, places: number): { ok: boolean; cat: "exact" | "down" | "up" } {
  const A = units(p.a), B = units(p.b);
  let num: bigint, den: bigint, k: number;
  if (p.kind === "mul") { num = A.v * B.v; den = 1n; k = A.k + B.k; }
  else { num = A.v * 10n ** BigInt(B.k); den = B.v * 10n ** BigInt(A.k); k = 0; }
  // 值 = num / den / 10^k;算到 places+1 位
  const scaled = (num * 10n ** BigInt(places + 1)) / (den * 10n ** BigInt(k));
  const exactAtPlaces = (num * 10n ** BigInt(places)) % (den * 10n ** BigInt(k)) === 0n;
  const next = scaled % 10n;
  const rounded = scaled / 10n + (next >= 5n ? 1n : 0n);
  const want = exactAtPlaces ? (num * 10n ** BigInt(places)) / (den * 10n ** BigInt(k)) : rounded;
  const ansK = strip(p.answer).includes(".") ? strip(p.answer).split(".")[1].length : 0;
  const got = units(p.answer).v * 10n ** BigInt(places - ansK);
  return { ok: got === want, cat: exactAtPlaces ? "exact" : next >= 5n ? "up" : "down" };
}

describe("出题系统题型库", () => {
  it(`共 ${ALL.length} 个题型,每个都能出整套题、排版不报错、答案清单与题量一致`, () => {
    expect(ALL.length).toBeGreaterThanOrEqual(30); // 2026-10-25 下架珠心算各标准、薪火传承、应用模拟题、世界比赛全套后 32 个
    for (const spec of ALL) {
      const gen = genExam(spec);
      const sheets = examSheets(spec, gen, { fontPt: 13 });
      expect(sheetPages(sheets[0]).length, spec.id).toBeGreaterThan(0);
      const total = gen.reduce((s, g) => s + g.problems.length, 0);
      expect(examAnswerList(gen).answers.length, spec.id).toBe(total);
      gen.forEach(({ sec, problems }) => {
        const want = sec.kind === "addsub" ? sec.parts.reduce((s, p) => s + p.n, 0) : sec.groups.reduce((s, g) => s + g.combos.reduce((t, c) => t + c[2], 0), 0);
        expect(problems.length, `${spec.id} ${sec.title}`).toBe(want);
      });
    }
  }, 60_000);

  it("加减:每行位数分布、减号行数且不相邻、不放首行,中间和不为负,得数正确", () => {
    for (const spec of ALL) for (const { sec, problems } of genExam(spec)) {
      if (sec.kind !== "addsub") continue;
      let idx = 0;
      for (const part of sec.parts) for (let i = 0; i < part.n; i++) {
        const p = problems[idx++] as AddsubProblem;
        const lens: Record<number, number> = {};
        p.terms.forEach((t) => { const L = String(Math.abs(t)).length; lens[L] = (lens[L] ?? 0) + 1; });
        expect(lens, `${spec.id} #${idx}`).toEqual(Object.fromEntries(Object.entries(part.d).map(([k, v]) => [Number(k), v])));
        const minus = p.terms.map((t, j) => (t < 0 ? j : -1)).filter((j) => j >= 0);
        expect(minus.includes(0)).toBe(false);
        for (let j = 1; j < minus.length; j++) expect(minus[j] - minus[j - 1]).toBeGreaterThan(1);
        if (!part.reverse || i !== part.n - 1) { let run = 0; for (const t of p.terms) { run += t; expect(run, `${spec.id} #${idx} 中间和`).toBeGreaterThanOrEqual(0); } }
        const sum = p.terms.reduce((a, b) => a + b, 0);
        expect(strip(p.answer)).toBe(fmt(BigInt(sum), p.dec ? 2 : 0));
      }
    }
  }, 60_000);

  it("能手级倒减:第 10 题中间出负、得数为正;第 20 题得数为负", () => {
    const ns = ALL.find((s) => s.id === "zs2020-0")!;
    const add = genExam(ns)[0].problems as AddsubProblem[];
    const neg = (p: AddsubProblem) => { let r = 0, went = false; for (const t of p.terms) { r += t; if (r < 0) went = true; } return { went, r }; };
    expect(neg(add[9]).went).toBe(true); expect(neg(add[9]).r).toBeGreaterThan(0);
    expect(neg(add[19]).went).toBe(true); expect(neg(add[19]).r).toBeLessThan(0);
    expect(add.slice(0, 5).every((p) => p.dec && p.terms.length === 15)).toBe(true);
    expect(add.slice(5, 10).every((p) => !p.dec && p.terms.length === 20)).toBe(true);
  });

  it("乘除:答案精确(四舍五入到保留位),四舍/五入题数符合标准,整数题与除尽题为整数", () => {
    for (const spec of ALL) for (const { sec, problems } of genExam(spec)) {
      if (sec.kind === "addsub") continue;
      let k = 0;
      for (const g of sec.groups) {
        const n = g.combos.reduce((s, c) => s + c[2], 0);
        const cats = { exact: 0, down: 0, up: 0 };
        for (const p of problems.slice(k, k + n) as MdProblem[]) {
          const r = check(p, sec.places);
          expect(r.ok, `${spec.id} ${p.a}${p.kind === "mul" ? "×" : "÷"}${p.b}=${p.answer}`).toBe(true);
          cats[r.cat]++;
        }
        if (g.dec) { expect(cats.down, spec.id).toBe(g.dec[0]); expect(cats.up, spec.id).toBe(g.dec[1]); }
        else expect(cats.exact, spec.id).toBe(n);
        k += n;
      }
    }
  }, 120_000);

  it("单题生成:乘法实/法位数正确;除法法/商位数正确(整除)", () => {
    for (let t = 0; t < 200; t++) {
      const [m] = genMdGroup("mul", [[4, 3, 1]], 0);
      expect(strip(m.a).length).toBe(4); expect(strip(m.b).length).toBe(3);
      const [d] = genMdGroup("div", [[3, 4, 1]], 0);
      expect(strip(d.b).length).toBe(3); expect(strip(d.answer).length).toBe(4);
      const a = genAddsub({ n: 1, d: { 3: 10 }, m: 3 }, true);
      expect(a.terms.filter((x) => x < 0).length).toBe(3);
    }
  }, 30_000);
  it("Excel:两套题 → 4 张表(每套试题+答案),试题表各有自己的二维码", async () => {
    const spec = ALL.find((x) => x.id === "zs2020-5")!;
    const sheets = [1, 2].flatMap((no) => examSheets({ ...spec, level: `${spec.level} · 第${no}套` }, genExam(spec), { fontPt: 13 })
      .map((s, si) => ({ ...s, name: `第${no}套${si ? "答案" : "试题"}`, qr: s.qr ? { ...s.qr, url: `https://superbrainlab.org/key/set${no}` } : undefined })));
    const { bytes, filename } = await sheetsToXlsx(sheets, "https://superbrainlab.org/key/x", spec.title);
    expect(filename).toMatch(/^珠算技术普通五级鉴定模拟题_\d{12}\.xlsx$/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes as ArrayBuffer));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["第1套试题", "第1套答案", "第2套试题", "第2套答案"]);
    expect(wb.worksheets[0].getImages().length).toBe(1);
    expect(wb.worksheets[2].getImages().length).toBe(1);
    expect(wb.worksheets[1].getImages().length).toBe(0);
  });
  it("除不尽:商的位数 = 整数位 + 小数位(含小数),四舍/五入类别正确", () => {
    const digits = (a: string) => a.replace(/[,.]/g, "").replace(/^0+/, "").length;
    for (const [d, q, p] of [[3, 5, 2], [5, 3, 2], [2, 2, 2], [4, 6, 4], [6, 4, 4], [1, 3, 2], [3, 3, 3]] as const) for (let i = 0; i < 100; i++) {
      for (const r of ["down", "up"] as const) {
        const x = genMdGroup("div", [[d, q, 1]], p, r === "down" ? [1, 0] : [0, 1])[0];
        expect(digits(x.answer), `÷${d}=${q} 保留${p}: ${x.a}÷${x.b}=${x.answer}`).toBe(q);
        expect(check(x, p).cat).toBe(r);
        expect(check(x, p).ok).toBe(true);
      }
    }
  });
  it("乘除题面的小数末尾不带 0(如 21.0、1.20)", () => {
    for (const spec of ALL) for (const { sec, problems } of genExam(spec)) {
      if (sec.kind === "addsub") continue;
      for (const p of problems as MdProblem[]) { expect(p.a, spec.id).not.toMatch(/\.\d*0$/); expect(p.b, spec.id).not.toMatch(/\.\d*0$/); }
    }
  }, 60_000);
});

// 2026-10-25 世界比赛按第九届样卷:每个部分独占一页、每页题量固定(之前乘算一页 54 题、下一页 66 题)
describe("世界珠心算比赛 · 第九届样卷版式", () => {
  const PER_PAGE: Record<string, number[]> = {
    "w9-ab-add": [30, 20, 20, 20], "w9-ab-mul": [120, 120], "w9-ab-div": [120, 120],
    "w9-cd-add": [30, 30, 30, 30],
    "w9-p-add": [15, 15, 15], "w9-p-mul": [60, 60], "w9-p-div": [60, 60],
    // 全国比赛样卷(附件7–12)
    "cn-e-add": [10, 10, 10, 10, 10], "cn-e-mul": [60, 60], "cn-e-div": [60, 60, 60],
    "cn-a-add": [15, 15, 15, 15], "cn-a-mul": [60, 60, 60, 60], "cn-a-div": [60, 60, 60, 60],
    "cn-b-add": [30, 15, 15, 15], "cn-b-mul": [60, 60, 60, 60], "cn-c-add": [30, 30, 15, 15], "cn-c-div": [60, 60, 60, 60],
    "cn-d-add": [30, 30, 30, 30], "cn-y-add": [30, 30, 30, 30],
  };
  for (const [id, counts] of Object.entries(PER_PAGE)) {
    it(`${id} 每页题量与样卷一致,题号跨页连续,版面不超出 A4`, () => {
      const spec = ALL.find((s) => s.id === id)!;
      for (const fontPt of [10, 14, 18]) {
        const gen = genExam(spec);
        const [q] = examSheets(spec, gen, { fontPt, setNo: 1 });
        const pages = sheetPages(q);
        expect(pages.length).toBe(counts.length);
        const nums = pages.map((rows) => rows.flatMap((r) => r.cells.filter((c): c is NonNullable<typeof c> => !!c && typeof c.v === "number").map((c) => c.v as number)));
        expect(nums.map((n) => n.length)).toEqual(counts);
        pages.forEach((rows) => expect(rows.reduce((h, r) => h + r.h, 0)).toBeLessThanOrEqual(841.9 - 72 + 0.01));
        // 题号:同一项目跨张连续(加减 1–30、31–50…;乘 1–120、121–240)
        const firstNo = nums.map((n) => Math.min(...n));
        const kinds = spec.sections.map((s) => s.kind);
        firstNo.forEach((f, i) => { const prev = kinds.slice(0, i).map((k, j) => (k === kinds[i] ? counts[j] : 0)).reduce((a, b) => a + b, 0); expect(f).toBe(prev + 1); });
        expect(q.cols.length).toBe(120);
        if (id.startsWith("cn-")) expect(JSON.stringify(q.rows)).not.toContain("Sample Examination"); // 全国比赛纯中文页眉
      }
    });
  }
  it("A(B)组乘算按栏竖排:第 1 栏 1–30、第 2 栏 31–60", () => {
    const spec = ALL.find((s) => s.id === "w9-ab-mul")!;
    const [q] = examSheets(spec, genExam(spec), { fontPt: 12 });
    const row = sheetPages(q)[0].find((r) => r.cells.some((c) => c?.v === 1 && c.span === 4))!;
    expect(row.cells.filter((c) => typeof c?.v === "number").map((c) => c!.v)).toEqual([1, 31, 61, 91]);
  });
});

// 2026-10-25 A4 / B4 两种纸:B4 = A4 版面整页等比放大,Excel 用 B4 纸 + 打印缩放
describe("A4 / B4 纸张", () => {
  it("B4:版面不变、scale≈1.22,Excel 纸张 12 号且缩放约 120%", async () => {
    const { onPaper, PAPERS } = await import("@/lib/paper");
    const spec = ALL.find((s) => s.id === "w9-ab-mul")!;
    const a4 = examSheets(spec, genExam(spec), { fontPt: 12 });
    const b4 = onPaper(a4, "B4");
    expect(b4[0].rows).toBe(a4[0].rows);
    expect(b4[0].scale).toBeCloseTo(PAPERS.B4.k, 5);
    expect(onPaper(a4, "A4")).toBe(a4);
    const { bytes } = await sheetsToXlsx(b4, "https://superbrainlab.org/key/x", "t");
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes);
    expect(wb.worksheets[0].pageSetup.paperSize).toBe(12);
    expect(wb.worksheets[0].pageSetup.scale).toBe(119); // 122% 留 2% 余量,防止换算误差把右边挤到下一页
  }, 30_000);
});

it("世界比赛乘除:「=」后面的答题位至少占一栏的 1/4(4 栏)/ 30%(2 栏)", () => {
  for (const id of ["w9-ab-mul", "w9-ab-div", "w9-p-mul", "w9-p-div"]) {
    const spec = ALL.find((s) => s.id === id)!;
    const [q] = examSheets(spec, genExam(spec), { fontPt: 13 });
    const nc = (spec.sections[0] as { cols?: number }).cols ?? 2;
    const row = sheetPages(q)[0].find((r) => r.cells.some((c) => c?.v === "="))!;
    const eqIdx = row.cells.findIndex((c) => c?.v === "=");
    const ans = row.cells[eqIdx + 2]!;
    expect(ans.v).toBe("");
    expect(ans.span! / (120 / nc), id).toBeGreaterThanOrEqual(nc >= 4 ? 0.25 : 0.3);
  }
});

// 2026-10-27「所有的字体大小要统一」后:答题位优先 4 成(8 列);数字按用户字号放不下时最少让到 3 成(6 列),不先缩字
it("等级鉴定 / 自定义版式:乘除「=」后答题位 ≥ 一栏 3 成,数字放得下时 4 成", () => {
  const spec = ALL.find((s) => s.id === "zs2020-5")!;
  const [q] = examSheets(spec, genExam(spec), { fontPt: 13 });
  expect(q.cols.length).toBe(40);
  const row = q.rows.find((r) => r.cells.some((c) => c?.v === "="))!;
  const eqs = row.cells.map((c, i) => (c?.v === "=" ? i : -1)).filter((i) => i >= 0);
  for (const i of eqs) { const ans = row.cells[i + 1]!; expect(ans.v).toBe(""); expect(ans.span).toBeGreaterThanOrEqual(6); }
  const short: ExamSpec = { id: "train-mul", label: "x", title: "x", level: "训练题", minutes: 0, sections: [{ kind: "mul", title: "乘算", onePage: true, places: 0, groups: [{ combos: [[3, 3, 60]] }] }] };
  const r2 = examSheets(short, genExam(short), { fontPt: 12 })[0].rows.find((r) => r.cells.some((c) => c?.v === "="))!;
  // 2026-11-03 算式等距排版后,数字放得下时多出来的宽度也留给答题位 → 至少 8 列(4 成)
  r2.cells.forEach((c, i) => { if (c?.v === "=") expect(r2.cells[i + 1]!.span).toBeGreaterThanOrEqual(8); });
  // 整页不超出 A4
  sheetPages(q).forEach((rows) => expect(rows.reduce((h, r) => h + r.h, 0)).toBeLessThanOrEqual(841.9 - 72 + 0.01));
});

// 2026-10-26 付海东:Excel 在 A4 上打不下(列宽没算 Excel 每列 5px 边距,120 列细网格宽度近乎翻倍 → 16 页细条)
it("Excel 列宽换算后总宽 = 版面宽度,A4 开「宽度缩到 1 页」", async () => {
  const { xlColWidth, xlColPx, A4 } = await import("@/lib/paper");
  for (const id of ["w9-ab-mul", "cn-a-add", "zs2020-5"]) {
    const spec = ALL.find((s) => s.id === id)!;
    const sheets = examSheets(spec, genExam(spec), { fontPt: 13 });
    const { bytes } = await sheetsToXlsx(sheets, "https://superbrainlab.org/key/x", "t");
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes);
    const ws = wb.worksheets[0];
    const px = (ws.columns ?? []).reduce((t, c) => t + xlColPx(c.width ?? 0), 0);
    expect(px * 0.75, id).toBeLessThanOrEqual(A4.w - 2 * A4.mx + 1);
    expect(px * 0.75, id).toBeGreaterThan((A4.w - 2 * A4.mx) * 0.97);
    expect((ws.columns ?? []).length, id).toBeLessThan(80); // 细网格合并后列数大降
    expect(ws.pageSetup.fitToPage, id).toBe(true);
    expect(ws.pageSetup.fitToWidth, id).toBe(1);
    expect(xlColWidth(26.88)).toBeGreaterThan(0);
  }
}, 60_000);

it("PDF:每页一个对象、xref 偏移正确;Excel 合并列后版面几何不变", async () => {
  const { buildPdf } = await import("@/lib/pdfExport");
  const fake = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const bytes = buildPdf([{ w: 595.3, h: 841.9, pw: 10, ph: 14, jpg: fake }, { w: 595.3, h: 841.9, pw: 10, ph: 14, jpg: fake }]);
  const txt = new TextDecoder("latin1").decode(bytes);
  expect(txt.startsWith("%PDF-1.4")).toBe(true);
  expect(txt).toContain("/Count 2");
  const xref = Number(txt.match(/startxref\n(\d+)/)![1]);
  expect(txt.slice(xref, xref + 4)).toBe("xref");
  const offs = [...txt.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  offs.forEach((o, i) => expect(txt.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));

  const { compactCols } = await import("@/lib/paper");
  const spec = ALL.find((s) => s.id === "w9-p-div")!;
  const [q] = examSheets(spec, genExam(spec), { fontPt: 13 });
  const c = compactCols(q);
  expect(c.cols.length).toBeLessThan(q.cols.length);
  expect(c.cols.reduce((a, b) => a + b, 0)).toBeCloseTo(q.cols.reduce((a, b) => a + b, 0), 5);
  // 每个单元格的左边界位置(pt)不变
  const lefts = (sh: typeof q) => sh.rows.map((r) => r.cells.map((x, i) => (x ? sh.cols.slice(0, i).reduce((a, b) => a + b, 0) : null)).filter((v): v is number => v !== null));
  const L1 = lefts(q), L2 = lefts(c);
  L1.forEach((row, i) => { expect(L2[i].length).toBe(row.length); row.forEach((v, k) => expect(Math.abs(v - L2[i][k])).toBeLessThan(0.01)); });
});

// 2026-10-26 用户「字号一放大,长一点的乘数第一个数就没了」:任何字号下,数字都不能比格子宽(按手写体真实字宽:数字 0.635em、逗号/小数点 0.352em,另加字距 0.08em)
it("字号 9–22:所有题型的数字都放得进格子", () => {
  const em = (t: string) => [...t].reduce((a, ch) => a + (/[0-9]/.test(ch) ? 0.635 : /[,.]/.test(ch) ? 0.352 : 0.585) + 0.08, 0);
  for (const spec of ALL) {
    const gen = genExam(spec);
    for (const fontPt of [9, 16, 22]) {
      const [q] = examSheets(spec, gen, { fontPt });
      for (const r of q.rows) {
        for (let c = 0; c < q.cols.length; ) {
          const cell = r.cells[c]; const span = cell?.span ?? 1;
          if (cell?.num && String(cell.v)) {
            const w = q.cols.slice(c, c + span).reduce((a, b) => a + b, 0) - 4;
            expect(em(String(cell.v)) * cell.size, `${spec.id} 字号${fontPt} 「${cell.v}」`).toBeLessThanOrEqual(w + 0.5);
          }
          c += span;
        }
      }
    }
  }
}, 120_000);

// 2026-10-26 用户:加减法一行里不能有重复数字;上下相邻两行同一数位(个位对齐)的数字不能相同
it("加减:每行数码不重复,相邻两行同位数字不同(所有题型)", () => {
  for (const spec of ALL) for (const { sec, problems } of genExam(spec)) {
    if (sec.kind !== "addsub") continue;
    for (const p of problems as AddsubProblem[]) {
      const ds = p.terms.map((t) => String(Math.abs(t)));
      ds.forEach((d, i) => {
        expect(new Set(d).size, `${spec.id} ${d}`).toBe(d.length);
        if (i) { const a = ds[i - 1]; for (let k = 1; k <= Math.min(a.length, d.length); k++) expect(d[d.length - k], `${spec.id} ${a} / ${d} 第${k}位`).not.toBe(a[a.length - k]); }
      });
    }
  }
}, 120_000);

// 2026-10-26 用户「乘法一题里数字要平均出现」「除法看商和除数,不看被除数,两者不能相同」「所有出题规则都要保证数字均匀」
it("乘:两因数数字不重复(总位数 ≤ 10);除:除数与商数字不重复;整卷 0–9 出现次数接近", () => {
  const digitsOf = (t: string) => t.replace(/[^0-9]/g, "").replace(/^0+/, "");
  for (const spec of ALL) {
    const gen = genExam(spec);
    const cnt = Array(10).fill(0);
    for (const { sec, problems } of gen) {
      for (const p of problems) {
        if (p.kind === "addsub") { p.terms.forEach((t) => String(Math.abs(t)).split("").forEach((c) => cnt[+c]++)); continue; }
        const x = digitsOf(p.kind === "mul" ? p.a : p.b), y = digitsOf(p.kind === "mul" ? p.b : p.answer);
        // 除法看除数和最后的答案(四舍五入后的商),不看被除数
        if (x.length + y.length <= 10) { const both = x + y; expect(new Set(both).size, `${spec.id} ${p.a} ${p.kind === "mul" ? "×" : "÷"} ${p.b} = ${p.answer}`).toBe(both.length); }
      }
    }
    const total = cnt.reduce((a, b) => a + b, 0);
    if (total >= 300) { const avg = total / 10; for (let d = 1; d <= 9; d++) expect(Math.abs(cnt[d] - avg) / avg, `${spec.id} 数字${d}:${cnt.join(",")}`).toBeLessThan(0.35); }
  }
}, 120_000);

it("珠心算段位:加减（一）10 题 10 行、（二）10 题 15 行;乘算后 8 题是带小数的大题", () => {
  const spec = ALL.find((s) => s.id === "zx2020-dan")!;
  const gen = genExam(spec);
  expect(gen.map((g) => g.problems.length)).toEqual([10, 10, 20, 20]);
  expect((gen[0].problems as AddsubProblem[]).every((p) => p.terms.length === 10)).toBe(true);
  expect((gen[1].problems as AddsubProblem[]).every((p) => p.terms.length === 15)).toBe(true);
  const mul = gen[2].problems as MdProblem[];
  expect(mul.slice(0, 12).every((p) => !p.answer.includes("."))).toBe(true);
  expect(mul.slice(12).every((p) => p.answer.includes("."))).toBe(true);
  expect(ALL.filter((s) => /^zx2020-(\d+|dan)$/.test(s.id)).length).toBe(11);
});

// 2026-10-26 付海东「鉴定试题里加减是一张试卷,乘、除放在一张试卷里」
it("等级鉴定:加减单独成页,乘、除在同一页", () => {
  for (const spec of ALL.filter((s) => /^(zs2020|zx2020)-\d+$/.test(s.id))) {
    const gen = genExam(spec);
    if (!gen.some((g) => g.sec.kind !== "addsub")) continue;
    const [q] = examSheets(spec, gen, { fontPt: 13 });
    const pages = sheetPages(q).map((rows) => rows.flatMap((r) => r.cells.filter(Boolean).map((c) => String(c!.v))));
    const hasMd = (p: string[]) => p.some((v) => v === "×" || v === "÷");
    const hasAdd = (p: string[]) => p.some((v) => v.startsWith("加减算"));
    const mdPages = pages.filter(hasMd);
    expect(mdPages.length, spec.id).toBe(1);
    expect(hasAdd(mdPages[0]), spec.id).toBe(false);
    sheetPages(q).forEach((rows) => expect(rows.reduce((h, r) => h + r.h, 0)).toBeLessThanOrEqual(841.9 - 72 + 0.01));
  }
});

// 2026-10-26 付海东「第一行排版不对」:精英组每张前 5 题 15 行、后 5 题 20 行 → 第一排只画 15 行,不能空出 5 行
it("比赛加减:每一横排按本排题目行数排(精英组 15 行 + 20 行)", () => {
  const spec = ALL.find((s) => s.id === "cn-e-add")!;
  const [q] = examSheets(spec, genExam(spec), { fontPt: 13, setNo: 1 });
  for (const rows of sheetPages(q)) {
    const termRows = rows.filter((r) => r.cells.some((c) => c?.num)).length;
    expect(termRows).toBe(35);
  }
});

// 2026-10-26 付海东「精英组的乘除不对,难度顺序要按样题」:全国样题乘除每组(精英 20 题、其余 10 题)组内位数合计由易到难
it("全国比赛乘除:每组内由易到难(乘看两因数位数和,除看除数+商位数和)", () => {
  const nd = (t: string) => t.replace(/[^0-9]/g, "").replace(/^0+/, "").length;
  for (const spec of ALL.filter((s) => s.id.startsWith("cn-") && !s.id.endsWith("-add"))) {
    for (const { problems } of genExam(spec)) {
      const per = spec.id.startsWith("cn-e") ? 20 : 10;
      for (let g = 0; g < problems.length; g += per) {
        const sums = (problems.slice(g, g + per) as MdProblem[]).map((p) => (p.kind === "mul" ? nd(p.a) + nd(p.b) : nd(p.b) + nd(p.answer)));
        // 五入/末尾 0 可能让位数差 1,允许组内最多 1 处小回落
        const drops = sums.filter((v, i) => i && v < sums[i - 1] - 1).length;
        expect(drops, `${spec.id} ${sums.join(",")}`).toBe(0);
      }
    }
  }
});

it("除法:答案本身数码不重复(53.83 这类不行),且不和除数重复", () => {
  const dig = (t: string) => t.replace(/[^0-9]/g, "").replace(/^0+/, "");
  for (const spec of ALL) for (const { problems } of genExam(spec)) for (const p of problems) {
    if (p.kind !== "div") continue;
    const a = dig(p.answer), b = dig(p.b);
    if (a.length + b.length > 10) continue;
    expect(new Set(a).size, `${spec.id} ${p.a} ÷ ${p.b} = ${p.answer}`).toBe(a.length);
    expect([...a].some((c) => b.includes(c)), `${spec.id} ${p.a} ÷ ${p.b} = ${p.answer}`).toBe(false);
  }
});

// 2026-10-26 付海东「页边距要相等,乘除法的间距也要相等」
it("等级鉴定:加减页铺满(上下边距一致);乘除页乘、除行高相同", () => {
  for (const spec of ALL.filter((s) => /^(zs2020|zx2020)-\d+$/.test(s.id))) {
    const gen = genExam(spec);
    const [q] = examSheets(spec, gen, { fontPt: 13 });
    const pages = sheetPages(q);
    const isMd = (rows: typeof pages[0]) => rows.some((r) => r.cells.some((c) => c?.v === "×" || c?.v === "÷"));
    for (const rows of pages) {
      const h = rows.reduce((a, r) => a + r.h, 0);
      const termRows = rows.filter((r) => r.cells.some((c) => c?.num)).length;
      const addPages = pages.filter((pg) => !isMd(pg)).length;
      // 加减一页放得下时铺满;跨几页时以「同类题间距一致」优先(2026-10-26 用户),不强求每页都满
      if (pages.length > 1 && !isMd(rows) && termRows >= 16 && addPages === 1) expect(h, `${spec.id} 加减页高度`).toBeGreaterThan((841.9 - 72) * 0.9);
      if (isMd(rows)) {
        const hs = new Set(rows.filter((r) => r.cells.some((c) => c?.v === "×" || c?.v === "÷")).map((r) => Math.round(r.h * 10)));
        expect(hs.size, `${spec.id} 乘除行高`).toBe(1);
      }
    }
  }
});

it("答案页:所有题型都不超出 A4,题号连续、答案齐全", () => {
  for (const spec of ALL) {
    const gen = genExam(spec);
    const [, a] = examSheets(spec, gen, { fontPt: 13, setNo: 1 });
    sheetPages(a).forEach((rows, i) => expect(rows.reduce((h, r) => h + r.h, 0), `${spec.id} 答案第${i + 1}页`).toBeLessThanOrEqual(841.9 - 72 + 0.01));
    const nums = a.rows.flatMap((r) => r.cells.filter((c) => c?.num).map((c) => String(c!.v)));
    expect(nums.length, spec.id).toBe(gen.reduce((n, g) => n + g.problems.length, 0));
  }
});

// 2026-10-26 付海东「字体大小不能改变」:同一份卷子里加减各页同一字号;乘、除各自同一字号
it("同一份卷子同一项目字号一致(段位第 2 张只排得更紧)", () => {
  for (const spec of ALL) {
    const [q] = examSheets(spec, genExam(spec), { fontPt: 13, setNo: 1 });
    const sizes: Record<string, Set<number>> = { add: new Set(), "×": new Set(), "÷": new Set() };
    for (const r of q.rows) {
      const op = r.cells.find((c) => c?.v === "×" || c?.v === "÷")?.v as string | undefined;
      for (const c of r.cells) if (c?.num && String(c.v)) (op && !r.cells.some((x) => x?.v === "×") === (op === "÷") ? sizes[op] : sizes.add).add(Math.round(c.size * 100));
    }
    for (const [k, set] of Object.entries(sizes)) expect(set.size, `${spec.id} ${k} 字号 ${[...set].join(",")}`).toBeLessThanOrEqual(1);
  }
});

// 比赛题型标准:加减混合题减数字码约占该题总字数的 1/3(精英组每题 120 字、减号字数 40)
it("加减混合题:减数字码 ≈ 总字数 ⅓", () => {
  for (const spec of ALL) for (const { problems } of genExam(spec)) for (const p of problems) {
    if (p.kind !== "addsub" || spec.id === "zs2020-0") continue;
    const q = p as AddsubProblem;
    if (!q.terms.some((t) => t < 0)) continue;
    const T = q.terms.reduce((n, t) => n + String(Math.abs(t)).length, 0), md = q.terms.filter((t) => t < 0).reduce((n, t) => n + String(-t).length, 0);
    expect(Math.abs(md - T / 3), `${spec.id} 减号字数 ${md}/${T}`).toBeLessThanOrEqual(Math.max(1.5, T * 0.05 + 0.5));
  }
  const e = genExam(ALL.find((s) => s.id === "cn-e-add")!).flatMap((g) => g.problems as AddsubProblem[]).filter((p) => p.terms.some((t) => t < 0));
  const exact = e.filter((p) => p.terms.filter((t) => t < 0).reduce((n, t) => n + String(-t).length, 0) === 40).length;
  expect(exact / e.length).toBeGreaterThan(0.9); // 精英组绝大多数正好 40 字
}, 120_000);

// 积位比 83% 与「实、法首位 1–9 均衡」在纯整数小位数题上互相冲突(3位×3位要凑 83% 几乎每题都得 1、2 开头);
// 用户定「数字均匀优先」,官方样卷 A 组第 1 张积位比也是 91%。→ 首位均衡为硬要求,积位比尽量靠近 83%:
// 精英组(小数多)每张 80–86%;其余组每张 ≤ 90%、整份平均 ≤ 89%
it("全国比赛乘算:积的位数尽量靠近实法位数和的 83%", () => {
  const nd = (t: string) => t.replace(/[^0-9]/g, "").replace(/^0+/, "").length;
  for (const spec of ALL.filter((s) => s.id.startsWith("cn-") && s.id.endsWith("-mul"))) {
    let A = 0, F = 0;
    for (const { problems } of genExam(spec)) {
      const ps = problems as MdProblem[];
      const a = ps.reduce((x, p) => x + nd(p.answer), 0), f = ps.reduce((x, p) => x + nd(p.a) + nd(p.b), 0);
      A += a; F += f;
      if (spec.id === "cn-e-mul") { expect(a / f, spec.id).toBeGreaterThanOrEqual(0.8); expect(a / f, spec.id).toBeLessThanOrEqual(0.86); }
      else expect(a / f, spec.id).toBeLessThanOrEqual(0.9);
    }
    expect(A / F, spec.id).toBeLessThanOrEqual(0.89);
  }
});

it("不出现 0.0x 这种数(样题里没有)", () => {
  for (const spec of ALL) for (const { problems } of genExam(spec)) for (const p of problems) {
    if (p.kind === "addsub") continue;
    const m = p as MdProblem;
    expect(/^0\.0/.test(m.answer) || /^0\.0/.test(m.a) || /^0\.0/.test(m.b), `${spec.id} ${m.a} ${m.b} ${m.answer}`).toBe(false);
  }
});

// 《珠算 / 珠心算鉴定标准》五、拟题要求
describe("鉴定标准·拟题要求", () => {
  const cnt = (vals: number[]) => { const c = Array(10).fill(0); for (const v of vals) for (const ch of String(Math.abs(v))) c[+ch]++; return c; };
  it("加减:每题字数整十时,相邻两题互换一个数码、每 10 题 5 组交换用遍 0–9;非整十时两题合起来均衡", () => {
    let pairs = 0, exact = 0;
    for (const spec of ALL) for (const { sec, problems } of genExam(spec)) {
      if (sec.kind !== "addsub") continue;
      const ps = problems as AddsubProblem[];
      // 标准用「原则上」:受行内不重复、上下同位不同、减号字数 ⅓ 等硬规则约束,个别题可能差 1–2 个数码
      for (let i = 0; i + 1 < ps.length; i += 2) {
        const a = cnt(ps[i].terms), b = cnt(ps[i + 1].terms);
        const T = a.reduce((x, y) => x + y, 0), T2 = b.reduce((x, y) => x + y, 0);
        if (T !== T2) continue; // 跨部分(行数不同)不配对
        const oneDigit = [...ps[i].terms, ...ps[i + 1].terms].every((t) => Math.abs(t) < 10);
        const pairSum = a.map((v, k) => v + b[k]).slice(oneDigit ? 1 : 0); // 全是 1 位数时 0 不可能出现,只看 1–9
        const sp = Math.max(...pairSum) - Math.min(...pairSum);
        expect(sp, `${spec.id} 第${i + 1}/${i + 2}题合计 ${pairSum}`).toBeLessThanOrEqual(T <= 20 ? 3 : 2);
        pairs++; if (sp <= (T % 10 === 0 && !oneDigit ? 0 : 1)) exact++;
      }
    }
    expect(exact / pairs).toBeGreaterThan(0.9);
  }, 120_000);
  it("加减:每题尾数 0 最多 2 行;每行首位 1–9 整卷均衡", () => {
    for (const spec of ALL) {
      const lead = Array(10).fill(0); let rows = 0;
      for (const { sec, problems } of genExam(spec)) {
        if (sec.kind !== "addsub") continue;
        for (const p of problems as AddsubProblem[]) {
          expect(p.terms.filter((t) => Math.abs(t) % 10 === 0).length, `${spec.id} ${p.texts.join(" ")}`).toBeLessThanOrEqual(2);
          for (const t of p.terms) { lead[+String(Math.abs(t))[0]]++; rows++; }
        }
      }
      if (rows >= 180) { const l = lead.slice(1), avg = rows / 9; expect(Math.max(...l.map((v) => Math.abs(v - avg))) / avg, `${spec.id} 首位 ${l}`).toBeLessThan(rows < 400 ? 0.35 : 0.25); } // 行数少的卷子随机波动大(每题 0–9 均衡优先)
    }
  }, 120_000);
  it("乘:实数、法数各自 0–9 均衡、首位 1–9 均衡;除:法数、商数同样", () => {
    const sig = (t: string) => t.replace(/[^0-9]/g, "").replace(/^0+/, ""); // 0.5683 的前导 0 是格式,不算商的数码
    for (const id of ["cn-e-mul", "cn-a-mul", "cn-e-div", "cn-a-div", "w9-ab-mul", "w9-p-div"]) {
      const spec = ALL.find((s) => s.id === id)!;
      const ca = Array(10).fill(0), cb = Array(10).fill(0), la = Array(10).fill(0), lb = Array(10).fill(0);
      let n = 0;
      for (const { problems } of genExam(spec)) for (const p of problems as MdProblem[]) {
        const [x, y] = p.kind === "mul" ? [p.a, p.b] : [p.b, p.answer];
        // 实数、法数(含除数)按卷面印出来的数码算(0.179 的 0 也是印出来的);商按自身数码算
        const printed = (t: string) => t.replace(/[^0-9]/g, "");
        for (const ch of printed(x)) ca[+ch]++; for (const ch of p.kind === "mul" ? printed(y) : sig(y)) cb[+ch]++;
        la[+(x.match(/[1-9]/)![0])]++; lb[+(y.match(/[1-9]/)![0])]++; n++;
      }
      for (const [name, c] of [["前数", ca], ["后数", cb]] as const) { const avg = c.reduce((a, b) => a + b, 0) / 10; expect(Math.max(...c.map((v) => Math.abs(v - avg))) / avg, `${id} ${name}数码 ${c}`).toBeLessThan(0.2); }
      for (const [name, c] of [["前数首位", la], ["后数首位", lb]] as const) { const l = c.slice(1), avg = n / 9; expect(Math.max(...l.map((v) => Math.abs(v - avg))) / avg, `${id} ${name} ${l}`).toBeLessThan(0.35); }
    }
  }, 120_000);
  it("珠算鉴定乘算:积的位数尽量靠近 83%(首位均衡优先,每份 ≤ 90%)", () => {
    const nd = (t: string) => t.replace(/[^0-9]/g, "").replace(/^0+/, "").length;
    for (const spec of ALL.filter((s) => /^zs2020-/.test(s.id))) for (const { sec, problems } of genExam(spec)) {
      if (sec.kind !== "mul") continue;
      const ps = problems as MdProblem[];
      const r = ps.reduce((a, p) => a + nd(p.answer), 0) / ps.reduce((a, p) => a + nd(p.a) + nd(p.b), 0);
      expect(r, spec.id).toBeLessThanOrEqual(0.9);
    }
  });
});

// 2026-10-26 用户「同类型的题间距要保持一致」:同一个加减部分跨几页时,每页行高相同
it("同一加减部分跨页时各页行高一致(自定义 40 题、能手级)", () => {
  const custom: ExamSpec = { id: "train-x", label: "x", title: "x", level: "训练题", minutes: 0, sections: [{ kind: "addsub", title: "加减算", parts: [{ n: 40, d: { 4: 10 }, m: 3 }] }] };
  for (const spec of [custom, ALL.find((s) => s.id === "zs2020-0")!]) {
    const [q] = examSheets(spec, genExam(spec), { fontPt: 13 });
    const hs = new Set(q.rows.filter((r) => r.cells.some((c) => c?.num) && !r.cells.some((c) => c?.v === "×" || c?.v === "÷")).map((r) => Math.round(r.h * 10)));
    expect(hs.size, `${spec.id} 行高 ${[...hs].join(",")}`).toBe(1);
  }
});

// 2026-10-27 付海东「加减固定题数 20 题,乘法和除法一样也是 60 题」:每张固定题量,常用位数笔数都排进一页,字号不小于 10pt
it("自定义出题:加减每张 20 题、乘除每张 60 题,排进一页", () => {
  const mk = (sec: Section): ExamSpec => ({ id: "train-x", label: "x", title: "x", level: "训练题", minutes: 0, sections: [sec] });
  const cases: Section[] = [
    ...([[3, 10], [3, 15], [4, 10], [2, 5], [1, 10]] as const).map(([len, k]): Section => ({ kind: "addsub", title: "加减算", onePage: true, parts: [{ n: 20, d: { [len]: k }, m: Math.round(k / 3) }] })),
    ...(["mul", "div"] as const).flatMap((kind) => ([[2, 1], [3, 3], [4, 3], [5, 4], [7, 7]] as const).map(([a, b]): Section => ({ kind, title: "x", onePage: true, places: 2, groups: [{ combos: [[a, b, 60]], dec: [15, 15] }] }))),
  ];
  for (const sec of cases) {
    const spec = mk(sec), gen = genExam(spec);
    const n = gen[0].problems.length;
    expect(n).toBe(sec.kind === "addsub" ? 20 : 60);
    const [q] = examSheets(spec, gen, { fontPt: 13 });
    const tag = sec.kind === "addsub" ? `加减 ${JSON.stringify(sec.parts[0].d)}` : `${sec.kind} ${JSON.stringify(sec.groups[0].combos[0])}`;
    expect(sheetPages(q).length, tag).toBe(1);
    const sizes = q.rows.flatMap((r) => r.cells.filter((c) => c?.num).map((c) => c!.size));
    // 字号下限 10pt 只管「为排进一页而收字号」;5 位以上的长小数(0.81579)本来就要按格子宽度缩字,不在此列
    if (sec.kind === "addsub" || sec.groups[0].combos[0][0] + sec.groups[0].combos[0][1] <= (sec.kind === "mul" ? 7 : 6)) expect(Math.min(...sizes), tag).toBeGreaterThanOrEqual(10);
  }
}, 60_000);

// 2026-10-27 付海东「乘除法小数点还得规范」:对照官方样题 114 道小数乘法 —— 两个因数都带小数、小数位只有 1/2/4/5 位或纯小数,从不出 3 位小数;
// 除法的除数最多两位小数
it("小数乘除:因数小数位合乎样题", () => {
  const dp = (t: string) => (t.includes(".") ? t.split(".")[1].length : 0);
  for (const [a, b] of [[3, 3], [4, 3], [3, 2], [5, 4], [4, 4], [2, 2]] as const) {
    for (let i = 0; i < 80; i++) {
      for (const round of ["down", "up"] as const) {
        const p = genMul(a, b, 2, round);
        if (!p.a.includes(".") && !p.b.includes(".")) continue; // 极少数兜底成整数题
        expect(dp(p.a) > 0 && dp(p.b) > 0, `${p.a}×${p.b}`).toBe(true);
        for (const t of [p.a, p.b]) expect(dp(t), `${p.a}×${p.b}`).not.toBe(3);
      }
    }
  }
  for (const [d, q] of [[3, 3], [4, 4], [2, 3]] as const) for (let i = 0; i < 80; i++) {
    const p = genDiv(d, q, 2, i % 2 ? "up" : "down");
    expect(dp(p.b), `${p.a}÷${p.b}`).toBeLessThanOrEqual(2);
  }
});

// 2026-10-27 付海东「段位的乘除法字体大小不一致」「所有的字体大小要统一」:同一份试卷里所有题目数字一个字号(加减、乘、除都一样);
// 自定义的乘算卷、除算卷(默认 12pt)常用位数也一样大
it("所有试卷:题目数字字号统一", () => {
  for (const spec of ALL) {
    for (const sh of examSheets(spec, genExam(spec), { fontPt: 12 }).slice(0, -1)) {
      const sizes = new Set(sh.rows.flatMap((r) => r.cells.filter((c) => c?.num).map((c) => Math.round(c!.size * 100))));
      expect(sizes.size, `${spec.id} 字号 ${[...sizes].map((x) => x / 100).join(",")}`).toBe(1);
    }
  }
  const mk = (kind: "mul" | "div"): ExamSpec => ({ id: `train-${kind}`, label: "x", title: "x", level: "训练题", minutes: 0, sections: [{ kind, title: "x", onePage: true, places: 2, groups: [{ combos: [[3, 3, 60]], dec: [15, 15] }] }] });
  const fsOf = (spec: ExamSpec) => Math.min(...examSheets(spec, genExam(spec), { fontPt: 12 })[0].rows.flatMap((r) => r.cells.filter((c) => c?.num).map((c) => c!.size)));
  expect(fsOf(mk("mul"))).toBe(12);
  expect(fsOf(mk("div"))).toBe(12);
}, 120_000);

// 字号按实际字宽算(逗号/小数点窄)后,保证没有数字比格子宽(手写体实测:数字 0.635em、逗号小数点 0.352em、负号 0.585em,另加字距 0.08em,格子内边距各 2pt)
it("所有试卷:数字不超出格子(按手写体实测字宽)", () => {
  const em = (ch: string) => (ch === "," || ch === "." ? 0.352 : ch === "-" ? 0.585 : 0.635) + 0.08;
  for (const spec of ALL) {
    for (const sh of examSheets(spec, genExam(spec), { fontPt: 12 })) {
      for (const r of sh.rows) r.cells.forEach((c, i) => {
        if (!c?.num || c.v === "" || c.v == null) return;
        const w = sh.cols.slice(i, i + (c.span ?? 1)).reduce((a, b) => a + b, 0) * sh.scale;
        const need = [...String(c.v)].reduce((a, ch) => a + em(ch), 0) * c.size * sh.scale + 4;
        expect(need, `${spec.id} ${sh.name} 「${c.v}」 ${c.size.toFixed(1)}pt`).toBeLessThanOrEqual(w + 0.5);
      });
    }
  }
}, 120_000);

// 2026-10-31 付海东 / 祥林老师「小题打印浪费纸」:默认 20 / 60 不变,可以调大到一页放得下的量;算上限要快(界面每改一次设置都算)
it("自定义出题:省纸上限按大小自动算,排得进一页且不卡", async () => {
  const { fillCount, sheetCount } = await import("@/lib/exam/capacity");
  const mk = (d: Record<number, number>, m: number) => (n: number): ExamSpec => ({ id: "train-addsub", label: "x", title: "x", level: "训练题", minutes: 0, sections: [{ kind: "addsub", title: "加减算", onePage: true, parts: [{ n, d, m }] }] });
  for (const [d, m, least] of [[{ 2: 5 }, 2, 45], [{ 1: 5 }, 2, 45], [{ 3: 5 }, 2, 45], [{ 3: 10 }, 3, 25]] as const) {
    const make = mk(d as Record<number, number>, m), n = fillCount(make, "addsub");
    expect(n, JSON.stringify(d)).toBeGreaterThanOrEqual(least);
    expect(n % 5).toBe(0);
    const spec = make(n), [q] = examSheets(spec, genExam(spec), { fontPt: 12 }); // 用真题核对:占位数量出来的上限,真题也排得进一页
    expect(sheetPages(q).length, `${JSON.stringify(d)} ${n} 题`).toBe(1);
    expect(Math.min(...q.rows.flatMap((r) => r.cells.filter((c) => c?.num).map((c) => c!.size))), JSON.stringify(d)).toBeGreaterThanOrEqual(10);
  }
  const t0 = performance.now();
  // 2026-11-04 付海东「每次生成默认一张」:大题一页放不下 20 题时,上限(也是默认题量)= 一页放得下的量,排出来就是一页
  const big = fillCount(mk({ 10: 20 }, 6), "addsub");
  expect(big).toBeGreaterThanOrEqual(5); expect(big).toBeLessThan(20);
  expect(sheetCount(mk({ 10: 20 }, 6)(big))).toBe(1);
  // 「六位 15 笔一张只有 10 题,模拟题里能排 15 题」;六位 10 笔标准 20 题一页排下
  expect(fillCount(mk({ 6: 15 }, 5), "addsub")).toBeGreaterThanOrEqual(15);
  expect(fillCount(mk({ 6: 10 }, 3), "addsub")).toBeGreaterThanOrEqual(20);
  expect(performance.now() - t0, "大位数算上限不能卡界面").toBeLessThan(1000);
  const md = (n: number): ExamSpec => ({ id: "train-mul", label: "x", title: "x", level: "训练题", minutes: 0, sections: [{ kind: "mul", title: "乘算", onePage: true, places: 0, groups: [{ combos: [[3, 2, n]] }] }] });
  const nm = fillCount(md, "mul");
  expect(nm).toBeGreaterThanOrEqual(60); expect(nm).toBeLessThanOrEqual(80);
  const sp = md(nm), [q] = examSheets(sp, genExam(sp), { fontPt: 12 });
  expect(sheetPages(q).length).toBe(1);
}, 60_000);

// 2026-10-31 布施「答案竖着下来,横着排跟试卷顺序不一样」:乘除竖排,加减横排,混合卷分部分
it("答案页:乘除竖排、加减横排,按部分分块", async () => {
  const { answerGroups } = await import("@/lib/paper");
  const spec = ALL.find((s) => s.id === "zs2020-5")!;
  const list = examAnswerList(genExam(spec));
  const gs = answerGroups(list.answers.length, list.labels, "md");
  expect(gs.map((g) => g.title)).toEqual(["加减", "乘", "除"]);
  expect(gs.map((g) => g.vertical)).toEqual([false, true, true]);
  expect(gs.flatMap((g) => g.idx)).toEqual(list.answers.map((_, i) => i)); // 一题不漏、顺序不变
  // 老链接没有题号标签:按 kind
  expect(answerGroups(5, undefined, "md")).toEqual([{ title: "", idx: [0, 1, 2, 3, 4], vertical: true }]);
  expect(answerGroups(3, undefined, "addsub")[0].vertical).toBe(false);
  // 多套:每套单独一块
  expect(answerGroups(4, ["第1套乘 1", "第1套乘 2", "第2套乘 1", "第2套乘 2"], "md").map((g) => g.title)).toEqual(["第1套乘", "第2套乘"]);
});
