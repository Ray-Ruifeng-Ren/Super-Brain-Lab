// AI 陪练面板(2026-11-08 用户「AI 陪练做的可视化更好一些、更高级一些」,网页 + Pad):
//   ① 指法进阶地图:七关连成一条路径,每关一个进度环(近 N 题答对 / 通关所需),已通关金色 ✓,当前关呼吸光圈,点任意关跳练;
//   ② 本关面板:正确率大环 + 最近 20 题对错时间线 + 判定 / 口诀 + 小课;
//   ③ 指法掌握度:八类指法掌握条(1 − 错误率),最弱的一类标「建议专练」,点了直接去那一关。
// 数据都在本机:fingering.loadCoachProgress(每关近 N 题对错)+ classMastery(每类出现 / 答错次数)。
import { Check, Sparkles } from "lucide-react";
import { COACH_STAGES, classMastery, stageForClass, stageWindow, type CoachProgress, type FingeringClass } from "@/lib/fingering";
import { cn } from "@/lib/utils";

type CoachStage = (typeof COACH_STAGES)[number];
const CLASSES: FingeringClass[] = ["直加", "直减", "满五加", "破五减", "进位加", "破五进位加", "退位减", "退位满五减"];

/** 进度环(SVG):value 0–1;size px */
function Ring({ value, size, stroke, className, track = "hsl(var(--muted))", children }: { value: number; size: number; stroke: number; className?: string; track?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.3,.7,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function CoachPanel({ prog, stage, lessonIdx, onStage, onLesson, T, tx }: {
  prog: CoachProgress; stage: CoachStage; lessonIdx: number;
  onStage: (id: number) => void; onLesson: (stageId: number, gi: number) => void;
  T: (zh: string, en: string) => string; tx: (s: string) => string;
}) {
  const win = stageWindow(prog, stage.id);
  const recent = (prog.recent[stage.id] ?? []).slice(-20);
  const acc = win.done ? win.correct / win.done : 0;
  const mastery = classMastery();
  const rows = CLASSES.map((c) => { const e = mastery[c]; return { c, n: e?.n ?? 0, rate: e && e.n ? 1 - e.wrong / e.n : null }; });
  const weak = rows.filter((r) => r.n >= 10 && r.rate != null && r.rate < 0.85).sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1))[0];
  const passedN = prog.passed.length;

  return (
    <div className="overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-card via-card to-primary/[0.06] shadow-sm">
      {/* 标题条 */}
      <div className="flex items-center gap-2 border-b border-primary/15 px-3 py-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-black tracking-wide">{T("AI 陪练 · 指法进阶", "AI Coach · Fingering path")}</span>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{T(`已通关 ${passedN} / 7`, `${passedN} / 7 passed`)}</span>
      </div>

      {/* ① 进阶地图 */}
      <div className="relative px-2 pb-1 pt-3">
        <div className="absolute left-[7%] right-[7%] top-[30px] h-[3px] rounded bg-muted" />
        <div className="absolute left-[7%] top-[30px] h-[3px] rounded bg-gradient-to-r from-primary/70 to-primary transition-all duration-700"
          style={{ width: `${(86 * Math.max(0, Math.min(6, Math.max(passedN, stage.id - 1)))) / 6}%` }} />
        <div className="relative grid grid-cols-7">
          {COACH_STAGES.map((st) => {
            const passed = prog.passed.includes(st.id), current = st.id === stage.id, w = stageWindow(prog, st.id);
            const v = passed ? 1 : w.need ? w.correct / w.need : 0;
            return (
              <button key={st.id} onClick={() => onStage(st.id)} title={`${tx(st.name)} · ${tx(st.formula)}`} className="group flex flex-col items-center gap-1">
                <div className="relative">
                  {current && <span className="absolute inset-[-5px] animate-ping rounded-full bg-primary/15" style={{ animationDuration: "2.4s" }} />}
                  <Ring value={v} size={current ? 40 : 34} stroke={current ? 4 : 3} track={passed ? "hsl(var(--primary) / .25)" : "hsl(var(--muted))"}
                    className={cn("rounded-full bg-card transition-transform group-hover:scale-105", passed ? "text-amber-500" : "text-primary")}>
                    {passed ? <span className="flex h-[70%] w-[70%] items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-inner"><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></span>
                      : <span className={cn("text-[12px] font-black", current ? "text-primary" : "text-muted-foreground")}>{st.id}</span>}
                  </Ring>
                </div>
                <span className={cn("max-w-full truncate px-0.5 text-[10px] leading-tight", current ? "font-bold text-primary" : passed ? "text-foreground" : "text-muted-foreground")}>{tx(st.short)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ② 本关 */}
      <div className="mx-3 mb-2 mt-1 grid gap-3 rounded-lg border border-primary/20 bg-background/60 p-2.5 sm:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-3">
          <Ring value={acc} size={64} stroke={6} className="text-primary">
            <div className="text-center leading-none"><div className="font-mono-tabular text-[15px] font-black">{win.done ? Math.round(acc * 100) : "—"}<span className="text-[9px]">{win.done ? "%" : ""}</span></div><div className="mt-0.5 text-[8px] text-muted-foreground">{T("正确率", "accuracy")}</div></div>
          </Ring>
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">{T(`近 ${win.done}/${win.need} 题 · 达 80% 通关`, `Last ${win.done}/${win.need} · 80% to pass`)}</div>
            {/* 最近 20 题对错时间线 */}
            <div className="grid w-[178px] grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]">
              {Array.from({ length: 20 }, (_, i) => { const r = recent[i - (20 - recent.length)]; return <span key={i} className={cn("h-2.5 rounded-sm", r === undefined ? "bg-muted" : r ? "bg-emerald-500" : "bg-rose-500")} />; })}
            </div>
            <div className="text-[9px] text-muted-foreground">{T("最近 20 题(左旧 → 右新)", "Last 20 (old → new)")}</div>
          </div>
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[13px] font-black text-primary">{T(`第${stage.id}关`, `Stage ${stage.id}`)} · {tx(stage.name)}</span>
            <span className="text-[11px] text-muted-foreground">{tx(stage.rule)}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[12px]"><span className="text-[10px] font-semibold text-primary">{T("口诀", "Rule")}</span><b className="tracking-wide">{tx(stage.formula)}</b></div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">{T("小课", "Lesson")}</span>
            {[{ label: "全部", gi: -1 }, ...stage.variantGroups.map((g, gi) => ({ label: g.label, gi }))].map(({ label, gi }) => (
              <button key={gi} onClick={() => onLesson(stage.id, gi)} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors", lessonIdx === gi ? "bg-primary text-primary-foreground shadow-sm" : "border border-border text-muted-foreground hover:text-foreground")}>{tx(label)}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ③ 指法掌握度 */}
      <div className="border-t border-primary/15 px-3 pb-2.5 pt-2">
        <div className="mb-1.5 flex items-center gap-2 text-[11px]">
          <span className="font-semibold">{T("指法掌握度", "Fingering mastery")}</span>
          {weak ? <button onClick={() => onStage(stageForClass(weak.c))} className="ml-auto rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-500/20">{T(`建议专练「${weak.c}」→ 第${stageForClass(weak.c)}关`, `Practice “${tx(weak.c)}” → Stage ${stageForClass(weak.c)}`)}</button>
            : <span className="ml-auto text-[10px] text-muted-foreground">{T("每类答满 10 次后显示", "shown after 10 tries per type")}</span>}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          {rows.map((r) => {
            const pct = r.rate == null ? 0 : Math.round(r.rate * 100), ok = r.n >= 10;
            return (
              <div key={r.c} className="min-w-0">
                <div className="flex items-baseline justify-between text-[10px]"><span className={cn("truncate", weak?.c === r.c && "font-bold text-rose-600")}>{tx(r.c)}</span><span className="font-mono-tabular text-muted-foreground">{ok ? `${pct}%` : r.n ? `${r.n}${T("次", "")}` : "—"}</span></div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all duration-700", !ok ? "bg-muted-foreground/30" : pct >= 90 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${ok ? pct : Math.min(100, r.n * 10)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
