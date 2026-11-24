// /contest/join/:cid 扫码报名:姓名 · 身份证号(自动算年龄)· 照片 · 组别 · 项目 · 手机号 → 考号 + 初始密码(2026-11-08 加身份证 / 照片 / 年龄)
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { ageFromId, api, cfgOf, cfgText, idValid, setToken, shrinkPhoto, type Contest } from "@/lib/contest";
import { Shell, Card, Btn, Field, inputCls, Err } from "./ui";
import { cn } from "@/lib/utils";

export default function ContestJoin() {
  const { cid = "" } = useParams();
  const [c, setC] = useState<Contest | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [school, setSchool] = useState("");
  const [group, setGroup] = useState(""), [events, setEvents] = useState<string[]>([]);
  const [idNo, setIdNo] = useState(""), [photo, setPhoto] = useState<{ photo: string; thumb: string } | null>(null), [agree, setAgree] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const idOk = idValid(idNo), age = idOk ? ageFromId(idNo) : null;
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [done, setDone] = useState<{ examNo: string; password: string; name: string; group: string } | null>(null);
  useEffect(() => { api<{ contest: Contest }>("contestInfo", { cid }).then((r) => { setC(r.contest); setGroup(r.contest.groups[0]?.id ?? ""); }).catch((e) => setLoadErr(e.message)); }, [cid]);
  const closed = !!c?.regDeadline && Date.now() > new Date(c.regDeadline).getTime();

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await api<{ examNo: string; password: string; name: string; group: string }>("register", { cid, name, phone, school, group, events, idNo, photo: photo?.photo, thumb: photo?.thumb });
      setDone(r);
      const l = await api<{ token: string }>("login", { cid, phone, password: r.password }); setToken(l.token);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (loadErr) return <Shell title="比赛报名"><Card><Err msg={loadErr} /></Card></Shell>;
  if (!c) return <Shell title="比赛报名"><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#9c7a2e]" /></div></Shell>;
  if (done) return (
    <Shell title="报名成功" sub={c.title}>
      <Card className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#2e7d32]" />
        <p className="mt-3 text-lg font-black">{done.name} · {done.group}</p>
        <div className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#f6e7c1] p-3"><p className="text-xs text-[#7a5520]">考号</p><p className="font-mono text-3xl font-black">{done.examNo}</p></div>
          <div className="rounded-xl bg-[#f6e7c1] p-3"><p className="text-xs text-[#7a5520]">初始密码</p><p className="font-mono text-3xl font-black">{done.password}</p></div>
        </div>
        <p className="mt-4 text-sm text-[#5c4a30]">账号就是手机号 <b>{phone}</b>。请截图保存考号和密码,比赛当天在平板上登录。</p>
        <Link to="/contest/me"><Btn className="mt-5">去赛前训练</Btn></Link>
      </Card>
    </Shell>
  );
  return (
    <Shell title="比赛报名" sub={c.title}>
      <Card>
        {(c.date || c.venue) && <p className="mb-4 text-sm text-[#7a6a52]">{[c.date, c.venue].filter(Boolean).join(" · ")}{c.regDeadline && ` · 报名截止 ${new Date(c.regDeadline).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}</p>}
        {closed ? <Err msg="报名已截止" /> : (
          <div className="space-y-4">
            <Field label="姓名"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="选手姓名" /></Field>
            <Field label="身份证号"><input className={inputCls} value={idNo} maxLength={18} autoComplete="off" onChange={(e) => setIdNo(e.target.value.toUpperCase().replace(/[^\dX]/g, ""))} placeholder="18 位,末位可能是 X" />
              {idNo.length === 18 && !idOk && <p className="mt-1 text-xs text-[#9e2a2b]">号码校验不通过,请核对</p>}</Field>
            <Field label="年龄"><div className="rounded-xl border border-[#e2cfa4] bg-[#faf3e3] px-4 py-3 text-[#5c4a30]">{age != null ? <><b className="text-lg">{age}</b> 周岁 <span className="text-xs text-[#7a6a52]">(按身份证出生日期自动计算)</span></> : <span className="text-sm text-[#a08b6a]">填好身份证号后自动计算</span>}</div></Field>
            <Field label="选手照片">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setPhoto({ photo: await shrinkPhoto(f, 480), thumb: await shrinkPhoto(f, 120, 0.7) }); } catch { setErr("照片读取失败,换一张试试"); } e.target.value = ""; }} />
              <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-4 rounded-xl border border-dashed border-[#c9a24a] bg-white px-4 py-3 text-left">
                {photo ? <img src={photo.thumb} alt="选手照片" className="h-20 w-16 rounded-lg object-cover" /> : <span className="flex h-20 w-16 items-center justify-center rounded-lg bg-[#f6e7c1]"><Camera className="h-6 w-6 text-[#9c7a2e]" /></span>}
                <span className="text-sm text-[#7a5520]">{photo ? "已选好 · 点击更换" : "拍照或从相册选一张本人正面照"}<br /><span className="text-xs text-[#a08b6a]">比赛当天用于核对身份</span></span>
              </button>
            </Field>
            <Field label="手机号(登录账号)"><input className={inputCls} value={phone} inputMode="numeric" maxLength={11} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="11 位手机号" /></Field>
            <Field label="学校 / 机构(选填)"><input className={inputCls} value={school} onChange={(e) => setSchool(e.target.value)} /></Field>
            <Field label="组别">
              <div className="flex flex-wrap gap-2">{c.groups.map((g) => <button key={g.id} onClick={() => setGroup(g.id)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", group === g.id ? "border-[#7a5520] bg-[#7a5520] text-white" : "border-[#d9c39b] bg-white text-[#7a5520]")}>{g.name}</button>)}</div>
            </Field>
            <Field label="项目(可多选)">
              <div className="space-y-2">{c.events.map((e) => { const on = events.includes(e.id); return (
                <button key={e.id} onClick={() => setEvents((xs) => (on ? xs.filter((x) => x !== e.id) : [...xs, e.id]))} className={cn("flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left", on ? "border-[#9c7a2e] bg-[#f6e7c1]" : "border-[#e2cfa4] bg-white")}>
                  <span className="font-bold">{e.name}</span><span className="text-xs text-[#7a6a52]">{cfgText(cfgOf(c, group, e.id))}</span>
                </button>); })}</div>
            </Field>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-[#5c4a30]"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#7a5520]" />
              我是选手本人或其监护人,同意主办方为本次比赛的报名审核、身份核对和成绩公布收集上述信息(身份证号、照片只给主办方核对使用,不公开)。</label>
            <Err msg={err} />
            <Btn onClick={submit} disabled={busy || !name || !idOk || !photo || !agree || phone.length !== 11 || !events.length} className="w-full py-3 text-base">{busy ? "提交中…" : "确认提交"}</Btn>
            {(!idOk || !photo || !agree) && name && <p className="-mt-2 text-center text-xs text-[#a08b6a]">{!idOk ? "请填写正确的身份证号" : !photo ? "请上传选手照片" : "请勾选同意"}</p>}
          </div>
        )}
      </Card>
    </Shell>
  );
}
