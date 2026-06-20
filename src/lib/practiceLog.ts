import { supabase } from "@/integrations/supabase/client";

export interface AttemptInput {
  game: string;
  mode: string;
  terms: number[];
  signs: ("+" | "-")[];
  answer: number;
  userAnswer: number | null;
  correct: boolean;
  usedMs: number;
}

export interface AttemptRow {
  id: string;
  game: string;
  mode: string;
  terms: number[];
  signs: string[];
  answer: number;
  user_answer: number | null;
  correct: boolean;
  used_ms: number;
  created_at: string;
}

/** Insert one attempt. Silent on failure (won't block gameplay). */
export async function logAttempt(input: AttemptInput): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    await supabase.from("practice_attempts").insert({
      user_id: uid,
      game: input.game,
      mode: input.mode,
      terms: input.terms,
      signs: input.signs,
      answer: input.answer,
      user_answer: input.userAnswer,
      correct: input.correct,
      used_ms: input.usedMs,
    });
  } catch {
    /* swallow */
  }
}

/** Fetch all attempts for a game (most recent 500). */
export async function fetchAttempts(game: string): Promise<AttemptRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data } = await supabase
    .from("practice_attempts")
    .select("*")
    .eq("user_id", uid)
    .eq("game", game)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as AttemptRow[];
}

/** Fetch most recent wrong attempts (for replay). */
export async function fetchWrongAttempts(game: string, limit = 100): Promise<AttemptRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data } = await supabase
    .from("practice_attempts")
    .select("*")
    .eq("user_id", uid)
    .eq("game", game)
    .eq("correct", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AttemptRow[];
}

export interface DayStat { date: string; total: number; correct: number; wrong: number }

/** Group attempts by local-date YYYY-MM-DD. */
export function groupByDay(rows: AttemptRow[]): Map<string, DayStat> {
  const map = new Map<string, DayStat>();
  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cur = map.get(key) ?? { date: key, total: 0, correct: 0, wrong: 0 };
    cur.total += 1;
    if (r.correct) cur.correct += 1;
    else cur.wrong += 1;
    map.set(key, cur);
  }
  return map;
}

export function formatExpr(terms: number[], signs: string[]): string {
  return terms
    .map((t, i) => {
      const s = signs[i];
      if (i === 0) return s === "-" ? `−${t}` : `${t}`;
      return s === "-" ? ` − ${t}` : ` + ${t}`;
    })
    .join("");
}
