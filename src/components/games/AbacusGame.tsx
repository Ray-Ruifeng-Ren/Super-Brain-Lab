import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Play, RotateCcw, Minus, Plus, Volume2, ArrowLeft, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { submitScore } from "@/lib/leaderboard";
import { logAttempt, fetchWrongAttempts } from "@/lib/practiceLog";
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import type { Sign } from "@/lib/flashMath";
import Soroban from "./Soroban";
import { dingTick, dingGo } from "@/lib/beep";
import {
  buildRound, previewScore, computeScore, abacusMode, numberToCN, PROJECTS,
  DEFAULT_ABACUS_CFG, type AbacusCfg, type AbacusMode, type AddSubType, type Project, type Round,
} from "@/lib/abacus";
import { getMyCert, bestBadge, type CertLevel } from "@/lib/cert";
import { useI18n } from "@/lib/i18n";
import { getLang } from "@/lib/langState";

// 英文界面(2026-10-27):L(中文, 英文) 按当前语言取;子组件随 AbacusGame(订阅语言上下文)重渲染
const L = (zh: string, en: string) => (getLang() === "en" ? en : zh);
const PROJECT_EN: Record<Project, { label: string; desc: string }> = {
  addsub: { label: "Add & Subtract", desc: "Flash / Glance / Listen" },
  multiply: { label: "Multiply", desc: "Pick your digits" },
  divide: { label: "Divide", desc: "Pick your digits" },
  bead: { label: "Beads", desc: "Read the abacus" },
};
const projLabelOf = (id: Project) => (getLang() === "en" ? PROJECT_EN[id].label : PROJECTS.find((p) => p.id === id)?.label ?? "");

// ============ 童趣配色 ============
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
  boxShadow: `0 5px 0 ${bgD}, 0 10px 18px ${bgD}44, inset 0 2px 0 rgba(255,255,255,.45)`,
  textShadow: "0 1px 1px rgba(0,0,0,.15)", fontWeight: 800, cursor: "pointer",
});

type Phase = "ready" | "playing" | "answer" | "result";

const CFG_KEY = "abacus:lastCfg";
const COUNT_PRESETS = [5, 10, 15, 20, 30];
const SPEED_PRESETS = [
  { label: "0.1秒", en: "0.1s", value: 100 }, { label: "0.3秒", en: "0.3s", value: 300 },
  { label: "0.5秒", en: "0.5s", value: 500 }, { label: "1秒", en: "1s", value: 1000 }, { label: "1.5秒", en: "1.5s", value: 1500 },
];
const LISTEN_PRESETS = [
  { label: "常规语速", en: "Normal", value: 1 }, { label: "较快语速", en: "Fast", value: 2 }, { label: "极快语速", en: "Very fast", value: 3 },
];
const ADDSUB_OPTIONS: { id: AddSubType; label: string; en: string }[] = [
  { id: "add", label: "纯加", en: "Add only" }, { id: "sub", label: "纯减", en: "Subtract only" }, { id: "mix", label: "加减混合", en: "Mixed" },
];
const MODES: { id: AbacusMode; label: string; en: string; sub: string; emoji: string; c: string; cD: string }[] = [
  { id: "flash", label: "闪算", en: "Flash", sub: "逐笔闪现", emoji: "⚡", c: T.sun, cD: T.sunD },
  { id: "glance", label: "看算", en: "Glance", sub: "竖式同现", emoji: "👀", c: T.grass, cD: T.grassD },
  { id: "listen", label: "听算", en: "Listen", sub: "语音报数", emoji: "🔊", c: T.sky, cD: T.skyD },
];
const PROJ_COLOR: Record<Project, { c: string; cD: string }> = {
  addsub: { c: T.coral, cD: T.coralD }, multiply: { c: T.sky, cD: T.skyD },
  divide: { c: T.grape, cD: T.grapeD }, bead: { c: T.grass, cD: T.grassD },
};

function clampCfg(c: Partial<AbacusCfg>): AbacusCfg {
  const d = DEFAULT_ABACUS_CFG;
  const project: Project = ["addsub", "multiply", "divide", "bead"].includes(c.project as string) ? (c.project as Project) : "addsub";
  const m = c.mode === "glance" || c.mode === "listen" ? c.mode : "flash";
  const addsub: AddSubType = c.addsub === "add" || c.addsub === "sub" ? c.addsub : "mix";
  const cl = (v: number | undefined, lo: number, hi: number, dv: number) => Math.min(hi, Math.max(lo, Math.round(v ?? dv)));
  const minD = cl(c.minDigits, 1, 9, d.minDigits);
  const maxD = cl(c.maxDigits, 1, 9, d.maxDigits); // 独立,不与最小联动(引擎会自动按区间取值)
  const count = cl(c.count, 1, 200, d.count);
  return {
    project, mode: m, count, minDigits: minD, maxDigits: maxD,
    speedMs: cl(c.speedMs, 100, 5000, d.speedMs),
    flashBatch: Math.min(count, cl(c.flashBatch, 1, 10, d.flashBatch)),
    listenLevel: cl(c.listenLevel, 1, 3, d.listenLevel), addsub,
    aDigits: cl(c.aDigits, 1, 6, d.aDigits), bDigits: cl(c.bDigits, 1, 6, d.bDigits),
    divisorDigits: cl(c.divisorDigits, 1, 4, d.divisorDigits), quotientDigits: cl(c.quotientDigits, 1, 5, d.quotientDigits),
    beadDigits: cl(c.beadDigits, 1, 5, d.beadDigits), beadSpeedMs: cl(c.beadSpeedMs, 300, 6000, d.beadSpeedMs),
  };
}

function loadStoredCfg(): AbacusCfg {
  try { const raw = localStorage.getItem(CFG_KEY); if (raw) return clampCfg(JSON.parse(raw)); } catch { /* noop */ }
  return { ...DEFAULT_ABACUS_CFG };
}

