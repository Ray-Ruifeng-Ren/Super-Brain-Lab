// N-Back working memory game (audio + visual position).
// Single N-back: a sequence of stimuli flashes; player presses MATCH
// when the current stimulus equals the one shown N steps ago.
//
// Score = round(hits / opportunities * 100), higher is better.
// Mode key: `${n}-back-${trials}`.

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitScore } from "@/lib/leaderboard";
import { Play, RotateCcw, Settings2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type Phase = "config" | "ready" | "playing" | "result";

interface Cfg {
  n: number;
  trials: number;
  intervalMs: number;
}

const DEFAULT: Cfg = { n: 2, trials: 20, intervalMs: 2000 };

interface Step { pos: number; isMatch: boolean; }

function generate(cfg: Cfg): Step[] {
  const seq: number[] = [];
  for (let i = 0; i < cfg.trials; i++) {
    // ~30% guaranteed match probability beyond index n
    if (i >= cfg.n && Math.random() < 0.3) {
      seq.push(seq[i - cfg.n]);
    } else {
      let p: number;
      do { p = Math.floor(Math.random() * 9); } while (i >= cfg.n && p === seq[i - cfg.n] && Math.random() < 0.7);
      seq.push(p);
    }
  }
  return seq.map((pos, i) => ({
    pos,
    isMatch: i >= cfg.n && pos === seq[i - cfg.n],
  }));
}

function NumInput({
  value, onChange, min, max, suffix,
}: { value: number; onChange: (n: number) => void; min: number; max: number; suffix?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <div className="flex items-center gap-2">
      <Input
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = parseInt(text.replace(/\D/g, ""), 10);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          else setText(String(value));
        }}
        className="h-9 w-20 text-center font-mono-tabular text-sm font-medium"
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

export function NBackGame({ onFinished, onCfgChange }: { onFinished?: () => void; onCfgChange?: (c: Cfg) => void }) {
  const [cfg, setCfg] = useState<Cfg>(DEFAULT);
  const [phase, setPhase] = useState<Phase>("config");
  const [seq, setSeq] = useState<Step[]>([]);
  const [step, setStep] = useState(-1);
  const [show, setShow] = useState(true);
  const [pressed, setPressed] = useState<boolean[]>([]); // user MATCH presses per step
  const [score, setScore] = useState<{ hits: number; misses: number; falseAlarms: number; opp: number; pct: number } | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => onCfgChange?.(cfg), [cfg, onCfgChange]);

  const begin = () => {
    setSeq(generate(cfg));
    setPressed(Array(cfg.trials).fill(false));
    setStep(-1);
    setScore(null);
    setPhase("ready");
  };

  // ready countdown
  useEffect(() => {
    if (phase !== "ready") return;
    let n = 3;
    const tick = () => {
      n--;
      if (n <= 0) { setStep(0); setPhase("playing"); }
      else timerRef.current = window.setTimeout(tick, 600);
    };
    timerRef.current = window.setTimeout(tick, 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  // playing tick
  useEffect(() => {
    if (phase !== "playing") return;
    if (step >= seq.length) {
      // grade
      let hits = 0, falseAlarms = 0, misses = 0, opp = 0;
      seq.forEach((s, i) => {
        if (s.isMatch) {
          opp++;
          if (pressed[i]) hits++; else misses++;
        } else if (pressed[i]) {
          falseAlarms++;
        }
      });
      const pct = opp === 0 ? 0 : Math.max(0, Math.round(((hits - falseAlarms) / opp) * 100));
      setScore({ hits, misses, falseAlarms, opp, pct });
      setPhase("result");
      submitScore({
        game: "nback",
        mode: `${cfg.n}-back-${cfg.trials}`,
        value: pct,
        meta: { hits, misses, falseAlarms, intervalMs: cfg.intervalMs },
      }).then((r) => {
        if (!r.ok && r.error === "未登录") {
          toast({ title: "登录后即可上榜", description: "本局成绩未保存到云端。" });
        }
      });
      onFinished?.();
      return;
    }
    setShow(true);
    const showMs = Math.max(300, cfg.intervalMs * 0.6);
    const blankMs = cfg.intervalMs - showMs;
    timerRef.current = window.setTimeout(() => {
      setShow(false);
      timerRef.current = window.setTimeout(() => setStep((s) => s + 1), blankMs);
    }, showMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step]);

  const onMatchPress = () => {
    if (phase !== "playing" || step < 0 || step >= seq.length) return;
    setPressed((p) => {
      const next = [...p];
      next[step] = true;
      return next;
    });
  };

  // Spacebar = MATCH
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && phase === "playing") { e.preventDefault(); onMatchPress(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step]);

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("config");
    setSeq([]);
    setStep(-1);
    setScore(null);
  };

  if (phase === "config") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">N-Back 配置</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Cell label="N" hint="1 – 5"><NumInput value={cfg.n} onChange={(n) => setCfg({ ...cfg, n })} min={1} max={5} /></Cell>
          <Cell label="题数" hint="10 – 60"><NumInput value={cfg.trials} onChange={(v) => setCfg({ ...cfg, trials: v })} min={10} max={60} /></Cell>
          <Cell label="间隔" hint="ms"><NumInput value={cfg.intervalMs} onChange={(v) => setCfg({ ...cfg, intervalMs: v })} min={1200} max={4000} suffix="ms" /></Cell>
        </div>
        <div className="rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          盯住 3×3 网格，方块依次在 9 个格子里闪现。<br />
          当当前位置和 <span className="font-mono-tabular font-semibold text-foreground">{cfg.n}</span> 步之前的位置相同时，按 <kbd className="rounded border border-border bg-background px-1 font-mono-tabular text-[10px]">SPACE</kbd> 或屏幕按钮。
        </div>
        <Button onClick={begin}><Play className="mr-2 h-3.5 w-3.5" /> 开始挑战</Button>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">准备</div>
        <div className="font-mono-tabular text-7xl font-semibold text-primary animate-pop-in">GO</div>
      </div>
    );
  }

  if (phase === "playing") {
    const cur = step >= 0 && step < seq.length ? seq[step] : null;
    const justPressed = step >= 0 ? pressed[step] : false;
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex w-full items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono-tabular">{Math.min(step + 1, seq.length)} / {seq.length}</span>
          <span className="font-mono-tabular text-foreground/70">{cfg.n}-Back</span>
          <button onClick={reset} className="hover:text-destructive">放弃</button>
        </div>
        <div className="h-px w-full bg-border">
          <div className="h-px bg-primary transition-all duration-150" style={{ width: `${((step + 1) / seq.length) * 100}%` }} />
        </div>

        <div className="grid w-[320px] grid-cols-3 gap-2 rounded-md border border-border bg-card p-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "aspect-square rounded-sm border border-border/70 transition-colors duration-100",
                cur && show && cur.pos === i ? "border-primary bg-primary" : "bg-background",
              )}
            />
          ))}
        </div>

        <Button
          onClick={onMatchPress}
          disabled={justPressed}
          className="h-14 w-full max-w-[320px] font-mono-tabular text-base"
        >
          {justPressed ? "已标记" : "MATCH (Space)"}
        </Button>
      </div>
    );
  }

  if (phase === "result" && score) {
    return (
      <div className="flex flex-col items-center gap-4 animate-slide-up">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full border-2",
            score.pct >= 70 ? "border-primary bg-primary/5 text-primary" : "border-destructive bg-destructive/5 text-destructive",
          )}
        >
          {score.pct >= 70 ? <Check className="h-7 w-7" strokeWidth={2.5} /> : <X className="h-7 w-7" strokeWidth={2.5} />}
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">命中率</div>
          <div className="mt-0.5 font-mono-tabular text-5xl font-semibold text-primary">{score.pct}%</div>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 text-center">
          <Stat label="命中" value={`${score.hits}/${score.opp}`} />
          <Stat label="漏报" value={String(score.misses)} />
          <Stat label="误报" value={String(score.falseAlarms)} />
        </div>
        <div className="flex w-full gap-2">
          <Button variant="outline" onClick={reset} className="flex-1" size="sm">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" /> 改配置
          </Button>
          <Button onClick={begin} className="flex-1" size="sm">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 再来
          </Button>
        </div>
      </div>
    );
  }
  return null;
}

function Cell({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-mono-tabular text-base font-semibold">{value}</div>
    </div>
  );
}
