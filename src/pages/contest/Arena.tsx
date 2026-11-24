// /contest/arena 赛场平板:每秒向服务器同步场次状态 → 本人场次时显示考号入座 → 服务器时间到点全部同时开始 →
// 答题界面就是训练系统的 HomeworkRunner(比赛模式:每题交给服务器判分)→ 到点统一锁定 → 显示做题数 · 正确数
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { api, getToken, normCfg, serverNow, STATUS_NAME, syncClock, type Cfg, type Contest, type Problem, type Reg, type State } from "@/lib/contest";
import type { HwResult } from "@/lib/homework";
import { ContestRun } from "./Run";
import { Card } from "./ui";

interface Poll { now: number; state: State; mine?: boolean; live?: boolean; cfg?: Cfg; progress?: { answered: number; correct: number; done: number[] } | null; problems?: Problem[] }

export default function ContestArena() {
  const nav = useNavigate();
  // ?t=令牌:组织者后台「打开平板」直接以某考生身份进入(同一台电脑开多个标签页测试,互不串号)
  const token = new URLSearchParams(location.search).get("t") || getToken();
  const [me, setMe] = useState<{ contest: Contest; reg: Reg; groupName: string } | null>(null);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [startIdx, setStartIdx] = useState(0);
  const [score, setScore] = useState({ answered: 0, correct: 0 });
  const [, tick] = useState(0);
  const sidRef = useRef<string | undefined>(undefined), joined = useRef<string | undefined>(undefined), hasProblems = useRef(false);

  useEffect(() => { if (!token) { nav("/contest/me"); return; } api<{ contest: Contest; reg: Reg; groupName: string }>("me", { token }).then(setMe).catch(() => nav("/contest/me")); }, [token, nav]);

  const doPoll = useCallback(async () => {
    if (!me || !token) return;
    const sent = Date.now();
    try {
      const r = await api<Poll>("state", { cid: me.contest.id, token, withProblems: !hasProblems.current });
      syncClock(r.now, sent);
      if (r.state.sid !== sidRef.current) { sidRef.current = r.state.sid; hasProblems.current = false; setProblems(null); setScore({ answered: 0, correct: 0 }); }
      if (r.problems && !hasProblems.current) {
        hasProblems.current = true;
        const done = new Set(r.progress?.done ?? []); let k = 0; while (done.has(k)) k++; // 断线重进:接着没做的题
        setStartIdx(k); setProblems(r.problems);
      }
      if (r.progress) setScore({ answered: r.progress.answered, correct: r.progress.correct });
      if (r.mine && r.state.sid && joined.current !== r.state.sid) { joined.current = r.state.sid; api("join", { token }).catch(() => {}); }
      setPoll(r);
    } catch { /* 网络抖动,下次再拉 */ }
  }, [me, token]);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 200); return () => clearInterval(t); }, []);

  // 大屏直播(2026-11-08):只有大屏正在直播的这台平板上报;看题 / 作答切换立即发,输入位数变化最多 0.4 秒发一次
  const liveRef = useRef(false), lastLive = useRef({ key: "", at: 0 }), pendLive = useRef<number | undefined>(undefined);
  // 渲染时就同步(子组件作答器的 effect 先于本页 effect 执行,刚切上大屏那一下的补报不能被丢)
  if (liveRef.current !== !!poll?.live) { liveRef.current = !!poll?.live; lastLive.current = { key: "", at: 0 }; }
  const onLive = useCallback((ev: { idx: number; phase: "play" | "answer"; typed: number; tier: number }) => {
    if (!liveRef.current || !sidRef.current) return;
    const key = `${ev.idx}|${ev.phase}|${ev.tier}`, since = Date.now() - lastLive.current.at;
    const send = () => { lastLive.current = { key, at: Date.now() }; api("liveEv", { token, sid: sidRef.current, ...ev }).catch(() => {}); };
    window.clearTimeout(pendLive.current);
    if (key !== lastLive.current.key || since >= 400) send();
    else pendLive.current = window.setTimeout(send, 400 - since); // 节流期内的最后一次(如刚输入的位数)稍后补发
  }, [token]);

  // 交卷队列(2026-11-09):先存本机再发;网络失败就留着,每秒轮询时重发,直到服务器确认(或明确拒收:已锁定 / 不是本场);
  // 刷新页面也不丢(存 localStorage)。带上交卷时刻 at(服务器钟),晚到也按交卷时刻算
  type Pend = { sid: string; idx: number; value: unknown; rem: number | null; at: number };
  const PKEY = `contest:pending:${token ?? ""}`;
  const pending = useRef<Pend[]>((() => { try { return JSON.parse(localStorage.getItem(PKEY) || "[]"); } catch { return []; } })());
  const savePending = () => { try { localStorage.setItem(PKEY, JSON.stringify(pending.current)); } catch { /* noop */ } };
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current || !pending.current.length) return;
    flushing.current = true;
    try {
      for (const pd of [...pending.current]) {
        try {
          const r = await api<{ answered: number; correct: number }>("answer", { token, sid: pd.sid, idx: pd.idx, value: pd.value, rem: pd.rem, at: pd.at });
          if (pd.sid === sidRef.current) setScore(r);
          pending.current = pending.current.filter((x) => x !== pd); savePending();
        } catch (e) {
          const msg = (e as Error).message || "";
          if (/锁定|已结束|不是本场|题号不对|还没开始|请重新登录/.test(msg)) { pending.current = pending.current.filter((x) => x !== pd); savePending(); }
          else break; // 网络问题:保留,下次再发(按顺序)
        }
      }
    } finally { flushing.current = false; }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const onAnswer = useCallback((idx: number, r: HwResult) => {
    if (!sidRef.current) return;
    pending.current.push({ sid: sidRef.current, idx, value: r.givenS ?? r.given, rem: r.givenRem ?? null, at: Math.round(serverNow()) });
    savePending(); void flush();
  }, [flush]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { doPoll(); const t = setInterval(() => { void doPoll(); void flush(); }, 1000); return () => clearInterval(t); }, [doPoll, flush]);


  if (!me || !poll) return <div className="flex min-h-screen items-center justify-center bg-[#1d140a]"><Loader2 className="h-8 w-8 animate-spin text-[#E8CC8A]" /></div>;
  const st = poll.state, t = serverNow();
  const g = me.contest.groups.find((x) => x.id === st.group), ev = me.contest.events.find((x) => x.id === st.event);
  const running = st.status === "running" && st.startAt && t >= st.startAt && t < (st.endAt ?? 0);
  const counting = st.status === "running" && st.startAt && t < st.startAt;
  const over = st.sid && (st.status === "ended" || (st.status === "running" && st.endAt && t >= st.endAt));

  if (running && poll.mine && poll.cfg && problems) {
    return <ContestRun runKey={st.sid!} cfg={normCfg(poll.cfg, ev?.project)} problems={problems} title={`${me.reg.examNo} ${me.reg.name} · ${g?.name} · ${ev?.name}`}
      leftMs={(st.endAt ?? 0) - t} onAnswer={onAnswer} startIdx={startIdx} onLive={poll.live ? onLive : undefined} />; {/* 刚切上大屏:onLive 从无到有,作答器立刻补报当前状态 */}
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f3e9d2] text-[#2B1A08]">
      <header className="flex items-center gap-4 bg-[#2B1A08] px-5 py-3 text-[#F6E7C1]">
        <img src="/logo-emblem.png?v=2" alt="" className="h-9" />
        <div><p className="font-mono text-2xl font-black text-[#E8CC8A]">{me.reg.examNo}</p><p className="text-xs">{me.reg.name} · {me.groupName}</p></div>
        <div className="ml-auto text-right">
          <p className="text-sm">{g && ev ? `${g.name} · ${ev.name}` : me.contest.title}</p>
          <p className="text-xs text-[#D9C69E]">{STATUS_NAME[over ? "ended" : st.status]}</p>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        {!st.sid || st.status === "idle" ? (
          <Wait title="候场中" sub="等待裁判在后台切换场次" />
        ) : !poll.mine ? (
          <Wait title={`当前场次:${g?.name} · ${ev?.name}`} sub="不是你的场次,请等待你的组别和项目" />
        ) : over ? (
          <Card className="w-full max-w-md text-center">
            <Lock className="mx-auto h-10 w-10 text-[#9e2a2b]" />
            <p className="mt-2 text-2xl font-black">时间到,已锁定</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f6e7c1] p-4"><p className="text-sm text-[#7a5520]">做题数</p><p className="text-5xl font-black">{score.answered}</p></div>
              <div className="rounded-xl bg-[#f6e7c1] p-4"><p className="text-sm text-[#7a5520]">正确数</p><p className="text-5xl font-black text-[#2e7d32]">{score.correct}</p></div>
            </div>
            <p className="mt-4 text-sm text-[#7a6a52]">名次请看大屏</p>
          </Card>
        ) : st.status === "ready" ? (
          <Wait title="已入座" sub={`${g?.name} · ${ev?.name} · 等待裁判口令,全部平板将同时开始`} big={me.reg.examNo} photo={me.reg.thumb} />
        ) : counting ? (
          <div className="text-center"><p className="text-xl font-bold text-[#7a5520]">全部平板同时开始</p><p className="font-mono text-[12rem] font-black leading-none text-[#9e2a2b]">{Math.ceil(((st.startAt ?? 0) - t) / 1000)}</p></div>
        ) : <Loader2 className="h-8 w-8 animate-spin text-[#9c7a2e]" />}
      </main>
      <footer className="px-5 py-2 text-right text-xs text-[#7a6a52]"><Link to="/contest/me" className="underline">返回训练</Link></footer>
    </div>
  );
}

function Wait({ title, sub, big, photo }: { title: string; sub: string; big?: string; photo?: string }) {
  return (
    <div className="text-center">
      {photo && <img src={photo} alt="" className="mx-auto mb-3 h-28 w-24 rounded-xl border-4 border-white object-cover shadow" />}
      {big && <p className="font-mono text-8xl font-black text-[#2B1A08]">{big}</p>}
      <p className="mt-2 text-3xl font-black">{title}</p>
      <p className="mt-2 text-[#7a6a52]">{sub}</p>
      <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-[#c9a24a]" />
    </div>
  );
}
