// 出题系统逐题型校验(2026-10-25 用户「每个检查一下具体的题型,校验一下」):
// 每个题型真出一套题,从【生成出来的题】反算统计量,和标准文件里印着的数字逐项对照(数字是对着原表重新抄的,不复用 specs.ts):
//   加减:题数 / 每题行数 / 每题字数 / 纯加·混合题数 / 混合题减号行数 / 两位小数题数
//   乘除:题数 / 实法(法商)位数合计 / 总计算量 / 带小数(除不尽)题数 / 四舍·五入题数 / 保留位数
// 设 EXAM_AUDIT_OUT=<目录> 时另写一份逐题型对照报告(markdown)。
import { describe, it, expect } from "vitest";
import { EXAM_TABS, type ExamSpec } from "@/lib/exam/specs";
import { genExam, type AddsubProblem, type MdProblem } from "@/lib/exam/generate";

const ALL = EXAM_TABS.flatMap((t) => t.groups.flatMap((g) => g.specs));
const byId = (id: string) => ALL.find((s) => s.id === id)!;
const sig = (s: string) => s.replace(/[,.\-]/g, "").replace(/^0+/, "").length; // 有效位数(含小数位,去前导 0)

// ---------- 统计(只看生成结果)----------
interface AddStat { n: number; rows: number[]; chars: number[]; pure: number; mixed: number; minus: number[]; dec: number }
interface MdStat { n: number; sum: number; load: number; dec: number; down: number; up: number; places: number }
function addStat(ps: AddsubProblem[]): AddStat {
  return {
    n: ps.length,
    rows: [...new Set(ps.map((p) => p.terms.length))].sort((a, b) => a - b),
    chars: [...new Set(ps.map((p) => p.terms.reduce((s, t) => s + String(Math.abs(t)).length, 0)))].sort((a, b) => a - b),
    pure: ps.filter((p) => p.terms.every((t) => t > 0)).length,
    mixed: ps.filter((p) => p.terms.some((t) => t < 0)).length,
    minus: [...new Set(ps.filter((p) => p.terms.some((t) => t < 0)).map((p) => p.terms.filter((t) => t < 0).length))].sort((a, b) => a - b),
    dec: ps.filter((p) => p.dec).length,
  };
}
function mdStat(ps: MdProblem[], places: number): MdStat {
  let sum = 0, load = 0, dec = 0, down = 0, up = 0;
  for (const p of ps) {
    const x = sig(p.a), y = sig(p.kind === "mul" ? p.b : p.b), q = p.kind === "mul" ? y : sig(p.answer);
    const [u, v] = p.kind === "mul" ? [x, y] : [y, q]; // 乘:实×法;除:法×商
    sum += u + v; load += u * v;
    const isDec = /\./.test(p.a + p.b + p.answer);
    if (isDec) {
      dec++;
      // 舍入类别:按精确值重算第 places+1 位
      const A = p.a.replace(/,/g, ""), B = p.b.replace(/,/g, "");
      const k = (s: string) => (s.includes(".") ? s.split(".")[1].length : 0);
      const va = BigInt(A.replace(".", "")), vb = BigInt(B.replace(".", ""));
      let num: bigint, den: bigint;
      if (p.kind === "mul") { num = va * vb; den = 10n ** BigInt(k(A) + k(B)); } else { num = va * 10n ** BigInt(k(B)); den = vb * 10n ** BigInt(k(A)); }
      const nxt = ((num * 10n ** BigInt(places + 1)) / den) % 10n;
      if (nxt >= 5n) up++; else down++;
    }
  }
  return { n: ps.length, sum, load, dec, down, up, places };
}

// ---------- 官方数字(对照原表重抄)----------
type AddExp = { n: number; rows: number[]; chars: number[]; pure: number; mixed: number; minus: number[]; dec: number };
type MdExp = { n: number; sum?: number; load?: number; dec: number; down?: number; up?: number; places: number };
const A = (n: number, rows: number[], chars: number[], pure: number, mixed: number, minus: number[], dec = 0): AddExp => ({ n, rows, chars, pure, mixed, minus, dec });
const M = (n: number, sum: number | undefined, load: number | undefined, dec = 0, down?: number, up?: number, places = dec ? 2 : 0): MdExp => ({ n, sum, load, dec, down, up, places });

/** 每个题型 id → 各部分(按卷面顺序)的官方期望 */
const EXPECT: Record<string, (AddExp | MdExp)[]> = {};
const CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

