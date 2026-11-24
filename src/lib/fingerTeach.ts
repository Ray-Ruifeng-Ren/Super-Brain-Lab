// 指法教学 · 例题讲解引擎(2026-11-02 用户:教练端加「指法教学」—— 老师自己输入例题,进入讲解模式:语音 + 算盘实时拨珠 + 手指动画)。
// 讲法依据付海东《海东青虚拟珠像传习所》教材(第一册直加直减 / 满五加 / 破五减,第二册进位加 / 破五进位加 / 退位减 / 退位满五减 / 满五十加减 / 连续进退位):
//   · 拨珠手指(教材第一册「拨珠方法」):下珠往上拨用拇指、下珠往下拨用食指、上珠上下都用食指;
//     拇指食指同时:双合(上下珠一起靠梁)、双分(一起离梁)、双上(一起往上)、双下(一起往下)。
//   · 多位数从高位到低位逐档拨(教材例题 55+89:先 +80 再 +9);一档里本档先动,前档进 1 / 退 1 在后(「离梁进一」「靠梁退一」)。
//   · 判类沿用 lib/fingering.classifyStep(归类看珠不看数)。
//   · 手:不进位、不退位的全部右手;进位 / 退位时右手拨本档,左手在前一档进 1 / 退 1(含满五十加减、连续进退位)。
// 讲解话术集中在下面 SAY / RHYME 两处,付海东要改说法只改这里。
// 2026-11-02 改用用户整理的八类话术(「这是每个类别的话术」「每一步先讲解,再做动作」):
//   2加7等于，右手拇指拨入2，加7，右手拇指和食指同时拨入7，答案等于9 …… 进位 / 退位时右手本档与左手前一档「同时」拨。
import { classifyStep, stageForClass, type FingeringClass } from "@/lib/fingering";

export type Finger = "thumb" | "index" | "both";
export type MoveKind = "入" | "去" | "双合" | "双分" | "双上" | "双下";
/** 一次拨珠:某一档从 before 变到 after(只这一档变);upper / lower 是上珠、下珠各自的动作 */
export interface BeadAction {
  rod: number;           // 0 = 个位
  hand: "right" | "left"; // 2026-11-02 用户:不进位全部右手;进位 / 退位时前一档(进 1、退 1)用左手(教材双手拨珠)
  finger: Finger;
  move: MoveKind;
  before: number;        // 本档拨前的数
  after: number;
  upper?: "down" | "up"; // 上珠:down = 靠梁(+5),up = 离梁(−5)
  lower?: number;        // 下珠:+n 往上靠梁,−n 往下离梁
}
export interface TeachStep {
  label: string;                        // 「2」「+7」「+80」
  term: number;                         // 第几个数(竖式里高亮这一行)
  cls: FingeringClass | "拨入";
  say: string;                          // 这一步要说的话(也显示在屏幕上)
  actions: BeadAction[];                // 依次播放的拨珠动作
  mark?: number;                        // 乘除:这一步从哪一档起(算盘上方画 ▼)
}
export interface Lesson {
  expr: string;                         // 规范化后的算式「2+7」
  speakExpr: string;                    // 读法「2 加 7」
  terms: number[];                      // 带符号
  answer: number;
  rods: number;                         // 算盘显示几档
  steps: TeachStep[];
  classes: FingeringClass[];            // 出现过的指法(口诀卡用)
  op?: "×" | "÷";                       // 乘除讲解(2026-11-08):算盘档从左数「第几档」,不标个十百
  a?: number; b?: number;               // 乘除的两个数(左栏横式)
  rule?: string;                        // 乘除的定位口诀(代替加减的指法口诀卡)
}

