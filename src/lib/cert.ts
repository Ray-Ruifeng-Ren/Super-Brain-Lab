// 闪电心算等级鉴定(锦标赛) v2 —— 2026-09-19 对齐日本フラッシュ暗算検定官方标准
// (付海东提供;数据源 kentei.soroban-soft.com/about_test.cgi,文部科学省后援):
// 20级(最易)→1级 → 初段→二十段(Grand Master),共 40 级,纯加法闪现。
// 每级规定 位数/口数/整题闪现总时长(均分到每口);10 题对 7 合格(70分),对 5-6 准合格。
// 低级位特殊规则(官方備考):
//   nocarry(13-17级,1位): 繰り上がりなし —— 尽量不进位(个位相加不满十,凑不出时才小步进位)
//   tens(12级): 整十数 10,20…90    zorome(11级): 叠数 11,22…99(两位同数)
//   image(18-20级): イメージ —— 数字常驻不闪、不限时,幼儿看数凑加
// 段位内独立榜单按「作答总用时」;成绩存 scores 表 game='cert'、mode=level.id(k20…k1,d1…d20)。
// 旧自定 9 级体系(mode='L1..L9',2026-09-12 上线一周)已废弃,历史数据保留在库、不再展示。
import { siteUrl } from "@/lib/appEnv";
import { supabase } from "@/integrations/supabase/client";
import { buildProblem, type Problem } from "@/lib/flashMath";

export const CERT_PROBLEMS = 10;
export const CERT_PASS = 7;      // 官方合格线:10 题对 7(70 分)
export const CERT_SEMI = 5;      // 50-60 分 = 准合格

export type CertRule = "normal" | "nocarry" | "zorome" | "tens" | "image";
export interface CertLevel {
  id: string;            // k20…k1(级) d1…d20(段) —— 云端 mode 键
  rank: number;          // 0(20级,最易)…39(二十段) —— 徽章取最高 rank
  kind: "kyu" | "dan";
  n: number;             // 级/段号
  label: string;         // 20级…1级 / 初段…二十段
  digits: 1 | 2 | 3;
  count: number;         // 口数(闪现的加数个数)
  timeSec: number | null; // 整题闪现总时长;null = image(常驻显示)
  rule: CertRule;
  title?: string;        // 十一段以上的国际称号(Bronze…Grand Master)
}

