// 自定义出题「一张多少题」(2026-10-26 用户:默认一张多少题,只让他调整张数,不让调题数)。
// 2026-10-31 起:默认加减 20、乘除 60;想省纸可以调大,这里算出按当前位数、笔数一张最多放几题(带表头):
// 加减取 5 的倍数(每 5 题里 2 题加减混合,排成整排);乘除取偶数(两栏对齐),20 题以上取 10 的倍数。
import { genExam, fmtUnits, type AddsubProblem, type GenSection } from "./generate";
import { examSheets } from "./layout";
import { sheetPages } from "@/lib/paper";
import type { ExamSpec } from "./specs";

// 量版面只需要「每行多宽、一题几行」,不需要真题:加减用同样长度的占位数(真出题要做数字均衡,120 题大位数要几十秒,界面会卡死)
function measureGen(spec: ExamSpec): GenSection[] {
  return spec.sections.map((sec) => {
    if (sec.kind !== "addsub") return genExam({ ...spec, sections: [sec] })[0];
    const part = sec.parts[0], k = part.dec ? 2 : 0;
    const lens = Object.entries(part.d).flatMap(([len, c]) => Array<number>(c).fill(Number(len)));
    const num = (len: number) => BigInt("8".repeat(len));
    const texts = lens.map((l, i) => (i >= lens.length - part.m ? "-" : "") + fmtUnits(num(l), k));
    const p: AddsubProblem = { kind: "addsub", terms: lens.map((l) => Number(num(Math.min(l, 15)))), dec: !!part.dec, texts, answer: fmtUnits(num(Math.max(...lens) + String(lens.length).length), k) };
    return { sec, problems: Array.from({ length: part.n }, () => p) };
  });
}

export function perSheet(make: (n: number) => ExamSpec, kind: "addsub" | "mul" | "div", max = 120, fontPt = 12): number {
  const big = make(max);
  const gen = measureGen(big);
  let lo = 1, hi = max;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const g = gen.map((s) => ({ ...s, problems: s.problems.slice(0, mid) }));
    const [q] = examSheets(big, g, { fontPt });
    if (sheetPages(q).length <= 1) lo = mid; else hi = mid - 1;
  }
  if (kind === "addsub") return lo >= 5 ? lo - (lo % 5) : lo;
  return lo >= 20 ? lo - (lo % 10) : Math.max(1, lo - (lo % 2));
}

/** 自定义出题一张最多排几题(2026-10-31 付海东 / 祥林老师「平常练习希望一篇多一点,节约纸」):
 *  字和行距收到下限(短数 10pt、长数 8.4pt)时一页放得下多少。乘除不少于 60、封顶 80(再密行高不够写答案)。
 *  加减不再保底 20(2026-11-04 付海东「写的每张默认 20 题,一生成就变成两张了,每次生成默认一张」):大位数一页放不下 20 题时,默认题量就取一页的量 */
export function fillCount(make: (n: number) => ExamSpec, kind: "addsub" | "mul" | "div", fontPt = 12): number {
  return kind === "addsub" ? perSheet(make, "addsub", 120, fontPt) : Math.max(60, perSheet(make, kind, 80, fontPt));
}

/** 一套卷子(试题部分)排出来有几页 —— 题量排不进一张时提示「一张排 N 页」 */
export function sheetCount(spec: ExamSpec, fontPt = 12): number {
  const [q] = examSheets(spec, measureGen(spec), { fontPt });
  return sheetPages(q).length;
}
