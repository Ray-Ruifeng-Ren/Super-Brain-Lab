// 官网「体验珠象 AI」(2026-11-05 用户「体验一下我们的 AI 技术有多强,单独突出」):
// 直接调用产品里的真实引擎 —— ① 按珠判类:fingerTeach.buildLesson 逐档模拟珠态、判出每一笔的指法;② 定向出题:fingering.generateCoachProblem 只出目标指法。
import { useEffect, useMemo, useState } from "react";
import { buildLesson, beadsOf, RHYME, RHYME_EN, type Lesson } from "@/lib/fingerTeach";
import { COACH_STAGES, generateCoachProblem, classesOfProblem, type FingeringClass } from "@/lib/fingering";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useL } from "./SiteShell";

const PRESETS = ["12-6", "3+9", "46+38", "71-27", "8+7-9"];
const PLACE = ["个", "十", "百", "千", "万"];
const PLACE_EN = ["1s", "10s", "100s", "1000s", "10k"];
/** 八类指法的英文名(与出题系统「Fingering」一栏用词一致);「拨入」= set */
const CLASS_EN: Record<string, string> = { 拨入: "Set", 直加: "Direct +", 直减: "Direct −", 满五加: "Five-complement +", 破五减: "Five-complement −", 进位加: "Carry +", 破五进位加: "Five & carry +", 退位减: "Borrow −", 退位满五减: "Borrow & five −" };
const STAGE_EN: Record<number, string> = { 1: "Direct +/−", 2: "Five-complement +", 3: "Five-complement −", 4: "Carry +", 5: "Five & carry +", 6: "Borrow −", 7: "Borrow & five −" };