// ===== 话术(按教材 + 用户给的示范句) =====
const PLACE = ["个位", "十位", "百位", "千位", "万位", "十万位"];
/** 教材每类的「讲解」原句(口诀卡) */
export const RHYME: Record<FingeringClass, string> = {
  直加: "加看框珠够不够加，够加，加几就让几靠梁。",
  直减: "减看梁珠够不够减，够减，减几就让几离梁。",
  满五加: "下看框珠够不够加，不够，加几就找几的好朋友滑滑梯。",
  破五减: "下看梁珠够不够减，不够减，减几就让几的好朋友开飞机。",
  进位加: "看个位档够不够加，不够加，加几就找你的好朋友离梁进一。",
  破五进位加: "看个位档够不够加，不够加，找好朋友，好朋友不能帮忙靠自己，加几就让几自己上前进一。",
  退位减: "看个位档够不够减，不够减，减几，就让几的好朋友靠梁退一。",
  退位满五减: "看个位档够不够减，不够减，找好朋友，好朋友不能帮忙靠自己，减几，就让几自己下来退一。",
};
// ===== 英文讲解(2026-11-08 用户「如果是英文的话,讲解也要全是英文」):buildLesson(raw, "en") 时整套话术换英文 =====
let EN = false;
const PLACE_EN = ["ones", "tens", "hundreds", "thousands", "ten-thousands", "hundred-thousands"];
const ord = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;
const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
export const RHYME_EN: Record<FingeringClass, string> = {
  直加: "Direct add: if there are enough free beads, push up as many as you add.",
  直减: "Direct subtract: if there are enough beads on the beam, take away as many as you subtract.",
  满五加: "Add using 5: not enough lower beads — bring down the 5 and take away its partner.",
  破五减: "Subtract using 5: not enough lower beads — lift the 5 and push up its partner.",
  进位加: "Add with carry: this rod can't take it — remove the complement and carry 1 to the left.",
  破五进位加: "Five & carry: the complement can't be removed directly — push up (x−5), lift the 5 and carry 1.",
  退位减: "Subtract with borrow: not enough on this rod — borrow 1 from the left and add the complement.",
  退位满五减: "Borrow using 5: the complement can't be added directly — bring down 5, remove (x−5) and borrow 1.",
};
const addText = (x: number) => EN ? (x < 5 ? `right thumb pushes up ${x}` : x === 5 ? "right index finger brings down the 5 bead" : `right thumb and index finger together set ${x}`) : (x < 5 ? `右手拇指拨入${x}` : x === 5 ? "右手食指拨入5" : `右手拇指和食指同时拨入${x}`);
const subText = (x: number) => EN ? (x < 5 ? `right index finger takes away ${x}` : x === 5 ? "right index finger lifts away the 5 bead" : `right thumb and index finger together take away ${x}`) : (x < 5 ? `右手食指减${x}` : x === 5 ? "右手食指减5" : `右手拇指和食指同时减${x}`);
/** 第一个数:2 → 右手拇指拨入2;5 / 两位以上 → 右手拨入5、右手拨入12;6–9 → 右手拇指和食指同时拨入7 */
const firstText = (n: number) => EN ? (n < 5 ? `right thumb pushes up ${n}` : n === 5 || n >= 10 ? `right hand sets ${n}` : `right thumb and index finger together set ${n}`) : (n < 5 ? `右手拇指拨入${n}` : n === 5 || n >= 10 ? `右手拨入${n}` : `右手拇指和食指同时拨入${n}`);
const placeOf = (k: number) => (EN ? PLACE_EN[k] ?? `rod ${k + 1}` : PLACE[k] ?? `第${k + 1}位`);
/** 前一档连续进 / 退(99+1、100−1):左手那一下之外再补一句 */
const chainNote = (k: number, n: number, word: "进" | "借") => (n <= 1 ? "" : EN ? `; the ${placeOf(k + 1)} rod can't take it either, so ${word === "进" ? "carry 1 into" : "borrow 1 from"} the ${placeOf(k + 2)} rod` : `，${placeOf(k + 1)}档不够，再向${placeOf(k + 2)}档${word}1`);

// ===== 算盘状态与基本拨法 =====
type Rods = number[]; // 小端:rods[0] = 个位

function directAdd(rods: Rods, k: number, x: number, hand: "right" | "left" = "right"): BeadAction {
  const before = rods[k], after = before + x;
  rods[k] = after;
  if (x < 5) return { rod: k, hand, finger: "thumb", move: "入", before, after, lower: x };
  if (x === 5) return { rod: k, hand, finger: "index", move: "入", before, after, upper: "down" };
  return { rod: k, hand, finger: "both", move: "双合", before, after, upper: "down", lower: x - 5 };
}
function directSub(rods: Rods, k: number, x: number, hand: "right" | "left" = "right"): BeadAction {
  const before = rods[k], after = before - x;
  rods[k] = after;
  if (x < 5) return { rod: k, hand, finger: "index", move: "去", before, after, lower: -x };
  if (x === 5) return { rod: k, hand, finger: "index", move: "去", before, after, upper: "up" };
  return { rod: k, hand, finger: "both", move: "双分", before, after, upper: "up", lower: -(x - 5) };
}

