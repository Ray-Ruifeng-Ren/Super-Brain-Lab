// 单项目双榜:难度系数榜 + 坚持榜。复用 ProLeaderboard 的极简卡片风格。
// 按项目前缀(flash/glance/listen/mul/div)筛选 scores。

import { useEffect, useMemo, useState } from "react";
import {
  type GameId,
  type DiffRankRow, type StreakRankRow, type OpKind,
  getProjectRanks,
} from "@/lib/leaderboard";
import { PROJECT_LABEL } from "@/lib/difficulty";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Flame, CalendarDays } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getCertBadges, type CertLevel } from "@/lib/cert";
import { BadgeChip } from "@/components/CertBadge";
import { useI18n } from "@/lib/i18n";
import { getLang } from "@/lib/langState";

// 英文界面(2026-10-27):L(中文, 英文) 按当前语言取;主组件 useI18n() 订阅语言,切换即重渲染
const L = (zh: string, en: string) => (getLang() === "en" ? en : zh);

interface Props { game: GameId; prefix: string; refreshKey: number; op?: OpKind; }

// 前三名:仅奖牌图标区分 🥇🥈🥉,其余配色统一金色
const GOLD = {
  ring: "ring-2 ring-amber-400/85",
  rowBg: "bg-gradient-to-r from-amber-400/22 via-amber-300/10 to-transparent",
  scoreText: "text-amber-500",
  avatarGlow: "shadow-[0_0_14px_-1px_hsl(43_96%_56%/0.75)]",
};
const TIER: Record<number, { medal: string; ring: string; rowBg: string; scoreText: string; avatarGlow: string }> = {
  1: { medal: "🥇", ...GOLD },
  2: { medal: "🥈", ...GOLD },
  3: { medal: "🥉", ...GOLD },
};

// 简要呈现该记录挑战的难度:加减→笔数·位数·(闪电心算带单笔时间)·加减混合/纯加;乘/除→位数×位数
function fmtChallenge(mode: string, speedMs?: number): string {
  if (getLang() === "en") return fmtChallengeEn(mode, speedMs);
  const add = mode.match(/(\d+)q-(\d+)(?:_(\d+))?d/); // 位数:定长(Xd)或区间(X_Yd)
  if (add) {
    const dMin = add[2], dMax = add[3] || add[2];
    const parts = [`${add[1]}笔`, dMax !== dMin ? `${dMin}-${dMax}位` : `${dMin}位`];
    if (speedMs && mode.startsWith("flash")) parts.push(`${+(speedMs / 1000).toFixed(3)}秒`);
    parts.push(mode.includes("-sub") ? "加减" : "纯加");
    return parts.join(" · ");
  }
  const mul = mode.match(/mul-(\d+)x(\d+)/);
  if (mul) return `乘法 · ${mul[1]}位 × ${mul[2]}位`;
  const divNew = mode.match(/div-(\d+)d(\d+)q/);
  if (divNew) return `除法 · 除数${divNew[1]}位 · 商${divNew[2]}位`;
  const div = mode.match(/div-(\d+)_(\d+)/); // 旧格式:被除数_除数 → 换算成 除数/商 显示
  if (div) return `除法 · 除数${div[2]}位 · 商${Math.max(1, +div[1] - +div[2] + 1)}位`;
  return "最高难度";
}

function fmtChallengeEn(mode: string, speedMs?: number): string {
  const add = mode.match(/(\d+)q-(\d+)(?:_(\d+))?d/);
  if (add) {
    const dMin = add[2], dMax = add[3] || add[2];
    const parts = [`${add[1]} terms`, dMax !== dMin ? `${dMin}-${dMax} digits` : `${dMin} digits`];
    if (speedMs && mode.startsWith("flash")) parts.push(`${+(speedMs / 1000).toFixed(3)}s`);
    parts.push(mode.includes("-sub") ? "add/sub" : "add only");
    return parts.join(" · ");
  }
  const mul = mode.match(/mul-(\d+)x(\d+)/);
  if (mul) return `Multiply · ${mul[1]}-digit × ${mul[2]}-digit`;
  const divNew = mode.match(/div-(\d+)d(\d+)q/);
  if (divNew) return `Divide · ${divNew[1]}-digit divisor · ${divNew[2]}-digit quotient`;
  const div = mode.match(/div-(\d+)_(\d+)/);
  if (div) return `Divide · ${div[2]}-digit divisor · ${Math.max(1, +div[1] - +div[2] + 1)}-digit quotient`;
  return "Top difficulty";
}

