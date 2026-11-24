// 数据分析后台。两路数据合并:
//  1) Supabase Edge Function `admin-data`(服务端 service_role):邮箱 + practice_attempts 答题数/正确率(登录 admin 才有)
//  2) 前端公开读 scores 表:成绩数 / 活跃天 / 最高难度D / 最近活跃(覆盖全部历史,老用户也算得到)
// 之所以要两路:practice_attempts 是后加的逐题记录,老用户成绩在 scores 里、practice_attempts 里为 0。
import { siteUrl } from "@/lib/appEnv";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BASE_SEATS, grantCoach, listCoaches, revokeCoach, setCoachSeats, type CoachGrant } from "@/lib/coachAccess";
import { ResetPasswordDialog, loginIdOf } from "@/components/ResetPasswordDialog";
import { fmtDur, getAllAssignments, getReviews, getSubmissions, summarize, type HwAssignment, type HwReview, type HwSubmission } from "@/lib/homework";

interface EdgeUser { id: string; nickname: string | null; email: string; created_at: string; total: number; correct: number; last_active: string | null; }
interface Overview { users: number; attempts: number; correct: number; }
interface Score { user_id: string; meta: { D?: number } | null; created_at: string; }
interface Profile { id: string; nickname: string | null; created_at: string; }

import { ADMIN_PW } from "@/lib/adminGate"; // 前置口令门(软门禁,/bill 共用)

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" }) : "—");
const fmtDay = (s?: string | null) => (s ? new Date(s).toLocaleDateString("zh-CN") : "—");
const grp = (n: number) => n.toLocaleString("en-US");
const dayOf = (iso: string) => iso.slice(0, 10);

async function invoke<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-data", { body: { action, ...extra } });
  if (error) {
    let msg = error.message || "请求失败"; let status = 0;
    try { const ctx = (error as { context?: Response }).context; if (ctx) { status = ctx.status; const j = await ctx.json(); if (j?.error) msg = j.error; } } catch { /* noop */ }
    const e = new Error(msg) as Error & { status?: number }; e.status = status; throw e;
  }
  return data as T;
}

async function fetchAllScores(): Promise<Score[]> {
  const all: Score[] = []; const PAGE = 1000;
  for (let from = 0; from < 100000; from += PAGE) {
    // 只算真正的成绩:作业/班级/准考证核销记录也存在 scores 表(2026-10-11 作业系统),不是成绩,排除
    const { data, error } = await supabase.from("scores").select("user_id,meta,created_at").not("game", "in", "(hw,class,ticket)").order("created_at", { ascending: false }).range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as unknown as Score[]));
    if (data.length < PAGE) break;
  }
  return all;
}

interface Row {
  id: string; nickname: string; email: string; created_at: string;
  scoreCount: number; maxD: number; activeDays: number; active7: number; lastActive: string | null;
  attempts: number; correct: number; hasAttempts: boolean;
}

