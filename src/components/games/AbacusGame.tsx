import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Settings2, Check, X, Minus, Plus, AlertTriangle, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { submitScore } from "@/lib/leaderboard";
import { logAttempt, fetchWrongAttempts } from "@/lib/practiceLog";
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import type { Problem } from "@/lib/flashMath";
import {
  buildAbacusProblem, previewScore, computeScore, abacusMode, numberToCN,
  DEFAULT_ABACUS_CFG, type AbacusCfg, type AbacusMode,
} from "@/lib/abacus";

type Phase = "config" | "ready" | "playing" | "answer" | "result";

const CFG_KEY = "abacus:lastCfg";
const COUNT_PRESETS = [5, 10, 15, 20, 30];
const DIGIT_PRESETS = [1, 2, 3, 4, 5];
const SPEED_PRESETS = [
  { label: "0.1秒", value: 100 }, { label: "0.3秒", value: 300 },
  { label: "0.5秒", value: 500 }, { label: "1秒", value: 1000 }, { label: "1.5秒", value: 1500 },
];
const LISTEN_PRESETS = [
  { label: "慢", value: 3 }, { label: "中", value: 5 }, { label: "快", value: 7 }, { label: "极快", value: 9 },
];
const MODES: { id: AbacusMode; label: string; sub: string }[] = [
  { id: "flash", label: "闪算", sub: "逐笔闪现" },
  { id: "glance", label: "看算", sub: "竖式同现" },
  { id: "listen", label: "听算", sub: "语音报数" },
];

function clampCfg(c: Partial<AbacusCfg>): AbacusCfg {
  const m = c.mode === "glance" || c.mode === "listen" ? c.mode : "flash";
  return {
    mode: m,
    count: Math.min(200, Math.max(1, Math.round(c.count ?? DEFAULT_ABACUS_CFG.count))),
    digits: Math.min(9, Math.max(1, Math.round(c.digits ?? DEFAULT_ABACUS_CFG.digits))),
    speedMs: Math.min(5000, Math.max(100, Math.round(c.speedMs ?? DEFAULT_ABACUS_CFG.speedMs))),
    listenLevel: Math.min(10, Math.max(1, Math.round(c.listenLevel ?? DEFAULT_ABACUS_CFG.listenLevel))),
    includeSub: !!c.includeSub,
  };
}

function loadStoredCfg(): AbacusCfg {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return clampCfg(JSON.parse(raw));
  } catch { /* noop */ }
  return { ...DEFAULT_ABACUS_CFG };
}

function speakTerm(text: string, level: number): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.7 + level * 0.12;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
    setTimeout(resolve, 4000);
  });
}

interface RoundRecord { problem: Problem; userAnswer: number | null; correct: boolean; score: number; }

export interface AbacusGameProps {
  onFinished?: () => void;
  onCfgChange?: (cfg: AbacusCfg) => void;
  mistakeMode?: boolean;
  onMistakeModeChange?: (v: boolean) => void;
}

