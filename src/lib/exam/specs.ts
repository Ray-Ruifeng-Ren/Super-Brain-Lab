// 出题系统题型库(2026-10-25)。数据来源:
//   ① 《中国珠算心算协会珠算技术等级鉴定标准(2020年版)》表二/三/四(普通一~十级、能手级)
//   ② 《中国珠算心算协会珠心算鉴定标准(2020年版)》表一(等级)、表二(段位)
//   ③ 《全国珠心算比赛纸质试卷题型、题量及计分标准》(精英组、少儿A/B/C/D组、幼儿组)
//   ④ 《世界珠算心算联合会第八届珠心算比赛办法》(选手组、A组、C组)
//   ref 字段非空 = 暂无官方细则,按相近标准生成(页面标「参考」,待教练提供样卷后校准)。
import type { AddsubPart, Combo } from "./generate";

export type Section =
  | { kind: "addsub"; title: string; parts: AddsubPart[]; newPage?: boolean; minutes?: number; resetNo?: boolean; onePage?: boolean }
  | { kind: "mul" | "div"; title: string; groups: { combos: Combo[]; dec?: [number, number]; decHard?: boolean }[]; places: number; newPage?: boolean; minutes?: number; shuffle?: boolean; cols?: number; resetNo?: boolean; prodRatio?: number; onePage?: boolean; freeDec?: boolean };
// freeDec = 自定义出题的小数:小数点位置不限(含 0.356 这种纯小数、3 位小数),除数也可以是纯小数;等级鉴定 / 比赛题型仍按样卷规则(2026-11-03 付海东)
// resetNo = 题号从 1 重新数(一张纸上排两套单项时,第 2 套题号重新开始)
// style "waama" = 世界珠心算比赛样卷版式:每个部分独占一页、每页题量固定(乘除按 cols 栏 × 30 行),中英双语页眉;group = [英文组别, 中文组别]
export interface ExamSpec { id: string; label: string; title: string; level: string; minutes: number; sections: Section[]; ref?: string; style?: "waama" | "cn"; group?: [string, string] }
// subs = 卡片内再分小类(如世界比赛的 A(B)组 / C(D)组 / 选手组);specs 仍是全部题型的平铺,供查找和测试用
export interface ExamSub { title: string; note?: string; specs: ExamSpec[] }
export interface ExamGroup { title: string; specs: ExamSpec[]; ref?: string; note?: string; subs?: ExamSub[] }
export interface ExamTab { id: string; label: string; groups: ExamGroup[] }

const CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const P = (n: number, d: Record<number, number>, m: number, extra: Partial<AddsubPart> = {}): AddsubPart => ({ n, d, m, ...extra });
const add = (title: string, parts: AddsubPart[], o: Partial<Extract<Section, { kind: "addsub" }>> = {}): Section => ({ kind: "addsub", title, parts, ...o });
const md = (kind: "mul" | "div", title: string, combos: Combo[], places: number, dec?: [number, number], times = 1, o: object = {}): Section =>
  ({ kind, title, places, groups: Array.from({ length: times }, () => ({ combos, dec })), ...o });
const sheetNo = ["一", "二", "三", "四", "五", "六"];

