import { useEffect, useMemo, useState } from "react";
import { Flame, Hash, Target, CalendarDays, PlayCircle } from "lucide-react";
import { fetchAttempts, groupByDay, type AttemptRow } from "@/lib/practiceLog";

interface Props {
  game: string;
  refreshKey?: number;
}

export function PracticeStats({ game, refreshKey }: Props) {
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

  const { streak, total, accuracy, distinctDays, sessions } = useMemo(() => {
    if (rows.length === 0)
      return { streak: 0, total: 0, accuracy: 0, distinctDays: 0, sessions: 0 };
    const byDay = groupByDay(rows);
    let total = 0, correct = 0;
    for (const r of rows) {
      total += 1;
      if (r.correct) correct += 1;
    }
    const distinctDays = byDay.size;

    // sessions: sorted by time; new session if gap > 30 min or mode changes
    const sorted = [...rows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    let sessions = 0;
    let lastTime = 0;
    let lastMode = "";
    for (const r of sorted) {
      const t = new Date(r.created_at).getTime();
      if (
        sessions === 0 ||
        t - lastTime > 30 * 60 * 1000 ||
        r.mode !== lastMode
      ) {
        sessions += 1;
      }
      lastTime = t;
      lastMode = r.mode;
    }

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
      accuracy: Math.round((correct / total) * 100),
      distinctDays,
      sessions,
    };
  }, [rows]);

  return (
    <div className="grid grid-cols-5 gap-2 md:gap-3">
      <Metric
        icon={<Flame className="h-3.5 w-3.5" />}
        label="连续天数"
        value={loading ? "—" : String(streak)}
        suffix="天"
        accent={streak > 0}
      />
      <Metric
        icon={<CalendarDays className="h-3.5 w-3.5" />}
        label="练习天数"
        value={loading ? "—" : String(distinctDays)}
        suffix="天"
      />
      <Metric
        icon={<PlayCircle className="h-3.5 w-3.5" />}
        label="累计次数"
        value={loading ? "—" : String(sessions)}
        suffix="次"
      />
      <Metric
        icon={<Hash className="h-3.5 w-3.5" />}
        label="累计题数"
        value={loading ? "—" : String(total)}
        suffix="题"
      />
      <Metric
        icon={<Target className="h-3.5 w-3.5" />}
        label="正确率"
        value={loading || total === 0 ? "—" : String(accuracy)}
        suffix="%"
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