/** 在第 k 档加 x(1–9),返回动作和这一笔的说法(carry=true 表示这是前档进 1) */
function addAt(rods: Rods, k: number, x: number, carry = false): { cls: FingeringClass; actions: BeadAction[]; say: string } {
  const d = rods[k];
  const cls = classifyStep(d, x);
  const hand = carry ? "left" : "right";
  if (cls === "直加") {
    const a = directAdd(rods, k, x, hand);
    return { cls, actions: [a], say: carry ? (EN ? "left thumb carries 1" : "左手拇指进1") : addText(x) };
  }
  if (cls === "满五加") {
    const before = d; rods[k] = d + x;
    const a: BeadAction = { rod: k, hand, finger: "both", move: "双下", before, after: d + x, upper: "down", lower: -(5 - x) };
    return { cls, actions: [a], say: carry ? (EN ? "left thumb and index finger move down together" : "左手拇指和食指同时双下") : EN ? `not enough lower beads, use ${x}'s partner ${10 - x}: right thumb and index finger move down together` : `下珠不够加，找${x}的补数${10 - x}，右手拇指和食指同时双下补数${10 - x}` };
  }
  const comp = 10 - x;
  if (cls === "进位加") {
    const a = directSub(rods, k, comp, hand);
    const c = addAt(rods, k + 1, 1, true);
    const fingers = comp <= 5 ? "食指" : "拇指和食指";
    return { cls, actions: [a, ...c.actions], say: carry ? (EN ? "left hand removes 9" : "左手拨去9") : EN ? `not enough on this rod, use ${x}'s complement ${comp}: right ${comp <= 5 ? "index finger" : "thumb and index finger"} removes ${comp} while the left thumb carries 1${chainNote(k, c.actions.length, "进")}` : `本档不够加，找${x}的补数${comp}，右手${fingers}拨去${comp}的同时，左手拇指进1${chainNote(k, c.actions.length, "进")}` };
  }
  // 破五进位加(x ≥ 6):双上 —— 上 (x−5) 去 5,再进 1
  const before = d; rods[k] = d + x - 10;
  const a: BeadAction = { rod: k, hand, finger: "both", move: "双上", before, after: rods[k], upper: "up", lower: x - 5 };
  const c = addAt(rods, k + 1, 1, true);
  return { cls, actions: [a, ...c.actions], say: EN ? `not enough on this rod and the complement can't be removed directly, so push up ${x - 5} and lift the 5 with the right thumb and index finger, while the left hand carries 1 on the ${placeOf(k + 1)} rod${chainNote(k, c.actions.length, "进")}` : `本档不够加，且不能减补进1，加几就上几进1，右手拇指和食指双上${x}，同时左手在${placeOf(k + 1)}档进一${chainNote(k, c.actions.length, "进")}` };
}

