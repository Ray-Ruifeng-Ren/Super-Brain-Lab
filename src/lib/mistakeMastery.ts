// Track per-problem consecutive-correct streaks in mistake practice.
// When a problem is answered correctly 5 times in a row (during mistake mode),
// it is considered mastered and removed from the mistake book.

const THRESHOLD = 5;

export function masteryKey(game: string) {
  return `mistake-mastery:${game}`;
}

export function problemKey(signs: string[], terms: number[], answer: number) {
  return `${signs.join("")}|${terms.join(",")}|${answer}`;
}

type Store = Record<string, { streak: number; mastered: boolean }>;

function readStore(game: string): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(masteryKey(game));
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(game: string, s: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(masteryKey(game), JSON.stringify(s));
  } catch {}
}

/** Record an attempt in mistake mode. Returns true if this attempt just mastered the problem. */
export function recordMistakeAttempt(
  game: string,
  key: string,
  correct: boolean,
): { justMastered: boolean; streak: number } {
  const s = readStore(game);
  const cur = s[key] ?? { streak: 0, mastered: false };
  if (cur.mastered) return { justMastered: false, streak: cur.streak };
  if (correct) {
    cur.streak += 1;
    let justMastered = false;
    if (cur.streak >= THRESHOLD) {
      cur.mastered = true;
      justMastered = true;
    }
    s[key] = cur;
    writeStore(game, s);
    return { justMastered, streak: cur.streak };
  } else {
    cur.streak = 0;
    s[key] = cur;
    writeStore(game, s);
    return { justMastered: false, streak: 0 };
  }
}

export function isMastered(game: string, key: string): boolean {
  return !!readStore(game)[key]?.mastered;
}

export function masteredSet(game: string): Set<string> {
  const s = readStore(game);
  const out = new Set<string>();
  for (const k of Object.keys(s)) if (s[k].mastered) out.add(k);
  return out;
}

export const MASTERY_THRESHOLD = THRESHOLD;
