// 用户反馈 / 开发闭环(/feedback,2026-11-12):管理员把用户反馈、自己的优化想法记进来,开发这边在 Claude Code 里拉取逐条实现,做完标「已完成」并写处理结果。
// 管理口令(与 /admin、/bill 相同)+ 管理员账号登录才能用;数据在服务端 feedback 函数(Netlify Blobs)。只做网页端,不进 Pad。
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { siteUrl } from "@/lib/appEnv";
import { gateOpen, openGate } from "@/lib/adminGate";

type Kind = "bug" | "opt" | "feature" | "other";
type Side = "web" | "pad" | "both";
type Priority = "high" | "mid" | "low";
type Status = "open" | "doing" | "done" | "hold";
interface Item { id: string; title: string; detail: string; kind: Kind; area: string; side: Side; priority: Priority; status: Status; result: string; from: string; hasImage: boolean; image?: string; by?: string; handledBy?: string; createdAt: number; updatedAt: number; doneAt: number | null }
interface Draft { text: string; image: string } // 一个框:第一行是标题,后面是细节

const KIND: Record<Kind, string> = { bug: "问题", opt: "优化", feature: "新功能", other: "其他" };
const SIDE: Record<Side, string> = { web: "网页端", pad: "Pad 端", both: "两端" };
const PRI: Record<Priority, [string, string]> = { high: ["高", "bg-red-500/10 text-red-600 border-red-500/30"], mid: ["中", "bg-amber-500/10 text-amber-700 border-amber-500/30"], low: ["低", "bg-muted text-muted-foreground border-border"] };
const ST: Record<Status, [string, string]> = { open: ["待处理", "bg-sky-500/10 text-sky-700"], doing: ["处理中", "bg-violet-500/10 text-violet-700"], done: ["已完成", "bg-emerald-500/10 text-emerald-700"], hold: ["搁置", "bg-muted text-muted-foreground"] };
const blank = (): Draft => ({ text: "", image: "" });
const when = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(siteUrl("/.netlify/functions/feedback"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, authToken: data.session?.access_token, ...body }) });
  const j = await r.json().catch(() => ({ error: "网络出错" }));
  if (!r.ok) throw Object.assign(new Error(j.error || "出错了"), { status: r.status });
  return j as T;
}

// 截图压到最长边 1400px 的 JPEG,控制在 100 万字符以内(函数端上限)
async function compress(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("读不了这张图")); i.src = url; });
    const k = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.7, 0.55, 0.4]) { const s = c.toDataURL("image/jpeg", q); if (s.length <= 1_000_000) return s; }
    throw new Error("图片太大,请裁小一点");
  } finally { URL.revokeObjectURL(url); }
}