export function AbacusGame({ onFinished, onCfgChange, mistakeMode = false, onMistakeModeChange }: AbacusGameProps) {
  const [cfg, setCfg] = useState<AbacusCfg>(loadStoredCfg);
  const [phase, setPhase] = useState<Phase>("config");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [showTerm, setShowTerm] = useState(false);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ correct: boolean; score: number; answered: number | null } | null>(null);
  const [countdown, setCountdown] = useState(3);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usedMistakeKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* noop */ } }, [cfg]);
  useEffect(() => { onCfgChange?.(cfg); }, [cfg, onCfgChange]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); window.speechSynthesis?.cancel(); }, []);

  const problemKey = (p: Problem) => `${p.signs.join("")}|${p.terms.join(",")}|${p.answer}`;

  async function loadProblem(): Promise<Problem | null> {
    if (mistakeMode) {
      const rows = await fetchWrongAttempts("abacus");
      if (!rows.length) return null;
      const seen = new Set<string>();
      const uniq = rows.filter((r) => {
        const p: Problem = { terms: r.terms, signs: r.signs, answer: r.answer };
        const k = problemKey(p);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const fresh = uniq.filter((r) => !usedMistakeKeysRef.current.has(problemKey({ terms: r.terms, signs: r.signs, answer: r.answer })));
      const pool = fresh.length ? fresh : (usedMistakeKeysRef.current.clear(), uniq);
      const pickRow = pool[Math.floor(Math.random() * pool.length)];
      return { terms: pickRow.terms, signs: pickRow.signs, answer: pickRow.answer };
    }
    return buildAbacusProblem(cfg);
  }

  async function beginCountdown() {
    usedMistakeKeysRef.current.clear();
    const p = await loadProblem();
    if (!p) {
      toast({ title: "没有错题可以练", description: "请关闭「只练错题」开关。" });
      return;
    }
    usedMistakeKeysRef.current.add(problemKey(p));
    setProblem(p);
    setInput("");
    setResult(null);
    setStepIdx(0);
    setShowTerm(false);
    setCountdown(3);
    setPhase("ready");
  }

  // 倒计时
  useEffect(() => {
    if (phase !== "ready") return;
    if (countdown <= 0) {
      // 看算:直接进入作答(竖式同现);闪算/听算:进入逐笔揭示
      setPhase(cfg.mode === "glance" ? "answer" : "playing");
      return;
    }
    timerRef.current = setTimeout(() => setCountdown((n) => n - 1), 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, countdown, cfg.mode]);

  // 闪算揭示
  useEffect(() => {
    if (phase !== "playing" || cfg.mode !== "flash" || !problem) return;
    if (stepIdx >= problem.terms.length) { setPhase("answer"); return; }
    setShowTerm(true);
    const blankMs = Math.min(120, Math.max(50, cfg.speedMs * 0.15));
    const showMs = Math.max(100, cfg.speedMs - blankMs);
    const t1 = setTimeout(() => setShowTerm(false), showMs);
    const t2 = setTimeout(() => setStepIdx((i) => i + 1), cfg.speedMs);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, stepIdx, problem, cfg.mode, cfg.speedMs]);

  // 听算揭示
  useEffect(() => {
    if (phase !== "playing" || cfg.mode !== "listen" || !problem) return;
    if (stepIdx >= problem.terms.length) { setPhase("answer"); return; }
    let cancelled = false;
    const v = problem.terms[stepIdx];
    const sign = problem.signs[stepIdx];
    const text = (stepIdx === 0 ? "" : sign === "-" ? "减 " : "加 ") + numberToCN(v);
    setShowTerm(true);
    speakTerm(text, cfg.listenLevel).then(() => {
      if (cancelled) return;
      const gap = Math.max(150, 900 - cfg.listenLevel * 70);
      timerRef.current = setTimeout(() => setStepIdx((i) => i + 1), gap);
    });
    return () => { cancelled = true; window.speechSynthesis?.cancel(); };
  }, [phase, stepIdx, problem, cfg.mode, cfg.listenLevel]);

  function reset() {
    if (timerRef.current) clearTimeout(timerRef.current);
    window.speechSynthesis?.cancel();
    setPhase("config");
    setProblem(null);
    setInput("");
    setResult(null);
  }

  async function submit(raw: string) {
    if (!problem) return;
    const parsed = parseSpokenNumber(raw);
    if (parsed === null) return;
    const correct = parsed === problem.answer;
    const score = computeScore(cfg, correct);
    const mode = abacusMode(cfg);

    await logAttempt({
      game: "abacus", mode, terms: problem.terms, signs: problem.signs,
      answer: problem.answer, userAnswer: parsed, correct, usedMs: 0,
    });
    if (correct) {
      const r = await submitScore({ game: "abacus", mode, value: score, meta: { mode: cfg.mode } });
      if (!r.ok && r.error === "未登录") {
        toast({ title: "登录后即可上榜", description: "本局成绩未保存到云端。" });
      }
    }
    onFinished?.();
    setResult({ correct, score, answered: parsed });
    setPhase("result");
  }

  const w = "flex flex-col gap-3";

  // ================= CONFIG =================
  if (phase === "config") {
    return (
      <div className={w}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">训练配置</span>
          </div>
          {onMistakeModeChange && (
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>只练错题</span>
              <Switch checked={mistakeMode} onCheckedChange={onMistakeModeChange} />
            </label>
          )}
        </div>

        {mistakeMode && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-[11px] text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>「只练错题」已开启：题目将从错题池抽取，配置仅影响呈现方式与速度。</span>
          </div>
        )}

        {/* 模式 */}
        <ConfigItem label="训练模式" hint="珠心算三大模式">
          <div className="flex flex-wrap items-center gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setCfg({ ...cfg, mode: m.id })}
                className={cn(
                  "inline-flex flex-col items-start rounded-md border px-3 py-1.5 text-left transition-colors",
                  cfg.mode === m.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}
              >
                <span className="text-xs font-semibold">{m.label}</span>
                <span className="text-[9px] opacity-70">{m.sub}</span>
              </button>
            ))}
          </div>
        </ConfigItem>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {/* 笔数 */}
          <ConfigItem label="笔数" hint="1–200">
            <div className="flex flex-wrap items-center gap-1">
              {COUNT_PRESETS.map((n) => (
                <PillBtn key={n} active={cfg.count === n} onClick={() => setCfg({ ...cfg, count: n })}>{n}笔</PillBtn>
              ))}
              <span className="text-[10px] text-muted-foreground">或</span>
              <NumInput value={COUNT_PRESETS.includes(cfg.count) ? null : cfg.count} min={1} max={200} suffix="笔" onCommit={(v) => setCfg({ ...cfg, count: v })} />
            </div>
          </ConfigItem>

          {/* 位数 */}
          <ConfigItem label="位数" hint="1–9">
            <div className="flex flex-wrap items-center gap-1">
              {DIGIT_PRESETS.map((n) => (
                <PillBtn key={n} active={cfg.digits === n} onClick={() => setCfg({ ...cfg, digits: n })}>{n}位</PillBtn>
              ))}
              <span className="text-[10px] text-muted-foreground">或</span>
              <NumInput value={DIGIT_PRESETS.includes(cfg.digits) ? null : cfg.digits} min={1} max={9} suffix="位" onCommit={(v) => setCfg({ ...cfg, digits: v })} />
            </div>
          </ConfigItem>

          {/* 速度 / 语速 */}
          {cfg.mode === "flash" && (
            <ConfigItem label="单笔时间" hint="越小越快">
              <div className="flex flex-wrap items-center gap-1">
                {SPEED_PRESETS.map((s) => (
                  <PillBtn key={s.value} active={cfg.speedMs === s.value} onClick={() => setCfg({ ...cfg, speedMs: s.value })}>{s.label}</PillBtn>
                ))}
              </div>
            </ConfigItem>
          )}
          {cfg.mode === "listen" && (
            <ConfigItem label="语速" hint="报数快慢">
              <div className="flex flex-wrap items-center gap-1">
                {LISTEN_PRESETS.map((s) => (
                  <PillBtn key={s.value} active={cfg.listenLevel === s.value} onClick={() => setCfg({ ...cfg, listenLevel: s.value })}>{s.label}</PillBtn>
                ))}
              </div>
            </ConfigItem>
          )}
          {cfg.mode === "glance" && (
            <ConfigItem label="呈现" hint="看算">
              <p className="text-[11px] leading-relaxed text-muted-foreground">整道题竖式一次性显示，自行心算后作答。</p>
            </ConfigItem>
          )}

          {/* 加减 */}
          <ConfigItem label="加减" hint="减号规则内建">
            <div className="flex flex-wrap items-center gap-1">
              <PillBtn active={!cfg.includeSub} onClick={() => setCfg({ ...cfg, includeSub: false })}>纯加</PillBtn>
              <PillBtn active={cfg.includeSub} onClick={() => setCfg({ ...cfg, includeSub: true })}>加减混合</PillBtn>
            </div>
          </ConfigItem>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={beginCountdown}><Play className="mr-1.5 h-4 w-4" /> 开始挑战</Button>
        </div>

        <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>本配置答对一题可获</span>
            <span className="font-mono-tabular text-sm font-semibold text-primary">{previewScore(cfg)} 分</span>
          </div>
          <div className="mt-0.5 text-[10px]">
            积分 = 笔数 × 位数权重 × 速度系数 × 减法系数(1.3) × 模式系数(看1/闪1.15/听1.3)
          </div>
        </div>
      </div>
    );
  }

  // ================= READY =================
  if (phase === "ready") {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center">
        <div key={countdown} className="animate-pop-in text-7xl font-semibold font-mono-tabular">GO</div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">准备</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {cfg.mode === "listen" ? "打开声音，用心听" : "注视屏幕中央"}
        </p>
      </div>
    );
  }

  // ================= PLAYING (flash / listen) =================
  if (phase === "playing" && problem) {
    const displayIdx = Math.min(stepIdx, problem.terms.length - 1);
    const sign = problem.signs[displayIdx];
    const v = problem.terms[displayIdx];
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono-tabular">{displayIdx + 1} / {problem.terms.length}</span>
          <span className="font-mono-tabular">{cfg.mode === "flash" ? `${cfg.speedMs}ms` : "听算"}</span>
          <button onClick={reset} className="transition-colors hover:text-destructive">放弃</button>
        </div>
        <div className="h-px w-full bg-border">
          <div className="h-px bg-primary transition-all" style={{ width: `${((displayIdx + 1) / problem.terms.length) * 100}%` }} />
        </div>

        {cfg.mode === "flash" ? (
          <div className="flex h-[320px] items-center justify-center rounded-md bg-foreground text-background">
            {showTerm && (
              <div key={stepIdx} className="animate-pop-in flex items-center gap-2">
                {sign === "-"
                  ? <Minus className="h-12 w-12" strokeWidth={3} />
                  : <Plus className="h-12 w-12" strokeWidth={3} />}
                <span className="text-8xl font-semibold font-mono-tabular">{v}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-[320px] flex-col items-center justify-center rounded-md bg-foreground text-background">
            <Volume2 className={cn("h-20 w-20", showTerm && "animate-pulse")} />
            <p className="mt-6 text-sm text-background/70">正在报第 {displayIdx + 1} / {problem.terms.length} 笔，用心算</p>
          </div>
        )}
      </div>
    );
  }

  // ================= ANSWER =================
  if (phase === "answer" && problem) {
    return (
      <div className="flex flex-col gap-3">
        {cfg.mode === "glance" && (
          <div className="rounded-md border border-border bg-card p-4">
            <div className="flex flex-col items-end gap-0.5 font-mono-tabular text-2xl font-semibold md:text-3xl">
              {problem.terms.map((t, i) => (
                <div key={i}>
                  <span className={cn("mr-3", problem.signs[i] === "-" ? "text-destructive" : "text-muted-foreground")}>{problem.signs[i] === "-" ? "−" : "+"}</span>
                  {t}
                </div>
              ))}
              <div className="mt-1 h-[3px] w-3/5 bg-foreground" />
            </div>
          </div>
        )}
        <AnswerPad
          value={input}
          onChange={setInput}
          onSubmit={() => submit(input)}
          onGiveUp={reset}
          canReplay={cfg.mode === "listen"}
          onReplay={() => { setStepIdx(0); setShowTerm(false); setPhase("playing"); }}
        />
      </div>
    );
  }

  // ================= RESULT =================
  if (phase === "result" && problem && result) {
    const exprStr = problem.terms
      .map((t, i) => (i === 0 ? `${t}` : problem.signs[i] === "-" ? ` − ${t}` : ` + ${t}`))
      .join("");
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className={cn("flex h-16 w-16 items-center justify-center rounded-full", result.correct ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
          {result.correct ? <Check className="h-8 w-8" strokeWidth={3} /> : <X className="h-8 w-8" strokeWidth={3} />}
        </div>
        <div className="text-center">
          <p className={cn("text-sm font-semibold", result.correct ? "text-primary" : "text-destructive")}>{result.correct ? "正确" : "错误"}</p>
          <p className="mt-1 text-5xl font-semibold font-mono-tabular">{result.correct ? `+${result.score}` : "0"}</p>
        </div>

        <div className="w-full max-w-md rounded-md border border-border bg-muted/30 p-4 text-center">
          <div className="flex items-center justify-center gap-8">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">正确答案</p>
              <p className="font-mono-tabular text-2xl font-semibold text-primary">{problem.answer}</p>
            </div>
            {!result.correct && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">你的答案</p>
                <p className="font-mono-tabular text-2xl font-semibold text-destructive">{result.answered ?? "—"}</p>
              </div>
            )}
          </div>
          <p className="mt-3 break-words font-mono-tabular text-sm text-muted-foreground">{exprStr} = {problem.answer}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={reset}>改配置</Button>
          <Button onClick={beginCountdown}><RotateCcw className="mr-1.5 h-4 w-4" /> 再来</Button>
        </div>
      </div>
    );
  }

  return null;
}