const CN_DAN = ["初", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"];

// [级/段号, 位数, 口数, 总秒, 规则, 称号] —— 逐行照抄官方問題レベル一覧
type Row = [number, 1 | 2 | 3, number, number | null, CertRule, string?];
const KYU_ROWS: Row[] = [
  [20, 1, 3, null, "image"], [19, 1, 3, null, "image"], [18, 1, 5, null, "image"],
  [17, 1, 8, 10, "nocarry"], [16, 1, 10, 12, "nocarry"], [15, 1, 12, 15, "nocarry"],
  [14, 1, 15, 15, "nocarry"], [13, 1, 20, 15, "nocarry"],
  [12, 2, 10, 10, "tens"], [11, 2, 15, 15, "zorome"],
  [10, 2, 2, 4, "normal"], [9, 2, 3, 6, "normal"], [8, 2, 4, 7, "normal"], [7, 2, 5, 8, "normal"],
  [6, 2, 6, 9, "normal"], [5, 2, 7, 10, "normal"], [4, 2, 8, 11, "normal"], [3, 2, 10, 12, "normal"],
  [2, 2, 12, 12, "normal"], [1, 2, 15, 13, "normal"],
];
const DAN_ROWS: Row[] = [
  [1, 2, 15, 10, "normal"],
  [2, 3, 4, 4, "normal"], [3, 3, 6, 5, "normal"], [4, 3, 8, 6, "normal"], [5, 3, 10, 7, "normal"],
  [6, 3, 12, 8, "normal"], [7, 3, 15, 8, "normal"], [8, 3, 15, 6, "normal"], [9, 3, 15, 4.5, "normal"],
  [10, 3, 15, 3, "normal"],
  [11, 3, 15, 2.8, "normal", "Bronze"], [12, 3, 15, 2.6, "normal", "Silver"],
  [13, 3, 15, 2.4, "normal", "Gold"], [14, 3, 15, 2.2, "normal", "Gold A"],
  [15, 3, 15, 2.0, "normal", "Platinum"], [16, 3, 15, 1.9, "normal", "Platinum A"],
  [17, 3, 15, 1.8, "normal", "Diamond"], [18, 3, 15, 1.7, "normal", "Diamond A"],
  [19, 3, 15, 1.6, "normal", "Master"], [20, 3, 15, 1.5, "normal", "Grand Master"],
];

export const CERT_LEVELS: CertLevel[] = [
  ...KYU_ROWS.map(([n, digits, count, timeSec, rule], i): CertLevel => ({
    id: `k${n}`, rank: i, kind: "kyu", n, label: `${n}级`, digits, count, timeSec, rule,
  })),
  ...DAN_ROWS.map(([n, digits, count, timeSec, rule, title], i): CertLevel => ({
    id: `d${n}`, rank: KYU_ROWS.length + i, kind: "dan", n, label: `${CN_DAN[n - 1]}段`, digits, count, timeSec, rule, title,
  })),
];

/** 级别名(英文版 2026-10-27 用户「切换成英文,它不是英文显示」):20 Kyu … 1 Kyu / 1 Dan … 20 Dan */
export const levelName = (lv: CertLevel, en = false): string => (en ? `${lv.n} ${lv.kind === "kyu" ? "Kyu" : "Dan"}` : lv.label);

const BY_ID = new Map(CERT_LEVELS.map((l) => [l.id, l]));
export const levelById = (id: string): CertLevel | undefined => BY_ID.get(id);
export const nextLevel = (lv: CertLevel): CertLevel | undefined => CERT_LEVELS[lv.rank + 1];

/** 每口闪现时长(ms);image 级返回 0(常驻不闪)。 */
export const strokeMs = (lv: CertLevel): number => (lv.timeSec ? Math.round((lv.timeSec * 1000) / lv.count) : 0);

/** 徽章带色:高段金 > 段位橙 > 高级绿 > 启蒙蓝。 */
export function levelColor(lv: CertLevel): string {
  if (lv.kind === "dan") return lv.n >= 11 ? "#B08A3E" : "#C96A1E";
  return lv.n <= 10 ? "#4C9A63" : "#7B93B5";
}

/** 已通过的级别 id 集合 → 最高徽章(rank 最大)。 */
export function bestBadge(passed: Set<string>): CertLevel | null {
  let best: CertLevel | null = null;
  for (const id of passed) {
    const lv = BY_ID.get(id);
    if (lv && (!best || lv.rank > best.rank)) best = lv;
  }
  return best;
}

// ===== 出题(纯加法) =====

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]): T => a[rand(a.length)];

/** 按官方规则出一道题;terms 均为正、signs 全 "+"。 */
export function genCertProblem(lv: CertLevel): Problem {
  if (lv.rule === "normal") return buildProblem(lv.count, lv.digits, false);

  const terms: number[] = [];
  let T = 0;
  if (lv.rule === "image") {
    // 常驻显示的启蒙题:严格不进位 —— 总和 ≤9,拆成 count 个 ≥1 的加数
    const total = Math.max(lv.count, lv.count + rand(10 - lv.count)); // count..9
    let left = total;
    for (let i = 0; i < lv.count; i++) {
      const remainSlots = lv.count - i - 1;
      const maxHere = left - remainSlots; // 给后面每口留 ≥1
      const d = i === lv.count - 1 ? left : 1 + rand(maxHere);
      terms.push(d); left -= d;
    }
    return { terms, signs: terms.map(() => "+" as const), answer: total };
  }
  for (let i = 0; i < lv.count; i++) {
    let cands: number[];
    if (lv.rule === "nocarry") {
      // 个位相加不满十;个位顶到 9 凑不出时,才用 1-2 小步进位(官方 20 口在数学上不可能全程不进位)
      const room = 9 - (T % 10);
      cands = room >= 1 ? Array.from({ length: room }, (_, k) => k + 1) : [1, 2];
      // 偏小数字(官方"不进位"题以 1-3 为主,且 1、2 居多):个位爬得慢,被顶死才小步进位
      // 2026-10-15 自检:原 75% 取 ≤3 时 20 口偶尔进位 6 次(测试 C2 抖动),改为 1:2:3 ≈ 5:3:2 的权重
      if (room >= 1) {
        const r = Math.random();
        const cap = r < 0.5 ? 1 : r < 0.8 ? 2 : 3;
        const small = cands.filter((d) => d <= cap);
        cands = small.length ? small : cands;
      }
    } else if (lv.rule === "tens") {
      // 整十数:十位相加尽量不满十
      const room = 9 - (Math.floor(T / 10) % 10);
      cands = (room >= 1 ? Array.from({ length: room }, (_, k) => k + 1) : [1, 2]).map((d) => d * 10);
    } else {
      // 叠数 11,22…99:个位、十位同时尽量不进位
      const r1 = 9 - (T % 10), r10 = 9 - (Math.floor(T / 10) % 10);
      const room = Math.min(r1, r10);
      cands = (room >= 1 ? Array.from({ length: room }, (_, k) => k + 1) : [1]).map((d) => d * 11);
    }
    // 别和上一口相同(有得选时)
    const prev = terms[terms.length - 1];
    const noDup = cands.filter((c) => c !== prev);
    const d = pick(noDup.length ? noDup : cands);
    terms.push(d); T += d;
  }
  return { terms, signs: terms.map(() => "+" as const), answer: T };
}

