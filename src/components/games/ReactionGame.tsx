import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { submitScore } from "@/lib/leaderboard";
import { Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getLang } from "@/lib/langState";

// 英文界面(2026-10-27):L(中文, 英文) 按当前语言取;主组件 useI18n() 订阅语言,切换即重渲染
const L = (zh: string, en: string) => (getLang() === "en" ? en : zh);

type Phase = "idle" | "waiting" | "ready" | "result" | "tooSoon";

export function ReactionGame({ onFinished }: { onFinished?: () => void }) {
  useI18n();
  const [phase, setPhase] = useState<Phase>("idle");
  const [ms, setMs] = useState(0);
  const [attempts, setAttempts] = useState<number[]>([]);
  const startRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const cancel = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };
  useEffect(() => () => cancel(), []);

  const start = () => {
    cancel();
    setPhase("waiting");
    const delay = 1200 + Math.random() * 2800;
    timeoutRef.current = window.setTimeout(() => {
      startRef.current = performance.now();
      setPhase("ready");
    }, delay);
  };

  const handleClick = async () => {
    if (phase === "idle" || phase === "result" || phase === "tooSoon") {
      start();
      return;
    }
    if (phase === "waiting") { cancel(); setPhase("tooSoon"); return; }
    if (phase === "ready") {
      const reaction = performance.now() - startRef.current;
      setMs(reaction);
      setAttempts((a) => [...a, reaction].slice(-5));
      setPhase("result");
      await submitScore({ game: "reaction", mode: "default", value: reaction });
      onFinished?.();
    }
  };

  const surface =
    phase === "ready" ? "bg-primary text-primary-foreground border-primary"
    : phase === "tooSoon" ? "bg-destructive text-destructive-foreground border-destructive"
    : phase === "waiting" ? "bg-foreground text-background border-foreground"
    : "bg-card text-foreground border-border";

  const avg = attempts.length ? attempts.reduce((a, b) => a + b, 0) / attempts.length : 0;

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={handleClick}
        className={cn(
          "relative flex h-[420px] w-full flex-col items-center justify-center rounded-md border-2 transition-colors duration-100 select-none",
          surface,
        )}
      >
        {phase === "idle" && (
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{L("点击开始", "Click to start")}</div>
            <div className="mt-2 font-display text-3xl">{L("屏幕变绿后立刻点击", "Click the moment it turns green")}</div>
          </div>
        )}
        {phase === "waiting" && (
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">{L("等待", "Wait")}</div>
            <div className="mt-2 font-display text-3xl">{L("不要抢跑", "Don't jump the gun")}</div>
          </div>
        )}
        {phase === "ready" && (
          <div className="text-center animate-pop-in">
            <Zap className="mx-auto mb-2 h-12 w-12" strokeWidth={2} />
            <div className="font-display text-4xl">{L("现在", "NOW")}</div>
          </div>
        )}
        {phase === "result" && (
          <div className="text-center animate-pop-in">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{L("反应时间", "Reaction time")}</div>
            <div className="font-mono-tabular text-7xl font-semibold leading-none my-2 text-primary">
              {Math.round(ms)}
              <span className="text-2xl text-muted-foreground"> ms</span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{L("点击再玩一次", "Click to play again")}</div>
          </div>
        )}
        {phase === "tooSoon" && (
          <div className="text-center animate-pop-in">
            <div className="font-display text-3xl">{L("抢跑了", "Too soon!")}</div>
            <div className="mt-1 text-sm opacity-90">{L("点击重新开始", "Click to restart")}</div>
          </div>
        )}
      </button>

      {attempts.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{L("最近 5 次", "Last 5")}</span>
            <span className="text-xs text-muted-foreground">
              {L("平均", "Avg")} <span className="font-mono-tabular font-medium text-foreground">{Math.round(avg)} ms</span>
            </span>
          </div>
          <div className="flex gap-1.5">
            {attempts.map((a, i) => (
              <div key={i} className="flex-1 rounded-sm border border-border py-2 text-center font-mono-tabular text-sm font-medium">
                {Math.round(a)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center text-[11px] text-muted-foreground">{L("优秀 < 200ms · 顶尖 < 150ms", "Great < 200ms · Elite < 150ms")}</div>
    </div>
  );
}
