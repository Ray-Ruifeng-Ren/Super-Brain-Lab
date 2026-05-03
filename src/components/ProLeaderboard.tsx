// Premium minimal leaderboard panel.
// Cloud-backed via /lib/leaderboard async APIs.

import { useEffect, useMemo, useState } from "react";
import {
  GAMES, type GameId, type Period, type ScoreRow,
  formatRelative, getLeaderboard, getMyBest, getMyHistory,
} from "@/lib/leaderboard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Props { game: GameId; mode: string; refreshKey: number; }

function Avatar({ name, dim = false }: { name: string; dim?: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted font-mono-tabular text-xs font-semibold",
        dim ? "text-muted-foreground" : "text-foreground",
      )}
    >
      {initial}
    </div>
  );
}

export function ProLeaderboard({ game, mode, refreshKey }: Props) {
  const meta = GAMES[game];
  const [period, setPeriod] = useState<Period>("all");
  const { user, profile } = useAuth();

  const [board, setBoard] = useState<(ScoreRow & { rank: number })[]>([]);
  const [myBestAll, setMyBestAll] = useState<ScoreRow | null>(null);
  const [myBestWeek, setMyBestWeek] = useState<ScoreRow | null>(null);
  const [history, setHistory] = useState<ScoreRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [b, ba, bw, h] = await Promise.all([
        getLeaderboard(game, mode, period, 20),
        getMyBest(game, mode, "all"),
        getMyBest(game, mode, "weekly"),
        getMyHistory(game, mode, 5),
      ]);
      if (cancelled) return;
      setBoard(b);
      setMyBestAll(ba);
      setMyBestWeek(bw);
      setHistory(h);
    })();
    return () => { cancelled = true; };
  }, [game, mode, period, refreshKey, user?.id]);

  const myRank = useMemo(
    () => (user ? board.find((s) => s.user_id === user.id)?.rank ?? null : null),
    [board, user],
  );

  return (
    <div className="space-y-4">
      {/* My Best */}
      <div className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            我的最佳
          </div>
        </div>
        <div className="p-4">
          {myBestAll ? (
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {meta.valueLabel}
                </div>
                <div className="font-mono-tabular text-3xl font-semibold leading-tight text-foreground">
                  {meta.formatValue(myBestAll.value)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatRelative(myBestAll.created_at)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {myRank && (
                  <div className="rounded-sm border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono-tabular text-[11px] font-semibold text-primary">
                    #{myRank}
                  </div>
                )}
                {myBestWeek && (
                  <WeekDelta
                    direction={meta.direction}
                    weekValue={myBestWeek.value}
                    allValue={myBestAll.value}
                    format={meta.formatValue}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="py-2 text-center text-sm text-muted-foreground">
              {user ? "完成一局即可创建你的最佳记录" : "登录后开始记录你的最佳"}
            </div>
          )}

          {history.length > 1 && (
            <details className="mt-4 border-t border-border pt-3 group">
              <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                <History className="h-3 w-3" />
                最近 {history.length} 局
                <span className="ml-auto opacity-60 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <ul className="mt-2 space-y-1">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{formatRelative(h.created_at)}</span>
                    <span className="font-mono-tabular font-medium">{meta.formatValue(h.value)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold">排行榜</h3>
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {mode}
            </span>
          </div>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <div className="border-b border-border px-4 pt-3">
            <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-0.5">
              <TabsTrigger value="all" className="text-xs">总榜</TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs">本周</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value={period} className="m-0 p-2">
            {board.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {period === "weekly" ? "本周还没有记录" : "暂无排名"}
                </p>
                <p className="text-[11px] text-muted-foreground/70">第一名虚位以待</p>
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {board.map((s) => {
                  const isMe = user && s.user_id === user.id;
                  return (
                    <li
                      key={s.id}
                      className={cn(
                        "grid grid-cols-[28px_32px_1fr_auto] items-center gap-3 px-2 py-2.5",
                        isMe && "bg-primary/5",
                      )}
                    >
                      <span
                        className={cn(
                          "font-mono-tabular text-sm font-semibold tabular-nums",
                          s.rank === 1 ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {s.rank}
                      </span>
                      <Avatar name={s.nickname || "玩家"} dim={s.rank > 3} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{s.nickname || "玩家"}</span>
                          {isMe && (
                            <span className="rounded-sm bg-primary/10 px-1 py-0 font-mono-tabular text-[9px] font-semibold uppercase text-primary">
                              你
                            </span>
                          )}
                        </div>
                        <div className="font-mono-tabular text-[10px] text-muted-foreground">
                          {formatRelative(s.created_at)}
                        </div>
                      </div>
                      <div className="font-mono-tabular text-sm font-semibold tabular-nums">
                        {meta.formatValue(s.value)}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {!user && (
        <p className="text-center text-[11px] text-muted-foreground">
          登录后成绩自动同步到云端排行榜。
        </p>
      )}
    </div>
  );
}

function WeekDelta({
  direction, weekValue, allValue, format,
}: {
  direction: "lower" | "higher";
  weekValue: number;
  allValue: number;
  format: (v: number) => string;
}) {
  const isImprovement = direction === "lower" ? weekValue <= allValue : weekValue >= allValue;
  const diff = Math.abs(weekValue - allValue);
  if (diff === 0) return <div className="text-[10px] text-muted-foreground">本周已达个人最佳</div>;
  return (
    <div className={cn(
      "flex items-center gap-1 font-mono-tabular text-[10px] font-medium",
      isImprovement ? "text-primary" : "text-muted-foreground",
    )}>
      {isImprovement ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      本周 {format(weekValue)}
    </div>
  );
}