// ---------- 作答面板(输入 + 语音 + 提交) ----------
function AnswerPad({ value, onChange, onSubmit, onGiveUp, canReplay, onReplay }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onGiveUp: () => void;
  canReplay?: boolean; onReplay?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Input
        autoFocus
        inputMode="numeric"
        value={value}
        placeholder="键入答案后回车"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
        className="h-14 text-center font-mono-tabular text-2xl"
      />
      <div className="flex items-center gap-2">
        <Button className="flex-1" onClick={onSubmit} disabled={!value.trim()}>提交</Button>
        {canReplay && <Button variant="outline" onClick={onReplay}><Volume2 className="mr-1.5 h-4 w-4" /> 再听一遍</Button>}
      </div>
      <button onClick={onGiveUp} className="text-center text-[11px] text-muted-foreground transition-colors hover:text-destructive">放弃本局</button>
    </div>
  );
}

// ---------- 小组件 ----------
function ConfigItem({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  );
}

function NumInput({ value, min, max, suffix, onCommit }: {
  value: number | null; min: number; max: number; suffix?: string; onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => { setText(value === null ? "" : String(value)); }, [value]);
  const commit = (raw: string) => {
    const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
    if (!isNaN(n)) onCommit(Math.min(max, Math.max(min, n)));
  };
  return (
    <div className="flex items-center gap-1.5">
      <Input
        inputMode="numeric"
        value={text}
        placeholder="自定"
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-7 w-12 rounded-md border-border bg-background px-1 py-0 text-center font-mono-tabular text-[11px] font-medium"
      />
      {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
    </div>
  );
}