// ① 珠算技术等级鉴定标准(2020)表二/三/四
const ZS = {
  add: { 1: A(10, [15], [90], 6, 4, [5], 5), 2: A(10, [15], [80], 6, 4, [5], 5), 3: A(10, [15], [70], 6, 4, [5], 5), 4: A(10, [15], [60], 6, 4, [5]), 5: A(10, [15], [50], 6, 4, [5]), 6: A(10, [14], [40], 6, 4, [5]), 7: A(10, [10], [30], 6, 4, [3]), 8: A(10, [10], [20], 6, 4, [3]), 9: A(20, [10], [15], 12, 8, [3]), 10: A(20, [10], [10], 12, 8, [3]), 0: A(20, [15, 20], [120], 12, 8, [5, 7], 10) } as Record<number, AddExp>,
  mul: { 1: M(10, 84, 176, 5, 2, 3), 2: M(10, 76, 142, 4, 2, 2), 3: M(10, 68, 114, 3, 2, 1), 4: M(10, 62, 90, 2, 1, 1), 5: M(10, 54, 70, 2, 1, 1), 6: M(10, 46, 52), 7: M(10, 40, 34), 8: M(20, 70, 50), 0: M(20, 190 * 1, 450, 8, 4, 4, 4) } as Record<number, MdExp>,
  // 表四一级「四舍 2 / 五入 3」与「除不尽 4」自相矛盾,按除不尽 4 题、四舍五入各 2 生成
  div: { 1: M(10, 74, 132, 4, 2, 2), 2: M(10, 68, 114, 4, 2, 2), 3: M(10, 62, 96, 3, 2, 1), 4: M(10, 54, 72, 2, 1, 1), 5: M(10, 46, 52, 2, 1, 1), 6: M(10, 40, 40), 7: M(10, 35, 25), 0: M(20, 184, 418, 8, 4, 4, 4) } as Record<number, MdExp>,
};
for (const lv of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  const secs = [ZS.add[lv], ZS.mul[lv], ZS.div[lv]].filter(Boolean);
  EXPECT[`zs2020-${lv}`] = secs;
}
// ② 珠心算鉴定标准(2020)表一(等级)、表二(段位)
const ZX_ADD: Record<number, AddExp[]> = {
  1: [A(20, [10], [30], 12, 8, [3])], 2: [A(20, [10], [25], 12, 8, [3])], 3: [A(20, [8], [18], 12, 8, [2])], 4: [A(20, [8], [16], 12, 8, [2])],
  5: [A(20, [8], [14], 12, 8, [2])], 6: [A(20, [8], [12], 12, 8, [2])],
  7: [A(30, [5, 6], [10], 18, 12, [2])], 8: [A(30, [4, 6], [8], 18, 12, [1])], 9: [A(30, [5, 6], [6], 18, 12, [1])], 10: [A(30, [4], [4], 18, 12, [1])],
};
const ZX_MUL: Record<number, MdExp> = { 1: M(20, 85, 90), 2: M(20, 80, 70), 3: M(20, 80, 65), 4: M(20, 80, 60), 5: M(20, 70, 50), 6: M(40, 120, 80) };
const ZX_DIV: Record<number, MdExp> = { 1: M(20, 80, 80), 2: M(20, 75, 65), 3: M(20, 75, 55), 4: M(20, 70, 50), 5: M(20, 60, 40) };
for (let lv = 1; lv <= 10; lv++) {
  const secs = [...ZX_ADD[lv], ZX_MUL[lv], ZX_DIV[lv]].filter(Boolean);
  EXPECT[`zx2020-${lv}`] = secs;
  EXPECT[`zx2021-${lv}`] = secs; // 2021 上海标准按 2020 生成(参考)
}
// 段位:加减 20 题(2+3+5+5+5);乘除各 20 题,整 12 小 8(四舍 4、五入 4),保留两位
// 2026-10-26 按样卷拆成 加减算（一）(10 行 ×10 题)、加减算（二）(15 行 ×10 题)
const DAN = [A(10, [10], [35, 40], 3 + 3, 2 + 2, [3], 2 + 2), A(10, [15], [65, 90, 120], 3 + 3, 2 + 2, [5], 2 + 1 + 1), M(20, undefined, undefined, 8, 4, 4), M(20, undefined, undefined, 8, 4, 4)];
EXPECT["zx2020-dan"] = DAN; EXPECT["zx1999-ns"] = DAN;
// 2006 少儿珠心算(加减 10 题,字数/行数按标准;一~六级乘除各 10 题)
const Z06 = [0, [30, 10], [25, 10], [20, 8], [18, 8], [14, 7], [12, 7], [10, 6], [7, 5], [5, 4], [3, 3]] as [number, number][];
for (let lv = 1; lv <= 10; lv++) {
  const [ch, rows] = Z06[lv], m = rows >= 10 ? 3 : rows >= 7 ? 2 : 1;
  EXPECT[`zx2006-${lv}`] = [A(10, [rows], [ch], 6, 4, [m]), ...(lv <= 6 ? [M(10, undefined, undefined), M(10, undefined, undefined)] : [])];
  EXPECT[`zx1999-${lv}`] = [A(10, [rows], [ch], 6, 4, [m]), ...(lv <= 7 ? [M(10, undefined, undefined), M(10, undefined, undefined)] : [])];
}

