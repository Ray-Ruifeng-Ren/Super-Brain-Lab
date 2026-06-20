import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { submitScore } from "@/lib/leaderboard";
import { buildProblem, type Problem } from "@/lib/flashMath";
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import { Mic, MicOff, Play, RotateCcw, Settings2, Check, X, Minus, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logAttempt, fetchWrongAttempts } from "@/lib/practiceLog";

type Phase = "config" | "ready" | "playing" | "answer" | "result";

export interface FlashCfg {
  count: number;
  digits: number;
  speedMs: number;
  includeSub: boolean;
}

const DEFAULT_CFG: FlashCfg = { count: 5, digits: 2, speedMs: 700, includeSub: false };
const CFG_STORAGE_KEY = "flashmath:lastCfg";

function loadStoredCfg(): FlashCfg {
  if (typeof window === "undefined") return DEFAULT_CFG;
  try {
    const raw = window.localStorage.getItem(CFG_STORAGE_KEY);
    if (!raw) return DEFAULT_CFG;
    const p = JSON.parse(raw);
    return {
      count: Math.min(200, Math.max(1, Number(p.count) || DEFAULT_CFG.count)),
      digits: Math.min(7, Math.max(1, Number(p.digits) || DEFAULT_CFG.digits)),
      speedMs: Math.min(5000, Math.max(150, Number(p.speedMs) || DEFAULT_CFG.speedMs)),
      includeSub: !!p.includeSub,
    };
  } catch {
    return DEFAULT_CFG;
  }
}

// 参考世界珠算心算联合会 / 中国珠协比赛规则的近似积分体系：
// 总分 = round( 笔数 × 位数权重 × 速度系数 × 减法系数 )
// · 位数权重 digitWeight: 1→1, 2→1.4, 3→2, 4→2.8, 5→3.8, 6→5, 7→6.5（位数越多，难度非线性上升）
// · 速度系数 = clamp(1000 / speedMs, 0.4, 8)，以 1 秒/笔为基准 1.0；200ms 约 5.0
// · 减法系数 = 含减号 1.3，纯加 1.0（官方比赛对加减混合给予更高难度系数）
const DIGIT_WEIGHT = [0, 1, 1.4, 2, 2.8, 3.8, 5, 6.5];

export function previewScore(cfg: FlashCfg): number {
  const w = DIGIT_WEIGHT[cfg.digits] ?? cfg.digits;
  const speed = Math.min(8, Math.max(0.4, 1000 / Math.max(cfg.speedMs, 100)));
  const sub = cfg.includeSub ? 1.3 : 1;
  return Math.round(cfg.count * w * speed * sub * 10);
}

function computeScore(cfg: FlashCfg, correct: boolean): number {
  if (!correct) return 0;
  return previewScore(cfg);
}

// ── voice ──
const SR: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<any>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;
  const start = () => {
    if (!SR) return;
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let final = "";
      let it = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else it += r[0].transcript;
      }
      setInterim(it);
      if (final) {
        cb.current(final);
        setInterim("");
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };
  const stop = () => {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  };
  useEffect(() => () => stop(), []);
  return { listening, supported: !!SR, interim, start, stop };
}

