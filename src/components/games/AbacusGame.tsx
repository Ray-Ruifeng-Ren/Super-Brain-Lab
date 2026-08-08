import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Play, RotateCcw, Minus, Plus, Volume2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { submitScore } from "@/lib/leaderboard";
import { logAttempt, fetchWrongAttempts } from "@/lib/practiceLog";
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import type { Problem } from "@/lib/flashMath";
import {
  buildAbacusProblem, previewScore, computeScore, abacusMode, numberToCN,
  DEFAULT_ABACUS_CFG, type AbacusCfg, type AbacusMode, type AddSubType,
} from "@/lib/abacus";

// ============ 童趣配色(晴空蓝 / 草地绿 / 阳光橙,借鉴洛克王国的明亮感) ============
const T = {
  sky: "#3FB8F5", skyD: "#1F9BE0",
  grass: "#6DBE45", grassD: "#54A331",
  sun: "#FFB01F", sunD: "#F59300",
  coral: "#FF7A4D", coralD: "#EF5C2B",
  grape: "#9B87F5", grapeD: "#7B63E8",
  cream: "#FFF8EC", card: "#FFFFFF",
  line: "#F1DEBB", ink: "#4B3A28", inkSoft: "#B39A78",
};
const STAGE = "#233251";

const candyBtn = (bg: string, bgD: string): CSSProperties => ({
  background: `linear-gradient(180deg, ${bg}, ${bgD})`,
  color: "#fff", border: "none", borderRadius: 999,
  boxShadow: `0 5px 0 ${bgD}, 0 10px 18px ${bgD}44`,
  fontWeight: 800, cursor: "pointer",
});

type Phase = "config" | "ready" | "playing" | "answer" | "result";

const CFG_KEY = "abacus:lastCfg";
const COUNT_PRESETS = [5, 10, 15, 20, 30];
const SPEED_PRESETS = [
  { label: "0.1秒", value: 100 }, { label: "0.3秒", value: 300 },
  { label: "0.5秒", value: 500 }, { label: "1秒", value: 1000 }, { label: "1.5秒", value: 1500 },
];
const LISTEN_PRESETS = [
  { label: "常规语速", value: 1 }, { label: "较快语速", value: 2 }, { label: "极快语速", value: 3 },
];
const ADDSUB_OPTIONS: { id: AddSubType; label: string }[] = [
  { id: "add", label: "纯加" }, { id: "sub", label: "纯减" }, { id: "mix", label: "加减混合" },
];
const MODES: { id: AbacusMode; label: string; sub: string; emoji: string; c: string; cD: string }[] = [
  { id: "flash", label: "闪算", sub: "逐笔闪现", emoji: "⚡", c: T.sun, cD: T.sunD },
  { id: "glance", label: "看算", sub: "竖式同现", emoji: "👀", c: T.grass, cD: T.grassD },
  { id: "listen", label: "听算", sub: "语音报数", emoji: "🔊", c: T.sky, cD: T.skyD },
];