function speakTerm(text: string, level: number): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = level >= 3 ? 1.7 : level === 2 ? 1.35 : 1.0;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
    setTimeout(resolve, 4000);
  });
}

export interface AbacusGameProps {
  onFinished?: () => void;
  onCfgChange?: (cfg: AbacusCfg) => void;
  onViewChange?: (view: "home" | "train") => void;
  mistakeMode?: boolean;
  onMistakeModeChange?: (v: boolean) => void;
  /** Deep-link entry: preselect an add/sub mode and open its config (from a homepage card). */
  initialMode?: AbacusMode;
  /** Deep-link entry: preselect a project (乘法/除法/看珠) and open its config directly. */
  initialProject?: Project;
}

export function AbacusGame({ onFinished, onCfgChange, onViewChange, mistakeMode = false, onMistakeModeChange, initialMode, initialProject }: AbacusGameProps) {
  const navigate = useNavigate();
  useI18n(); // 订阅语言:切换中英文时整棵子树重渲染(子组件文案用 L())
  const [cfg, setCfg] = useState<AbacusCfg>(loadStoredCfg);
  const [view, setView] = useState<"home" | "train">("home");
  const [showMore, setShowMore] = useState(false);
  const [modalProject, setModalProject] = useState<Project | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [round, setRound] = useState<Round | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [showTerm, setShowTerm] = useState(false);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ correct: boolean; score: number; answered: number | null } | null>(null);
  const [countdown, setCountdown] = useState(3);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usedMistakeKeysRef = useRef<Set<string>>(new Set());
  const submitBusyRef = useRef(false); // 提交防重入锁
  const [certBadge, setCertBadge] = useState<CertLevel | null>(null); // 等级鉴定最高徽章(首页横幅展示)

  useEffect(() => {
    let on = true;
    getMyCert().then((m) => on && setCertBadge(bestBadge(new Set(m.keys()))));
    return () => { on = false; };
  }, []);

  // Deep-link from a homepage card (/play/abacus?mode=listen|glance): jump
  // straight into add/sub with that mode preselected and its config open.
  useEffect(() => {
    if (initialProject) {
      setCfg((c) => ({ ...c, project: initialProject }));
      setModalProject(initialProject);
    } else if (initialMode) {
      setCfg((c) => ({ ...c, project: "addsub", mode: initialMode }));
      setModalProject("addsub");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* noop */ } }, [cfg]);
  useEffect(() => { onCfgChange?.(cfg); }, [cfg, onCfgChange]);
  useEffect(() => { onViewChange?.(view); }, [view, onViewChange]);
  useEffect(() => { if (phase === "answer") submitBusyRef.current = false; }, [phase]); // 每题作答阶段放行一次提交
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); window.speechSynthesis?.cancel(); }, []);

  const set = (patch: Partial<AbacusCfg>) => setCfg((c) => ({ ...c, ...patch }));
  const problemKey = (r: { signs?: Sign[]; terms?: number[]; answer: number }) => `${(r.signs ?? []).join("")}|${(r.terms ?? []).join(",")}|${r.answer}`;

  async function loadRound(): Promise<Round | null> {
    if (cfg.project === "addsub" && mistakeMode) {
      const rows = await fetchWrongAttempts("abacus");
      const addsubRows = rows.filter((r) => Array.isArray(r.signs) && r.signs.length === r.terms.length && r.signs.every((s) => s === "+" || s === "-"));
      if (!addsubRows.length) return null;
      const seen = new Set<string>();
      const uniq = addsubRows.filter((r) => { const k = problemKey(r as any); if (seen.has(k)) return false; seen.add(k); return true; });
      const fresh = uniq.filter((r) => !usedMistakeKeysRef.current.has(problemKey(r as any)));
      const pool = fresh.length ? fresh : (usedMistakeKeysRef.current.clear(), uniq);
      const r = pool[Math.floor(Math.random() * pool.length)];
      const signs = r.signs as Sign[];
      return { project: "addsub", answer: r.answer, terms: r.terms, signs, exprStr: r.terms.map((t, i) => (i === 0 ? `${t}` : signs[i] === "-" ? ` − ${t}` : ` + ${t}`)).join("") };
    }
    return buildRound(cfg);
  }

  async function beginRound() {
    usedMistakeKeysRef.current.clear();
    const r = await loadRound();
    if (!r) { toast({ title: L("还没有错题哦", "No mistakes yet"), description: L("先做几题、或关掉「只练错题」～", "Do a few problems first, or turn off “Mistakes only”.") }); return; }
    usedMistakeKeysRef.current.add(problemKey(r));
    setRound(r); setInput(""); setResult(null); setStepIdx(0); setShowTerm(false); setCountdown(3); setPhase("ready");
  }

  function openProject(p: Project) { set({ project: p }); setModalProject(p); }
  function startFromModal() { setModalProject(null); setView("train"); beginRound(); }
  function backHome() { if (timerRef.current) clearTimeout(timerRef.current); window.speechSynthesis?.cancel(); navigate("/"); }

  const timedReveal = !!round && ((round.project === "addsub" && (cfg.mode === "flash" || cfg.mode === "listen")) || round.project === "bead");
  const flashBatch = Math.max(1, cfg.flashBatch);
  const flashSteps = round?.terms ? Math.ceil(round.terms.length / flashBatch) : 0;

  // 倒计时 3-2-1(每个数字一声「叮」,开始时「叮～」)
  useEffect(() => {
    if (view !== "train" || phase !== "ready") return;
    if (countdown <= 0) { dingGo(); setPhase(timedReveal ? "playing" : "answer"); return; }
    dingTick();
    timerRef.current = setTimeout(() => setCountdown((n) => n - 1), 700);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [view, phase, countdown, timedReveal]);

  // 闪算揭示
  useEffect(() => {
    if (view !== "train" || phase !== "playing" || round?.project !== "addsub" || cfg.mode !== "flash" || !round.terms) return;
    if (stepIdx >= flashSteps) { setPhase("answer"); return; }
    setShowTerm(true);
    const blankMs = Math.min(120, Math.max(50, cfg.speedMs * 0.15));
    const showMs = Math.max(100, cfg.speedMs - blankMs);
    const t1 = setTimeout(() => setShowTerm(false), showMs);
    const t2 = setTimeout(() => setStepIdx((i) => i + 1), cfg.speedMs);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [view, phase, stepIdx, round, cfg.mode, cfg.speedMs, flashSteps]);

  // 听算揭示
  useEffect(() => {
    if (view !== "train" || phase !== "playing" || round?.project !== "addsub" || cfg.mode !== "listen" || !round.terms) return;
    if (stepIdx >= round.terms.length) { setPhase("answer"); return; }
    let cancelled = false;
    const v = round.terms[stepIdx]; const sign = round.signs![stepIdx];
    const text = (stepIdx === 0 ? "" : sign === "-" ? "减 " : "加 ") + numberToCN(v);
    setShowTerm(true);
    speakTerm(text, cfg.listenLevel).then(() => {
      if (cancelled) return;
      const gap = cfg.listenLevel >= 3 ? 200 : cfg.listenLevel === 2 ? 450 : 800;
      timerRef.current = setTimeout(() => setStepIdx((i) => i + 1), gap);
    });
    return () => { cancelled = true; window.speechSynthesis?.cancel(); };
  }, [view, phase, stepIdx, round, cfg.mode, cfg.listenLevel]);

  // 看珠揭示
  useEffect(() => {
    if (view !== "train" || phase !== "playing" || round?.project !== "bead") return;
    setShowTerm(true);
    const t = setTimeout(() => setPhase("answer"), cfg.beadSpeedMs);
    return () => clearTimeout(t);
  }, [view, phase, round, cfg.beadSpeedMs]);

  async function submit(raw: string) {
    if (!round) return;
    const parsed = parseSpokenNumber(raw);
    if (parsed === null) return;
    // 防重入:长按 Enter/连点提交会在 await 期间并发多次 submit(成绩重复入库);进入下一题作答时解锁
    if (submitBusyRef.current) return;
    submitBusyRef.current = true;
    const correct = parsed === round.answer;
    const score = computeScore(cfg, correct);
    const mode = abacusMode(cfg);
    const terms = round.terms ?? (round.a != null && round.b != null ? [round.a, round.b] : round.beadValue != null ? [round.beadValue] : [round.answer]);
    const signs = (round.signs ?? []) as ("+" | "-")[];
    await logAttempt({ game: "abacus", mode, terms, signs, answer: round.answer, userAnswer: parsed, correct, usedMs: 0 });
    if (correct) {
      const r = await submitScore({ game: "abacus", mode, value: score, meta: { project: cfg.project } });
      if (!r.ok && r.error === "未登录") toast({ title: L("登录后就能上榜啦", "Log in to get on the leaderboard"), description: L("这局成绩还没存到云端～", "This score wasn't saved to the cloud.") });
    }
    onFinished?.();
    setResult({ correct, score, answered: parsed });
    setPhase("result");
  }

  const shell: CSSProperties = {
    background: `radial-gradient(120% 120% at 50% 0%, #FFFDF7 0%, ${T.cream} 55%, #FDEAC6 100%)`,
    border: `2px solid ${T.line}`, borderRadius: 26, boxShadow: "0 14px 34px rgba(203,150,70,.16)", padding: 18, color: T.ink,
  };

  // ================= HOME =================
  if (view === "home") {
    const MODE_CARDS: { mode: AbacusMode; img: string; label: string; to?: string }[] = [
      { mode: "flash", img: "/card-flash.png", label: L("闪电心算", "Flash Math"), to: "/play/flashmath" },
      { mode: "glance", img: "/card-kan.png", label: L("看算", "Glance") },
      { mode: "listen", img: "/card-ting.png", label: L("听算", "Listen") },
    ];
    const onModeCard = (c: { mode: AbacusMode; to?: string }) => {
      if (c.to) { navigate(c.to); return; }
      set({ project: "addsub", mode: c.mode });
      setModalProject("addsub");
    };
    const MORE: { id: Project; label: string; emoji: string }[] = [
      { id: "multiply", label: projLabelOf("multiply"), emoji: "✖️" }, { id: "divide", label: projLabelOf("divide"), emoji: "➗" }, { id: "bead", label: projLabelOf("bead"), emoji: "🧮" },
    ];
    return (
      <>
        <div style={{ padding: "6px 2px 20px", minHeight: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ display: "inline-block", padding: "6px 18px", borderRadius: 999, background: "rgba(255,255,255,.72)", boxShadow: "0 3px 10px rgba(0,0,0,.08)", fontSize: 16, fontWeight: 900, color: T.coralD }}>🧮 {L("选择训练项目", "Choose a project")}</div>
          </div>
          {/* 锦标赛(等级鉴定)入口 —— 三张卡上方的横幅 */}
          <button onClick={() => navigate("/cert")} aria-label={L("闪电心算等级鉴定", "Flash Math certification")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 16,
              border: "none", cursor: "pointer", borderRadius: 20, padding: "14px 20px", textAlign: "left",
              background: "linear-gradient(92deg, #FFB01F, #F59300 55%, #EF5C2B)", color: "#fff",
              boxShadow: "0 10px 24px rgba(245,147,0,.38), inset 0 2px 0 rgba(255,255,255,.45)", transition: "transform .08s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(.99)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 32 }}>🏆</span>
              <span>
                <span style={{ display: "block", fontSize: 18, fontWeight: 900 }}>{L("等级鉴定 · 锦标赛", "Certification · Championship")}</span>
                <span style={{ display: "block", fontSize: 11.5, opacity: 0.92, fontWeight: 600 }}>{L("世界级别开创性等级鉴定标准,有资格申请吉尼斯世界纪录 · 二十级到二十段", "A pioneering world-class grading standard, eligible for Guinness World Records · 20 levels to 20 dan")}</span>
              </span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {certBadge && (
                <span style={{ padding: "4px 12px", borderRadius: 999, background: "rgba(255,255,255,.24)", fontSize: 13, fontWeight: 900 }}>⚡{certBadge.label}</span>
              )}
              <span style={{ padding: "7px 16px", borderRadius: 999, background: "rgba(255,255,255,.92)", color: T.sunD, fontSize: 13, fontWeight: 900 }}>{certBadge ? L("继续刷级 →", "Keep leveling →") : L("开始鉴定 →", "Get certified →")}</span>
            </span>
          </button>
          <div className="grid gap-4 md:grid-cols-3">
            {MODE_CARDS.map((c) => (
              <button key={c.mode} onClick={() => onModeCard(c)} aria-label={c.label}
                style={{ border: "none", background: "none", padding: 0, cursor: "pointer", borderRadius: 20, overflow: "hidden", boxShadow: "0 12px 26px rgba(0,0,0,.20)", transition: "transform .08s" }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(.98)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>
                <img src={c.img} alt={c.label} style={{ display: "block", width: "100%", borderRadius: 20 }} />
              </button>
            ))}
          </div>
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <button onClick={() => setShowMore((s) => !s)}
              style={{ background: "rgba(255,255,255,.82)", border: `2px solid ${T.line}`, borderRadius: 999, padding: "9px 22px", fontSize: 14, fontWeight: 800, color: T.ink, cursor: "pointer", boxShadow: "0 3px 10px rgba(0,0,0,.10)" }}>
              {showMore ? L("收起 ▴", "Less ▴") : L("更多项目 ▾", "More projects ▾")}
            </button>
          </div>
          {showMore && (
            <div className="grid gap-3 md:grid-cols-3" style={{ marginTop: 14 }}>
              {MORE.map((m) => {
                const col = PROJ_COLOR[m.id];
                const desc = getLang() === "en" ? PROJECT_EN[m.id].desc : PROJECTS.find((p) => p.id === m.id)?.desc ?? "";
                return (
                  <button key={m.id} onClick={() => openProject(m.id)}
                    className="animate-pop-in"
                    style={{ border: "none", cursor: "pointer", borderRadius: 20, padding: "16px 16px", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: `linear-gradient(180deg, ${col.c}, ${col.cD})`, color: "#fff", boxShadow: `0 8px 20px ${col.cD}44, inset 0 2px 0 rgba(255,255,255,.4)` }}>
                    <span style={{ fontSize: 34 }}>{m.emoji}</span>
                    <span>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{m.label}</div>
                      <div style={{ fontSize: 11.5, opacity: 0.9, fontWeight: 600 }}>{desc}</div>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {modalProject && <ParamModal cfg={cfg} set={set} project={modalProject} onCancel={() => navigate("/")} onStart={startFromModal} mistakeMode={mistakeMode} onMistakeModeChange={onMistakeModeChange} />}
      </>
    );
  }

  // ================= TRAIN =================
  const projLabel = projLabelOf(cfg.project) || L("训练", "Training");
  return (
    <div style={shell}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <button onClick={backHome} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.coralD, fontWeight: 800, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>
          <ArrowLeft className="h-4 w-4" /> {L("返回项目", "Projects")}
        </button>
        <span style={{ fontSize: 15, fontWeight: 900, color: T.ink }}>{projLabel}</span>
        <span style={{ width: 64 }} />
      </div>

      {phase === "ready" && (
        <div style={{ minHeight: 300 }} className="flex flex-col items-center justify-center">
          <div className="animate-bounce" style={{ fontSize: 54 }}>🧮</div>
          <div style={{ fontSize: 13, color: T.inkSoft, fontWeight: 800, letterSpacing: "0.2em", marginTop: 4 }}>{L("准备", "Ready")}</div>
          <div key={countdown} className="animate-pop-in font-mono-tabular" style={{ fontSize: 88, fontWeight: 900, color: T.coralD, lineHeight: 1.05 }}>{countdown > 0 ? countdown : L("开始", "Go")}</div>
          <div style={{ fontSize: 14, color: T.inkSoft, fontWeight: 700, marginTop: 6 }}>
            {cfg.project === "addsub" && cfg.mode === "listen" ? L("🔊 打开声音,用心听～", "🔊 Turn on sound and listen closely") : L("👀 盯住屏幕中间～", "👀 Watch the center of the screen")}
          </div>
        </div>
      )}

      {phase === "playing" && round && <PlayView round={round} cfg={cfg} stepIdx={stepIdx} showTerm={showTerm} flashBatch={flashBatch} flashSteps={flashSteps} onGiveUp={backHome} />}

      {phase === "answer" && round && (
        <div className="flex flex-col gap-3">
          <AnswerPrompt round={round} mode={cfg.mode} />
          <AnswerPad value={input} onChange={setInput} onSubmit={() => submit(input)} onGiveUp={backHome}
            canReplay={round.project === "addsub" && cfg.mode === "listen"} onReplay={() => { setStepIdx(0); setShowTerm(false); setPhase("playing"); }} />
        </div>
      )}

      {phase === "result" && round && result && <ResultView round={round} result={result} onAgain={beginRound} onHome={backHome} />}
    </div>
  );
}

// ---------- 揭示视图 ----------
function PlayView({ round, cfg, stepIdx, showTerm, flashBatch, flashSteps, onGiveUp }: {
  round: Round; cfg: AbacusCfg; stepIdx: number; showTerm: boolean; flashBatch: number; flashSteps: number; onGiveUp: () => void;
}) {
  if (round.project === "bead") {
    return (
      <div className="flex flex-col gap-2">
        <TopBar left={L("看珠记数", "Read the beads")} onGiveUp={onGiveUp} />
        <div className="flex flex-col items-center justify-center" style={{ height: 300, borderRadius: 22, background: "#fff", border: `2px solid ${T.line}` }}>
          {showTerm && round.beadValue != null && <Soroban value={round.beadValue} digits={round.beadDigits} />}
        </div>
      </div>
    );
  }
  // addsub flash / listen
  const isFlash = cfg.mode === "flash";
  const len = round.terms!.length;
  const shownCount = isFlash ? Math.min((stepIdx + 1) * flashBatch, len) : Math.min(stepIdx + 1, len);
  const totalSteps = isFlash ? flashSteps : len;
  const curStep = Math.min(stepIdx + 1, totalSteps);
  const batchStart = stepIdx * flashBatch;
  const batchTerms = isFlash ? round.terms!.slice(batchStart, batchStart + flashBatch) : [];
  const numCls = flashBatch <= 1 ? "text-8xl" : flashBatch === 2 ? "text-7xl" : "text-5xl";
  const iconCls = flashBatch <= 1 ? "h-12 w-12" : flashBatch === 2 ? "h-10 w-10" : "h-7 w-7";
  return (
    <div className="flex flex-col gap-2">
      <TopBar left={L(`第 ${shownCount} / ${len} 笔`, `Term ${shownCount} / ${len}`)} right={isFlash ? `${cfg.speedMs}ms${flashBatch > 1 ? ` ×${flashBatch}` : ""}` : L("🔊 听算", "🔊 Listen")} onGiveUp={onGiveUp} />
      <div style={{ height: 8, background: "#F0E2C4", borderRadius: 999, overflow: "hidden", marginBottom: 4 }}>
        <div style={{ height: "100%", width: `${(curStep / totalSteps) * 100}%`, background: `linear-gradient(90deg, ${T.sun}, ${T.coral})`, borderRadius: 999, transition: "width .2s" }} />
      </div>
      {isFlash ? (
        <div className="flex items-center justify-center" style={{ height: 300, borderRadius: 22, background: `linear-gradient(180deg, #2C3E63, ${STAGE})`, boxShadow: "inset 0 2px 12px rgba(0,0,0,.3)" }}>
          {showTerm && (
            <div key={stepIdx} className="animate-pop-in flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4">
              {batchTerms.map((val, k) => {
                const gi = batchStart + k; const minus = round.signs![gi] === "-";
                return (
                  <div key={gi} className="flex items-center gap-1.5">
                    {minus && <Minus className={iconCls} strokeWidth={4} style={{ color: "#fff" }} />}
                    <span className={cn(numCls, "font-mono-tabular")} style={{ color: "#fff", fontWeight: 800 }}>{val}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center" style={{ height: 300, borderRadius: 22, background: `linear-gradient(180deg, ${T.sky}, ${T.skyD})` }}>
          <div className={cn(showTerm && "animate-bounce")} style={{ fontSize: 78 }}>🔊</div>
          <p style={{ color: "#fff", fontWeight: 800, marginTop: 16, fontSize: 15 }}>{L(`正在报第 ${shownCount} / ${len} 笔,用心算～`, `Reading term ${shownCount} / ${len}, compute in your head`)}</p>
        </div>
      )}
    </div>
  );
}

function TopBar({ left, right, onGiveUp }: { left: string; right?: string; onGiveUp: () => void }) {
  return (
    <div className="flex items-center justify-between" style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 800 }}>
      <span>{left}</span>
      {right && <span>{right}</span>}
      <button onClick={onGiveUp} style={{ color: T.coralD, fontWeight: 800, background: "none", border: "none", cursor: "pointer" }}>{L("放弃", "Give up")}</button>
    </div>
  );
}

// ---------- 作答提示 ----------
function AnswerPrompt({ round, mode }: { round: Round; mode: AbacusMode }) {
  if (round.project === "addsub" && round.terms) {
    // 仅「看算」把竖式显示出来;闪算/听算已逐笔揭示完毕,作答时不再显示算式(否则等于没考记忆)
    const showStack = mode === "glance";
    return (
      <>
        {showStack && round.signs && (
          <div style={{ background: "#fff", border: `2px solid ${T.line}`, borderRadius: 18, padding: 16, marginBottom: 4 }}>
            <div className="flex flex-col items-end gap-0.5 font-mono-tabular" style={{ fontSize: 30, fontWeight: 800, color: T.ink }}>
              {round.terms.map((t, i) => (
                <div key={i}>
                  <span style={{ display: "inline-block", width: "0.7em", marginRight: 12, textAlign: "center" }}>{round.signs![i] === "-" ? "-" : ""}</span>{t}
                </div>
              ))}
              <div style={{ marginTop: 6, height: 4, width: "60%", background: T.ink, borderRadius: 4 }} />
            </div>
          </div>
        )}
        <div style={{ textAlign: "center", fontSize: 15, fontWeight: 800, color: T.coralD }}>
          {showStack ? L("🤔 答案是多少?", "🤔 What's the answer?") : L("🤔 都记住了吗?填答案～", "🤔 Remember them all? Enter the answer")}
        </div>
      </>
    );
  }
  if (round.project === "multiply" || round.project === "divide") {
    return (
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div className="font-mono-tabular" style={{ fontSize: "clamp(38px,10vw,64px)", fontWeight: 900, color: T.ink }}>
          {round.a} <span style={{ color: round.project === "multiply" ? T.skyD : T.grapeD }}>{round.op}</span> {round.b}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.coralD, marginTop: 4 }}>= ?</div>
      </div>
    );
  }
  // bead
  return <div style={{ textAlign: "center", fontSize: 16, fontWeight: 800, color: T.coralD }}>{L("🤔 刚才的算盘是几?", "🤔 What number was on the abacus?")}</div>;
}

// ---------- 结果 ----------
function ResultView({ round, result, onAgain, onHome }: {
  round: Round; result: { correct: boolean; score: number; answered: number | null }; onAgain: () => void; onHome: () => void;
}) {
  const ok = result.correct;
  return (
    <div style={{ position: "relative", overflow: "hidden" }} className="flex flex-col items-center gap-3">
      {ok && (
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {["🎉", "⭐", "🎊", "✨", "🌟", "🎉", "⭐", "✨"].map((e, i) => (
            <span key={i} className="animate-bounce" style={{ position: "absolute", top: `${6 + (i % 3) * 10}%`, left: `${8 + i * 11}%`, fontSize: 22, animationDelay: `${i * 0.12}s` }}>{e}</span>
          ))}
        </div>
      )}
      <div style={{ fontSize: 64, marginTop: 4 }} className="animate-pop-in">{ok ? "🎉" : "💪"}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: ok ? T.grassD : T.coralD }}>{ok ? L("答对啦！太棒了", "Correct! Great job") : L("差一点点,再试试～", "So close, try again")}</div>
      <div style={{ fontSize: 42, fontWeight: 900, color: ok ? T.sunD : T.inkSoft }} className="font-mono-tabular">{ok ? `+${result.score}` : "0"} <span style={{ fontSize: 16 }}>{L("分", "pts")}</span></div>
      <div style={{ background: "#fff", border: `2px solid ${T.line}`, borderRadius: 18, padding: 16, width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div className="flex items-center justify-center gap-8">
          <div>
            <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700 }}>{L("正确答案", "Correct answer")}</div>
            <div className="font-mono-tabular" style={{ fontSize: 26, fontWeight: 900, color: T.grassD }}>{round.answer}</div>
          </div>
          {!ok && (
            <div>
              <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700 }}>{L("你的答案", "Your answer")}</div>
              <div className="font-mono-tabular" style={{ fontSize: 26, fontWeight: 900, color: T.coralD }}>{result.answered ?? "—"}</div>
            </div>
          )}
        </div>
        <div className="font-mono-tabular" style={{ marginTop: 12, fontSize: 14, color: T.inkSoft, wordBreak: "break-word" }}>{round.exprStr} = {round.answer}</div>
      </div>
      <div className="flex items-center gap-3" style={{ marginTop: 2 }}>
        <button onClick={onHome} style={{ background: "#fff", color: T.ink, border: `2px solid ${T.line}`, borderRadius: 999, padding: "11px 22px", fontWeight: 800, cursor: "pointer" }}>{L("返回项目", "Projects")}</button>
        <button onClick={onAgain} style={{ ...candyBtn(T.grass, T.grassD), padding: "11px 26px", fontSize: 16, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <RotateCcw className="h-4 w-4" /> {L("再来一题", "Next one")}
        </button>
      </div>
    </div>
  );
}

// ---------- 参数弹窗 ----------
function ParamModal({ cfg, set, project, onCancel, onStart, mistakeMode, onMistakeModeChange }: {
  cfg: AbacusCfg; set: (p: Partial<AbacusCfg>) => void; project: Project; onCancel: () => void; onStart: () => void;
  mistakeMode: boolean; onMistakeModeChange?: (v: boolean) => void;
}) {
  const label = projLabelOf(project);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(40,30,20,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", background: `radial-gradient(120% 100% at 50% 0%, #FFFDF7, ${T.cream})`, border: `2px solid ${T.line}`, borderRadius: 24, boxShadow: "0 20px 50px rgba(0,0,0,.3)", padding: 20 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: T.coralD }}>{label} · {L("参数设置", "Settings")}</div>
          <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft }}><X className="h-5 w-5" /></button>
        </div>

        {project === "addsub" && <AddsubParams cfg={cfg} set={set} mistakeMode={mistakeMode} onMistakeModeChange={onMistakeModeChange} />}
        {project === "multiply" && (
          <div className="grid grid-cols-2 gap-2.5">
            <Card label={L("被乘数位数", "Multiplicand digits")} emoji="✖️"><MiniStepper value={cfg.aDigits} min={1} max={6} suffix={L("位", "dig")} color={T.sky} onChange={(v) => set({ aDigits: v })} /></Card>
            <Card label={L("乘数位数", "Multiplier digits")} emoji="✖️"><MiniStepper value={cfg.bDigits} min={1} max={6} suffix={L("位", "dig")} color={T.sky} onChange={(v) => set({ bDigits: v })} /></Card>
          </div>
        )}
        {project === "divide" && (
          <div className="grid grid-cols-2 gap-2.5">
            <Card label={L("除数位数", "Divisor digits")} emoji="➗"><MiniStepper value={cfg.divisorDigits} min={1} max={4} suffix={L("位", "dig")} color={T.grape} onChange={(v) => set({ divisorDigits: v })} /></Card>
            <Card label={L("商位数", "Quotient digits")} emoji="➗"><MiniStepper value={cfg.quotientDigits} min={1} max={5} suffix={L("位", "dig")} color={T.grape} onChange={(v) => set({ quotientDigits: v })} /></Card>
          </div>
        )}
        {project === "bead" && (
          <div className="grid grid-cols-2 gap-2.5">
            <Card label={L("位数", "Digits")} emoji="🧮"><MiniStepper value={cfg.beadDigits} min={1} max={5} suffix={L("位", "dig")} color={T.grass} onChange={(v) => set({ beadDigits: v })} /></Card>
            <Card label={L("显示时长", "Show time")} emoji="⏱️" hint={L("毫秒", "ms")}>
              <div className="flex flex-wrap items-center gap-1.5">
                {[800, 1500, 2500, 4000].map((ms) => (
                  <Pill key={ms} on={cfg.beadSpeedMs === ms} color={T.grass} onClick={() => set({ beadSpeedMs: ms })}>{(ms / 1000).toFixed(1)}s</Pill>
                ))}
              </div>
            </Card>
          </div>
        )}

        <div style={{ marginTop: 12, background: "#FFFBF0", border: `2px dashed ${T.sun}66`, borderRadius: 16, padding: "9px 14px" }} className="flex items-center justify-between">
          <span style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 700 }}>🏆 {L("答对一题可得", "Points per correct answer")}</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: T.sunD }}>{previewScore(cfg)} {L("分", "pts")}</span>
        </div>

        <div className="flex items-center gap-3" style={{ marginTop: 16 }}>
          <button onClick={onCancel} style={{ flex: 1, background: "#fff", color: T.ink, border: `2px solid ${T.line}`, borderRadius: 999, padding: "13px", fontWeight: 800, cursor: "pointer" }}>{L("取消", "Cancel")}</button>
          <button onClick={onStart} style={{ ...candyBtn(T.coral, T.coralD), flex: 2, padding: "14px", fontSize: 17, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Play className="h-5 w-5" fill="#fff" /> {L("开始闯关", "Start")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddsubParams({ cfg, set, mistakeMode, onMistakeModeChange }: {
  cfg: AbacusCfg; set: (p: Partial<AbacusCfg>) => void; mistakeMode: boolean; onMistakeModeChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {onMistakeModeChange && (
        <label className="flex items-center justify-end gap-2" style={{ fontSize: 12, color: T.inkSoft, fontWeight: 700 }}>
          <span>{L("只练错题", "Mistakes only")}</span><Switch checked={mistakeMode} onCheckedChange={onMistakeModeChange} />
        </label>
      )}
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => {
          const on = cfg.mode === m.id;
          return (
            <button key={m.id} onClick={() => set({ mode: m.id })}
              style={{ borderRadius: 16, padding: "10px 6px", cursor: "pointer", textAlign: "center", border: `2.5px solid ${on ? m.cD : T.line}`, background: on ? `linear-gradient(180deg, ${m.c}, ${m.cD})` : "#fff", color: on ? "#fff" : T.ink, boxShadow: on ? `0 4px 0 ${m.cD}` : "0 3px 0 #EADBBD" }}>
              <div style={{ fontSize: 22 }}>{m.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>{L(m.label, m.en)}</div>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Card label={L("位数", "Digits")} emoji="🔢" hint={L("可范围", "range")}>
          <div className="flex flex-col gap-2">
            <Row label={L("最小", "Min")}><MiniStepper value={cfg.minDigits} min={1} max={9} suffix={L("位", "dig")} color={T.sky} onChange={(v) => set({ minDigits: v })} /></Row>
            <Row label={L("最大", "Max")}><MiniStepper value={cfg.maxDigits} min={1} max={9} suffix={L("位", "dig")} color={T.sky} onChange={(v) => set({ maxDigits: v })} /></Row>
          </div>
        </Card>
        <Card label={L("笔数", "Terms")} emoji="✏️" hint="1–200">
          <div className="flex flex-wrap items-center gap-1.5">
            {COUNT_PRESETS.map((n) => (<Pill key={n} on={cfg.count === n} color={T.grass} onClick={() => set({ count: n })}>{n}</Pill>))}
            <NumInput value={COUNT_PRESETS.includes(cfg.count) ? null : cfg.count} min={1} max={200} onCommit={(v) => set({ count: v })} />
          </div>
        </Card>
        <Card label={L("加减类型", "Type")} emoji="➕">
          <div className="flex flex-wrap items-center gap-1.5">
            {ADDSUB_OPTIONS.map((o) => (<Pill key={o.id} on={cfg.addsub === o.id} color={T.coral} onClick={() => set({ addsub: o.id })}>{L(o.label, o.en)}</Pill>))}
          </div>
        </Card>
        {cfg.mode === "flash" && (
          <Card label={L("单笔时间", "Per term")} emoji="⚡" hint={L("越小越快", "smaller = faster")}>
            <div className="flex flex-wrap items-center gap-1.5">
              {SPEED_PRESETS.map((s) => (<Pill key={s.value} on={cfg.speedMs === s.value} color={T.sun} onClick={() => set({ speedMs: s.value })}>{L(s.label, s.en)}</Pill>))}
              <span style={{ fontSize: 10, color: T.inkSoft }}>{L("或", "or")}</span>
              <SecInput value={SPEED_PRESETS.some((s) => s.value === cfg.speedMs) ? null : cfg.speedMs} onCommit={(ms) => set({ speedMs: ms })} />
            </div>
          </Card>
        )}
        {cfg.mode === "listen" && (
          <Card label={L("语速", "Speed")} emoji="🔊">
            <div className="flex flex-wrap items-center gap-1.5">
              {LISTEN_PRESETS.map((s) => (<Pill key={s.value} on={cfg.listenLevel === s.value} color={T.sky} onClick={() => set({ listenLevel: s.value })}>{L(s.label, s.en)}</Pill>))}
            </div>
          </Card>
        )}
        {cfg.mode === "flash" && (
          <Card label={L("显示笔数", "Terms per flash")} emoji="🎞️" hint={L("可一次闪多笔", "flash several at once")}>
            <MiniStepper value={cfg.flashBatch} min={1} max={Math.max(1, Math.min(10, cfg.count))} suffix={L("笔", "terms")} color={T.grape} onChange={(v) => set({ flashBatch: v })} />
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------- 作答面板 ----------
function AnswerPad({ value, onChange, onSubmit, onGiveUp, canReplay, onReplay }: {
  value: string; onChange: (v: string | ((prev: string) => string)) => void; onSubmit: () => void; onGiveUp: () => void; canReplay?: boolean; onReplay?: () => void;
}) {
  const append = (d: string) => onChange((prev) => (prev + d).slice(0, 12));
  const back = () => onChange((prev) => prev.slice(0, -1));
  const clear = () => onChange("");
  // 物理键盘同样可用
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") append(e.key);
      else if (e.key === "Backspace") back();
      else if (e.key === "Enter") onSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSubmit]); // eslint-disable-line

  const key = (label: string, onClick: () => void, tone?: "muted"): CSSProperties => ({
    height: 52, borderRadius: 14, fontSize: 24, fontWeight: 800, cursor: "pointer",
    border: `2px solid ${T.line}`, background: tone === "muted" ? "#FBF3E3" : "#fff",
    color: tone === "muted" ? T.inkSoft : T.ink, boxShadow: "0 3px 0 #EADBBD",
    fontFamily: "var(--font-num, inherit)",
  });

  return (
    <div className="flex flex-col gap-3">
      {/* 答案显示 */}
      <div className="font-mono-tabular" style={{ minHeight: 62, borderRadius: 16, border: `3px solid ${T.sun}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 900, color: value ? T.ink : "#D9C7A6" }}>
        {value || "?"}
      </div>
      {/* 数字键盘 */}
      <div className="grid grid-cols-5 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => (
          <button key={d} style={key(d, () => append(d))} onClick={() => append(d)}>{d}</button>
        ))}
        <button style={{ ...key("清除", clear, "muted"), gridColumn: "span 2" }} onClick={clear}>{L("清除", "Clear")}</button>
        <button style={{ ...key("退格", back, "muted"), gridColumn: "span 3" }} onClick={back}>⌫ {L("退格", "Back")}</button>
      </div>
      <div className="flex items-center gap-2.5">
        <button onClick={onSubmit} disabled={!value.trim()} style={{ ...candyBtn(T.coral, T.coralD), flex: 1, padding: "14px", fontSize: 17, opacity: value.trim() ? 1 : 0.5 }}>{L("提交", "Submit")} ✓</button>
        {canReplay && (
          <button onClick={onReplay} style={{ background: "#fff", color: T.skyD, border: `2px solid ${T.sky}`, borderRadius: 999, padding: "12px 16px", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Volume2 className="h-4 w-4" /> {L("再听一遍", "Replay")}
          </button>
        )}
      </div>
      <button onClick={onGiveUp} style={{ textAlign: "center", fontSize: 12, color: T.inkSoft, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>{L("放弃本局", "Quit this round")}</button>
    </div>
  );
}

// ---------- 小组件 ----------
function Bunting() {
  const colors = [T.coral, T.sun, T.grass, T.sky, T.grape];
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 12, borderTop: `2px dashed ${T.line}`, paddingTop: 8 }}>
      {Array.from({ length: 13 }).map((_, i) => (
        <span key={i} style={{ width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: `15px solid ${colors[i % colors.length]}`, filter: "drop-shadow(0 2px 1px rgba(0,0,0,.10))" }} />
      ))}
    </div>
  );
}
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
  return (<div className="flex items-center gap-2"><span style={{ width: 26, fontSize: 10.5, color: T.inkSoft, fontWeight: 700 }}>{label}</span>{children}</div>);
}
function Pill({ on, color, onClick, children }: { on: boolean; color: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{ borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", border: `2px solid ${on ? color : T.line}`, background: on ? color : "#fff", color: on ? "#fff" : T.inkSoft, boxShadow: on ? `0 3px 8px ${color}55` : "none" }}>{children}</button>
  );
}
function MiniStepper({ value, min, max, suffix, color, onChange }: { value: number; min: number; max: number; suffix?: string; color: string; onChange: (v: number) => void; }) {
  const btn = (disabled: boolean): CSSProperties => ({ width: 28, height: 28, borderRadius: 999, border: "none", cursor: disabled ? "default" : "pointer", background: disabled ? "#EDE0C6" : color, color: "#fff", fontSize: 17, fontWeight: 900, lineHeight: 1, opacity: disabled ? 0.5 : 1 });
  return (
    <div className="inline-flex items-center gap-2">
      <button style={btn(value <= min)} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="font-mono-tabular" style={{ minWidth: 22, textAlign: "center", fontSize: 16, fontWeight: 900, color: T.ink }}>{value}</span>
      <button style={btn(value >= max)} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      {suffix && <span style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 700 }}>{suffix}</span>}
    </div>
  );
}
function NumInput({ value, min, max, onCommit }: { value: number | null; min: number; max: number; onCommit: (v: number) => void; }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => { setText(value === null ? "" : String(value)); }, [value]);
  const commit = (raw: string) => { const n = parseInt(raw.replace(/[^\d]/g, ""), 10); if (!isNaN(n)) onCommit(Math.min(max, Math.max(min, n))); };
  return (
    <input inputMode="numeric" value={text} placeholder={L("自定", "Custom")} onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="font-mono-tabular" style={{ height: 30, width: 46, borderRadius: 10, border: `2px solid ${T.line}`, background: "#fff", textAlign: "center", fontSize: 12.5, fontWeight: 800, color: T.ink, outline: "none" }} />
  );
}

// 秒输入(0.01 步进)→ 提交毫秒。范围 0.1~5 秒。
function SecInput({ value, onCommit }: { value: number | null; onCommit: (ms: number) => void }) {
  const toSec = (ms: number | null) => (ms == null ? "" : String(+(ms / 1000).toFixed(2)));
  const [text, setText] = useState(toSec(value));
  useEffect(() => { setText(toSec(value)); }, [value]);
  const commit = (raw: string) => {
    const n = parseFloat(raw.replace(/[^\d.]/g, ""));
    if (!isNaN(n)) onCommit(Math.min(5000, Math.max(100, Math.round(n * 1000))));
  };
  return (
    <div className="flex items-center gap-1">
      <input inputMode="decimal" value={text} placeholder={L("自定", "Custom")} onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="font-mono-tabular" style={{ height: 30, width: 50, borderRadius: 10, border: `2px solid ${T.line}`, background: "#fff", textAlign: "center", fontSize: 12.5, fontWeight: 800, color: T.ink, outline: "none" }} />
      <span style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 700 }}>{L("秒", "s")}</span>
    </div>
  );
}