/** 在第 k 档减 x(1–9);borrow=true 表示这是前档退 1 */
function subAt(rods: Rods, k: number, x: number, borrow = false): { cls: FingeringClass; actions: BeadAction[]; say: string } {
  const d = rods[k];
  const cls = classifyStep(d, -x);
  const hand = borrow ? "left" : "right";
  if (cls === "直减") {
    const a = directSub(rods, k, x, hand);
    return { cls, actions: [a], say: borrow ? (EN ? "left index finger borrows 1" : "左手食指借1") : subText(x) };
  }
  if (cls === "破五减") {
    const before = d; rods[k] = d - x;
    const a: BeadAction = { rod: k, hand, finger: "both", move: "双上", before, after: d - x, upper: "up", lower: 5 - x };
    return { cls, actions: [a], say: borrow ? (EN ? "left thumb and index finger move up together" : "左手拇指和食指同时双上") : EN ? `not enough lower beads, use ${x}'s partner ${10 - x}: right thumb and index finger move up together` : `下珠不够减，找${x}的补数${10 - x}，右手拇指和食指同时双上补数${10 - x}` };
  }
  const comp = 10 - x;
  if (cls === "退位减") {
    const a = directAdd(rods, k, comp, hand);
    const b = subAt(rods, k + 1, 1, true);
    return { cls, actions: [a, ...b.actions], say: borrow ? (EN ? "left hand adds 9" : "左手拨入9") : EN ? `not enough on this rod, use ${x}'s complement ${comp}: the right hand adds ${comp} while the left hand borrows 1 from the ${placeOf(k + 1)} rod${chainNote(k, b.actions.length, "借")}` : `本档不够减，找${x}的补数${comp}，右手加${comp}，同时左手在${placeOf(k + 1)}档借1${chainNote(k, b.actions.length, "借")}` };
  }
  // 退位满五减(x ≥ 6):双下 —— 下 5 去 (x−5),再退 1
  const before = d; rods[k] = d + 10 - x;
  const a: BeadAction = { rod: k, hand, finger: "both", move: "双下", before, after: rods[k], upper: "down", lower: -(x - 5) };
  const b = subAt(rods, k + 1, 1, true);
  return { cls, actions: [a, ...b.actions], say: EN ? `not enough on this rod and the complement can't be added directly, so bring down the 5 and remove ${x - 5} with the right thumb and index finger, while the left hand borrows 1 from the ${placeOf(k + 1)} rod${chainNote(k, b.actions.length, "借")}` : `本档不够减，且不能借1加补，减几就下几借1，右手拇指和食指双下${x}，同时左手在${placeOf(k + 1)}档借1${chainNote(k, b.actions.length, "借")}` };
}

// ===== 解析 + 生成讲解 =====
/** 「2+7」「3 + 4 − 2」「45＋38」「12-6」都认;只认加减;每个数最多 6 位、最多 8 个数;中途不能出现负数 */
export function parseExpr(raw: string): { terms: number[] } | { error: string } {
  const s = raw.replace(/[＋]/g, "+").replace(/[－—–−]/g, "-").replace(/[=＝].*$/, "").replace(/\s+/g, "");
  if (!s) return { error: (EN ? "Type a problem, e.g. 2+7" : "请输入题目,例如 2+7") };
  if (!/^\d+([+-]\d+)*$/.test(s)) return { error: (EN ? "Only + − × ÷ problems, e.g. 2+7, 43×4, 48÷2" : "只能输入加减算式,例如 2+7、3+4、12-6") };
  const terms: number[] = [];
  for (const m of s.matchAll(/([+-]?)(\d+)/g)) terms.push((m[1] === "-" ? -1 : 1) * Number(m[2]));
  if (terms.length < 2) return { error: (EN ? "At least two numbers, e.g. 2+7" : "至少要两个数,例如 2+7") };
  if (terms.length > 8) return { error: (EN ? "At most 8 numbers per problem" : "一道例题最多 8 个数") };
  if (terms.some((t) => Math.abs(t) > 999999)) return { error: (EN ? "Each number up to 6 digits" : "每个数最多 6 位") };
  let run = 0;
  for (const t of terms) { run += t; if (run < 0) return { error: (EN ? "The running total can't go below zero" : "中途不能减成负数") }; }
  return { terms };
}

