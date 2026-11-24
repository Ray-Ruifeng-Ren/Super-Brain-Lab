// Cloud-backed leaderboard + game metadata.
// LocalStorage helpers from v1 are kept for legacy fall-through but new
// scores are persisted in Supabase via supabase client.

import { supabase } from "@/integrations/supabase/client";
import { dayKey, streakFromDays, rankBy } from "@/lib/rankUtils";
import { mulD, divisionD } from "@/lib/difficulty";

export type GameId = "flashmath" | "abacus" | "schulte" | "reaction" | "nback" | "cards" | "orbit" | "gauntlet";
export type ScoreDirection = "lower" | "higher";
export type Period = "weekly" | "all";

export interface ScoreRow {
  id: string;
  user_id: string;
  game: GameId;
  mode: string;
  value: number;
  meta: Record<string, unknown>;
  created_at: string;
  // joined
  nickname?: string;
}

export const GAMES: Record<
  GameId,
  {
    id: GameId;
    name: string;
    tagline: string;
    description: string;
    direction: ScoreDirection;
    formatValue: (v: number) => string;
    valueLabel: string;
    initial: string;
  }
> = {
  flashmath: {
    id: "flashmath",
    name: "闪电心算",
    tagline: "Flash Mental Arithmetic",
    description: "数字逐笔闪现，心算累加。支持语音作答。",
    direction: "higher",
    formatValue: (v) => `${Math.round(v)}`,
    valueLabel: "得分",
    initial: "F",
  },
  abacus: {
    id: "abacus",
    name: "珠心算",
    tagline: "Abacus Mental Math",
    description: "闪算 / 看算 / 听算三大模式，专业珠心算出题规则。",
    direction: "higher",
    formatValue: (v) => `${Math.round(v)}`,
    valueLabel: "得分",
    initial: "A",
  },
  schulte: {
    id: "schulte",
    name: "舒尔特方格",
    tagline: "Schulte Table",
    description: "依序点击 1→N 数字，专注力经典训练。",
    direction: "lower",
    formatValue: (v) => formatTime(v),
    valueLabel: "用时",
    initial: "S",
  },
  reaction: {
    id: "reaction",
    name: "反应速度",
    tagline: "Reaction Time",
    description: "屏幕变绿瞬间立刻点击，毫秒级反应测试。",
    direction: "lower",
    formatValue: (v) => `${Math.round(v)}ms`,
    valueLabel: "反应",
    initial: "R",
  },
  nback: {
    id: "nback",
    name: "N-Back",
    tagline: "Working Memory",
    description: "工作记忆的国际黄金标准训练。",
    direction: "higher",
    formatValue: (v) => `${Math.round(v)}%`,
    valueLabel: "命中",
    initial: "N",
  },
  cards: {
    id: "cards",
    name: "扑克记忆",
    tagline: "Card Memory",
    description: "随机洗一副 52 张扑克牌，记忆顺序后翻面互测。",
    direction: "higher",
    formatValue: (v) => `${Math.round(v)}`,
    valueLabel: "得分",
    initial: "C",
  },
  orbit: {
    id: "orbit",
    name: "轨道追焦",
    tagline: "Orbit Focus",
    description: "眼动追踪 × 专注力。光点沿轨道运动，盯住目标并应对突发挑战。",
    direction: "higher",
    formatValue: (v) => `${Math.round(v)}`,
    valueLabel: "得分",
    initial: "O",
  },
  gauntlet: {
    id: "gauntlet",
    name: "障碍闪电心算",
    tagline: "Gauntlet Flash Math",
    description: "在位置漂移、干扰数字、噪点背景与颜色反转中完成闪电心算。",
    direction: "higher",
    formatValue: (v) => `${Math.round(v)}`,
    valueLabel: "得分",
    initial: "G",
  },
};

// ===== Orbit Focus: 双轨榜单（独立等级 + 通榜 PFI） =====
export const ORBIT_LEVEL_WEIGHTS = [1.0, 1.2, 1.5, 1.9, 2.4, 3.0, 3.7, 4.5, 5.5, 7.0];
export const ORBIT_MAX_LEVEL = 10;

