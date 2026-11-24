// 闪电心算等级鉴定(锦标赛)页 —— /cert
// v2:对齐日本フラッシュ暗算検定官方标准(20级→20段,纯加法,10题对7合格)。
// 鉴定馆(级/段徽章墙+段位榜) → 鉴定(按级出题闪现;18-20级数字常驻) → 结果(合格/准合格/徽章/榜单/AI建议)。
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Zap } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { AuthDialog } from "@/components/AuthDialog";
import { useAuth } from "@/hooks/useAuth";
import type { Problem } from "@/lib/flashMath";
import {
  CERT_PROBLEMS, CERT_PASS, CERT_SEMI, CERT_LEVELS, AGE_GROUPS,
  levelById, levelColor, levelSpec as levelSpecZh, levelName, nextLevel, strokeMs, bestBadge, genCertProblem,
  submitCertRun, getCertBoard, getMyCert, certAdvice, fmtMs,
  ageFromUser, groupForAge, saveMyAge,
  type CertBoardRow, type MyCertEntry, type CertLevel,
} from "@/lib/cert";
import { CertDiploma } from "@/components/CertDiploma";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { BadgeChip } from "@/components/CertBadge";
import { useI18n } from "@/lib/i18n";

type View = "hall" | "run" | "result";
type RunPhase = "countdown" | "flash" | "answer" | "gap";

interface ProblemResult { problem: Problem; answered: number | null; correct: boolean; answerMs: number }

