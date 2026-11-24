// 作业系统(2026-10-11):教练端(/coach)布置 → 学生端(/homework)完成 → 教练查看完成情况并评价。
//
// 零迁移设计:全部记录落在现有 scores 表(RLS:公开可读、只能以自己 user_id 写入、不可改删),
// 用 game/mode 区分记录类型、meta(jsonb) 装内容,append-only:
//   game='class' mode='join'   user_id=学生  meta{coachId, byCoach:true} 教练建账号时由学生会话写入(班级码自助加入已废止,旧 open/非 byCoach 记录作废)
//   game='class' mode='member' / 'group'   教练侧成员信息与班级,见 classManage.ts
//   game='hw'    mode='assign' user_id=教练  meta{studentId,title,note,items[]}   一名学生一条(每个学生内容可不同)
//   game='hw'    mode='submit' user_id=学生  meta{assignId,itemIdx,results[],correct,total,ms,retry}  每做完一个项目一条;错题重做再追加(retry=true)
//   game='hw'    mode='review' user_id=教练  meta{assignId,stars,comment}        教练评价(可多次,取最新)
//   game='hw'    mode='revoke' user_id=教练  meta{assignId}                      撤回(表不可删改,追加一条撤回记录;只认布置者本人的撤回)
//   game='hw'    mode='edit'   user_id=教练  meta{assignId,title,note,items[]}   直接编辑=追加新版本,读取时取布置者最新一条覆盖原内容
// 安全边界:教练只能给自己建的学生布置(按 byCoach join 记录列学生);学生端只展示自己所属教练的作业。
import { getLang } from "@/lib/langState";
import { fetchAllRows, forChunks } from "@/lib/fetchAll";
import { isCoach } from "@/lib/coachAccess";
import { COACH_STAGES, generateCoachProblem } from "@/lib/fingering";
import { supabase } from "@/integrations/supabase/client";
import { buildProblem, type Sign } from "@/lib/flashMath";
import { generateMultiplyWith, generateDivideWith, generateBead, type Carry2 } from "@/lib/abacus";

// ===== 作业项目配置 =====

export type HwProject = "flash" | "listen" | "glance" | "bead" | "scroll" | "obstacle"; // obstacle=障碍算(2026-10-15:数字在干扰中随机位置闪现) // scroll=心算马拉松(2026-10-14 付海东录屏:数字从底部滚上来连续心算)
export type HwOp = "addsub" | "mul" | "div";
export type BeadDir = "b2n" | "n2b" | "see"; // 珠→数(看珠报数) / 数→珠(看数拨珠) / 看数 = 数码秒记(2026-11-08:看一个数限时记住,收起后用键盘写出来)

export interface HwItem {
  project: HwProject;
  op: HwOp;            // bead 项目忽略
  beadDir: BeadDir;    // 仅 bead
  n: number;           // 题量
  count: number;       // 加减:笔数
  digits: number;      // 加减:最小位数
  digitsMax: number;   // 加减:最大位数
  includeSub: boolean; // 加减:含减法
  method: "mental" | "bead"; // 计算方法(2026-10-14 付海东「心算导入」):mental=显示数字;bead=每笔显示珠码,学生脑中拨珠(闪算/看算)
  stage: number;       // 加减:知识点关卡(0=不限;1–7 = fingering.COACH_STAGES:直加直减/满五加/破五减/进位加/破五进位加/退位减/退位满五减)2026-10-14
  stageLesson: number; // 加减:变式小课(-1=全部;否则 COACH_STAGES[stage].variantGroups 下标)
  mulA: number; mulB: number; // 乘法:被乘数/乘数位数
  mulDigits: number[];        // 乘法:特定乘数(乘数各位只从这些数字里取;空=不限)2026-10-13
  mulCarry: Carry2;           // 乘法:进位组合(仅 2位×1位):any/cc/cn/nc/nn
  divD: number; divQ: number; // 除法:除数/商位数
  divDigits: number[];        // 除法:特定除数(2–9;空=不限)
  divEnough: "any" | "yes" | "no"; // 除法:够除/不够除/均可
  decimals: boolean;          // 乘除:带小数(随机小数位,各数值落在 0.01–100)2026-10-13
  decimalPlaces: number;      // 小数题答案四舍五入保留位数 0–4(付海东)
  speedMs: number;     // 闪算:每笔毫秒
  listenSpeed: number; // 听算:速度档 1-10
  listenSec: number;   // 听算:数间间隔 ms
  announcePlus: boolean; // 听算:报不报「加」(减号恒报)
  listenVoice: "female" | "male" | "child"; // 听算音色(与综合训练一致,2026-10-13)
  glanceLimitSec: number; // 看算:呈现限时秒,0 不限
  beadDigits: number;  // 看珠:位数
  beadSpeedMs: number; // 珠→数:算盘呈现毫秒
  beadLimitSec: number; // 数→珠:拨珠限时秒,0 不限(2026-11-03 付海东「数珠互译的时间也要有,没有时间限制」)
  obstacleLevel: "low" | "mid" | "high"; // 障碍算:干扰程度 底/中/高
  obstacleKind: "digits" | "shapes" | "filled"; // 障碍算:干扰类型 数码/形状/填充形状
  scrollSec: number;   // 马拉松:整题滚完用时(秒)
  scrollAccel: boolean; // 马拉松:加速(后面每题比上一题快 ceil(基准/10) 秒,最低到基准的 30%)
  scrollTermMs?: number; // 马拉松:比赛里考生选的速度档 = 每笔毫秒(覆盖整题用时;只在比赛作答器里出现)
}

export const DEFAULT_ITEM: HwItem = {
  project: "flash", op: "addsub", beadDir: "b2n", n: 10,
  count: 5, digits: 2, digitsMax: 2, includeSub: false, method: "mental", stage: 0, stageLesson: -1,
  mulA: 2, mulB: 1, mulDigits: [], mulCarry: "any", divD: 1, divQ: 2, divDigits: [], divEnough: "any", decimals: false, decimalPlaces: 2,
  speedMs: 700, listenSpeed: 5, listenSec: 800, announcePlus: true, listenVoice: "female", glanceLimitSec: 0,
  beadDigits: 2, beadSpeedMs: 2000, beadLimitSec: 0,
  scrollSec: 20, scrollAccel: false,
  obstacleLevel: "low", obstacleKind: "digits",
};