// ===== ① 珠算技术等级鉴定(2020) =====
const ZS_ADD: Record<number, AddsubPart[]> = {
  10: [P(20, { 1: 10 }, 3)],
  9: [P(20, { 2: 5, 1: 5 }, 3)],
  8: [P(10, { 3: 3, 2: 4, 1: 3 }, 3)],
  7: [P(10, { 4: 3, 3: 4, 2: 3 }, 3)],
  6: [P(10, { 4: 4, 3: 4, 2: 6 }, 5)],
  5: [P(10, { 4: 5, 3: 10 }, 5)],
  4: [P(10, { 6: 2, 5: 2, 4: 5, 3: 6 }, 5)],
  3: [P(10, { 6: 4, 5: 5, 4: 3, 3: 3 }, 5, { decN: 5 })],
  2: [P(10, { 7: 2, 6: 5, 5: 4, 4: 4 }, 5, { decN: 5 })],
  1: [P(10, { 8: 3, 7: 3, 6: 3, 5: 3, 4: 3 }, 5, { decN: 5 })],
  // 能手级:1–5、11–15 题为小数 15 行;6–10、16–20 题为整数 20 行;第 10 题倒减得正、第 20 题倒减得负
  0: [
    P(5, { 10: 3, 9: 3, 8: 3, 7: 3, 6: 3 }, 5, { dec: true }), P(5, { 8: 4, 7: 4, 6: 4, 5: 4, 4: 4 }, 7, { reverse: "pos" }),
    P(5, { 10: 3, 9: 3, 8: 3, 7: 3, 6: 3 }, 5, { dec: true }), P(5, { 8: 4, 7: 4, 6: 4, 5: 4, 4: 4 }, 7, { reverse: "neg" }),
  ],
};
const ZS_MUL: Record<number, [Combo[], [number, number] | undefined, number]> = {
  1: [[[5, 4, 2], [4, 5, 2], [4, 4, 6]], [2, 3], 2],
  2: [[[4, 4, 4], [5, 3, 1], [3, 5, 1], [4, 3, 2], [3, 4, 2]], [2, 2], 2],
  3: [[[5, 3, 1], [3, 5, 1], [4, 3, 2], [3, 4, 2], [3, 3, 4]], [2, 1], 2],
  4: [[[4, 3, 1], [3, 4, 1], [3, 3, 2], [4, 2, 3], [2, 4, 3]], [1, 1], 2],
  5: [[[3, 3, 2], [4, 2, 1], [2, 4, 1], [3, 2, 3], [2, 3, 3]], [1, 1], 2],
  6: [[[3, 2, 3], [2, 3, 3], [2, 2, 4]], undefined, 0],
  7: [[[2, 2, 4], [3, 1, 3], [1, 3, 3]], undefined, 0],
  8: [[[3, 1, 5], [1, 3, 5], [2, 1, 5], [1, 2, 5]], undefined, 0],
  0: [[[6, 5, 2], [5, 6, 2], [6, 4, 2], [4, 6, 2], [5, 5, 2], [5, 4, 3], [4, 5, 3], [4, 4, 4]], [4, 4], 4],
};
const ZS_DIV: Record<number, [Combo[], [number, number] | undefined, number]> = {
  1: [[[3, 5, 2], [5, 3, 2], [3, 4, 3], [4, 3, 3]], [2, 2], 2],
  2: [[[3, 5, 1], [5, 3, 1], [3, 4, 2], [4, 3, 2], [3, 3, 4]], [2, 2], 2],
  3: [[[3, 4, 1], [4, 3, 1], [3, 3, 8]], [2, 1], 2],
  4: [[[3, 3, 4], [2, 3, 3], [3, 2, 3]], [1, 1], 2],
  5: [[[2, 3, 3], [3, 2, 3], [2, 2, 4]], [1, 1], 2],
  6: [[[2, 2, 10]], undefined, 0],
  7: [[[1, 3, 5], [1, 2, 5]], undefined, 0],
  0: [[[6, 4, 3], [4, 6, 3], [5, 5, 2], [5, 4, 4], [4, 5, 4], [4, 4, 4]], [4, 4], 4],
};
function zsLevel(lv: number, idPrefix = "zs2020", ref?: string, titlePrefix = "珠算技术"): ExamSpec {
  const name = lv === 0 ? "能手级" : `普通${CN[lv]}级`;
  const sections: Section[] = [add("加减算", ZS_ADD[lv])];
  // 《珠算技术等级鉴定标准》表三说明:「积的位数要求占实法位数和的 83%,上下浮动 3%」(珠心算标准没有这条)
  if (ZS_MUL[lv]) { const [c, d, p] = ZS_MUL[lv]; sections.push(md("mul", "乘算", c, p, d, 1, { prodRatio: 0.83 })); }
  if (ZS_DIV[lv]) { const [c, d, p] = ZS_DIV[lv]; sections.push(md("div", "除算", c, p, d)); }
  return { id: `${idPrefix}-${lv}`, label: lv === 0 ? "能手级" : `${CN[lv]}级`, title: `${titlePrefix}${name}鉴定模拟题`, level: `珠算${name}`, minutes: 20, sections, ref };
}

