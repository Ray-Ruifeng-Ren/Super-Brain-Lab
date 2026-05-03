import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addScore, getPlayerName } from "@/lib/leaderboard";
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import { Calculator, Mic, MicOff, Play, RotateCcw, Settings2, Check, X } from "lucide-react";

type Phase = "config" | "ready" | "playing" | "answer" | "result";

type Config = {
  count: number;       // 笔数
  digits: number;      // 每笔位数 1..7
  speedMs: number;     // 每笔显示时间 ms
  includeSub: boolean; // 是否含一个减号
};

const DEFAULT_CFG: Config = { count: 5, digits: 2, speedMs: 700, includeSub: false };

// ── 出题逻辑 (专业珠心算风格) ─────────────────────────────
// 数字不重复 + 范围均匀分布
function generateTerms(count: number, digits: number): number[] {
  const min = digits === 1 ? 1 : Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  const range = max - min + 1;
  const bucket = range / count;
  const used = new Set<number>();
  const terms: number[] = [];
  for (let i = 0; i < count; i++) {
    const lo = Math.floor(min + i * bucket);
    const hi = Math.max(lo, Math.floor(min + (i + 1) * bucket) - 1);
    let v = lo;
    for (let t = 0; t < 30; t++) {
      v = Math.floor(Math.random() * (hi - lo + 1)) + lo;
      if (!used.has(v)) break;
    }
    used.add(v);
    terms.push(v);
  }
  // 洗牌使顺序无序
  for (let i = terms.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [terms[i], terms[j]] = [terms[j], terms[i]];
  }
  return terms;
}

