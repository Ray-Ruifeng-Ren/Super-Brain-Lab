// /contest/admin 组织者后台:建比赛 → 设置(组别 / 项目 / 出题设置 / 报名截止)→ 报名(二维码 + 名单 + 测试考生)→ 赛场控制(切换场次 / 统一开始 / 统一结束)→ 成绩(按组别 × 项目导出排名表)
// 出题设置就是教练布置作业的 HwItemEditor,统一开始时用训练系统的 genProblems 出题(2026-11-04 用户「都跟原来训练系统一样」)
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Monitor, Plus, QrCode, Download, Play, Square, RefreshCw } from "lucide-react";
import { api, cfgOf, cfgText, contestProblems, fmtClock, maskId, serverNow, STATUS_NAME, syncClock, tierKind, tiersOf, TIER_NAMES, type Cfg, type Contest, type Ev, type Ranking, type Reg, type State } from "@/lib/contest";
import { normalizeItem, PROJECT_LABEL, type HwItem, type HwProject } from "@/lib/homework";
import { HwItemEditor, newItem, Num } from "@/components/HwItemEditor";
import { qrDataUrl } from "@/lib/paper";
import { RequireLogin } from "@/components/RequireLogin";
import { Shell, Card, Btn, Field, inputCls, Err } from "./ui";
import { cn } from "@/lib/utils";

const q = () => location.search; // 本地预览 ?preview=1 跳转时带上

// 比赛项目:训练系统的六个项目 + 数码秒记(= 数珠互译的「看数」,2026-11-08 用户「比赛端可以报名数码秒记这个项目」)
type EvKind = HwProject | "memo";
const EV_KINDS: EvKind[] = ["flash", "listen", "glance", "bead", "memo", "scroll", "obstacle"];
const kindLabel = (k: EvKind) => (k === "memo" ? "数码秒记" : PROJECT_LABEL[k]);
const kindEvent = (k: EvKind): { project: HwProject; name?: string } => (k === "memo" ? { project: "bead", name: "数码秒记" } : { project: k });
const kindItem = (k: EvKind): HwItem => (k === "memo" ? newItem({ project: "bead", beadDir: "see", beadDigits: 10, beadSpeedMs: 1000, beadLimitSec: 5, n: 50 }) : newItem({ project: k, n: 50 }));

