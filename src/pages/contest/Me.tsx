// /contest/me 考生:手机号 + 密码登录 → 只看到自己报的项目,完全模拟比赛训练(限时 / 难度 / 速度档同比赛)→ 进入赛场
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock, LogOut, Play, Trophy } from "lucide-react";
import { api, cfgOf, cfgText, contestProblems, getToken, setToken, tiersOf, tierText, TIER_NAMES, type Contest, type Ev, type Reg } from "@/lib/contest";
import type { HwProblem, HwResult } from "@/lib/homework";
import { ContestRun } from "./Run";
import { Shell, Card, Btn, Field, inputCls, Err } from "./ui";

function Login({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState(""), [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); setErr(""); try { const r = await api<{ token: string }>("login", { phone, password: pw }); setToken(r.token); onDone(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <Shell title="考生登录" sub="账号就是报名时的手机号">
      <Card className="mx-auto max-w-sm space-y-4">
        <Field label="手机号"><input className={inputCls} value={phone} inputMode="numeric" maxLength={11} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="密码"><input className={inputCls} value={pw} type="password" inputMode="numeric" onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} /></Field>
        <Err msg={err} />
        <Btn onClick={go} disabled={busy || phone.length !== 11 || !pw} className="w-full py-3 text-base">{busy ? "登录中…" : "登 录"}</Btn>
      </Card>
    </Shell>
  );
}

/** 赛前训练 = 完全模拟比赛(2026-11-08 付海东「练习的内容完全模拟比赛:每个项目都是五分钟,题目难度完全一致,不是就给 10 题」):
 *  按本组别本项目的比赛设置出题(各难度段 + 补足)、限时同比赛、3 秒倒数后开始、作答器同赛场(不显示对错、可选慢 / 中 / 快),到点出做题数 · 正确数 */
function Practice({ c, reg, ev, onClose }: { c: Contest; reg: Reg; ev: Ev; onClose: () => void }) {
  const cfg = cfgOf(c, reg.group, ev.id);
  const [run, setRun] = useState<{ problems: HwProblem[]; startAt: number; endAt: number; key: string } | null>(null);
  const [score, setScore] = useState({ answered: 0, correct: 0 });
  const [, tick] = useState(0);
  useEffect(() => { if (!run) return; const t = setInterval(() => tick((x) => x + 1), 200); return () => clearInterval(t); }, [run]);
  const onAnswer = useCallback((_i: number, r: HwResult) => setScore((x) => ({ answered: x.answered + 1, correct: x.correct + (r.correct ? 1 : 0) })), []);
  const go = () => { const t = Date.now(); setScore({ answered: 0, correct: 0 }); setRun({ problems: contestProblems(cfg), startAt: t + 3000, endAt: t + 3000 + cfg.minutes * 60000, key: String(t) }); };
  const quit = useCallback(() => setRun((r) => (r ? { ...r, endAt: Date.now() } : r)), []);
  if (run) {
    const t = Date.now();
    if (t < run.startAt) return <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f3e9d2]"><p className="text-xl font-bold text-[#7a5520]">模拟比赛 · {ev.name} · 限时 {cfg.minutes} 分钟</p><p className="font-mono text-[12rem] font-black leading-none text-[#9e2a2b]">{Math.ceil((run.startAt - t) / 1000)}</p></div>;
    if (t < run.endAt) return <ContestRun runKey={run.key} cfg={cfg} problems={run.problems} title={`${ev.name} · 模拟比赛`} leftMs={run.endAt - t} onAnswer={onAnswer} onQuit={quit} />;
    return (
      <Card className="text-center">
        <Lock className="mx-auto h-10 w-10 text-[#9e2a2b]" />
        <p className="mt-2 text-2xl font-black">时间到 · {ev.name}</p>
        <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#f6e7c1] p-4"><p className="text-sm text-[#7a5520]">做题数</p><p className="text-5xl font-black">{score.answered}</p></div>
          <div className="rounded-xl bg-[#f6e7c1] p-4"><p className="text-sm text-[#7a5520]">正确数</p><p className="text-5xl font-black text-[#2e7d32]">{score.correct}</p></div>
        </div>
        <div className="mt-5 flex justify-center gap-3"><Btn onClick={go} className="flex items-center gap-1.5"><Play className="h-4 w-4" />再模拟一次</Btn><Btn tone="ghost" onClick={() => { setRun(null); onClose(); }}>返回</Btn></div>
      </Card>
    );
  }
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3"><b className="text-lg">{ev.name} · 赛前训练</b><button onClick={onClose} className="ml-auto text-sm text-[#7a5520] underline">返回</button></div>
      <p className="text-sm text-[#7a6a52]">完全模拟 {c.groups.find((g) => g.id === reg.group)?.name} 的比赛:{cfgText(cfg)}</p>
      {tiersOf(cfg) && <p className="text-sm text-[#7a6a52]">比赛中可在屏幕右上角选速度:{TIER_NAMES.map((nm, k) => `${nm}(${tierText(cfg, k)})`).join(" · ")}</p>}
      <Btn onClick={go} className="flex items-center gap-1.5"><Play className="h-4 w-4" />开始模拟比赛(限时 {cfg.minutes} 分钟)</Btn>
    </Card>
  );
}

export default function ContestMe() {
  const [token, setTok] = useState(getToken());
  const [me, setMe] = useState<{ contest: Contest; reg: Reg; groupName: string } | null>(null);
  const [err, setErr] = useState(""), [practice, setPractice] = useState<Ev | null>(null);
  const load = useCallback(() => { const t = getToken(); setTok(t); if (!t) return; api<{ contest: Contest; reg: Reg; groupName: string }>("me", { token: t }).then(setMe).catch((e) => { setErr(e.message); setToken(null); setTok(null); }); }, []);
  useEffect(load, [load]);
  if (!token) return <Login onDone={load} />;
  if (!me) return <Shell title="考生"><div className="flex justify-center py-20">{err ? <Err msg={err} /> : <Loader2 className="h-6 w-6 animate-spin text-[#9c7a2e]" />}</div></Shell>;
  const { contest: c, reg } = me;
  const mine = c.events.filter((e) => reg.events.includes(e.id));
  return (
    <Shell title={c.title} sub="赛前训练" right={<button onClick={() => { setToken(null); setTok(null); setMe(null); }} className="flex items-center gap-1 text-sm text-[#7a5520]"><LogOut className="h-4 w-4" />退出</button>}>
      <Card className="mb-4 flex flex-wrap items-center gap-4">
        <div><p className="text-xs text-[#7a6a52]">考号</p><p className="font-mono text-3xl font-black">{reg.examNo}</p></div>
        <div><p className="text-xs text-[#7a6a52]">选手</p><p className="text-xl font-black">{reg.name} · {me.groupName}</p></div>
        <Link to="/contest/arena" className="ml-auto"><Btn tone="red" className="flex items-center gap-2 px-6 py-3 text-base"><Trophy className="h-5 w-5" />进入赛场</Btn></Link>
      </Card>
      {practice ? <Practice c={c} reg={reg} ev={practice} onClose={() => setPractice(null)} /> : (
        <div className="space-y-3">
          <p className="text-sm font-bold text-[#7a5520]">已报项目(只显示你报名的项目,按 {me.groupName} 的比赛参数训练)</p>
          {mine.map((e) => (
            <Card key={e.id} className="flex items-center gap-4 p-4">
              <div><p className="text-lg font-black">{e.name}</p><p className="text-sm text-[#7a6a52]">{cfgText(cfgOf(c, reg.group, e.id))}</p></div>
              <Btn className="ml-auto flex items-center gap-1.5" onClick={() => setPractice(e)}><Play className="h-4 w-4" />开始训练</Btn>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}