function Avatar({ name, dim = false, ring, glow }: { name: string; dim?: boolean; ring?: string; glow?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted font-mono-tabular text-xs font-semibold",
        dim ? "text-muted-foreground" : "text-foreground",
        ring, glow,
      )}
    >
      {initial}
    </div>
  );
}

function RankRow({
  rank, nickname, userId, meId, primary, sub, onChallenge, badge,
}: {
  rank: number; nickname: string; userId: string; meId?: string;
  primary: string; sub: string; onChallenge?: () => void; badge?: CertLevel;
}) {
  const isMe = meId && userId === meId;
  const tier = TIER[rank];
  const isTop = !!tier;
  const isChamp = rank === 1;
  return (
    <li
      className={cn(
        "grid grid-cols-[28px_32px_1fr_auto] items-center gap-3 rounded-lg px-2 transition-colors",
        isTop ? "py-3" : "py-2.5",
        tier?.rowBg,
        isChamp && "animate-champ-glow",
        isMe && !isTop && "bg-primary/5",
      )}
    >
      <span
        className={cn(
          "text-center font-mono-tabular font-semibold tabular-nums",
          isTop ? "text-lg leading-none" : "text-sm",
          !isTop && "text-muted-foreground",
        )}
      >
        {isTop ? tier.medal : rank}
      </span>
      <Avatar name={nickname} dim={rank > 3} ring={tier?.ring} glow={tier?.avatarGlow} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate", isTop ? "text-[15px] font-bold" : "text-sm font-medium", isTop && "text-amber-600")}>{nickname}</span>
          {badge && <BadgeChip id={badge.id} small />}
          {isMe && (
            <span className="rounded-sm bg-primary/10 px-1 py-0 font-mono-tabular text-[9px] font-semibold uppercase text-primary">
              {L("你", "You")}
            </span>
          )}
        </div>
        <div className="font-mono-tabular text-[10px] text-muted-foreground">{sub}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className={cn("font-mono-tabular font-bold tabular-nums", isChamp ? "text-xl" : isTop ? "text-lg" : "text-sm", tier?.scoreText)}>{primary}</div>
        {isTop && onChallenge && !isMe && (
          <button
            onClick={onChallenge}
            className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full border border-amber-400/60 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 transition-colors hover:bg-amber-400/20"
          >
            ⚔ {L("挑战TA", "Challenge")}
          </button>
        )}
      </div>
    </li>
  );
}

const OP_ORDER: OpKind[] = ["addsub", "mul", "div"];
const OP_LABEL: Record<OpKind, string> = { addsub: "加减", mul: "乘法", div: "除法" };
const OP_LABEL_EN: Record<OpKind, string> = { addsub: "Add/Sub", mul: "Multiply", div: "Divide" };