export const PROJECT_LABEL: Record<HwProject, string> = { flash: "闪算", listen: "听算", glance: "看算", bead: "数珠互译", scroll: "心算马拉松", obstacle: "障碍算" };
export const OP_LABEL: Record<HwOp, string> = { addsub: "加减", mul: "乘法", div: "除法" };
export const PROJECT_EMOJI: Record<HwProject, string> = { flash: "⚡", listen: "🔊", glance: "👀", bead: "🧮", scroll: "🏃", obstacle: "🌪️" };

/** 把任意来源(云端 JSON)的项目配置规整成合法 HwItem(夹取范围,缺省补齐)。 */
const digitSet = (v: unknown, lo: number): number[] => Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= lo && n <= 9))].sort((a, b) => a - b) : [];
// 进位 = 一位数相乘的积满十(二五一十 进位;二三得六 不进位);两位×一位 看 十位×乘数 与 个位×乘数 各自进不进
export const CARRY_LABEL: Record<Carry2, string> = { any: "不限", cc: "十位进·个位进", cn: "十位进·个位不进", nc: "十位不进·个位进", nn: "都不进" };

export function normalizeItem(raw: Partial<HwItem> | null | undefined): HwItem {
  const d = DEFAULT_ITEM;
  const r = raw ?? {};
  const cl = (v: unknown, lo: number, hi: number, def: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def; };
  const project: HwProject = (["flash", "listen", "glance", "bead", "scroll", "obstacle"] as const).includes(r.project as HwProject) ? (r.project as HwProject) : d.project;
  const op: HwOp = project === "flash" || project === "scroll" || project === "obstacle" ? "addsub" : (["addsub", "mul", "div"] as const).includes(r.op as HwOp) ? (r.op as HwOp) : d.op;
  const digits = cl(r.digits, 1, 12, d.digits);
  return {
    project, op,
    beadDir: r.beadDir === "n2b" || r.beadDir === "see" ? r.beadDir : "b2n",
    n: cl(r.n, 1, 100, d.n),
    count: cl(r.count, 2, 50, d.count),
    digits, digitsMax: Math.max(digits, cl(r.digitsMax, 1, 12, digits)),
    includeSub: !!r.includeSub,
    method: r.method === "bead" ? "bead" : "mental",
    stage: cl(r.stage, 0, COACH_STAGES.length, 0), stageLesson: cl(r.stageLesson, -1, 8, -1),
    mulA: cl(r.mulA, 1, 6, d.mulA), mulB: cl(r.mulB, 1, 6, d.mulB),
    mulDigits: digitSet(r.mulDigits, 1), mulCarry: (["any", "cc", "cn", "nc", "nn"] as const).includes(r.mulCarry as Carry2) ? (r.mulCarry as Carry2) : "any",
    divD: cl(r.divD, 1, 5, d.divD), divQ: cl(r.divQ, 1, 6, d.divQ),
    divDigits: digitSet(r.divDigits, 2), divEnough: r.divEnough === "yes" || r.divEnough === "no" ? r.divEnough : "any",
    decimals: !!r.decimals, decimalPlaces: cl(r.decimalPlaces, 0, 4, d.decimalPlaces),
    speedMs: cl(r.speedMs, 100, 5000, d.speedMs),
    listenSpeed: cl(r.listenSpeed, 1, 10, d.listenSpeed),
    listenSec: cl(r.listenSec, 0, 6000, d.listenSec),
    announcePlus: r.announcePlus === undefined ? d.announcePlus : !!r.announcePlus,
    listenVoice: r.listenVoice === "male" ? "male" : "female", // 童声已下架(2026-10-13),旧作业里的 child 归女声
    glanceLimitSec: cl(r.glanceLimitSec, 0, 120, d.glanceLimitSec),
    beadDigits: cl(r.beadDigits, 1, 100, d.beadDigits), // 2026-11-03 付海东「位数只有12位,不做限制」→ 15;2026-11-08 用户「可以有 100 位」(超 15 位走数字串 beadS)
    beadLimitSec: cl(r.beadLimitSec, 0, 120, d.beadLimitSec),
    beadSpeedMs: cl(r.beadSpeedMs, 300, 10000, d.beadSpeedMs),
    scrollSec: cl(r.scrollSec, 2, 180, d.scrollSec), scrollAccel: !!r.scrollAccel,
    obstacleLevel: r.obstacleLevel === "mid" || r.obstacleLevel === "high" ? r.obstacleLevel : "low",
    obstacleKind: r.obstacleKind === "shapes" || r.obstacleKind === "filled" ? r.obstacleKind : "digits",
  };
}

/** 一行人话描述:「闪算 · 加减 2位×5笔 · 0.7s/笔 · 10题」。 */
// 英文版(2026-10-27 用户:切到英文后各页仍是中文)
export const PROJECT_LABEL_EN: Record<HwProject, string> = { flash: "Flash", listen: "Listen", glance: "Glance", bead: "Beads", scroll: "Marathon", obstacle: "Obstacle" };
const STAGE_EN: Record<number, string> = { 1: "Direct add/sub", 2: "Add using 5", 3: "Subtract using 5", 4: "Add with carry", 5: "Carry using 5", 6: "Subtract with borrow", 7: "Borrow using 5" };
const CARRY_EN: Record<Carry2, string> = { any: "any", cc: "tens & ones carry", cn: "tens carry, ones don't", nc: "ones carry, tens don't", nn: "no carry" };
const OB_LEVEL_EN = { low: "low", mid: "mid", high: "high" } as const;
const OB_KIND_EN = { digits: "digits", shapes: "shapes", filled: "filled shapes" } as const;
function itemLabelEn(it: HwItem): string {
  const parts: string[] = [PROJECT_LABEL_EN[it.project]];
  if (it.project === "bead") {
    parts.push(`${it.beadDir === "b2n" ? "beads→number" : it.beadDir === "see" ? "number memory" : "number→beads"} ${it.beadDigits}-digit`);
    if (it.beadDir !== "n2b") parts.push(`${(it.beadSpeedMs / 1000).toFixed(1)}s`);
    if (it.beadDir !== "b2n" && it.beadLimitSec > 0) parts.push(`${it.beadLimitSec}s ${it.beadDir === "see" ? "to answer" : "limit"}`);
  } else {
    if (it.op === "addsub") {
      const dg = it.digitsMax > it.digits ? `${it.digits}-${it.digitsMax}-digit` : `${it.digits}-digit`;
      if (it.stage > 0 && STAGE_EN[it.stage]) parts.push(`${STAGE_EN[it.stage]} ${it.digits}-digit × ${it.count} terms`);
      else parts.push(`${it.includeSub ? "add/sub" : "addition"} ${dg} × ${it.count} terms`);
    } else if (it.op === "mul") {
      parts.push(`× ${it.mulA}-digit by ${it.mulB}-digit`);
      if (it.mulDigits.length) parts.push(`multiplier ∈ {${it.mulDigits.join(",")}}`);
      if (it.mulA === 2 && it.mulB === 1 && it.mulCarry !== "any") parts.push(CARRY_EN[it.mulCarry]);
    } else {
      parts.push(`÷ ${it.divD}-digit divisor, ${it.divQ}-digit quotient`);
      if (it.divDigits.length) parts.push(`divisor ∈ {${it.divDigits.join(",")}}`);
      if (it.divEnough !== "any") parts.push(it.divEnough === "yes" ? "divides evenly" : it.decimals ? "not even" : "with remainder");
    }
    if (it.op !== "addsub" && it.decimals) parts.push(`decimals · round to ${it.decimalPlaces}`);
    if ((it.project === "flash" || it.project === "glance") && it.op === "addsub" && it.method === "bead") parts.push("abacus");
    if (it.project === "flash") parts.push(`${(it.speedMs / 1000).toFixed(1)}s/term`);
    if (it.project === "obstacle") parts.push(`distraction ${OB_LEVEL_EN[it.obstacleLevel]}·${OB_KIND_EN[it.obstacleKind]}`, `${(it.speedMs / 1000).toFixed(1)}s/term${it.scrollAccel ? "·speed-up" : ""}`);
    if (it.project === "scroll") { parts.push(`${it.scrollSec}s/problem${it.scrollAccel ? "·speed-up" : ""}`); if (it.decimals) parts.push(`${it.decimalPlaces} decimals`); }
    if (it.project === "listen") parts.push(`speed ${it.listenSpeed}${it.announcePlus ? "" : "·no “plus”"}`);
    if (it.project === "glance" && it.glanceLimitSec > 0) parts.push(`${it.glanceLimitSec}s limit`);
  }
  parts.push(`${it.n} problems`);
  return parts.join(" · ");
}