// ===== ② 珠心算鉴定(2020)等级 + 段位 =====
const ZX_ADD: Record<number, AddsubPart[]> = {
  10: [P(30, { 1: 4 }, 1)],
  9: [P(20, { 1: 6 }, 1), P(10, { 2: 1, 1: 4 }, 1)],
  8: [P(20, { 2: 2, 1: 4 }, 1), P(10, { 2: 4 }, 1)],
  7: [P(20, { 2: 4, 1: 2 }, 2), P(10, { 2: 5 }, 2)],
  6: [P(20, { 2: 4, 1: 4 }, 2)],
  5: [P(20, { 2: 6, 1: 2 }, 2)],
  4: [P(20, { 2: 8 }, 2)],
  3: [P(20, { 3: 2, 2: 6 }, 2)],
  2: [P(20, { 3: 5, 2: 5 }, 3)],
  1: [P(20, { 3: 10 }, 3)],
};
const ZX_MUL: Record<number, Combo[]> = {
  6: [[2, 1, 20], [1, 2, 20]], 5: [[2, 1, 10], [1, 3, 10]], 4: [[3, 1, 10], [1, 3, 10]],
  3: [[2, 2, 5], [3, 1, 10], [1, 3, 5]], 2: [[2, 2, 10], [3, 1, 10]], 1: [[3, 2, 2], [2, 3, 3], [2, 2, 15]],
};
const ZX_DIV: Record<number, Combo[]> = {
  5: [[1, 2, 20]], 4: [[1, 3, 10], [1, 2, 10]], 3: [[1, 3, 15], [1, 2, 5]], 2: [[2, 2, 10], [2, 1, 5], [1, 3, 5]], 1: [[2, 2, 20]],
};
function zxLevel(lv: number, idPrefix: string, ref?: string, tag = ""): ExamSpec {
  const sections: Section[] = [add("加减算", ZX_ADD[lv])];
  if (ZX_MUL[lv]) sections.push(md("mul", "乘算", ZX_MUL[lv], 0));
  if (ZX_DIV[lv]) sections.push(md("div", "除算", ZX_DIV[lv], 0));
  return { id: `${idPrefix}-${lv}`, label: `${CN[lv]}级`, title: `珠心算${CN[lv]}级鉴定模拟题${tag}`, level: `珠心算${CN[lv]}级`, minutes: 10, sections, ref };
}
// 2026-10-26 对照中珠协《珠心算段位鉴定模拟题》样卷:加减由易到难 —— 加减算（一）1–10 题 10 行、加减算（二）11–20 题 15 行;
// 乘算前 12 题整数(由小到大),后 8 题是位数最多的 8 题、带小数(四舍 4、五入 4);除算小数题随机穿插
const ZX_DAN: ExamSpec = {
  id: "zx2020-dan", label: "段位", title: "珠心算段位鉴定模拟题", level: "珠心算段位", minutes: 10,
  sections: [
    add("加减算（一）", [P(5, { 4: 5, 3: 5 }, 3, { decN: 2 }), P(5, { 5: 3, 4: 4, 3: 3 }, 3, { decN: 2 })]),
    add("加减算（二）", [
      P(5, { 6: 3, 5: 4, 4: 3, 3: 5 }, 5, { decN: 2 }),
      P(3, { 8: 3, 7: 3, 6: 3, 5: 3, 4: 3 }, 0, { decN: 1 }),
      P(2, { 10: 3, 9: 3, 8: 3, 7: 3, 6: 3 }, 5, { mixN: 2, decN: 1 }),
    ], { newPage: true }),
    { ...md("mul", "乘算", [[6, 5, 2], [5, 5, 2], [4, 5, 2], [3, 5, 2], [4, 3, 3], [3, 3, 3], [3, 2, 3], [2, 3, 3]], 2, [4, 4], 1, { newPage: true }), groups: [{ combos: [[6, 5, 2], [5, 5, 2], [4, 5, 2], [3, 5, 2], [4, 3, 3], [3, 3, 3], [3, 2, 3], [2, 3, 3]], dec: [4, 4], decHard: true }] } as Section,
    md("div", "除算", [[5, 5, 2], [4, 5, 2], [3, 5, 2], [4, 3, 2], [3, 4, 3], [3, 3, 3], [3, 2, 3], [2, 3, 3]], 2, [4, 4]),
  ],
};