// ③ 全国珠心算比赛纸质试卷标准(每张一个部分)
const sheets = (...xs: (AddExp | MdExp)[]) => xs;
const per10 = (sum: number, load: number, dec: number, down: number, up: number) => M(60, sum * 6, load * 6, dec * 6, down * 6, up * 6, dec ? 2 : 0);
EXPECT["cn-e-add"] = Array(5).fill(A(10, [15, 20], [120], 6, 4, [5, 7], 5));
EXPECT["cn-e-mul"] = [M(60, 190 * 3, 445 * 3, 36, 18, 18, 2), M(60, 190 * 3, 445 * 3, 36, 18, 18, 4)];
EXPECT["cn-e-div"] = [M(60, 170 * 3, 357 * 3, 48, 24, 24, 2), M(60, 170 * 3, 357 * 3, 48, 24, 24, 4), M(60, 170 * 3, 357 * 3, 48, 24, 24, 4)];
EXPECT["cn-a-add"] = sheets(A(15, [15], [60], 9, 6, [5]), A(15, [15], [70], 9, 6, [5], 10), A(15, [15], [80], 9, 6, [5], 5), A(15, [15], [80], 9, 6, [5], 10));
EXPECT["cn-a-mul"] = sheets(per10(62, 90, 2, 1, 1), per10(68, 114, 3, 2, 1), per10(76, 142, 4, 2, 2), per10(76, 142, 4, 2, 2));
EXPECT["cn-a-div"] = sheets(per10(54, 72, 2, 1, 1), per10(62, 96, 3, 2, 1), per10(68, 114, 4, 2, 2), per10(68, 114, 4, 2, 2));
EXPECT["cn-b-add"] = sheets(A(30, [15], [50], 18, 12, [5]), A(15, [15], [60], 9, 6, [5]), A(15, [15], [70], 9, 6, [5], 5), A(15, [15], [70], 9, 6, [5], 10));
EXPECT["cn-b-mul"] = sheets(per10(54, 70, 2, 1, 1), per10(62, 90, 2, 1, 1), per10(68, 114, 3, 2, 1), per10(68, 114, 3, 2, 1));
EXPECT["cn-b-div"] = sheets(per10(46, 52, 2, 1, 1), per10(54, 72, 2, 1, 1), per10(62, 96, 3, 2, 1), per10(62, 96, 3, 2, 1));
EXPECT["cn-c-add"] = sheets(A(30, [14], [40], 18, 12, [5]), A(30, [15], [50], 18, 12, [5]), A(15, [15], [60], 9, 6, [5]), A(15, [15], [60], 9, 6, [5]));
EXPECT["cn-c-mul"] = sheets(per10(46, 52, 0, 0, 0), per10(54, 70, 2, 1, 1), per10(62, 90, 2, 1, 1), per10(62, 90, 2, 1, 1));
EXPECT["cn-c-div"] = sheets(per10(40, 40, 0, 0, 0), per10(46, 52, 2, 1, 1), per10(54, 72, 2, 1, 1), per10(54, 72, 2, 1, 1));
EXPECT["cn-d-add"] = sheets(A(30, [10], [30], 18, 12, [3]), A(30, [14], [40], 18, 12, [5]), A(30, [15], [50], 18, 12, [5]), A(30, [15], [50], 18, 12, [5]));
EXPECT["cn-y-add"] = sheets(A(30, [10], [15], 18, 12, [3]), A(30, [10], [20], 18, 12, [3]), A(30, [10], [30], 18, 12, [3]), A(30, [10], [30], 18, 12, [3]));
// ④ 世珠联第八届比赛办法
// ④ 世界珠心算比赛:第九届模拟题样卷(每张一个部分)
const W_P_ADD = Array(3).fill(A(15, [15], [120], 9, 6, [5])), W_P_MD = Array(2).fill(M(60, 60 * 11, 15 * 30 + 15 * 30 + 15 * 28 + 15 * 28, 24, 12, 12, 3));
const W_AB_ADD = sheets(A(30, [10], [30], 18, 12, [3]), ...Array(3).fill(A(20, [10], [50], 12, 8, [3])));
const W_AB_MD = sheets(M(120, 24 * 4 + 96 * 5, 24 * 4 + 96 * 6), M(120, 120 * 6, 40 * 9 + 80 * 8));
EXPECT["w9-p-add"] = W_P_ADD; EXPECT["w9-p-mul"] = W_P_MD; EXPECT["w9-p-div"] = W_P_MD;
EXPECT["w9-ab-add"] = W_AB_ADD; EXPECT["w9-ab-mul"] = W_AB_MD; EXPECT["w9-ab-div"] = W_AB_MD;
EXPECT["w9-cd-add"] = sheets(A(30, [6], [10], 18, 12, [2]), ...Array(3).fill(A(30, [10], [30], 18, 12, [3])));