export function RankBoards({ game, prefix, refreshKey, op = "addsub" }: Props) {
  useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState<"difficulty" | "streak">("difficulty");
  const [diff, setDiff] = useState<DiffRankRow[]>([]);
  const [streak, setStreak] = useState<StreakRankRow[]>([]);
  const [badges, setBadges] = useState<Map<string, CertLevel>>(new Map()); // 等级鉴定徽章,戴在昵称旁

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { difficulty, persistence } = await getProjectRanks(game, prefix, 1000); // 抓全部用户,列表内滚动查看
      if (cancelled) return;
      setDiff(difficulty);
      setStreak(persistence);
      const ids = [...new Set([...difficulty.map((r) => r.user_id), ...persistence.map((r) => r.user_id)])];
      const b = await getCertBadges(ids);
      if (!cancelled) setBadges(b);
    })();
    return () => { cancelled = true; };
  }, [game, prefix, refreshKey, user?.id]);

  // 难度榜按运算隔离,且【与左侧配置的「运算」联动】:显示当前所选运算的榜单。
  // 若该项目数据里存在多种运算(看算/听算),在榜头标出当前是哪一类,提示随左侧切换。
  const opsInData = useMemo(() => OP_ORDER.filter((o) => diff.some((r) => r.op === o)), [diff]);
  const diffForOp = useMemo(() => diff.filter((r) => r.op === op), [diff, op]);

  return (
    <div className="rounded-md border border-border bg-card">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "difficulty" | "streak")}>
        <div className="border-b border-border px-4 pt-3">
          <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-0.5">
            <TabsTrigger value="difficulty" className="gap-1 text-xs">
              <Flame className="h-3 w-3" /> {L("难度系数榜", "Difficulty")}
            </TabsTrigger>
            <TabsTrigger value="streak" className="gap-1 text-xs">
              <CalendarDays className="h-3 w-3" /> {L("坚持榜", "Streak")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="difficulty" className="m-0 p-2">
          {/* 运算类型隔离 + 与左侧配置「运算」联动:榜单随所选运算切换(看算/听算才会有多种运算) */}
          {/* 运算 tab:可点击切换,且与左侧配置「运算」双向联动(点这里也会切左侧) */}
          {opsInData.length > 1 && (
            <>
              <div className="mb-1.5 flex gap-1 px-1">
                {opsInData.map((o) => (
                  <button
                    key={o}
                    onClick={() => window.dispatchEvent(new CustomEvent("flash:setop", { detail: { op: o } }))}
                    className={cn(
                      "flex-1 rounded-md px-1 py-1 text-[11px] font-semibold transition-colors",
                      op === o
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {getLang() === "en"
                      ? OP_LABEL_EN[o]
                      : <>{PROJECT_LABEL[prefix] ? `${PROJECT_LABEL[prefix]}·` : ""}{OP_LABEL[o]}榜</>}
                  </button>
                ))}
              </div>
              <div className="mb-2 px-1 text-[10px] text-muted-foreground">{L("· 随左侧「运算」切换", "· follows the “Operation” setting")}</div>
            </>
          )}
          {diffForOp.length === 0 ? (
            <Empty hint={L(`${OP_LABEL[op]}榜暂无排名 —— 完成一局即可上榜`, `No ${OP_LABEL_EN[op]} rankings yet. Finish a round to get on the board`)} />
          ) : (
            <ol className="scroll-visible max-h-[39rem] divide-y divide-border overflow-y-auto">
              {diffForOp.map((r) => (
                <RankRow
                  key={`${r.op}-${r.user_id}`}
                  rank={r.rank}
                  nickname={r.nickname}
                  userId={r.user_id}
                  meId={user?.id}
                  badge={badges.get(r.user_id)}
                  primary={r.D.toFixed(1)}
                  sub={fmtChallenge(r.mode, r.speedMs)}
                  onChallenge={() => window.dispatchEvent(new CustomEvent("flash:challenge", { detail: { mode: r.mode, speedMs: r.speedMs, nickname: r.nickname, D: r.D } }))}
                />
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="streak" className="m-0 p-2">
          {streak.length === 0 ? (
            <Empty hint={L("每天来练一局,连续天数越多越靠前", "Practice a round every day; longer streaks rank higher")} />
          ) : (
            <ol className="scroll-visible max-h-[39rem] divide-y divide-border overflow-y-auto">
              {streak.map((r) => (
                <RankRow
                  key={r.user_id}
                  rank={r.rank}
                  nickname={r.nickname}
                  userId={r.user_id}
                  meId={user?.id}
                  badge={badges.get(r.user_id)}
                  primary={L(`${r.streak} 天`, `${r.streak} d`)}
                  sub={L(`累计 ${r.days} 天`, `${r.days} days total`)}
                />
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>

      {!user && (
        <p className="px-4 pb-3 text-center text-[11px] text-muted-foreground">
          {L("登录后成绩自动同步到云端排行榜。", "Log in to sync your scores to the cloud leaderboard.")}
        </p>
      )}
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-10 text-center">
      <p className="text-sm text-muted-foreground">{L("暂无排名", "No rankings yet")}</p>
      <p className="text-[11px] text-muted-foreground/70">{hint}</p>
    </div>
  );
}