// ===== 年龄组(2026-09-19 用户定:注册收年龄,考试按组比拼,不可乱选他组;分组线待付海东确认) =====

export interface AgeGroup { id: string; label: string; labelEn: string; min: number; max: number }
export const AGE_GROUPS: AgeGroup[] = [
  { id: "kid", label: "幼儿组(≤6岁)", labelEn: "Preschool (≤6)", min: 0, max: 6 },
  { id: "child_a", label: "少儿甲组(7-9岁)", labelEn: "Junior A (7-9)", min: 7, max: 9 },
  { id: "child_b", label: "少儿乙组(10-12岁)", labelEn: "Junior B (10-12)", min: 10, max: 12 },
  { id: "youth", label: "青少年组(13-17岁)", labelEn: "Youth (13-17)", min: 13, max: 17 },
  { id: "adult", label: "成人组(≥18岁)", labelEn: "Adult (≥18)", min: 18, max: 200 },
];
export const groupForAge = (age: number): AgeGroup =>
  AGE_GROUPS.find((g) => age >= g.min && age <= g.max) ?? AGE_GROUPS[AGE_GROUPS.length - 1];
export const groupById = (id: string): AgeGroup | undefined => AGE_GROUPS.find((g) => g.id === id);

/** 账号元数据里的出生年 → 当前周岁;未填/不合法 → null。存出生年而非年龄,数据不过期。 */
export function ageFromUser(user: { user_metadata?: Record<string, unknown> } | null | undefined): number | null {
  const by = Number(user?.user_metadata?.birthYear);
  const now = new Date().getFullYear();
  if (!Number.isFinite(by) || by < now - 120 || by > now) return null;
  return Math.max(3, now - by);
}

/** 补填年龄(老用户进考场时弹窗):按周岁换算出生年,写入账号元数据(跨设备生效)。 */
export async function saveMyAge(age: number): Promise<{ ok: boolean; error?: string }> {
  const a = Math.round(age);
  if (!Number.isFinite(a) || a < 3 || a > 99) return { ok: false, error: "请输入 3-99 的年龄" };
  const { error } = await supabase.auth.updateUser({ data: { birthYear: new Date().getFullYear() - a } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ===== 付费开考:准考证号(2026-09-19) =====

export const TICKET_PRICE: Record<"kyu" | "dan", string> = { kyu: "29.9", dan: "39.9" };

/** 核销准考证号:服务端验签+查重+落已用记录;成功即放行一场考试。 */
export async function redeemTicket(code: string, lv: CertLevel): Promise<{ ok: boolean; error?: string }> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) return { ok: false, error: "请先登录" };
  try {
    const res = await fetch(siteUrl("/.netlify/functions/ticket"), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "redeem", code, levelKind: lv.kind, levelId: lv.id, authToken: token }),
    });
    const j = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: j.error || "校验失败,请重试" };
  } catch {
    return { ok: false, error: "网络异常,请重试" };
  }
}

// ===== 云端读写 =====

const ID_RE = /^[kd]\d{1,2}$/;

export interface CertRunMeta { correct: number; total: number; timeSec: number | null; age?: number; ageGroup?: string }
export interface CertBoardRow { user_id: string; nickname: string; rank: number; ms: number; correct: number; created_at: string }
export interface MyCertEntry { ms: number; firstAt: string }

