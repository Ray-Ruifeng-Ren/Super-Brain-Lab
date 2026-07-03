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

/**
 * Backfill mastery from full attempt history:
 * for every problem that has ever been wrong, count trailing consecutive
 * correct attempts (most recent first). If ≥ THRESHOLD, mark mastered.
 * Returns the number of newly-mastered problems.
 */
export function backfillMastery(
  game: string,
  attemptsDesc: { signs: string[]; terms: number[]; answer: number; correct: boolean }[],
): number {
  const store = readStore(game);
  // group attempts by problem key, preserving desc order
  const byKey = new Map<string, boolean[]>();
  for (const a of attemptsDesc) {
    const k = problemKey(a.signs as string[], a.terms, a.answer);
    let arr = byKey.get(k);
    if (!arr) {
      arr = [];
      byKey.set(k, arr);
    }
    arr.push(a.correct);
  }
  let added = 0;
  for (const [k, arr] of byKey) {
    const hasWrong = arr.some((c) => !c);
    if (!hasWrong) continue; // never wrong → not a mistake, skip
    // count trailing consecutive correct (from most recent going back)
    let streak = 0;
    for (const c of arr) {
      if (c) streak += 1;
      else break;
    }
    const cur = store[k] ?? { streak: 0, mastered: false };
    if (streak > cur.streak) cur.streak = streak;
    if (streak >= THRESHOLD && !cur.mastered) {
      cur.mastered = true;
      added += 1;
    }
    store[k] = cur;
  }
  writeStore(game, store);
  return added;
}

export const MASTERY_THRESHOLD = THRESHOLD;
