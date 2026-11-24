import { useEffect, useMemo, useState } from "react";
import { Flame, Hash, Target, CalendarDays } from "lucide-react";
import { fetchAttempts, groupByDay, type AttemptRow } from "@/lib/practiceLog";
import { useI18n } from "@/lib/i18n";

interface Props {
  game: string;
  refreshKey?: number;
}

export function PracticeStats({ game, refreshKey }: Props) {
  const { lang } = useI18n();
  const en = lang === "en";
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchAttempts(game).then((r) => {
      if (!live) return;
      setRows(r);
      setLoading(false);
    });
    return () => { live = false; };
  }, [game, refreshKey]);

  const { streak, total, accuracy, distinctDays, todayCount } = useMemo(() => {
    if (rows.length === 0)
      return { streak: 0, total: 0, accuracy: 0, distinctDays: 0, todayCount: 0 };
    const byDay = groupByDay(rows);
    const total = rows.length;
    // 正确率取「近 100 题」滚动窗口(rows 按时间倒序):全历史平均在几千题后几乎不动,
    // 用户答对好几题也看不到数字变化(2026-09-12 反馈);近百题口径与陪练通关标准一致。
    const win = rows.slice(0, 100);
    const correct = win.filter((r) => r.correct).length;
    const distinctDays = byDay.size;

    // today count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const todayCount = byDay.get(todayKey)?.total ?? 0;

    // streak: consecutive days ending today (or yesterday if today empty)
    const has = (d: Date) => {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return byDay.has(k);
    };
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!has(cursor)) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (has(cursor)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return {
      streak,
      total,
      accuracy: Math.round((correct / Math.max(1, win.length)) * 100),
      distinctDays,
      todayCount,
    };
  }, [rows]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
      <Metric
        icon={<Flame className="h-3.5 w-3.5" />}
        label={en ? "Streak" : "连续天数"}
        value={loading ? "—" : String(streak)}
        suffix={en ? "days" : "天"}
        accent={streak > 0}
      />
      <Metric
        icon={<CalendarDays className="h-3.5 w-3.5" />}
        label={en ? "Days practiced" : "练习天数"}
        value={loading ? "—" : String(distinctDays)}
        suffix={en ? "days" : "天"}
      />
      <Metric
        icon={<Hash className="h-3.5 w-3.5" />}
        label={en ? "Total" : "累计题数"}
        value={loading ? "—" : String(total)}
        suffix={en ? "" : "题"}
      />
      <Metric
        icon={<Target className="h-3.5 w-3.5" />}
        label={en ? "Last 100 accuracy" : "近百题正确率"}
        value={loading || total === 0 ? "—" : String(accuracy)}
        suffix="%"
      />
      <Metric
        icon={<CalendarDays className="h-3.5 w-3.5" />}
        label={en ? "Today" : "今日练题数"}
        value={loading ? "—" : String(todayCount)}
        suffix={en ? "" : "题"}
        accent={todayCount > 0}
      />
    </div>
  );
}

function Metric({
  icon, label, value, suffix, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-2 py-2 md:px-3 md:py-2.5">
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground md:gap-1.5 md:text-[10px]">
        <span className={accent ? "text-primary" : ""}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-0.5 md:gap-1">
        <span className="font-mono-tabular text-xl font-semibold leading-none text-foreground md:text-2xl">
          {value}
        </span>
        <span className="text-[10px] text-muted-foreground md:text-[11px]">{suffix}</span>
      </div>
    </div>
  );
}