// ===== 2006 少儿珠心算(试行):加减各级 10 题,字数/行数按标准;一~六级乘除各 10 题(组合参考 2020) =====
const Z06_ADD: Record<number, Record<number, number>> = {
  1: { 3: 10 }, 2: { 3: 5, 2: 5 }, 3: { 3: 4, 2: 4 }, 4: { 3: 2, 2: 6 }, 5: { 2: 7 }, 6: { 2: 5, 1: 2 }, 7: { 2: 4, 1: 2 }, 8: { 2: 2, 1: 3 }, 9: { 2: 1, 1: 3 }, 10: { 1: 3 },
};
const Z06_MUL: Record<number, Combo[]> = {
  1: [[3, 2, 1], [2, 3, 1], [2, 2, 8]], 2: [[2, 2, 5], [3, 1, 5]], 3: [[2, 2, 2], [3, 1, 5], [1, 3, 3]], 4: [[3, 1, 5], [1, 3, 5]], 5: [[2, 1, 5], [1, 3, 5]], 6: [[2, 1, 5], [1, 2, 5]], 7: [[2, 1, 5], [1, 2, 5]],
};
const Z06_DIV: Record<number, Combo[]> = {
  1: [[2, 2, 10]], 2: [[2, 2, 5], [2, 1, 2], [1, 3, 3]], 3: [[1, 3, 7], [1, 2, 3]], 4: [[1, 3, 5], [1, 2, 5]], 5: [[1, 2, 10]], 6: [[1, 2, 10]], 7: [[1, 2, 10]],
};
function z06Level(lv: number, id: string, mdUpTo: number, ref: string, tag: string): ExamSpec {
  const d = Z06_ADD[lv], rows = Object.values(d).reduce((a, b) => a + b, 0);
  const sections: Section[] = [add("加减算", [P(10, d, rows >= 10 ? 3 : rows >= 7 ? 2 : 1)])];
  if (lv <= mdUpTo) { sections.push(md("mul", "乘算", Z06_MUL[lv], 0)); sections.push(md("div", "除算", Z06_DIV[lv], 0)); }
  return { id: `${id}-${lv}`, label: `${CN[lv]}级`, title: `珠心算${CN[lv]}级鉴定模拟题${tag}`, level: `珠心算${CN[lv]}级`, minutes: lv <= 6 ? 10 : 5, sections, ref };
}

// ===== ③ 全国珠心算比赛(纸质试卷题型标准)=====
const D15 = { 10: 3, 9: 3, 8: 3, 7: 3, 6: 3 }, I20 = { 8: 4, 7: 4, 6: 4, 5: 4, 4: 4 };
const LV4 = { 6: 2, 5: 2, 4: 5, 3: 6 }, LV3 = { 6: 4, 5: 5, 4: 3, 3: 3 }, LV2 = { 7: 2, 6: 5, 5: 4, 4: 4 }, LV5 = { 4: 5, 3: 10 }, LV6 = { 4: 4, 3: 4, 2: 6 }, LV7 = { 4: 3, 3: 4, 2: 3 }, LV8 = { 3: 3, 2: 4, 1: 3 }, LV9 = { 2: 5, 1: 5 };
const MUL_L: Record<number, [Combo[], [number, number] | undefined]> = {
  2: [[[4, 4, 4], [5, 3, 1], [3, 5, 1], [4, 3, 2], [3, 4, 2]], [2, 2]], 3: [[[5, 3, 1], [3, 5, 1], [4, 3, 2], [3, 4, 2], [3, 3, 4]], [2, 1]],
  4: [[[4, 3, 1], [3, 4, 1], [3, 3, 2], [4, 2, 3], [2, 4, 3]], [1, 1]], 5: [[[3, 3, 2], [4, 2, 1], [2, 4, 1], [3, 2, 3], [2, 3, 3]], [1, 1]], 6: [[[3, 2, 3], [2, 3, 3], [2, 2, 4]], undefined],
};
const DIV_L: Record<number, [Combo[], [number, number] | undefined]> = {
  2: [[[3, 5, 1], [5, 3, 1], [3, 4, 2], [4, 3, 2], [3, 3, 4]], [2, 2]], 3: [[[3, 4, 1], [4, 3, 1], [3, 3, 8]], [2, 1]],
  4: [[[3, 3, 4], [2, 3, 3], [3, 2, 3]], [1, 1]], 5: [[[2, 3, 3], [3, 2, 3], [2, 2, 4]], [1, 1]], 6: [[[2, 2, 10]], undefined],
};
/** 比赛乘除:每张 60 题 = 6 组 × 10 题,各张对应一个鉴定级别 */
const compMd = (kind: "mul" | "div", levels: number[], minutes = 5): Section[] =>
  levels.map((lv, i) => {
    const [c, d] = (kind === "mul" ? MUL_L : DIV_L)[lv];
    return md(kind, `${kind === "mul" ? "乘算" : "除算"}（${sheetNo[i]}）`, c, d ? 2 : 0, d, 6, { newPage: i > 0, minutes });
  });
