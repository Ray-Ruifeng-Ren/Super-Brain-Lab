// Gauntlet Flash Math — 障碍闪电心算（v3）
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { submitScore } from "@/lib/leaderboard";
import {
  CHAOS_LEVELS,
  CHAOS_ORDER,
  COUNT_OPTIONS,
  DIGIT_OPTIONS,
  SPEED_OPTIONS,
  DEFAULT_GAUNTLET,
  PRESETS,
  computeGauntletScore,
  computeD,
  computeDf,
  computeDc,
  previewMaxScore,
  starsFor,
  encodeMode,
  submitGauntletOverall,
  type GauntletConfig,
  type ChaosLevel,
  type ChaosSpec,
} from "@/lib/gauntlet";
import { buildProblem, type Problem } from "@/lib/flashMath";
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import { Play, RotateCcw, Check, X, Minus, Zap, Star, ChevronDown, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Phase = "config" | "ready" | "playing" | "answer" | "result";

interface FlashItem {
  kind: "term" | "decoy" | "blank";
  value?: number;
  signRaw?: "+" | "-";
  colorClass?: "blue" | "orange";
  fontScale?: number;
  x?: number;
  y?: number;
  durationMs: number;
}

const ANSWER_WINDOW_MS = 12000;

export function GauntletFlashGame({
  onCfgChange,
  onFinished,
}: {
  onCfgChange?: (cfg: GauntletConfig) => void;
  onFinished?: () => void;
}) {
  const [cfg, setCfg] = useState<GauntletConfig>(DEFAULT_GAUNTLET);
  const [phase, setPhase] = useState<Phase>("config");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sequence, setSequence] = useState<FlashItem[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [input, setInput] = useState("");
  const [answerStartAt, setAnswerStartAt] = useState(0);
  const [result, setResult] = useState<{
    correct: boolean;
    score: number;
    answered: number;
    stars: number;
    expected: number;
  } | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => { onCfgChange?.(cfg); }, [cfg, onCfgChange]);

  const chaos = CHAOS_LEVELS[cfg.chaos];
  const Df = computeDf(cfg);
  const Dc = computeDc(cfg.chaos, cfg.blink);
  const D = computeD(cfg);
  const maxScore = previewMaxScore(cfg);

  const updateCfg = (patch: Partial<GauntletConfig>) => setCfg((c) => ({ ...c, ...patch }));

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("config");
    setProblem(null);
    setSequence([]);
    setStepIdx(0);
    setInput("");
    setResult(null);
  };

  const begin = () => {
    const p = buildProblem(cfg.count, cfg.digits, cfg.includeSub);
    const seq = buildSequence(p, cfg, chaos);
    setProblem(p);
    setSequence(seq);
    setStepIdx(0);
    setInput("");
    setResult(null);
    setPhase("ready");
  };

  // countdown
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

  // sequence playback
  useEffect(() => {
    if (phase !== "playing") return;
    if (stepIdx >= sequence.length) {
      setAnswerStartAt(Date.now());
      setPhase("answer");
      return;
    }
    const item = sequence[stepIdx];
    timerRef.current = window.setTimeout(() => setStepIdx((i) => i + 1), item.durationMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, stepIdx, sequence]);

  const submit = async (raw: string) => {
    const value = parseSpokenNumber(raw);
    if (value == null || !problem) return;
    const correct = value === problem.answer;
    const usedMs = Date.now() - answerStartAt;
    const score = computeGauntletScore(cfg, correct, usedMs, ANSWER_WINDOW_MS);
    const stars = correct ? starsFor(cfg, score) : 0;
    setResult({ correct, score, answered: value, stars, expected: problem.answer });
    setPhase("result");
    if (correct) {
      const r = await submitScore({
        game: "gauntlet" as any,
        mode: encodeMode(cfg),
        value: score,
        meta: { stars, D, Df, Dc, usedMs },
      });
      if (r.ok) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) await submitGauntletOverall(u.user.id);
        onFinished?.();
      } else if (r.error === "未登录") {
        toast({ title: "登录后即可上榜", description: "本局成绩未保存到云端。" });
      }
    }
  };

  // ────────────── Render ──────────────

  if (phase === "config") {
    return (
      <div className="flex flex-col gap-5">
        {/* 玩法说明 */}
        <details className="group rounded-md border border-border bg-card/40 p-3 text-xs">
          <summary className="flex cursor-pointer items-center justify-between font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" /> 玩法详细说明
            </span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-2.5 leading-relaxed text-muted-foreground">
            <p>
              <b className="text-foreground">🎯 目标：</b>在视觉/注意力干扰下完成闪电心算。
              算式与基线版相同，<b className="text-foreground">仍只输入最终结果</b>。
            </p>
            <p>
              <b className="text-foreground">⚙️ 自由参数：</b>笔数、位数、闪速、是否含减——按基线闪电心算同款节奏自调。
            </p>
            <p>
              <b className="text-foreground">🧩 三档干扰：</b>
            </p>
            <ul className="ml-4 list-disc space-y-0.5">
              <li><b>低 Mild</b>：位置漂移 + 微弱噪点（×1.4）</li>
              <li><b>中 Strong</b>：+ 字号抖动 + 1 个干扰假数字（×1.9）</li>
              <li><b>强 Chaos</b>：+ 高密度噪点 + 2 干扰 + <span className="text-orange-500">橙色提示</span>（×2.5）</li>
            </ul>
            <p>
              <b className="text-foreground">📊 计分：</b>得分 = (1000 + 速度奖励) × Df × Dc。
              Df 来自算式参数，Dc 来自干扰强度，乘起来一目了然。
            </p>
            <p>
              <b className="text-foreground">🏆 双轨榜：</b>每个具体配置一个独立榜（同配置可比），
              另有 GFI 通榜——汇总你所有配置的最佳分（鼓励多样化训练）。
            </p>
          </div>
        </details>

        {/* 预设 */}
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            一键预设
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setCfg(p.cfg)}
                className="rounded-md border border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* 算式参数 */}
        <div className="space-y-3 rounded-md border border-border bg-card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            算式参数
          </div>
          <ParamRow label="笔数">
            {COUNT_OPTIONS.map((n) => (
              <Chip key={n} active={cfg.count === n} onClick={() => updateCfg({ count: n })}>
                {n}
              </Chip>
            ))}
          </ParamRow>
          <ParamRow label="位数">
            {DIGIT_OPTIONS.map((n) => (
              <Chip key={n} active={cfg.digits === n} onClick={() => updateCfg({ digits: n })}>
                {n}
              </Chip>
            ))}
          </ParamRow>
          <ParamRow label="闪速">
            {SPEED_OPTIONS.map((n) => (
              <Chip key={n} active={cfg.speedMs === n} onClick={() => updateCfg({ speedMs: n })}>
                {n}ms
              </Chip>
            ))}
          </ParamRow>
          <ParamRow label="减法">
            <Chip active={!cfg.includeSub} onClick={() => updateCfg({ includeSub: false })}>纯加</Chip>
            <Chip active={cfg.includeSub} onClick={() => updateCfg({ includeSub: true })}>含减</Chip>
          </ParamRow>
          <div className="flex items-center justify-between border-t border-border pt-2 text-[11px]">
            <span className="text-muted-foreground">算式难度 Df</span>
            <span className="font-mono-tabular font-semibold text-foreground">×{Df.toFixed(2)}</span>
          </div>
        </div>

        {/* 干扰强度 */}
        <div className="space-y-3 rounded-md border border-border bg-card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            干扰强度
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {CHAOS_ORDER.map((id) => {
              const c = CHAOS_LEVELS[id];
              const active = cfg.chaos === id;
              return (
                <button
                  key={id}
                  onClick={() => updateCfg({ chaos: id })}
                  className={cn(
                    "rounded-md border py-2 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  <div>{c.name}</div>
                  <div className="mt-0.5 font-mono-tabular text-[10px] opacity-70">×{c.multiplier}</div>
                </button>
              );
            })}
          </div>
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            {chaos.desc}
          </div>
          <label className="flex items-start gap-2 cursor-pointer border-t border-border pt-2">
            <input
              type="checkbox"
              checked={cfg.blink}
              onChange={(e) => updateCfg({ blink: e.target.checked })}
              className="mt-0.5 h-3.5 w-3.5 accent-primary"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                额外启用闪屏间隔
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span className="ml-1 font-mono-tabular text-[10px] text-primary">+0.20</span>
              </div>
              <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                数字之间穿插短暂闪屏，光敏体质请关闭。
              </div>
            </div>
          </label>
          <div className="flex items-center justify-between border-t border-border pt-2 text-[11px]">
            <span className="text-muted-foreground">干扰系数 Dc</span>
            <span className="font-mono-tabular font-semibold text-foreground">×{Dc.toFixed(2)}</span>
          </div>
        </div>

        {/* 总难度 + 预估分 */}
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">总难度 D = Df × Dc</span>
            <span className="font-mono-tabular text-base font-semibold text-primary">×{D.toFixed(2)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-primary/20 pt-1.5">
            <span className="text-[11px] text-muted-foreground">本局答对最高可得</span>
            <span className="font-mono-tabular text-lg font-semibold text-primary">{maxScore} 分</span>
          </div>
        </div>

        <Button onClick={begin}>
          <Play className="mr-2 h-3.5 w-3.5" /> 开始挑战
        </Button>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="flex h-[360px] flex-col items-center justify-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          {chaos.name} · D=×{D.toFixed(2)}
        </div>
        <div className="font-mono-tabular text-7xl font-semibold text-primary animate-pop-in">GO</div>
        <div className="mt-3 text-xs text-muted-foreground">注意力集中，准备追踪</div>
      </div>
    );
  }

  if (phase === "playing") {
    const item = sequence[stepIdx];
    if (!item) return null;
    const totalRealTerms = sequence.filter((s) => s.kind === "term").length;
    const realTermPassed = sequence.slice(0, stepIdx + 1).filter((s) => s.kind === "term").length;
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono-tabular">{cfg.count}×{cfg.digits} · {cfg.speedMs}ms · {chaos.name}</span>
          <span className="font-mono-tabular">{realTermPassed} / {totalRealTerms}</span>
          <button onClick={reset} className="hover:text-destructive">放弃</button>
        </div>
        <div className="h-px w-full bg-border">
          <div
            className="h-px bg-primary transition-all duration-100"
            style={{ width: `${(realTermPassed / totalRealTerms) * 100}%` }}
          />
        </div>
        <Stage item={item} chaos={chaos} />
      </div>
    );
  }

  if (phase === "answer" && problem) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">输入答案</div>
        <Input
          autoFocus
          inputMode="numeric"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && input.trim() && submit(input)}
          placeholder="键入最终结果"
          className="h-14 max-w-sm rounded-md border-border text-center font-mono-tabular text-2xl"
        />
        <div className="flex w-full max-w-sm gap-2">
          <Button onClick={() => submit(input)} disabled={!input.trim()} className="flex-1">
            提交
          </Button>
        </div>
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
            {result.correct ? "完成" : "错误"}
          </div>
          <div className="mt-0.5 font-mono-tabular text-5xl font-semibold text-foreground">
            {result.correct ? `+${result.score}` : "0"}
          </div>
          {result.correct && (
            <div className="mt-1 flex justify-center gap-0.5">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  className={cn(
                    "h-4 w-4",
                    s <= result.stars ? "fill-primary text-primary" : "text-muted-foreground/30",
                  )}
                />
              ))}
            </div>
          )}
        </div>
        <div className="w-full rounded-md border border-border p-3 text-center">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">正确答案</div>
          <div className="my-0.5 font-mono-tabular text-2xl font-semibold">{result.expected}</div>
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
                return s === "-" ? ` − ${t}` : ` + ${t}`;
              })
              .join("")}
            {" = "}{result.expected}
          </div>
        </div>
        <div className="flex w-full gap-2">
          <Button variant="outline" onClick={reset} className="flex-1" size="sm">
            改参数
          </Button>
          <Button onClick={begin} className="flex-1" size="sm">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 再来一局
          </Button>
        </div>
      </div>
    );
  }
  return null;
}

