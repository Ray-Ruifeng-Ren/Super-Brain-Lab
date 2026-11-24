// 学生端 /homework(2026-10-11):凭班级码加入教练 → 看作业清单 → 逐项作答(即时对错、错题反复重做)→ 看教练评价。
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { EyeCareToggle } from "@/components/EyeCareToggle";
import { AuthDialog } from "@/components/AuthDialog";
import { HomeworkRunner, NumScaleRow } from "@/components/HomeworkRunner";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  fmtDate, fmtDur, genProblems, getMyCoaches, getReviews, getStudentAssignments, getSubmissions, itemLabel, normalizeItem,
  submitHomework, summarize, PROJECT_EMOJI, type HwAssignment, type HwItem, type HwProblem, type HwResult, type HwReview, type HwSubmission, todayKey,
  saveDraft, getMyDrafts, activeDraft, clearLocalDraft, type HwDraft } from "@/lib/homework";
import { cn } from "@/lib/utils";
import { useTx } from "@/lib/tx";
import { useI18n } from "@/lib/i18n";
import { fmtDurEn, WD_EN, MON_EN } from "@/lib/tx-coach";
import { PROJECT_TILES } from "@/components/ProjectTiles";

// DEV 专用:/homework?preview=1 免登录看作业清单(模拟数据,生产构建剔除)
const PREVIEW = import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1";
const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function devMock() {
  const now = Date.now(), iso = (d: number) => new Date(now - d * 86400000).toISOString();
  const items = [normalizeItem({ project: "flash", n: 15 }), normalizeItem({ project: "glance", n: 20 }), normalizeItem({ project: "listen", n: 10 })];
  const assignments: HwAssignment[] = [];
  const subs: HwSubmission[] = [];
  for (let d = -2; d < 6; d++) {
    const id = `a${d}`, date = dayKey(now - d * 86400000), [, m, dd] = date.split("-").map(Number);
    assignments.push({ id, coachId: "c", studentId: "me", title: `${m}月${dd}日作业`, note: d === 0 ? "注意看清减号" : "", items: d === 0 ? items.map((it) => ({ ...it, n: 2 })) : items, createdAt: iso(Math.max(d, 0)), date, coachNick: "付老师" });
    if (d < 0) continue;
    (d === 0 ? items.map((it) => ({ ...it, n: 2 })) : items).forEach((it, k) => {
      if (d === 0 && k > 0) return; // 今天只做了第一项
      if (d === 1 && k === 2) return; // 昨天漏了一项 → 补做
      const total = it.n, correct = total - ((d + k) % 3);
      const results = Array.from({ length: total }, (_, q) => ({ terms: [12, 34], signs: ["+", "+"] as ("+" | "-")[], answer: 46, given: q < correct ? 46 : 45, correct: q < correct, ms: 3000 }));
      subs.push({ id: `${id}-${k}`, assignId: id, studentId: "me", itemIdx: k, results, correct, total, ms: total * 3000, retry: false, createdAt: iso(d) });
    });
  }
  return { assignments, subs };
}

