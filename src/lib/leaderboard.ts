export type Score = {
  id: string;
  name: string;
  size: number;
  timeMs: number;
  date: number;
};

const KEY = "schulte_scores_v1";
const NAME_KEY = "schulte_player_name";

export function getScores(): Score[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function addScore(s: Omit<Score, "id" | "date">): Score {
  const score: Score = { ...s, id: crypto.randomUUID(), date: Date.now() };
  const all = [...getScores(), score];
  localStorage.setItem(KEY, JSON.stringify(all));
  return score;
}

export function getTopBySize(size: number, limit = 10): Score[] {
  return getScores()
    .filter((s) => s.size === size)
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, limit);
}

export function getRank(scoreId: string, size: number): number {
  const ranked = getScores()
    .filter((s) => s.size === size)
    .sort((a, b) => a.timeMs - b.timeMs);
  return ranked.findIndex((s) => s.id === scoreId) + 1;
}

export function getPlayerName(): string {
  return localStorage.getItem(NAME_KEY) || "";
}
export function setPlayerName(name: string) {
  localStorage.setItem(NAME_KEY, name);
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${s}.${cs.toString().padStart(2, "0")}s`;
}