function clampCfg(c: Partial<AbacusCfg>): AbacusCfg {
  const m = c.mode === "glance" || c.mode === "listen" ? c.mode : "flash";
  const addsub: AddSubType = c.addsub === "add" || c.addsub === "sub" ? c.addsub : "mix";
  const minD = Math.min(9, Math.max(1, Math.round(c.minDigits ?? DEFAULT_ABACUS_CFG.minDigits)));
  const maxD = Math.min(9, Math.max(minD, Math.round(c.maxDigits ?? DEFAULT_ABACUS_CFG.maxDigits)));
  const count = Math.min(200, Math.max(1, Math.round(c.count ?? DEFAULT_ABACUS_CFG.count)));
  return {
    mode: m,
    count,
    minDigits: minD,
    maxDigits: maxD,
    speedMs: Math.min(5000, Math.max(100, Math.round(c.speedMs ?? DEFAULT_ABACUS_CFG.speedMs))),
    flashBatch: Math.min(count, Math.max(1, Math.round(c.flashBatch ?? DEFAULT_ABACUS_CFG.flashBatch))),
    listenLevel: Math.min(3, Math.max(1, Math.round(c.listenLevel ?? DEFAULT_ABACUS_CFG.listenLevel))),
    addsub,
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
    u.rate = level >= 3 ? 1.7 : level === 2 ? 1.35 : 1.0; // 常规/较快/极快
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
    setTimeout(resolve, 4000);
  });
}

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
      toast({ title: "还没有错题哦", description: "先做几题、或关掉「只练错题」开关～" });
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
      setPhase(cfg.mode === "glance" ? "answer" : "playing");
      return;
    }
    timerRef.current = setTimeout(() => setCountdown((n) => n - 1), 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, countdown, cfg.mode]);

  // 闪算揭示(stepIdx 为「组」下标,一组一次闪示 flashBatch 笔)
  const flashBatch = Math.max(1, cfg.flashBatch);
  const flashSteps = problem ? Math.ceil(problem.terms.length / flashBatch) : 0;
  useEffect(() => {
    if (phase !== "playing" || cfg.mode !== "flash" || !problem) return;
    if (stepIdx >= flashSteps) { setPhase("answer"); return; }
    setShowTerm(true);
    const blankMs = Math.min(120, Math.max(50, cfg.speedMs * 0.15));
    const showMs = Math.max(100, cfg.speedMs - blankMs);
    const t1 = setTimeout(() => setShowTerm(false), showMs);
    const t2 = setTimeout(() => setStepIdx((i) => i + 1), cfg.speedMs);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, stepIdx, problem, cfg.mode, cfg.speedMs, flashSteps]);

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
      const gap = cfg.listenLevel >= 3 ? 200 : cfg.listenLevel === 2 ? 450 : 800;
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
        toast({ title: "登录后就能上榜啦", description: "这局成绩还没存到云端～" });
      }
    }
    onFinished?.();
    setResult({ correct, score, answered: parsed });
    setPhase("result");
  }

  // 童趣外壳
  const shell: CSSProperties = {
    background: `radial-gradient(120% 120% at 50% 0%, #FFFDF7 0%, ${T.cream} 55%, #FDEAC6 100%)`,
    border: `2px solid ${T.line}`, borderRadius: 26,
    boxShadow: "0 14px 34px rgba(203,150,70,.16)", padding: 18, color: T.ink,
  };

  // ================= CONFIG =================
  if (phase === "config") {
    return (
      <div style={shell}>
        {/* 头部:吉祥物 + 标题 */}
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: 14 }}>
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 30 }} className="animate-bounce">🧮</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: T.coralD, letterSpacing: 1 }}>珠心算乐园</div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600 }}>选好模式，开始闯关吧！</div>
            </div>
          </div>
          {onMistakeModeChange && (
            <label className="flex items-center gap-2" style={{ fontSize: 12, color: T.inkSoft, fontWeight: 700 }}>
              <span>只练错题</span>
              <Switch checked={mistakeMode} onCheckedChange={onMistakeModeChange} />
            </label>
          )}
        </div>

        {mistakeMode && (
          <div style={{ background: "#FFF0E8", border: `2px solid ${T.coral}44`, color: T.coralD, borderRadius: 16, padding: "8px 12px", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
            🎯 「只练错题」已开启：题目从错题本里抽，配置只影响怎么呈现和速度。
          </div>
        )}

        {/* 模式:三个大彩色瓷砖 */}
        <div className="grid grid-cols-3 gap-2.5" style={{ marginBottom: 14 }}>
          {MODES.map((m) => {
            const on = cfg.mode === m.id;
            return (
              <button key={m.id} onClick={() => setCfg({ ...cfg, mode: m.id })}
                style={{
                  borderRadius: 20, padding: "14px 8px", cursor: "pointer", textAlign: "center",
                  border: `2.5px solid ${on ? m.cD : T.line}`,
                  background: on ? `linear-gradient(180deg, ${m.c}, ${m.cD})` : "#fff",
                  color: on ? "#fff" : T.ink,
                  boxShadow: on ? `0 6px 0 ${m.cD}, 0 10px 18px ${m.cD}44` : "0 3px 0 #EADBBD",
                  transform: on ? "translateY(-1px)" : "none", transition: "transform .05s",
                }}>
                <div style={{ fontSize: 26 }}>{m.emoji}</div>
                <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2 }}>{m.label}</div>
                <div style={{ fontSize: 10.5, opacity: on ? 0.9 : 0.6, fontWeight: 600 }}>{m.sub}</div>
              </button>
            );
          })}
        </div>

        {/* 配置卡片 */}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Card label="位数" emoji="🔢" hint="可范围">
            <div className="flex flex-col gap-2">
              <Row label="最小"><MiniStepper value={cfg.minDigits} min={1} max={9} suffix="位" color={T.sky}
                onChange={(v) => setCfg({ ...cfg, minDigits: v, maxDigits: Math.max(v, cfg.maxDigits) })} /></Row>
              <Row label="最大"><MiniStepper value={cfg.maxDigits} min={1} max={9} suffix="位" color={T.sky}
                onChange={(v) => setCfg({ ...cfg, maxDigits: v, minDigits: Math.min(v, cfg.minDigits) })} /></Row>
            </div>
          </Card>

          <Card label="笔数" emoji="✏️" hint="1–200">
            <div className="flex flex-wrap items-center gap-1.5">
              {COUNT_PRESETS.map((n) => (
                <Pill key={n} on={cfg.count === n} color={T.grass} onClick={() => setCfg({ ...cfg, count: n })}>{n}</Pill>
              ))}
              <NumInput value={COUNT_PRESETS.includes(cfg.count) ? null : cfg.count} min={1} max={200} onCommit={(v) => setCfg({ ...cfg, count: v })} />
            </div>
          </Card>

          <Card label="加减" emoji="➕" hint="减号规则内建">
            <div className="flex flex-wrap items-center gap-1.5">
              {ADDSUB_OPTIONS.map((o) => (
                <Pill key={o.id} on={cfg.addsub === o.id} color={T.coral} onClick={() => setCfg({ ...cfg, addsub: o.id })}>{o.label}</Pill>
              ))}
            </div>
          </Card>

          {cfg.mode === "flash" && (
            <Card label="单笔时间" emoji="⚡" hint="越小越快">
              <div className="flex flex-wrap items-center gap-1.5">
                {SPEED_PRESETS.map((s) => (
                  <Pill key={s.value} on={cfg.speedMs === s.value} color={T.sun} onClick={() => setCfg({ ...cfg, speedMs: s.value })}>{s.label}</Pill>
                ))}
              </div>
            </Card>
          )}
          {cfg.mode === "listen" && (
            <Card label="语速" emoji="🔊" hint="报数快慢">
              <div className="flex flex-wrap items-center gap-1.5">
                {LISTEN_PRESETS.map((s) => (
                  <Pill key={s.value} on={cfg.listenLevel === s.value} color={T.sky} onClick={() => setCfg({ ...cfg, listenLevel: s.value })}>{s.label}</Pill>
                ))}
              </div>
            </Card>
          )}
          {cfg.mode === "glance" && (
            <Card label="看算" emoji="👀">
              <p style={{ fontSize: 11.5, lineHeight: 1.6, color: T.inkSoft, fontWeight: 600 }}>整道题竖式一次显示，自己心算后作答～</p>
            </Card>
          )}

          {cfg.mode === "flash" && (
            <Card label="显示笔数" emoji="🎞️" hint="可一次闪多笔">
              <MiniStepper value={cfg.flashBatch} min={1} max={Math.max(1, Math.min(10, cfg.count))} suffix="笔" color={T.grape}
                onChange={(v) => setCfg({ ...cfg, flashBatch: v })} />
            </Card>
          )}
        </div>

        {/* 开始 + 积分 */}
        <button onClick={beginCountdown}
          style={{ ...candyBtn(T.coral, T.coralD), width: "100%", marginTop: 16, padding: "16px", fontSize: 19, letterSpacing: 3, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Play className="h-5 w-5" fill="#fff" /> 开始闯关
        </button>

        <div style={{ marginTop: 12, background: "#FFFBF0", border: `2px dashed ${T.sun}66`, borderRadius: 16, padding: "10px 14px" }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 700 }}>🏆 答对一题可得</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: T.sunD }}>{previewScore(cfg)} 分</span>
          </div>
        </div>
      </div>
    );
  }

  // ================= READY =================
  if (phase === "ready") {
    return (
      <div style={{ ...shell, minHeight: 340 }} className="flex flex-col items-center justify-center">
        <div className="animate-bounce" style={{ fontSize: 64 }}>🧮</div>
        <div key={countdown} className="animate-pop-in" style={{ fontSize: 60, fontWeight: 900, color: T.coralD, marginTop: 6 }}>准备好啦！</div>
        <div style={{ fontSize: 14, color: T.inkSoft, fontWeight: 700, marginTop: 6 }}>
          {cfg.mode === "listen" ? "🔊 打开声音，用心听～" : "👀 盯住屏幕中间～"}
        </div>
      </div>
    );
  }

  // ================= PLAYING =================
  if (phase === "playing" && problem) {
    const len = problem.terms.length;
    const isFlash = cfg.mode === "flash";
    const shownCount = isFlash ? Math.min((stepIdx + 1) * flashBatch, len) : Math.min(stepIdx + 1, len);
    const totalSteps = isFlash ? flashSteps : len;
    const curStep = Math.min(stepIdx + 1, totalSteps);
    const batchStart = stepIdx * flashBatch;
    const batchTerms = isFlash ? problem.terms.slice(batchStart, batchStart + flashBatch) : [];
    const numCls = flashBatch <= 1 ? "text-8xl" : flashBatch === 2 ? "text-7xl" : "text-5xl";
    const iconCls = flashBatch <= 1 ? "h-12 w-12" : flashBatch === 2 ? "h-10 w-10" : "h-7 w-7";
    return (
      <div style={shell}>
        <div className="flex items-center justify-between" style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 800, marginBottom: 8 }}>
          <span>第 {shownCount} / {len} 笔</span>
          <span>{isFlash ? `${cfg.speedMs}ms${flashBatch > 1 ? ` ×${flashBatch}` : ""}` : "🔊 听算"}</span>
          <button onClick={reset} style={{ color: T.coralD, fontWeight: 800, background: "none", border: "none", cursor: "pointer" }}>放弃</button>
        </div>
        <div style={{ height: 8, background: "#F0E2C4", borderRadius: 999, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ height: "100%", width: `${(curStep / totalSteps) * 100}%`, background: `linear-gradient(90deg, ${T.sun}, ${T.coral})`, borderRadius: 999, transition: "width .2s" }} />
        </div>

        {isFlash ? (
          <div className="flex items-center justify-center" style={{ height: 320, borderRadius: 22, background: `linear-gradient(180deg, #2C3E63, ${STAGE})`, boxShadow: "inset 0 2px 12px rgba(0,0,0,.3)" }}>
            {showTerm && (
              <div key={stepIdx} className="animate-pop-in flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4">
                {batchTerms.map((val, k) => {
                  const gi = batchStart + k;
                  const minus = problem.signs[gi] === "-";
                  return (
                    <div key={gi} className="flex items-center gap-1.5">
                      {minus
                        ? <Minus className={iconCls} strokeWidth={4} style={{ color: T.coral }} />
                        : <Plus className={iconCls} strokeWidth={4} style={{ color: "#7CE38B" }} />}
                      <span className={cn(numCls, "font-mono-tabular")} style={{ color: "#fff", fontWeight: 800 }}>{val}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center" style={{ height: 320, borderRadius: 22, background: `linear-gradient(180deg, ${T.sky}, ${T.skyD})` }}>
            <div className={cn(showTerm && "animate-bounce")} style={{ fontSize: 80 }}>🔊</div>
            <p style={{ color: "#fff", fontWeight: 800, marginTop: 18, fontSize: 15 }}>正在报第 {shownCount} / {len} 笔，用心算～</p>
          </div>
        )}
      </div>
    );
  }

  // ================= ANSWER =================
  if (phase === "answer" && problem) {
    return (
      <div style={shell}>
        {cfg.mode === "glance" && (
          <div style={{ background: "#fff", border: `2px solid ${T.line}`, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <div className="flex flex-col items-end gap-0.5 font-mono-tabular" style={{ fontSize: 30, fontWeight: 800, color: T.ink }}>
              {problem.terms.map((t, i) => (
                <div key={i}>
                  <span style={{ marginRight: 12, color: problem.signs[i] === "-" ? T.coralD : T.grassD }}>{problem.signs[i] === "-" ? "−" : "+"}</span>
                  {t}
                </div>
              ))}
              <div style={{ marginTop: 6, height: 4, width: "60%", background: T.ink, borderRadius: 4 }} />
            </div>
          </div>
        )}
        <div style={{ textAlign: "center", fontSize: 15, fontWeight: 800, color: T.coralD, marginBottom: 8 }}>
          {cfg.mode === "glance" ? "🤔 答案是多少？" : "🤔 算出来了吗？填答案～"}
        </div>
        <AnswerPad value={input} onChange={setInput} onSubmit={() => submit(input)} onGiveUp={reset}
          canReplay={cfg.mode === "listen"} onReplay={() => { setStepIdx(0); setShowTerm(false); setPhase("playing"); }} />
      </div>
    );
  }

  // ================= RESULT =================
  if (phase === "result" && problem && result) {
    const exprStr = problem.terms
      .map((t, i) => (i === 0 ? `${t}` : problem.signs[i] === "-" ? ` − ${t}` : ` + ${t}`))
      .join("");
    const ok = result.correct;
    return (
      <div style={{ ...shell, position: "relative", overflow: "hidden" }} className="flex flex-col items-center gap-3">
        {ok && (
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {["🎉", "⭐", "🎊", "✨", "🌟", "🎉", "⭐", "✨"].map((e, i) => (
              <span key={i} className="animate-bounce" style={{ position: "absolute", top: `${8 + (i % 3) * 10}%`, left: `${8 + i * 11}%`, fontSize: 22, animationDelay: `${i * 0.12}s` }}>{e}</span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 68, marginTop: 4 }} className="animate-pop-in">{ok ? "🎉" : "💪"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: ok ? T.grassD : T.coralD }}>{ok ? "答对啦！太棒了" : "差一点点，再试试～"}</div>
        <div style={{ fontSize: 44, fontWeight: 900, color: ok ? T.sunD : T.inkSoft }} className="font-mono-tabular">{ok ? `+${result.score}` : "0"} <span style={{ fontSize: 16 }}>分</span></div>

        <div style={{ background: "#fff", border: `2px solid ${T.line}`, borderRadius: 18, padding: 16, width: "100%", maxWidth: 420, textAlign: "center" }}>
          <div className="flex items-center justify-center gap-8">
            <div>
              <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700 }}>正确答案</div>
              <div className="font-mono-tabular" style={{ fontSize: 26, fontWeight: 900, color: T.grassD }}>{problem.answer}</div>
            </div>
            {!ok && (
              <div>
                <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700 }}>你的答案</div>
                <div className="font-mono-tabular" style={{ fontSize: 26, fontWeight: 900, color: T.coralD }}>{result.answered ?? "—"}</div>
              </div>
            )}
          </div>
          <div className="font-mono-tabular" style={{ marginTop: 12, fontSize: 14, color: T.inkSoft, wordBreak: "break-word" }}>{exprStr} = {problem.answer}</div>
        </div>

        <div className="flex items-center gap-3" style={{ marginTop: 2 }}>
          <button onClick={reset} style={{ background: "#fff", color: T.ink, border: `2px solid ${T.line}`, borderRadius: 999, padding: "11px 22px", fontWeight: 800, cursor: "pointer" }}>改配置</button>
          <button onClick={beginCountdown} style={{ ...candyBtn(T.grass, T.grassD), padding: "11px 26px", fontSize: 16, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <RotateCcw className="h-4 w-4" /> 再来一题
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ---------- 作答面板 ----------
function AnswerPad({ value, onChange, onSubmit, onGiveUp, canReplay, onReplay }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onGiveUp: () => void;
  canReplay?: boolean; onReplay?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <input
        autoFocus
        inputMode="numeric"
        value={value}
        placeholder="在这里填答案，回车提交～"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
        className="font-mono-tabular"
        style={{ height: 60, textAlign: "center", fontSize: 28, fontWeight: 800, color: T.ink, background: "#fff", border: `3px solid ${T.sun}`, borderRadius: 18, outline: "none" }}
      />
      <div className="flex items-center gap-2.5">
        <button onClick={onSubmit} disabled={!value.trim()}
          style={{ ...candyBtn(T.coral, T.coralD), flex: 1, padding: "14px", fontSize: 17, opacity: value.trim() ? 1 : 0.5 }}>提交 ✓</button>
        {canReplay && (
          <button onClick={onReplay} style={{ background: "#fff", color: T.skyD, border: `2px solid ${T.sky}`, borderRadius: 999, padding: "12px 16px", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Volume2 className="h-4 w-4" /> 再听一遍
          </button>
        )}
      </div>
      <button onClick={onGiveUp} style={{ textAlign: "center", fontSize: 12, color: T.inkSoft, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>放弃本局</button>
    </div>
  );
}

// ---------- 小组件 ----------
function Card({ label, emoji, hint, children }: { label: string; emoji: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `2px solid ${T.line}`, borderRadius: 18, padding: 13, boxShadow: "0 3px 0 #F1E6CE" }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 9 }}>
        <span style={{ fontSize: 13.5, fontWeight: 900, color: T.ink }}>{emoji} {label}</span>
        {hint && <span style={{ fontSize: 10, color: T.inkSoft, fontWeight: 600 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ width: 26, fontSize: 10.5, color: T.inkSoft, fontWeight: 700 }}>{label}</span>
      {children}
    </div>
  );
}

function Pill({ on, color, onClick, children }: { on: boolean; color: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      style={{
        borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 800, cursor: "pointer",
        border: `2px solid ${on ? color : T.line}`,
        background: on ? color : "#fff", color: on ? "#fff" : T.inkSoft,
        boxShadow: on ? `0 3px 8px ${color}55` : "none",
      }}>
      {children}
    </button>
  );
}

function MiniStepper({ value, min, max, suffix, color, onChange }: {
  value: number; min: number; max: number; suffix?: string; color: string; onChange: (v: number) => void;
}) {
  const btn = (disabled: boolean): CSSProperties => ({
    width: 28, height: 28, borderRadius: 999, border: "none", cursor: disabled ? "default" : "pointer",
    background: disabled ? "#EDE0C6" : color, color: "#fff", fontSize: 17, fontWeight: 900, lineHeight: 1,
    opacity: disabled ? 0.5 : 1,
  });
  return (
    <div className="inline-flex items-center gap-2">
      <button style={btn(value <= min)} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="font-mono-tabular" style={{ minWidth: 22, textAlign: "center", fontSize: 16, fontWeight: 900, color: T.ink }}>{value}</span>
      <button style={btn(value >= max)} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      {suffix && <span style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 700 }}>{suffix}</span>}
    </div>
  );
}

function NumInput({ value, min, max, onCommit }: {
  value: number | null; min: number; max: number; onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => { setText(value === null ? "" : String(value)); }, [value]);
  const commit = (raw: string) => {
    const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
    if (!isNaN(n)) onCommit(Math.min(max, Math.max(min, n)));
  };
  return (
    <input
      inputMode="numeric"
      value={text}
      placeholder="自定"
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="font-mono-tabular"
      style={{ height: 30, width: 46, borderRadius: 10, border: `2px solid ${T.line}`, background: "#fff", textAlign: "center", fontSize: 12.5, fontWeight: 800, color: T.ink, outline: "none" }}
    />
  );
}