function List() {
  const nav = useNavigate();
  const [cs, setCs] = useState<Contest[] | null>(null), [err, setErr] = useState("");
  const [title, setTitle] = useState("长春市珠心算比赛"), [kinds, setKinds] = useState<EvKind[]>(["flash", "listen", "glance"]), [busy, setBusy] = useState(false);
  useEffect(() => { api<{ contests: Contest[] }>("myContests", {}, true).then((r) => setCs(r.contests)).catch((e) => setErr(e.message)); }, []);
  const create = async () => {
    setBusy(true);
    try { const r = await api<{ contest: Contest }>("createContest", { title, events: kinds.map(kindEvent), cfg: kinds.map((k) => ({ item: kindItem(k), minutes: 5 })) }, true); nav(`/contest/admin/${r.contest.id}${q()}`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Shell title="组织者后台" sub="珠象比赛系统">
      <Card className="mb-5 space-y-3">
        <h2 className="font-black">新建比赛</h2>
        <Field label="比赛名称"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="比赛项目">
          <div className="flex flex-wrap gap-2">{EV_KINDS.map((k) => { const on = kinds.includes(k); return <button key={k} onClick={() => setKinds((x) => (on ? x.filter((y) => y !== k) : [...x, k]))} className={cn("rounded-full border px-4 py-2 text-sm font-bold", on ? "border-[#7a5520] bg-[#7a5520] text-white" : "border-[#d9c39b] bg-white text-[#7a5520]")}>{kindLabel(k)}</button>; })}</div>
        </Field>
        <Btn onClick={create} disabled={busy || !title || !kinds.length} className="flex items-center gap-1.5"><Plus className="h-4 w-4" />创建(默认 A / B / C 三个组别,建好后在「设置」里改)</Btn>
        <p className="text-xs text-[#7a6a52]">项目和出题参数与训练系统、教练布置作业完全一样。</p>
        <Err msg={err} />
      </Card>
      <h2 className="mb-2 font-black text-[#7a5520]">我的比赛</h2>
      {!cs ? <Loader2 className="h-5 w-5 animate-spin" /> : !cs.length ? <p className="text-sm text-[#7a6a52]">还没有比赛</p> : (
        <div className="space-y-2">{cs.map((c) => (
          <Link key={c.id} to={`/contest/admin/${c.id}${q()}`}><Card className="flex items-center gap-3 p-4 hover:shadow-md"><b>{c.title}</b><span className="text-sm text-[#7a6a52]">{c.groups.length} 个组别 · {c.events.map((e) => e.name).join(" / ")}</span></Card></Link>
        ))}</div>
      )}
    </Shell>
  );
}

const TABS = ["设置", "报名", "赛场控制", "成绩导出"] as const;
function Manage({ cid }: { cid: string }) {
  const [c, setC] = useState<Contest | null>(null), [tab, setTab] = useState<(typeof TABS)[number]>("赛场控制"), [err, setErr] = useState("");
  useEffect(() => { api<{ contest: Contest }>("contestInfo", { cid }).then((r) => setC(r.contest)).catch((e) => setErr(e.message)); }, [cid]);
  if (!c) return <Shell title="组织者后台">{err ? <Err msg={err} /> : <Loader2 className="h-6 w-6 animate-spin" />}</Shell>;
  return (
    <Shell title={c.title} sub="组织者后台" wide right={<div className="flex flex-wrap gap-2">{([["rank", "排名屏"], ["live", "直播屏"], ["split", "合屏"]] as const).map(([v, nm]) => (
      <a key={v} href={`/contest/screen/${cid}?view=${v}`} target="_blank" rel="noreferrer" title={v === "split" ? "一块屏:左排名、右直播" : v === "live" ? "某位考生此刻的平板画面,在「赛场控制」切换" : "实时排名"}><Btn tone="dark" className="flex items-center gap-1.5"><Monitor className="h-4 w-4" />{nm}</Btn></a>))}</div>}>
      <div className="mb-4 flex gap-1 rounded-full bg-white/70 p-1">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={cn("flex-1 rounded-full py-2 text-sm font-bold", tab === t ? "bg-[#7a5520] text-white" : "text-[#7a5520]")}>{t}</button>)}</div>
      {tab === "设置" && <Settings c={c} onSaved={setC} />}
      {tab === "报名" && <Regs c={c} />}
      {tab === "赛场控制" && <Control c={c} />}
      {tab === "成绩导出" && <Results c={c} />}
    </Shell>
  );
}