/** 取当前用户每个等级的最高分，计算 PFI（个人专注指数） */
export async function computeOrbitPFI(userId: string): Promise<{
  pfi: number;
  bestByLevel: Record<number, { value: number; stars: number }>;
  cleared: number;
}> {
  const { data } = await supabase
    .from("scores")
    .select("mode,value,meta")
    .eq("game", "orbit")
    .eq("user_id", userId)
    .like("mode", "L%");
  const bestByLevel: Record<number, { value: number; stars: number }> = {};
  if (data) {
    for (const r of data as any[]) {
      const m = String(r.mode).match(/^L(\d+)$/);
      if (!m) continue;
      const lv = Number(m[1]);
      if (lv < 1 || lv > ORBIT_MAX_LEVEL) continue;
      const v = typeof r.value === "string" ? Number(r.value) : r.value;
      const stars = Number(r.meta?.stars ?? 0);
      const cur = bestByLevel[lv];
      if (!cur || v > cur.value) bestByLevel[lv] = { value: v, stars };
    }
  }
  let pfi = 0;
  let cleared = 0;
  for (let lv = 1; lv <= ORBIT_MAX_LEVEL; lv++) {
    const b = bestByLevel[lv];
    if (!b) continue;
    cleared += 1;
    const starBonus = b.stars >= 3 ? 1.15 : 1;
    pfi += b.value * ORBIT_LEVEL_WEIGHTS[lv - 1] * starBonus;
  }
  return { pfi: Math.round(pfi), bestByLevel, cleared };
}

/** 提交单局后，重算并写入通榜（仅当超过当前 overall 最高才写） */
export async function submitOrbitOverall(userId: string): Promise<number> {
  const { pfi, cleared } = await computeOrbitPFI(userId);
  if (pfi <= 0) return 0;
  const { data: prev } = await supabase
    .from("scores")
    .select("value")
    .eq("game", "orbit")
    .eq("mode", "overall")
    .eq("user_id", userId)
    .order("value", { ascending: false })
    .limit(1);
  const prevBest = prev && prev.length > 0 ? Number((prev[0] as any).value) : 0;
  if (pfi <= prevBest) return pfi;
  await supabase.from("scores").insert({
    user_id: userId,
    game: "orbit",
    mode: "overall",
    value: pfi,
    meta: { cleared } as any,
  });
  return pfi;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function dirSort(direction: ScoreDirection) {
  return (a: { value: number }, b: { value: number }) =>
    direction === "lower" ? a.value - b.value : b.value - a.value;
}

/** Submit a score. No-op if no logged-in user. */
export async function submitScore(input: {
  game: GameId;
  mode: string;
  value: number;
  meta?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  // 用本地会话判断登录 —— getSession() 读取本地存储的会话(必要时自动刷新 token),不走网络
  // 用户校验。这避免了「多场 / 快速连续提交」时 getUser() 的网络竞态导致的间歇性「未登录」。
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  if (!user) return { ok: false, error: "未登录" };
  const row = {
    user_id: user.id,
    game: input.game,
    mode: input.mode,
    value: Number.isFinite(input.value) ? input.value : 0, // 兜底:极端配置若算出 NaN/Infinity 也不至于插入失败
    meta: (input.meta ?? {}) as any,
  };
  // 瞬时网络错误自动重试一次,尽量不丢成绩。
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.from("scores").insert(row);
    if (!error) return { ok: true };
    lastErr = error.message;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
  }
  return { ok: false, error: lastErr || "提交失败" };
}

interface RawScore {
  id: string;
  user_id: string;
  game: string;
  mode: string;
  value: number | string;
  meta: any;
  created_at: string;
  profiles: { nickname: string | null } | null;
}

async function fetchScores(game: GameId, mode: string, period: Period): Promise<ScoreRow[]> {
  let q = supabase
    .from("scores")
    .select("id,user_id,game,mode,value,meta,created_at,profiles(nickname)")
    .eq("game", game)
    .eq("mode", mode)
    .limit(500);
  if (period === "weekly") {
    q = q.gte("created_at", new Date(Date.now() - WEEK_MS).toISOString());
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as unknown as RawScore[]).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    game: r.game as GameId,
    mode: r.mode,
    value: typeof r.value === "string" ? Number(r.value) : r.value,
    meta: r.meta ?? {},
    created_at: r.created_at,
    nickname: r.profiles?.nickname || "玩家",
  }));
}

