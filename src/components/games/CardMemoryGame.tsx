import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, X } from "lucide-react";

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
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

type Phase = "ready" | "memorizing" | "quiz" | "done";
type Feedback = { id: string; correct: boolean } | null;

const TOTAL_QUESTIONS = 5;

export function CardMemoryGame() {
  const [deck, setDeck] = useState<Card[]>(() => buildDeck());
  const [phase, setPhase] = useState<Phase>("ready");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Card[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [showQuizDialog, setShowQuizDialog] = useState(false);

  const isFaceUp = (id: string) =>
    phase === "ready" || phase === "memorizing" || revealed.has(id);

  const start = () => {
    setPhase("memorizing");
    setRevealed(new Set());
  };

  const end = () => {
    const pool = [...deck];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setQuestions(pool.slice(0, TOTAL_QUESTIONS));
    setQIdx(0);
    setScore(0);
    setRevealed(new Set());
    setFeedback(null);
    setPhase("quiz");
    setShowQuizDialog(true);
  };

  const reshuffle = () => {
    setDeck(buildDeck());
    setPhase("ready");
    setRevealed(new Set());
    setQuestions([]);
    setQIdx(0);
    setScore(0);
    setFeedback(null);
    setShowQuizDialog(false);
  };

  const onCardClick = (card: Card) => {
    if (phase !== "quiz" || feedback) return;
    const target = questions[qIdx];
    if (!target) return;
    if (card.id === target.id) {
      setRevealed((prev) => new Set(prev).add(card.id));
      setScore((s) => s + 1);
      setFeedback({ id: card.id, correct: true });
    } else {
      setWrongFlash(card.id);
      setTimeout(() => setWrongFlash(null), 600);
      setFeedback({ id: card.id, correct: false });
    }
    setTimeout(() => {
      setFeedback(null);
      if (qIdx + 1 >= questions.length) {
        setPhase("done");
        setShowQuizDialog(false);
      } else {
        setQIdx((i) => i + 1);
      }
    }, 900);
  };

  const status = useMemo(() => {
    if (phase === "ready") return "52 张完整扑克牌已就绪";
    if (phase === "memorizing") return "记忆中… 完成后请点击「结束记忆」";
    if (phase === "quiz") return `出题中：第 ${qIdx + 1} / ${questions.length} 题 · 得分 ${score}`;
    return `结束 · 得分 ${score} / ${questions.length}`;
  }, [phase, qIdx, questions.length, score]);

  const currentQ = phase === "quiz" ? questions[qIdx] : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{status}</div>
        <div className="flex flex-wrap gap-2">
          {phase === "ready" && (
            <button onClick={start} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">开始记忆</button>
          )}
          {phase === "memorizing" && (
            <button onClick={end} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">结束记忆</button>
          )}
          {phase === "quiz" && (
            <button onClick={() => setShowQuizDialog(true)} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              查看题目
            </button>
          )}
          <button onClick={reshuffle} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">
            重新洗牌
          </button>
        </div>
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
        {deck.map((card) => {
          const faceUp = isFaceUp(card.id);
          const isWrong = wrongFlash === card.id;
          const isRevealed = revealed.has(card.id);
          return (
            <button
              key={card.id}
              onClick={() => onCardClick(card)}
              disabled={phase !== "quiz" || isRevealed || !!feedback}
              className={cn(
                "relative aspect-[2/3] rounded-md border shadow-sm transition-all overflow-hidden",
                faceUp ? "border-border bg-white" : "border-blue-900/40",
                isWrong && "ring-2 ring-red-500 animate-pulse",
                phase === "quiz" && !isRevealed && !feedback && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
              )}
            >
              {faceUp ? <CardFace card={card} /> : <CardBack />}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        玩法：「开始记忆」展示 52 张牌 →「结束记忆」全部翻面 → 弹窗给出 {TOTAL_QUESTIONS} 张目标牌，依次点击你认为对应位置的牌，正确则翻开，错误闪红不翻开。
      </p>

      <Dialog open={showQuizDialog && phase === "quiz"} onOpenChange={(o) => !o && setShowQuizDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>第 {qIdx + 1} / {questions.length} 题</DialogTitle>
            <DialogDescription>请在下方牌阵中点击对应这张牌的位置。</DialogDescription>
          </DialogHeader>
          {currentQ && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="aspect-[2/3] w-32 overflow-hidden rounded-lg border border-border bg-white shadow-md">
                <CardFace card={currentQ} large />
              </div>
              <div className="text-xs text-muted-foreground">
                目标：<span className={cn("font-semibold", currentQ.suit.red ? "text-red-600" : "text-foreground")}>{currentQ.suit.s} {currentQ.rank}</span>
              </div>
              {feedback && (
                <div className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                  feedback.correct ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                )}>
                  {feedback.correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {feedback.correct ? "正确！" : "错误"}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground">当前得分 {score}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={phase === "done"} onOpenChange={(o) => !o && reshuffle()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>测试结束</DialogTitle>
            <DialogDescription>本轮 {questions.length} 题已完成</DialogDescription>
          </DialogHeader>
          <div className="py-3 text-center">
            <div className="font-display text-4xl text-primary">{score} / {questions.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              准确率 {Math.round((score / Math.max(questions.length, 1)) * 100)}%
            </div>
            <button onClick={reshuffle} className="mt-5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
              再来一局
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Standard pip positions on a 7-row × 3-col grid (like real playing cards)
// row 0=top, 6=bottom; col 0=left, 1=center, 2=right
const PIP_LAYOUT: Record<string, [number, number][]> = {
  "2":  [[0,1],[6,1]],
  "3":  [[0,1],[3,1],[6,1]],
  "4":  [[0,0],[0,2],[6,0],[6,2]],
  "5":  [[0,0],[0,2],[3,1],[6,0],[6,2]],
  "6":  [[0,0],[0,2],[3,0],[3,2],[6,0],[6,2]],
  "7":  [[0,0],[0,2],[1.5,1],[3,0],[3,2],[6,0],[6,2]],
  "8":  [[0,0],[0,2],[1.5,1],[3,0],[3,2],[4.5,1],[6,0],[6,2]],
  "9":  [[0,0],[0,2],[2,0],[2,2],[3,1],[4,0],[4,2],[6,0],[6,2]],
  "10": [[0,0],[0,2],[1.5,1],[2,0],[2,2],[4,0],[4,2],[4.5,1],[6,0],[6,2]],
};

function CardFace({ card, large = false }: { card: Card; large?: boolean }) {
  const colorCls = card.suit.red ? "text-red-600" : "text-neutral-900";
  const isFigure = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const isAce = card.rank === "A";
  const pips = PIP_LAYOUT[card.rank];

  const cornerSize = large ? "text-sm" : "text-[8px]";
  const cornerSuit = large ? "text-xs" : "text-[7px]";

  return (
    <div className={cn("relative h-full w-full select-none leading-none", colorCls)}>
      {/* Top-left index */}
      <div className={cn("absolute left-0.5 top-0.5 flex flex-col items-center font-semibold", cornerSize)}>
        <span>{card.rank}</span>
        <span className={cornerSuit}>{card.suit.s}</span>
      </div>
      {/* Bottom-right index (rotated 180°) */}
      <div className={cn("absolute bottom-0.5 right-0.5 flex rotate-180 flex-col items-center font-semibold", cornerSize)}>
        <span>{card.rank}</span>
        <span className={cornerSuit}>{card.suit.s}</span>
      </div>

      {/* Center area */}
      <div className="absolute inset-0 px-2.5 py-3.5">
        {isAce && (
          <div className="flex h-full w-full items-center justify-center">
            <span className={cn(large ? "text-6xl" : "text-2xl")}>{card.suit.s}</span>
          </div>
        )}
        {isFigure && (
          <div className={cn(
            "flex h-full w-full flex-col items-center justify-center rounded-sm border-2 font-bold",
            card.suit.red ? "border-red-600/60 bg-red-50/40" : "border-neutral-900/60 bg-neutral-50/40",
          )}>
            <span className={cn("font-display tracking-tight", large ? "text-5xl" : "text-lg")}>{card.rank}</span>
            <span className={cn(large ? "text-2xl" : "text-[10px]")}>{card.suit.s}</span>
          </div>
        )}
        {pips && (
          <div className="relative h-full w-full">
            {pips.map(([r, c], i) => (
              <span
                key={i}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2",
                  large ? "text-xl" : "text-[8px] leading-none",
                  // rotate bottom half pips for traditional look
                  r > 3 && "rotate-180",
                )}
                style={{
                  top: `${(r / 6) * 100}%`,
                  left: `${(c / 2) * 100}%`,
                }}
              >
                {card.suit.s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-md bg-gradient-to-br from-blue-800 to-blue-950 p-1">
      <div className="h-full w-full rounded-sm border border-white/20 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,0.12)_3px,rgba(255,255,255,0.12)_4px)]" />
    </div>
  );
}