export default function Feedback() {
  const [gate, setGate] = useState(gateOpen);
  const [pw, setPw] = useState(""); const [gateErr, setGateErr] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(""); const [denied, setDenied] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank());
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Status | "all">("open");
  const [open, setOpen] = useState<string | null>(null);          // 展开的卡片
  const [images, setImages] = useState<Record<string, string>>({}); // 懒加载的图
  const [editing, setEditing] = useState<{ id: string; status: Status; result: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false); // 拖拽截图进框时高亮

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const load = async () => {
    setLoading(true); setErr(""); setDenied(false);
    try { setItems((await call<{ items: Item[] }>("list")).items); }
    catch (e) { const ex = e as Error & { status?: number }; if (ex.status === 403) setDenied(true); else setErr(ex.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (gate && signedIn) load(); }, [gate, signedIn]);

  const counts = useMemo(() => { const c: Record<string, number> = { all: items.length }; for (const i of items) c[i.status] = (c[i.status] || 0) + 1; return c; }, [items]);
  const shown = useMemo(() => (filter === "all" ? items : items.filter((i) => i.status === filter)), [items, filter]);

  const pickImage = async (f: File | Blob | null | undefined) => {
    if (!f) return;
    try { setDraft((d) => ({ ...d, image: "" })); const s = await compress(f); setDraft((d) => ({ ...d, image: s })); setErr(""); }
    catch (e) { setErr((e as Error).message); }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/"));
    if (f) pickImage(f); else setErr("请拖入图片文件");
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); if (!dragging) setDragging(true); };
  const onPaste = (e: React.ClipboardEvent) => {
    const f = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"))?.getAsFile();
    if (f) { e.preventDefault(); pickImage(f); }
  };
  const submit = async () => {
    const lines = draft.text.trim().split("\n"); const title = lines[0].trim(), detail = lines.slice(1).join("\n").trim();
    if (!title) return;
    setSaving(true); setErr("");
    try {
      const { item } = await call<{ item: Item }>("save", { item: { title, detail, image: draft.image } });
      setItems((list) => [item, ...list]); setDraft(blank()); setFilter("open");
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };
  const expand = async (it: Item) => {
    const next = open === it.id ? null : it.id; setOpen(next);
    if (next && it.hasImage && !images[it.id]) {
      try { const { item } = await call<{ item: Item }>("get", { id: it.id }); if (item.image) setImages((m) => ({ ...m, [it.id]: item.image! })); } catch { /* 图加载失败不影响其它 */ }
    }
  };
  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true); setErr("");
    try {
      const { item } = await call<{ item: Item }>("save", { item: { id: editing.id, status: editing.status, result: editing.result } });
      setItems((list) => list.map((x) => (x.id === item.id ? item : x))); setEditing(null);
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };
  const quickStatus = async (it: Item, status: Status) => {
    try { const { item } = await call<{ item: Item }>("save", { item: { id: it.id, status } }); setItems((list) => list.map((x) => (x.id === item.id ? item : x))); }
    catch (e) { setErr((e as Error).message); }
  };
  const remove = async (it: Item) => {
    if (!window.confirm(`删除「${it.title}」?`)) return;
    try { await call("remove", { id: it.id }); setItems((list) => list.filter((x) => x.id !== it.id)); } catch (e) { setErr((e as Error).message); }
  };

  const input = "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary";
  const chip = (cls: string, text: string) => <span className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium ${cls}`}>{text}</span>;
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">珠象 · 用户反馈</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">记下反馈和想法 → 开发端拉取实现 → 回写处理结果</p>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <a href="/bill" className="transition-colors hover:text-foreground">账单 →</a>
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
            <p className="mb-3 font-medium">反馈页只给管理员用,请先登录管理员账号。</p>
            <a href="/" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">去首页登录</a>
          </div>
        )}
        {gate && signedIn && denied && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5 text-sm text-amber-700">当前登录的账号不是管理员。请换管理员账号登录。</div>
        )}

        {gate && signedIn && !denied && (
          <>
            {/* 录入:一个框,第一行当标题;截图直接粘贴 */}
            <div className={`mb-5 rounded-lg border bg-card p-3 transition-colors ${dragging ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-primary/40"}`} onPaste={onPaste} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={() => setDragging(false)}>
              <textarea value={draft.text} rows={4} autoFocus placeholder={dragging ? "松开鼠标,把截图放进来" : "要改什么,直接写。第一行是标题,下面补细节(可空)。截图直接粘贴或拖进来。"}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
                className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:border-primary" />
              {draft.image && (
                <div className="mt-2 flex items-start gap-2">
                  <img src={draft.image} alt="" className="max-h-40 rounded-md border border-border" />
                  <button onClick={() => setDraft({ ...draft, image: "" })} className="text-xs text-muted-foreground hover:text-destructive">去掉</button>
                </div>
              )}
              <div className="mt-2 flex items-center gap-3">
                <button onClick={submit} disabled={saving || !draft.text.trim()} className="h-9 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "提交中…" : "提交"}</button>
                <button onClick={() => fileRef.current?.click()} className="text-xs text-muted-foreground hover:text-foreground">{draft.image ? "换一张截图" : "选截图"}</button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
                <button onClick={load} disabled={loading} className="ml-auto text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">{loading ? "加载中…" : "刷新"}</button>
              </div>
              {err && <div className="mt-2 text-sm text-destructive">{err}</div>}
            </div>

            {/* 筛选 */}
            <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
              {([["open", "待处理"], ["doing", "处理中"], ["done", "已完成"], ["hold", "搁置"], ["all", "全部"]] as const).map(([k, t]) => (
                <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 ${filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}>{t} {counts[k] || 0}</button>
              ))}
            </div>

            {/* 列表 */}
            <div className="space-y-2">
              {shown.map((it) => (
                <div key={it.id} className={`rounded-lg border bg-card ${it.status === "done" ? "border-border/60 opacity-80" : "border-border"}`}>
                  <button onClick={() => expand(it)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {chip(ST[it.status][1], ST[it.status][0])}
                        {chip(PRI[it.priority][1] + " border", PRI[it.priority][0])}
                        <span className="text-[11px] text-muted-foreground">{[it.kind !== "opt" ? KIND[it.kind] : "", it.area !== "其他" ? it.area : "", it.side !== "web" ? SIDE[it.side] : "", it.from, it.hasImage ? "📎" : ""].filter(Boolean).join(" · ")}</span>
                      </div>
                      <div className="mt-1 text-sm font-medium">{it.title}</div>
                      {open !== it.id && it.detail && <div className="mt-0.5 truncate text-xs text-muted-foreground">{it.detail}</div>}
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                      <div>{when(it.createdAt)}</div>
                      {it.doneAt && <div className="text-emerald-600">完成 {when(it.doneAt)}</div>}
                    </div>
                  </button>
                  {open === it.id && (
                    <div className="border-t border-border px-4 py-3 text-sm">
                      {it.detail && <p className="whitespace-pre-wrap text-foreground/90">{it.detail}</p>}
                      {it.hasImage && (images[it.id] ? <a href={images[it.id]} target="_blank" rel="noreferrer"><img src={images[it.id]} alt="" className="mt-2 max-h-72 rounded-md border border-border" /></a> : <div className="mt-2 text-xs text-muted-foreground">截图加载中…</div>)}
                      {(it.result || editing?.id === it.id) && (
                        <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                          <div className="mb-1 text-[11px] font-medium text-emerald-700">处理结果{it.handledBy ? ` · ${it.handledBy}` : ""}</div>
                          {editing?.id === it.id ? (
                            <textarea value={editing.result} rows={3} autoFocus onChange={(e) => setEditing({ ...editing, result: e.target.value })} className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary" />
                          ) : <p className="whitespace-pre-wrap">{it.result}</p>}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        {editing?.id === it.id ? (
                          <>
                            <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Status })} className="h-8 rounded-md border border-border bg-background px-2 text-xs">{(Object.keys(ST) as Status[]).map((s) => <option key={s} value={s}>{ST[s][0]}</option>)}</select>
                            <button onClick={saveEdit} disabled={saving} className="h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground disabled:opacity-50">保存</button>
                            <button onClick={() => setEditing(null)} className="h-8 rounded-md border border-border px-3">取消</button>
                          </>
                        ) : (
                          <>
                            {it.status !== "doing" && it.status !== "done" && <button onClick={() => quickStatus(it, "doing")} className="h-8 rounded-md border border-violet-500/40 px-3 text-violet-700 hover:bg-violet-500/10">开始处理</button>}
                            {it.status !== "done" && <button onClick={() => setEditing({ id: it.id, status: "done", result: it.result })} className="h-8 rounded-md border border-emerald-500/40 px-3 text-emerald-700 hover:bg-emerald-500/10">标记完成并写结果</button>}
                            {it.status === "done" && <button onClick={() => quickStatus(it, "open")} className="h-8 rounded-md border border-border px-3 hover:bg-muted">重新打开</button>}
                            {it.status !== "hold" && it.status !== "done" && <button onClick={() => quickStatus(it, "hold")} className="h-8 rounded-md border border-border px-3 hover:bg-muted">搁置</button>}
                            <button onClick={() => setEditing({ id: it.id, status: it.status, result: it.result })} className="h-8 rounded-md border border-border px-3 hover:bg-muted">编辑结果</button>
                            <button onClick={() => remove(it)} className="ml-auto h-8 px-2 text-muted-foreground hover:text-destructive">删除</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {shown.length === 0 && <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{loading ? "加载中…" : filter === "open" ? "没有待处理的反馈" : "这里是空的"}</div>}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">开发闭环:在 Claude Code 里说「处理反馈」,会用 scripts/feedback.mjs 拉取待处理项逐条实现,完成后在这里标记并写处理结果。粘贴截图会自动压缩到 1400px。</p>
          </>
        )}
      </div>
    </div>
  );
}
