import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addScore, getPlayerName } from "@/lib/leaderboard";
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import {
  Calculator,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Settings2,
  Volume2,
  Check,
  X,
} from "lucide-react";

type Phase = "config" | "playing" | "answer" | "result";

type Config = {
  count: number; // number of operations
  digits: number; // 1, 2, 3
  speedMs: number; // per term display
  includeSub: boolean;
};

const PRESETS = {
  count: [3, 5, 10],
  digits: [1, 2, 3],
  speedMs: [
    { label: "慢", value: 1500 },
    { label: "中", value: 1000 },
    { label: "快", value: 600 },
  ],
};

function randTerm(digits: number) {
  const min = digits === 1 ? 1 : Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProblem(cfg: Config): { terms: number[]; signs: ("+" | "-")[]; answer: number } {
  const terms: number[] = [];
  const signs: ("+" | "-")[] = ["+"];
  let running = randTerm(cfg.digits);
  terms.push(running);
  for (let i = 1; i < cfg.count; i++) {
    let term = randTerm(cfg.digits);
    let sign: "+" | "-" = "+";
    if (cfg.includeSub && Math.random() < 0.4 && running > term) {
      sign = "-";
      running -= term;
    } else {
      running += term;
    }
    terms.push(term);
    signs.push(sign);
  }
  return { terms, signs, answer: running };
}

function computeScore(cfg: Config, correct: boolean): number {
  if (!correct) return 0;
  const base = cfg.digits * 10 * cfg.count;
  const speedBonus = cfg.speedMs <= 600 ? 1.5 : cfg.speedMs <= 1000 ? 1.2 : 1;
  const subBonus = cfg.includeSub ? 1.2 : 1;
  return Math.round(base * speedBonus * subBonus);
}

// ─── Speech recognition wrapper ────────────────────────────────
type SR = any;
const SpeechRecognition: SR =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

function useSpeech(onFinalTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported] = useState(!!SpeechRecognition);
  const recRef = useRef<any>(null);
  const cbRef = useRef(onFinalTranscript);
  cbRef.current = onFinalTranscript;

  const start = () => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = "zh-CN";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let final = "";
      let interimTxt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interimTxt += r[0].transcript;
      }
      setInterim(interimTxt);
      if (final) {
        cbRef.current(final);
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
    try {
      recRef.current?.stop();
    } catch {}
    setListening(false);
  };

  useEffect(() => () => stop(), []);
  return { listening, supported, interim, start, stop };
}

