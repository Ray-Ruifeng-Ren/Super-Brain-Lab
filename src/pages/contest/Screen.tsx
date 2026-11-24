// /contest/screen/:cid 大屏(LED 主控屏),2026-11-08 起三种:
//   ?view=rank(默认)排名屏:当前场次 + 倒计时 + 实时排名,每 2 秒刷新
//   ?view=live 直播屏:某位考生此刻平板上的画面(闪现 / 听题 / 看题 / 作答中 / 对错),组织者在「赛场控制」随时切换,默认自动跟第一名
//   ?view=split 合屏:一块屏左排名右直播
// 防泄题:每人题序不同(服务端按考号打乱),直播只放考生此刻看得到的内容 —— 闪现到点就灭、数码秒记看完就收、作答中只显示输入了几位、交卷只亮 ✓ / ✗,从不显示答案。
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, fmtClock, normCfg, runItem, serverNow, STATUS_NAME, syncClock, TIER_NAMES, type LiveRec, type Ranking, type State } from "@/lib/contest";
import { scrollSecFor, type HwProblem, type HwProject } from "@/lib/homework";
import { BeadBoard, GlanceView, SeeNumber } from "@/components/HomeworkRunner";
import { cn } from "@/lib/utils";

type ScreenData = { title: string; state: State; ranking?: Ranking; focus?: string; target?: string | null };
type LiveData = { now: number; state: State; cfg?: unknown; project?: HwProject; student?: { examNo: string; name: string; school: string; answered: number; correct: number }; live?: LiveRec | null; problem?: HwProblem | null };
const grp = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function ContestScreen() {
  const { cid = "" } = useParams();
  const view = new URLSearchParams(location.search).get("view") ?? "rank";
  const [d, setD] = useState<ScreenData | null>(null);
  const [lv, setLv] = useState<LiveData | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const go = () => { const sent = Date.now(); api<ScreenData & { now: number }>("screen", { cid }).then((r) => { syncClock(r.now, sent); setD(r); }).catch(() => {}); };
    go(); const t = setInterval(go, 2000), u = setInterval(() => tick((x) => x + 1), 100);
    return () => { clearInterval(t); clearInterval(u); };
  }, [cid]);
  const target = d?.target;
  useEffect(() => {
    if (view === "rank" || !target) return;
    const go = () => { const sent = Date.now(); api<LiveData>("live", { cid, examNo: target }).then((r) => { syncClock(r.now, sent); setLv(r); }).catch(() => {}); };
    go(); const t = setInterval(go, 600);
    return () => clearInterval(t);
  }, [cid, view, target]);

  if (!d) return <div className="min-h-screen bg-[#140c05]" />;
  const st = d.state, rk = d.ranking, t = serverNow();
  const status = st.status === "running" && st.endAt && t >= st.endAt ? "ended" : st.status;
  const clock = status === "running" ? (st.startAt && t < st.startAt ? `${Math.ceil((st.startAt - t) / 1000)}` : fmtClock((st.endAt ?? 0) - t)) : "";
  const rows = rk?.rows ?? [], joined = rows.filter((r) => r.joined).length;
  const header = (
    <header className="flex items-center gap-6">
      <img src="/logo-emblem.png?v=2" alt="" className="h-16" />
      <div><h1 className="text-4xl font-black text-[#FBF5E6]">{d.title}</h1><p className="mt-1 text-2xl text-[#E8CC8A]">{rk ? `${rk.group} · ${rk.event}` : "候场中"}</p></div>
      <div className="ml-auto text-right">
        <p className={cn("text-xl font-bold", status === "running" ? "text-[#ff8a80]" : "text-[#D9C69E]")}>{STATUS_NAME[status]}</p>
        {clock && <p className="font-mono text-7xl font-black tabular-nums text-white">{clock}</p>}
        {rk && <p className="text-lg text-[#D9C69E]">到场 {joined} / {rows.length} 人</p>}
      </div>
    </header>
  );
  const shell = "flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_20%_0%,#3A2612,#140c05_70%)] px-10 py-8 text-[#F6E7C1]";

  if (view === "live") return <div className={shell}>{header}<div className="mt-6 flex flex-1"><LiveStage d={lv} running={status === "running"} big /></div></div>;
  if (view === "split") return (
    <div className={shell}>{header}
      <div className="mt-6 grid flex-1 grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] gap-8">
        <div className="space-y-2">{rows.slice(0, 14).map((r) => <RankRow key={r.examNo} r={r} hot={r.examNo === target} compact />)}
          {!rows.length && <p className="mt-20 text-center text-2xl text-[#D9C69E]">等待后台切换场次</p>}</div>
        <LiveStage d={lv} running={status === "running"} />
      </div>
    </div>
  );
  return (
    <div className={shell}>{header}
      <div className="mt-8 grid flex-1 grid-cols-2 content-start gap-x-10 gap-y-2">
        {rows.slice(0, 30).map((r) => <RankRow key={r.examNo} r={r} hot={false} />)}
        {!rows.length && <p className="col-span-2 mt-20 text-center text-3xl text-[#D9C69E]">等待后台切换场次</p>}
      </div>
      <p className="mt-4 text-right text-sm text-[#a08b6a]">正确数 / 做题数 · 正确数相同按最后一题答对的时间先后排名</p>
    </div>
  );
}