// ─── 序列构建 ───
function buildSequence(p: Problem, cfg: GauntletConfig, chaos: ChaosSpec): FlashItem[] {
  const out: FlashItem[] = [];
  const useDrift = chaos.obstacles.includes("drift");
  const useSize = chaos.obstacles.includes("size");
  const useColor = chaos.colorReverse;
  const decoyCount = chaos.decoyCount;

  const blankMs = cfg.blink ? Math.min(140, Math.max(80, cfg.speedMs * 0.18)) : 0;
  const showMs = cfg.speedMs - blankMs;

  // 决定 decoy 插在哪些 term 之前（避开开头）
  const decoyPositions = new Set<number>();
  if (p.terms.length > 2) {
    let guard = 0;
    while (decoyPositions.size < decoyCount && guard++ < 50) {
      const pos = 1 + Math.floor(Math.random() * (p.terms.length - 1));
      decoyPositions.add(pos);
    }
  }

  // 安全边距：数字最大字号 96px×1.5 ≈ 144px，舞台高 360px，宽度按数字位数大致同量级。
  // 用 0.18 的归一化内边距，保证整个字形落在框内（即使在最大缩放下）。
  const SAFE_PAD = 0.18;
  const safeRange = Math.min(chaos.driftRange, 1 - SAFE_PAD * 2);
  const safeStart = (1 - safeRange) / 2;
  const rndPos = () => ({
    x: useDrift ? safeStart + Math.random() * safeRange : 0.5,
    y: useDrift ? safeStart + Math.random() * safeRange : 0.5,
  });
  const rndScale = () => (useSize ? 1 - chaos.sizeJitter + Math.random() * chaos.sizeJitter * 2 : 1);

  for (let i = 0; i < p.terms.length; i++) {
    if (decoyPositions.has(i)) {
      const decoyVal = randDistinctNumber(cfg.digits, p.terms);
      const pos = rndPos();
      out.push({
        kind: "decoy",
        value: decoyVal,
        fontScale: rndScale(),
        x: pos.x,
        y: pos.y,
        durationMs: showMs,
      });
      if (blankMs > 0) out.push({ kind: "blank", durationMs: blankMs });
    }
    const signRaw = p.signs[i];
    let colorClass: "blue" | "orange" = "blue";
    if (useColor && Math.random() < 0.35) {
      // 视觉提示：橙色项需要"心算时警觉"——但不改实际答案（保持公平）
      colorClass = "orange";
    }
    const pos = rndPos();
    out.push({
      kind: "term",
      value: p.terms[i],
      signRaw,
      colorClass,
      fontScale: rndScale(),
      x: pos.x,
      y: pos.y,
      durationMs: showMs,
    });
    if (blankMs > 0 && i < p.terms.length - 1) {
      out.push({ kind: "blank", durationMs: blankMs });
    }
  }
  return out;
}

