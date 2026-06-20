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
  extraTab?: React.ReactNode;
}

export function PracticeLog({ game, refreshKey, mistakeMode, onMistakeModeChange, extraTab }: Props) {
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
            <TabsTrigger value="mistakes" className="text-[11px]">
              <AlertTriangle className="mr-1 h-3 w-3" /> 错题
              {wrong.length > 0 && (
                <span className="ml-1 rounded bg-destructive/10 px-1 font-mono-tabular text-[10px] text-destructive">
                  {wrong.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {extraTab && (
          <TabsContent value="board" className="m-0 p-0">
            {extraTab}
          </TabsContent>
        )}

        <TabsContent value="log" className="m-0 p-3">
          {loading ? (
            <div className="py-6 text-center text-xs text-muted-foreground">加载中…</div>
          ) : rows.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
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

        <TabsContent value="mistakes" className="m-0 p-3">
          <div className="mb-2 flex items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
            <div>
              <div className="text-xs font-medium">只练错题</div>
              <div className="text-[10px] text-muted-foreground">下一局从错题池抽题</div>
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
            <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {wrong.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono-tabular text-[11px]">
                      {formatExpr(w.terms, w.signs)} = {w.answer}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
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
