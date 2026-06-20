// Professional flash mental arithmetic question generation.
//
// Rules (per user spec):
//   1. Each TERM contains all distinct digits (no digit repeats within one number).
//      e.g. 35247 ✓   33434 ✗
//   2. Across the WHOLE problem, every digit 0-9 appears at each "place"
//      with as-equal-as-possible frequency. We use a positional shuffle bag:
//      for each place we maintain a 0-9 bag that reshuffles when exhausted.
//   3. For multi-digit terms the leading digit is never 0.
//   4. Adjacent terms must not be identical.
//   5. Optional single subtraction: at most one minus sign, never on the
//      first term, placed only where the running sum stays >= 0.
//
// This guarantees both per-term digit diversity AND long-run uniformity
// at every place — the kind of distribution professional 闪电心算
// instructors expect.

function makeBag(exclude?: number): number[] {
  const arr: number[] = [];
  for (let d = 0; d <= 9; d++) if (d !== exclude) arr.push(d);
  // Fisher–Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

class ShuffleBag {
  private bag: number[] = [];
  constructor(private exclude?: number) {}
  next(): number {
    if (this.bag.length === 0) this.bag = makeBag(this.exclude);
    return this.bag.pop()!;
  }
}

/** Generate `count` numbers, each `digits` long, with the rules above. */
export function generateTerms(count: number, digits: number): number[] {
  // One bag per place. Place 0 = leading; if digits >= 2 it excludes 0.
  // Additionally: for 1-digit problems, exclude 0 entirely (single "0" terms
  // are not useful). For 2-digit problems, exclude 0 from every place to avoid
  // any zero digit (per spec: "尽量别出 0").
  const excludeZeroAllPlaces = digits <= 2;
  const bags: ShuffleBag[] = [];
  for (let p = 0; p < digits; p++) {
    const exclude =
      excludeZeroAllPlaces || (p === 0 && digits > 1) ? 0 : undefined;
    bags.push(new ShuffleBag(exclude));
  }

  const terms: number[] = [];
  for (let i = 0; i < count; i++) {
    let term = 0;
    let attempts = 0;
    // Try to satisfy "all-distinct digits" within one term.
    // Up to 40 attempts; if impossible (digits >= 10 is impossible anyway),
    // fall back to a relaxed sample so we never block.
    while (true) {
      attempts++;
      const used = new Set<number>();
      const placeDigits: number[] = [];
      let ok = true;
      for (let p = 0; p < digits; p++) {
        // Pull from the bag, but reject duplicates within the term.
        // Try a few peeks; if none unique, accept the bag pop to keep place-distribution.
        let d = bags[p].next();
        let safety = 0;
        while (used.has(d) && safety < 9) {
          // Push back rejected digit by re-inserting into the bag at random position.
          (bags[p] as any).bag.splice(
            Math.floor(Math.random() * ((bags[p] as any).bag.length + 1)),
            0,
            d,
          );
          d = bags[p].next();
          safety++;
        }
        if (used.has(d)) {
          ok = false;
          // accept anyway; we'll bail after the loop if attempts allow
        }
        used.add(d);
        placeDigits.push(d);
      }
      term = placeDigits.reduce((acc, d) => acc * 10 + d, 0);
      // Guarantee no two adjacent terms are equal.
      if (terms.length > 0 && terms[terms.length - 1] === term) ok = false;
      // For digits >= 10 the unique-digit rule is impossible; accept after a few tries.
      if (ok || attempts >= 40) break;
    }
    terms.push(term);
  }
  return terms;
}

export type Sign = "+" | "-";

export interface Problem {
  terms: number[];
  signs: Sign[];
  answer: number;
}

export function buildProblem(count: number, digits: number, includeSub: boolean): Problem {
  const terms = generateTerms(count, digits);
  const signs: Sign[] = terms.map(() => "+");

  if (includeSub && terms.length >= 3) {
    // candidate i (i >= 1) such that running sum BEFORE term[i] >= term[i]
    const candidates: number[] = [];
    let running = terms[0];
    for (let i = 1; i < terms.length; i++) {
      if (running >= terms[i]) candidates.push(i);
      running += terms[i];
    }
    if (candidates.length > 0) {
      const idx = candidates[Math.floor(Math.random() * candidates.length)];
      signs[idx] = "-";
    }
  }

  let answer = 0;
  terms.forEach((t, i) => (answer += signs[i] === "+" ? t : -t));
  return { terms, signs, answer };
}