const compAdd = (sheets: AddsubPart[][], minutes = 5): Section[] => sheets.map((parts, i) => add(`加减算（${sheetNo[i]}）`, parts, { newPage: i > 0, minutes }));
// 2026-10-25 用户「全国比赛的题也按样卷检查」:样卷(附件7–12,B4)与世界比赛同一种版式——每个部分独占一张、题量固定、乘除 2 栏 × 30 行
// 2026-10-26 付海东「难度顺序也要按照样题的顺序来」:全国样题乘除每 10 题(精英组每 20 题)一组、组内按位数合计由易到难,一组一组往下排 → 不打乱(世界比赛样卷才是随机)
//   → style "cn" 走同一套逐张版面(中文页眉,无英文行)
const comp = (id: string, label: string, group: string, sections: Section[], minutes = 5, ref?: string, titleBase = "全国珠心算比赛模拟题"): ExamSpec =>
  ({ id, label, title: titleBase, level: group, minutes, ref, style: "cn", group: ["", group],
    sections: sections.map((s, i) => (s.kind === "addsub" ? { ...s, newPage: i > 0 } : { ...s, newPage: i > 0, cols: 2, ...(s.kind === "mul" ? { prodRatio: 0.83 } : {}) })) });
// 全国比赛乘算标准:「积的位数要求占实法位数和的 83%,上下浮动 3%,即 80%–86% 之间」(比赛题型.pdf)

const CN_ELITE_ADD = compAdd(Array.from({ length: 5 }, () => [P(5, D15, 5, { dec: true }), P(5, I20, 7)]));
const ELITE_MUL20: Combo[] = [[7, 4, 1], [4, 7, 1], [6, 5, 1], [5, 6, 2], [6, 4, 2], [4, 6, 1], [5, 5, 2], [5, 4, 3], [4, 5, 2], [4, 4, 2], [5, 3, 1], [3, 5, 2]];
const ELITE_DIV20: Combo[] = [[6, 4, 2], [4, 6, 2], [5, 5, 1], [5, 4, 3], [4, 5, 2], [5, 3, 2], [3, 5, 2], [4, 4, 1], [4, 3, 2], [3, 4, 3]];
const CN_ELITE_MUL = [md("mul", "乘算（一）", ELITE_MUL20, 2, [6, 6], 3, { minutes: 5 }), md("mul", "乘算（二）", ELITE_MUL20, 4, [6, 6], 3, { newPage: true, minutes: 5 })];
const CN_ELITE_DIV = [md("div", "除算（一）", ELITE_DIV20, 2, [8, 8], 3, { minutes: 5 }), md("div", "除算（二）", ELITE_DIV20, 4, [8, 8], 3, { newPage: true, minutes: 5 }), md("div", "除算（三）", ELITE_DIV20, 4, [8, 8], 3, { newPage: true, minutes: 5 })];
const CN_A_ADD = compAdd([[P(15, LV4, 5)], [P(15, LV3, 5, { decN: 10 })], [P(15, LV2, 5, { decN: 5 })], [P(15, LV2, 5, { decN: 10 })]]);
const CN_B_ADD = compAdd([[P(30, LV5, 5)], [P(15, LV4, 5)], [P(15, LV3, 5, { decN: 5 })], [P(15, LV3, 5, { decN: 10 })]]);
const CN_C_ADD = compAdd([[P(30, LV6, 5)], [P(30, LV5, 5)], [P(15, LV4, 5)], [P(15, LV4, 5)]]);
const CN_D_ADD = compAdd([[P(30, LV7, 3)], [P(30, LV6, 5)], [P(30, LV5, 5)], [P(30, LV5, 5)]]);
const CN_Y_ADD = compAdd([[P(30, LV9, 3)], [P(30, LV8, 3)], [P(30, LV7, 3)], [P(30, LV7, 3)]]);