const Homework = () => {
  const navigate = useNavigate();
  const tx = useTx();
  const { lang } = useI18n();
  const en = lang === "en";
  const T = (zh: string, enS: string) => (en ? enS : zh);
  const { user, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [coaches, setCoaches] = useState<{ id: string; nickname: string }[]>([]);
  const [assignments, setAssignments] = useState<HwAssignment[]>([]);
  const [subs, setSubs] = useState<HwSubmission[]>([]);
  const [reviews, setReviews] = useState<HwReview[]>([]);
  const [running, setRunning] = useState<{ a: HwAssignment; itemIdx: number; item: HwItem; problems: HwProblem[]; startRound: number; initialResults?: HwResult[] } | null>(null);
  const [drafts, setDrafts] = useState<HwDraft[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [justDone, setJustDone] = useState<Set<string>>(new Set()); // 本次刚做完的项(云端成绩还没刷回来时,「下一项」也不会指回它)

  const reload = useCallback(async () => {
    if (PREVIEW) { const m = devMock(); setCoaches([{ id: "c", nickname: "付老师" }]); setAssignments(m.assignments); setSubs(m.subs); setReviews([]); setDrafts([]); return; }
    if (!user) return;
    const [c, as] = await Promise.all([getMyCoaches(), getStudentAssignments()]);
    setCoaches(c); setAssignments(as);
    const ids = as.map((a) => a.id);
    const [s, r, d] = await Promise.all([getSubmissions(ids), getReviews(ids), getMyDrafts(ids)]);
    setSubs(s); setReviews(r); setDrafts(d);
  }, [user]);
  useEffect(() => { void reload(); }, [reload]);
  // DEV 专用:/homework?demo=flash|listen|glance|bead 免登录预览学生作答器(生产构建剔除)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const d = new URLSearchParams(window.location.search).get("demo");
    if (!d) return;
    const item = normalizeItem({ project: d as HwItem["project"], n: 3, count: 3 });
    const a: HwAssignment = { id: "demo", coachId: "", studentId: "", title: "预览", note: "", items: [item], createdAt: new Date().toISOString(), date: todayKey() };
    setRunning({ a, itemIdx: 0, item, problems: genProblems(item), startRound: 0 });
  }, []);

  const latestReview = useMemo(() => { const m = new Map<string, HwReview>(); for (const r of reviews) m.set(r.assignId, r); return m; }, [reviews]);
  const draftOf = (a: HwAssignment, itemIdx: number) => activeDraft(drafts, subs, a.id, itemIdx);
  const start = (a: HwAssignment, itemIdx: number) => {
    const item = a.items[itemIdx];
    // 有未完成的暂存 → 接着做(同一批题、已做的答案保留,从下一题开始)
    const d = draftOf(a, itemIdx);
    if (d) { setRunning({ a, itemIdx, item, problems: d.problems, startRound: d.round, initialResults: d.results }); return; }
    setRunning({ a, itemIdx, item, problems: genProblems(item), startRound: 0 });
  };
  const onSaveDraft = async (problems: HwProblem[], results: HwResult[], round: number) => {
    if (!running || running.a.id === "demo" || PREVIEW) return true;
    const r = await saveDraft(running.a.id, running.itemIdx, problems, results, round);
    toast(r.ok
      ? { title: T(`已暂存 ${results.length}/${problems.length} 题`, `Saved ${results.length}/${problems.length}`), description: T("下次点「继续」从第 " + (results.length + 1) + " 题接着做", `Next time tap “Resume” to continue from question ${results.length + 1}`) }
      : { variant: "destructive", title: tx("云端暂存失败,已存在本机"), description: T(`${r.error} —— 在这台设备上可以接着做`, `${r.error} — you can continue on this device`) });
    return r.ok;
  };
  // 错题再练(2026-10-15 付海东「作业里的错题重练没了」):取该项最近一轮的错题原题重做,记为重做轮
  const retryWrong = (a: HwAssignment, itemIdx: number) => {
    const pg = summarize(a, subs).items[itemIdx];
    const last = pg?.retries.length ? pg.retries[pg.retries.length - 1] : pg?.first;
    const wrong = (last?.results ?? []).filter((r) => !r.correct).map((r): HwProblem => ({ terms: r.terms, signs: r.signs, answer: r.answer, op: r.op, bead: r.bead, beadS: r.beadS, beadDigits: a.items[itemIdx].beadDigits, ...(r.rem != null ? { rem: r.rem } : {}) }));
    if (!wrong.length) return;
    setRunning({ a, itemIdx, item: a.items[itemIdx], problems: wrong, startRound: (pg?.retries.length ?? 0) + 1 });
  };
  // 同一份作业里下一个还没做的项(从当前项往后找,再从头绕一圈);重做轮、演示、未开放的不给「下一项」
  const nextOf = (r: NonNullable<typeof running>) => {
    if (r.a.id === "demo" || r.startRound > 0 || r.a.date > todayKey()) return undefined;
    const pg = summarize(r.a, subs);
    const n = r.a.items.length;
    for (let k = 1; k < n; k++) {
      const i = (r.itemIdx + k) % n;
      if (!pg.items[i].done && !justDone.has(`${r.a.id}:${i}`)) return { label: `${PROJECT_EMOJI[r.a.items[i].project]} ${itemLabel(r.a.items[i])}`, go: () => { void reload(); start(r.a, i); } };
    }
    return undefined;
  };
  const onRoundDone = async (results: HwResult[], round: number) => {
    if (running) { const k = `${running.a.id}:${running.itemIdx}`; setJustDone((s) => new Set(s).add(k)); }
    if (!running || running.a.id === "demo" || PREVIEW) return;
    const r = await submitHomework(running.a.id, running.itemIdx, results, round > 0);
    if (r.ok) clearLocalDraft(running.a.id, running.itemIdx);
    if (!r.ok) toast({ variant: "destructive", title: tx("成绩上传失败"), description: T(`${r.error} —— 可以退出后重做一次。`, `${r.error} — exit and try this item again.`) });
  };

  // 按作业日期分:今天及之前的在「待完成」(过期未做的标「补做」),未来几天的在「后面几天」里只看不做(2026-10-14 一次布置 7 天)
  const today = todayKey();
  const pending = assignments.filter((a) => summarize(a, subs).status !== "done" && a.date <= today).sort((a, b) => (a.date === b.date ? 0 : a.date > b.date ? -1 : 1));
  const upcoming = assignments.filter((a) => summarize(a, subs).status !== "done" && a.date > today).sort((a, b) => (a.date < b.date ? -1 : 1));
  // 已完成:按作业日期倒序,最新的在最上面(2026-10-21 布施:一次布置多天的作业,已完成里成了正序);同日期按布置时间倒序
  const done = assignments.filter((a) => summarize(a, subs).status === "done").sort((a, b) => (a.date !== b.date ? (a.date > b.date ? -1 : 1) : b.createdAt.localeCompare(a.createdAt)));

  // 学生概况(2026-10-26 角色走查:学生一进来先看到「今天还剩几项、连续几天、最近正确率」,页面不再只有一张卡)
  const stats = useMemo(() => {
    const todayLeft = pending.reduce((n, a) => n + summarize(a, subs).items.filter((i) => !i.done).length, 0);
    const days = new Set(subs.map((x) => dayKey(new Date(x.createdAt).getTime())));
    let streak = 0;
    for (let t = Date.now(), first = true; ; t -= 86400000, first = false) {
      if (days.has(dayKey(t))) streak++;
      else if (!(first && streak === 0)) break; // 今天还没做不算断,从昨天往前数
      if (streak > 365) break;
    }
    const since = Date.now() - 7 * 86400000;
    const recent = subs.filter((x) => !x.retry && new Date(x.createdAt).getTime() >= since);
    const c = recent.reduce((n, x) => n + x.correct, 0), tot = recent.reduce((n, x) => n + x.total, 0);
    return { todayLeft, streak, rate: tot ? Math.round((c / tot) * 100) : null, weekDone: assignments.filter((a) => a.date >= dayKey(since) && summarize(a, subs).status === "done").length };
  }, [pending, subs, assignments]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{tx("加载中…")}</div>;

  return (
    <div className="relative min-h-screen text-foreground">
      <div aria-hidden className="paper-bg pointer-events-none fixed inset-0 z-0" />
      <header className="safe-t sticky top-0 z-30 border-b border-[#B8925A]/40 bg-[#FBF5E6]/85 backdrop-blur">
        <div className="container flex items-center justify-between py-3">
          <button onClick={() => { try { sessionStorage.setItem("sbl_stay_home", "1"); } catch { /* noop */ } navigate("/"); }} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <img src="/logo-emblem.png?v=2" alt="珠象" className="mr-1 h-7 w-auto" />
            <ArrowLeft className="h-3.5 w-3.5" /> {tx("广场")} <span className="mx-1 text-muted-foreground/60">/</span> <span className="text-foreground">{tx("我的作业")}</span>
          </button>
          <div className="flex items-center gap-2"><EyeCareToggle /><AccountMenu /></div>
        </div>
      </header>

      <main className="container relative z-10 max-w-4xl py-4">
        {!user && !PREVIEW ? (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-8 text-center">
            <div className="text-5xl">📚</div>
            <h1 className="mt-3 text-xl font-black">{tx("我的作业")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{tx("用教练给你的登录名和密码登录,作业就在这里;做完立刻看到对错,错题可反复练,教练会给评价。")}</p>
            <button onClick={() => setAuthOpen(true)} className="hp-leather hp-leather-on mt-5 rounded-full px-8 py-2.5 text-sm font-bold">{tx("登录 / 注册")}</button>
          </div>
        ) : (
          <>
            <div className="hp-card mb-4 px-4 py-3">
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {[
                  { k: tx("待做"), v: stats.todayLeft, u: T("项", ""), hot: stats.todayLeft > 0 },
                  { k: tx("连续练"), v: stats.streak, u: T("天", stats.streak === 1 ? " day" : " days"), hot: false },
                  { k: tx("7天正确率"), v: stats.rate ?? "—", u: stats.rate == null ? "" : "%", hot: false },
                  { k: tx("7天完成"), v: stats.weekDone, u: T("份", ""), hot: false },
                ].map((x) => (
                  <div key={x.k}>
                    <div className="text-[11px] text-muted-foreground">{x.k}</div>
                    <div className={cn("font-mono-tabular text-xl font-black sm:text-2xl", x.hot && "text-primary")}>{x.v}<span className="ml-0.5 text-xs font-normal text-muted-foreground">{x.u}</span></div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-sm">
                <div>
                  <span className="font-bold">{tx("我的教练")}:</span>
                  {coaches.length ? coaches.map((c) => <span key={c.id} className="ml-2 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{c.nickname}</span>) : <span className="ml-2 text-xs text-muted-foreground">{tx("本账号不属于任何教练")}</span>}
                </div>
                <span className="text-[11px] text-muted-foreground">{tx("账号由教练创建并归班,无需自行加入")}</span>
              </div>
            </div>

            {/* 作业没有配置页:字号统一在这里调,对所有作业生效(2026-11-03) */}
            <NumScaleRow className="hp-card mb-4 px-4 py-3" />
            <h2 className="hp-title mb-2 flex items-baseline gap-2 text-xl font-bold">{tx("待完成")} <span className="text-xs font-normal text-muted-foreground">{pending.length}{T(" 份", "")}</span></h2>
            {pending.length === 0 && (
              <div className="hp-card py-10 text-center text-sm text-muted-foreground">
                {coaches.length ? tx("太棒了,作业都做完了 🎉") : tx("用教练给你的登录名登录后,作业会出现在这里。")}
              </div>
            )}
            <div className="space-y-3">
              {pending.map((a) => <AssignCard key={a.id} a={a} pg={summarize(a, subs)} review={latestReview.get(a.id)} onStart={(i) => start(a, i)} onRetryWrong={(i) => retryWrong(a, i)} draftOf={(i) => draftOf(a, i)} today={today} />)}
            </div>

            {/* 做完作业还想练:直接进自由练习(不计入作业),不用退回首页再找 */}
            <div className="mt-6">
              <div className="mb-2 flex items-baseline gap-2 font-bold">{tx("自由练习")} <span className="text-xs font-normal text-muted-foreground">{tx("不计入作业 · 想多练就点")}</span></div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PROJECT_TILES.map((p) => (
                  <Link key={p.id} to={p.href} className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-center text-white shadow-sm transition hover:brightness-110" style={{ background: p.leather }}>
                    <span className="text-lg leading-none">{p.emoji}</span>
                    <span className="text-sm font-bold tracking-wider">{en ? p.en : p.zh}</span>
                  </Link>
                ))}
              </div>
            </div>

            {done.length > 0 && (
              <div className="mt-6">
                <button onClick={() => setShowDone((v) => !v)} className="mb-2 flex items-baseline gap-2 font-bold">{tx("已完成")} <span className="text-xs font-normal text-muted-foreground">{done.length}{T(" 份", "")} · {showDone ? tx("收起") : tx("展开")}</span></button>
                {showDone && <div className="space-y-3">{done.map((a) => <AssignCard key={a.id} a={a} pg={summarize(a, subs)} review={latestReview.get(a.id)} onStart={(i) => start(a, i)} onRetryWrong={(i) => retryWrong(a, i)} draftOf={(i) => draftOf(a, i)} today={today} />)}</div>}
              </div>
            )}
            {/* 2026-10-26 布施「已布置未开始的作业,能否不在最上面显示」:「后面几天」挪到页面最下面,默认收起,只显示一行份数,点开才看 */}
            {upcoming.length > 0 && (
              <div className="mt-6">
                <button onClick={() => setShowUpcoming((v) => !v)} className="mb-2 flex items-baseline gap-2 font-bold text-muted-foreground">{tx("后面几天")} <span className="text-xs font-normal">{upcoming.length}{T(" 份", "")} · {tx("到当天才能开始")} · {showUpcoming ? tx("收起") : tx("展开")}</span></button>
                {showUpcoming && <div className="space-y-3">{upcoming.map((a) => <AssignCard key={a.id} a={a} pg={summarize(a, subs)} review={latestReview.get(a.id)} onStart={(i) => start(a, i)} today={today} locked />)}</div>}
              </div>
            )}
          </>
        )}
      </main>

      {running && (
        <HomeworkRunner hideAnswer key={`${running.a.id}-${running.itemIdx}-${running.startRound}`} nextItem={nextOf(running)} item={running.item} problems={running.problems} startRound={running.startRound} initialResults={running.initialResults} onSaveDraft={onSaveDraft} title={`${running.a.title} · ${itemLabel(running.item)}`}
          onRoundDone={onRoundDone} onExit={() => { setRunning(null); void reload(); }} />
      )}
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
};

const dateTag = (k: string, today: string, en = false) => { const [y, m, d] = k.split("-").map(Number); const dow = new Date(y, m - 1, d).getDay(); const wd = "日一二三四五六"[dow]; if (en) return k === today ? "Today" : `${WD_EN[dow]}, ${MON_EN[m - 1]} ${d}`; return k === today ? "今天" : `${m}月${d}日 周${wd}`; };
function AssignCard({ a, pg, review, onStart, onRetryWrong, draftOf, today, locked = false }: { a: HwAssignment; pg: ReturnType<typeof summarize>; review?: HwReview; onStart: (itemIdx: number) => void; onRetryWrong?: (itemIdx: number) => void; draftOf?: (itemIdx: number) => HwDraft | null; today?: string; locked?: boolean }) {
  const tx = useTx();
  const { lang } = useI18n();
  const en = lang === "en";
  const T = (zh: string, enS: string) => (en ? enS : zh);
  return (
    <div className={cn("hp-card p-4", pg.status === "done" && "opacity-90")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          {today && <span className={cn("mr-2 rounded-full px-2 py-0.5 text-xs font-bold", locked ? "bg-muted text-muted-foreground" : a.date < today && pg.status !== "done" ? "bg-red-400/15 text-red-700" : "bg-primary/10 text-primary")}>📅 {dateTag(a.date, today, en)}{!locked && a.date < today && pg.status !== "done" ? T(" · 补做", " · overdue") : ""}</span>}
          <span className="font-bold">{a.title}</span>
          <span className="ml-2 text-xs text-muted-foreground">{a.coachNick ?? tx("教练")}{a.editedAt && <span className="ml-1 rounded bg-amber-400/20 px-1 text-amber-700">{tx("已修改")}</span>}</span>
        </div>
        <span className="text-xs text-muted-foreground">{pg.doneCount}/{pg.total}{T(" 项", " items")}{pg.answered > 0 && <> · {T("正确", "correct")} {pg.correct}/{pg.answered}</>}</span>
      </div>
      {a.note && <p className="mt-1.5 rounded-md bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">📝 {a.note}</p>}
      <ul className="mt-3 space-y-1.5">
        {a.items.map((it, i) => {
          const ip = pg.items[i];
          const allOk = ip.first && ip.first.correct === ip.first.total;
          return (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", ip.done ? (ip.finalAllCorrect ? "bg-emerald-400/20 text-emerald-700" : "bg-amber-400/20 text-amber-700") : "bg-muted text-muted-foreground")}>{ip.done ? (ip.finalAllCorrect ? "✓" : "!") : i + 1}</span>
                <span>{PROJECT_EMOJI[it.project]} {itemLabel(it)}</span>
              </span>
              <span className="flex items-center gap-2">
                {ip.first && (
                  <span className="text-xs text-muted-foreground">
                    {T("对", "Score")} <b className={allOk ? "text-emerald-600" : "text-amber-600"}>{ip.first.correct}/{ip.first.total}</b> · {en ? fmtDurEn(ip.first.ms) : fmtDur(ip.first.ms)}
                    {ip.retries.length > 0 && <> · {T(`重做${ip.retries.length}轮`, `redo ×${ip.retries.length}`)}{ip.finalAllCorrect ? T("已全对", ", all correct") : ""}</>}
                  </span>
                )}
                {(() => { const last = ip.retries.length ? ip.retries[ip.retries.length - 1] : ip.first; const wrongN = (last?.results ?? []).filter((r) => !r.correct).length; return !locked && ip.done && wrongN > 0 && onRetryWrong
                  ? <button onClick={() => onRetryWrong(i)} className="rounded-full bg-amber-400 px-4 py-1 text-xs font-bold text-black">{tx("错题再练")} ({wrongN})</button> : null; })()}
                {locked ? <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{tx("当天开放")}</span>
                  : (() => { const d = draftOf?.(i); return d
                    ? <button onClick={() => onStart(i)} className="hp-leather hp-leather-on rounded-full px-4 py-1 text-xs font-bold">{tx("继续")} {d.results.length}/{d.problems.length}</button>
                    : <button onClick={() => onStart(i)} className={cn("hp-leather rounded-full px-4 py-1 text-xs font-bold", !ip.done && "hp-leather-on")}>{ip.done ? tx("再练一遍") : T("开始", "Start")}</button>; })()}
              </span>
            </li>
          );
        })}
      </ul>
      {review && (
        <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
          <span className="text-amber-500">{"★".repeat(review.stars)}{"☆".repeat(5 - review.stars)}</span>
          <span className="ml-2 font-medium">{tx("教练评价:")}</span><span className="ml-1">{review.comment || tx("继续加油!")}</span>
        </div>
      )}
    </div>
  );
}

export default Homework;