export function itemLabel(it: HwItem): string {
  if (getLang() === "en") return itemLabelEn(it);
  const parts: string[] = [PROJECT_LABEL[it.project]];
  if (it.project === "bead") {
    parts.push(it.beadDir === "b2n" ? `珠→数 ${it.beadDigits}位` : it.beadDir === "see" ? `数码秒记 ${it.beadDigits}位` : `数→珠 ${it.beadDigits}位`);
    if (it.beadDir !== "n2b") parts.push(`${it.beadDir === "see" ? "看" : ""}${(it.beadSpeedMs / 1000).toFixed(1)}s`);
    if (it.beadDir !== "b2n" && it.beadLimitSec > 0) parts.push(`${it.beadDir === "see" ? "答题" : "限时"}${it.beadLimitSec}s`);
  } else {
    if (it.op === "addsub") {
      const dg = it.digitsMax > it.digits ? `${it.digits}-${it.digitsMax}位` : `${it.digits}位`;
      const st = it.stage > 0 ? COACH_STAGES.find((x) => x.id === it.stage) : undefined;
      if (st) parts.push(`${st.name}${it.stageLesson >= 0 && st.variantGroups[it.stageLesson] ? "·" + st.variantGroups[it.stageLesson].label : ""} ${it.digits}位×${it.count}笔`);
      else parts.push(`${it.includeSub ? "加减" : "纯加"} ${dg}×${it.count}笔`);
    } else if (it.op === "mul") {
      parts.push(`乘法 ${it.mulA}位×${it.mulB}位`);
      if (it.mulDigits.length) parts.push(`乘数∈{${it.mulDigits.join(",")}}`);
      if (it.mulA === 2 && it.mulB === 1 && it.mulCarry !== "any") parts.push(CARRY_LABEL[it.mulCarry]);
    } else {
      parts.push(`除法 除数${it.divD}位·商${it.divQ}位`);
      if (it.divDigits.length) parts.push(`除数∈{${it.divDigits.join(",")}}`);
      if (it.divEnough !== "any") parts.push(it.divEnough === "yes" ? "够除" : it.decimals ? "不够除" : "不够除·带余数");
    }
    if (it.op !== "addsub" && it.decimals) parts.push(`小数·保留${it.decimalPlaces}位`);
    if ((it.project === "flash" || it.project === "glance") && it.op === "addsub" && it.method === "bead") parts.push("珠算");
    if (it.project === "flash") parts.push(`${(it.speedMs / 1000).toFixed(1)}s/笔`);
    if (it.project === "obstacle") parts.push(`干扰${OBSTACLE_LEVEL_LABEL[it.obstacleLevel]}·${OBSTACLE_KIND_LABEL[it.obstacleKind]}`, `${(it.speedMs / 1000).toFixed(1)}s/笔${it.scrollAccel ? "·加速" : ""}`);
    if (it.project === "scroll") { parts.push(`${it.scrollSec}s/题${it.scrollAccel ? "·加速" : ""}`); if (it.decimals) parts.push(`${it.decimalPlaces}位小数`); }
    if (it.project === "listen") parts.push(`语速${it.listenSpeed}档${it.announcePlus ? "" : "·不报加"}`);
    if (it.project === "glance" && it.glanceLimitSec > 0) parts.push(`限时${it.glanceLimitSec}s`);
  }
  parts.push(`${it.n}题`);
  return parts.join(" · ");
}

// ===== 出题 =====

export interface HwProblem {
  terms: number[];
  signs: Sign[];
  answer: number;
  op?: "×" | "÷";        // 乘除
  places?: number;       // 小数题:答案保留位数(作答按此四舍五入比较)
  rem?: number;          // 不够除·无小数:余数(answer = 整数商,作答「商余余数」,如 22÷8 = 2……6)
  bead?: number;         // 数珠互译:算盘值(=answer)
  beadS?: string;        // 数珠互译:算盘值的数字串(2026-11-08 最多 100 位;超过 15 位时 bead/answer 只是近似值,以它为准)
  beadDigits?: number;
  seg?: number;          // 比赛:第几个难度段(每人题序只在段内打乱)
}

