import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitScore, formatTime } from "@/lib/leaderboard";
import { RotateCcw } from "lucide-react";

function shuffle(n: number) {
  const arr = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function SchulteGame({ size, onFinished }: { size: number; onFinished?: () => void }) {
  const total = size * size;
  const [numbers, setNumbers] = useState<number[]>(() => shuffle(total));
  const [next, setNext] = useState(1);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (startAt && finishedMs == null) {
      const tick = () => {
        setNow(performance.now() - startAt);
        tickRef.current = requestAnimationFrame(tick);
      };
      tickRef.current = requestAnimationFrame(tick);
      return () => { if (tickRef.current) cancelAnimationFrame(tickRef.current); };
    }
  }, [startAt, finishedMs]);

  const reset = () => {
    setNumbers(shuffle(total));
    setNext(1);
    setStartAt(null);
    setNow(0);
    setFinishedMs(null);
    setWrongIdx(null);
  };

  useEffect(reset, [size]);

  const handleClick = async (n: number, idx: number) => {
    if (finishedMs != null) return;
    if (!startAt) setStartAt(performance.now());
    if (n !== next) {
      setWrongIdx(idx);
      setTimeout(() => setWrongIdx(null), 250);
      return;
    }
    if (n === total) {
      const ms = performance.now() - (startAt ?? performance.now());
      setFinishedMs(ms);
      await submitScore({ game: "schulte", mode: `${size}x${size}`, value: ms });
      onFinished?.();
    } else {
      setNext(n + 1);
    }
  };

  const display = finishedMs ?? now;
  const progress = ((next - 1) / total) * 100;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">用时</span>
          <span className="font-mono-tabular text-4xl font-semibold text-foreground">{formatTime(display)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">下一个</span>
          <span className="font-mono-tabular text-4xl font-semibold">
            {finishedMs != null ? "✓" : next}
            <span className="text-base text-muted-foreground"> / {total}</span>
          </span>
        </div>
      </div>

      <div className="h-px w-full bg-border">
        <div className="h-px bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div
        className="grid w-full gap-1.5 rounded-md border border-border bg-card p-2"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, aspectRatio: "1 / 1" }}
      >
        {numbers.map((n, idx) => {
          const done = n < next;
          const isWrong = wrongIdx === idx;
          return (
            <button
              key={idx}
              onClick={() => handleClick(n, idx)}
              disabled={finishedMs != null}
              className={cn(
                "flex items-center justify-center rounded-sm border border-border/70 bg-background font-mono-tabular font-medium text-foreground select-none",
                "hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98] transition-all duration-100",
                size <= 4 ? "text-3xl" : size === 5 ? "text-2xl" : "text-xl",
                done && "border-transparent bg-muted text-muted-foreground/30 pointer-events-none",
                isWrong && "animate-shake border-destructive bg-destructive/10 text-destructive",
                finishedMs != null && "opacity-70",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>

      {finishedMs != null ? (
        <div className="w-full animate-slide-up rounded-md border border-border bg-card p-5 text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">完成</div>
          <div className="my-1 font-mono-tabular text-5xl font-semibold text-primary">{formatTime(finishedMs)}</div>
          <Button onClick={reset} className="mt-3"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 再来一局</Button>
        </div>
      ) : !startAt ? (
        <div className="text-center text-sm text-muted-foreground">
          点击数字 <span className="font-mono-tabular font-semibold text-foreground">1</span> 开始计时
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 重置</Button>
      )}
    </div>
  );
}