/** 提交一场合格的鉴定(不合格不落库;value=作答总用时 ms)。 */
export async function submitCertRun(levelId: string, totalAnswerMs: number, meta: CertRunMeta): Promise<{ ok: boolean; error?: string }> {
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  if (!user) return { ok: false, error: "未登录" };
  const { error } = await supabase.from("scores").insert({
    user_id: user.id, game: "cert", mode: levelId,
    value: Math.round(totalAnswerMs), meta: meta as any,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** 某级别榜单:每人取最快一场,作答总用时升序;groupId 给定时只看该年龄组(缺组的历史成绩不入组榜)。 */
export async function getCertBoard(levelId: string, limit = 20, groupId?: string): Promise<CertBoardRow[]> {
  const { data } = await supabase
    .from("scores")
    .select("user_id,value,meta,created_at,profiles(nickname)")
    .eq("game", "cert").eq("mode", levelId)
    .order("value", { ascending: true })
    .limit(500);
  const best = new Map<string, CertBoardRow>();
  for (const r of (data ?? []) as any[]) {
    if (groupId && r.meta?.ageGroup !== groupId) continue;
    const ms = typeof r.value === "string" ? Number(r.value) : r.value;
    const cur = best.get(r.user_id);
    if (!cur || ms < cur.ms)
      best.set(r.user_id, { user_id: r.user_id, nickname: r.profiles?.nickname || "玩家", rank: 0, ms, correct: Number(r.meta?.correct ?? 0), created_at: r.created_at });
  }
  return [...best.values()].sort((a, b) => a.ms - b.ms).slice(0, limit).map((x, i) => ({ ...x, rank: i + 1 }));
}

/** 当前用户各级最好成绩(通过的级别 id → 最快用时+首考日期)。未登录 → 空。 */
export async function getMyCert(): Promise<Map<string, MyCertEntry>> {
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  const out = new Map<string, MyCertEntry>();
  if (!user) return out;
  const { data } = await supabase
    .from("scores").select("mode,value,created_at")
    .eq("game", "cert").eq("user_id", user.id);
  for (const r of (data ?? []) as any[]) {
    const id = String(r.mode);
    if (!ID_RE.test(id) || !BY_ID.has(id)) continue;
    const ms = typeof r.value === "string" ? Number(r.value) : r.value;
    const cur = out.get(id);
    out.set(id, {
      ms: cur === undefined || ms < cur.ms ? ms : cur.ms,
      firstAt: cur === undefined || r.created_at < cur.firstAt ? r.created_at : cur.firstAt,
    });
  }
  return out;
}

/** 批量取用户的最高徽章(排行榜里给昵称戴徽章用;一次查询,客户端归并)。 */
export async function getCertBadges(userIds: string[]): Promise<Map<string, CertLevel>> {
  const out = new Map<string, CertLevel>();
  if (userIds.length === 0) return out;
  const { data } = await supabase
    .from("scores").select("user_id,mode")
    .eq("game", "cert").in("user_id", [...new Set(userIds)]);
  const bestRank = new Map<string, CertLevel>();
  for (const r of (data ?? []) as any[]) {
    const lv = BY_ID.get(String(r.mode));
    if (!lv) continue;
    const cur = bestRank.get(r.user_id);
    if (!cur || lv.rank > cur.rank) bestRank.set(r.user_id, lv);
  }
  for (const [uid, lv] of bestRank) out.set(uid, lv);
  return out;
}

/** 证书编号:级别 + 首考日期 + 用户id前4位,稳定可复现。 */
export function certNo(levelId: string, dateISO: string, userId: string): string {
  const d = new Date(dateISO);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `SBL-${levelId.toUpperCase()}-${ymd}-${userId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

// ===== 赛后建议 =====

export interface CertAdvice { title: string; detail: string; trainDigits?: number; trainSpeedMs?: number; suggestLevelId?: string }

/** 级别参数一句话(展示用)。 */
export function levelSpec(lv: CertLevel, en = false): string {
  if (en) {
    const base = `${lv.digits}-digit · ${lv.count} terms`;
    if (lv.rule === "image") return `${base} · numbers stay on screen (starter)`;
    const extra = lv.rule === "nocarry" ? " · no carrying" : lv.rule === "tens" ? " · multiples of 10" : lv.rule === "zorome" ? " · repdigits (11, 22…)" : "";
    return `${base} · flashed within ${lv.timeSec}s${extra}`;
  }
  // 中国习惯的描述:几位 几笔 几秒(官方表的「口数」即笔数)
  const base = `${lv.digits}位数 · ${lv.count} 笔`;
  if (lv.rule === "image") return `${base} · 数字常驻不闪(启蒙)`;
  const extra = lv.rule === "nocarry" ? " · 不进位" : lv.rule === "tens" ? " · 整十数" : lv.rule === "zorome" ? " · 叠数(11,22…)" : "";
  return `${base} · ${lv.timeSec} 秒内闪完${extra}`;
}

/** 鉴定结束的训练建议。没过 → 往「更容易」的方向指(退一级/放慢),绝不往更难推(2026-09-19 用户纠正)。 */
export function certAdvice(lv: CertLevel, correct: number, avgAnswerMs: number, passed: boolean, en = false): CertAdvice {
  const next = nextLevel(lv);
  const prev = lv.rank > 0 ? CERT_LEVELS[lv.rank - 1] : undefined; // 更容易的一级(时间更长/笔数更少)
  if (en) {
    const N = (l: CertLevel) => levelName(l, true), S = (l: CertLevel) => levelSpec(l, true);
    if (!passed) {
      if (correct >= CERT_SEMI) return { title: `Semi-pass (${correct * 10} pts) — so close!`, detail: `50-60 points counts as a semi-pass. You're right at the bar for ${N(lv)} (${S(lv)}) — stay calm and take it once more.` };
      if (prev) return {
        title: `Step back one level and lock in ${N(prev)} first`,
        detail: `${N(lv)} (${S(lv)}) is still a stretch this time. Pass the more comfortable ${N(prev)} (${S(prev)}) to earn the badge, get your rhythm back, then come back up. You can also practise ${prev.digits}-digit · ${prev.count} terms · addition only in Flash training.`,
        trainDigits: prev.digits, trainSpeedMs: strokeMs(prev) || 1000, suggestLevelId: prev.id,
      };
      return { title: "Warm up in Flash training first", detail: `20 Kyu is the entry level (${S(lv)}). No rush — practise 1-digit · 3 terms · slow · addition only in Flash training, then come back.`, trainDigits: 1, trainSpeedMs: 1500 };
    }
    if (next) {
      const tip = avgAnswerMs > 6000
        ? `Your answers are a bit slow (avg ${fmtMs(avgAnswerMs)} per problem). Practise answering faster in Flash training and your rank will jump.`
        : `Next up, ${N(next)}: ${S(next)}. Try a few rounds at this pace in Flash training before the attempt.`;
      return { title: `Congratulations on ${N(lv)}! Next: ${N(next)}`, detail: tip, trainDigits: next.digits, trainSpeedMs: strokeMs(next) || 1000 };
    }
    return { title: "20 Dan Grand Master — the summit!", detail: "You hold the highest rank on the site. Keep cutting your total answer time to stay at the top of the board." };
  }
  if (!passed) {
    if (correct >= CERT_SEMI)
      return { title: `准合格(${correct * 10}分)!就差一口气`, detail: `官方口径 50-60 分算准合格 —— ${lv.label}(${levelSpec(lv)})你已经摸到门槛,稳住心态再考一场。` };
    if (prev)
      return {
        title: `建议退一级,先考${prev.label}拿稳`,
        detail: `${lv.label}(${levelSpec(lv)})这次差得还多,硬磕容易挫败 —— 先把更从容的${prev.label}(${levelSpec(prev)})考下来拿到徽章,节奏找回来再上来冲。平时也可在综合训练按 ${prev.digits}位 · ${prev.count}笔 · 纯加 练手感。`,
        trainDigits: prev.digits, trainSpeedMs: strokeMs(prev) || 1000,
        suggestLevelId: prev.id,
      };
    return {
      title: "先回综合训练找手感",
      detail: `20级已是最入门档(${levelSpec(lv)}),别急 —— 去「闪电心算·综合训练」用 1位 · 3笔 · 慢速 · 纯加 练一练,再回来考。`,
      trainDigits: 1, trainSpeedMs: 1500,
    };
  }
  if (next) {
    const tip = avgAnswerMs > 6000
      ? `你的出数偏慢(平均每题作答 ${fmtMs(avgAnswerMs)}),先在综合训练刷快出数,榜单名次会立刻上去。`
      : `下一关 ${next.label}:${levelSpec(next)},建议先在综合训练按这个节奏适应几场再挑战。`;
    return { title: `恭喜考取${lv.label}!下一关:${next.label}`, detail: tip, trainDigits: next.digits, trainSpeedMs: strokeMs(next) || 1000 };
  }
  return { title: "二十段 Grand Master,已是天花板!", detail: "全站最高段位到手 —— 把作答总用时再往下压,守住段位榜榜首。" };
}

export const fmtSec = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : ms % 100 === 0 ? 1 : 2)} 秒`;
export const fmtMs = (ms: number) => { const s = Math.floor(ms / 1000); const cs = Math.floor((ms % 1000) / 10); return `${s}.${String(cs).padStart(2, "0")}s`; };
