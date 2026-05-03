export type GameId = "flashmath" | "schulte" | "reaction" | "memory";

export type Score = {
  id: string;
  game: GameId;
  mode: string; // e.g. "4x4" / "default" / "default"
  name: string;
  // For schulte/reaction: lower is better (ms).
  // For memory: higher is better (level).
  value: number;
  date: number;
};

const KEY = "neuroplay_scores_v2";
const NAME_KEY = "neuroplay_player_name";
const PID_KEY = "neuroplay_player_id";

export type ScoreDirection = "lower" | "higher";

export const GAMES: Record<
  GameId,
  {
    id: GameId;
    name: string;
    tagline: string;
    description: string;
    accent: string; // tailwind gradient class
    direction: ScoreDirection;
    formatValue: (v: number) => string;
    valueLabel: string;
  }
> = {
  flashmath: {
    id: "flashmath",
    name: "闪电心算",
    tagline: "珠心算 · 速算训练",
    description: "题目逐个闪现，心算累加，支持语音报答案",
    accent: "from-fuchsia-500 to-orange-500",
    direction: "higher",
    formatValue: (v) => `${v} 分`,
    valueLabel: "得分",
  },
  schulte: {
    id: "schulte",
    name: "舒尔特方格",
    tagline: "注意力 · 经典训练",
    description: "按 1→N 顺序点击方格，越快越好",
    accent: "from-violet-500 to-indigo-500",
    direction: "lower",
    formatValue: (v) => formatTime(v),
    valueLabel: "用时",
  },
  reaction: {
    id: "reaction",
    name: "反应速度",
    tagline: "瞬时反应 · 极限挑战",
    description: "屏幕变绿的瞬间立刻点击",
    accent: "from-emerald-500 to-cyan-500",
    direction: "lower",
    formatValue: (v) => `${Math.round(v)} ms`,
    valueLabel: "反应",
  },
  memory: {
    id: "memory",
    name: "数字记忆",
    tagline: "短时记忆 · 进阶难度",
    description: "记住屏幕显示的数字序列并复述",
    accent: "from-amber-500 to-rose-500",
    direction: "higher",
    formatValue: (v) => `Lv. ${v}`,
    valueLabel: "等级",
  },
};

export function getPlayerId(): string {
  let id = localStorage.getItem(PID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PID_KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  return localStorage.getItem(NAME_KEY) || "";
}
export function setPlayerName(name: string) {
  localStorage.setItem(NAME_KEY, name);
}

export function getAllScores(): Score[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function addScore(input: Omit<Score, "id" | "date">): Score {
  const score: Score = { ...input, id: crypto.randomUUID(), date: Date.now() };
  const all = [...getAllScores(), score];
  localStorage.setItem(KEY, JSON.stringify(all));
  return score;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type Period = "weekly" | "all";

function sortByDirection(direction: ScoreDirection) {
  return (a: Score, b: Score) => (direction === "lower" ? a.value - b.value : b.value - a.value);
}

/** Best score per player for the given filter */
export function getLeaderboard(
  game: GameId,
  mode: string,
  period: Period,
  limit = 20,
): (Score & { rank: number })[] {
  const cutoff = period === "weekly" ? Date.now() - WEEK_MS : 0;
  const filtered = getAllScores().filter(
    (s) => s.game === game && s.mode === mode && s.date >= cutoff,
  );
  // Best per name (player identity)
  const bestByName = new Map<string, Score>();
  const dir = GAMES[game].direction;
  for (const s of filtered) {
    const cur = bestByName.get(s.name);
    if (!cur) {
      bestByName.set(s.name, s);
      continue;
    }
    const better = dir === "lower" ? s.value < cur.value : s.value > cur.value;
    if (better) bestByName.set(s.name, s);
  }
  return [...bestByName.values()]
    .sort(sortByDirection(dir))
    .slice(0, limit)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export function getMyBest(game: GameId, mode: string, period: Period = "all"): Score | null {
  const name = getPlayerName();
  if (!name) return null;
  const cutoff = period === "weekly" ? Date.now() - WEEK_MS : 0;
  const dir = GAMES[game].direction;
  const mine = getAllScores().filter(
    (s) => s.game === game && s.mode === mode && s.name === name && s.date >= cutoff,
  );
  if (mine.length === 0) return null;
  return mine.sort(sortByDirection(dir))[0];
}

export function getMyHistory(game: GameId, mode: string, limit = 10): Score[] {
  const name = getPlayerName();
  if (!name) return [];
  return getAllScores()
    .filter((s) => s.game === game && s.mode === mode && s.name === name)
    .sort((a, b) => b.date - a.date)
    .slice(0, limit);
}

export function getPlayerCount(game: GameId, mode: string): number {
  const names = new Set(
    getAllScores().filter((s) => s.game === game && s.mode === mode).map((s) => s.name),
  );
  return names.size;
}

export function getGlobalBest(game: GameId, mode: string): Score | null {
  const dir = GAMES[game].direction;
  const all = getAllScores().filter((s) => s.game === game && s.mode === mode);
  if (all.length === 0) return null;
  return all.sort(sortByDirection(dir))[0];
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${s}.${cs.toString().padStart(2, "0")}s`;
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(ts).toLocaleDateString();
}