export default function Admin() {
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [myId, setMyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [notAdmin, setNotAdmin] = useState(false);
  const [resetFor, setResetFor] = useState<{ id: string; name: string; loginId?: string } | null>(null); // 重置密码弹窗

  // 前置口令门
  const [gate, setGate] = useState<boolean>(() => { try { return sessionStorage.getItem("sbl_admin_gate") === "1"; } catch { return false; } });
  const [pw, setPw] = useState("");
  const [gateErr, setGateErr] = useState("");
  const enter = () => {
    if (pw === ADMIN_PW) { setGate(true); setGateErr(""); try { sessionStorage.setItem("sbl_admin_gate", "1"); sessionStorage.setItem("sbl_admin_pw", pw); } catch { /* noop */ } }
    else setGateErr("口令错误");
  };

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [edgeUsers, setEdgeUsers] = useState<EdgeUser[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sortKey, setSortKey] = useState<"created_at" | "lastActive" | "scoreCount" | "maxD" | "activeDays" | "active7" | "attempts">("created_at"); // 2026-10-14 用户:默认按注册时间
  const [coachCount, setCoachCount] = useState<number | null>(null);
  useEffect(() => { if (gate && signedIn) listCoaches().then((cs) => setCoachCount(cs.length)).catch(() => setCoachCount(null)); }, [gate, signedIn]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session); setEmail(data.session?.user?.email ?? ""); setMyId(data.session?.user?.id ?? "");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSignedIn(!!s); setEmail(s?.user?.email ?? ""); setMyId(s?.user?.id ?? "");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    setLoading(true); setErr(""); setNotAdmin(false);
    // 1) 公开数据(始终能读):profiles + scores
    try {
      const [{ data: profs }, sc] = await Promise.all([
        supabase.from("profiles").select("id,nickname,created_at").limit(20000),
        fetchAllScores(),
      ]);
      setProfiles((profs as unknown as Profile[]) ?? []);
      setScores(sc);
    } catch (e) { setErr(String((e as Error).message || e)); }
    // 2) 边缘函数(邮箱 + 答题数/正确率),需登录 + admin;失败不阻塞
    try {
      const [ov, us] = await Promise.all([invoke<Overview>("overview"), invoke<{ users: EdgeUser[] }>("users", { limit: 1000 })]);
      setOverview(ov); setEdgeUsers(us.users);
    } catch (e) {
      const ex = e as Error & { status?: number };
      setEdgeUsers(null); setOverview(null);
      if (ex.status === 403) setNotAdmin(true);
      else if (ex.status === 401) setErr("登录状态失效,请重新登录。");
      // 其它错误静默:仍展示公开的活跃数据
    } finally { setLoading(false); }
  };

  useEffect(() => { if (gate && signedIn) load(); /* eslint-disable-next-line */ }, [gate, signedIn]);

  const rows = useMemo<Row[]>(() => {
    const agg = new Map<string, { count: number; maxD: number; days: Set<string>; days7: Set<string>; last: string }>();
    const since7 = new Date(Date.now() - 7 * 86400e3).toISOString();
    for (const s of scores) {
      let a = agg.get(s.user_id);
      if (!a) { a = { count: 0, maxD: 0, days: new Set(), days7: new Set(), last: s.created_at }; agg.set(s.user_id, a); }
      a.count += 1; a.days.add(dayOf(s.created_at));
      if (s.created_at >= since7) a.days7.add(dayOf(s.created_at));
      const D = Number(s.meta?.D) || 0; if (D > a.maxD) a.maxD = D;
      if (s.created_at > a.last) a.last = s.created_at;
    }
    const edgeMap = new Map((edgeUsers ?? []).map((u) => [u.id, u]));
    return profiles.map((p) => {
      const a = agg.get(p.id); const e = edgeMap.get(p.id);
      const lastScore = a?.last ?? null;
      const lastAtt = e?.last_active ?? null;
      const lastActive = [lastScore, lastAtt].filter(Boolean).sort().slice(-1)[0] ?? null;
      return {
        id: p.id, nickname: p.nickname || "—", email: e?.email || "", created_at: p.created_at,
        scoreCount: a?.count ?? 0, maxD: a?.maxD ?? 0, activeDays: a?.days.size ?? 0, active7: a?.days7.size ?? 0, lastActive,
        attempts: e?.total ?? 0, correct: e?.correct ?? 0, hasAttempts: !!e,
      };
    });
  }, [profiles, scores, edgeUsers]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => sortKey === "lastActive"
      ? (b.lastActive || "").localeCompare(a.lastActive || "")
      : sortKey === "created_at" ? b.created_at.localeCompare(a.created_at)
      : (b[sortKey] as number) - (a[sortKey] as number));
    return arr;
  }, [rows, sortKey]);

  const th = (key: typeof sortKey, label: string) => (
    <th onClick={() => setSortKey(key)} className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium transition-colors hover:text-foreground ${sortKey === key ? "text-primary" : ""}`}>{label}{sortKey === key ? " ↓" : ""}</th>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">珠象 · 数据分析</h1>
          <a href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">← 返回</a>
        </div>

        {!gate && (
          <div className="mx-auto mt-10 max-w-sm rounded-lg border border-border bg-card p-5">
            <p className="mb-3 text-sm font-medium">请输入管理口令</p>
            <input
              type="password" value={pw} autoFocus
              onChange={(e) => { setPw(e.target.value); setGateErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && enter()}
              placeholder="管理口令"
              className="mb-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            {gateErr && <div className="mb-2 text-xs text-destructive">{gateErr}</div>}
            <button onClick={enter} disabled={!pw} className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50">进入</button>
          </div>
        )}

        {gate && signedIn === false && (
          <div className="rounded-lg border border-border bg-card p-6 text-sm">
            <p className="mb-3 font-medium">需要先登录管理员账号。</p>
            <p className="mb-4 text-muted-foreground">请到首页右上角登录你的账号,再回到本页。</p>
            <a href="/" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">去首页登录</a>
          </div>
        )}

        {gate && signedIn && (
          <>
            <CoachAccessPanel rows={rows} />
            <HomeworkPanel />
            <TicketIssuer />
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>已登录:{email || "—"}</span>
              <button onClick={load} disabled={loading} className="h-7 rounded-md border border-border px-3 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">{loading ? "加载中…" : "刷新"}</button>
            </div>

            {notAdmin && (
              <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
                <p className="mb-2 font-medium text-amber-600">当前账号无 admin 角色 → 暂时看不到邮箱/答题数,但下方活跃数据(来自成绩)仍准确。</p>
                <p className="mb-2 text-muted-foreground">到 Supabase → SQL Editor 执行下面这句设自己为管理员,再点「刷新」即可看邮箱:</p>
                <pre className="overflow-x-auto rounded bg-muted p-2 text-[11px] leading-relaxed text-foreground">{`insert into public.user_roles (user_id, role)\nvalues ('${myId}', 'admin')\non conflict do nothing;`}</pre>
              </div>
            )}

            {err && <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{err}</div>}

            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {([
                ["注册用户", grp(profiles.length)],
                // 2026-10-15 用户:昨日新增 = 本地日历「昨天 00:00 – 今天 00:00」注册的账号
                ["昨日新增用户", (() => { const t0 = new Date(); t0.setHours(0, 0, 0, 0); const y0 = new Date(t0.getTime() - 86400e3).toISOString(), y1 = t0.toISOString(); return grp(profiles.filter((x) => x.created_at >= y0 && x.created_at < y1).length); })()],
                ["近 7 天新增用户", grp(profiles.filter((x) => x.created_at >= new Date(Date.now() - 7 * 86400e3).toISOString()).length)],
                ["近 7 天活跃", (() => { const act = rows.filter((r) => r.active7 > 0); const avg = act.length ? (act.reduce((t, r) => t + r.active7, 0) / act.length).toFixed(1) : "0"; return `${grp(act.length)} 人 · 人均 ${avg} 天`; })()],
                ["教练数量", coachCount == null ? "—" : grp(coachCount)],
                ["累计成绩", grp(scores.length)],
                ["累计答题", overview ? grp(overview.attempts) : "需admin"],
                ["总正确率", overview && overview.attempts ? Math.round((overview.correct / overview.attempts) * 100) + "%" : (overview ? "—" : "需admin")],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">{k}</div>
                  <div className="mt-1 font-mono-tabular text-2xl font-semibold">{v}</div>
                </div>
              ))}
            </div>

            <div className="mb-2 text-[11px] text-muted-foreground">点表头排序 · 共 {rows.length} 人 · 成绩数/活跃天/最高D 来自 scores(全历史);邮箱/答题数/正确率来自 practice_attempts(需 admin,后加功能,老用户可能为 0)</div>
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">邮箱</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">昵称</th>
                    {th("created_at", "注册")}
                    {th("scoreCount", "成绩数")}
                    {th("maxD", "最高D")}
                    {th("activeDays", "活跃天")}
                    {th("active7", "7天活跃")}
                    {th("attempts", "答题数")}
                    <th className="whitespace-nowrap px-3 py-2 font-medium">正确率</th>
                    {th("lastActive", "最近活跃")}
                    <th className="whitespace-nowrap px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((u) => (
                    <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                      <td className="whitespace-nowrap px-3 py-2">{u.email || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{u.nickname}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDay(u.created_at)}</td>
                      <td className="px-3 py-2 font-mono-tabular">{grp(u.scoreCount)}</td>
                      <td className="px-3 py-2 font-mono-tabular">{u.maxD ? u.maxD.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 font-mono-tabular">{u.activeDays || "—"}</td>
                      <td className="px-3 py-2 font-mono-tabular">{u.active7 || "—"}</td>
                      <td className="px-3 py-2 font-mono-tabular">{u.hasAttempts ? grp(u.attempts) : "—"}</td>
                      <td className="px-3 py-2 font-mono-tabular">{u.attempts ? Math.round((u.correct / u.attempts) * 100) + "%" : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDate(u.lastActive)}</td>
                      <td className="whitespace-nowrap px-3 py-2"><button onClick={() => setResetFor({ id: u.id, name: u.nickname, loginId: loginIdOf(u.email) || undefined })} className="text-xs text-primary underline-offset-2 hover:underline">重置密码</button></td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">{loading ? "加载中…" : "暂无用户"}</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <ResetPasswordDialog target={resetFor} onClose={() => setResetFor(null)} />
    </div>
  );
}


// ===== 教练授权(2026-10-12):输入账号(邮箱/昵称)→ 授权为教练 → 该账号前端才能看到教练端;可撤销 =====
function CoachAccessPanel({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false); // 下拉:聚焦即展开全部账号,输入即过滤(2026-10-12 用户要求「直接下拉 + 搜索匹配」)
  const [coaches, setCoaches] = useState<CoachGrant[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const refresh = async () => setCoaches(await listCoaches());
  useEffect(() => { void refresh(); }, []);
  const coachIds = new Set(coaches.map((c) => c.coachId));
  const kw = q.trim().toLowerCase();
  const hits = open
    ? rows.filter((r) => !coachIds.has(r.id) && (!kw || r.email.toLowerCase().includes(kw) || r.nickname.toLowerCase().includes(kw)))
        .sort((a, b) => (b.lastActive || "").localeCompare(a.lastActive || "")).slice(0, 40)
    : [];
  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true); setMsg("");
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? done : `失败:${r.error}`);
    if (r.ok) { setQ(""); await refresh(); }
  };
  const label = (r: Row) => (r.email ? `${r.nickname} <${r.email}>` : r.nickname);
  const rowOf = (id: string) => rows.find((r) => r.id === id);
  return (
    <div className="mb-6 rounded-lg border border-emerald-400/50 bg-card p-4">
      <div className="mb-1 text-sm font-bold">🎓 教练授权(谁能看到教练端)</div>
      <p className="mb-3 text-xs text-muted-foreground">输入账号邮箱或昵称 → 点「授权」。被授权的账号登录后首页和菜单才出现「教练端」,其他人看不到。管理员账号天然可用。</p>
      <div className="relative max-w-md">
        <div className="flex items-center">
          <input value={q} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => { setQ(e.target.value); setMsg(""); setOpen(true); }} placeholder="点开选择账号,或输入邮箱 / 昵称搜索"
            className="h-9 w-full rounded-md border border-border bg-background px-3 pr-8 text-sm outline-none focus:border-primary" />
          <button type="button" onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }} className="-ml-7 text-muted-foreground" aria-label="展开">▾</button>
        </div>
        {open && (
          <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
            {hits.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted">
                <span className="truncate">{label(r)}<span className="ml-2 text-[10px] text-muted-foreground">{r.lastActive ? fmtDate(r.lastActive) : ""}</span></span>
                <button disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => act(() => grantCoach(r.id, label(r)), `已授权:${label(r)}`)} className="h-7 shrink-0 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50">授权</button>
              </li>
            ))}
            {hits.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">没有匹配的账号(邮箱需 admin 角色才可见;昵称始终可搜)</li>}
            {hits.length === 40 && <li className="px-3 py-1.5 text-[10px] text-muted-foreground">只显示最近活跃的 40 个,输入关键字缩小范围</li>}
          </ul>
        )}
      </div>
      {msg && <div className="mt-2 text-xs text-muted-foreground">{msg}</div>}
      <div className="mt-3 text-xs font-medium">当前教练 {coaches.length} 人 · 每人默认可建 {BASE_SEATS} 个学生账号,付费后在此填「追加席位」</div>
      <ul className="mt-1 space-y-1">
        {coaches.map((c) => (
          <li key={c.coachId} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs">
            <span className="font-medium">{rowOf(c.coachId) ? label(rowOf(c.coachId)!) : c.label || c.coachId.slice(0, 8)}</span>
            <span className="text-muted-foreground">账号配额 {BASE_SEATS} + 追加</span>
            <input type="number" min={0} max={9999} defaultValue={c.extraSeats} key={c.coachId + c.extraSeats} disabled={busy}
              onBlur={(e) => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== c.extraSeats) void act(() => setCoachSeats(c.coachId, v, c.label), `已设追加席位 ${v}`); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
              className="h-7 w-16 rounded-md border border-border bg-background px-2 text-center font-mono-tabular text-xs" />
            <span className="text-muted-foreground">= 共 {BASE_SEATS + c.extraSeats} 个</span>
            <button disabled={busy} onClick={() => { if (window.confirm(`撤销 ${c.label || c.coachId} 的教练权限?`)) void act(() => revokeCoach(c.coachId, c.label), "已撤销"); }} className="ml-auto rounded-full px-2 text-muted-foreground hover:text-red-500" title="撤销教练权限">撤销</button>
          </li>
        ))}
        {coaches.length === 0 && <li className="text-xs text-muted-foreground">还没有授权任何教练</li>}
      </ul>
    </div>
  );
}

// ===== 作业完成数据(2026-10-12):全站作业 × 学生 的完成情况,按教练/状态筛选 =====
function HomeworkPanel() {
  const [list, setList] = useState<HwAssignment[]>([]);
  const [subs, setSubs] = useState<HwSubmission[]>([]);
  const [reviews, setReviews] = useState<HwReview[]>([]);
  const [coachF, setCoachF] = useState("");
  const [statusF, setStatusF] = useState<"" | "todo" | "doing" | "done">("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const as = await getAllAssignments();
      const ids = as.map((a) => a.id);
      const [s, r] = await Promise.all([getSubmissions(ids), getReviews(ids)]);
      setList(as); setSubs(s); setReviews(r); setLoading(false);
    })();
  }, []);
  const active = list.filter((a) => !a.revoked);
  const all = active.map((a) => ({ a, pg: summarize(a, subs), rv: reviews.filter((r) => r.assignId === a.id).slice(-1)[0] }));
  const coaches = [...new Map(active.map((a) => [a.coachId, a.coachNick ?? "教练"])).entries()].map(([id, n]) => [id, n, all.filter((x) => x.a.coachId === id).length] as const);
  const countBy = (st: "todo" | "doing" | "done") => all.filter((x) => (!coachF || x.a.coachId === coachF) && x.pg.status === st).length;
  const rowsHw = all.filter((x) => (!coachF || x.a.coachId === coachF) && (!statusF || x.pg.status === statusF));
  const done = rowsHw.filter((x) => x.pg.status === "done").length;
  const correct = rowsHw.reduce((s, x) => s + x.pg.correct, 0), answered = rowsHw.reduce((s, x) => s + x.pg.answered, 0);
  const statusLabel = { todo: "未开始", doing: "进行中", done: "已完成" } as const;
  return (
    <div className="mb-6 rounded-lg border border-sky-400/50 bg-card p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold">📚 作业完成数据</div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={coachF} onChange={(e) => setCoachF(e.target.value)} className="h-7 rounded-md border border-border bg-background px-2">
            <option value="">全部教练({active.length})</option>
            {coaches.map(([id, n, c]) => <option key={id} value={id}>{n}({c})</option>)}
          </select>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)} className="h-7 rounded-md border border-border bg-background px-2">
            <option value="">全部状态({countBy("todo") + countBy("doing") + countBy("done")})</option><option value="todo">未开始({countBy("todo")})</option><option value="doing">进行中({countBy("doing")})</option><option value="done">已完成({countBy("done")})</option>
          </select>
          <span className="text-muted-foreground">当前 {rowsHw.length} 份</span>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        {([["作业份数", String(rowsHw.length)], ["完成率", rowsHw.length ? Math.round((done / rowsHw.length) * 100) + "%" : "—"], ["总正确率", answered ? Math.round((correct / answered) * 100) + "%" : "—"], ["已答题数", grp(answered)]] as [string, string][]).map(([k, v]) => (
          <div key={k} className="rounded-md border border-border bg-background p-2"><div className="text-[10px] text-muted-foreground">{k}</div><div className="font-mono-tabular text-lg font-semibold">{v}</div></div>
        ))}
      </div>
      <div className="max-h-96 overflow-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 text-left text-muted-foreground">
            <tr>{["布置时间", "教练", "学生", "作业", "项目", "状态", "正确率", "用时", "重做", "评价", "最近活动"].map((h) => <th key={h} className="whitespace-nowrap px-2 py-1.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rowsHw.map(({ a, pg, rv }) => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{fmtDate(a.createdAt)}</td>
                <td className="whitespace-nowrap px-2 py-1.5">{a.coachNick}</td>
                <td className="whitespace-nowrap px-2 py-1.5 font-medium">{a.studentNick}</td>
                <td className="max-w-[160px] truncate px-2 py-1.5">{a.title}</td>
                <td className="px-2 py-1.5 font-mono-tabular">{pg.doneCount}/{pg.total}</td>
                <td className="px-2 py-1.5"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${pg.status === "done" ? "bg-emerald-400/20 text-emerald-700" : pg.status === "doing" ? "bg-amber-400/20 text-amber-700" : "bg-muted text-muted-foreground"}`}>{statusLabel[pg.status]}</span></td>
                <td className="px-2 py-1.5 font-mono-tabular">{pg.answered ? `${Math.round((pg.correct / pg.answered) * 100)}% (${pg.correct}/${pg.answered})` : "—"}</td>
                <td className="px-2 py-1.5 font-mono-tabular">{pg.ms ? fmtDur(pg.ms) : "—"}</td>
                <td className="px-2 py-1.5 font-mono-tabular">{pg.items.reduce((s, i) => s + i.retries.length, 0) || "—"}</td>
                <td className="max-w-[160px] truncate px-2 py-1.5">{rv ? `${"★".repeat(rv.stars)} ${rv.comment}` : "—"}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{pg.latestAt ? fmtDate(pg.latestAt) : "—"}</td>
              </tr>
            ))}
            {rowsHw.length === 0 && <tr><td colSpan={11} className="px-2 py-6 text-center text-muted-foreground">{loading ? "加载中…" : "暂无作业"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== 准考证号生成器(付费开考,2026-09-19):选类型/数量 + 教练口令 → 云函数签发 20 位一次性考号 =====
function TicketIssuer() {
  const [kind, setKind] = useState<"K" | "D">("K");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const grp = (c: string) => c.replace(/(.{4})/g, "$1-").replace(/-$/, "");
  const issue = async () => {
    setBusy(true); setErr("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const authToken = sess.session?.access_token; // 管理员登录态(可选,与口令二选一)
      const gatePw = sessionStorage.getItem("sbl_admin_pw") || "";
      const res = await fetch(siteUrl("/.netlify/functions/ticket"), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "issue", authToken, gatePw, kind, count }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "生成失败");
      setCodes(j.codes);
    } catch (e: any) { setErr(String(e?.message || e)); }
    setBusy(false);
  };
  return (
    <div className="mb-6 rounded-lg border border-amber-400/50 bg-card p-4">
      <div className="mb-1 text-sm font-bold">🎫 准考证号生成(收款后发给考生,一码一考)</div>
      <p className="mb-3 text-xs text-muted-foreground">级位考试 ¥29.9 → 生成「级位」码;段位考试 ¥39.9 → 生成「段位」码。码只在生成时显示,请当场复制发给考生。</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 overflow-hidden rounded-md border border-border">
          {([["K", "级位 ¥29.9"], ["D", "段位 ¥39.9"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setKind(k)}
              className={`px-4 text-sm font-medium transition-colors ${kind === k ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
          className="h-9 w-16 rounded-md border border-border bg-background px-2 text-center text-sm" />
        <span className="text-xs text-muted-foreground">张</span>
        <button onClick={issue} disabled={busy}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "生成中…" : "生成"}
        </button>
        {codes.length > 0 && (
          <button onClick={() => navigator.clipboard?.writeText(codes.map(grp).join("\n"))}
            className="h-9 rounded-md border border-border px-3 text-sm">复制全部</button>
        )}
      </div>
      {err && <div className="mt-2 text-xs text-destructive">{err}</div>}
      {codes.length > 0 && (
        <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono-tabular text-sm leading-relaxed">{codes.map(grp).join("\n")}</pre>
      )}
    </div>
  );
}