/** 一把算盘(n 档);hot = 本步拨动的档 */
export function Abacus({ digits, hot }: { digits: number[]; hot: Set<number> }) {
  const { lang } = useI18n();
  const n = digits.length, RW = 64, W = n * RW + 40;
  return (
    <svg viewBox={`0 0 ${W} 250`} className="h-auto w-full max-w-[200px]" role="img" aria-label="算盘珠态">
      <rect x="10" y="8" width={W - 20} height="222" rx="6" fill="none" stroke="var(--ink)" strokeWidth="5" />
      <line x1="10" y1="72" x2={W - 10} y2="72" stroke="var(--ink)" strokeWidth="5" />
      {digits.map((d, i) => {
        const rod = n - 1 - i, cx = 20 + i * RW + RW / 2, on = hot.has(rod), { upper, lower } = beadsOf(d);
        const col = on ? "var(--accent)" : "var(--ink)";
        const bead = (y: number, active: boolean, k: string) => <ellipse key={k} cx={cx} cy={y} rx="22" ry="11" fill={active ? col : "none"} stroke={active ? col : "var(--line-strong)"} strokeWidth="1.6" style={{ transition: "cy .45s cubic-bezier(.2,.7,.2,1), fill .3s" }} />;
        return (
          <g key={i}>
            <line x1={cx} y1="12" x2={cx} y2="226" stroke={on ? "var(--accent)" : "var(--line-strong)"} strokeWidth={on ? 2.4 : 1.6} />
            {bead(upper ? 58 : 26, !!upper, "u")}
            {[0, 1, 2, 3].map((k) => bead(k < lower ? 88 + k * 24 : 120 + k * 24, k < lower, `l${k}`))}
            <text x={cx} y="246" textAnchor="middle" fontSize="11" fill="var(--muted)">{(lang === "en" ? PLACE_EN : PLACE)[rod] ?? ""}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Classify() {
  const L = useL(); const { lang } = useI18n();
  const [expr, setExpr] = useState("12-6"), [step, setStep] = useState(0);
  const { lesson, ms } = useMemo(() => { const t = performance.now(); const l = buildLesson(expr, lang); return { lesson: "error" in l ? null : (l as Lesson), ms: performance.now() - t }; }, [expr, lang]);
  useEffect(() => { setStep(0); }, [expr]);
  useEffect(() => { if (!lesson) return; const t = setInterval(() => setStep((s) => (s + 1) % (lesson.steps.length + 2)), 1500); return () => clearInterval(t); }, [lesson]);
  const cur = lesson ? Math.min(step, lesson.steps.length - 1) : 0;
  const digits = useMemo(() => {
    if (!lesson) return [0];
    const v = Array(lesson.rods).fill(0);
    lesson.steps.slice(0, cur + 1).forEach((s) => s.actions.forEach((a) => { v[a.rod] = a.after; }));
    return [...v].reverse();
  }, [lesson, cur]);
  const hot = new Set(lesson?.steps[cur]?.actions.map((a) => a.rod) ?? []);
  const s = lesson?.steps[cur];
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
      <div className="flex flex-col items-center">
        <Abacus digits={digits} hot={hot} />
        <p className="mt-3 font-mono text-xs text-[var(--muted)]">{lesson ? `${lesson.expr} = ${lesson.answer}` : "—"}</p>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={expr} onChange={(e) => setExpr(e.target.value.replace(/[^\d+\-−]/g, "").slice(0, 16))} className="w-36 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]" placeholder="输入算式" aria-label="输入加减算式" />
          {PRESETS.map((p) => <button key={p} onClick={() => setExpr(p)} className={cn("rounded-md border px-2.5 py-1.5 font-mono text-xs transition", expr === p ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]" : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--ink)]")}>{p}</button>)}
        </div>
        {!lesson ? <p className="mt-6 text-sm text-[var(--muted)]">{L("请输入两位以内的加减算式,如 12-6", "Enter an addition or subtraction with numbers up to two digits, e.g. 12-6")}</p> : (
          <>
            <ol className="mt-6 space-y-1.5">
              {lesson.steps.map((x, i) => (
                <li key={i} className={cn("flex items-baseline gap-3 rounded-md px-3 py-2 text-sm transition-colors", i === cur ? "bg-[var(--surface)] shadow-[inset_2px_0_0_var(--accent)]" : "opacity-55")}>
                  <span className="w-12 font-mono text-[var(--ink)]">{x.label}</span>
                  <span className={cn("font-medium", i === cur ? "text-[var(--accent)]" : "text-[var(--ink)]")}>{L(x.cls, CLASS_EN[x.cls] ?? x.cls)}</span>
                </li>
              ))}
            </ol>
            {s && s.cls !== "拨入" && <p className="mt-4 border-l border-[var(--line-strong)] pl-3 text-xs leading-relaxed text-[var(--muted)]">{(lang === "en" ? RHYME_EN : RHYME)[s.cls as FingeringClass]}</p>}
            <p className="mt-5 font-mono text-[11px] tracking-wide text-[var(--muted)]">{L("引擎逐档模拟珠态 · 判类耗时", "Rod-by-rod bead simulation · classified in")} {ms < 1 ? "< 1" : ms.toFixed(1)} ms</p>
          </>
        )}
      </div>
    </div>
  );
}

function Generate() {
  const L = useL();
  const [stage, setStage] = useState(7), [seed, setSeed] = useState(0);
  const { probs, ms } = useMemo(() => {
    const t = performance.now();
    const probs = Array.from({ length: 4 }, () => generateCoachProblem(stage, 5, 1));
    return { probs, ms: performance.now() - t };
  }, [stage, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = COACH_STAGES.find((x) => x.id === stage)!;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {COACH_STAGES.map((st) => <button key={st.id} onClick={() => setStage(st.id)} className={cn("rounded-md border px-3 py-1.5 text-xs transition", stage === st.id ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]" : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--ink)]")}>{L(st.name, STAGE_EN[st.id])}</button>)}
        <button onClick={() => setSeed((x) => x + 1)} className="ml-auto rounded-md border border-[var(--accent)] px-3 py-1.5 text-xs text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--bg)]">{L("换一组", "New set")}</button>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {probs.map((p, i) => {
          const cls = classesOfProblem(p.terms, p.signs);
          const hit = cls.filter((c) => target.target.includes(c)).length;
          return (
            <div key={i} className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="space-y-0.5 text-right font-mono text-lg leading-snug text-[var(--ink)]">
                {p.terms.map((t, k) => <div key={k}>{k > 0 ? (p.signs[k] === "-" ? "−" : "+") : ""}{t}</div>)}
                <div className="mt-1 border-t border-[var(--line-strong)] pt-1 text-[var(--accent)]">{p.answer}</div>
              </div>
              <p className="mt-3 text-[11px] text-[var(--muted)]">{L(`目标指法 ${hit} 次`, `target fingering × ${hit}`)}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-5 font-mono text-[11px] tracking-wide text-[var(--muted)]">{L(`约束出题引擎 · 每一笔逐档校验指法 · 4 题耗时 ${ms.toFixed(1)} ms · 规则:${target.formula}`, `Constrained generator · every stroke checked rod by rod · 4 problems in ${ms.toFixed(1)} ms · target: ${STAGE_EN[stage]}`)}</p>
    </div>
  );
}

export function AiPlayground() {
  const L = useL();
  const [tab, setTab] = useState<"c" | "g">("c");
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-10">
      <div className="mb-8 flex gap-6 border-b border-[var(--line)] text-sm">
        {([["c", L("按珠判类", "Classify by beads")], ["g", L("定向出题", "Targeted problems")]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("-mb-px border-b-2 pb-3 transition-colors", tab === k ? "border-[var(--accent)] text-[var(--ink)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]")}>{l}</button>
        ))}
        <span className="ml-auto hidden pb-3 font-mono text-[11px] text-[var(--muted)] sm:block">LIVE · {L("运行在你的浏览器里", "running in your browser")}</span>
      </div>
      {tab === "c" ? <Classify /> : <Generate />}
    </div>
  );
}