// ===== 乘除法讲解(2026-11-08 付海东录屏 9 段:参考软件「空盘前乘法」「商除法」的讲法;用户「乘法不说首位有数,
//   就说有进位是 M+N,没有进位是 M+N−1」)=====
// 乘法:B 与 A 逐位相乘(先乘数第 1 位乘被乘数各位,再乘数第 2 位……),从算盘左边第一档起拨珠;
//   乘数第 j 位 × 被乘数第 i 位(都从左数、从 1 起)的积占两档,从左边第 i+j−1 档起拨入 / 加上(个位积 0 要占位,如 2×4 = 08)。
//   最后看左边第一档:有进位 → 积的位数 M+N,没有进位 → M+N−1(M、N 为两个乘数的位数)。
// 除法:被除数从左边第三档起拨入;看被除数前 N 位(N = 除数位数)够不够除:够除 → 隔档置商(商在被除数首位左边隔一档),
//   不够除 → 多看一位,挨着被除数立商;商与除数逐位相乘,第 j 个积从「商的下一档 + j」起减去;直到减完。
//   最后:首商够除 → 商的位数 M−N+1,不够除 → M−N(M、N 为被除数、除数的位数)。
export type ParsedExpr = { kind: "addsub"; terms: number[] } | { kind: "×" | "÷"; a: number; b: number };
const CN = "零一二三四五六七八九";
const cnNo = (n: number) => (n <= 10 ? ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][n] : String(n));
const cnPair = (s: string) => s.split("").map((d) => CN[+d]).join("");
/** 口诀:积是一位数说「二四得八」「一一得一」(2026-11-08 用户「一一得1,不要说一一得零一」);两位数照录屏逐位念「四三一二」「二五一零」;0 → 「三零得零」 */
const rhymeOf = (x: number, y: number) => { const p = x * y; if (EN) return `${x} times ${y} is ${p}`; return p < 10 ? `${CN[x]}${CN[y]}得${CN[p]}` : `${CN[x]}${CN[y]}${cnPair(String(p))}`; };
/** 加减 / 乘 / 除 都认:「43×4」「43*4」「43x4」「48÷2」「48/2」 */
function parseAnyInner(raw: string): ParsedExpr | { error: string } {
  const s = raw.replace(/[=＝].*$/, "").replace(/\s+/g, "").replace(/[*xX＊✕]/g, "×").replace(/[/／]/g, "÷");
  const m = s.match(/^(\d+)([×÷])(\d+)$/);
  if (!m) { const p = parseExpr(raw); return "error" in p ? { error: /[×÷]/.test(s) ? (EN ? "× and ÷ take exactly two numbers, e.g. 43×4, 48÷2" : "乘除只能两个数,例如 43×4、48÷2") : p.error.replace("只能输入加减算式,例如 2+7、3+4、12-6", (EN ? "Please type a + − × ÷ problem, e.g. 2+7, 43×4, 48÷2" : "请输入加减乘除算式,例如 2+7、43×4、48÷2")) } : { kind: "addsub", terms: p.terms }; }
  const a = Number(m[1]), b = Number(m[3]), op = m[2] as "×" | "÷";
  if (!a || !b) return { error: (EN ? "No zeros, please" : "不能有 0") };
  if (op === "×") {
    if (String(a).length > 4 || String(b).length > 4) return { error: (EN ? "Multiplication: up to 4 digits each" : "乘法每个数最多 4 位") };
    return { kind: op, a, b };
  }
  if (String(b).length > 3 || String(a).length > 7) return { error: (EN ? "Division: divisor up to 3 digits, dividend up to 7" : "除法:除数最多 3 位,被除数最多 7 位") };
  if (a < b) return { error: (EN ? "The dividend must be larger than the divisor" : "被除数要比除数大") };
  if (a % b) return { error: (EN ? "Please use a problem that divides evenly (no remainder)" : "请出能整除的题(没有余数)") };
  return { kind: op, a, b };
}
const hardest = (cs: FingeringClass[]): FingeringClass | "拨入" => (cs.length ? cs.reduce((x, y) => (stageForClass(y) > stageForClass(x) ? y : x)) : "拨入");
const MUL_RULE_EN = "Multiplication on an empty abacus: start from the first rod on the left and multiply digit by digit; each product takes two rods (0 holds a place). Placing the product: with a carry it has M+N digits, without a carry M+N−1 (M, N = the digits of the two numbers).";
const DIV_RULE_EN = "Division: set the dividend from the 3rd rod on the left; if it's enough, skip one rod and place the quotient; if not, place it right next to the dividend. Multiply the quotient by the divisor digit by digit and subtract from the next rod. Placing the quotient: if the first quotient digit is enough it has M−N+1 digits, otherwise M−N (M, N = the digits of the dividend and divisor).";
const MUL_RULE = "空盘前乘法:从算盘左边第一档起,逐位相乘,每个积占两档(0 要占位)。积的定位:有进位,积的位数是 M+N;没有进位,积的位数是 M+N−1(M、N 是两个乘数的位数)。";
const DIV_RULE = "商除法:被除数从左边第三档起拨入;够除隔档置商,不够除挨着被除数立商;商与除数逐位相乘,从商的下一档起减积。商的定位:首商够除,商的位数是 M−N+1;不够除是 M−N(M、N 是被除数、除数的位数)。";