function RankRow({ r, hot, compact }: { r: Ranking["rows"][number]; hot: boolean; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-5 rounded-xl px-5", compact ? "py-2 text-xl" : "py-2.5 text-2xl", r.rank <= 3 ? "bg-[#E8CC8A] text-[#2B1A08]" : "bg-white/5", hot && "ring-4 ring-[#ff8a80]")}>
      <span className="w-12 font-mono text-3xl font-black">{r.rank}</span>
      <span className="w-28 font-mono">{r.examNo}</span>
      <span className="flex-1 truncate font-bold">{r.name}{hot && <span className="ml-2 rounded bg-[#9e2a2b] px-1.5 text-sm text-white">直播中</span>}</span>
      <span className="w-32 text-right font-mono"><b className="text-3xl">{r.correct}</b><span className="text-base opacity-70"> / {r.answered}</span></span>
    </div>
  );
}

/** 直播舞台:按考生上报的「第几题 · 看题开始时刻 · 速度档」在大屏上同步重放他此刻看到的画面 */
function LiveStage({ d, running, big }: { d: LiveData | null; running: boolean; big?: boolean }) {
  const cfg = useMemo(() => (d?.cfg ? normCfg(d.cfg as never, d.project) : null), [JSON.stringify(d?.cfg), d?.project]); // eslint-disable-line react-hooks/exhaustive-deps
  const box = "relative flex flex-1 flex-col overflow-hidden rounded-3xl border border-[#E8CC8A]/30 bg-[#0e0803]/80 p-8";
  if (!d?.student) return <div className={cn(box, "items-center justify-center text-3xl text-[#D9C69E]")}>等待直播考生</div>;
  const s = d.student, lv = d.live, p = d.problem, t = serverNow();
  const item = cfg ? runItem(cfg, lv?.tier ?? 1) : null;
  const okFlash = lv?.lastOk && t - lv.lastOk.at < 1500 ? lv.lastOk : null;
  let stage: React.ReactNode = <p className="text-3xl text-[#D9C69E]">{running ? "准备下一题…" : "等待开始"}</p>;
  if (running && lv && p && item) {
    const el = Math.max(0, t - lv.at), n = p.terms.length;
    const answering = (dots = true) => (
      <div className="flex flex-col items-center gap-5"><p className="text-4xl font-black text-[#E8CC8A]">作答中…</p>
        {dots && <p className="font-mono text-5xl tracking-[0.3em] text-white/80">{"●".repeat(Math.min(lv.typed, 24)) || "_"}</p>}</div>
    );
    if (item.project === "glance") stage = <div className="flex w-full flex-col items-center gap-4"><GlanceView p={p} scale={0.6} tone="dark" bead={item.method === "bead"} />{lv.phase === "answer" && <p className="font-mono text-3xl tracking-[0.3em] text-[#E8CC8A]">作答中 {"●".repeat(Math.min(lv.typed, 16))}</p>}</div>;
    else if (lv.phase === "answer") stage = answering();
    else if (item.project === "flash" || item.project === "obstacle") {
      const per = item.speedMs, blank = Math.max(50, Math.min(250, Math.round(per * 0.25))), k = Math.floor(el / per);
      stage = k < n && el % per < per - blank
        ? <div className="flex items-baseline gap-4 font-hand font-bold leading-none text-white" style={{ fontSize: big ? "16rem" : "11rem" }}>{p.signs[k] === "-" && <span>-</span>}<span>{grp(String(Math.abs(p.terms[k])))}</span></div>
        : <div className="h-3 w-3" />;
    } else if (item.project === "scroll") {
      const per = item.scrollTermMs ?? (scrollSecFor(item, lv.k) * 1000) / n, k = Math.min(n, Math.floor(el / per) + 1);
      stage = <div className="flex flex-col items-end gap-2 font-hand font-bold leading-tight text-white" style={{ fontSize: big ? "6rem" : "4.5rem" }}>{p.terms.slice(Math.max(0, k - 4), k).map((v, i) => <span key={i}>{p.signs[Math.max(0, k - 4) + i] === "-" ? "-" : ""}{grp(String(Math.abs(v)))}</span>)}</div>;
    } else if (item.project === "listen") stage = <div className="flex flex-col items-center gap-4"><div className="animate-bounce text-9xl">🔊</div><p className="text-4xl font-bold text-white/90">听题中…</p></div>;
    else if (item.project === "bead") {
      const see = item.beadDir === "see", s1 = p.beadS ?? String(p.bead ?? "");
      stage = el < item.beadSpeedMs ? (see ? <SeeNumber s={s1} scale={0.7} /> : <BeadBoard s={s1.padStart(p.beadDigits ?? item.beadDigits, "0")} tone="dark" />) : answering(false);
    }
  }
  return (
    <div className={box}>
      <div className="flex items-center gap-4">
        <span className="rounded-full bg-[#9e2a2b] px-3 py-1 text-lg font-black text-white">● 直播</span>
        <span className="font-mono text-3xl font-black text-[#E8CC8A]">{s.examNo}</span>
        <span className="text-3xl font-black text-white">{s.name}</span>
        {s.school && <span className="text-xl text-[#D9C69E]">{s.school}</span>}
        <span className="ml-auto text-right"><span className="font-mono text-5xl font-black text-white">{s.correct}</span><span className="text-xl text-[#D9C69E]"> / {s.answered} 题</span>
          {lv && <span className="ml-4 rounded-full border border-[#E8CC8A]/40 px-3 py-1 text-lg text-[#E8CC8A]">{TIER_NAMES[lv.tier] ?? "中"}速 · 第 {lv.k + 1} 题</span>}</span>
      </div>
      <div className="flex flex-1 items-center justify-center">{stage}</div>
      {okFlash && <div className={cn("animate-pop-in pointer-events-none absolute inset-0 flex items-center justify-center text-[14rem] font-black", okFlash.ok ? "text-emerald-400" : "text-amber-300")}>{okFlash.ok ? "✓" : "✗"}</div>}
    </div>
  );
}
