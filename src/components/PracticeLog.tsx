import { useEffect, useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CalendarDays, AlertTriangle, BookOpen } from "lucide-react";
import {
  fetchAttempts,
  fetchWrongAttempts,
  groupByDay,
  formatExpr,
  type AttemptRow,
} from "@/lib/practiceLog";

interface Props {
  game: string;
  refreshKey?: number;
  mistakeMode: boolean;
  onMistakeModeChange: (v: boolean) => void;
}

export function PracticeLog({ game, refreshKey, mistakeMode, onMistakeModeChange }: Props) {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [wrong, setWrong] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<Date>(new Date());

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([fetchAttempts(game), fetchWrongAttempts(game, 50)]).then(([a, w]) => {
      if (!live) return;
      setRows(a);
      setWrong(w);
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

  const totals = useMemo(() => {
    let total = 0, correct = 0;
    for (const r of rows) {
      total += 1;
      if (r.correct) correct += 1;
    }
    const week = (() => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return rows.filter((r) => new Date(r.created_at) >= start).length;
    })();
    return { total, correct, wrong: total - correct, week };
  }, [rows]);

  // Practice-marker modifier for the calendar
  const practiceDates = useMemo(
    () => Array.from(byDay.keys()).map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m - 1, d);
    }),
    [byDay],
  );

  return (
    <div className="rounded-md border border-border bg-card">
      <Tabs defaultValue="log">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              训练日志
            </span>
          </div>
          <TabsList className="h-7">
            <TabsTrigger value="log" className="text-[11px]">
              <CalendarDays className="mr-1 h-3 w-3" /> 练习记录
            </TabsTrigger>
            <TabsTrigger value="mistakes" className="text-[11px]">
              <AlertTriangle className="mr-1 h-3 w-3" /> 错题本
              {wrong.length > 0 && (
                <span className="ml-1 rounded bg-destructive/10 px-1 font-mono-tabular text-[10px] text-destructive">
                  {wrong.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="log" className="m-0 p-4">
          {loading ? (
            <div className="py-6 text-center text-xs text-muted-foreground">加载中…</div>
          ) : rows.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              登录后开始练习，这里会记录每一题。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[auto_1fr]">
              <Calendar
                mode="single"
                month={month}
                onMonthChange={setMonth}
                selected={undefined}
                modifiers={{ practiced: practiceDates }}
                modifiersClassNames={{
                  practiced:
                    "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
                }}
                className="rounded-md border border-border p-2 pointer-events-auto"
              />
              <div className="flex flex-col gap-3 text-sm">
                <StatBlock label="今日" empty={!today}>
                  {today ? (
                    <>
                      <Big>{today.total}</Big>
                      <span className="ml-1 text-xs text-muted-foreground">题</span>
                      <div className="mt-1 flex gap-3 text-[11px]">
                        <span className="text-primary">✓ {today.correct}</span>
                        <span className="text-destructive">✗ {today.wrong}</span>
                        <span className="text-muted-foreground">
                          正确率 {Math.round((today.correct / today.total) * 100)}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">还没开始练习</span>
                  )}
                </StatBlock>
                <StatBlock label="近 7 日">
                  <Big>{totals.week}</Big>
                  <span className="ml-1 text-xs text-muted-foreground">题</span>
                </StatBlock>
                <StatBlock label="累计">
                  <Big>{totals.total}</Big>
                  <span className="ml-1 text-xs text-muted-foreground">题</span>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    正确率{" "}
                    {totals.total ? Math.round((totals.correct / totals.total) * 100) : 0}%
                  </div>
                </StatBlock>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="mistakes" className="m-0 p-4">
          <div className="mb-3 flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <div>
              <div className="text-xs font-medium">只练错题</div>
              <div className="text-[10px] text-muted-foreground">
                开启后，下一局将从你的错题池抽题
              </div>
            </div>
            <Switch
              checked={mistakeMode}
              onCheckedChange={onMistakeModeChange}
              disabled={wrong.length === 0}
            />
          </div>
          {loading ? (
            <div className="py-6 text-center text-xs text-muted-foreground">加载中…</div>
          ) : wrong.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              还没有错题，继续保持 👍
            </div>
          ) : (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {wrong.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono-tabular text-xs">
                      {formatExpr(w.terms, w.signs)} = {w.answer}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      你答{" "}
                      <span className="font-mono-tabular text-destructive">
                        {w.user_answer ?? "超时"}
                      </span>
                      <span className="mx-1.5">·</span>
                      {timeAgo(w.created_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBlock({
  label,
  empty,
  children,
}: {
  label: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border p-3",
        empty && "border-dashed bg-transparent",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Big({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono-tabular text-2xl font-semibold text-foreground">
      {children}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(iso).toLocaleDateString();
}