function Settings({ c, onSaved }: { c: Contest; onSaved: (c: Contest) => void }) {
  const [d, setD] = useState<Contest>(c), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const [selG, setSelG] = useState(c.groups[0]?.id), [selE, setSelE] = useState(c.events[0]?.id);
  const cur = selG && selE && d.events.some((e) => e.id === selE) ? cfgOf(d, selG, selE) : null;
  // 新项目先在本地给每个组别放好预设(数码秒记 = 看数 10 位、看 1 秒、答题 5 秒),保存时一起提交
  const [pendingCfg, setPendingCfg] = useState<Record<number, Cfg>>({});
  const addEvent = (k: EvKind) => { const ev = kindEvent(k); setPendingCfg((p) => ({ ...p, [d.events.length]: { item: kindItem(k), minutes: 5 } })); setD({ ...d, events: [...d.events, { id: "", project: ev.project, name: ev.name ?? PROJECT_LABEL[ev.project] } as Ev] }); };
  const setCur = (x: Cfg) => setD((v) => ({ ...v, cfg: { ...v.cfg, [selG!]: { ...v.cfg[selG!], [selE!]: x } } }));
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const cfg: Contest["cfg"] = {};
      for (const g of d.groups) { if (!g.id) continue; cfg[g.id] = {}; for (const e of d.events) if (e.id) cfg[g.id][e.id] = cfgOf(d, g.id, e.id); }
      let r = await api<{ contest: Contest }>("saveContest", { cid: c.id, title: d.title, venue: d.venue, date: d.date, regDeadline: d.regDeadline, groups: d.groups, events: d.events, cfg }, true);
      // 新加的项目拿到 id 后,再把预设写进各组别(第二次保存)
      const fresh = Object.entries(pendingCfg).map(([i, cf]) => ({ ev: r.contest.events[Number(i)], cf })).filter((x) => x.ev);
      if (fresh.length) {
        const cfg2: Contest["cfg"] = {};
        for (const g of r.contest.groups) { cfg2[g.id] = {}; for (const e of r.contest.events) cfg2[g.id][e.id] = fresh.find((x) => x.ev.id === e.id)?.cf ?? cfgOf(r.contest, g.id, e.id); }
        r = await api<{ contest: Contest }>("saveContest", { cid: c.id, cfg: cfg2 }, true);
        setPendingCfg({});
      }
      setD(r.contest); onSaved(r.contest); setMsg("已保存");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <Card className="grid gap-3 sm:grid-cols-2">
        <Field label="比赛名称"><input className={inputCls} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></Field>
        <Field label="日期"><input className={inputCls} value={d.date ?? ""} placeholder="如 2026年12月6日" onChange={(e) => setD({ ...d, date: e.target.value })} /></Field>
        <Field label="地点"><input className={inputCls} value={d.venue ?? ""} onChange={(e) => setD({ ...d, venue: e.target.value })} /></Field>
        <Field label="报名截止"><input type="datetime-local" className={inputCls} value={d.regDeadline ?? ""} onChange={(e) => setD({ ...d, regDeadline: e.target.value || null })} /></Field>
      </Card>
      <Card>
        <div className="mb-2 flex items-center gap-2"><b>组别</b><button className="text-sm text-[#7a5520] underline" onClick={() => setD({ ...d, groups: [...d.groups, { id: "", name: `${"ABCDEFGHIJKL"[d.groups.length] ?? "新"}组` }] })}>+ 加组别</button></div>
        <div className="flex flex-wrap gap-2">{d.groups.map((g, i) => <input key={i} className="w-28 rounded-lg border border-[#d9c39b] px-2 py-1.5" value={g.name} onChange={(e) => setD({ ...d, groups: d.groups.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />)}</div>
        <p className="mt-2 text-xs text-[#7a6a52]">新加的组别保存后才能设出题参数</p>
      </Card>
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2"><b>比赛项目</b>
          {d.events.map((e, i) => <span key={e.id || i} className="flex items-center gap-1 rounded-full border border-[#d9c39b] bg-white px-3 py-1 text-sm font-bold">{e.name}
            {!e.id && <button className="text-[#9e2a2b]" onClick={() => setD({ ...d, events: d.events.filter((_, j) => j !== i) })}>×</button>}</span>)}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-[#7a6a52]">+ 加项目:</span>
          {EV_KINDS.map((k) => <button key={k} className="rounded-full border border-dashed border-[#c9a24a] px-3 py-1 text-[#7a5520]" onClick={() => addEvent(k)}>{kindLabel(k)}</button>)}</div>
        <p className="mt-2 text-xs text-[#7a6a52]">新加的项目保存后才能设出题参数、才会出现在报名表里</p>
      </Card>
      <Card>
        <b>各组别 × 项目出题设置</b><span className="ml-2 text-xs text-[#7a6a52]">和教练布置作业是同一套设置(题量就是本场题数)</span>
        <div className="mt-3 flex flex-wrap gap-2">{d.groups.filter((g) => g.id).map((g) => <button key={g.id} onClick={() => setSelG(g.id)} className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", selG === g.id ? "border-[#7a5520] bg-[#7a5520] text-white" : "border-[#d9c39b] bg-white")}>{g.name}</button>)}</div>
        <div className="mt-2 flex flex-wrap gap-2">{d.events.map((e) => <button key={e.id} onClick={() => setSelE(e.id)} className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", selE === e.id ? "border-[#9c7a2e] bg-[#f6e7c1]" : "border-[#d9c39b] bg-white")}>{e.name}</button>)}</div>
        {cur && (
          <div className="mt-4 rounded-xl border border-[#efe2c4] bg-white/70 p-3">
            {cur.more?.length ? <p className="mb-2 text-sm font-black text-[#7a5520]">第 1 段难度 <span className="font-normal text-[#7a6a52]">(显示方式、字号、音色等以第 1 段为准)</span></p> : null}
            <HwItemEditor value={cur.item} onChange={(it) => setCur({ ...cur, item: it })} hideProject />
            {/* 难度段(2026-11-08 用户「同个项目中组合不同的难度」):按顺序出题,每段按自己的题量;最后一段自动补足到限时内做不完 */}
            {(cur.more ?? []).map((seg, i) => (
              <div key={i} className="mt-3 border-t border-dashed border-[#d9c39b] pt-3">
                <div className="mb-2 flex items-center"><b className="text-sm text-[#7a5520]">第 {i + 2} 段难度</b>
                  <button className="ml-auto text-xs text-[#9e2a2b] underline" onClick={() => setCur({ ...cur, more: cur.more!.filter((_, j) => j !== i) })}>删除这一段</button></div>
                <HwItemEditor value={seg} onChange={(it) => setCur({ ...cur, more: cur.more!.map((x, j) => (j === i ? normalizeItem({ ...it, project: cur.item.project }) : x)) })} hideProject />
              </div>
            ))}
            <button className="mt-3 rounded-full border border-dashed border-[#c9a24a] px-4 py-1.5 text-sm font-bold text-[#7a5520]" onClick={() => { const last = cur.more?.length ? cur.more[cur.more.length - 1] : cur.item; setCur({ ...cur, more: [...(cur.more ?? []), { ...last }] }); }}>+ 加一段难度(同一项目里组合不同难度)</button>
            {tierKind(cur.item.project) && (() => {
              const t = tiersOf(cur)!, listen = tierKind(cur.item.project) === "listen";
              return (
                <div className="mt-3 border-t border-[#efe2c4] pt-3">
                  <p className="text-sm font-bold">速度三档 <span className="font-normal text-[#7a6a52]">(考生比赛中在屏幕上自己选,默认「中」;{listen ? "听算填语速档 1–10" : "填每笔间隔秒数"})</span></p>
                  <div className="mt-2 flex flex-wrap gap-4">{TIER_NAMES.map((nm, k) => (
                    <label key={nm} className="flex items-center gap-2 text-sm font-bold">{nm}
                      {listen ? <Num value={t[k]} min={1} max={10} unit="档" onChange={(v) => setCur({ ...cur, tiers: t.map((x, j) => (j === k ? v : x)) })} />
                        : <Num value={t[k] / 1000} min={0.1} max={5} step={0.05} decimals={2} unit="秒/笔" onChange={(v) => setCur({ ...cur, tiers: t.map((x, j) => (j === k ? Math.round(v * 1000) : x)) })} />}
                    </label>))}</div>
                </div>
              );
            })()}
            <div className="mt-3 flex items-center gap-3 border-t border-[#efe2c4] pt-3 text-sm font-bold">比赛限时<Num value={cur.minutes} min={1} max={60} unit="分钟" onChange={(v) => setCur({ ...cur, minutes: v })} /></div>
            <p className="mt-2 text-xs text-[#7a6a52]">{cfgText(cur)}</p>
          </div>
        )}
      </Card>
      <div className="flex items-center gap-3"><Btn onClick={save} disabled={busy}>{busy ? "保存中…" : "保存设置"}</Btn><span className="text-sm text-[#7a5520]">{msg}</span></div>
    </div>
  );
}

/** 以某考生身份打开平板(测试用,新标签页) */
async function openTablet(cid: string, phone: string) {
  const w = window.open("about:blank", "_blank");
  try { const r = await api<{ token: string }>("asCandidate", { cid, phone }, true); if (w) w.location.href = `/contest/arena?t=${r.token}`; } catch (e) { w?.close(); alert((e as Error).message); }
}

function Regs({ c }: { c: Contest }) {
  const url = `${import.meta.env.DEV ? "https://superbrainlab.org" : location.origin}/contest/join/${c.id}`; // 本地开发时也显示正式地址(演示视频里不出现本机地址)
  const [qr, setQr] = useState(""), [regs, setRegs] = useState<Reg[] | null>(null), [pw, setPw] = useState<Record<string, string>>({});
  const [big, setBig] = useState<{ src: string; name: string } | null>(null);
  const load = useCallback(() => api<{ regs: Reg[] }>("registrations", { cid: c.id }, true).then((r) => setRegs(r.regs)), [c.id]);
  useEffect(() => { qrDataUrl(url).then(setQr); load(); }, [url, load]);
  const gName = (id: string) => c.groups.find((g) => g.id === id)?.name ?? id;
  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <Card className="text-center">
        <QrCode className="mx-auto h-5 w-5 text-[#9c7a2e]" /><p className="mt-1 font-black">报名二维码</p>
        {qr && <img src={qr} alt="报名二维码" className="mx-auto mt-2 w-48" style={{ imageRendering: "pixelated" }} />}
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs text-[#7a5520] underline">{url}</a>
      </Card>
      <Card className="overflow-x-auto">
        <div className="mb-2 flex items-center gap-2"><b>报名名单 {regs ? `(${regs.length} 人)` : ""}</b>
          <Btn tone="ghost" className="ml-auto px-3 py-1.5 text-xs" onClick={() => api("addTestRegs", { cid: c.id, n: 6 }, true).then(load)}>+ 添加 6 个测试考生</Btn>
          <button onClick={load} className="text-[#7a5520]"><RefreshCw className="h-4 w-4" /></button></div>
        <p className="mb-2 text-xs text-[#7a6a52]">测试流程:点「打开平板」以该考生身份开一个平板页(可开多个),不用登录。</p>
        {!regs ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-[#7a6a52]"><th className="py-1">照片</th><th>考号</th><th>姓名</th><th>年龄</th><th>身份证号</th><th>组别</th><th>项目</th><th>手机号</th><th /></tr></thead>
            <tbody>{regs.map((r) => (
              <tr key={r.phone} className="border-t border-[#efe2c4]"><td className="py-1.5">{r.thumb ? <img src={r.thumb} alt="" title="点击看大图" className="h-12 w-10 cursor-zoom-in rounded object-cover" onClick={() => api<{ photo: string | null }>("photo", { cid: c.id, phone: r.phone }, true).then((x) => x.photo && setBig({ src: x.photo, name: r.name }))} /> : <span className="text-xs text-[#b0a090]">—</span>}</td>
                <td className="font-mono font-bold">{r.examNo}</td><td>{r.name}</td><td>{r.age ?? ""}</td><td className="font-mono text-xs" title={r.idNo}>{maskId(r.idNo)}</td><td>{gName(r.group)}</td><td className="text-xs">{r.events.map((e) => c.events.find((x) => x.id === e)?.name).join("、")}</td>
                <td className="font-mono text-xs">{(r as Reg & { test?: boolean }).test ? <span className="text-[#b0a090]">测试考生</span> : r.phone}</td>
                <td className="whitespace-nowrap text-right"><button className="mr-3 rounded-full bg-[#7a5520] px-2.5 py-1 text-xs font-bold text-white" onClick={() => openTablet(c.id, r.phone)}>打开平板</button>
                  {pw[r.phone] ? <span className="font-mono text-xs">新密码 {pw[r.phone]}</span> : <button className="text-xs text-[#7a5520] underline" onClick={() => api<{ password: string }>("resetPassword", { cid: c.id, phone: r.phone }, true).then((x) => setPw((p) => ({ ...p, [r.phone]: x.password })))}>重置密码</button>}</td></tr>
            ))}</tbody></table>
        )}
      </Card>
      {big && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setBig(null)}><figure className="rounded-2xl bg-white p-3 text-center"><img src={big.src} alt="" className="max-h-[75vh] rounded-xl" /><figcaption className="mt-2 font-bold">{big.name}</figcaption></figure></div>}
    </div>
  );
}

function Control({ c }: { c: Contest }) {
  const [st, setSt] = useState<State | null>(null), [rk, setRk] = useState<Ranking | undefined>(), [err, setErr] = useState("");
  const [bigScr, setBigScr] = useState<{ focus?: string; target?: string | null }>({});
  const [group, setGroup] = useState(c.groups[0]?.id), [event, setEvent] = useState(c.events[0]?.id), [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const go = () => { const sent = Date.now(); api<{ now: number; state: State; ranking?: Ranking; focus?: string; target?: string | null }>("screen", { cid: c.id }).then((r) => { syncClock(r.now, sent); setSt(r.state); setRk(r.ranking); setBigScr({ focus: r.focus, target: r.target }); }).catch(() => {}); };
    go(); const t = setInterval(go, 1500), u = setInterval(() => tick((x) => x + 1), 250); return () => { clearInterval(t); clearInterval(u); };
  }, [c.id]);
  const act = async (action: string, body: Record<string, unknown> = {}) => { setBusy(true); setErr(""); try { const r = await api<{ state: State }>(action, { cid: c.id, ...body }, true); setSt(r.state); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  // 统一开始:用训练系统的出题(homework.genProblems)按本组别本项目的设置出一套题,同场所有平板同一套
  const start = () => { if (!st?.group || !st.event) return; const cf = cfgOf(c, st.group, st.event); act("start", { countdown: 5, problems: contestProblems(cf) }); }; // 各难度段依次 + 补足到限时
  const t = serverNow();
  // 大屏直播切换(2026-11-08 用户「随时切换某一个学生的屏幕,大屏可以显示」)
  const setFocus = (examNo: string) => { setBigScr((x) => ({ ...x, focus: examNo })); api("focus", { cid: c.id, examNo }, true).catch((e) => setErr((e as Error).message)); };
  const live = st?.status === "running" && (st.endAt ?? 0) > t;
  const gN = c.groups.find((g) => g.id === st?.group)?.name, eN = c.events.find((e) => e.id === st?.event)?.name;
  return (
    <div className="grid gap-4 md:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <Card className="space-y-3">
          <b>① 切换场次</b>
          <div className="flex flex-wrap gap-2">{c.groups.map((g) => <button key={g.id} onClick={() => setGroup(g.id)} className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", group === g.id ? "border-[#7a5520] bg-[#7a5520] text-white" : "border-[#d9c39b] bg-white")}>{g.name}</button>)}</div>
          <div className="flex flex-wrap gap-2">{c.events.map((e) => <button key={e.id} onClick={() => setEvent(e.id)} className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", event === e.id ? "border-[#7a5520] bg-[#7a5520] text-white" : "border-[#d9c39b] bg-white")}>{e.name}</button>)}</div>
          <p className="text-xs text-[#7a6a52]">{group && event ? cfgText(cfgOf(c, group, event)) : ""}</p>
          <Btn onClick={() => act("setSession", { group, event })} disabled={busy || live} className="w-full">切换到 {c.groups.find((g) => g.id === group)?.name} · {c.events.find((e) => e.id === event)?.name}</Btn>
        </Card>
        <Card className="space-y-3">
          <b>② 统一开始 / 结束</b>
          <p className="text-sm">当前场次:<b>{gN && eN ? `${gN} · ${eN}` : "未选择"}</b> <span className="text-[#7a6a52]">({st ? STATUS_NAME[live ? "running" : st.status === "running" ? "ended" : st.status] : "…"})</span></p>
          <Btn tone="red" onClick={start} disabled={busy || st?.status !== "ready"} className="flex w-full items-center justify-center gap-2 py-3 text-base"><Play className="h-5 w-5" />裁判口令 · 统一开始</Btn>
          <Btn tone="dark" onClick={() => confirm("确定统一结束本场?所有平板立即锁定。") && act("end")} disabled={busy || !live} className="flex w-full items-center justify-center gap-2"><Square className="h-4 w-4" />统一结束</Btn>
          {live && <p className="text-center font-mono text-5xl font-black text-[#9e2a2b]">{st!.startAt! > t ? `${Math.ceil((st!.startAt! - t) / 1000)}` : fmtClock(st!.endAt! - t)}</p>}
          <Err msg={err} />
        </Card>
      </div>
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2"><b>实时排名</b>{rk && <span className="text-sm text-[#7a6a52]">到场 {rk.rows.filter((r) => r.joined).length} / {rk.rows.length}</span>}
          <span className="ml-auto text-sm">大屏直播:<b className="text-[#9e2a2b]">{bigScr.focus && bigScr.focus !== "auto" ? bigScr.focus : "自动跟第一名"}</b>{bigScr.target ? ` · 当前 ${bigScr.target}` : ""}</span>
          <button onClick={() => setFocus("auto")} disabled={!bigScr.focus || bigScr.focus === "auto"} className="rounded-full border border-[#d9c39b] px-3 py-1 text-xs font-bold text-[#7a5520] disabled:opacity-40">自动跟第一名</button></div>
        {!rk ? <p className="text-sm text-[#7a6a52]">切换场次后显示本场考生</p> : (
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-[#7a6a52]"><th className="py-1">名次</th><th>考号</th><th>姓名</th><th className="text-right">做题</th><th className="text-right">正确</th><th className="text-right">状态</th><th className="text-right">大屏</th></tr></thead>
            <tbody>{rk.rows.map((r) => <tr key={r.examNo} className="border-t border-[#efe2c4]"><td className="py-1.5 font-black">{r.rank}</td><td className="font-mono">{r.examNo}</td><td>{r.name}</td><td className="text-right">{r.answered}</td><td className="text-right font-bold">{r.correct}</td><td className="text-right text-xs">{r.joined ? "已入座" : <span className="text-[#b0a090]">未到</span>}</td>
              <td className="text-right">{bigScr.target === r.examNo ? <span className="rounded-full bg-[#9e2a2b] px-2 py-0.5 text-xs font-bold text-white">直播中</span> : <button onClick={() => setFocus(r.examNo)} className="rounded-full border border-[#9e2a2b] px-2 py-0.5 text-xs font-bold text-[#9e2a2b]">上大屏</button>}</td></tr>)}</tbody></table>
        )}
      </Card>
    </div>
  );
}

function Results({ c }: { c: Contest }) {
  const [d, setD] = useState<{ title: string; sessions: Ranking[] } | null>(null), [err, setErr] = useState("");
  useEffect(() => { api<{ title: string; sessions: Ranking[] }>("results", { cid: c.id }, true).then(setD).catch((e) => setErr(e.message)); }, [c.id]);
  const exportXlsx = async () => {
    if (!d) return;
    const ExcelJS = (await import("exceljs")).default; const wb = new ExcelJS.Workbook();
    for (const s of d.sessions) {
      const ws = wb.addWorksheet(`${s.group}-${s.event}`.slice(0, 31));
      ws.addRow([`${d.title} · ${s.group} · ${s.event}`]); ws.addRow(["名次", "考号", "姓名", "年龄", "学校 / 机构", "身份证号", "做题数", "正确数"]);
      s.rows.forEach((r) => ws.addRow([r.rank, r.examNo, r.name, r.age ?? "", r.school ?? "", r.idNo ?? "", r.answered, r.correct]));
      ws.columns = [{ width: 8 }, { width: 10 }, { width: 14 }, { width: 8 }, { width: 18 }, { width: 22 }, { width: 10 }, { width: 10 }];
    }
    const buf = await wb.xlsx.writeBuffer(); const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf])); a.download = `${d.title}-排名表.xlsx`; a.click();
  };
  if (err) return <Err msg={err} />;
  if (!d) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-4">
      <Btn onClick={exportXlsx} disabled={!d.sessions.length} className="flex items-center gap-1.5"><Download className="h-4 w-4" />导出排名表(Excel,每个组别 × 项目一张表)</Btn>
      {!d.sessions.length && <p className="text-sm text-[#7a6a52]">还没有比过的场次</p>}
      {d.sessions.map((s) => (
        <Card key={s.sid}>
          <b>{s.group} · {s.event}</b><span className="ml-2 text-xs text-[#7a6a52]">{s.startAt ? new Date(s.startAt).toLocaleString("zh-CN") : ""}</span>
          <table className="mt-2 w-full text-sm"><tbody>{s.rows.slice(0, 10).map((r) => <tr key={r.examNo} className="border-t border-[#efe2c4]"><td className="w-12 py-1 font-black">{r.rank}</td><td className="font-mono">{r.examNo}</td><td>{r.name}</td><td className="text-right">{r.correct} / {r.answered}</td></tr>)}</tbody></table>
          {s.rows.length > 10 && <p className="mt-1 text-xs text-[#7a6a52]">共 {s.rows.length} 人,完整名单见导出表</p>}
        </Card>
      ))}
    </div>
  );
}

export default function ContestAdmin() {
  const { cid } = useParams();
  return <RequireLogin>{cid ? <Manage cid={cid} /> : <List />}</RequireLogin>;
}
