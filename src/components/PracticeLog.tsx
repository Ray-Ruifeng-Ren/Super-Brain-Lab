import { useEffect, useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarDays, BookOpen } from "lucide-react";
import {
  fetchAttempts,
  groupByDay,
  type AttemptRow,
} from "@/lib/practiceLog";

interface Props {
  game: string;
  refreshKey?: number;
  extraTab?: React.ReactNode;
}

export function PracticeLog({ game, refreshKey, extraTab }: Props) {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<Date>(new Date());

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchAttempts(game).then((a) => {
      if (!live) return;
      setRows(a);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [game, refreshKey]);

  const byDay = useMemo(() => groupByDay(rows), [rows]);

  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const today = byDay.get(todayKey);

  const practiceDates = useMemo(
    () => Array.from(byDay.keys()).map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m - 1, d);
    }),
    [byDay],
  );

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-card">
      <Tabs defaultValue="log" className="flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              训练台
            </span>
          </div>
          <TabsList className="h-7">
            {extraTab && (
              <TabsTrigger value="board" className="text-[11px]">排行</TabsTrigger>
            )}
            <TabsTrigger value="log" className="text-[11px]">
              <CalendarDays className="mr-1 h-3 w-3" /> 记录
            </TabsTrigger>
          </TabsList>
        </div>

        {extraTab && (
          <TabsContent value="board" className="m-0 flex-1 overflow-auto p-0">
            {extraTab}
          </TabsContent>
        )}

        <TabsContent value="log" className="m-0 flex-1 overflow-auto p-3">
          {loading ? (
            <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">加载中…</div>
          ) : rows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
              登录后开始练习，这里会记录每一题。
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  month={month}
                  onMonthChange={setMonth}
                  selected={undefined}
                  modifiers={{ practiced: practiceDates }}
                  modifiersClassNames={{
                    practiced:
                      "relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
                  }}
                  className="rounded-md border border-border p-1.5 pointer-events-auto [&_button]:h-7 [&_button]:w-7 [&_button]:text-[11px] [&_th]:text-[10px] [&_caption]:text-xs"
                />
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">今日</div>
                {today ? (
                  <div className="mt-0.5 flex items-baseline gap-2 text-sm">
                    <span className="font-mono-tabular text-xl font-semibold">{today.total}</span>
                    <span className="text-[11px] text-muted-foreground">题</span>
                    <span className="ml-auto text-[11px] text-primary">✓ {today.correct}</span>
                    <span className="text-[11px] text-destructive">✗ {today.wrong}</span>
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-muted-foreground">还没开始练习</div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