function randDistinctNumber(digits: number, exclude: number[]): number {
  for (let tries = 0; tries < 20; tries++) {
    const min = digits === 1 ? 0 : Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    const n = min + Math.floor(Math.random() * (max - min + 1));
    if (!exclude.includes(n)) return n;
  }
  return Math.pow(10, digits - 1);
}

// ─── 舞台 ───
function Stage({ item, chaos }: { item: FlashItem; chaos: ChaosSpec }) {
  const useNoise = chaos.obstacles.includes("noise");
  const noiseDigits = useMemo(() => {
    if (!useNoise) return [];
    return Array.from({ length: chaos.noiseCount }).map(() => ({
      d: Math.floor(Math.random() * 10),
      x: 6 + Math.random() * 88, // 留 6% 内边距，避免噪点贴边/出框
      y: 8 + Math.random() * 84,
      s: 0.5 + Math.random() * 1.3,
      r: -25 + Math.random() * 50,
    }));
  }, [item, useNoise, chaos.noiseCount]);

  const isBlank = item.kind === "blank";
  return (
    <div
      className={cn(
        "relative h-[360px] w-full overflow-hidden rounded-md border border-border transition-colors duration-75",
        isBlank ? "bg-muted" : "bg-foreground",
      )}
    >
      {useNoise && !isBlank && (
        <div className="pointer-events-none absolute inset-0 select-none">
          {noiseDigits.map((n, i) => (
            <span
              key={i}
              className="absolute font-mono-tabular text-3xl font-bold"
              style={{
                left: `${n.x}%`,
                top: `${n.y}%`,
                color: `hsl(0 0% 100% / ${chaos.noiseOpacity})`,
                transform: `translate(-50%, -50%) scale(${n.s}) rotate(${n.r}deg)`,
              }}
            >
              {n.d}
            </span>
          ))}
        </div>
      )}

      {!isBlank && item.value != null && (
        <div
          className="absolute flex items-center gap-2"
          style={{
            left: `${(item.x ?? 0.5) * 100}%`,
            top: `${(item.y ?? 0.5) * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {item.kind === "term" && item.signRaw === "-" && (
            <Minus
              className={cn(
                "text-background/80",
                item.colorClass === "orange" && "text-orange-400",
              )}
              strokeWidth={3}
              style={{ width: 48 * (item.fontScale ?? 1), height: 48 * (item.fontScale ?? 1) }}
            />
          )}
          <span
            className={cn(
              "font-mono-tabular font-semibold tracking-tight",
              item.kind === "decoy"
                ? "italic text-background/30"
                : item.colorClass === "orange"
                ? "text-orange-400"
                : "text-background",
            )}
            style={{ fontSize: `${(item.fontScale ?? 1) * 96}px`, lineHeight: 1 }}
          >
            {item.value}
          </span>
        </div>
      )}
    </div>
  );
}

function ParamRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 font-mono-tabular text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
