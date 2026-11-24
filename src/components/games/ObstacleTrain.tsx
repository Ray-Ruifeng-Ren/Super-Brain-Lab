// 障碍算(广场自主练习,2026-10-15 付海东录屏「比赛也会有」):同款配置表单 + 同款全屏作答器(HomeworkRunner 学生模式)。
// 每笔数字出现在随机位置,周围撒干扰(白色数字 / 绿色图形),有效的那一笔用颜色区分;每题记 practice_attempts(mode=obstacle-Nd),暂不入榜。
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { HwItemEditor, newItem } from "@/components/HwItemEditor";
import { HomeworkRunner, NumScaleRow } from "@/components/HomeworkRunner";
import { genProblems, itemLabel, type HwItem, type HwProblem, type HwResult } from "@/lib/homework";
import { logAttempt } from "@/lib/practiceLog";
import { useTx } from "@/lib/tx";

const KEY = "obstacle:item";

export function ObstacleTrain({ onFinished }: { onFinished?: () => void }) {
  const tx = useTx();
  const [item, setItem] = useState<HwItem>(() => { try { return newItem({ n: 10, count: 8, digits: 3, digitsMax: 3, includeSub: true, speedMs: 1000, ...JSON.parse(localStorage.getItem(KEY) || "{}"), project: "obstacle" }); } catch { return newItem({ project: "obstacle", n: 10, count: 8, digits: 3, digitsMax: 3, includeSub: true, speedMs: 1000 }); } });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(item)); } catch { /* noop */ } }, [item]);
  const [run, setRun] = useState<{ item: HwItem; problems: HwProblem[] } | null>(null);

  const onRoundDone = async (results: HwResult[]) => {
    const mode = `obstacle-${item.digits}d`;
    for (const r of results) {
      await logAttempt({ game: "flashmath", mode, terms: r.terms, signs: r.signs as ("+" | "-")[], answer: r.answer, userAnswer: r.given, correct: r.correct, usedMs: r.ms });
    }
    onFinished?.();
  };

  return (
    <>
      <div className="hw-lg hw-compact rounded-3xl border border-border bg-card p-4 md:p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-2xl font-black">🌪️ {tx("障碍算")}</h2>
          <span className="text-sm text-muted-foreground">{tx("数字在干扰中闪现,盯住有效的那一笔")}</span>
        </div>
        <HwItemEditor value={item} onChange={(it) => setItem({ ...it, project: "obstacle" })} hideProject />
        {/* 字号统一在配置页调(2026-11-03) */}
        <NumScaleRow className="mt-3 rounded-2xl border border-border bg-background/60 px-4 py-3" />
        <button onClick={() => setRun({ item, problems: genProblems(item) })} className="sticky bottom-[6.5rem] z-20 mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-foreground text-xl font-black text-background shadow-xl transition-transform hover:scale-[1.01]">
          <Play className="h-6 w-6" /> {tx("开始挑战")}
        </button>
      </div>
      {run && <HomeworkRunner item={run.item} problems={run.problems} title={itemLabel(run.item)} onRoundDone={onRoundDone} onExit={() => setRun(null)} />}
    </>
  );
}