function NumInput({
  value, onChange, min, max, suffix,
}: { value: number; onChange: (n: number) => void; min: number; max: number; suffix?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (s: string) => {
    const n = parseInt(s.replace(/\D/g, ""), 10);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    else setText(String(value));
  };
  return (
    <div className="flex items-center gap-1.5">
      <Input
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-7 w-16 rounded-md border-border bg-background px-1 py-0 text-center font-mono-tabular text-[11px] font-medium"
      />
      {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
    </div>
  );
}

export function FlashMathGame({
  onFinished,
  onCfgChange,
  mistakeMode = false,
}: {
  onFinished?: () => void;
  onCfgChange?: (cfg: FlashCfg) => void;
  mistakeMode?: boolean;
}) {
  const [cfg, setCfg] = useState<FlashCfg>(() => loadStoredCfg());
  const [phase, setPhase] = useState<Phase>("config");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [showTerm, setShowTerm] = useState(true);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ correct: boolean; score: number; answered: number } | null>(null);
  const [isReplay, setIsReplay] = useState(false);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => onCfgChange?.(cfg), [cfg, onCfgChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CFG_STORAGE_KEY, JSON.stringify(cfg));
    } catch {}
  }, [cfg]);

  const submit = async (raw: string) => {
    const value = parseSpokenNumber(raw);
    if (value == null || !problem) return;
    const usedMs = Date.now() - startTimeRef.current;
    const correct = value === problem.answer;
    const score = computeScore(cfg, correct);
    setResult({ correct, score, answered: value });
    setPhase("result");

    // Log every attempt (correct or wrong) for practice journal & mistake book.
    const mode = `${cfg.count}q-${cfg.digits}d${cfg.includeSub ? "-sub" : ""}`;
    logAttempt({
      game: "flashmath",
      mode,
      terms: problem.terms,
      signs: problem.signs,
      answer: problem.answer,
      userAnswer: value,
      correct,
      usedMs,
    });

    if (correct) {
      const r = await submitScore({
        game: "flashmath",
        mode,
        value: score,
        meta: { speedMs: cfg.speedMs },
      });
      if (!r.ok && r.error === "未登录") {
        toast({ title: "登录后即可上榜", description: "本局成绩未保存到云端。" });
      }
    }
    onFinished?.();
  };

  const speech = useSpeech((txt) => {
    setInput(txt);
    submit(txt);
  });

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    speech.stop();
    setPhase("config");
    setProblem(null);
    setInput("");
    setResult(null);
    setStepIdx(0);
    setIsReplay(false);
  };

  const beginCountdown = async () => {
    let problem: Problem | null = null;
    let replay = false;

    if (mistakeMode) {
      const wrong = await fetchWrongAttempts("flashmath", 50);
      if (wrong.length === 0) {
        toast({ title: "没有错题可以练", description: "请关闭「只练错题」开关。" });
        return;
      }
      const w = wrong[Math.floor(Math.random() * wrong.length)];
      problem = {
        terms: w.terms,
        signs: w.signs as ("+" | "-")[],
        answer: w.answer,
      };
      replay = true;
    } else {
      problem = buildProblem(cfg.count, cfg.digits, cfg.includeSub);
    }

    setProblem(problem);
    setIsReplay(replay);
    setStepIdx(0);
    setInput("");
    setResult(null);
    setPhase("ready");
  };

  // 3-2-1
  useEffect(() => {
    if (phase !== "ready") return;
    let n = 3;
    const tick = () => {
      n--;
      if (n <= 0) setPhase("playing");
      else timerRef.current = window.setTimeout(tick, 600);
    };
    timerRef.current = window.setTimeout(tick, 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing" || !problem) return;
    if (stepIdx >= problem.terms.length) {
      startTimeRef.current = Date.now();
      setPhase("answer");
      return;
    }
    setShowTerm(true);
    const blankMs = Math.max(50, Math.min(120, cfg.speedMs * 0.15));
    const showMs = Math.max(100, cfg.speedMs - blankMs);
    timerRef.current = window.setTimeout(() => {
      setShowTerm(false);
      timerRef.current = window.setTimeout(() => setStepIdx((i) => i + 1), blankMs);
    }, showMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, stepIdx, problem, cfg.speedMs]);

  if (phase === "config") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            训练配置
          </span>
        </div>

        {mistakeMode && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-[11px] text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>「只练错题」已开启：题目将从错题池抽取，配置仅影响闪现速度。</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <ConfigItem label="笔数" hint="1 – 200">
            <div className="flex flex-wrap items-center gap-1">
              {[5, 10, 15, 20, 30].map((n) => (
                <button
                  key={n}
                  onClick={() => setCfg({ ...cfg, count: n })}
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                    cfg.count === n
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  {n}笔
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground">或</span>
              <NumInput value={cfg.count} onChange={(n) => setCfg({ ...cfg, count: n })} min={1} max={200} suffix="笔" />
            </div>
          </ConfigItem>
          <ConfigItem label="位数" hint="1 – 7 位">
            <div className="flex flex-wrap items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setCfg({ ...cfg, digits: n })}
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                    cfg.digits === n
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  {n}位
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground">或</span>
              <NumInput value={cfg.digits} onChange={(n) => setCfg({ ...cfg, digits: n })} min={1} max={7} suffix="位" />
            </div>
          </ConfigItem>
          <ConfigItem label="单笔时间" hint="150 – 5000 ms">
            <div className="flex flex-wrap items-center gap-1">
              {[
                { label: "0.1秒", value: 100 },
                { label: "0.3秒", value: 300 },
                { label: "0.5秒", value: 500 },
                { label: "1秒", value: 1000 },
                { label: "1.5秒", value: 1500 },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setCfg({ ...cfg, speedMs: t.value })}
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                    cfg.speedMs === t.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  {t.label}
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground">或</span>
              <NumInput value={cfg.speedMs} onChange={(n) => setCfg({ ...cfg, speedMs: n })} min={150} max={5000} suffix="ms" />
            </div>
          </ConfigItem>
          <ConfigItem label="减法" hint="至多一个减号">
            <div className="flex gap-1.5">
              <Pill active={!cfg.includeSub} onClick={() => setCfg({ ...cfg, includeSub: false })}>无</Pill>
              <Pill active={cfg.includeSub} onClick={() => setCfg({ ...cfg, includeSub: true })}>有</Pill>
            </div>
          </ConfigItem>
        </div>

        <Button onClick={beginCountdown} size="sm">
          <Play className="mr-1.5 h-3.5 w-3.5" /> 开始挑战
        </Button>

        <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>本配置答对一题可获</span>
            <span className="font-mono-tabular text-sm font-semibold text-primary">{previewScore(cfg)} 分</span>
          </div>
          <div className="mt-0.5 text-[10px]">
            积分 = 笔数 × 位数权重(1/1.4/2/2.8/3.8/5/6.5) × 速度系数(1000/ms) × 减法系数(1.3)
          </div>
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">准备</div>
        <div className="font-mono-tabular text-7xl font-semibold text-primary animate-pop-in">GO</div>
        <div className="mt-3 text-xs text-muted-foreground">注视屏幕中央</div>
      </div>
    );
  }

  if (phase === "playing" && problem) {
    const sign = problem.signs[stepIdx];
    const term = problem.terms[stepIdx];
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono-tabular">{stepIdx + 1} / {problem.terms.length}</span>
          <span className="font-mono-tabular">{cfg.speedMs}ms</span>
          <button onClick={reset} className="hover:text-destructive">放弃</button>
        </div>
        <div className="h-px w-full bg-border">
          <div
            className="h-px bg-primary transition-all duration-100"
            style={{ width: `${((stepIdx + 1) / problem.terms.length) * 100}%` }}
          />
        </div>
        <div className="flex h-[320px] w-full items-center justify-center rounded-md border border-border bg-foreground text-background">
          {showTerm ? (
            <div key={stepIdx} className="flex items-center gap-3">
              {sign === "-" && <Minus className="h-12 w-12 text-background/80" strokeWidth={3} />}
              <span className="font-mono-tabular text-8xl font-semibold tracking-tight">{term}</span>
            </div>
          ) : (
            <div className="h-1.5 w-1.5 rounded-full bg-background/20" />
          )}
        </div>
      </div>
    );
  }

  if (phase === "answer" && problem) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">输入答案</div>
        </div>
        <div className="w-full max-w-sm">
          <Input
            autoFocus
            inputMode="numeric"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && input.trim() && submit(input)}
            placeholder="键入数字 / 麦克风说出"
            className="h-14 rounded-md border-border text-center font-mono-tabular text-2xl"
          />
          {speech.interim && (
            <div className="mt-1.5 text-center text-xs text-muted-foreground">
              听到："<span className="font-medium text-foreground">{speech.interim}</span>"
            </div>
          )}
        </div>
        <div className="flex w-full max-w-sm gap-2">
          {speech.supported && (
            <Button
              variant={speech.listening ? "destructive" : "outline"}
              onClick={speech.listening ? speech.stop : speech.start}
              className="flex-1"
            >
              {speech.listening ? (
                <><MicOff className="mr-1.5 h-3.5 w-3.5 animate-pulse" /> 听取中</>
              ) : (
                <><Mic className="mr-1.5 h-3.5 w-3.5" /> 语音</>
              )}
            </Button>
          )}
          <Button onClick={() => submit(input)} disabled={!input.trim()} className="flex-1">
            提交
          </Button>
        </div>
        {!speech.supported && (
          <p className="text-[11px] text-muted-foreground">语音识别需 Chrome / Edge</p>
        )}
        <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-foreground">
          放弃本局
        </button>
      </div>
    );
  }

  if (phase === "result" && problem && result) {
    return (
      <div className="flex flex-col items-center gap-4 animate-slide-up">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full border-2",
            result.correct
              ? "border-primary bg-primary/5 text-primary"
              : "border-destructive bg-destructive/5 text-destructive",
          )}
        >
          {result.correct ? <Check className="h-7 w-7" strokeWidth={2.5} /> : <X className="h-7 w-7" strokeWidth={2.5} />}
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {result.correct ? "正确" : "错误"}
          </div>
          <div className="mt-0.5 font-mono-tabular text-5xl font-semibold text-foreground">
            {result.correct ? `+${result.score}` : "0"}
          </div>
          <div className="text-[11px] text-muted-foreground">分</div>
        </div>
        <div className="w-full rounded-md border border-border p-3 text-center">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">正确答案</div>
          <div className="my-0.5 font-mono-tabular text-2xl font-semibold">{problem.answer}</div>
          {!result.correct && (
            <div className="text-[11px] text-muted-foreground">
              你的回答 <span className="font-mono-tabular font-medium text-destructive">{result.answered}</span>
            </div>
          )}
          <div className="mt-2 border-t border-border pt-2 font-mono-tabular text-[11px] text-muted-foreground break-all">
            {problem.terms
              .map((t, i) => {
                const s = problem.signs[i];
                if (i === 0) return s === "-" ? `−${t}` : `${t}`;
                return s === "-" ? ` − ${t}` : `  ${t}`;
              })
              .join("")}
            {" = "}{problem.answer}
          </div>
        </div>
        <div className="flex w-full gap-2">
          <Button variant="outline" onClick={reset} className="flex-1" size="sm">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" /> 改配置
          </Button>
          <Button onClick={beginCountdown} className="flex-1" size="sm">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 再来
          </Button>
        </div>
      </div>
    );
  }
  return null;
}

function ConfigItem({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