function audit(spec: ExamSpec) {
  return genExam(spec).map(({ sec, problems }) => sec.kind === "addsub" ? { kind: "add" as const, title: sec.title, st: addStat(problems as AddsubProblem[]) } : { kind: sec.kind, title: sec.title, st: mdStat(problems as MdProblem[], sec.places) });
}
const report: string[] = [];

describe("出题系统逐题型对照标准", () => {
  const ids = Object.keys(EXPECT).filter((id) => byId(id)); // 题型库里下架的(珠心算各标准)跳过
  it("题型库里每个官方题型(非参考)都有标准对照", () => {
    for (const s of ALL) if (!s.ref && !s.id.startsWith("train")) expect(EXPECT[s.id], `${s.id} 缺标准对照`).toBeTruthy();
  });
  for (const id of ids) {
    it(`${id} ${byId(id)?.title ?? ""}`, () => {
      const spec = byId(id);
      for (let round = 0; round < 3; round++) { // 随机出 3 套,每套都要对
        const got = audit(spec);
        const exp = EXPECT[id];
        expect(got.length, `${id} 部分数`).toBe(exp.length);
        got.forEach((g, i) => {
          const e = exp[i];
          if (g.kind === "add") expect(g.st, `${id} ${g.title}`).toEqual(e);
          else {
            const m = e as MdExp, s = g.st as MdStat;
            expect(s.n, `${id} ${g.title} 题数`).toBe(m.n);
            if (m.sum != null) expect(s.sum, `${id} ${g.title} 位数合计`).toBe(m.sum);
            if (m.load != null) expect(s.load, `${id} ${g.title} 总计算量`).toBe(m.load);
            expect(s.dec, `${id} ${g.title} 带小数/除不尽题数`).toBe(m.dec);
            if (m.down != null) { expect(s.down, `${id} ${g.title} 四舍`).toBe(m.down); expect(s.up, `${id} ${g.title} 五入`).toBe(m.up); }
            expect(s.places, `${id} ${g.title} 保留位数`).toBe(m.places);
          }
          if (round === 0) report.push(`| ${spec.title} | ${g.title} | ${g.kind === "add" ? `${(g.st as AddStat).n} 题 · ${(g.st as AddStat).rows.join("/")} 行 · ${(g.st as AddStat).chars.join("/")} 字 · 纯加 ${(g.st as AddStat).pure} / 混合 ${(g.st as AddStat).mixed} · 减号 ${(g.st as AddStat).minus.join("/") || "—"} 行 · 小数 ${(g.st as AddStat).dec} 题` : `${(g.st as MdStat).n} 题 · 位数合计 ${(g.st as MdStat).sum} · 计算量 ${(g.st as MdStat).load} · 小数 ${(g.st as MdStat).dec} 题(四舍 ${(g.st as MdStat).down} / 五入 ${(g.st as MdStat).up})· 保留 ${(g.st as MdStat).places} 位`} | ✅ |`);
        });
      }
    });
  }
  it("写对照报告", async () => {
    const out = process.env.EXAM_AUDIT_OUT;
    if (!out) return;
    const fs = await import("node:fs");
    fs.writeFileSync(`${out}/exam-audit.md`, ["| 题型 | 部分 | 生成结果统计(与标准一致) | 校验 |", "|---|---|---|---|", ...report].join("\n"));
  });
});