function buildMul(a: number, b: number): Lesson | { error: string } {
  const A = String(a), B = String(b), M = A.length, N = B.length, R = Math.max(5, M + N + 1);
  const rods: Rods = Array(R).fill(0);
  const k = (l: number) => R - l; // 从左数第 l 档(1 起)→ 引擎下标(个位 = 0 在最右)
  const steps: TeachStep[] = [{ label: EN ? `${b} × ${a}` : `${b}与${a}`, term: 0, cls: "拨入", say: EN ? `${b} times ${a}, digit by digit, starting from the first rod on the left` : `${b}与${a}，逐位相乘，从算盘左边第一档起拨珠`, actions: [], mark: k(1) }];
  let first = true;
  B.split("").forEach((bd, j) => A.split("").forEach((ad, i) => {
    const x = +bd, y = +ad, p = x * y, pad = String(p).padStart(2, "0"), l = i + j + 1;
    const rhyme = rhymeOf(x, y);
    if (!p) { steps.push({ label: `${x}×${y}`, term: 0, cls: "拨入", say: EN ? `${rhyme}, nothing to move` : `${rhyme}，不用拨珠`, actions: [], mark: k(l) }); return; }
    const acts: BeadAction[] = [], cs: FingeringClass[] = [];
    ([[Math.floor(p / 10), l], [p % 10, l + 1]] as const).forEach(([dg, ll]) => { if (!dg) return; const r = addAt(rods, k(ll), dg); acts.push(...r.actions); cs.push(r.cls); });
    steps.push({ label: `${x}×${y}=${pad}`, term: 0, cls: hardest(cs), say: EN ? `${rhyme}: from the ${ord(l)} rod on the left, ${first ? "set" : "add"} ${pad}${p < 10 ? " — the 0 holds a place" : ""}` : `${rhyme}，从左边第${cnNo(l)}档起，${first ? "拨入" : "加上"}${pad}${p < 10 ? "，0要占位" : ""}`, actions: acts, mark: k(l) });
    first = false;
  }));
  let val = 0; for (let l = 1; l <= M + N; l++) val = val * 10 + rods[k(l)];
  for (let l = M + N + 1; l <= R; l++) if (rods[k(l)]) return { error: EN ? "This problem can't be explained yet, please try another" : "这道题暂时讲不了,请换一道" };
  if (val !== a * b) return { error: EN ? "This problem can't be explained yet, please try another" : "这道题暂时讲不了,请换一道" };
  const carry = rods[k(1)] > 0;
  steps.push({ label: EN ? (carry ? "carry" : "no carry") : carry ? "有进位" : "没有进位", term: 0, cls: "拨入", actions: [], mark: k(1),
    say: EN ? (carry ? `There's a carry, so the product has M plus N digits: ${M} plus ${N} is ${M + N} digits` : `No carry, so the product has M plus N minus 1 digits: ${M} plus ${N} minus 1 is ${M + N - 1} digits`) : carry ? `有进位，积的位数是M加N，${M}加${N}等于${M + N}位` : `没有进位，积的位数是M加N减1，${M}加${N}减1等于${M + N - 1}位` });
  const classes = [...new Set(steps.map((x) => x.cls).filter((c): c is FingeringClass => c !== "拨入"))];
  return { expr: `${a}×${b}`, speakExpr: EN ? `${a} times ${b}` : `${a}乘以${b}`, terms: [a, b], answer: a * b, rods: R, steps, classes, op: "×", a, b, rule: EN ? MUL_RULE_EN : MUL_RULE };
}