export async function getLeaderboard(
  game: GameId,
  mode: string,
  period: Period,
  limit = 20,
): Promise<(ScoreRow & { rank: number })[]> {
  const rows = await fetchScores(game, mode, period);
  const dir = GAMES[game].direction;
  const bestByUser = new Map<string, ScoreRow>();
  for (const r of rows) {
    const cur = bestByUser.get(r.user_id);
    if (!cur) bestByUser.set(r.user_id, r);
    else {
      const better = dir === "lower" ? r.value < cur.value : r.value > cur.value;
      if (better) bestByUser.set(r.user_id, r);
    }
  }
  return [...bestByUser.values()]
    .sort(dirSort(dir))
    .slice(0, limit)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export async function getMyBest(
  game: GameId,
  mode: string,
  period: Period = "all",
): Promise<ScoreRow | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const dir = GAMES[game].direction;
  let q = supabase
    .from("scores")
    .select("id,user_id,game,mode,value,meta,created_at,profiles(nickname)")
    .eq("game", game)
    .eq("mode", mode)
    .eq("user_id", u.user.id)
    .order("value", { ascending: dir === "lower" })
    .limit(1);
  if (period === "weekly") {
    q = q.gte("created_at", new Date(Date.now() - WEEK_MS).toISOString());
  }
  const { data, error } = await q;
  if (error || !data || data.length === 0) return null;
  const r = data[0] as unknown as RawScore;
  return {
    id: r.id,
    user_id: r.user_id,
    game: r.game as GameId,
    mode: r.mode,
    value: typeof r.value === "string" ? Number(r.value) : r.value,
    meta: r.meta ?? {},
    created_at: r.created_at,
    nickname: r.profiles?.nickname || "玩家",
  };
}

export async function getMyHistory(
  game: GameId,
  mode: string,
  limit = 8,
): Promise<ScoreRow[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase
    .from("scores")
    .select("id,user_id,game,mode,value,meta,created_at,profiles(nickname)")
    .eq("game", game)
    .eq("mode", mode)
    .eq("user_id", u.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data) return [];
  return (data as unknown as RawScore[]).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    game: r.game as GameId,
    mode: r.mode,
    value: typeof r.value === "string" ? Number(r.value) : r.value,
    meta: r.meta ?? {},
    created_at: r.created_at,
    nickname: r.profiles?.nickname || "玩家",
  }));
}

export async function getGlobalBest(game: GameId, mode: string): Promise<ScoreRow | null> {
  const dir = GAMES[game].direction;
  const { data } = await supabase
    .from("scores")
    .select("id,user_id,game,mode,value,meta,created_at,profiles(nickname)")
    .eq("game", game)
    .eq("mode", mode)
    .order("value", { ascending: dir === "lower" })
    .limit(1);
  if (!data || data.length === 0) return null;
  const r = data[0] as unknown as RawScore;
  return {
    id: r.id,
    user_id: r.user_id,
    game: r.game as GameId,
    mode: r.mode,
    value: typeof r.value === "string" ? Number(r.value) : r.value,
    meta: r.meta ?? {},
    created_at: r.created_at,
    nickname: r.profiles?.nickname || "玩家",
  };
}

