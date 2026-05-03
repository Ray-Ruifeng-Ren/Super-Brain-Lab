import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const SUITS = [
  { s: "♠", name: "spade", red: false },
  { s: "♥", name: "heart", red: true },
  { s: "♦", name: "diamond", red: true },
  { s: "♣", name: "club", red: false },
] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

interface Card {
  id: string;
  rank: string;
  suit: (typeof SUITS)[number];
}

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${suit.name}-${rank}`, rank, suit });
    }
  }
  // Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

type Phase = "ready" | "memorizing" | "quiz";

export function CardMemoryGame() {
  const [deck, setDeck] = useState<Card[]>(() => buildDeck());
  const [phase, setPhase] = useState<Phase>("ready");
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  // In ready: all face-up. In memorizing: all face-up. In quiz: only `flipped` ids face-up.
  const isFaceUp = (id: string) => phase !== "quiz" || flipped.has(id);

  const start = () => {
    setPhase("memorizing");
    setFlipped(new Set());
  };
  const end = () => {
    setPhase("quiz");
    setFlipped(new Set());
  };
  const reshuffle = () => {
    setDeck(buildDeck());
    setPhase("ready");
    setFlipped(new Set());
  };
  const toggleCard = (id: string) => {
    if (phase !== "quiz") return;
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const status = useMemo(() => {
    if (phase === "ready") return "52 张完整扑克牌已就绪";
    if (phase === "memorizing") return "记忆中… 完成后请点击「结束记忆」";
    return `出题中：已翻开 ${flipped.size} / 52`;
  }, [phase, flipped]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{status}</div>
        <div className="flex flex-wrap gap-2">
          {phase === "ready" && (
            <button
              onClick={start}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              开始记忆
            </button>
          )}
          {phase === "memorizing" && (
            <button
              onClick={end}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              结束记忆
            </button>
          )}
          {phase === "quiz" && (
            <button
              onClick={() => setFlipped(new Set())}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              全部盖回
            </button>
          )}
          <button
            onClick={reshuffle}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            重新洗牌
          </button>
        </div>
      </div>

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
      >
        {deck.map((card) => {
          const faceUp = isFaceUp(card.id);
          return (
            <button
              key={card.id}
              onClick={() => toggleCard(card.id)}
              disabled={phase !== "quiz"}
              className={cn(
                "relative aspect-[2/3] rounded-md border transition-all",
                faceUp
                  ? "border-border bg-background"
                  : "border-primary/40 bg-primary/90",
                phase === "quiz" && "cursor-pointer hover:scale-[1.04] hover:shadow-md",
                phase !== "quiz" && "cursor-default",
              )}
            >
              {faceUp ? (
                <div
                  className={cn(
                    "flex h-full w-full flex-col items-center justify-center font-mono-tabular leading-none",
                    card.suit.red ? "text-red-600" : "text-foreground",
                  )}
                >
                  <span className="text-[11px] font-semibold sm:text-xs">{card.rank}</span>
                  <span className="text-base sm:text-lg">{card.suit.s}</span>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-3/4 w-3/4 rounded-sm border border-primary-foreground/30 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,hsl(var(--primary-foreground)/0.18)_3px,hsl(var(--primary-foreground)/0.18)_4px)]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        玩法：点击「开始记忆」开始观察 52 张牌；记完后点击「结束记忆」，所有牌翻面（牌面内容保留不变）。出题时点击任意一张牌可翻开查看，再次点击则盖回。
      </p>
    </div>
  );
}