// ===== ④ 世界珠心算比赛:第九届模拟题样卷(2026-02-28,付海东转来)逐张对照 =====
// 2026-10-25 用户「B 组和 A 组题型一样、C 组和 D 组题型一样」「从排版到题量每一张都要一模一样」「一张 54 题、第二张 66 题不行,每张要平均」
//   A(B)组:加减（一）30 题 + （二）~（四）各 20 题;乘（一）（二）、除（一）（二）各 120 题(4 栏 × 30 行)
//   C(D)组:加减（一）~（四）各 30 题
//   选手组:加减（一）~（三）各 15 题;乘、除各两张,每张 60 题(2 栏 × 30 行),保留三位小数
const W_MD: Combo[] = [[5, 6, 5], [6, 5, 5], [7, 4, 5], [4, 7, 5]];
const W_AB_ADD = compAdd([[P(30, { 4: 3, 3: 4, 2: 3 }, 3)], [P(20, { 4: 4, 5: 2, 6: 4 }, 3)], [P(20, { 4: 4, 5: 2, 6: 4 }, 3)], [P(20, { 4: 4, 5: 2, 6: 4 }, 3)]], 3);
const wMd = (kind: "mul" | "div", c1: Combo[], t1: number, c2: Combo[], t2: number, places: number, dec: [number, number] | undefined, cols: number): Section[] =>
  [[c1, t1], [c2, t2]].map(([c, t], i) => md(kind, `${kind === "mul" ? "乘算" : "除算"}（${sheetNo[i]}）`, c as Combo[], places, dec, t as number, { newPage: i > 0, minutes: 3, shuffle: true, cols }));
const W_AB_MUL = wMd("mul", [[2, 2, 2], [3, 2, 4], [2, 3, 4]], 12, [[3, 3, 1], [2, 4, 1], [4, 2, 1]], 40, 0, undefined, 4);
const W_AB_DIV = wMd("div", [[2, 2, 2], [3, 2, 4], [2, 3, 4]], 12, [[3, 3, 1], [2, 4, 1], [4, 2, 1]], 40, 0, undefined, 4);
const W_CD_ADD = compAdd([[P(30, { 1: 3, 2: 2, 3: 1 }, 2)], [P(30, { 2: 4, 3: 2, 4: 4 }, 3)], [P(30, { 2: 4, 3: 2, 4: 4 }, 3)], [P(30, { 2: 4, 3: 2, 4: 4 }, 3)]], 3);
const W_P_ADD = compAdd([0, 1, 2].map(() => [P(15, D15, 5)]), 3);
const W_P_MUL = wMd("mul", W_MD, 3, W_MD, 3, 3, [4, 4], 2);
const W_P_DIV = wMd("div", W_MD, 3, W_MD, 3, 3, [4, 4], 2);
const W_GROUPS: Record<"ab" | "cd" | "p", [string, string]> = { ab: ["Group A and Group B", "A组和B组"], cd: ["Group C and Group D", "C组和D组"], p: ["Group of player", "选手组"] };
const wSpec = (id: string, label: string, g: keyof typeof W_GROUPS, sections: Section[]): ExamSpec =>
  ({ id, label, title: "世界珠心算比赛模拟题", level: W_GROUPS[g][1], minutes: 3, style: "waama", group: W_GROUPS[g], sections: sections.map((s, i) => ({ ...s, newPage: i > 0 })) });
const subGroup = (title: string) => (subs: ExamSub[]): ExamGroup => ({ title, subs, specs: subs.flatMap((x) => x.specs) });
const worldGroup = subGroup("世界珠心算比赛模拟题"), cnGroup = subGroup("全国珠心算比赛模拟题");