// ─── Component ─────────────────────────────────────────────────
export function FlashMathGame({ onFinished }: { onFinished?: () => void }) {
  const [cfg, setCfg] = useState<Config>({ count: 5, digits: 2, speedMs: 1000, includeSub: false });
  const [phase, setPhase] = useState<Phase>("config");
  const [problem, setProblem] = useState<ReturnType<typeof generateProblem> | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
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

  const speak = (text: string) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      u.rate = 1.1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  };

  const start = () => {
    const p = generateProblem(cfg);
    setProblem(p);
    setStepIdx(0);
    setInput("");
    setResult(null);
    setPhase("playing");
  };

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    speech.stop();
    setPhase("config");
    setProblem(null);
    setInput("");
    setResult(null);
  };

  // step playback
  useEffect(() => {
    if (phase !== "playing" || !problem) return;
    if (stepIdx >= problem.terms.length) {
      setPhase("answer");
      return;
    }
    const term = problem.terms[stepIdx];
    const sign = problem.signs[stepIdx];
    speak(stepIdx === 0 ? `${term}` : `${sign === "+" ? "加" : "减"} ${term}`);
    timerRef.current = window.setTimeout(() => {
      setStepIdx((i) => i + 1);
    }, cfg.speedMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, stepIdx, problem]);

  // ─── render ──
  if (phase === "config") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            配置
          </span>
        </div>

        <ConfigRow label="题目数量">
          {PRESETS.count.map((c) => (
            <Pill key={c} active={cfg.count === c} onClick={() => setCfg({ ...cfg, count: c })}>
              {c} 题
            </Pill>
          ))}
        </ConfigRow>

        <ConfigRow label="每位位数">
          {PRESETS.digits.map((d) => (
            <Pill key={d} active={cfg.digits === d} onClick={() => setCfg({ ...cfg, digits: d })}>
              {d} 位
            </Pill>
          ))}
        </ConfigRow>

        <ConfigRow label="闪现速度">
          {PRESETS.speedMs.map((s) => (
            <Pill key={s.value} active={cfg.speedMs === s.value} onClick={() => setCfg({ ...cfg, speedMs: s.value })}>
              {s.label}
            </Pill>
          ))}
        </ConfigRow>

        <ConfigRow label="包含减法">
          <Pill active={!cfg.includeSub} onClick={() => setCfg({ ...cfg, includeSub: false })}>
            纯加法
          </Pill>
          <Pill active={cfg.includeSub} onClick={() => setCfg({ ...cfg, includeSub: true })}>
            加减混合
          </Pill>
        </ConfigRow>

        <Button size="lg" onClick={start} className="bg-gradient-primary mt-2">
          <Play className="mr-2 h-4 w-4" /> 开始挑战
        </Button>

        <div className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
          💡 题目会按速度逐个闪现并语音播报。结束后可以输入或<b>说出</b>答案。
        </div>
      </div>
    );
  }

  if (phase === "playing" && problem) {
    const showSign = stepIdx > 0;
    const currentSign = problem.signs[stepIdx];
    const term = problem.terms[stepIdx];
    return (
      <div className="flex flex-col items-center gap-5">
        <div className="flex w-full justify-between text-xs">
          <span className="text-muted-foreground">
            第 <span className="font-mono-tabular font-bold text-foreground">{stepIdx + 1}</span> / {problem.terms.length}
          </span>
          <button onClick={reset} className="text-muted-foreground hover:text-destructive transition-colors">
            放弃
          </button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-energy transition-all"
            style={{ width: `${((stepIdx + 1) / problem.terms.length) * 100}%` }}
          />
        </div>
        <div className="flex h-[280px] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white">
          <div key={stepIdx} className="flex items-center gap-3 animate-pop-in">
            {showSign && (
              <span
                className={cn(
                  "font-mono-tabular text-6xl font-bold opacity-80",
                  currentSign === "+" ? "text-emerald-300" : "text-rose-300",
                )}
              >
                {currentSign}
              </span>
            )}
            <span className="font-mono-tabular text-8xl font-bold tracking-tight">{term}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Volume2 className="h-3 w-3" />
          自动语音播报中
        </div>
      </div>
    );
  }

  if (phase === "answer" && problem) {
    return (
      <div className="flex flex-col items-center gap-5">
        <div className="text-center">
          <Calculator className="mx-auto mb-2 h-8 w-8 text-primary" />
          <div className="text-xs uppercase tracking-widest text-muted-foreground">答案是？</div>
        </div>
        <div className="w-full max-w-sm">
          <Input
            autoFocus
            inputMode="numeric"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && input.trim() && submit(input)}
            placeholder="输入数字或按麦克风说出答案"
            className="h-16 text-center font-mono-tabular text-3xl"
          />
          {speech.interim && (
            <div className="mt-2 text-center text-sm text-muted-foreground">
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
              size="lg"
            >
              {speech.listening ? (
                <>
                  <MicOff className="mr-2 h-4 w-4 animate-pulse" /> 正在听...
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" /> 语音作答
                </>
              )}
            </Button>
          )}
          <Button
            onClick={() => submit(input)}
            disabled={!input.trim()}
            className="flex-1 bg-gradient-primary"
            size="lg"
          >
            提交
          </Button>
        </div>
        {!speech.supported && (
          <p className="text-xs text-muted-foreground">
            当前浏览器不支持语音识别（推荐 Chrome / Edge）
          </p>
        )}
        <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">
          放弃这一题
        </button>
      </div>
    );
  }

  if (phase === "result" && problem && result) {
    return (
      <div className="flex flex-col items-center gap-4 animate-slide-up">
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg",
            result.correct ? "bg-gradient-to-br from-emerald-400 to-cyan-500" : "bg-gradient-to-br from-rose-500 to-orange-500",
          )}
        >
          {result.correct ? <Check className="h-10 w-10" strokeWidth={3} /> : <X className="h-10 w-10" strokeWidth={3} />}
        </div>
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {result.correct ? "回答正确" : "回答错误"}
          </div>
          <div className="mt-1 font-mono-tabular text-5xl font-bold text-gradient">
            {result.correct ? `+${result.score}` : "0"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">分</div>
        </div>
        <div className="w-full rounded-xl border bg-card p-4 text-center">
          <div className="text-xs text-muted-foreground">正确答案</div>
          <div className="my-1 font-mono-tabular text-3xl font-bold">{problem.answer}</div>
          {!result.correct && (
            <div className="text-xs text-muted-foreground">
              你的回答: <span className="font-mono-tabular font-bold text-destructive">{result.answered}</span>
            </div>
          )}
          <div className="mt-3 border-t pt-3 text-xs text-muted-foreground font-mono-tabular">
            {problem.terms
              .map((t, i) => (i === 0 ? `${t}` : ` ${problem.signs[i]} ${t}`))
              .join("")}
            {" = "}
            {problem.answer}
          </div>
        </div>
        <div className="flex w-full gap-2">
          <Button variant="outline" onClick={reset} className="flex-1">
            <Settings2 className="mr-2 h-4 w-4" /> 改配置
          </Button>
          <Button onClick={start} className="flex-1 bg-gradient-primary">
            <RotateCcw className="mr-2 h-4 w-4" /> 再来一题
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm font-semibold transition-all",
        active
          ? "border-transparent bg-gradient-primary text-primary-foreground shadow-md"
          : "bg-card hover:border-primary/40 hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}