/** 四舍五入保留 n 位(先转十进制字符串避免 1.005 这类二进制误差) */
export const roundTo = (x: number, n: number): number => Number(Number(`${x}e${n}`).toFixed(0) + `e-${n}`);
/** 整数按 10^-k 缩放,走十进制字符串解析,避免浮点误差(125,2 → 1.25;k<0 则放大) */
export const shift = (int: number, k: number): number => (k === 0 ? int : k > 0 ? Number(`${int}e-${k}`) : int * Math.pow(10, -k));
/** 给每个整数随机选小数位数 k,使数值落在 [0.01, 100):n 位整数 → k ∈ [n−2, n+1];至少一个数带小数 */
export function decimalShifts(ints: number[]): number[] {
  const ks = ints.map((v) => { const n = String(v).length; const lo = Math.max(0, n - 2), hi = n + 1; return lo + Math.floor(Math.random() * (hi - lo + 1)); });
  // 至少一个数真的带小数(120 缩 1 位是 12,仍是整数:末尾有几个 0 就得多缩几位)
  if (!ints.some((v, i) => !Number.isInteger(shift(v, ks[i])))) {
    const i = Math.floor(Math.random() * ks.length);
    const zeros = (String(ints[i]).match(/0+$/) ?? [""])[0].length;
    ks[i] = Math.min(String(ints[i]).length + 1, Math.max(ks[i], zeros + 1));
  }
  return ks;
}

export function genProblem(it: HwItem): HwProblem {
  if (it.project === "bead") {
    const { value, str } = generateBead(it.beadDigits);
    return { terms: [value], signs: ["+"], answer: value, bead: value, beadS: str, beadDigits: it.beadDigits };
  }
  // 小数题的答案四舍五入后不能是 0(2026-10-16 付海东:0.03×0.02=0.0006 保留两位显示 0):答案至少要到保留位的最后一位
  const minAns = Math.pow(10, -it.decimalPlaces);
  if (it.op === "mul") {
    const { a, b, answer } = generateMultiplyWith(it.mulA, it.mulB, { digits: it.mulDigits, carry: it.mulCarry });
    if (!it.decimals) return { terms: [a, b], signs: ["+", "+"], answer, op: "×" };
    for (let t = 0; t < 60; t++) {
      const [ka, kb] = decimalShifts([a, b]);
      const ans = roundTo(shift(a * b, ka + kb), it.decimalPlaces);
      // 2026-10-26 与出题系统统一:答案不出 0.0x(如 0.3×0.2=0.06),小数点后第一位不为 0
      // 位数太少(如 1位×1位)实在凑不出时,后半段退回原规则(答案 ≥ 保留位最后一位)
      if (ans >= (t < 40 ? Math.max(minAns, Math.pow(10, 1 - it.decimalPlaces)) : minAns) || t === 59) return { terms: [shift(a, ka), shift(b, kb)], signs: ["+", "+"], answer: ans, op: "×", places: it.decimalPlaces };
    }
  }
  if (it.op === "div") {
    // 小数题:末尾 0 多的整数(8×125=1000)缩成小数会很丑或要缩很多位,重抽(最多 30 次)
    let g = generateDivideWith(it.divD, it.divQ, { digits: it.divDigits, enough: it.divEnough });
    const ugly = (x: typeof g) => /00$/.test(String(x.dividend)) || /0$/.test(String(x.divisor));
    // 2026-10-26 与出题系统统一(付海东「除法小数最后的答案,数字也不能和除数重复」「答案自己也不能重复,如 53.83」):
    // 不够除且保留小数时,四舍五入后的答案数码不重复、不和除数重复(两数合计 ≤ 10 位时),也不出 0.0x
    const ansBad = (x: typeof g) => {
      if (!it.decimals || !x.remainder) return false;
      const qr = String(x.quotient + (2 * x.remainder >= x.divisor ? 1 : 0)), dv = String(x.divisor);
      if (qr.length < it.decimalPlaces) return true;
      return qr.length + dv.length <= 10 && (new Set(qr).size !== qr.length || [...qr].some((c) => dv.includes(c)));
    };
    for (let t = 0; t < 80 && ((it.decimals && ugly(g)) || ansBad(g)); t++) g = generateDivideWith(it.divD, it.divQ, { digits: it.divDigits, enough: it.divEnough });
    const { dividend, divisor, quotient, remainder } = g;
    // 小数除法 = 小数 ÷ 小数(2026-10-20 用户:之前整数÷整数只是答案带小数,题型不对):被除数、除数都必须带小数部分
    // 缩 k 位后要带小数,k 必须超过整数末尾 0 的个数(5800 缩 2 位仍是 58)
    const zeros = (int: number) => (String(int).match(/0+$/) ?? [""])[0].length;
    const k12 = () => 1 + Math.floor(Math.random() * 2);
    // 不够除(除不尽):答案 = 商四舍五入到保留位数(商 ≥ 1,不会是 0);小数开时两数同缩 10^-k,商不变(22÷8 → 2.2÷0.8)
    if (remainder) {
      // 无小数:答「商……余数」(2026-10-21 付海东「如果无小数的话,不够除要显示余数,答案的形式就不能是小数点了」)
      if (!it.decimals) return { terms: [dividend, divisor], signs: ["+", "+"], answer: quotient, rem: remainder, op: "÷" };
      // 有小数(2026-10-25 付海东:商的位数 = 整数位 + 小数位,不是只算整数位):商的数字就是 divQ 位,
      // 小数点落在倒数第「保留位数」位上 —— 被除数比除数多缩 p 位,商 = (被除数整数 ÷ 除数整数) × 10^-p,
      // 四舍五入到 p 位小数 = 把 (D×Q+R)/D 四舍五入到整数,答案正好 divQ 位(如 商4位·保留2位 → 12.34)
      const p = it.decimalPlaces;
      const qr = quotient + (2 * remainder >= divisor ? 1 : 0); // 第 p+1 位 = 余数/除数 的第一位小数
      // 除数至少缩 1 位(小数 ÷ 小数);被除数恰好比除数多缩 p 位(末尾有 0 时整体多缩,保证两数都带小数)
      const kd = Math.max(zeros(divisor) + 1, k12(), zeros(dividend) + 1 - p);
      return { terms: [shift(dividend, kd + p), shift(divisor, kd)], signs: ["+", "+"], answer: shift(qr, p), op: "÷", places: p };
    }
    if (!it.decimals) return { terms: [dividend, divisor], signs: ["+", "+"], answer: quotient, op: "÷" };
    // 整除:商缩 kq 位(保留至少一位整数、不超过保留位数 → 答案精确且 ≥ 10^-保留位;可为整数,如 3.6÷1.2=3),
    // 除数缩 kd 位(通常 1–2 位:1.2 / 0.04),被除数 = 除数 × 商 缩 kd+kq 位(精确);kd 按末尾 0 抬高,保证两数都带小数
    const prod = divisor * quotient;
    const kq = Math.floor(Math.random() * (Math.min(String(quotient).length - 1, it.decimalPlaces) + 1));
    const kd = Math.max(k12(), zeros(divisor) + 1, zeros(prod) + 1 - kq);
    return { terms: [shift(prod, kd + kq), shift(divisor, kd)], signs: ["+", "+"], answer: shift(quotient, kq), op: "÷", places: it.decimalPlaces };
  }
  if (it.stage > 0) {
    // 分知识点作业(2026-10-14 付海东:大部分学生处于满五加/破五减阶段,教练要能按关卡布置):复用 AI 陪练的定向出题
    const st = COACH_STAGES.find((x) => x.id === it.stage) ?? COACH_STAGES[0];
    const xs = it.stageLesson >= 0 ? st.variantGroups[it.stageLesson]?.xs ?? null : null;
    const cp = generateCoachProblem(st.id, it.count, it.digits, xs);
    return withScrollDecimals(it, { terms: cp.terms, signs: cp.signs, answer: cp.answer });
  }
  const p = buildProblem(it.count, it.digits, it.includeSub, it.digitsMax);
  return withScrollDecimals(it, { terms: p.terms, signs: p.signs, answer: p.answer });
}
/** 马拉松「小数位」:全部笔数统一带 N 位小数(整数题整体缩 10^-N,和也精确) */
function withScrollDecimals(it: HwItem, pr: HwProblem): HwProblem {
  if (it.project !== "scroll" || !it.decimals || it.decimalPlaces <= 0) return pr;
  const n = Math.min(2, it.decimalPlaces);
  return { ...pr, terms: pr.terms.map((t) => shift(t, n)), answer: shift(pr.answer, n), places: n };
}
export const OBSTACLE_LEVEL_LABEL = { low: "低", mid: "中", high: "高" } as const; // 2026-10-29 付海东:原来误写成「底」
export const OBSTACLE_KIND_LABEL = { digits: "数码", shapes: "形状", filled: "填充形状" } as const;
/** 障碍算第 idx 题每笔毫秒:加速时每题比上题快 20%(1s → 0.8 → 0.6,录屏软件口径),最低到基准 40% */
export function obstacleSpeedMs(it: HwItem, idx: number): number {
  if (!it.scrollAccel) return it.speedMs;
  return Math.max(Math.round(it.speedMs * 0.4), Math.round(it.speedMs * (1 - 0.2 * idx)));
}
/** 马拉松第 idx 题(0 起)的滚动用时:加速时每题比上一题快 ceil(基准/10) 秒,最低到基准的 30%(付海东软件:20→18→16、5→4→3) */
export function scrollSecFor(it: HwItem, idx: number): number {
  if (!it.scrollAccel) return it.scrollSec;
  const step = Math.ceil(it.scrollSec / 10);
  return Math.max(Math.max(1, Math.round(it.scrollSec * 0.3)), it.scrollSec - step * idx);
}