function buildDiv(a: number, d: number): Lesson | { error: string } {
  const A = String(a), Dd = String(d), M = A.length, N = Dd.length, R = M + 3;
  const rods: Rods = Array(R).fill(0);
  const k = (l: number) => R - l;
  const val = (l0: number, len: number) => { let v = 0; for (let l = l0; l < l0 + len; l++) v = v * 10 + (l <= R ? rods[k(l)] : 0); return v; };
  const steps: TeachStep[] = [];
  const firstActs: BeadAction[] = [];
  A.split("").forEach((ch, i) => { if (+ch) firstActs.push(directAdd(rods, k(3 + i), +ch)); });
  steps.push({ label: String(a), term: 0, cls: "拨入", say: EN ? `Set ${a} starting from the 3rd rod on the left` : `从左边第三档起，拨入${a}`, actions: firstActs, mark: k(3) });
  let firstEnough: boolean | null = null, lo = 3; // lo:余下被除数从哪一档起(商在它左边,不能当被除数)
  for (let guard = 0; guard < 12; guard++) {
    let L = 0; for (let l = lo; l <= M + 2; l++) if (rods[k(l)]) { L = l; break; }
    if (!L) break; // 减完了
    const dN = val(L, N), enough = dN >= d, D2 = enough ? dN : val(L, N + 1), rq = enough ? L - 2 : L - 1;
    const q = Math.floor(D2 / d);
    if (q < 1 || q > 9 || rq < 1) return { error: EN ? "This problem can't be explained yet, please try another" : "这道题暂时讲不了,请换一道" };
    if (firstEnough == null) firstEnough = enough;
    const qa = directAdd(rods, k(rq), q); lo = rq + 1;
    steps.push({ label: EN ? `q = ${q}` : `商${q}`, term: 0, cls: "拨入", actions: [qa], mark: k(rq),
      say: EN ? (enough ? `${dN} divided by ${d}: enough, so skip one rod and place quotient ${q}` : `${dN} divided by ${d}: not enough, so use ${D2} divided by ${d} and place quotient ${q} right next to the dividend`) : enough ? `${dN}除以${d}，够除，隔档置商${q}` : `${dN}除以${d}，不够除，用${D2}除以${d}，挨着被除数立商${q}` });
    Dd.split("").forEach((dc, j) => {
      const dj = +dc, p = q * dj, pad = String(p).padStart(2, "0"), s0 = rq + 1 + j;
      const lead = j === 0 && N > 1 ? (EN ? `${q} times ${d} digit by digit: ` : `${q}与${d}，逐位相乘，`) : "";
      if (!p) { steps.push({ label: `${q}×${dj}`, term: 0, cls: "拨入", say: EN ? `${lead}${rhymeOf(q, dj)}, nothing to move` : `${lead}${rhymeOf(q, dj)}，不用拨珠`, actions: [], mark: k(s0) }); return; }
      const acts: BeadAction[] = [], cs: FingeringClass[] = [];
      ([[Math.floor(p / 10), s0], [p % 10, s0 + 1]] as const).forEach(([dg, ll]) => { if (!dg) return; const r = subAt(rods, k(ll), dg); acts.push(...r.actions); cs.push(r.cls); });
      steps.push({ label: `${q}×${dj}=${pad}`, term: 0, cls: hardest(cs), say: EN ? `${lead}${rhymeOf(q, dj)}: from the ${ord(s0)} rod on the left, subtract ${pad}` : `${lead}${rhymeOf(q, dj)}，从左边第${cnNo(s0)}档起，减去${pad}`, actions: acts, mark: k(s0) });
    });
  }
  let qv = 0; for (let l = 1; l <= M + 1 - N; l++) qv = qv * 10 + rods[k(l)];
  for (let l = M + 2 - N; l <= R; l++) if (rods[k(l)]) return { error: EN ? "This problem can't be explained yet, please try another" : "这道题暂时讲不了,请换一道" };
  if (qv !== a / d) return { error: EN ? "This problem can't be explained yet, please try another" : "这道题暂时讲不了,请换一道" };
  steps.push({ label: EN ? (firstEnough ? "enough" : "not enough") : firstEnough ? "首商够除" : "首商不够除", term: 0, cls: "拨入", actions: [], mark: k(1),
    say: EN ? (firstEnough ? `The first quotient digit was enough, so the quotient has M minus N plus 1 digits: ${M} minus ${N} plus 1 is ${M - N + 1} digits` : `The first quotient digit wasn't enough, so the quotient has M minus N digits: ${M} minus ${N} is ${M - N} digits`) : firstEnough ? `首商够除，商的位数是M减N加1，${M}减${N}加1等于${M - N + 1}位` : `首商不够除，商的位数是M减N，${M}减${N}等于${M - N}位` });
  const classes = [...new Set(steps.map((x) => x.cls).filter((c): c is FingeringClass => c !== "拨入"))];
  return { expr: `${a}÷${d}`, speakExpr: EN ? `${a} divided by ${d}` : `${a}除以${d}`, terms: [a, d], answer: a / d, rods: R, steps, classes, op: "÷", a, b: d, rule: EN ? DIV_RULE_EN : DIV_RULE };
}

