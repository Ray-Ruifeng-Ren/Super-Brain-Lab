// 数珠互译(学生端,2026-10-13 用户「和演示模式一样」):同款配置表单 + 同款全屏作答器(HomeworkRunner 学生模式)。
// 成绩:首轮每道答对的题按珠心算记分规则入 abacus 榜(mode=bead-Nd),每题都记 practice_attempts(错题本可用)。
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { HwItemEditor, newItem } from "@/components/HwItemEditor";
import { HomeworkRunner } from "@/components/HomeworkRunner";
import { genProblems, itemLabel, type HwItem, type HwProblem, type HwResult } from "@/lib/homework";
import { computeScore, abacusMode, DEFAULT_ABACUS_CFG, type AbacusCfg } from "@/lib/abacus";
import { submitScore } from "@/lib/leaderboard";
import { logAttempt } from "@/lib/practiceLog";
import { useTx } from "@/lib/tx";

const KEY = "bead:item";

export function BeadTrain({ onFinished, onCfgChange }: { onFinished?: () => void; onCfgChange?: (cfg: AbacusCfg) => void }) {
  const tx = useTx();
  const [item, setItem] = useState<HwItem>(() => { try { return newItem({ n: 10, ...JSON.parse(localStorage.getItem(KEY) || "{}"), project: "bead" }); } catch { return newItem({ project: "bead", n: 10 }); } });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(item)); } catch { /* noop */ } }, [item]);
  // 排行榜按 mode(bead-Nd)查记录,把当前位数同步给页面(2026-10-13「排行榜全空了」修复)
  useEffect(() => { onCfgChange?.({ ...DEFAULT_ABACUS_CFG, project: "bead", beadDigits: item.beadDigits, beadSpeedMs: item.beadSpeedMs }); }, [item.beadDigits, item.beadSpeedMs, onCfgChange]);
  const [run, setRun] = useState<{ item: HwItem; problems: HwProblem[] } | null>(null);

  const onRoundDone = async (results: HwResult[], round: number) => {
    const cfg = { ...DEFAULT_ABACUS_CFG, project: "bead" as const, beadDigits: item.beadDigits, beadSpeedMs: item.beadSpeedMs };
    const mode = abacusMode(cfg) + (item.beadDir === "see" ? "-see" : ""); // 看数(数码秒记)单独记榜,不和珠→数混排
    for (const r of results) {
      await logAttempt({ game: "abacus", mode, terms: [r.answer], signs: [], answer: r.answer, userAnswer: r.given, correct: r.correct, usedMs: r.ms });
      if (r.correct && round === 0) await submitScore({ game: "abacus", mode, value: computeScore(cfg, true), meta: { project: "bead", dir: item.beadDir } });
    }
    onFinished?.();
  };

  return (
    <>
      <div className="hw-lg hw-compact rounded-3xl border border-border bg-card p-4 md:p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-2xl font-black">🧮 {tx("数珠互译")}</h2>
          <span className="text-sm text-muted-foreground">{tx("珠 → 数:看珠码报数字 · 数码秒记:看完写出来")}</span>
        </div>
        <HwItemEditor value={item} onChange={(it) => setItem({ ...it, project: "bead" })} hideProject />
        <button onClick={() => setRun({ item, problems: genProblems(item) })} className="sticky bottom-[6.5rem] z-20 mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-foreground text-xl font-black text-background shadow-xl transition-transform hover:scale-[1.01]">
          <Play className="h-6 w-6" /> {tx("开始挑战")}
        </button>
      </div>
      {run && <HomeworkRunner item={run.item} problems={run.problems} title={`${tx("数珠互译")} · ${itemLabel(run.item)}`} onRoundDone={onRoundDone} onExit={() => setRun(null)} />}
    </>
  );
}