export const genProblems = (it: HwItem, n = it.n): HwProblem[] => Array.from({ length: n }, () => genProblem(it));

/** 算式文本(回顾用)。 */
export function problemExpr(p: HwProblem): string {
  if (p.bead != null) return `算盘 ${p.bead}`;
  if (p.op) return `${p.terms[0]} ${p.op} ${p.terms[1]}`;
  return p.terms.map((t, i) => (i === 0 ? `${t}` : p.signs[i] === "-" ? ` − ${t}` : ` + ${t}`)).join("");
}

// ===== 记录模型 =====

export interface HwResult { terms: number[]; signs: Sign[]; op?: "×" | "÷"; bead?: number; beadS?: string; givenS?: string; answer: number; given: number | null; correct: boolean; ms: number; rem?: number; givenRem?: number | null }
/** 余数题的作答分隔符:输入框里显示「2余6」,答案展示用珠算习惯「2……6」 */
export const REM_SEP = "余";
/** 答案文字:余数题 → 「商……余数」;其它 → 数字(带千分位) */
export function answerText(answer: number, rem?: number | null, fmt: (n: number) => string = String): string {
  return rem != null ? `${fmt(answer)}……${rem}` : fmt(answer);
}
/** 解析余数题作答「2余6」(也认 2……6 / 2...6 / 2 6);返回 null = 格式不完整 */
export function parseRemAnswer(raw: string): { q: number; r: number } | null {
  const m = raw.replace(/[,，]/g, "").trim().match(/^(\d+)\s*(?:余|…+|\.{2,}|\s)\s*(\d+)$/);
  return m ? { q: Number(m[1]), r: Number(m[2]) } : null;
}
export interface HwAssignment { id: string; coachId: string; studentId: string; title: string; note: string; items: HwItem[]; createdAt: string; date: string; coachNick?: string; studentNick?: string; revoked?: boolean; editedAt?: string }
/** 本地日期键 YYYY-MM-DD */
export const dayKeyOf = (d: Date | string): string => { const x = typeof d === "string" ? new Date(d) : d; return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
export const todayKey = () => dayKeyOf(new Date());
export interface HwSubmission { id: string; assignId: string; studentId: string; itemIdx: number; results: HwResult[]; correct: number; total: number; ms: number; retry: boolean; createdAt: string }
export interface HwReview { id: string; assignId: string; coachId: string; stars: number; comment: string; createdAt: string }
export interface Student { id: string; nickname: string; joinedAt: string }

const uid = async (): Promise<string | null> => (await supabase.auth.getSession()).data.session?.user.id ?? null;


async function nicknames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return out;
  const { data } = await supabase.from("profiles").select("id,nickname").in("id", uniq);
  for (const r of (data ?? []) as { id: string; nickname: string | null }[]) out.set(r.id, r.nickname || "未命名");
  return out;
}

// ===== 班级 =====


/** 我加入的教练们。 */
export async function getMyCoaches(): Promise<{ id: string; nickname: string }[]> {
  const me = await uid();
  if (!me) return [];
  const [{ data }, { data: linked }] = await Promise.all([
    supabase.from("scores").select("meta").eq("game", "class").eq("mode", "join").eq("user_id", me),
    // 教练把已有账号加进班(2026-10-13):member 记录 meta.studentId=我;只认管理员授权过的教练写的,防止任何人把自己"加"成我的教练
    supabase.from("scores").select("user_id,created_at,meta").eq("game", "class").eq("mode", "member").eq("meta->>studentId", me).order("created_at", { ascending: true }),
  ]);
  const joined = new Set((data ?? []).map((r) => String((r as { meta?: { coachId?: string } }).meta?.coachId ?? "")).filter(Boolean));
  // 每位教练最新一条 member 记录:removed=true 表示已被移出班级(2026-10-14)
  const latest = new Map<string, boolean>();
  for (const r of (linked ?? []) as { user_id: string; meta: { removed?: boolean } | null }[]) latest.set(r.user_id, !!r.meta?.removed);
  const candidates = [...latest.keys()].filter((id) => !joined.has(id) && !latest.get(id));
  const ok = await Promise.all(candidates.map((id) => isCoach(id)));
  candidates.forEach((id, i) => { if (ok[i]) joined.add(id); });
  for (const [id, removed] of latest) if (removed) joined.delete(id);
  const ids = [...joined];
  const names = await nicknames(ids);
  return ids.map((id) => ({ id, nickname: names.get(id) ?? "教练" }));
}

