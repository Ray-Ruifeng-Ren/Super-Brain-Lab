// 账单(/bill,2026-11-11):公司注资和各项支出。管理口令(与 /admin 相同)+ 管理员账号登录才能看;数据在服务端 ledger 函数。
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { siteUrl } from "@/lib/appEnv";
import { gateOpen, openGate } from "@/lib/adminGate";

interface Entry { id: string; date: string; kind: "in" | "out"; item: string; category: string; amount: number | null; note: string; by?: string }
type Draft = Omit<Entry, "id" | "amount"> & { id?: string; amount: string };

const CATEGORIES = ["注资", "资质与认证", "服务器与云服务", "软件订阅", "域名与邮箱", "推广", "其他"];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const blank = (): Draft => ({ date: today(), kind: "out", item: "", category: "服务器与云服务", amount: "", note: "" });
const yuan = (n: number) => "¥" + n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(siteUrl("/.netlify/functions/ledger"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, authToken: data.session?.access_token, ...body }) });
  const j = await r.json().catch(() => ({ error: "网络出错" }));
  if (!r.ok) throw Object.assign(new Error(j.error || "出错了"), { status: r.status });
  return j as T;
}

export default function Bill() {
  const [gate, setGate] = useState(gateOpen);
  const [pw, setPw] = useState(""); const [gateErr, setGateErr] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(""); const [denied, setDenied] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    setLoading(true); setErr(""); setDenied(false);
    try { setEntries((await call<{ entries: Entry[] }>("list")).entries); }
    catch (e) { const ex = e as Error & { status?: number }; if (ex.status === 403) setDenied(true); else setErr(ex.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (gate && signedIn) load(); }, [gate, signedIn]);

  const sum = useMemo(() => {
    const known = entries.filter((e) => e.amount != null);
    const inc = known.filter((e) => e.kind === "in").reduce((t, e) => t + (e.amount as number), 0);
    const out = known.filter((e) => e.kind === "out").reduce((t, e) => t + (e.amount as number), 0);
    const month = today().slice(0, 7);
    const monthOut = known.filter((e) => e.kind === "out" && e.date.startsWith(month)).reduce((t, e) => t + (e.amount as number), 0);
    const byCat = new Map<string, number>();
    for (const e of known) if (e.kind === "out") byCat.set(e.category, (byCat.get(e.category) || 0) + (e.amount as number));
    return { inc, out, left: inc - out, monthOut, pending: entries.filter((e) => e.amount == null).length, byCat: [...byCat].sort((a, b) => b[1] - a[1]) };
  }, [entries]);

  const save = async () => {
    if (!draft) return;
    setSaving(true); setErr("");
    try {
      const { entry } = await call<{ entry: Entry }>("save", { entry: { ...draft, amount: draft.amount.trim() === "" ? null : Number(draft.amount) } });
      setEntries((list) => [entry, ...list.filter((x) => x.id !== entry.id)].sort((a, b) => b.date.localeCompare(a.date)));
      setDraft(null);
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };
  const remove = async (e: Entry) => {
    if (!window.confirm(`删除「${e.date} ${e.item}」这笔账?`)) return;
    try { await call("remove", { id: e.id }); setEntries((list) => list.filter((x) => x.id !== e.id)); } catch (ex) { setErr((ex as Error).message); }
  };

  const input = "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary";
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">珠象 · 账单</h1>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <a href="/feedback" className="transition-colors hover:text-foreground">用户反馈 →</a>
            <a href="/admin" className="transition-colors hover:text-foreground">数据分析 →</a>
          </div>
        </div>

        {!gate && (
          <div className="mx-auto mt-10 max-w-sm rounded-lg border border-border bg-card p-5">
            <p className="mb-3 text-sm font-medium">请输入管理口令</p>
            <input type="password" value={pw} autoFocus placeholder="管理口令" className={input + " mb-2 h-10"}
              onChange={(e) => { setPw(e.target.value); setGateErr(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { if (openGate(pw)) setGate(true); else setGateErr("口令不对"); } }} />
            {gateErr && <div className="mb-2 text-xs text-destructive">{gateErr}</div>}
            <button disabled={!pw} onClick={() => { if (openGate(pw)) setGate(true); else setGateErr("口令不对"); }}
              className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50">进入</button>
          </div>
        )}

        {gate && signedIn === false && (
          <div className="rounded-lg border border-border bg-card p-6 text-sm">
            <p className="mb-3 font-medium">账单只给管理员看,请先登录管理员账号。</p>
            <a href="/" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">去首页登录</a>
          </div>
        )}
        {gate && signedIn && denied && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5 text-sm text-amber-700">当前登录的账号不是管理员,看不到账单。请换管理员账号登录。</div>
        )}

        {gate && signedIn && !denied && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {([["累计注资", yuan(sum.inc), ""], ["累计支出", yuan(sum.out), ""], ["账上余额", yuan(sum.left), sum.left < 0 ? "text-destructive" : "text-emerald-600"], ["本月支出", yuan(sum.monthOut), ""]] as const).map(([k, v, c]) => (
                <div key={k} className="rounded-lg border border-border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">{k}</div>
                  <div className={`mt-1 font-mono-tabular text-2xl font-semibold ${c}`}>{v}</div>
                </div>
              ))}
            </div>
            {sum.byCat.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-2 text-xs">
                {sum.byCat.map(([c, n]) => <span key={c} className="rounded-full border border-border bg-card px-3 py-1">{c} <b className="font-mono-tabular">{yuan(n)}</b></span>)}
                {sum.pending > 0 && <span className="rounded-full border border-amber-500/40 bg-amber-500/5 px-3 py-1 text-amber-700">{sum.pending} 笔金额待确认,未计入合计</span>}
              </div>
            )}

            <div className="mb-3 flex items-center gap-2">
              <button onClick={() => setDraft(blank())} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">+ 记一笔</button>
              <button onClick={load} disabled={loading} className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">{loading ? "加载中…" : "刷新"}</button>
            </div>
            {err && <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{err}</div>}

            {draft && (
              <div className="mb-4 rounded-lg border border-primary/40 bg-card p-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                  <label className="text-xs text-muted-foreground">日期<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={input + " mt-1"} /></label>
                  <label className="text-xs text-muted-foreground">类型
                    <select value={draft.kind} onChange={(e) => { const kind = e.target.value as Entry["kind"]; setDraft({ ...draft, kind, category: kind === "in" ? "注资" : draft.category === "注资" ? "其他" : draft.category }); }} className={input + " mt-1"}>
                      <option value="out">支出</option><option value="in">注资 / 收入</option>
                    </select></label>
                  <label className="col-span-2 text-xs text-muted-foreground">项目<input value={draft.item} placeholder="如:软件著作权登记" onChange={(e) => setDraft({ ...draft, item: e.target.value })} className={input + " mt-1"} /></label>
                  <label className="text-xs text-muted-foreground">分类
                    <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={input + " mt-1"}>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select></label>
                  <label className="text-xs text-muted-foreground">金额(元,可空)<input inputMode="decimal" value={draft.amount} placeholder="待确认" onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(/[^\d.]/g, "") })} className={input + " mt-1 font-mono-tabular"} /></label>
                  <label className="col-span-2 text-xs text-muted-foreground md:col-span-5">备注<input value={draft.note} placeholder="如:US$33,按 1 美元 = 7 元折算" onChange={(e) => setDraft({ ...draft, note: e.target.value })} className={input + " mt-1"} /></label>
                  <div className="col-span-2 flex items-end gap-2 md:col-span-1">
                    <button onClick={save} disabled={saving || !draft.item.trim()} className="h-9 flex-1 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "保存中…" : "保存"}</button>
                    <button onClick={() => setDraft(null)} className="h-9 rounded-md border border-border px-3 text-sm">取消</button>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>{["日期", "项目", "分类", "金额", "备注", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{e.date}</td>
                      <td className="px-3 py-2 font-medium">{e.item}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{e.category}</td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right font-mono-tabular ${e.amount == null ? "text-amber-600" : e.kind === "in" ? "text-emerald-600" : ""}`}>
                        {e.amount == null ? "待确认" : (e.kind === "in" ? "+" : "−") + yuan(e.amount)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{e.note}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                        <button onClick={() => setDraft({ ...e, amount: e.amount == null ? "" : String(e.amount) })} className="text-primary hover:underline">编辑</button>
                        <button onClick={() => remove(e)} className="ml-3 text-muted-foreground hover:text-destructive">删除</button>
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{loading ? "加载中…" : "还没有记录"}</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">金额单位人民币元;美元费用按当时汇率折算后填写,原价写在备注里。金额留空表示待确认,不计入合计。</p>
          </>
        )}
      </div>
    </div>
  );
}