export async function getPlayerCount(game: GameId, mode: string): Promise<number> {
  const { data } = await supabase
    .from("scores")
    .select("user_id")
    .eq("game", game)
    .eq("mode", mode);
  if (!data) return 0;
  return new Set(data.map((d: any) => d.user_id)).size;
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${s}.${cs.toString().padStart(2, "0")}s`;
}

export function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

// ===== 项目榜单:难度系数榜 + 坚持榜(均按 mode 前缀区分项目) =====
export interface RankRow { user_id: string; nickname: string; rank: number; }
export type OpKind = "addsub" | "mul" | "div";
export interface DiffRankRow extends RankRow { D: number; mode: string; op: OpKind; speedMs?: number; createdAt?: string; }
export interface StreakRankRow extends RankRow { streak: number; days: number; }

/** 从 mode 串识别运算类型(加减 / 乘 / 除)。加减:含 "Nq-";乘:"-mul-AxB";除:新 "-div-DdQq"(除数d商q) 或旧 "-div-A_B"(被除数_除数)。 */
export function opFromMode(mode: string): OpKind {
  if (/-mul-\d+x\d+/.test(mode)) return "mul";
  if (/-div-\d+(?:d\d+q|_\d+)/.test(mode)) return "div";
  return "addsub";
}

/** 旧除法 mode "-div-被除数_除数" → 换算为 { 除数位, 商位 }(商位≈被除数位−除数位+1)。 */
export function legacyDivDigits(dividendDigits: number, divisorDigits: number): { d: number; q: number } {
  return { d: divisorDigits, q: Math.max(1, dividendDigits - divisorDigits + 1) };
}

/** 榜单里的权威 D:乘除按 mode 内位数用当前公式重算(修正历史畸高值);加减用记录里存的 D(含作答用时)。 */
function boardD(op: OpKind, mode: string, storedD: number): number {
  if (op === "mul") { const m = mode.match(/-mul-(\d+)x(\d+)/); if (m) return mulD(+m[1], +m[2]); }
  if (op === "div") {
    const n = mode.match(/-div-(\d+)d(\d+)q/);
    if (n) return divisionD(+n[1], +n[2]);
    const m = mode.match(/-div-(\d+)_(\d+)/);
    if (m) { const { d, q } = legacyDivDigits(+m[1], +m[2]); return divisionD(d, q); }
  }
  return storedD;
}

export interface ProjectRanks { difficulty: DiffRankRow[]; persistence: StreakRankRow[]; }

/** 一次拉取,算出某项目的难度系数榜 + 坚持榜(省一次网络往返;按时间倒序,截断时保留最近数据)。 */
export async function getProjectRanks(game: GameId, prefix: string, limit = 20): Promise<ProjectRanks> {
  const { data } = await supabase
    .from("scores")
    .select("user_id,mode,meta,created_at,profiles(nickname)")
    .eq("game", game)
    .like("mode", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(6000);

  const rows = (data ?? []) as unknown as {
    user_id: string; mode: string; meta: { D?: number; speedMs?: number } | null; created_at: string; profiles: { nickname: string | null } | null;
  }[];

  // 难度榜按【运算类型】隔离:同一用户在 加减 / 乘 / 除 各有独立最高分,互不干扰。key = user|op。
  type BestEntry = { user_id: string; nickname: string; D: number; mode: string; op: OpKind; speedMs?: number; createdAt: string };
  const bestD = new Map<string, BestEntry>();
  const byUser = new Map<string, { days: Set<string>; nickname: string }>();

  for (const r of rows) {
    const nickname = r.profiles?.nickname || "玩家";
    const op = opFromMode(r.mode);
    const D = boardD(op, r.mode, Number(r.meta?.D) || 0);
    if (D > 0) {
      const key = `${r.user_id}|${op}`;
      const cur = bestD.get(key);
      // 取最高 D;同一用户同运算多条同为最高 D 时,保留最早那条(先达成)
      if (!cur || D > cur.D || (D === cur.D && r.created_at < cur.createdAt))
        bestD.set(key, { user_id: r.user_id, nickname, D, mode: r.mode, op, speedMs: Number(r.meta?.speedMs) || undefined, createdAt: r.created_at });
    }
    let u = byUser.get(r.user_id);
    if (!u) { u = { days: new Set(), nickname }; byUser.set(r.user_id, u); }
    u.days.add(dayKey(r.created_at));
  }

  // 难度榜:先按运算类型分组,组内 D 降序、同分先达成者靠前,各组独立名次(严格名次)。
  const byOp = new Map<OpKind, BestEntry[]>();
  for (const v of bestD.values()) {
    const arr = byOp.get(v.op) ?? [];
    arr.push(v);
    byOp.set(v.op, arr);
  }
  const difficulty: DiffRankRow[] = [];
  for (const arr of byOp.values()) {
    arr.sort((a, b) => b.D - a.D || a.createdAt.localeCompare(b.createdAt));
    arr.slice(0, limit).forEach((x, i) => difficulty.push({ ...x, rank: i + 1 }));
  }
  const persistence = rankBy(
    [...byUser.entries()]
      .map(([uid, u]) => ({ user_id: uid, nickname: u.nickname, streak: streakFromDays(u.days), days: u.days.size }))
      .filter((x) => x.streak > 0),
    (a, b) => b.streak - a.streak || b.days - a.days,
    (x) => x.streak,
    limit,
  );

  return { difficulty, persistence };
}
