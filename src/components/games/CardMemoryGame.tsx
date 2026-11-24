import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getLang } from "@/lib/langState";

// 英文界面(2026-10-27):L(中文, 英文) 按当前语言取;主组件 useI18n() 订阅语言,切换即重渲染
const L = (zh: string, en: string) => (getLang() === "en" ? en : zh);

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
  const { lang } = useI18n();
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
    if (lang === "en") {
      if (phase === "ready") return "A full 52-card deck is ready";
      if (phase === "memorizing") return "Memorizing… tap “Done” when you're ready";
      if (phase === "quiz") return `Quiz: card ${qIdx + 1} / ${questions.length} · score ${score}`;
      return `Finished · score ${score} / ${questions.length}`;
    }
    if (phase === "ready") return "52 张完整扑克牌已就绪";
    if (phase === "memorizing") return "记忆中… 完成后请点击「结束记忆」";
    if (phase === "quiz") return `出题中：第 ${qIdx + 1} / ${questions.length} 题 · 得分 ${score}`;
    return `结束 · 得分 ${score} / ${questions.length}`;
  }, [phase, qIdx, questions.length, score, lang]);

  const currentQ = phase === "quiz" ? questions[qIdx] : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{status}</div>
        <div className="flex flex-wrap gap-2">
          {phase === "ready" && (
            <button onClick={start} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">{L("开始记忆", "Start memorizing")}</button>
          )}
          {phase === "memorizing" && (
            <button onClick={end} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">{L("结束记忆", "Done")}</button>
          )}
          {phase === "quiz" && (
            <button onClick={() => setShowQuizDialog(true)} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              {L("查看题目", "Show card")}
            </button>
          )}
          <button onClick={reshuffle} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">
            {L("重新洗牌", "Reshuffle")}
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
        {lang === "en"
          ? `How to play: “Start memorizing” shows all 52 cards → “Done” flips them face down → a popup shows ${TOTAL_QUESTIONS} target cards one by one; tap where you think each one is. Right flips it over; wrong flashes red.`
          : `玩法：「开始记忆」展示 52 张牌 →「结束记忆」全部翻面 → 弹窗给出 ${TOTAL_QUESTIONS} 张目标牌，依次点击你认为对应位置的牌，正确则翻开，错误闪红不翻开。`}
      </p>

      <Dialog open={showQuizDialog && phase === "quiz"} onOpenChange={(o) => !o && setShowQuizDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{L(`第 ${qIdx + 1} / ${questions.length} 题`, `Card ${qIdx + 1} / ${questions.length}`)}</DialogTitle>
            <DialogDescription>{L("请在下方牌阵中点击对应这张牌的位置。", "Tap where this card is in the layout below.")}</DialogDescription>
          </DialogHeader>
          {currentQ && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="aspect-[2/3] w-32 overflow-hidden rounded-lg border border-border bg-white shadow-md">
                <CardFace card={currentQ} large />
              </div>
              <div className="text-xs text-muted-foreground">
                {L("目标：", "Target: ")}<span className={cn("font-semibold", currentQ.suit.red ? "text-red-600" : "text-foreground")}>{currentQ.suit.s} {currentQ.rank}</span>
              </div>
              {feedback && (
                <div className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                  feedback.correct ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                )}>
                  {feedback.correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {feedback.correct ? L("正确！", "Correct!") : L("错误", "Wrong")}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground">{L("当前得分", "Score")} {score}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={phase === "done"} onOpenChange={(o) => !o && reshuffle()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{L("测试结束", "Test complete")}</DialogTitle>
            <DialogDescription>{L(`本轮 ${questions.length} 题已完成`, `All ${questions.length} cards done`)}</DialogDescription>
          </DialogHeader>
          <div className="py-3 text-center">
            <div className="font-display text-4xl text-primary">{score} / {questions.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {L("准确率", "Accuracy")} {Math.round((score / Math.max(questions.length, 1)) * 100)}%
            </div>
            <button onClick={reshuffle} className="mt-5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
              {L("再来一局", "Play again")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Use real playing-card images from deckofcardsapi.com (free, public).
// Naming: {rank}{suit}.png, where rank: A,2-9,0(=10),J,Q,K; suit: S,H,D,C
const RANK_CODE: Record<string, string> = {
  A: "A", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7",
  "8": "8", "9": "9", "10": "0", J: "J", Q: "Q", K: "K",
};
const SUIT_CODE: Record<string, string> = { spade: "S", heart: "H", diamond: "D", club: "C" };

function cardImageUrl(card: Card) {
  return `https://deckofcardsapi.com/static/img/${RANK_CODE[card.rank]}${SUIT_CODE[card.suit.name]}.png`;
}

function CardFace({ card }: { card: Card; large?: boolean }) {
  return (
    <img
      src={cardImageUrl(card)}
      alt={`${card.rank} of ${card.suit.name}`}
      loading="lazy"
      draggable={false}
      className="h-full w-full object-contain"
    />
  );
}

function CardBack() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-md bg-gradient-to-br from-blue-800 to-blue-950 p-1">
      <div className="h-full w-full rounded-sm border border-white/20 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,0.12)_3px,rgba(255,255,255,0.12)_4px)]" />
    </div>
  );
}
