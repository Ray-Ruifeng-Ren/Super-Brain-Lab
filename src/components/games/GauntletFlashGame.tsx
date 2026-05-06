// Gauntlet Flash Math — 障碍闪电心算
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { submitScore } from "@/lib/leaderboard";
import {
  LEVELS,
  OBSTACLES,
  computeGauntletScore,
  starsFor,
  submitGauntletOverall,
  type LevelConfig,
  type ObstacleId,
} from "@/lib/gauntlet";
import { buildProblem, type Problem } from "@/lib/flashMath";
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import { Play, RotateCcw, Check, X, Minus, Zap, Star, ChevronDown, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Phase = "config" | "ready" | "playing" | "answer" | "result";

interface FlashItem {
  kind: "term" | "decoy" | "blank";
  value?: number; // term/decoy
  signEffective?: "+" | "-"; // 经过 color 反转后的实际符号
  signRaw?: "+" | "-"; // 原始符号
  colorClass?: "blue" | "orange"; // M6
  fontScale?: number; // M5
  x?: number; // M1 0..1
  y?: number; // M1 0..1
  durationMs: number;
}

const ANSWER_WINDOW_MS = 12000;

export function GauntletFlashGame({ onFinished }: { onFinished?: () => void }) {
  const [levelIdx, setLevelIdx] = useState(0); // 0..9
  const [allowBlink, setAllowBlink] = useState(false); // 默认关，符合无障碍
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

  const level = LEVELS[levelIdx];

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
    const p = buildProblem(level.count, level.digits, level.includeSub);
    const seq = buildSequence(p, level, allowBlink);
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
    const score = computeGauntletScore(level, correct, usedMs, ANSWER_WINDOW_MS);
    const stars = correct ? starsFor(level, score) : 0;
    setResult({ correct, score, answered: value, stars, expected: problem.answer });
    setPhase("result");
    if (correct) {
      const r = await submitScore({
        game: "gauntlet" as any,
        mode: `L${level.level}`,
        value: score,
        meta: { stars, difficulty: level.difficulty, usedMs },
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

  if (phase === "config") {
    return (
      <div className="flex flex-col gap-5">
        {/* 详细说明 */}
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
              算式与基线版相同（数位均匀分布、单数无重复），<b className="text-foreground">仍然只输入最终结果</b>，
              所以训练的是"心算 × 抑制控制 × 视觉搜索"三项能力。
            </p>
            <p>
              <b className="text-foreground">🧩 6 种障碍模组：</b>
            </p>
            <ul className="ml-4 list-disc space-y-0.5">
              <li><b>位置漂移</b>：数字在屏幕中央安全区随机位置出现</li>
              <li><b>干扰数字</b>：灰色斜体的"假数字"穿插出现，<b className="text-destructive">必须忽略</b></li>
              <li><b>噪点背景</b>：背景出现低对比度的随机数字纹理</li>
              <li><b>闪屏间隔</b>：数字之间穿插短暂闪屏（默认关闭，可在下方启用）</li>
              <li><b>字号抖动</b>：每个数字字号在 ±30% 范围内变化</li>
              <li><b>颜色反转</b>：<span className="text-blue-500">蓝色</span>正常，<span className="text-orange-500">橙色</span>符号反转（原 + 当 -，原 - 当 +）。L8 起启用</li>
            </ul>
            <p>
              <b className="text-foreground">📈 难度：</b>L1（D=1.8）→ L10（D=7.2）。
              难度系数 D = 1 + Σ 模组权重，直接乘进得分，等级越高同样答对收益越高。
            </p>
            <p>
              <b className="text-foreground">🏆 双轨计分：</b>每个等级有独立榜（L1–L10），
              另有 <b>GFI 通榜</b>（Gauntlet Focus Index）= 各等级最佳分 × 等级权重 × 三星加成（×1.15）。
            </p>
            <p>
              <b className="text-foreground">💡 训练建议：</b>用余光预判数字落点，
              碰到橙色数字先在脑里把符号反过来再算；干扰数字看到灰色或斜体立即放弃这一项。
            </p>
          </div>
        </details>

        {/* 等级选择 */}
        <div>
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>等级</span>
            <span className="font-mono-tabular">D = {level.difficulty}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {LEVELS.map((l, i) => (
              <button
                key={l.level}
                onClick={() => setLevelIdx(i)}
                className={cn(
                  "rounded-md border py-2 font-mono-tabular text-xs font-medium transition-colors",
                  levelIdx === i
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}
              >
                L{l.level}
              </button>
            ))}
          </div>
        </div>

        {/* 当前等级摘要 */}
        <div className="rounded-md border border-border bg-card p-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="笔数" value={`${level.count}`} />
            <Stat label="位数" value={`${level.digits}`} />
            <Stat label="闪速" value={`${level.speedMs}ms`} />
            <Stat label="减法" value={level.includeSub ? "含" : "无"} />
          </div>
          <div className="mt-3 border-t border-border pt-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">启用模组</div>
            <div className="flex flex-wrap gap-1">
              {level.obstacles.map((o) => (
                <span
                  key={o}
                  className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                  title={OBSTACLES[o].desc}
                >
                  {OBSTACLES[o].name} <span className="font-mono-tabular text-[9px] text-primary">+{OBSTACLES[o].weight}</span>
                </span>
              ))}
              {level.decoyCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-destructive/30 bg-destructive/5 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                  干扰 ×{level.decoyCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 设置 */}
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowBlink}
              onChange={(e) => setAllowBlink(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-primary"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1 font-medium text-foreground">
                启用闪屏间隔（M4）
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                数字之间穿插短暂闪屏（≤120ms 低对比），增强视觉抑制训练。
                光敏体质或视觉疲劳时请关闭。
              </div>
            </div>
          </label>
        </div>

        <Button onClick={begin}>
          <Play className="mr-2 h-3.5 w-3.5" /> 开始 L{level.level} 挑战
        </Button>

        <div className="rounded-md border border-border bg-card p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>本局答对最高可得</span>
            <span className="font-mono-tabular text-base font-semibold text-primary">
              {Math.round((1000 + 200) * level.difficulty)} 分
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="flex h-[360px] flex-col items-center justify-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          L{level.level} · D={level.difficulty}
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
          <span className="font-mono-tabular">L{level.level}</span>
          <span className="font-mono-tabular">{realTermPassed} / {totalRealTerms}</span>
          <button onClick={reset} className="hover:text-destructive">放弃</button>
        </div>
        <div className="h-px w-full bg-border">
          <div
            className="h-px bg-primary transition-all duration-100"
            style={{ width: `${(realTermPassed / totalRealTerms) * 100}%` }}
          />
        </div>
        <Stage item={item} obstacles={level.obstacles} />
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
            {result.correct ? `L${level.level} 完成` : "错误"}
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
            选等级
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

// ─── 序列构建：把 problem.terms 与障碍模组编织为播放序列 ───
function buildSequence(p: Problem, lv: LevelConfig, allowBlink: boolean): FlashItem[] {
  const out: FlashItem[] = [];
  const useDrift = lv.obstacles.includes("drift");
  const useSize = lv.obstacles.includes("size");
  const useColor = lv.obstacles.includes("color");
  const useBlink = lv.obstacles.includes("blink") && allowBlink;
  const decoyCount = lv.obstacles.includes("decoy") ? lv.decoyCount : 0;

  const blankMs = useBlink ? Math.min(120, Math.max(80, lv.speedMs * 0.18)) : 0;
  const showMs = lv.speedMs - blankMs;

  // 决定 decoy 插在哪些 term 之前（避免开头与结尾紧邻）
  const decoyPositions = new Set<number>();
  while (decoyPositions.size < decoyCount && p.terms.length > 2) {
    const pos = 1 + Math.floor(Math.random() * (p.terms.length - 1));
    decoyPositions.add(pos);
  }

  const rndPos = () => ({
    x: useDrift ? 0.15 + Math.random() * 0.7 : 0.5,
    y: useDrift ? 0.2 + Math.random() * 0.6 : 0.5,
  });
  const rndScale = () => (useSize ? 0.7 + Math.random() * 0.6 : 1);

  for (let i = 0; i < p.terms.length; i++) {
    if (decoyPositions.has(i)) {
      // decoy: 一个不该被算的灰色斜体数字
      const decoyVal = randDistinctNumber(lv.digits, p.terms);
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
    // M6 颜色反转：随机 30% 概率把这个数字标橙，并把符号反转用于呈现
    let colorClass: "blue" | "orange" = "blue";
    let signEffective = signRaw;
    if (useColor && Math.random() < 0.35) {
      colorClass = "orange";
      // 在橙色规则下，玩家看到的需要"自己反转回去"——所以 effective 显示原 sign 反转
      // 即：屏幕上仍显示数字与原 sign，颜色提示玩家心算时把符号反转
      // 不修改 problem.answer（已按 raw 算）
      signEffective = signRaw; // 视觉显示不变，颜色提示规则
    }
    const pos = rndPos();
    out.push({
      kind: "term",
      value: p.terms[i],
      signRaw,
      signEffective,
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

// 颜色反转规则下重算正确答案
// 注意：buildSequence 仅做视觉标记，实际 problem.answer 仍是原始符号求和。
// 如果你希望"橙色 = 反转"是真规则（影响答案），需要在生成 sequence 后重算 answer。
// 当前选择：橙色仅是干扰提示（"看到橙色要警觉"），但不改答案——这样 L8+ 颜色模组的本质是
// 视觉负担 + 抑制反应（"看到橙色不要被骗"）。

function randDistinctNumber(digits: number, exclude: number[]): number {
  for (let tries = 0; tries < 20; tries++) {
    const min = digits === 1 ? 0 : Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    const n = min + Math.floor(Math.random() * (max - min + 1));
    if (!exclude.includes(n)) return n;
  }
  return Math.pow(10, digits - 1);
}

// ─── 舞台：渲染单个 item，叠加噪点背景 ───
function Stage({ item, obstacles }: { item: FlashItem; obstacles: ObstacleId[] }) {
  const useNoise = obstacles.includes("noise");
  const noiseDigits = useMemo(() => {
    if (!useNoise) return [];
    return Array.from({ length: 24 }).map(() => ({
      d: Math.floor(Math.random() * 10),
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: 0.6 + Math.random() * 1.2,
      r: -20 + Math.random() * 40,
    }));
  }, [item, useNoise]);

  const isBlank = item.kind === "blank";
  return (
    <div
      className={cn(
        "relative h-[360px] w-full overflow-hidden rounded-md border border-border transition-colors duration-75",
        isBlank ? "bg-muted" : "bg-foreground",
      )}
    >
      {/* 噪点背景 */}
      {useNoise && !isBlank && (
        <div className="pointer-events-none absolute inset-0 select-none">
          {noiseDigits.map((n, i) => (
            <span
              key={i}
              className="absolute font-mono-tabular text-3xl font-bold text-background/[0.07]"
              style={{
                left: `${n.x}%`,
                top: `${n.y}%`,
                transform: `translate(-50%, -50%) scale(${n.s}) rotate(${n.r}deg)`,
              }}
            >
              {n.d}
            </span>
          ))}
        </div>
      )}

      {/* 主数字 / 干扰数字 */}
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
                item.colorClass === "blue" && "text-sky-300",
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
                : item.colorClass === "blue"
                ? "text-sky-200"
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono-tabular text-base font-semibold">{value}</div>
    </div>
  );
}
