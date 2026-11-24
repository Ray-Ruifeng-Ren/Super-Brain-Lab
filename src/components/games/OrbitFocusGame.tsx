// Orbit Focus — 眼动追踪 × 专注力。
// 多目标追踪（MOT）+ 中央 Stroop / Go-NoGo / 抓拍 三类挑战事件。
// 10 级阶梯难度；接入双轨榜单（Lk 独立 + overall 通榜）。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { submitScore, submitOrbitOverall, ORBIT_LEVEL_WEIGHTS } from "@/lib/leaderboard";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { getLang } from "@/lib/langState";

// 英文界面(2026-10-27):L(中文, 英文) 按当前语言取;主组件 useI18n() 订阅语言,切换即重渲染
const L = (zh: string, en: string) => (getLang() === "en" ? en : zh);

type Phase = "idle" | "marking" | "tracking" | "snapshot" | "stroop" | "gonogo" | "result";
type EventKind = "snapshot" | "stroop" | "gonogo";

interface Dot {
  id: number;
  isTarget: boolean;
  // 轨道：圆周 (cx, cy, r) 上以 angle + speed*t 移动
  cx: number;
  cy: number;
  r: number;
  angle: number; // rad
  speed: number; // rad/s（带方向）
}

interface LevelCfg {
  level: number;
  total: number;
  targets: number;
  speed: number; // rad/s
  trackingMs: number;
  events: EventKind[];
  orbits: number; // 轨道数（同心圆/交错）
  flicker?: boolean; // L8+ 偶尔淡出
}

const LEVELS: LevelCfg[] = [
  { level: 1, total: 4, targets: 1, speed: 0.5, trackingMs: 18000, events: [], orbits: 1 },
  { level: 2, total: 5, targets: 2, speed: 0.6, trackingMs: 20000, events: ["snapshot"], orbits: 1 },
  { level: 3, total: 6, targets: 2, speed: 0.8, trackingMs: 22000, events: ["snapshot"], orbits: 2 },
  { level: 4, total: 7, targets: 3, speed: 0.9, trackingMs: 24000, events: ["snapshot", "gonogo"], orbits: 2 },
  { level: 5, total: 8, targets: 3, speed: 1.05, trackingMs: 26000, events: ["snapshot", "gonogo", "stroop"], orbits: 2 },
  { level: 6, total: 9, targets: 3, speed: 1.2, trackingMs: 28000, events: ["snapshot", "gonogo", "stroop"], orbits: 3 },
  { level: 7, total: 10, targets: 4, speed: 1.4, trackingMs: 30000, events: ["snapshot", "gonogo", "stroop"], orbits: 3 },
  { level: 8, total: 11, targets: 4, speed: 1.6, trackingMs: 32000, events: ["snapshot", "gonogo", "stroop"], orbits: 3, flicker: true },
  { level: 9, total: 12, targets: 5, speed: 1.8, trackingMs: 34000, events: ["snapshot", "gonogo", "stroop"], orbits: 3, flicker: true },
  { level: 10, total: 14, targets: 5, speed: 2.1, trackingMs: 36000, events: ["snapshot", "gonogo", "stroop"], orbits: 3, flicker: true },
];

// 中央事件之间的间隔
const EVENT_INTERVAL_MS = 4500;
const SNAPSHOT_WINDOW_MS = 2200;
const GONOGO_WINDOW_MS = 1100;
const STROOP_WINDOW_MS = 2200;
const MARKING_MS = 2200;

// 颜色（绑定 HSL 主题但事件用真实色名 → 必要时用内联色保证 Stroop 准确）
const STROOP_COLORS = [
  { name: "红", hex: "#ef4444" },
  { name: "蓝", hex: "#3b82f6" },
  { name: "绿", hex: "#22c55e" },
  { name: "黄", hex: "#eab308" },
];

