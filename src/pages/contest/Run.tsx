// 比赛作答(赛场平板 + 赛前模拟共用,2026-11-08):训练系统作答器(比赛模式)+ 顶部剩余时间 + 右上角「慢 / 中 / 快」速度档。
// 付海东 / 用户 11-08:「按规定时间算题量,考生可以自己选快还是慢」「速度分三个档次」「管理员设各档每笔间隔」——
// 闪算 / 听算 / 马拉松 / 障碍算有速度档;换档从下一笔(听算、马拉松从下一题)生效。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtClock, runItem, tiersOf, tierText, DEFAULT_TIER, TIER_NAMES, type Cfg, type Problem } from "@/lib/contest";
import type { HwResult } from "@/lib/homework";
import { HomeworkRunner } from "@/components/HomeworkRunner";
import { cn } from "@/lib/utils";

const noop = () => {};

export function ContestRun({ cfg, problems, title, leftMs, onAnswer, startIdx = 0, runKey, onQuit, onLive }: {
  cfg: Cfg; problems: Problem[]; title: string; leftMs: number;
  onAnswer: (idx: number, r: HwResult) => void; startIdx?: number; runKey: string; onQuit?: () => void;
  /** 大屏直播:上报第几题 / 看题或作答 / 已输入几位 / 速度档 */
  onLive?: (ev: { idx: number; phase: "play" | "answer"; typed: number; tier: number }) => void;
}) {
  const [tier, setTier] = useState(DEFAULT_TIER);
  const tierRef = useRef(tier); tierRef.current = tier;
  const lastEv = useRef<{ idx: number; phase: "play" | "answer"; typed: number } | null>(null);
  const liveFn = useCallback((ev: { idx: number; phase: "play" | "answer"; typed: number }) => { lastEv.current = ev; onLive?.({ ...ev, tier: tierRef.current }); }, [onLive]);
  useEffect(() => { if (lastEv.current) onLive?.({ ...lastEv.current, tier }); }, [tier]); // eslint-disable-line react-hooks/exhaustive-deps -- 换档:大屏按新速度重放
  const cfgKey = JSON.stringify(cfg);
  // 作答器的 item / contest 必须稳定(外层每 200ms 刷新倒计时,传新对象会让闪算每次重新开始)
  const item = useMemo(() => runItem(cfg, tier), [cfgKey, tier]); // eslint-disable-line react-hooks/exhaustive-deps
  const contest = useMemo(() => ({ onAnswer, startIdx, onLive: onLive ? liveFn : undefined }), [onAnswer, startIdx, onLive, liveFn]);
  const tiers = tiersOf(cfg);
  return (
    <>
      <HomeworkRunner key={runKey} item={item} problems={problems} title={title} onExit={noop} contest={contest} />
      <div className="pointer-events-none fixed left-1/2 top-12 z-[60] -translate-x-1/2 rounded-full bg-[#9e2a2b] px-5 py-1 font-mono text-2xl font-black tabular-nums text-white shadow-lg">{fmtClock(leftMs)}</div>
      {tiers && (
        <div className="fixed right-3 top-24 z-[60] flex flex-col items-end gap-1">
          <div className="flex gap-1 rounded-full bg-black/55 p-1 shadow-lg backdrop-blur">
            {TIER_NAMES.map((nm, k) => (
              <button key={nm} onClick={() => setTier(k)} className={cn("h-10 w-12 rounded-full text-base font-black transition-colors", tier === k ? "bg-amber-400 text-black" : "text-white/80 hover:bg-white/15")}>{nm}</button>
            ))}
          </div>
          <span className="rounded-full bg-black/40 px-2 text-[11px] text-white/70">{tierText(cfg, tier)}</span>
        </div>
      )}
      {onQuit && <button onClick={onQuit} className="fixed left-3 top-12 z-[60] rounded-full border border-white/30 bg-black/40 px-3 py-1 text-xs text-white/80">结束练习</button>}
    </>
  );
}