export const EXAM_TABS: ExamTab[] = [
  {
    // 2026-10-25 用户「上面不应该有两个(珠心算鉴定、珠算鉴定),应该就是一个」→ 合成「等级鉴定」;随后「珠心算 2020/2006/1999/2021 上海这几组都不要」→ 只留珠算 2021 最新标准
    // (珠心算各级的出题数据 zxLevel / ZX_DAN / z06Level 仍保留在本文件,需要时加回分组即可)
    id: "jd", label: "等级鉴定",
    groups: [
      // 2026-10-25 用户「珠算鉴定只要 2021 年最新标准就可以了」:只保留中珠协 2020 年版(2021-01-01 起施行),去掉重复的七~十级分组
      { title: "珠算技术等级鉴定题型（2021年最新标准）", note: "中珠协《珠算技术等级鉴定标准（2020年版）》，2021年1月1日起施行", specs: [...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lv) => zsLevel(lv)), zsLevel(0)] },
      // 2026-10-26 付海东「一个是珠算等级鉴定,还有一个是心算等级鉴定,这个咋没有了」→ 加回珠心算(2020 年版,2021 起施行;已对照一~十级、段位样卷)
      { title: "珠心算等级鉴定题型（2021年最新标准）", note: "中珠协《珠心算鉴定标准（2020年版）》，2021年1月1日起施行", specs: [...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lv) => zxLevel(lv, "zx2020")), ZX_DAN] },
    ],
  },
  {
    id: "comp", label: "比赛题型",
    groups: [
      // 2026-10-25 用户「世界珠心算比赛模拟题一整个大块,里面分类」;随后「全套不用,单独生成,也不用备注几张,就加减算、乘算、除算」「内容最好一个界面能放下」
      //   → 每个组别一行:组别名 + 加减算 / 乘算 / 除算(全国比赛同样按组别分行)
      worldGroup([
        { title: "A(B)组", specs: [wSpec("w9-ab-add", "加减算", "ab", W_AB_ADD), wSpec("w9-ab-mul", "乘算", "ab", W_AB_MUL), wSpec("w9-ab-div", "除算", "ab", W_AB_DIV)] },
        { title: "C(D)组", specs: [wSpec("w9-cd-add", "加减算", "cd", W_CD_ADD)] },
        { title: "选手组", specs: [wSpec("w9-p-add", "加减算", "p", W_P_ADD), wSpec("w9-p-mul", "乘算", "p", W_P_MUL), wSpec("w9-p-div", "除算", "p", W_P_DIV)] },
      ]),
      cnGroup([
        { title: "A组", specs: [comp("cn-a-add", "加减算", "少儿A组", CN_A_ADD), comp("cn-a-mul", "乘算", "少儿A组", compMd("mul", [4, 3, 2, 2])), comp("cn-a-div", "除算", "少儿A组", compMd("div", [4, 3, 2, 2]))] },
        { title: "B组", specs: [comp("cn-b-add", "加减算", "少儿B组", CN_B_ADD), comp("cn-b-mul", "乘算", "少儿B组", compMd("mul", [5, 4, 3, 3])), comp("cn-b-div", "除算", "少儿B组", compMd("div", [5, 4, 3, 3]))] },
        { title: "C组", specs: [comp("cn-c-add", "加减算", "少儿C组", CN_C_ADD), comp("cn-c-mul", "乘算", "少儿C组", compMd("mul", [6, 5, 4, 4])), comp("cn-c-div", "除算", "少儿C组", compMd("div", [6, 5, 4, 4]))] },
        { title: "D组", specs: [comp("cn-d-add", "加减算", "少儿D组", CN_D_ADD)] },
        { title: "幼儿组", specs: [comp("cn-y-add", "加减算", "幼儿组", CN_Y_ADD)] },
        { title: "精英组", specs: [comp("cn-e-add", "加减算", "精英组", CN_ELITE_ADD), comp("cn-e-mul", "乘算", "精英组", CN_ELITE_MUL), comp("cn-e-div", "除算", "精英组", CN_ELITE_DIV)] },
      ]),
      // 2026-10-25 用户「比赛题型里薪火传承的不要,下面的大班小班(珠心算应用)不要」→ 已下架
    ],
  },
];

export const findSpec = (id: string): ExamSpec | undefined => EXAM_TABS.flatMap((t) => t.groups.flatMap((g) => g.specs)).find((s) => s.id === id);