// Stroop 颜色名:内部按中文 name 判对错,只在显示时换英文
const COLOR_EN: Record<string, string> = { 红: "Red", 蓝: "Blue", 绿: "Green", 黄: "Yellow" };
const colorLabel = (name: string) => (getLang() === "en" ? COLOR_EN[name] ?? name : name);

const W = 560;
const H = 420;
const CENTER = { x: W / 2, y: H / 2 };

function buildDots(cfg: LevelCfg): Dot[] {
  const radii = [];
  for (let i = 0; i < cfg.orbits; i++) {
    radii.push(110 + i * 55);
  }
  const dots: Dot[] = [];
  const ids = Array.from({ length: cfg.total }, (_, i) => i);
  // 随机分配 target
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  const targetSet = new Set(shuffled.slice(0, cfg.targets));
  for (let i = 0; i < cfg.total; i++) {
    const orbitIdx = i % cfg.orbits;
    const r = radii[orbitIdx];
    const angle = (i / cfg.total) * Math.PI * 2 + Math.random() * 0.4;
    const dir = Math.random() < 0.5 ? -1 : 1;
    dots.push({
      id: i,
      isTarget: targetSet.has(i),
      cx: CENTER.x,
      cy: CENTER.y,
      r,
      angle,
      speed: cfg.speed * dir * (0.85 + Math.random() * 0.3),
    });
  }
  return dots;
}

function computeStars(accuracy: number, avgRt: number): 0 | 1 | 2 | 3 {
  if (accuracy >= 0.9 && avgRt <= 600) return 3;
  if (accuracy >= 0.75 && avgRt <= 800) return 2;
  if (accuracy >= 0.5) return 1;
  return 0;
}

interface EventResult {
  kind: EventKind;
  correct: boolean;
  rt: number; // ms
}

