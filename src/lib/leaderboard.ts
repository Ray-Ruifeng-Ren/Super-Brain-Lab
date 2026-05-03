// Cloud-backed leaderboard + game metadata.
// LocalStorage helpers from v1 are kept for legacy fall-through but new
// scores are persisted in Supabase via supabase client.

import { supabase } from "@/integrations/supabase/client";

export type GameId = "flashmath" | "schulte" | "reaction" | "nback";
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
};

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
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false, error: "未登录" };
  const { error } = await supabase.from("scores").insert({
    user_id: u.user.id,
    game: input.game,
    mode: input.mode,
    value: input.value,
    meta: (input.meta ?? {}) as any,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
