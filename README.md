# Super Brain Lab

> A brain-training arena where focus, mental math and memory are all measurable.
> 一个把专注、速算、记忆都量化的脑力训练竞技场。

Super Brain Lab bundles several cognitive-training games, logs every attempt, and
ranks players on a cloud leaderboard. Built with React + Vite + TypeScript and
a Supabase backend.

Live demo: <https://mind-quest-rankings.lovable.app>

---

## ✨ Features

- **7 training modules**
  - **Flash Math** (闪电心算) — digits flash one by one; add them up mentally. Voice answer supported.
  - **Gauntlet Flash Math** (障碍闪电心算) — flash math with drifting positions, decoys, noisy backgrounds and color-flip operators.
  - **Schulte Table** (舒尔特方格) — tap 1→N in order, the classic attention drill.
  - **Reaction Time** (反应速度) — millisecond click test.
  - **N-Back** — the international gold standard for working memory.
  - **Card Memory** (扑克记忆) — memorize a shuffled 52-card deck.
  - **Orbit Focus** (轨道追焦) — multi-object eye tracking with sudden challenges.
- **Practice log** — calendar heatmap, streak, daily/lifetime counters and accuracy.
- **Mistake book** — every wrong answer is saved; paginated review with an animated abacus walkthrough; "mistakes only" practice mode.
- **Cloud leaderboard** — weekly / all-time, plus per-config and composite indices (PFI for Orbit, GFI for Gauntlet).
- **Bilingual UI** — 中文 / English toggle in the top-right.
- **Auth** — email + password; scores auto-sync after login.

## 🧱 Tech Stack

- **Frontend**: React 18, Vite 5, TypeScript 5, Tailwind CSS 3, shadcn/ui, lucide-react
- **Routing / State**: react-router-dom, @tanstack/react-query
- **Backend**: Supabase — Postgres with RLS, Auth
- **Testing**: Vitest, Testing Library

## 🚀 Getting Started

```bash
# install
npm install

# dev server (http://localhost:8080)
npm run dev

# production build
npm run build

# preview built bundle
npm run preview

# lint & test
npm run lint
npm run test
```

### Environment

Create a `.env` at the repo root with your Supabase credentials (the
publishable anon key is safe to commit):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

## 📁 Project Structure

```
src/
  pages/              Index, Play, NotFound
  components/
    games/            One file per training module
    PracticeLog.tsx   Calendar + history + rankings tabs
    PracticeStats.tsx Streak / total / accuracy strip
    MistakeBook.tsx   Paginated wrong-answer review
    AbacusDetail.tsx  Animated suanpan walkthrough
  lib/
    flashMath.ts      Problem generator (uniform 0–9, no leading zero, etc.)
    gauntlet.ts       Difficulty / chaos formulas (Df × Dc, GFI)
    leaderboard.ts    Game registry + cloud score helpers
    practiceLog.ts    Attempt logging + queries
    i18n.tsx          Language provider + toggle
  integrations/supabase/  Generated client & types
supabase/             Migrations & config
```

## 🗄️ Data Model

Three tables, all behind row-level security:

- `practice_attempts` — every answer (game, mode, terms, user answer, correct, time_ms).
- `scores` — final round scores submitted to the leaderboard.
- `profiles` — public nicknames joined into leaderboards.

## 🌐 Internationalization

`src/lib/i18n.tsx` exports `LanguageProvider`, `useI18n()` and `<LanguageToggle />`.
The dictionary is a single object keyed by `zh` / `en`; preference is persisted to
`localStorage` under `lang`.

## 📄 License

MIT.