// 至多一个减号; 选择能保证累加和始终为正的位置
function buildProblem(cfg: Config) {
  const terms = generateTerms(cfg.count, cfg.digits);
  const signs: ("+" | "-")[] = terms.map(() => "+");
  if (cfg.includeSub && terms.length >= 3) {
    // 计算每个候选位置的"前面累加和"
    const candidates: number[] = [];
    let sum = terms[0];
    for (let i = 1; i < terms.length; i++) {
      if (sum > terms[i]) candidates.push(i);
      sum += terms[i];
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

function computeScore(cfg: Config, correct: boolean) {
  if (!correct) return 0;
  const base = cfg.digits * cfg.count * 10;
  // 越快越高分: 1s = ×1, 0.5s = ×1.5, 0.3s = ×2, 0.2s = ×2.5
  const speedMul = Math.max(1, Math.round((1100 / Math.max(cfg.speedMs, 150)) * 10) / 10);
  const subBonus = cfg.includeSub ? 1.2 : 1;
  return Math.round(base * speedMul * subBonus);
}

// ── 语音识别 ──
const SR: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const supported = !!SR;
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
  return { listening, supported, interim, start, stop };
}

// ── 数字输入 (clamped) ──
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
        className="h-9 w-20 text-center font-mono-tabular text-sm font-semibold"
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

// ── 主组件 ──
export function FlashMathGame({ onFinished }: { onFinished?: () => void }) {
  const [cfg, setCfg] = useState<Config>(DEFAULT_CFG);
  const [phase, setPhase] = useState<Phase>("config");
  const [problem, setProblem] = useState<ReturnType<typeof buildProblem> | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [showTerm, setShowTerm] = useState(true); // 闪现的开/关 制造 blink
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ correct: boolean; score: number; answered: number } | null>(null);
  const timerRef = useRef<number | null>(null);

  const submit = (raw: string) => {
    const value = parseSpokenNumber(raw);
    if (value == null || !problem) return;
    const correct = value === problem.answer;
    const score = computeScore(cfg, correct);
    setResult({ correct, score, answered: value });
    setPhase("result");
    if (correct) {
      const name = getPlayerName() || "玩家";
      const mode = `${cfg.count}q-${cfg.digits}d${cfg.includeSub ? "-sub" : ""}`;
      addScore({ game: "flashmath", mode, name, value: score });
      onFinished?.();
    }
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
  };

  const beginCountdown = () => {
    setProblem(buildProblem(cfg));
    setStepIdx(0);
    setInput("");
    setResult(null);
    setPhase("ready");
  };

  // 倒计时 3-2-1-GO
  useEffect(() => {
    if (phase !== "ready") return;
    let n = 3;
    const tick = () => {
      n--;
      if (n <= 0) {
        setPhase("playing");
      } else {
        timerRef.current = window.setTimeout(tick, 700);
      }
    };
    timerRef.current = window.setTimeout(tick, 700);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  // 闪现序列 (无语音) - 在每个数字之间插入短暂空白以便区分相同长度数字
  useEffect(() => {
    if (phase !== "playing" || !problem) return;
    if (stepIdx >= problem.terms.length) {
      setPhase("answer");
      return;
    }
    setShowTerm(true);
    const blankMs = Math.max(50, Math.min(120, cfg.speedMs * 0.15));
    const showMs = Math.max(100, cfg.speedMs - blankMs);
    timerRef.current = window.setTimeout(() => {
      setShowTerm(false);
      timerRef.current = window.setTimeout(() => {
        setStepIdx((i) => i + 1);
      }, blankMs);
    }, showMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, stepIdx, problem, cfg.speedMs]);

  // ── render ──
  if (phase === "config") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1.5">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            训练配置
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ConfigItem label="笔数" hint="1 - 100">
            <NumInput value={cfg.count} onChange={(n) => setCfg({ ...cfg, count: n })} min={1} max={100} suffix="笔" />
          </ConfigItem>
          <ConfigItem label="位数" hint="1 - 7 位">
            <NumInput value={cfg.digits} onChange={(n) => setCfg({ ...cfg, digits: n })} min={1} max={7} suffix="位" />
          </ConfigItem>
          <ConfigItem label="单笔时间" hint="150 - 5000 ms">
            <NumInput value={cfg.speedMs} onChange={(n) => setCfg({ ...cfg, speedMs: n })} min={150} max={5000} suffix="ms" />
          </ConfigItem>
          <ConfigItem label="减法" hint="至多一个减号">
            <div className="flex gap-1.5">
              <Pill active={!cfg.includeSub} onClick={() => setCfg({ ...cfg, includeSub: false })}>无</Pill>
              <Pill active={cfg.includeSub} onClick={() => setCfg({ ...cfg, includeSub: true })}>有</Pill>
            </div>
          </ConfigItem>
        </div>

        {/* 速度预设快捷键 */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">速度预设</span>
          {[1000, 700, 500, 300, 200].map((ms) => (
            <button
              key={ms}
              onClick={() => setCfg({ ...cfg, speedMs: ms })}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono-tabular text-[11px] transition-colors",
                cfg.speedMs === ms ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/40",
              )}
            >
              {ms}ms
            </button>
          ))}
        </div>

        <Button size="default" onClick={beginCountdown} className="bg-gradient-primary mt-1">
          <Play className="mr-2 h-3.5 w-3.5" /> 开始挑战
        </Button>

        <div className="rounded-lg bg-secondary/60 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          数字均匀分布且不重复 · 加号省略仅显示减号 · 闪现期间无语音以保证节奏
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">准备</div>
        <div className="font-mono-tabular text-7xl font-bold text-gradient animate-pop-in">
          GO
        </div>
        <div className="mt-3 text-xs text-muted-foreground">注视屏幕中央</div>
      </div>
    );
  }

  if (phase === "playing" && problem) {
    const sign = problem.signs[stepIdx];
    const term = problem.terms[stepIdx];
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between text-[11px]">
          <span className="text-muted-foreground font-mono-tabular">
            {stepIdx + 1} / {problem.terms.length}
          </span>
          <span className="text-muted-foreground font-mono-tabular">{cfg.speedMs}ms</span>
          <button onClick={reset} className="text-muted-foreground hover:text-destructive">
            放弃
          </button>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-energy transition-all duration-100"
            style={{ width: `${((stepIdx + 1) / problem.terms.length) * 100}%` }}
          />
        </div>
        <div className="flex h-[280px] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white">
          {showTerm ? (
            <div key={stepIdx} className="flex items-baseline gap-2">
              {sign === "-" && (
                <span className="font-mono-tabular text-6xl font-bold text-rose-300">−</span>
              )}
              <span className="font-mono-tabular text-7xl font-bold tracking-tight tabular-nums">
                {term}
              </span>
            </div>
          ) : (
            <div className="h-2 w-2 rounded-full bg-white/20" />
          )}
        </div>
      </div>
    );
  }

  if (phase === "answer" && problem) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <Calculator className="mx-auto mb-1 h-6 w-6 text-primary" />
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">答案</div>
        </div>
        <div className="w-full max-w-sm">
          <Input
            autoFocus
            inputMode="numeric"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && input.trim() && submit(input)}
            placeholder="输入数字 / 按麦克风说出答案"
            className="h-14 text-center font-mono-tabular text-2xl"
          />
          {speech.interim && (
            <div className="mt-1.5 text-center text-xs text-muted-foreground">
              听到："<span className="font-bold text-foreground">{speech.interim}</span>"
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
          <Button onClick={() => submit(input)} disabled={!input.trim()} className="flex-1 bg-gradient-primary">
            提交
          </Button>
        </div>
        {!speech.supported && (
          <p className="text-[11px] text-muted-foreground">
            语音识别需 Chrome / Edge 浏览器
          </p>
        )}
        <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-foreground">
          放弃
        </button>
      </div>
    );
  }

  if (phase === "result" && problem && result) {
    return (
      <div className="flex flex-col items-center gap-3 animate-slide-up">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md",
            result.correct
              ? "bg-gradient-to-br from-emerald-400 to-cyan-500"
              : "bg-gradient-to-br from-rose-500 to-orange-500",
          )}
        >
          {result.correct ? <Check className="h-8 w-8" strokeWidth={3} /> : <X className="h-8 w-8" strokeWidth={3} />}
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {result.correct ? "正确" : "错误"}
          </div>
          <div className="mt-0.5 font-mono-tabular text-4xl font-bold text-gradient">
            {result.correct ? `+${result.score}` : "0"}
          </div>
          <div className="text-[11px] text-muted-foreground">分</div>
        </div>
        <div className="w-full rounded-xl border bg-card p-3 text-center">
          <div className="text-[10px] text-muted-foreground">正确答案</div>
          <div className="my-0.5 font-mono-tabular text-2xl font-bold">{problem.answer}</div>
          {!result.correct && (
            <div className="text-[11px] text-muted-foreground">
              你的回答: <span className="font-mono-tabular font-bold text-destructive">{result.answered}</span>
            </div>
          )}
          <div className="mt-2 border-t pt-2 font-mono-tabular text-[11px] text-muted-foreground break-all">
            {problem.terms
              .map((t, i) => {
                const s = problem.signs[i];
                if (i === 0) return s === "-" ? `−${t}` : `${t}`;
                return s === "-" ? ` − ${t}` : `  ${t}`;
              })
              .join("")}
            {" = "}
            {problem.answer}
          </div>
        </div>
        <div className="flex w-full gap-2">
          <Button variant="outline" onClick={reset} className="flex-1" size="sm">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" /> 改配置
          </Button>
          <Button onClick={beginCountdown} className="flex-1 bg-gradient-primary" size="sm">
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
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
        active
          ? "border-transparent bg-gradient-primary text-primary-foreground shadow-sm"
          : "bg-card hover:border-primary/40 hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}
