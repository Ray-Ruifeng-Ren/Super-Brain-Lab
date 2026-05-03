import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addScore, formatTime, getPlayerName, getRank } from "@/lib/leaderboard";
import { Trophy, RotateCcw, Play } from "lucide-react";

type Props = {
  size: number;
  onFinished?: () => void;
};

function shuffle(n: number) {
  const arr = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function SchulteGame({ size, onFinished }: Props) {
  const total = size * size;
  const [numbers, setNumbers] = useState<number[]>(() => shuffle(total));
  const [next, setNext] = useState(1);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (startAt && finishedMs == null) {
      const tick = () => {
        setNow(performance.now() - startAt);
        tickRef.current = requestAnimationFrame(tick);
      };
      tickRef.current = requestAnimationFrame(tick);
      return () => {
        if (tickRef.current) cancelAnimationFrame(tickRef.current);
      };
    }
  }, [startAt, finishedMs]);

  const reset = () => {
    setNumbers(shuffle(total));
    setNext(1);
    setStartAt(null);
    setNow(0);
    setFinishedMs(null);
    setWrongIdx(null);
    setRank(null);
  };

  useEffect(reset, [size]);

  const handleClick = (n: number, idx: number) => {
    if (finishedMs != null) return;
    if (!startAt) setStartAt(performance.now());
    if (n !== next) {
      setWrongIdx(idx);
      setTimeout(() => setWrongIdx(null), 300);
      return;
    }
    if (n === total) {
      const ms = performance.now() - (startAt ?? performance.now());
      setFinishedMs(ms);
      const name = getPlayerName() || "玩家";
      const score = addScore({ name, size, timeMs: ms });
      setRank(getRank(score.id, size));
      onFinished?.();
    } else {
      setNext(n + 1);
    }
  };

  const display = finishedMs ?? now;
  const progress = ((next - 1) / total) * 100;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* HUD */}
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">用时</span>
          <span className="font-mono-tabular text-4xl font-bold text-gradient">
            {formatTime(display)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">下一个</span>
          <span className="font-mono-tabular text-4xl font-bold">
            {finishedMs != null ? "✓" : next}
            <span className="text-base text-muted-foreground"> / {total}</span>
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-energy transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Grid */}
      <div
        className="grid w-full gap-2 rounded-2xl bg-gradient-card p-3 shadow-elegant"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          aspectRatio: "1 / 1",
        }}
      >
        {numbers.map((n, idx) => {
          const done = n < next;
          const isNext = n === next && startAt;
          const isWrong = wrongIdx === idx;
          return (
            <button
              key={idx}
              onClick={() => handleClick(n, idx)}
              disabled={finishedMs != null}
              className={cn(
                "flex items-center justify-center rounded-xl font-mono-tabular font-bold transition-all duration-150 select-none",
                "bg-secondary text-secondary-foreground hover:bg-accent/20 active:scale-95",
                size <= 4 ? "text-3xl md:text-4xl" : size === 5 ? "text-2xl md:text-3xl" : "text-xl md:text-2xl",
                done && "bg-success/10 text-success/40 pointer-events-none",
                isNext && !done && "ring-2 ring-primary/30",
                isWrong && "animate-shake bg-destructive/20 text-destructive",
                finishedMs != null && "opacity-60",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* Controls / Result */}
      {finishedMs != null ? (
        <div className="w-full animate-slide-up rounded-2xl border bg-gradient-card p-6 text-center shadow-md">
          <Trophy className="mx-auto mb-2 h-10 w-10 text-energy" />
          <div className="text-sm uppercase tracking-widest text-muted-foreground">完成</div>
          <div className="my-2 font-mono-tabular text-5xl font-bold text-gradient">
            {formatTime(finishedMs)}
          </div>
          {rank && (
            <div className="text-sm text-muted-foreground">
              {size}×{size} 榜单第 <span className="font-bold text-foreground">#{rank}</span>
            </div>
          )}
          <Button onClick={reset} size="lg" className="mt-4 bg-gradient-primary hover:opacity-90">
            <RotateCcw className="mr-2 h-4 w-4" /> 再来一局
          </Button>
        </div>
      ) : !startAt ? (
        <div className="text-center text-sm text-muted-foreground">
          <Play className="mx-auto mb-1 h-5 w-5 text-primary" />
          点击数字 <span className="font-bold text-foreground">1</span> 开始计时
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" /> 重置
        </Button>
      )}
    </div>
  );
}
