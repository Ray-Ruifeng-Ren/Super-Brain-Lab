// 单项目双榜:难度系数榜 + 坚持榜。复用 ProLeaderboard 的极简卡片风格。
// 按项目前缀(flash/glance/listen/mul/div)筛选 scores。

import { useEffect, useState } from "react";
import {
  type GameId,
  type DiffRankRow, type StreakRankRow,
  getProjectRanks,
} from "@/lib/leaderboard";
import { PROJECT_LABEL } from "@/lib/difficulty";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Flame, CalendarDays } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Props { game: GameId; prefix: string; refreshKey: number; }

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

function RankRow({
  rank, nickname, userId, meId, primary, sub,
}: {
  rank: number; nickname: string; userId: string; meId?: string;
  primary: string; sub: string;
}) {
  const isMe = meId && userId === meId;
  return (
    <li
      className={cn(
        "grid grid-cols-[28px_32px_1fr_auto] items-center gap-3 px-2 py-2.5",
        isMe && "bg-primary/5",
      )}
    >
      <span
        className={cn(
          "font-mono-tabular text-sm font-semibold tabular-nums",
          rank === 1 ? "text-primary" : "text-muted-foreground",
        )}
      >
        {rank}
      </span>
      <Avatar name={nickname} dim={rank > 3} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{nickname}</span>
          {isMe && (
            <span className="rounded-sm bg-primary/10 px-1 py-0 font-mono-tabular text-[9px] font-semibold uppercase text-primary">
              你
            </span>
          )}
        </div>
        <div className="font-mono-tabular text-[10px] text-muted-foreground">{sub}</div>
      </div>
      <div className="font-mono-tabular text-sm font-semibold tabular-nums">{primary}</div>
    </li>
  );
}

export function RankBoards({ game, prefix, refreshKey }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"difficulty" | "streak">("difficulty");
  const [diff, setDiff] = useState<DiffRankRow[]>([]);
  const [streak, setStreak] = useState<StreakRankRow[]>([]);
  const label = PROJECT_LABEL[prefix] ?? prefix;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { difficulty, persistence } = await getProjectRanks(game, prefix, 20);
      if (cancelled) return;
      setDiff(difficulty);
      setStreak(persistence);
    })();
    return () => { cancelled = true; };
  }, [game, prefix, refreshKey, user?.id]);

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-baseline gap-2 border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold">{label} · 排行榜</h3>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "difficulty" | "streak")}>
        <div className="border-b border-border px-4 pt-3">
          <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-0.5">
            <TabsTrigger value="difficulty" className="gap-1 text-xs">
              <Flame className="h-3 w-3" /> 难度系数榜
            </TabsTrigger>
            <TabsTrigger value="streak" className="gap-1 text-xs">
              <CalendarDays className="h-3 w-3" /> 坚持榜
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="difficulty" className="m-0 p-2">
          <details className="mb-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground/80">难度系数 D 怎么算?</summary>
            <div className="mt-1.5 space-y-1 leading-relaxed">
              <p>加减(闪算/看算/听算):<b className="text-foreground/80">D = 位数分 × 速度分 × 笔数分 × 加减系数</b></p>
              <ul className="ml-3 list-disc space-y-0.5">
                <li>位数分 = 1.6^(位数−1) —— 指数,位数越多越难</li>
                <li>速度分 = (1÷每笔秒数)^1.2,封顶 9 —— 越快越难</li>
                <li>笔数分 = (笔数÷5)^0.7,封顶 3 —— 次线性</li>
                <li>含减法 ×1.3,纯加 ×1</li>
              </ul>
              <p>乘 / 除:<b className="text-foreground/80">D = 位数分(被乘/被除) × 位数分(乘数/除数)</b></p>
              <p className="text-muted-foreground/70">榜单取你在该项目里答对过的最高 D 排名。</p>
            </div>
          </details>
          {diff.length === 0 ? (
            <Empty hint="挑战更高位数 / 更快速度即可登顶" />
          ) : (
            <ol className="divide-y divide-border">
              {diff.map((r) => (
                <RankRow
                  key={r.user_id}
                  rank={r.rank}
                  nickname={r.nickname}
                  userId={r.user_id}
                  meId={user?.id}
                  primary={`D ${r.D.toFixed(1)}`}
                  sub="最高难度系数"
                />
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="streak" className="m-0 p-2">
          {streak.length === 0 ? (
            <Empty hint="每天来练一局,连续天数越多越靠前" />
          ) : (
            <ol className="divide-y divide-border">
              {streak.map((r) => (
                <RankRow
                  key={r.user_id}
                  rank={r.rank}
                  nickname={r.nickname}
                  userId={r.user_id}
                  meId={user?.id}
                  primary={`${r.streak} 天`}
                  sub={`累计 ${r.days} 天`}
                />
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>

      {!user && (
        <p className="px-4 pb-3 text-center text-[11px] text-muted-foreground">
          登录后成绩自动同步到云端排行榜。
        </p>
      )}
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-10 text-center">
      <p className="text-sm text-muted-foreground">暂无排名</p>
      <p className="text-[11px] text-muted-foreground/70">{hint}</p>
    </div>
  );
}