function buildLessonInner(raw: string): Lesson | { error: string } {
  const any = parseAnyInner(raw);
  if ("error" in any) return any;
  if (any.kind === "×") return buildMul(any.a, any.b);
  if (any.kind === "÷") return buildDiv(any.a, any.b);
  const p = parseExpr(raw);
  if ("error" in p) return p;
  const { terms } = p;
  let run = 0, peak = 0;
  for (const t of terms) { run += t; peak = Math.max(peak, run, Math.abs(t)); }
  const answer = run;
  const rodsN = Math.max(2, String(peak).length);
  const rods: Rods = Array(rodsN).fill(0);
  const steps: TeachStep[] = [];
  const multi = rodsN > 1 && terms.some((t) => Math.abs(t) >= 10);
  // 第一个数:直接拨入(从高位到低位)
  const first = terms[0];
  const firstActs: BeadAction[] = [];
  String(first).split("").reverse().forEach((ch, k) => { if (+ch) firstActs.push(directAdd(rods, k, +ch)); });
  firstActs.reverse();
  steps.push({ label: String(first), term: 0, cls: "拨入", say: EN ? cap(firstText(first)) : firstText(first), actions: firstActs });
  // 之后每个数:按档从高到低,每个非零位一步
  for (const [ti, t] of terms.slice(1).entries()) {
    const x = Math.abs(t), ds = String(x).split("").map(Number);
    let announced = false; // 每个数先报「加7，」「减6，」,多位数再分档讲
    ds.forEach((dg, i) => {
      if (!dg) return;
      const k = ds.length - 1 - i;
      const r = t > 0 ? addAt(rods, k, dg) : subAt(rods, k, dg);
      const sign = t > 0 ? "+" : "−";
      const place = multi && x >= 10 ? (EN ? `on the ${placeOf(k)} rod, ` : `${placeOf(k)}上，`) : ""; // 只有这个数本身是多位数才分档讲(12−4 不说「个位上」)
      const head = announced ? "" : EN ? `${t > 0 ? "add" : "subtract"} ${x}, ` : `${t > 0 ? "加" : "减"}${x}，`;
      announced = true;
      steps.push({ label: `${sign}${dg}${"0".repeat(k)}`, term: ti + 1, cls: r.cls, say: EN ? cap(head + place + r.say) : head + place + r.say, actions: r.actions });
    });
  }
  const finalVal = rods.reduceRight((v, d) => v * 10 + d, 0);
  if (finalVal !== answer) return { error: EN ? "This problem can't be explained yet, please try another" : "这道题暂时讲不了,请换一道" }; // 防御:模拟结果必须等于算术结果
  const expr = terms.map((t, i) => (i === 0 ? String(t) : t > 0 ? `+${t}` : `-${-t}`)).join("");
  const speakExpr = EN ? terms.map((t, i) => (i === 0 ? String(t) : t > 0 ? ` plus ${t}` : ` minus ${-t}`)).join("") : terms.map((t, i) => (i === 0 ? String(t) : t > 0 ? `加${t}` : `减${-t}`)).join("");
  const classes = [...new Set(steps.map((s) => s.cls).filter((c): c is FingeringClass => c !== "拨入"))];
  return { expr, speakExpr, terms, answer, rods: rodsN, steps, classes };
}

/** 整题讲解连成一句(用户话术):「2加7等于，右手拇指拨入2，加7，右手拇指和食指同时拨入7，答案等于9」 */
export function lessonScript(l: Lesson): string {
  return `${l.speakExpr}等于，${l.steps.map((s) => s.say).join("，")}，答案等于${l.answer}`;
}

/** 每档上下珠的位置(动画用):upper 1 = 上珠靠梁;lower = 靠梁的下珠个数 */
export const beadsOf = (digit: number) => ({ upper: digit >= 5 ? 1 : 0, lower: digit % 5 });

/** lang = "en":整套讲解(话术、口诀、定位说明、报错)换英文(2026-11-08) */
export function parseAny(raw: string, lang: "zh" | "en" = "zh"): ParsedExpr | { error: string } {
  const prev = EN; EN = lang === "en";
  try { return parseAnyInner(raw); } finally { EN = prev; }
}
export function buildLesson(raw: string, lang: "zh" | "en" = "zh"): Lesson | { error: string } {
  const prev = EN; EN = lang === "en";
  try { return buildLessonInner(raw); } finally { EN = prev; }
}