const Cert = () => {
  const navigate = useNavigate();
  // 英文版(2026-10-27 用户「切换成英文,它不是英文显示」):整页文案、级别名、考纲、建议都跟随语言
  const { lang } = useI18n();
  const en = lang === "en";
  const T = (zh: string, e: string) => (en ? e : zh);
  const N = (l: CertLevel) => levelName(l, en);
  const levelSpec = (l: CertLevel) => levelSpecZh(l, en);
  const { user, profile } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const [view, setView] = useState<View>("hall");
  // 闪现字号(鉴定馆可预览调整,自动记忆;默认 0.45,比闪电心算默认 0.6 更收敛)
  const SCALE_KEY = "cert:flashScale";
  const [flashScale, setFlashScale] = useState<number>(() => {
    try { const v = Number(window.localStorage.getItem(SCALE_KEY)); return v >= 0.1 && v <= 1.5 ? v : 0.45; } catch { return 0.45; }
  });
  useEffect(() => { try { window.localStorage.setItem(SCALE_KEY, String(flashScale)); } catch { /* noop */ } }, [flashScale]);
  const [myBest, setMyBest] = useState<Map<string, MyCertEntry>>(new Map());
  const [diploma, setDiploma] = useState<{ levelId: string; ms: number; dateISO: string } | null>(null); // 电子证书弹层
  const [selId, setSelId] = useState("k20");
  const [board, setBoard] = useState<CertBoardRow[] | null>(null);

  const passed = useMemo(() => new Set(myBest.keys()), [myBest]);
  const badge = bestBadge(passed);

  // ===== 年龄分组:注册即填;老用户进考场弹窗补填(存账号元数据,跨设备) =====
  const [localBirthYear, setLocalBirthYear] = useState<number | null>(null); // 刚保存后的乐观值(等 USER_UPDATED 事件期间顶上)
  const metaAge = ageFromUser(user);
  const myAge = metaAge ?? (localBirthYear ? Math.max(3, new Date().getFullYear() - localBirthYear) : null);
  const myGroup = myAge != null ? groupForAge(myAge) : null;
  const needAge = !!user && myAge == null;
  const [ageInput, setAgeInput] = useState("");
  const [ageSaving, setAgeSaving] = useState(false);
  const submitAge = async () => {
    const a = Number(ageInput);
    if (!Number.isFinite(a) || a < 3 || a > 99) { setAgeInput(""); return; }
    setAgeSaving(true);
    const r = await saveMyAge(a);
    setAgeSaving(false);
    if (r.ok) setLocalBirthYear(new Date().getFullYear() - Math.round(a));
  };

  // DEV 专用:/cert?diploma=d13 免登录预览证书样式(生产构建剔除)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const p = new URLSearchParams(window.location.search).get("diploma");
    if (p && levelById(p)) setDiploma({ levelId: p, ms: 43210, dateISO: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 我的通过情况(登录态变化时刷新)
  useEffect(() => { let on = true; getMyCert().then((m) => on && setMyBest(m)); return () => { on = false; }; }, [user?.id, view]);
  // 选中级别的榜单(登录后锁定在自己的年龄组;未登录看全部)
  useEffect(() => {
    let on = true; setBoard(null);
    getCertBoard(selId, 20, myGroup?.id).then((b) => on && setBoard(b));
    return () => { on = false; };
  }, [selId, view, myGroup?.id]);

  // ===== 鉴定运行状态 =====
  const [runId, setRunId] = useState("k20");
  const [phase, setPhase] = useState<RunPhase>("countdown");
  const [countdown, setCountdown] = useState(3);
  const [probIdx, setProbIdx] = useState(0);
  const [strokeIdx, setStrokeIdx] = useState(0);
  const [showTerm, setShowTerm] = useState(true); // 闪现节奏:显示→短暂空白→下一笔(与闪电心算同款)
  const [input, setInput] = useState("");
  const [results, setResults] = useState<ProblemResult[]>([]);
  const problemsRef = useRef<Problem[]>([]);
  const answerStartRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitBusyRef = useRef(false); // 提交防重入锁
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "failed" | "anon">("idle");
  const [myRank, setMyRank] = useState<number | null>(null);

  const lv = levelById(selId) ?? CERT_LEVELS[0];
  const runLv = levelById(runId) ?? CERT_LEVELS[0];

  // 开考(2026-10-04 付费门槛已下线,人人直接考;付费流程代码见 git 历史与 ticket.mjs,随时可恢复)
  const openTicket = (l: CertLevel | undefined) => {
    if (!l) return;
    startRun(l.id);
  };

  const startRun = (id: string) => {
    const l = levelById(id);
    if (!l) return;
    // 未登录可试考(成绩与徽章不记录),正式领徽章需登录
    problemsRef.current = Array.from({ length: CERT_PROBLEMS }, () => genCertProblem(l));
    setRunId(id); setResults([]); setProbIdx(0); setStrokeIdx(0); setInput("");
    setSubmitState("idle"); setMyRank(null);
    setCountdown(3); setPhase("countdown"); setView("run");
  };

  // 倒计时 → 闪现(image 级直接进作答,数字常驻)
  useEffect(() => {
    if (view !== "run" || phase !== "countdown") return;
    if (countdown <= 0) {
      if (runLv.rule === "image") { setPhase("answer"); setInput(""); answerStartRef.current = performance.now(); }
      else { setPhase("flash"); setStrokeIdx(0); }
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [view, phase, countdown, runLv.rule]);

  // 闪现:每笔 timeSec/count,与闪电心算同款「显示→短暂空白」节奏;最后一笔结束 → 作答
  useEffect(() => {
    if (view !== "run" || phase !== "flash") return;
    if (strokeIdx >= runLv.count) {
      setPhase("answer"); setInput("");
      answerStartRef.current = performance.now();
      return;
    }
    setShowTerm(true);
    const iv = strokeMs(runLv);
    // 「先消失再呈现」:空白占间隔 25%(50-250ms),换数字前必有肉眼可辨的熄灭瞬间
    const blankMs = Math.max(50, Math.min(250, Math.round(iv * 0.25)));
    const showMs = Math.max(40, iv - blankMs);
    const timers: number[] = [];
    timers.push(window.setTimeout(() => {
      setShowTerm(false);
      timers.push(window.setTimeout(() => setStrokeIdx((i) => i + 1), blankMs));
    }, showMs));
    return () => timers.forEach(clearTimeout);
  }, [view, phase, strokeIdx, runLv]);

  useEffect(() => { if (phase === "answer") { submitBusyRef.current = false; setTimeout(() => inputRef.current?.focus(), 30); } }, [phase]);

  const submitAnswer = () => {
    if (phase !== "answer") return;
    if (submitBusyRef.current) return; // 防长按 Enter/连点重复提交
    submitBusyRef.current = true;
    const answerMs = performance.now() - answerStartRef.current;
    const p = problemsRef.current[probIdx];
    const answered = input.trim() === "" ? null : Number(input.trim());
    const correct = answered !== null && Number.isFinite(answered) && answered === p.answer;
    const next = [...results, { problem: p, answered, correct, answerMs }];
    setResults(next);
    if (probIdx + 1 >= CERT_PROBLEMS) { finishRun(next); return; }
    setPhase("gap");
    setTimeout(() => {
      setProbIdx((i) => i + 1); setStrokeIdx(0);
      if (runLv.rule === "image") { setPhase("answer"); setInput(""); answerStartRef.current = performance.now(); }
      else setPhase("flash");
    }, 900);
  };

  const finishRun = async (all: ProblemResult[]) => {
    setView("result");
    const correct = all.filter((r) => r.correct).length;
    const isPass = correct >= CERT_PASS;
    if (!isPass) return;
    if (!user) { setSubmitState("anon"); return; }
    const totalMs = all.reduce((s, r) => s + r.answerMs, 0);
    setSubmitState("saving");
    const res = await submitCertRun(runId, totalMs, { correct, total: CERT_PROBLEMS, timeSec: runLv.timeSec, age: myAge ?? undefined, ageGroup: myGroup?.id });
    setSubmitState(res.ok ? "saved" : "failed");
    if (res.ok) {
      const b = await getCertBoard(runId, 100, myGroup?.id);
      const mine = b.find((r) => r.user_id === user?.id);
      setMyRank(mine ? mine.rank : null);
      setSelId(runId);
    }
  };

  // ===== 渲染 =====
  const LevelTile = ({ l }: { l: CertLevel }) => {
    const isPassed = passed.has(l.id);
    const sel = selId === l.id;
    return (
      <button onClick={() => setSelId(l.id)}
        className={cn(
          "relative rounded-lg border px-1.5 py-1.5 text-center transition-all",
          sel ? "border-amber-400 bg-amber-400/10 shadow" : "border-border bg-card hover:border-amber-400/50",
        )}>
        <div className="text-[13px] font-black leading-tight" style={{ color: isPassed ? levelColor(l) : undefined }}>
          {isPassed ? "🏅" : ""}{N(l)}
        </div>
        <div className="font-mono-tabular text-[9px] leading-tight text-muted-foreground">
          {en ? `${l.digits}D×${l.count} ${l.timeSec != null ? `${l.timeSec}s` : "static"}` : `${l.digits}位${l.count}笔${l.timeSec != null ? `${l.timeSec}s` : "常驻"}`}
        </div>
      </button>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <header className="safe-t sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex items-center justify-between py-3">
          <button onClick={() => (view === "hall" ? navigate("/") : setView("hall"))}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {view === "hall" ? T("首页", "Home") : T("鉴定馆", "Hall")}
            <span className="ml-1 text-muted-foreground/60">/</span>
            <span className="ml-1 text-foreground">{T("闪电心算等级鉴定", "Flash Anzan Certification")}</span>
          </button>
          <AccountMenu />
        </div>
      </header>

      <main className="container max-w-6xl py-4">
        {/* ================= 鉴定馆 ================= */}
        {view === "hall" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-400/15 via-card to-card p-5">
                <div className="flex items-center gap-3">
                  <Trophy className="h-8 w-8 text-amber-500" />
                  <div>
                    <h1 className="text-xl font-black">{T("闪电心算 · 等级鉴定", "Flash Anzan · Certification")}</h1>
                    {en ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <b className="text-foreground">A pioneering world-class grading standard, eligible for Guinness World Records applications</b>: 20 Kyu → 20 Dan (Grand Master), flashed addition only.
                        Each level's description is the syllabus: digits · terms · seconds to flash them all; {CERT_PASS} of {CERT_PROBLEMS} correct to pass ({CERT_SEMI}-6 is a semi-pass), and faster answers rank higher on the board.
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <b className="text-foreground">世界级别开创性等级鉴定标准,有资格申请吉尼斯世界纪录</b>:20级 → 20段(Grand Master),纯加法闪现。
                        每级描述即考纲:几位数 · 几笔 · 几秒内闪完;{CERT_PROBLEMS} 题对 {CERT_PASS} 合格(对 {CERT_SEMI}-6 准合格),作答越快段位榜名次越高。
                      </p>
                    )}
                  </div>
                </div>
                {/* 通过鉴定的三大权益 */}
                <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
                  {[
                    { icon: "🏆", t: T("全国赛事优先选拔", "Priority for national selection"), d: T("通过鉴定者,优先获得全国珠心算官方比赛的选拔推荐资格", "Certified students get priority recommendation for official national abacus & mental-arithmetic competitions") },
                    { icon: "📜", t: T("标准等级证书", "Official certificate"), d: T("即时颁发带唯一编号的标准等级证书,电子版可下载分享、扫码可溯", "An instantly issued certificate with a unique number — download, share, and verify by QR code") },
                    { icon: "🌍", t: T("吉尼斯纪录申请资格", "Guinness record eligibility"), d: T("考取高段位,即具备申请吉尼斯世界纪录的资格", "Reach a high Dan rank to become eligible to apply for a Guinness World Record") },
                  ].map((x) => (
                    <div key={x.t} className="rounded-lg border border-amber-400/30 bg-background/50 px-2.5 py-2">
                      <div className="text-xs font-bold">{x.icon} {x.t}</div>
                      <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{x.d}</div>
                    </div>
                  ))}
                </div>
                {badge ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-sm">
                    {T("当前徽章", "Current badge")} <BadgeChip id={badge.id} /> <span className="text-xs text-muted-foreground">{T("已收集", "Collected")} {passed.size}/40</span>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-muted-foreground">{T("级别任选,量力挑战 —— 幼儿从 20级(数字常驻)启蒙,高手可直接冲段位。", "Pick any level you like — young beginners start at 20 Kyu (numbers stay on screen); strong players can go straight for Dan ranks.")}</div>
                )}
              </div>

              {/* 级位墙 */}
              <div className="mt-4 rounded-xl border border-border bg-card/60 p-2.5">
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <span className="text-xs font-bold text-emerald-600">{T("级位(启蒙→进阶)", "Kyu (beginner → advanced)")}</span>
                  <span className="text-[10px] text-muted-foreground">{T("20级 → 1级 · 18-20级数字常驻,13-17级不进位,12级整十,11级叠数", "20 → 1 Kyu · D = digits, ×n = terms · 18-20 static, 13-17 no carrying, 12 multiples of 10, 11 repdigits")}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-10">
                  {CERT_LEVELS.filter((l) => l.kind === "kyu").map((l) => <LevelTile key={l.id} l={l} />)}
                </div>
              </div>
              {/* 段位墙 */}
              <div className="mt-2.5 rounded-xl border border-border bg-card/60 p-2.5">
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <span className="text-xs font-bold text-amber-600">{T("段位(高手→大师)", "Dan (expert → master)")}</span>
                  <span className="text-[10px] text-muted-foreground">{T("初段 → 二十段", "1 → 20 Dan")}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-10">
                  {CERT_LEVELS.filter((l) => l.kind === "dan").map((l) => <LevelTile key={l.id} l={l} />)}
                </div>
              </div>

              {/* 闪现字号:拖动即预览(暗底与考场同观感),自动记忆 */}
              <div className="mt-2.5 rounded-xl border border-border bg-card/60 p-3">
                <div className="flex items-baseline justify-between px-1">
                  <span className="text-xs font-bold">{T("闪现字号", "Flash number size")}</span>
                  <span className="text-[10px] text-muted-foreground">{T("拖动调整 · 下方实时预览 · 自动记忆", "Drag to adjust · live preview below · remembered")}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 px-1">
                  <span className="text-[10px] text-muted-foreground">{T("小", "Small")}</span>
                  <Slider value={[flashScale]} onValueChange={(v) => setFlashScale(v[0])} min={0.1} max={1.5} step={0.05} className="flex-1" />
                  <span className="text-[10px] text-muted-foreground">{T("大", "Large")}</span>
                </div>
                <div className="mt-2 flex h-24 items-center justify-center overflow-hidden rounded-lg"
                  style={{ background: "radial-gradient(120% 120% at 50% 30%, #3a2513 0%, #1c1108 60%, #0e0803 100%)" }}>
                  <span className="font-hand whitespace-nowrap font-bold leading-none text-white" style={{ fontSize: `${flashScale * 4.5}rem` }}>
                    {"314".slice(0, lv.digits)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => openTicket(lv)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-bold text-background transition-transform hover:scale-[1.01]">
                <Zap className="h-4 w-4" />
                {passed.has(selId) ? T(`重考${lv.label} · 刷新最快用时`, `Retake ${N(lv)} · beat your best time`) : T(`开考${lv.label}(${levelSpec(lv)})`, `Start ${N(lv)} (${levelSpec(lv)})`)}
              </button>
              {passed.has(selId) && (
                <button
                  onClick={() => { const e = myBest.get(selId)!; setDiploma({ levelId: selId, ms: e.ms, dateISO: e.firstAt }); }}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-400/10 py-2.5 text-sm font-bold text-amber-500 hover:bg-amber-400/20">
                  📜 {T(`查看${lv.label}电子证书`, `View ${N(lv)} certificate`)}
                </button>
              )}
              {!user && <p className="mt-2 text-center text-xs text-muted-foreground">{T("未登录也可试考;徽章与段位榜成绩需", "You can try without an account; badges and leaderboard times are saved after you")}<button onClick={() => setAuthOpen(true)} className="mx-0.5 font-bold text-amber-500 underline">{T("登录", "log in")}</button>{T("后记录。", ".")}</p>}
            </div>

            {/* 级别榜 */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold">{T(`${lv.label}榜 · 最快作答`, `${N(lv)} board · fastest answers`)}</h2>
                <span className="font-mono-tabular text-[10px] text-muted-foreground">{T("合格者入榜", "Passers only")}</span>
              </div>
              {/* 年龄组:按年龄自动归组,本组可选、他组置灰(防乱选) */}
              <div className="mb-2 flex items-center gap-2">
                <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{T("年龄组", "Age group")}</span>
                <select
                  value={myGroup?.id ?? "all"}
                  onChange={() => { /* 只允许本组,他组均 disabled */ }}
                  className="h-7 w-full rounded-md border border-border bg-background px-2 text-[11px] outline-none"
                >
                  {!myGroup && <option value="all">{T("全部(登录并填写年龄后按组比拼)", "All (log in and add your age to compete in your group)")}</option>}
                  {AGE_GROUPS.map((g) => (
                    <option key={g.id} value={g.id} disabled={g.id !== myGroup?.id}>
                      {en ? g.labelEn : g.label}{g.id === myGroup?.id ? T(" · 我的组", " · my group") : ""}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mb-2 text-[10px] text-muted-foreground">{levelSpec(lv)}</p>
              {board === null ? (
                <p className="py-8 text-center text-xs text-muted-foreground">{T("加载中…", "Loading…")}</p>
              ) : board.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">{T("本级虚位以待 —— 第一个考过的人就是榜首。", "No one yet — the first person to pass takes the top spot.")}</p>
              ) : (
                <ol className="space-y-1">
                  {board.map((r) => (
                    <li key={r.user_id}
                      className={cn("grid grid-cols-[30px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                        r.rank <= 3 && "bg-gradient-to-r from-amber-400/20 to-transparent",
                        r.user_id === user?.id && "ring-1 ring-amber-400/60")}>
                      <span className="font-mono-tabular text-xs text-muted-foreground">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
                      <span className="truncate font-medium">{r.nickname} <BadgeChip id={lv.id} small /></span>
                      <span className="font-mono-tabular text-xs font-bold text-amber-500">{fmtMs(r.ms)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}

        {/* ================= 鉴定进行中(闪电心算同款全屏舞台:暖黑底 + ZHKJ 数字字体 + 显示/空白闪现节奏) ================= */}
        {view === "run" && (
          <div
            className="flash-stage fixed inset-0 z-40 flex flex-col overflow-y-auto text-white"
            style={{ background: "radial-gradient(120% 90% at 50% 25%, #3a2513 0%, #1c1108 55%, #0e0803 100%)" }}>
            <div className="flex shrink-0 items-center justify-between px-5 py-3">
              <span className="text-sm font-bold text-white/90">{T(`${runLv.label}鉴定`, `${N(runLv)} test`)} <span className="ml-1 text-white/55">· {levelSpec(runLv)}</span></span>
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular text-xs text-white/60">{T(`第 ${probIdx + 1} / ${CERT_PROBLEMS} 题`, `Problem ${probIdx + 1} / ${CERT_PROBLEMS}`)}</span>
                <button onClick={() => setView("hall")} className="rounded-full border border-white/25 px-3 py-1 text-xs text-white/80 transition-colors hover:bg-white/10">✕ {T("放弃本场", "Quit")}</button>
              </div>
            </div>
            <div className="mx-auto h-1 w-full max-w-3xl shrink-0 overflow-hidden rounded bg-white/15">
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${(probIdx / CERT_PROBLEMS) * 100}%` }} />
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10">
              {phase === "countdown" && (
                <div className="flex flex-col items-center">
                  <div className="mb-2 text-xs uppercase tracking-[0.3em] text-white/55">{T("准备", "Ready")}</div>
                  <div key={countdown} className="animate-pop-in font-mono-tabular font-bold text-white" style={{ fontSize: "clamp(6rem,22vw,15rem)", lineHeight: 1 }}>{countdown > 0 ? countdown : T("开始", "Go")}</div>
                </div>
              )}
              {phase === "flash" && (
                <div className="flex w-full max-w-5xl flex-col items-center gap-6">
                  <div className="flex min-h-[44vh] items-center justify-center">
                    {showTerm && strokeIdx < runLv.count ? (
                      <span key={strokeIdx} className="font-hand font-bold leading-none text-white" style={{ fontSize: "clamp(5rem,22vw,15rem)", transform: `scale(${flashScale})` }}>
                        {problemsRef.current[probIdx].terms[strokeIdx]}
                      </span>
                    ) : (
                      <div className="h-3 w-3" />
                    )}
                  </div>
                  <div className="font-mono-tabular text-sm text-white/50">{Math.min(strokeIdx + 1, runLv.count)} / {runLv.count} · {strokeMs(runLv)}ms</div>
                </div>
              )}
              {/* form 原生提交:实体键盘 Enter 与手机数字键盘「前往」都能交卷 */}
              {phase === "answer" && (
                <form className="flex flex-col items-center gap-5" onSubmit={(e) => { e.preventDefault(); submitAnswer(); }}>
                  {runLv.rule === "image" && (
                    <div className="flex flex-wrap items-baseline justify-center gap-2 px-4">
                      {problemsRef.current[probIdx].terms.map((t, i) => (
                        <span key={i} className="font-hand font-bold leading-none text-white" style={{ fontSize: `${Math.max(1.6, flashScale * 6)}rem` }}>
                          {i > 0 && <span className="mr-2 text-white/50" style={{ fontSize: "0.6em" }}>+</span>}{t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-sm font-bold tracking-[0.2em] text-white/70">{T("得数是?", "Your answer?")}</div>
                  <input ref={inputRef} value={input} inputMode="numeric" autoComplete="off"
                    onChange={(e) => setInput(e.target.value.replace(/[^\d]/g, ""))}
                    className="font-hand w-64 rounded-xl border-2 border-amber-400 bg-white px-4 py-3 text-center text-4xl font-bold text-neutral-900 outline-none" />
                  <button type="submit" className="rounded-full bg-amber-400 px-10 py-2.5 text-sm font-black text-black transition-transform hover:scale-[1.02]">
                    {T("确定", "OK")}{probIdx + 1 >= CERT_PROBLEMS ? T(" · 交卷", " · Finish") : ""}
                  </button>
                </form>
              )}
              {phase === "gap" && (
                <div className="animate-pop-in text-3xl font-black text-white/70">{T(`第 ${probIdx + 2} 题`, `Problem ${probIdx + 2}`)}</div>
              )}
            </div>
            <p className="shrink-0 pb-4 text-center text-[11px] text-white/40">{T("纯加法 · 作答不限时,但作答用时计入段位榜 —— 心里有数就快出手。", "Addition only · no time limit to answer, but your answer time counts on the board — answer as soon as you know it.")}</p>
          </div>
        )}

        {/* ================= 结果 ================= */}
        {view === "result" && (() => {
          const correct = results.filter((r) => r.correct).length;
          const isPass = correct >= CERT_PASS;
          const isSemi = !isPass && correct >= CERT_SEMI;
          const totalMs = results.reduce((s, r) => s + r.answerMs, 0);
          const adv = certAdvice(runLv, correct, totalMs / CERT_PROBLEMS, isPass, en);
          const nx = nextLevel(runLv);
          return (
            <div className="mx-auto max-w-2xl">
              <div className={cn("rounded-2xl border p-6 text-center", isPass ? "border-amber-400/60 bg-gradient-to-b from-amber-400/15 to-card" : "border-border bg-card")}>
                <div className="text-6xl">{isPass ? "🏅" : isSemi ? "🎗️" : "😤"}</div>
                <h2 className="mt-2 text-2xl font-black">
                  {en
                    ? (isPass ? `${N(runLv)} · Passed!` : isSemi ? `${N(runLv)} · Semi-pass (${correct * 10} pts)` : `${N(runLv)} · Not passed`)
                    : (isPass ? `${runLv.label}鉴定 · 合格!` : isSemi ? `${runLv.label}鉴定 · 准合格(${correct * 10}分)` : `${runLv.label}鉴定 · 未通过`)}
                </h2>
                <div className="mt-2 flex items-center justify-center gap-5 font-mono-tabular text-sm">
                  <span>{T("正确", "Correct")} <b className={isPass ? "text-emerald-500" : "text-red-500"}>{correct}</b>/{CERT_PROBLEMS}{T(`(合格≥${CERT_PASS})`, ` (pass ≥ ${CERT_PASS})`)}</span>
                  <span>{T("作答总用时", "Total answer time")} <b className="text-amber-500">{fmtMs(totalMs)}</b></span>
                </div>
                {isPass && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {submitState === "saving" && T("成绩上传中…", "Saving your result…")}
                    {submitState === "saved" && (myRank ? (en ? <>On the {N(runLv)} board — currently <b className="text-amber-500">#{myRank}</b></> : <>已入{runLv.label}榜,当前第 <b className="text-amber-500">{myRank}</b> 名</>) : T("成绩已记录", "Result saved"))}
                    {submitState === "failed" && T("⚠️ 成绩上传失败(本场结果未入榜),稍后再考一场即可。", "⚠️ Couldn't save this result (not on the board). Just take another attempt later.")}
                    {submitState === "anon" && (
                      <>{T("本场为试考,徽章与榜单未记录 —— ", "This was a trial — no badge or board entry was saved. ")}<button onClick={() => setAuthOpen(true)} className="font-bold text-amber-500 underline">{T("登录", "Log in")}</button>{T(" 后再考一场即可正式领取。", " and take it again to make it official.")}</>
                    )}
                  </div>
                )}
              </div>

              {/* 逐题回顾 */}
              <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                {results.map((r, i) => (
                  <div key={i} className={cn("rounded-lg border px-2 py-1.5 text-center", r.correct ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10")}>
                    <div className="text-[10px] text-muted-foreground">{T(`第${i + 1}题`, `#${i + 1}`)} · {fmtMs(r.answerMs)}</div>
                    <div className="font-mono-tabular text-sm font-bold">{r.correct ? r.problem.answer : <>{r.answered ?? "—"}<span className="text-[10px] text-muted-foreground"> ≠{r.problem.answer}</span></>}</div>
                  </div>
                ))}
              </div>

              {/* AI 教练建议 */}
              <div className="mt-3 rounded-2xl border border-border bg-card p-4">
                <div className="text-xs font-bold text-amber-500">🎯 {T("AI 教练", "AI coach")}</div>
                <div className="mt-1 text-sm font-bold">{adv.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{adv.detail}</p>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {isPass && user && (
                  <button
                    onClick={() => { const e = myBest.get(runId); setDiploma({ levelId: runId, ms: e ? Math.min(e.ms, totalMs) : totalMs, dateISO: e?.firstAt ?? new Date().toISOString() }); }}
                    className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-black text-black transition-transform hover:scale-[1.02]">
                    📜 {T("领取电子证书", "Get your certificate")}
                  </button>
                )}
                {isPass && nx && (
                  <button onClick={() => openTicket(nx)} className="rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background">{T(`挑战${nx.label}`, `Try ${N(nx)}`)} →</button>
                )}
                {!isPass && adv.suggestLevelId && (
                  <button onClick={() => openTicket(levelById(adv.suggestLevelId!))} className="rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background">
                    {en ? `Take ${N(levelById(adv.suggestLevelId)!)}` : `去考${levelById(adv.suggestLevelId)?.label}`} →
                  </button>
                )}
                <button onClick={() => openTicket(runLv)} className={cn("rounded-full px-6 py-2.5 text-sm font-bold", isPass ? "border border-border" : "bg-foreground text-background")}>
                  {isPass ? T("重考刷用时", "Retake for a faster time") : T("再考一场", "Try again")}
                </button>
                {adv.trainSpeedMs && (
                  <button onClick={() => navigate("/play/flashmath")} className="rounded-full border border-border px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground">{T("去综合训练", "Go to Flash training")}</button>
                )}
                <button onClick={() => setView("hall")} className="rounded-full border border-border px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground">{T("返回鉴定馆", "Back to the hall")}</button>
              </div>
            </div>
          );
        })()}
      </main>
      {/* 老用户补填年龄:进入鉴定页且账号缺年龄 → 弹窗补齐(仅用于分组,存账号元数据) */}
      {needAge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
            <h3 className="text-base font-black">{T("完善信息:你的年龄", "One more thing: your age")}</h3>
            {en ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Certification boards are split by <b className="text-foreground">age group</b> (preschool / junior / youth / adult). Enter your age once so we can place you automatically.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                等级鉴定按<b className="text-foreground">年龄组</b>分组比拼(幼儿/少儿/青少年/成人),需要你的周岁年龄来自动归组。只填一次,永久生效。
              </p>
            )}
            <form className="mt-3 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void submitAge(); }}>
              <input autoFocus inputMode="numeric" maxLength={2} placeholder={T("如 8", "e.g. 8")}
                value={ageInput} onChange={(e) => setAgeInput(e.target.value.replace(/[^\d]/g, ""))}
                className="h-11 w-24 rounded-lg border-2 border-amber-400 bg-background px-3 text-center font-mono-tabular text-xl font-bold outline-none" />
              <span className="text-sm text-muted-foreground">{T("周岁", "years old")}</span>
              <button type="submit" disabled={ageSaving || !ageInput}
                className="ml-auto rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background disabled:opacity-50">
                {ageSaving ? T("保存中…", "Saving…") : T("保存", "Save")}
              </button>
            </form>
            {ageInput && Number(ageInput) >= 3 && (
              <p className="mt-2 text-[11px] text-muted-foreground">{T("将归入:", "Group: ")}<b className="text-amber-600">{en ? groupForAge(Number(ageInput)).labelEn : groupForAge(Number(ageInput)).label}</b></p>
            )}
          </div>
        </div>
      )}
      {diploma && (user || import.meta.env.DEV) && (
        <CertDiploma
          nickname={profile?.nickname || "王小明"}
          levelId={diploma.levelId} ms={diploma.ms} dateISO={diploma.dateISO}
          userId={user?.id ?? "demo0000"} onClose={() => setDiploma(null)}
        />
      )}
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
};

export default Cert;