/** 教练的学生名单(按加入时间)。 */
export async function getMyStudents(): Promise<Student[]> {
  const me = await uid();
  if (!me) return [];
  const data = await fetchAllRows<{ user_id: string; created_at: string }>((f, t) => supabase.from("scores").select("user_id,created_at,meta").eq("game", "class").eq("mode", "join").eq("meta->>coachId", me).order("created_at", { ascending: true }).order("id").range(f, t));
  const seen = new Map<string, string>();
  // 教练建账号写的 join(byCoach)与历史上凭班级码加入的 join 都算(班级码入口已撤,但既有关联必须保留 —— 2026-10-13 学生「我的作业没了」教训)
  for (const r of data) if (!seen.has(r.user_id)) seen.set(r.user_id, r.created_at);
  // 教练加进来的已有账号(member 记录,无 join)也算学生
  const mem = await fetchAllRows<{ created_at: string; meta: { studentId?: string; removed?: boolean } | null }>((f, t) => supabase.from("scores").select("created_at,meta").eq("game", "class").eq("mode", "member").eq("user_id", me).order("created_at", { ascending: true }).order("id").range(f, t));
  const removed = new Map<string, boolean>();
  for (const r of mem) {
    const id = String(r.meta?.studentId ?? ""); if (!id) continue;
    if (!seen.has(id)) seen.set(id, r.created_at);
    removed.set(id, !!r.meta?.removed); // 按时间升序,最后一条为准
  }
  for (const [id, rm] of removed) if (rm) seen.delete(id); // 已移出的不在名单里
  const names = await nicknames([...seen.keys()]);
  return [...seen.entries()].map(([id, joinedAt]) => ({ id, nickname: names.get(id) ?? "学生", joinedAt }));
}

// ===== 作业 =====