export function OrbitFocusGame({ onFinished }: { onFinished?: () => void }) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [levelIdx, setLevelIdx] = useState(0);
  const cfg = LEVELS[levelIdx];

  const [phase, setPhase] = useState<Phase>("idle");
  const [dots, setDots] = useState<Dot[]>([]);
  const dotsRef = useRef<Dot[]>([]);
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const phaseStartRef = useRef<number>(0);

  const [events, setEvents] = useState<EventResult[]>([]);
  const eventsRef = useRef<EventResult[]>([]);

  const [snapshotPicks, setSnapshotPicks] = useState<Set<number>>(new Set());
  const [stroopPrompt, setStroopPrompt] = useState<{ word: string; color: string; correctName: string } | null>(null);
  const [gonogoPrompt, setGonogoPrompt] = useState<"go" | "nogo" | null>(null);
  const eventStartRef = useRef<number>(0);
  const trackingEndRef = useRef<number>(0);
  const nextEventAtRef = useRef<number>(0);

  const [result, setResult] = useState<null | {
    score: number;
    accuracy: number;
    avgRt: number;
    stars: 0 | 1 | 2 | 3;
    pfi?: number;
  }>(null);

  // 同步 ref
  useEffect(() => { dotsRef.current = dots; }, [dots]);
  useEffect(() => { eventsRef.current = events; }, [events]);

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopRaf();
    setPhase("idle");
    setDots([]);
    setEvents([]);
    setSnapshotPicks(new Set());
    setStroopPrompt(null);
    setGonogoPrompt(null);
    setResult(null);
  }, [stopRaf]);

  useEffect(() => () => stopRaf(), [stopRaf]);

  // 主循环：推进角度 + 调度事件
  useEffect(() => {
    if (phase !== "tracking" && phase !== "snapshot" && phase !== "stroop" && phase !== "gonogo" && phase !== "marking") return;
    lastTsRef.current = performance.now();
    const loop = (ts: number) => {
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      // 标记阶段不动；其他阶段都动
      if (phase !== "marking") {
        const next = dotsRef.current.map((d) => ({ ...d, angle: d.angle + d.speed * dt }));
        dotsRef.current = next;
        setTick((t) => (t + 1) % 1_000_000);
      }
      // 调度事件（仅在 tracking 阶段）
      if (phase === "tracking") {
        if (ts >= trackingEndRef.current) {
          finishRound();
          return;
        }
        if (cfg.events.length > 0 && ts >= nextEventAtRef.current) {
          triggerRandomEvent();
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => stopRaf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startGame = useCallback(() => {
    const fresh = buildDots(cfg);
    setDots(fresh);
    dotsRef.current = fresh;
    setEvents([]);
    eventsRef.current = [];
    setResult(null);
    setPhase("marking");
    phaseStartRef.current = performance.now();
    // 标记阶段结束 → 进入 tracking
    setTimeout(() => {
      setPhase("tracking");
      const now = performance.now();
      trackingEndRef.current = now + cfg.trackingMs;
      nextEventAtRef.current = now + EVENT_INTERVAL_MS * (0.6 + Math.random() * 0.4);
    }, MARKING_MS);
  }, [cfg]);

  const triggerRandomEvent = useCallback(() => {
    const kind = cfg.events[Math.floor(Math.random() * cfg.events.length)];
    eventStartRef.current = performance.now();
    nextEventAtRef.current = performance.now() + EVENT_INTERVAL_MS * (0.8 + Math.random() * 0.6);
    if (kind === "snapshot") {
      setSnapshotPicks(new Set());
      setPhase("snapshot");
      setTimeout(() => {
        if (snapshotPicksRef.current.size === 0) {
          // 超时未答 → 算错
          recordEvent("snapshot", false, SNAPSHOT_WINDOW_MS);
        }
        backToTracking();
      }, SNAPSHOT_WINDOW_MS);
    } else if (kind === "stroop") {
      const wordIdx = Math.floor(Math.random() * STROOP_COLORS.length);
      let colorIdx = Math.floor(Math.random() * STROOP_COLORS.length);
      if (colorIdx === wordIdx) colorIdx = (colorIdx + 1) % STROOP_COLORS.length;
      setStroopPrompt({
        word: STROOP_COLORS[wordIdx].name,
        color: STROOP_COLORS[colorIdx].hex,
        correctName: STROOP_COLORS[colorIdx].name, // 正确答案 = 字的颜色名
      });
      setPhase("stroop");
      setTimeout(() => {
        if (stroopAnsweredRef.current === false) {
          recordEvent("stroop", false, STROOP_WINDOW_MS);
        }
        stroopAnsweredRef.current = false;
        setStroopPrompt(null);
        backToTracking();
      }, STROOP_WINDOW_MS);
    } else if (kind === "gonogo") {
      const isGo = Math.random() < 0.65;
      setGonogoPrompt(isGo ? "go" : "nogo");
      setPhase("gonogo");
      setTimeout(() => {
        if (gonogoAnsweredRef.current === false) {
          // 超时：Go 算错，NoGo 算对
          recordEvent("gonogo", !isGo, GONOGO_WINDOW_MS);
        }
        gonogoAnsweredRef.current = false;
        setGonogoPrompt(null);
        backToTracking();
      }, GONOGO_WINDOW_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  const snapshotPicksRef = useRef<Set<number>>(new Set());
  useEffect(() => { snapshotPicksRef.current = snapshotPicks; }, [snapshotPicks]);
  const stroopAnsweredRef = useRef(false);
  const gonogoAnsweredRef = useRef(false);

  const backToTracking = useCallback(() => {
    if (performance.now() >= trackingEndRef.current) {
      finishRound();
      return;
    }
    setPhase("tracking");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordEvent = useCallback((kind: EventKind, correct: boolean, rt: number) => {
    const ev: EventResult = { kind, correct, rt };
    eventsRef.current = [...eventsRef.current, ev];
    setEvents(eventsRef.current);
  }, []);

  // —— 抓拍：玩家点击场上圆点 ——
  const handleDotClick = useCallback((d: Dot) => {
    if (phase !== "snapshot") return;
    if (snapshotPicksRef.current.has(d.id)) return;
    const next = new Set(snapshotPicksRef.current);
    next.add(d.id);
    setSnapshotPicks(next);
    snapshotPicksRef.current = next;
    // 是否凑齐所有 target
    const targetIds = dotsRef.current.filter((x) => x.isTarget).map((x) => x.id);
    const allTargetsPicked = targetIds.every((id) => next.has(id));
    if (allTargetsPicked) {
      const wrong = [...next].some((id) => !targetIds.includes(id));
      const correct = !wrong && next.size === targetIds.length;
      const rt = performance.now() - eventStartRef.current;
      recordEvent("snapshot", correct, rt);
      setSnapshotPicks(new Set());
      snapshotPicksRef.current = new Set();
      backToTracking();
    } else if (!dotsRef.current.find((x) => x.id === d.id)?.isTarget) {
      // 点错非目标 → 立刻算错并回到追踪
      const rt = performance.now() - eventStartRef.current;
      recordEvent("snapshot", false, rt);
      setSnapshotPicks(new Set());
      snapshotPicksRef.current = new Set();
      backToTracking();
    }
  }, [phase, recordEvent, backToTracking]);

  // —— Stroop 选答 ——
  const handleStroopAnswer = useCallback((name: string) => {
    if (phase !== "stroop" || !stroopPrompt) return;
    stroopAnsweredRef.current = true;
    const rt = performance.now() - eventStartRef.current;
    recordEvent("stroop", name === stroopPrompt.correctName, rt);
    setStroopPrompt(null);
    backToTracking();
  }, [phase, stroopPrompt, recordEvent, backToTracking]);

  // —— Go/NoGo ——
  const handleGo = useCallback(() => {
    if (phase !== "gonogo" || !gonogoPrompt) return;
    gonogoAnsweredRef.current = true;
    const rt = performance.now() - eventStartRef.current;
    recordEvent("gonogo", gonogoPrompt === "go", rt);
    setGonogoPrompt(null);
    backToTracking();
  }, [phase, gonogoPrompt, recordEvent, backToTracking]);

  const finishRound = useCallback(async () => {
    stopRaf();
    setPhase("result");
    const evs = eventsRef.current;
    const correctCount = evs.filter((e) => e.correct).length;
    const accuracy = evs.length === 0 ? 1 : correctCount / evs.length;
    const avgRt = evs.length === 0 ? 800 : evs.reduce((a, e) => a + e.rt, 0) / evs.length;
    const speedFactor = Math.min(1.6, Math.max(0.4, 500 / Math.max(avgRt, 200)));
    const allCorrect = evs.length > 0 && correctCount === evs.length;
    const eventBonus = allCorrect ? 1.2 : 1;
    const levelMul = ORBIT_LEVEL_WEIGHTS[cfg.level - 1];
    const raw = 1000 * Math.pow(accuracy, 1.5) * speedFactor * eventBonus;
    const score = Math.round(raw * levelMul);
    const stars = computeStars(accuracy, avgRt);

    let pfi: number | undefined;
    if (user) {
      const r = await submitScore({
        game: "orbit",
        mode: `L${cfg.level}`,
        value: score,
        meta: { accuracy, avgRt, stars, level: cfg.level, events: evs.length },
      });
      if (r.ok) {
        pfi = await submitOrbitOverall(user.id);
        toast.success(`${L(`本局 ${score} 分`, `Score ${score}`)} · ${"★".repeat(stars)}${"☆".repeat(3 - stars)}`);
      }
    }
    setResult({ score, accuracy, avgRt, stars, pfi });
    onFinished?.();
  }, [cfg, stopRaf, user, onFinished]);

  // —— 渲染 ——
  const positionedDots = useMemo(() => {
    return dotsRef.current.map((d) => {
      const x = d.cx + Math.cos(d.angle) * d.r;
      const y = d.cy + Math.sin(d.angle) * d.r;
      return { ...d, x, y };
    });
    // tick 用作触发，函数本身依赖 dotsRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, phase]);

  const showTargetHint = phase === "marking";
  const dimNonTarget = phase === "marking";

  return (
    <div className="space-y-5">
      {/* 难度选择 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{L("等级", "Level")}</span>
        {LEVELS.map((l, i) => (
          <button
            key={l.level}
            onClick={() => { if (phase === "idle" || phase === "result") { setLevelIdx(i); reset(); } }}
            disabled={phase !== "idle" && phase !== "result"}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono-tabular text-xs font-medium transition-colors",
              levelIdx === i
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            L{l.level}
          </button>
        ))}
      </div>

      {/* 配置摘要 */}
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Stat label={L("圆点", "Dots")} value={`${cfg.total}`} />
        <Stat label={L("目标", "Targets")} value={`${cfg.targets}`} />
        <Stat label={L("时长", "Duration")} value={`${Math.round(cfg.trackingMs / 1000)}s`} />
        <Stat label={L("权重", "Weight")} value={`×${ORBIT_LEVEL_WEIGHTS[cfg.level - 1].toFixed(1)}`} />
      </div>

      {/* 画布 */}
      <div className="relative mx-auto overflow-hidden rounded-md border border-border bg-card" style={{ width: W, maxWidth: "100%", aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
          {/* 轨道虚线（标记 + 追踪初期可见） */}
          {(phase === "marking" || phase === "idle") && Array.from({ length: cfg.orbits }).map((_, i) => (
            <circle
              key={i}
              cx={CENTER.x}
              cy={CENTER.y}
              r={110 + i * 55}
              fill="none"
              stroke="hsl(var(--border))"
              strokeDasharray="3 6"
              strokeWidth={1}
              opacity={0.7}
            />
          ))}

          {/* 圆点 */}
          {positionedDots.map((d) => {
            const target = d.isTarget;
            const showTarget = showTargetHint && target;
            const isPicked = snapshotPicks.has(d.id);
            const flick = cfg.flicker && phase === "tracking" ? 0.55 + 0.45 * Math.abs(Math.sin((tick + d.id * 13) * 0.05)) : 1;
            return (
              <g key={d.id} onClick={() => handleDotClick(d)} style={{ cursor: phase === "snapshot" ? "pointer" : "default" }}>
                {showTarget && (
                  <circle cx={d.x} cy={d.y} r={20} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} opacity={0.9} />
                )}
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={14}
                  fill={
                    showTarget
                      ? "hsl(var(--primary))"
                      : isPicked
                        ? "hsl(var(--primary))"
                        : "hsl(var(--foreground))"
                  }
                  opacity={dimNonTarget && !target ? 0.45 : flick}
                />
              </g>
            );
          })}

          {/* 抓拍提示 */}
          {phase === "snapshot" && (
            <g>
              <rect x={0} y={0} width={W} height={H} fill="hsl(var(--primary))" opacity={0.04} />
              <text x={CENTER.x} y={28} textAnchor="middle" fontSize={14} fontWeight={700} fill="hsl(var(--primary))" letterSpacing={3}>
                {L("STOP · 点出所有目标", "STOP · tap all targets")}
              </text>
            </g>
          )}
        </svg>

        {/* Stroop 中央覆盖层 */}
        {phase === "stroop" && stroopPrompt && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{L("这个字 · 是什么颜色", "What color is this word?")}</div>
            <div className="mt-2 font-display text-6xl font-bold" style={{ color: stroopPrompt.color }}>
              {colorLabel(stroopPrompt.word)}
            </div>
            <div className="mt-4 flex gap-2">
              {STROOP_COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => handleStroopAnswer(c.name)}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium transition-transform hover:scale-105"
                  style={{ color: c.hex }}
                >
                  {colorLabel(c.name)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Go/NoGo */}
        {phase === "gonogo" && gonogoPrompt && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{L("看到 ✓ 立即点击 · ✗ 不要动", "✓ tap now · ✗ don't move")}</div>
            <button
              onClick={handleGo}
              className="mt-3 flex h-24 w-24 items-center justify-center rounded-full border-2 border-border bg-card font-display text-5xl font-bold transition-transform active:scale-95"
              style={{ color: gonogoPrompt === "go" ? "#22c55e" : "#ef4444" }}
            >
              {gonogoPrompt === "go" ? "✓" : "✗"}
            </button>
          </div>
        )}

        {/* 结果 */}
        {phase === "result" && result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{L("本局得分", "Score")}</div>
            <div className="mt-1 font-mono-tabular text-5xl font-bold text-primary">{result.score}</div>
            <div className="mt-1 text-2xl tracking-wider" style={{ color: "hsl(var(--primary))" }}>
              {"★".repeat(result.stars)}<span className="text-muted-foreground/40">{"★".repeat(3 - result.stars)}</span>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span>{L("准确率", "Accuracy")} {Math.round(result.accuracy * 100)}%</span>
              <span>{L("平均反应", "Avg reaction")} {Math.round(result.avgRt)}ms</span>
            </div>
            {result.pfi !== undefined && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                <Trophy className="h-3 w-3" /> PFI {result.pfi}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => { reset(); startGame(); }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                {L("再来一局", "Play again")}
              </button>
              {levelIdx < LEVELS.length - 1 && result.stars >= 2 && (
                <button
                  onClick={() => { setLevelIdx(levelIdx + 1); reset(); }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium"
                >
                  {L("下一等级 →", "Next level →")}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95">
            <Target className="h-8 w-8 text-primary" />
            <h3 className="mt-3 font-display text-xl">L{cfg.level} · {L("轨道追焦", "Orbit Focus")}</h3>
            <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
              {L(`先记住高亮的 ${cfg.targets} 个目标，开始后用眼睛盯住它们，并应对中央出现的挑战。`, `Memorize the ${cfg.targets} highlighted targets, then track them with your eyes and respond to challenges in the center.`)}
            </p>
            <button
              onClick={startGame}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5" /> {L("开始", "Start")}
            </button>
          </div>
        )}

        {phase === "marking" && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            {L("记住高亮目标", "Memorize the highlighted targets")}
          </div>
        )}
      </div>

      {/* 实时计数 */}
      {(phase === "tracking" || phase === "snapshot" || phase === "stroop" || phase === "gonogo") && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {L("事件", "Events")} {events.length} · {L("命中", "Hits")} {events.filter((e) => e.correct).length}
          </span>
          <button
            onClick={() => { reset(); }}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Square className="h-3 w-3" /> {L("中止", "Stop")}
          </button>
        </div>
      )}

      {!user && (
        <p className="text-center text-[11px] text-muted-foreground">{L("登录后成绩自动同步到独立等级榜与 PFI 通榜", "Log in to sync scores to the per-level boards and the PFI overall board")}</p>
      )}

      {/* 详细玩法说明 */}
      <details className="group rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
        <summary className="flex cursor-pointer items-center justify-between font-medium text-foreground">
          <span className="inline-flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> {L("玩法详细说明", "How to play")}
          </span>
          <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">▾</span>
        </summary>

        {lang === "en" ? <OrbitHelpEn /> : (
        <div className="mt-4 space-y-5 text-[13px] leading-relaxed text-muted-foreground">
          <section>
            <h4 className="mb-1 font-semibold text-foreground">🎯 游戏目标</h4>
            <p>
              在多个圆点沿轨道高速运动时，<strong className="text-foreground">用眼睛持续追踪被高亮的目标点</strong>，
              并在中央随机弹出的"挑战"中做出正确反应。这是融合
              <strong className="text-foreground">眼动训练（Saccade / Smooth Pursuit）</strong>与
              <strong className="text-foreground">持续性专注力（Sustained Attention）</strong>的训练。
            </p>
          </section>

          <section>
            <h4 className="mb-1 font-semibold text-foreground">🕹 游戏流程</h4>
            <ol className="ml-5 list-decimal space-y-1">
              <li><strong className="text-foreground">记忆阶段</strong>：开始后约 2 秒，部分圆点会高亮——记住它们就是你的"目标"。</li>
              <li><strong className="text-foreground">追踪阶段</strong>：所有点恢复同色并沿轨道运动，请用眼睛盯住目标点（不要用鼠标跟）。</li>
              <li><strong className="text-foreground">挑战事件</strong>：中央会不定时弹出三种挑战之一，需立刻反应。</li>
              <li><strong className="text-foreground">结算</strong>：一局结束后给出得分、命中率、平均反应时与星级。</li>
            </ol>
          </section>

          <section>
            <h4 className="mb-2 font-semibold text-foreground">⚡ 三种挑战事件</h4>
            <div className="space-y-2">
              <div className="rounded-md border border-border bg-background/40 p-2.5">
                <div className="font-medium text-foreground">📸 Snapshot · 抓拍</div>
                <p className="mt-0.5">所有点突然停止，请<strong>点击你认为是目标的所有点</strong>。点错或漏点都会扣分。</p>
              </div>
              <div className="rounded-md border border-border bg-background/40 p-2.5">
                <div className="font-medium text-foreground">🎨 Stroop · 色词冲突</div>
                <p className="mt-0.5">中央弹出一个用彩色显示的颜色文字（例如红色字写着"蓝"），请选择
                  <strong>"字的颜色"</strong>而不是字本身的含义。</p>
              </div>
              <div className="rounded-md border border-border bg-background/40 p-2.5">
                <div className="font-medium text-foreground">✓✗ Go / NoGo · 抑制控制</div>
                <p className="mt-0.5">看到 <strong>✓</strong> 立刻点击；看到 <strong>✗</strong> 千万<strong>不要点</strong>，等它消失。误点扣分。</p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="mb-1 font-semibold text-foreground">📈 难度与机制（L1–L10）</h4>
            <ul className="ml-5 list-disc space-y-1">
              <li>等级越高：<strong className="text-foreground">轨道更多、点更多、目标更多、速度更快</strong>。</li>
              <li>L4 起加入 <strong>方向反转</strong>，L6 起加入 <strong>闪烁干扰</strong>，L8 起轨道之间会<strong>交叉重叠</strong>。</li>
              <li>每级挑战频率与时间窗口都会逐级压缩，请逐级解锁，不建议直接挑战 L10。</li>
            </ul>
          </section>

          <section>
            <h4 className="mb-1 font-semibold text-foreground">🏆 双轨计分</h4>
            <ul className="ml-5 list-disc space-y-1">
              <li><strong className="text-foreground">独立榜（L1–L10）</strong>：每个难度独立一个排行榜，比拼单局极限。</li>
              <li><strong className="text-foreground">PFI 通榜（Personal Focus Index）</strong>：取你每个等级的最佳成绩
                <em>加权求和</em>，等级越高权重越大。想冲通榜必须每级都打高，刷低难度无效。</li>
              <li>三星成绩会获得额外 <strong>×1.15</strong> 的 PFI 加成。</li>
            </ul>
          </section>

          <section>
            <h4 className="mb-1 font-semibold text-foreground">💡 训练建议</h4>
            <ul className="ml-5 list-disc space-y-1">
              <li>视线放在屏幕中央偏后位置，<strong>用余光感知运动</strong>，不要追着单个点转头。</li>
              <li>挑战弹出时优先反应中央事件，再迅速回到外周追踪——这是核心训练点。</li>
              <li>每天 5–10 分钟、每次 3–5 局即可，疲劳时不要硬冲高难度。</li>
            </ul>
          </section>
        </div>
        )}
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="font-mono-tabular text-sm font-semibold">{value}</div>
    </div>
  );
}

// 玩法说明(英文版,内容与中文版一致)
function OrbitHelpEn() {
  return (
    <div className="mt-4 space-y-5 text-[13px] leading-relaxed text-muted-foreground">
      <section>
        <h4 className="mb-1 font-semibold text-foreground">🎯 Goal</h4>
        <p>
          While dots race around their orbits, <strong className="text-foreground">keep your eyes on the highlighted targets</strong>,
          and respond correctly to the “challenges” that pop up in the center. It combines
          <strong className="text-foreground"> eye-movement training (saccades / smooth pursuit)</strong> with
          <strong className="text-foreground"> sustained attention</strong>.
        </p>
      </section>
      <section>
        <h4 className="mb-1 font-semibold text-foreground">🕹 How a round works</h4>
        <ol className="ml-5 list-decimal space-y-1">
          <li><strong className="text-foreground">Memorize</strong>: for about 2 seconds some dots are highlighted. Those are your targets.</li>
          <li><strong className="text-foreground">Track</strong>: all dots turn the same color and move along their orbits. Follow the targets with your eyes (not the mouse).</li>
          <li><strong className="text-foreground">Challenges</strong>: one of three challenges pops up in the center at random. React right away.</li>
          <li><strong className="text-foreground">Results</strong>: after the round you get a score, hit rate, average reaction time and stars.</li>
        </ol>
      </section>
      <section>
        <h4 className="mb-2 font-semibold text-foreground">⚡ Three challenges</h4>
        <div className="space-y-2">
          <div className="rounded-md border border-border bg-background/40 p-2.5">
            <div className="font-medium text-foreground">📸 Snapshot</div>
            <p className="mt-0.5">All dots freeze. <strong>Tap every dot you think is a target</strong>. Wrong or missed taps cost points.</p>
          </div>
          <div className="rounded-md border border-border bg-background/40 p-2.5">
            <div className="font-medium text-foreground">🎨 Stroop</div>
            <p className="mt-0.5">A color word appears in a different color (e.g. “Blue” written in red). Pick
              <strong> the color of the ink</strong>, not what the word says.</p>
          </div>
          <div className="rounded-md border border-border bg-background/40 p-2.5">
            <div className="font-medium text-foreground">✓✗ Go / NoGo</div>
            <p className="mt-0.5">See <strong>✓</strong>: tap at once. See <strong>✗</strong>: <strong>don't tap</strong>, wait for it to disappear. Wrong taps cost points.</p>
          </div>
        </div>
      </section>
      <section>
        <h4 className="mb-1 font-semibold text-foreground">📈 Levels (L1–L10)</h4>
        <ul className="ml-5 list-disc space-y-1">
          <li>Higher levels: <strong className="text-foreground">more orbits, more dots, more targets, more speed</strong>.</li>
          <li>From L4 dots <strong>reverse direction</strong>, from L6 they <strong>flicker</strong>, and from L8 orbits <strong>cross and overlap</strong>.</li>
          <li>Challenges come faster with shorter windows at every level. Unlock levels in order; jumping straight to L10 isn't recommended.</li>
        </ul>
      </section>
      <section>
        <h4 className="mb-1 font-semibold text-foreground">🏆 Two leaderboards</h4>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong className="text-foreground">Level boards (L1–L10)</strong>: one board per level for your best single round.</li>
          <li><strong className="text-foreground">PFI overall (Personal Focus Index)</strong>: a <em>weighted sum</em> of your best score at each level; higher levels weigh more. To climb it you need strong scores on every level; farming easy levels won't work.</li>
          <li>Three-star rounds earn an extra <strong>×1.15</strong> PFI bonus.</li>
        </ul>
      </section>
      <section>
        <h4 className="mb-1 font-semibold text-foreground">💡 Tips</h4>
        <ul className="ml-5 list-disc space-y-1">
          <li>Rest your gaze slightly behind the center and <strong>use peripheral vision</strong>. Don't chase single dots with your head.</li>
          <li>When a challenge pops up, handle the center first, then return to tracking. That switch is the core skill.</li>
          <li>5–10 minutes a day, 3–5 rounds a session is plenty. Don't push hard levels when tired.</li>
        </ul>
      </section>
    </div>
  );
}