/** 布置作业;dates = 作业日期(YYYY-MM-DD)列表,一次可选未来 7 天内多天,每天每人各一份(2026-10-14 付海东「一周一次课,其余 6 天都要布置」) */
export async function assignHomework(studentIds: string[], title: string, note: string, items: HwItem[], dates: string[] = [todayKey()]): Promise<{ ok: boolean; error?: string; count: number }> {
  const me = await uid();
  if (!me) return { ok: false, error: "请先登录", count: 0 };
  if (!studentIds.length || !items.length) return { ok: false, error: "请选择学生并添加至少一个项目", count: 0 };
  const days = [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  if (!days.length) days.push(todayKey());
  const rows = days.flatMap((date) => studentIds.map((studentId) => ({
    user_id: me, game: "hw", mode: "assign", value: items.length,
    meta: { studentId, title: title.trim() || "作业", note: note.trim(), items, date } as never,
  })));
  const { error } = await supabase.from("scores").insert(rows);
  return error ? { ok: false, error: error.message, count: 0 } : { ok: true, count: rows.length };
}

type AssignRow = { id: string; user_id: string; created_at: string; meta: { studentId?: string; title?: string; note?: string; items?: Partial<HwItem>[]; date?: string } | null };
const toAssignment = (r: AssignRow): HwAssignment => ({
  id: r.id, coachId: r.user_id, studentId: String(r.meta?.studentId ?? ""),
  title: String(r.meta?.title ?? "作业"), note: String(r.meta?.note ?? ""),
  items: (r.meta?.items ?? []).map(normalizeItem), createdAt: r.created_at,
  date: /^\d{4}-\d{2}-\d{2}$/.test(String(r.meta?.date ?? "")) ? String(r.meta?.date) : dayKeyOf(r.created_at), // 旧记录:布置当天
});

/** 教练布置过的作业(最新在前)。 */
export async function getCoachAssignments(): Promise<HwAssignment[]> {
  const me = await uid();
  if (!me) return [];
  // 2026-11-02:不能只取最新 N 份 —— 一次布置 7 天时最新的都是未来几天的,今天学生在做的反而被挤掉(1022 份里 2260 条成绩看不到)
  const data = await fetchAllRows<AssignRow>((f, t) => supabase.from("scores").select("id,user_id,created_at,meta").eq("game", "hw").eq("mode", "assign").eq("user_id", me).order("created_at", { ascending: false }).order("id").range(f, t));
  const list = data.map(toAssignment);
  const [names, revoked, edited] = await Promise.all([nicknames(list.map((a) => a.studentId)), getRevoked(list), applyEdits(list)]);
  return edited.map((a) => ({ ...a, studentNick: names.get(a.studentId) ?? "学生", revoked: revoked.has(a.id) }));
}

type EditRow = { user_id: string; created_at: string; meta: { assignId?: string; title?: string; note?: string; items?: Partial<HwItem>[] } | null };
/** 把布置者最新一次「直接编辑」覆盖到作业上(标题/说明/项目);没编辑过的原样返回。 */
export async function applyEdits(list: HwAssignment[]): Promise<HwAssignment[]> {
  const byId = new Map(list.map((a) => [a.id, a]));
  const latest = new Map<string, EditRow>();
  const ids = [...byId.keys()];
  const edits = await forChunks(ids, (chunk) => fetchAllRows<EditRow>((f, t) => supabase.from("scores").select("user_id,created_at,meta").eq("game", "hw").eq("mode", "edit").in("meta->>assignId", chunk).order("created_at", { ascending: true }).order("id").range(f, t)));
  for (const r of edits) {
    const id = String(r.meta?.assignId ?? "");
    if (byId.get(id)?.coachId === r.user_id) latest.set(id, r); // 升序,后者覆盖 = 最新(同一份作业的记录都在同一批里)
  }
  return list.map((a) => {
    const e = latest.get(a.id);
    if (!e) return a;
    return { ...a, title: String(e.meta?.title ?? a.title), note: String(e.meta?.note ?? a.note), items: (e.meta?.items ?? []).map(normalizeItem), editedAt: e.created_at };
  });
}

/** 直接编辑若干份作业(同批可一起):追加新版本记录。已有提交按项目序号继续对应。 */
export async function editAssignments(assignIds: string[], title: string, note: string, items: HwItem[]): Promise<{ ok: boolean; error?: string }> {
  const me = await uid();
  if (!me) return { ok: false, error: "请先登录" };
  if (!assignIds.length || !items.length) return { ok: false, error: "至少保留一个项目" };
  const rows = assignIds.map((assignId) => ({ user_id: me, game: "hw", mode: "edit", value: items.length, meta: { assignId, title: title.trim() || "作业", note: note.trim(), items } as never }));
  const { error } = await supabase.from("scores").insert(rows);
  return error ? { ok: false, error: error.message } : { ok: true };
}

type RevokeRow = { user_id: string; meta: { assignId?: string } | null };
/** 已撤回的作业 id 集合:只认「布置者本人」写的撤回记录(别人写的无效)。 */
export async function getRevoked(list: HwAssignment[]): Promise<Set<string>> {
  const out = new Set<string>();
  const byId = new Map(list.map((a) => [a.id, a]));
  const ids = [...byId.keys()];
  const rows = await forChunks(ids, (chunk) => fetchAllRows<RevokeRow>((f, t) => supabase.from("scores").select("user_id,meta").eq("game", "hw").eq("mode", "revoke").in("meta->>assignId", chunk).order("id").range(f, t)));
  for (const r of rows) {
    const id = String(r.meta?.assignId ?? "");
    if (byId.get(id)?.coachId === r.user_id) out.add(id);
  }
  return out;
}

/** 撤回若干份作业(布置错了):学生端立即不再显示;已有提交保留但不计。 */
export async function revokeAssignments(assignIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const me = await uid();
  if (!me) return { ok: false, error: "请先登录" };
  if (!assignIds.length) return { ok: true };
  const rows = assignIds.map((assignId) => ({ user_id: me, game: "hw", mode: "revoke", value: 0, meta: { assignId } as never }));
  const { error } = await supabase.from("scores").insert(rows);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** 同一次「发布」产生的多份作业(同标题、同一毫秒落库)归为一批 —— 撤回/复制按批操作。 */
export const batchKey = (a: Pick<HwAssignment, "title" | "createdAt">): string => `${a.title}|${a.createdAt}`;

/** 学生收到的作业(只认已加入教练的;最新在前)。 */
export async function getStudentAssignments(): Promise<HwAssignment[]> {
  const me = await uid();
  if (!me) return [];
  const coaches = await getMyCoaches();
  const allowed = new Set(coaches.map((c) => c.id));
  const data = await fetchAllRows<AssignRow>((f, t) => supabase.from("scores").select("id,user_id,created_at,meta").eq("game", "hw").eq("mode", "assign").eq("meta->>studentId", me).order("created_at", { ascending: false }).order("id").range(f, t));
  const nick = new Map(coaches.map((c) => [c.id, c.nickname]));
  const list = data.map(toAssignment).filter((a) => allowed.has(a.coachId));
  const [revoked, edited] = await Promise.all([getRevoked(list), applyEdits(list)]);
  return edited.filter((a) => !revoked.has(a.id)).map((a) => ({ ...a, coachNick: nick.get(a.coachId) }));
}

type SubmitRow = { id: string; user_id: string; created_at: string; meta: { assignId?: string; itemIdx?: number; results?: HwResult[]; correct?: number; total?: number; ms?: number; retry?: boolean } | null };
const toSubmission = (r: SubmitRow): HwSubmission => ({
  id: r.id, studentId: r.user_id, createdAt: r.created_at,
  assignId: String(r.meta?.assignId ?? ""), itemIdx: Number(r.meta?.itemIdx ?? 0),
  results: Array.isArray(r.meta?.results) ? r.meta!.results! : [],
  correct: Number(r.meta?.correct ?? 0), total: Number(r.meta?.total ?? 0), ms: Number(r.meta?.ms ?? 0), retry: !!r.meta?.retry,
});

/** 一组作业的全部提交(含错题重做),按时间升序。 */
export async function getSubmissions(assignIds: string[]): Promise<HwSubmission[]> {
  if (!assignIds.length) return [];
  const rows = await forChunks(assignIds, (chunk) => fetchAllRows<SubmitRow>((f, t) => supabase.from("scores").select("id,user_id,created_at,meta").eq("game", "hw").eq("mode", "submit").in("meta->>assignId", chunk).order("created_at", { ascending: true }).order("id").range(f, t)));
  return rows.map(toSubmission);
}

export async function submitHomework(assignId: string, itemIdx: number, results: HwResult[], retry: boolean): Promise<{ ok: boolean; error?: string }> {
  const me = await uid();
  if (!me) return { ok: false, error: "请先登录" };
  const correct = results.filter((r) => r.correct).length;
  const ms = results.reduce((s, r) => s + r.ms, 0);
  const { error } = await supabase.from("scores").insert({
    user_id: me, game: "hw", mode: "submit", value: correct,
    meta: { assignId, itemIdx, results, correct, total: results.length, ms, retry } as never,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ===== 作业暂存(2026-10-26 布施:「30 题做了 20 题,点暂存就能保存 20 题的答案,后面再点进去可以继续做」)=====
// 和提交一样存 scores(game=hw, mode=draft),零迁移;换设备也能接着做。本机再存一份兜底(断网时也不丢)。
// 生效规则:同一项最新的草稿,且它之后本人没有再提交过这一项,才算「未完成的暂存」。
export interface HwDraft { assignId: string; itemIdx: number; problems: HwProblem[]; results: HwResult[]; round: number; createdAt: string }
const draftKey = (assignId: string, itemIdx: number) => `hw:draft:${assignId}:${itemIdx}`;
export async function saveDraft(assignId: string, itemIdx: number, problems: HwProblem[], results: HwResult[], round: number): Promise<{ ok: boolean; error?: string }> {
  const d: HwDraft = { assignId, itemIdx, problems, results, round, createdAt: new Date().toISOString() };
  try { localStorage.setItem(draftKey(assignId, itemIdx), JSON.stringify(d)); } catch { /* noop */ }
  const me = await uid();
  if (!me) return { ok: false, error: "请先登录" };
  const { error } = await supabase.from("scores").insert({
    user_id: me, game: "hw", mode: "draft", value: results.length,
    meta: { assignId, itemIdx, problems, results, round } as never,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
type DraftRow = { created_at: string; meta: { assignId?: string; itemIdx?: number; problems?: HwProblem[]; results?: HwResult[]; round?: number } | null };
/** 本人在这些作业上的暂存(服务器 + 本机,同一项取最新) */
export async function getMyDrafts(assignIds: string[]): Promise<HwDraft[]> {
  const me = await uid();
  const out: HwDraft[] = [];
  if (me && assignIds.length) {
    for (let i = 0; i < assignIds.length; i += 100) {
      const chunk = assignIds.slice(i, i + 100);
      const { data } = await supabase.from("scores").select("created_at,meta").eq("user_id", me).eq("game", "hw").eq("mode", "draft").in("meta->>assignId", chunk).order("created_at", { ascending: true }).limit(1000);
      for (const r of (data ?? []) as DraftRow[]) {
        if (!r.meta || !Array.isArray(r.meta.problems)) continue;
        out.push({ assignId: String(r.meta.assignId ?? ""), itemIdx: Number(r.meta.itemIdx ?? 0), problems: r.meta.problems, results: Array.isArray(r.meta.results) ? r.meta.results : [], round: Number(r.meta.round ?? 0), createdAt: r.created_at });
      }
    }
  }
  for (const id of assignIds) for (let k = 0; k < 20; k++) {
    try { const raw = localStorage.getItem(draftKey(id, k)); if (raw) { const d = JSON.parse(raw) as HwDraft; if (Array.isArray(d.problems)) out.push(d); } } catch { /* noop */ }
  }
  return out;
}
/** 这一项当前未完成的暂存(没有就 null):最新草稿,之后没再提交过,且还没做完 */
export function activeDraft(drafts: HwDraft[], subs: HwSubmission[], assignId: string, itemIdx: number): HwDraft | null {
  const mine = drafts.filter((d) => d.assignId === assignId && d.itemIdx === itemIdx).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  const d = mine[mine.length - 1];
  if (!d || !d.results.length || d.results.length >= d.problems.length) return null;
  const after = subs.some((s) => s.assignId === assignId && s.itemIdx === itemIdx && s.createdAt > d.createdAt);
  return after ? null : d;
}
/** 这一项交卷后清掉本机草稿(服务器上的旧草稿因为「之后有提交」自动失效) */
export const clearLocalDraft = (assignId: string, itemIdx: number) => { try { localStorage.removeItem(draftKey(assignId, itemIdx)); } catch { /* noop */ } };

type ReviewRow = { id: string; user_id: string; created_at: string; meta: { assignId?: string; stars?: number; comment?: string } | null };
export async function getReviews(assignIds: string[]): Promise<HwReview[]> {
  if (!assignIds.length) return [];
  const rows = await forChunks(assignIds, (chunk) => fetchAllRows<ReviewRow>((f, t) => supabase.from("scores").select("id,user_id,created_at,meta").eq("game", "hw").eq("mode", "review").in("meta->>assignId", chunk).order("created_at", { ascending: true }).order("id").range(f, t)));
  return rows.map((r) => ({ id: r.id, coachId: r.user_id, createdAt: r.created_at, assignId: String(r.meta?.assignId ?? ""), stars: Number(r.meta?.stars ?? 0), comment: String(r.meta?.comment ?? "") }));
}

export async function reviewHomework(assignId: string, stars: number, comment: string): Promise<{ ok: boolean; error?: string }> {
  const me = await uid();
  if (!me) return { ok: false, error: "请先登录" };
  const s = Math.min(5, Math.max(1, Math.round(stars)));
  const { error } = await supabase.from("scores").insert({ user_id: me, game: "hw", mode: "review", value: s, meta: { assignId, stars: s, comment: comment.trim() } as never });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ===== 进度归纳(纯函数,便于测试) =====

export interface ItemProgress { itemIdx: number; first?: HwSubmission; retries: HwSubmission[]; done: boolean; finalAllCorrect: boolean }
export interface AssignProgress { items: ItemProgress[]; doneCount: number; total: number; status: "todo" | "doing" | "done"; correct: number; answered: number; ms: number; latestAt?: string }

/** 把某份作业的提交归纳成每项进度:首做 + 若干错题重做;最终是否全对 = 首做全对或最后一次重做全对。 */
// 按作业分组缓存:大班几千条成绩时,summarize 每次都全表扫一遍,教练页每个格子都算会卡(2026-11-02)
const subsIndex = new WeakMap<HwSubmission[], Map<string, HwSubmission[]>>();
function subsOf(assignId: string, subs: HwSubmission[]): HwSubmission[] {
  let idx = subsIndex.get(subs);
  if (!idx) {
    idx = new Map();
    for (const s of [...subs].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) { const l = idx.get(s.assignId); if (l) l.push(s); else idx.set(s.assignId, [s]); }
    subsIndex.set(subs, idx);
  }
  return idx.get(assignId) ?? [];
}

export function summarize(a: HwAssignment, subs: HwSubmission[]): AssignProgress {
  const mine = subsOf(a.id, subs);
  const items: ItemProgress[] = a.items.map((_, itemIdx) => {
    const list = mine.filter((s) => s.itemIdx === itemIdx);
    const first = list.find((s) => !s.retry) ?? list[0];
    const retries = list.filter((s) => s !== first);
    const last = list[list.length - 1];
    return { itemIdx, first, retries, done: !!first, finalAllCorrect: !!last && last.correct === last.total };
  });
  const doneCount = items.filter((i) => i.done).length;
  const firsts = items.map((i) => i.first).filter((s): s is HwSubmission => !!s);
  return {
    items, doneCount, total: a.items.length,
    status: doneCount === 0 ? "todo" : doneCount < a.items.length ? "doing" : "done",
    correct: firsts.reduce((s, x) => s + x.correct, 0),
    answered: firsts.reduce((s, x) => s + x.total, 0),
    ms: firsts.reduce((s, x) => s + x.ms, 0),
    latestAt: mine.length ? mine[mine.length - 1].createdAt : undefined,
  };
}

export const fmtDur = (ms: number): string => (ms < 60000 ? `${(ms / 1000).toFixed(0)}秒` : `${Math.floor(ms / 60000)}分${Math.round((ms % 60000) / 1000)}秒`);
export const fmtDate = (iso: string): string => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** 管理后台:全站作业(所有教练),含编辑覆盖与撤回标记,带教练/学生昵称。 */
export async function getAllAssignments(): Promise<HwAssignment[]> {
  const data = await fetchAllRows<AssignRow>((f, t) => supabase.from("scores").select("id,user_id,created_at,meta").eq("game", "hw").eq("mode", "assign").order("created_at", { ascending: false }).order("id").range(f, t));
  const list = data.map(toAssignment);
  const [names, revoked, edited] = await Promise.all([nicknames([...list.map((a) => a.studentId), ...list.map((a) => a.coachId)]), getRevoked(list), applyEdits(list)]);
  return edited.map((a) => ({ ...a, studentNick: names.get(a.studentId) ?? "学生", coachNick: names.get(a.coachId) ?? "教练", revoked: revoked.has(a.id) }));
}
