// 通用全屏作答器(2026-10-11):闪算 / 听算 / 看算 / 数珠互译 四项通吃,同一套舞台(闪电心算同款暖黑底 + ZHKJ 字体)。
// 两种身份:
//   学生(teach=false):固定题单逐题作答 → 每题即时 ✓/✗ → 本轮汇总 → 错题可反复重做(每轮回调 onRoundDone 交给页面落库)。
//   教练(teach=true):课堂演示 —— 点屏幕中央暂停/再点继续;不输答案,点「显示答案」直接揭晓;
//                   右侧「上一题/下一题」随时回头或跳过(出错的题重新播一遍);键盘 空格=暂停 ←/→=上下题 回车=揭晓。
import { softKey } from "@/lib/appEnv";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Soroban, { ROD_W } from "@/components/games/Soroban";
import InteractiveSoroban from "@/components/games/InteractiveSoroban";
import { loadBank, bankReady, speakTokens, numberTokens, termBankTokens, listenSpeedFactor, tierFor, type SpeakHandle, voicePlaybackRate } from "@/lib/ttsBank";
import { numberToCN } from "@/lib/abacus";
import { genProblem, itemLabel, problemExpr, answerText, parseRemAnswer, REM_SEP, type HwItem, type HwProblem, type HwResult, scrollSecFor, obstacleSpeedMs } from "@/lib/homework";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { IS_NATIVE } from "@/lib/appEnv";
import { useTx } from "@/lib/tx";
import { useEyeCare, EYE_CARE_STAGE_BG } from "@/lib/eyeCare";
import { useI18n } from "@/lib/i18n";
import { getPraiseOn, setPraiseOn, getFxOn, setFxOn, pickPraise, pickFinish, praiseEmoji, praiseText, preloadPraise, playPraise, stopPraise, chime } from "@/lib/praise";
import { PraiseBurst } from "@/components/PraiseBurst";
import { dingTick, dingGo } from "@/lib/beep";

type Phase = "count" | "gap" | "play" | "answer" | "feedback" | "done";

export interface RunnerProps {
  item: HwItem;
  problems: HwProblem[];
  title?: string;
  teach?: boolean;
  onExit: () => void;
  /** 学生:每轮做完回调(round=0 首做,≥1 错题重做);页面负责落库。 */
  startRound?: number;
  onRoundDone?: (results: HwResult[], round: number) => void;
  /** 学生:接着上次暂存做(已作答的结果;从下一题开始) */
  initialResults?: HwResult[];
  /** 学生:暂存(保存已做的题,下次接着做)。返回是否保存成功 */
  onSaveDraft?: (problems: HwProblem[], results: HwResult[], round: number) => Promise<boolean>;
  /** 学生:同一份作业还有没做的项 → 做完直接「下一项」,不用退回清单再点(2026-10-26 角色走查) */
  nextItem?: { label: string; go: () => void };
  /** 比赛(/contest,2026-11-04 用户「出题逻辑、呈现、字体都跟训练系统一样」):作答器同训练系统,只改三点 ——
   *  不放 3-2-1(赛场已统一倒计时)、每题交卷即回调 onAnswer 由服务器判分、不显示对错和正确答案直接下一题;没有退出 / 暂存 / 错题重做 */
  /** 作业(2026-11-09 用户「答错可以验证错误,但不要显示答案 —— 学生会抄答案,重做时把答案记住」):
   *  答错只告诉「错了」和他自己的答案,不出正确答案;本轮汇总也不出。广场自练仍显示答案 */
  hideAnswer?: boolean;
  contest?: { onAnswer: (idx: number, r: HwResult) => void; startIdx?: number; onLive?: (ev: { idx: number; phase: "play" | "answer"; typed: number }) => void };
}

// 与 FlashMathGame.ttsSpeedFor 同一条曲线(档5=1.0,档10=4.0),听算速度档→语速倍率
const ttsSpeedFor = listenSpeedFactor; // 与广场同一条速度曲线(ttsBank.listenSpeedFactor)
const grp = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
// 小数:只给整数部分加千分位(0.0125 不能变成 0.0,125)
const fmtNum = (n: number) => { const [i, f] = String(Math.abs(n)).split("."); return (n < 0 ? "-" : "") + grp(i) + (f !== undefined ? "." + f : ""); };
const STAGE_BG = "radial-gradient(120% 90% at 50% 25%, #3a2513 0%, #1c1108 55%, #0e0803 100%)";
const BIG = "clamp(5rem,22vw,15rem)";

export function HomeworkRunner({ item, problems: initial, title, teach = false, onExit, onRoundDone, startRound = 0, initialResults, onSaveDraft, nextItem, contest, hideAnswer = false }: RunnerProps) {
  const tx = useTx();
  const { lang } = useI18n();
  const [probs, setProbs] = useState<HwProblem[]>(initial);
  const [idx, setIdx] = useState(() => Math.min(contest?.startIdx ?? initialResults?.length ?? 0, Math.max(0, initial.length - 1)));
  const [round, setRound] = useState(startRound); // 从作业卡「错题再练」进来时 startRound≥1(记为重做轮)
  const [results, setResults] = useState<HwResult[]>(initialResults ?? []);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<Phase>("count");
  const [countdown, setCountdown] = useState(contest ? 0 : 3);
  const [strokeIdx, setStrokeIdx] = useState(0);
  const [showTerm, setShowTerm] = useState(true);
  const [spoken, setSpoken] = useState(0);          // 听算:已报到第几个数
  const [leftMs, setLeftMs] = useState(0);          // 看算限时 / 珠→数 呈现剩余毫秒
  const [paused, setPaused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [input, setInput] = useState("");
  const [beadInput, setBeadInput] = useState(""); // 数→珠 拨出的数字串(最多 100 位,2026-11-08)
  const [feedback, setFeedback] = useState<{ correct: boolean; given: number | null; givenText?: string } | null>(null);
  const [bankState, setBankState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  // 护眼模式(2026-10-15 家长「黑背景白字刺眼」):浅色舞台。2026-11-24 改为全局开关(顶栏 EyeCareToggle,所有项目统一),见 lib/eyeCare
  const stageLight = useEyeCare();
  const tone = stageLight ? "light" as const : "dark" as const;
  // 字号:各项目配置页「字号」滑块写入 hw:flashScale(NumScaleRow),作答器只读
  const [flashScale] = useState<number>(getNumScale);

  const answerStartRef = useRef(0);
  const speakRef = useRef<SpeakHandle | null>(null);
  const fallbackCancelRef = useRef<() => void>(() => {});
  const inputRef = useRef<HTMLInputElement>(null);
  const roundDoneFiredRef = useRef(false);
  // 作答鼓励(2026-10-29 中珠协领导建议):每题交卷后语音 + 特效,答对夸、答错鼓励;连对计数;可在顶栏关掉声音
  const [praiseOn, setPraiseOnState] = useState(getPraiseOn);
  const [fxOn, setFxOnState] = useState(getFxOn); // 特效单独开关
  const [praise, setPraise] = useState<{ key: string; streak: number; emoji: string } | null>(null);
  const streakRef = useRef(0);
  const praiseDoneRef = useRef<Promise<void>>(Promise.resolve());
  const praiseLang = lang === "en" ? "en" : "zh";
  useEffect(() => { if (!teach) preloadPraise(praiseLang); }, [teach, praiseLang]);

  const p = probs[idx];
  const isBead = item.project === "bead";
  const n2b = isBead && item.beadDir === "n2b";
  const see = isBead && item.beadDir === "see"; // 看数 = 数码秒记(2026-11-08):限时看一个数 → 收起 → 键盘写出来
  // 心算马拉松(2026-10-14):数字从底部连续滚上来;k = 已滚过的行数(连续值),暂停即冻结
  const isScroll = item.project === "scroll";
  const SCROLL_ROWS = 5;
  const [scrollK, setScrollK] = useState(0);
  const scrollRef = useRef({ elapsed: 0, last: 0 });
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const total = probs.length;

  // ===== 工具 =====
  const stopAudio = useCallback(() => {
    speakRef.current?.cancel(); speakRef.current = null;
    fallbackCancelRef.current(); fallbackCancelRef.current = () => {};
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    stopPraise();
  }, []);
  useEffect(() => () => stopAudio(), [stopAudio]);

  const goto = useCallback((i: number, via: "gap" | "play" = "gap") => {
    stopAudio();
    setPaused(false); setRevealed(false); setInput(""); setBeadInput(""); setFeedback(null);
    setStrokeIdx(0); setShowTerm(true); setSpoken(0);
    setIdx(i);
    setPhase(via);
  }, [stopAudio]);

  const startPlay = useCallback(() => {
    setStrokeIdx(0); setShowTerm(true); setSpoken(0); setRevealed(false);
    if (item.project === "glance") setLeftMs(item.glanceLimitSec * 1000);
    if (isBead && !n2b) setLeftMs(item.beadSpeedMs);
    setPhase("play");
  }, [item, isBead, n2b]);

  // 比赛大屏直播(2026-11-08):被直播的平板把「第几题 · 看题 / 作答 · 已输入几位」报给大屏(不报输入内容,防泄答案)
  const onLive = contest?.onLive;
  const typedLen = (n2b ? beadInput : input).replace(/\D/g, "").length;
  useEffect(() => { if (onLive && (phase === "play" || phase === "answer")) onLive({ idx, phase, typed: phase === "answer" ? typedLen : 0 }); }, [onLive, phase, idx, typedLen]);

  // ===== 3-2-1 → 第一题;题间短过渡 =====
  useEffect(() => {
    if (phase !== "count") return;
    // 2026-11-03 付海东「倒计时 3 秒的声音,教练端也得有」:每个数字一声「叮」,开始时「叮～」(同闪算 / 听算 / 看算)
    if (countdown <= 0) { dingGo(); startPlay(); return; }
    dingTick();
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown, startPlay]);
  useEffect(() => {
    if (phase !== "gap") return;
    const t = window.setTimeout(startPlay, 650);
    return () => clearTimeout(t);
  }, [phase, startPlay]);

  // ===== 闪算:逐笔「显示→熄灭」节奏;暂停即冻结(恢复后当前笔重新显示) =====
  useEffect(() => {
    if (phase !== "play" || !(item.project === "flash" || item.project === "obstacle") || !p || paused) return;
    if (strokeIdx >= p.terms.length) { answerStartRef.current = performance.now(); setPhase("answer"); return; }
    setShowTerm(true);
    const perTerm = item.project === "obstacle" ? obstacleSpeedMs(item, idx) : item.speedMs; // 障碍算:出题速度可逐题加速
    const blankMs = Math.max(50, Math.min(250, Math.round(perTerm * 0.25)));
    const showMs = Math.max(40, perTerm - blankMs);
    const timers: number[] = [];
    timers.push(window.setTimeout(() => {
      setShowTerm(false);
      timers.push(window.setTimeout(() => setStrokeIdx((i) => i + 1), blankMs));
    }, showMs));
    return () => timers.forEach(clearTimeout);
  }, [phase, strokeIdx, paused, p, item, idx]);

  // ===== 马拉松:rAF 连续滚动;整题用时 = scrollSecFor(本题序号,含加速);滚到最后一笔停在倒数第二行,画线 → 作答 =====
  useEffect(() => {
    if (phase !== "play" || !isScroll || !p) return;
    const n = p.terms.length;
    const per = item.scrollTermMs ?? (scrollSecFor(item, idx) * 1000) / n; // 比赛:考生选的速度档 = 每笔毫秒
    const kEnd = n + 1;
    scrollRef.current = { elapsed: 0, last: performance.now() };
    setScrollK(0);
    let raf = 0;
    const tick = (now: number) => {
      const st = scrollRef.current;
      if (!pausedRef.current) st.elapsed += now - st.last;
      st.last = now;
      const k = Math.min(kEnd, st.elapsed / per);
      setScrollK(k);
      if (k >= kEnd) { answerStartRef.current = performance.now(); setPhase("answer"); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isScroll, p, idx]);

  // ===== 看算限时 / 珠→数 呈现倒计时(100ms 步进,暂停即停) =====
  const timed = phase === "play" && ((item.project === "glance" && item.glanceLimitSec > 0) || (isBead && !n2b));
  useEffect(() => {
    if (!timed || paused) return;
    if (leftMs <= 0) { answerStartRef.current = performance.now(); setPhase("answer"); return; } // 限时到:看算的列收起,显示「时间到」,答案由教练揭晓(2026-10-16 用户)
    const t = window.setTimeout(() => setLeftMs((m) => m - 100), 100);
    return () => clearTimeout(t);
  }, [timed, paused, leftMs]);
  // 看算不限时 / 数→珠:题目常驻,直接作答
  useEffect(() => {
    if (phase !== "play") return;
    if ((item.project === "glance" && item.glanceLimitSec === 0) || n2b) { answerStartRef.current = performance.now(); setPhase("answer"); }
  }, [phase, item, n2b]);

  // ===== 听算:词块库拼播(可暂停);库不可用 → 浏览器语音兜底 =====
  useEffect(() => {
    if (phase !== "play" || item.project !== "listen" || !p) return;
    let cancelled = false;
    const voice = item.listenVoice ?? "female";
    const rate = voicePlaybackRate(voice); // A/B/C 童声 ×1.25 升调;D/E 真童声恒 1.0
    const tier = tierFor(ttsSpeedFor(item.listenSpeed) / rate);
    const tokensOf = (q: typeof p): string[][] | null => {
      if (q.op) {
        const a = numberTokens(q.terms[0], true), b = numberTokens(q.terms[1], true);
        return a && b ? [a, [q.op === "×" ? "乘以" : "除以", ...b]] : null;
      }
      const out: string[][] = [];
      for (let i = 0; i < q.terms.length; i++) {
        const nt = numberTokens(q.terms[i], true);
        if (!nt) return null;
        out.push([...(i === 0 ? [] : q.signs[i] === "-" ? ["减"] : item.announcePlus ? ["加"] : []), ...nt]);
      }
      return out;
    };
    const termTokens = () => tokensOf(p);
    // 2026-11-24 家长「听心算又卡又不能用」:之前每道题开播后都在后台拉整套 1119 个词块(约 18MB、上千个请求),
    // 和当前题的下载抢带宽、还会被 Netlify 限流。改为只预取【下一题】用到的十几个词块,其余按需。
    const prefetchNext = () => { const q = probs[idx + 1]; const tk = q ? tokensOf(q) : null; if (tk) void loadBank(voice, tier, termBankTokens(tk)); };
    const finish = () => { if (!cancelled) { answerStartRef.current = performance.now(); setPhase("answer"); } };
    const playBank = () => {
      const tk = termTokens();
      if (!tk) { fallback(); return; }
      setBankState("ready");
      const h = speakTokens(voice, tier, tk, rate, Math.max(30, item.listenSec / ttsSpeedFor(item.listenSpeed)), (ti) => { if (!cancelled) setSpoken(ti + 1); });
      speakRef.current = h;
      void h.done.then(finish);
    };
    const fallback = () => {
      setBankState("fallback");
      const synth = window.speechSynthesis;
      if (!synth) { finish(); return; }
      let stop = false;
      fallbackCancelRef.current = () => { stop = true; synth.cancel(); };
      const say = (text: string) => new Promise<void>((res) => { const u = new SpeechSynthesisUtterance(text); u.lang = "zh-CN"; u.rate = Math.min(2, ttsSpeedFor(item.listenSpeed)); u.onend = () => res(); u.onerror = () => res(); synth.speak(u); });
      (async () => {
        if (p.op) { await say(`${numberToCN(p.terms[0])} ${p.op === "×" ? "乘以" : "除以"} ${numberToCN(p.terms[1])}`); }
        else for (let i = 0; i < p.terms.length && !stop; i++) {
          setSpoken(i + 1);
          await say((i === 0 ? "" : p.signs[i] === "-" ? "减 " : item.announcePlus ? "加 " : "") + numberToCN(p.terms[i]));
          if (!stop) await new Promise((r) => setTimeout(r, item.listenSec));
        }
        if (!stop) finish();
      })();
    };
    // 只等这道题的词块(十几个文件,<1s);开播后预取下一题的词块,下一题零等待
    const tk0 = termTokens(); const needed = tk0 ? termBankTokens(tk0) : undefined; // 含每个数末块的自然尾音版
    if (!needed) fallback();
    else if (bankReady(voice, tier, needed)) { playBank(); prefetchNext(); }
    else { setBankState("loading"); void loadBank(voice, tier, needed).then((ok) => { if (cancelled) return; if (ok) { playBank(); prefetchNext(); } else fallback(); }); }
    return () => { cancelled = true; speakRef.current?.cancel(); speakRef.current = null; fallbackCancelRef.current(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, item.project]);
  // 听算暂停/继续 → AudioContext 挂起/恢复
  useEffect(() => { if (paused) speakRef.current?.pause(); else speakRef.current?.resume(); }, [paused]);

  // ===== 作答(学生) =====
  useEffect(() => { if (phase === "answer" && !teach && !n2b) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30); }, [phase, teach, n2b]); // 不滚动:看算的题列不能被顶出屏幕
  // 小数点键:小数题,或「不够除·保留N位」除法(答案带小数)都要有(2026-10-19 付海东:22÷8 学生没有点没法答)
  const needRem = p?.rem != null; // 不够除·无小数:答「商余余数」(2026-10-21 付海东)
  const needDot = !needRem && (item.decimals || (p?.places ?? 0) > 0);
  const submit = useCallback((forced?: unknown) => {
    if (phase !== "answer" || !p || teach) return;
    const pr = needRem ? parseRemAnswer(input) : null;
    const given = n2b ? Number(beadInput || "0") : input.trim() === "" ? null : needRem ? (pr ? pr.q : Number(input.replace(/\D/g, "")) || 0) : Number(input);
    if (given == null && !n2b && !(see && forced === true)) return; // 看数答题时间到:没写也交卷(算错)
    const givenRem = needRem ? (pr ? pr.r : null) : undefined;
    // 数珠互译按数字串比(超过 15 位数字不精确)
    const givenS = isBead ? digitsNorm(n2b ? beadInput : input) : undefined;
    const correct = isBead
      ? givenS === digitsNorm(beadStr(p))
      : needRem
      ? !!pr && pr.q === p.answer && pr.r === p.rem // 商和余数都要对;没写余数算错
      : typeof given === "number" && typeof p.answer === "number" ? Math.abs(given - p.answer) < 1e-9 : given === p.answer; // 小数题答案已按保留位数四舍五入,学生需答到该位数
    const ms = Math.max(0, Math.round(performance.now() - answerStartRef.current));
    const res: HwResult = { terms: p.terms, signs: p.signs, op: p.op, bead: p.bead, answer: p.answer, given, correct, ms, ...(needRem ? { rem: p.rem, givenRem } : {}), ...(isBead ? { beadS: beadStr(p), givenS } : {}) };
    setResults((r) => [...r, res]);
    if (contest) { contest.onAnswer(idx, res); if (idx + 1 < total) goto(idx + 1); else setPhase("done"); return; }
    setFeedback({ correct, given, givenText: needRem ? answerText(given ?? 0, givenRem) : undefined });
    streakRef.current = correct ? streakRef.current + 1 : 0;
    const key = pickPraise(correct, streakRef.current, ms); // 按情境挑:连对里程碑 / 错后马上对 / 秒答 / 普通
    setPraise({ key, streak: streakRef.current, emoji: praiseEmoji(key) });
    if (praiseOn) {
      chime(correct);
      praiseDoneRef.current = new Promise((res) => window.setTimeout(() => void playPraise(key, praiseLang).then(res), 220)); // 提示音之后接语音
    } else praiseDoneRef.current = Promise.resolve();
    setPhase("feedback");
  }, [phase, p, teach, n2b, see, isBead, beadInput, input, needRem, praiseOn, praiseLang, contest, idx, total, goto]);

  // ===== 数→珠 限时(学生):到点自动按当前拨出的数交卷;暂停即停 =====
  // null = 没在计时(2026-11-08 修:进入作答时残留的 0 会让限时题一进来就被自动交卷)
  const [beadLeftMs, setBeadLeftMs] = useState<number | null>(null);
  const submitRef = useRef(submit); submitRef.current = submit;
  const beadTimed = (n2b || see) && !teach && phase === "answer" && item.beadLimitSec > 0;
  useEffect(() => { setBeadLeftMs(beadTimed ? item.beadLimitSec * 1000 : null); }, [beadTimed, idx, round, item.beadLimitSec]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!beadTimed || paused || beadLeftMs == null) return;
    if (beadLeftMs <= 0) { setBeadLeftMs(null); submitRef.current(true); return; }
    const t = window.setTimeout(() => setBeadLeftMs((m) => (m == null ? m : m - 100)), 100);
    return () => clearTimeout(t);
  }, [beadTimed, paused, beadLeftMs]);
  useEffect(() => {
    if (phase !== "feedback") return;
    // 至少停留(答对 1.1s / 答错 1.9s,答错要看正确答案),且等鼓励语音说完(最多 3.5s)再进下一题 —— 听算不会和下一题报题叠在一起
    let off = false;
    const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
    void Promise.all([wait(feedback?.correct ? 1100 : 1900), Promise.race([praiseDoneRef.current, wait(3500)])]).then(() => {
      if (off) return;
      if (idx + 1 < total) goto(idx + 1);
      else setPhase("done");
    });
    return () => { off = true; };
  }, [phase, feedback, idx, total, goto]);
  // 一轮做完:全对「全部答对,太了不起了!」,否则「完成啦,你真棒!」
  useEffect(() => {
    if (phase !== "done" || teach || contest || !praiseOn || !results.length) return;
    const t = window.setTimeout(() => { if (results.every((r) => r.correct)) chime(true); void playPraise(pickFinish(results.every((r) => r.correct)), praiseLang); }, 300);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== "done" || teach || roundDoneFiredRef.current) return;
    roundDoneFiredRef.current = true;
    onRoundDone?.(results, round);
  }, [phase, teach, results, round, onRoundDone]);

  const wrongProblems = results.filter((r) => !r.correct).map((r): HwProblem => ({ terms: r.terms, signs: r.signs, answer: r.answer, op: r.op, bead: r.bead, beadS: r.beadS, beadDigits: item.beadDigits, ...(r.rem != null ? { rem: r.rem } : {}) }));
  const startRetry = () => {
    if (!wrongProblems.length) return;
    roundDoneFiredRef.current = false;
    setProbs(wrongProblems); setResults([]); setRound((r) => r + 1); streakRef.current = 0;
    goto(0, "gap");
  };

  // 暂存并退出;中途点「退出」也自动暂存,已做的题不会丢
  const saveAndExit = async () => {
    if (saving || !onSaveDraft) return;
    setSaving(true); stopAudio();
    await onSaveDraft(probs, results, round);
    setSaving(false); onExit();
  };

  // ===== 教练:上一题/下一题/暂停/揭晓 =====
  const prev = () => { if (idx > 0) goto(idx - 1); };
  const next = () => {
    if (idx + 1 < probs.length) goto(idx + 1);
    else { setProbs((ps) => [...ps, genProblem(item)]); goto(idx + 1); }
  };
  const replay = () => goto(idx);
  const togglePause = () => { if (phase === "play") setPaused((v) => !v); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
        return;
      }
      if (teach) {
        if (e.key === " ") { e.preventDefault(); togglePause(); }
        else if (e.key === "ArrowLeft") prev();
        else if (e.key === "ArrowRight") next();
        else if (e.key === "Enter" && phase === "answer") setRevealed(true);
        return;
      }
      if (phase === "answer" && !n2b) {
        if (/^\d$/.test(e.key)) setInput((v) => v + e.key);
        else if (needRem && [".", " ", "r", "R"].includes(e.key)) setInput((v) => (!v || v.includes(REM_SEP) ? v : v + REM_SEP));
        else if (e.key === "Backspace") setInput((v) => v.slice(0, -1));
        else if (e.key === "Enter") submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!p) return null;
  const headerTitle = title ?? itemLabel(item);
  const correctCount = results.filter((r) => r.correct).length;
  // 2026-10-16 付海东:课堂演示的看算——整列铺满全屏(没有「显示答案」按钮占地方);限时一到列收起、答案自动出来;
  // 不限时就一直铺满,教练点屏幕(或回车)揭晓答案。(上一版把答案整个去掉了,他说「没有答案,限时也不起作用」)
  const glanceTeach = teach && item.project === "glance";
  const glanceTeachColumn = glanceTeach && !revealed && item.glanceLimitSec === 0; // 不限时的教练看算:揭晓前整列铺满;限时的到点收起显示「时间到」
  const showColumn = item.project === "glance" && !glanceTeach && (phase === "play" || (phase === "answer" && item.glanceLimitSec === 0) || phase === "feedback" && item.glanceLimitSec === 0);

  return createPortal(
    <div className={cn("fixed inset-0 z-50 flex flex-col overflow-y-auto text-white", stageLight && "stage-light")} style={{ background: stageLight ? EYE_CARE_STAGE_BG : STAGE_BG }}>
      {/* 顶栏 */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3 md:px-5">
        <span className="min-w-0 truncate text-sm font-bold text-white/90">
          {teach && <span className="mr-2 rounded bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-black text-black">{tx("课堂演示")}</span>}
          {headerTitle}
          {round > 0 && <span className="ml-2 text-amber-300">· {tx("错题重做")} #{round}</span>}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          {phase !== "done" && <span className="font-mono-tabular text-xs text-white/60">{contest ? `第 ${idx + 1} 题` : `${idx + 1} / ${total}`}</span>}
          {!teach && !contest && (
            <button onClick={() => { const v = !praiseOn; setPraiseOnState(v); setPraiseOn(v); if (!v) stopPraise(); }} title={praiseOn ? tx("关掉鼓励语音") : tx("打开鼓励语音")}
              className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-white/10", praiseOn ? "border-white/25 text-white/80" : "border-white/15 text-white/40")}>{praiseOn ? "🔊" : "🔇"} {tx("语音")}</button>
          )}
          {!teach && !contest && (
            <button onClick={() => { const v = !fxOn; setFxOnState(v); setFxOn(v); }} title={fxOn ? tx("关掉答题特效") : tx("打开答题特效")}
              className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-white/10", fxOn ? "border-white/25 text-white/80" : "border-white/15 text-white/40 line-through")}>✨ {tx("特效")}</button>
          )}
          {/* 暂存(2026-10-26 布施):保存已做的题,下次点「继续」从下一题接着做 */}
          {!teach && !contest && onSaveDraft && phase !== "done" && (
            <button disabled={saving || !results.length} onClick={() => void saveAndExit()} title={results.length ? "" : tx("做完至少一题才能暂存")}
              className="rounded-full border border-amber-300/60 px-3 py-1 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-300/10 disabled:opacity-40">💾 {tx("暂存")}</button>
          )}
          {!contest && <button onClick={() => { if (!teach && onSaveDraft && phase !== "done" && results.length) void saveAndExit(); else { stopAudio(); onExit(); } }} className="rounded-full border border-white/25 px-3 py-1 text-xs text-white/80 transition-colors hover:bg-white/10">✕ {tx("退出")}</button>}
        </div>
      </div>
      {phase !== "done" && !contest && (
        <div className="mx-auto h-1 w-full max-w-3xl shrink-0 overflow-hidden rounded bg-white/15">
          <div className="h-full bg-amber-400 transition-all" style={{ width: `${(idx / total) * 100}%` }} />
        </div>
      )}

      {/* 舞台:教练模式点中央暂停/继续 */}
      <div className={cn("hw-stage relative flex flex-1 flex-col items-center justify-center px-4 pb-10", contest && "pt-12", teach && phase === "play" && "cursor-pointer select-none")}
        onClick={teach && phase === "play" ? togglePause : glanceTeach && !revealed && phase === "answer" ? () => setRevealed(true) : undefined}>
        {phase === "count" && (
          <div className="flex flex-col items-center">
            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-white/55">{tx("准备")}</div>
            <div key={countdown} className="animate-pop-in font-mono-tabular font-bold" style={{ fontSize: "clamp(6rem,22vw,15rem)", lineHeight: 1 }}>{countdown > 0 ? countdown : tx("开始")}</div>
          </div>
        )}
        {phase === "gap" && <div className="animate-pop-in text-3xl font-black text-white/70">#{idx + 1}</div>}

        {/* 闪算 */}
        {phase === "play" && item.project === "flash" && (
          <div className="flex w-full max-w-5xl flex-col items-center gap-6">
            <div className="flex min-h-[44vh] items-center justify-center">
              {showTerm && strokeIdx < p.terms.length ? (
                item.method === "bead" ? (
                  // 珠算(心算导入):每笔显示珠码而非数字,学生脑中拨珠
                  <div key={strokeIdx} className="flex items-center gap-6" style={{ transform: `scale(${Math.min(1.4, flashScale / 0.6)})` }}>
                    {p.signs[strokeIdx] === "-" && <span className="font-hand font-bold leading-none" style={{ fontSize: "clamp(3rem,10vw,7rem)" }}>-</span>}
                    <Soroban value={p.terms[strokeIdx]} tone={tone} big />
                  </div>
                ) : (
                <div key={strokeIdx} className="flex items-baseline gap-3" style={{ transform: `scale(${flashScale})` }}>
                  {p.signs[strokeIdx] === "-" && <span className="font-hand font-bold leading-none" style={{ fontSize: BIG }}>-</span>}
                  <span className="font-hand font-bold leading-none" style={{ fontSize: BIG }}>{fmtNum(p.terms[strokeIdx])}</span>
                </div>
                )
              ) : <div className="h-3 w-3" />}
            </div>
            {!contest && <div className="font-mono-tabular text-sm text-white/50">{Math.min(strokeIdx + 1, p.terms.length)} / {p.terms.length} · {item.speedMs}ms</div>}
          </div>
        )}

        {/* 障碍算:每笔在随机位置闪现,周围撒干扰(数码:白色数字,有效数绿色;形状:深绿底绿色图形,有效数白色) */}
        {phase === "play" && item.project === "obstacle" && (
          <ObstacleStage p={p} strokeIdx={strokeIdx} show={showTerm && strokeIdx < p.terms.length} kind={item.obstacleKind} level={item.obstacleLevel} scale={flashScale} />
        )}
        {phase === "play" && item.project === "obstacle" && !contest && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono-tabular text-sm text-white/50">{Math.min(strokeIdx + 1, p.terms.length)} / {p.terms.length} · {obstacleSpeedMs(item, idx)}ms</div>
        )}

        {/* 马拉松 */}
        {phase === "play" && isScroll && (
          <div className="flex w-full flex-col items-center gap-3">
            <ScrollView p={p} k={scrollK} rows={SCROLL_ROWS} scale={flashScale} />
            {!contest && <div className="font-mono-tabular text-sm text-white/50">{Math.min(p.terms.length, Math.max(0, Math.floor(scrollK)))} / {p.terms.length} · {scrollSecFor(item, idx)}s</div>}
          </div>
        )}

        {/* 听算 */}
        {phase === "play" && item.project === "listen" && (
          <div className="flex flex-col items-center gap-6">
            <div className={cn("select-none", !paused && "animate-bounce")} style={{ fontSize: "clamp(5rem,16vw,9rem)" }}>🔊</div>
            <p className="text-2xl font-semibold text-white/90">{bankState === "loading" ? tx("准备中…") : tx("请听题,用心算～")}</p>
            <div className="font-mono-tabular text-sm text-white/50">{spoken} / {p.op ? 2 : p.terms.length}</div>
            {bankState === "fallback" && <p className="text-xs text-white/40">{tx("词块语音库暂不可用,已用浏览器语音兜底")}</p>}
          </div>
        )}

        {/* 看算(限时阶段) / 数珠互译 呈现 */}
        {item.project === "glance" && (phase === "play" || glanceTeachColumn && (phase === "answer" || phase === "feedback")) && <GlanceView p={p} scale={flashScale} bead={item.method === "bead"} tone={tone} tall />}
        {glanceTeachColumn && phase === "answer" && <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/50">{tx("点屏幕或右侧「显示答案」揭晓")}</div>}
        {phase === "play" && isBead && !n2b && (
          <div className="flex w-full max-w-6xl flex-col items-center gap-5">
            {see ? <SeeNumber s={beadStr(p)} scale={flashScale} /> : <BeadBoard s={beadStr(p, item.beadDigits)} tone={tone} />}
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">{see ? tx("记住这个数") : tx("看清算盘,记住数")}</div>
          </div>
        )}
        {/* 倒计时数字已去掉(2026-10-15 付海东「下面那个倒数的秒数可以不要」),限时仍在后台计 */}
        {/* 暂停标记放顶部小角标,不遮题(2026-10-13 付海东「中间不能有暂停键,学生看不到题了」) */}
        {paused && (
          <div className="pointer-events-none absolute left-1/2 top-16 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300/50 bg-black/60 px-4 py-1.5 text-sm font-bold text-amber-200 shadow-lg">
            <span>⏸</span><span>{tx("已暂停")}</span><span className="text-xs font-normal text-white/60">· {tx("点击屏幕继续")}</span>
          </div>
        )}

        {/* 作答 */}
        {(phase === "answer" || phase === "feedback") && !glanceTeachColumn && (
          /* 2026-11-03 孟阳「平板键盘不全」:有竖式时平板横屏题在左、键盘在右(.answer-split) */
          <div className={cn("flex w-full flex-col items-center gap-5", showColumn ? "max-w-4xl" : n2b || (isBead && teach) ? "max-w-6xl" : "max-w-md", showColumn && !teach && "answer-split", contest && "answer-compact")}>
            {showColumn && <div className="answer-left w-full"><GlanceView p={p} scale={flashScale} bead={item.method === "bead"} tone={tone} /></div>}
            <div className={cn("flex w-full flex-col items-center gap-5", showColumn && !teach && "answer-right")}>
            {/* 2026-10-29 付海东「马拉松最后出答案,题目没消失」:数字滚完就不再显示(作答 / 揭晓答案时只出答案),不再留最后几行 + 横线 */}
            {n2b && (
              /* Pad App(2026-11-05 付海东「太挤」):数字缩小、和算盘之间留出空间;网页不变 */
              <div className={cn("flex flex-col items-center gap-3", IS_NATIVE && "mb-6 gap-2")}>
                <div className="text-xs uppercase tracking-[0.25em] text-white/70">{tx("在算盘上拨出这个数")}</div>
                <div className={cn("font-hand font-bold leading-none", beadStr(p).length > 15 && "max-w-[92vw] break-all text-center leading-tight")} style={{ fontSize: beadStr(p).length > 15 ? "clamp(1.6rem,3.6vw,2.6rem)" : IS_NATIVE ? "clamp(2.6rem,7vw,4.6rem)" : "clamp(4rem,14vw,8rem)" }}>{grp(beadStr(p))}</div>
              </div>
            )}

            {teach ? (
              /* 教练:不输答案,直接揭晓 */
              <div className="flex flex-col items-center gap-4">
                {revealed ? (
                  <div className="animate-pop-in flex flex-col items-center gap-3">
                    <div className="text-xs uppercase tracking-[0.25em] text-amber-300">{tx("答案")}</div>
                    {n2b
                      ? <BeadBoard s={beadStr(p, item.beadDigits)} tone={tone} />
                      : isBead
                      ? <div className={cn("font-hand font-bold leading-none text-amber-300", beadStr(p).length > 12 ? "max-w-[92vw] break-all text-center leading-tight" : "whitespace-nowrap")} style={{ fontSize: beadStr(p).length > 12 ? "clamp(2rem,4.5vw,3.4rem)" : "clamp(5rem,20vw,13rem)" }}>{grp(beadStr(p))}</div>
                      : <div className="whitespace-nowrap font-hand font-bold leading-none text-amber-300" style={{ fontSize: p.rem != null ? "clamp(4rem,14vw,10rem)" : "clamp(5rem,20vw,13rem)" }}>{answerText(p.answer, p.rem, fmtNum)}</div>}
                    {!isBead && <div className="font-mono-tabular text-sm text-white/55">{problemExpr(p)}</div>}
                  </div>
                ) : (
                  <>
                    {glanceTeach && item.glanceLimitSec > 0
                      ? <div className="animate-pop-in whitespace-nowrap font-hand text-7xl font-bold text-amber-300 md:text-8xl">⏰ {tx("时间到")}</div>
                      : <div className="text-xs uppercase tracking-[0.25em] text-white/60">{see ? tx("刚才的数是多少?") : isBead && !n2b ? tx("算盘上是几?") : tx("学生心算中…")}</div>}
                    <div className="text-xs text-white/45">{glanceTeach ? tx("点屏幕或右侧「显示答案」揭晓") : tx("右侧「显示答案」或回车揭晓")}</div>
                  </>
                )}
              </div>
            ) : phase === "feedback" && feedback ? (
              <div className="relative flex flex-col items-center gap-2">
                {fxOn && <PraiseBurst key={`${round}-${idx}`} correct={feedback.correct} big={!!praise && praise.streak >= 3 && praise.key.startsWith("s")} />}
                <div className="animate-pop-in relative z-10 text-7xl">{praise?.emoji ?? (feedback.correct ? "🎉" : "💪")}</div>
                <div className={cn("animate-pop-in relative z-10 text-center text-3xl font-black", feedback.correct ? "text-emerald-300" : "text-amber-200")}>
                  {praise ? praiseText(praise.key, praiseLang) : feedback.correct ? tx("答对了") : tx("答错了")}
                </div>
                {feedback.correct && praise && praise.streak >= 2 && <div className="relative z-10 rounded-full bg-amber-400/20 px-3 py-0.5 text-sm font-bold text-amber-200">🔥 {lang === "en" ? `${praise.streak} in a row` : `连对 ${praise.streak} 题`}</div>}
                {!feedback.correct && <div className="relative z-10 font-mono-tabular text-white/80">{lang === "en" ? "You said" : "你答"} <b>{feedback.givenText ?? feedback.given ?? "—"}</b>{hideAnswer
                  ? <span className="ml-1 text-amber-200">· {lang === "en" ? "not quite — you'll get to redo it" : "不对哦,错题重做时再算一遍"}</span>
                  : <> · {lang === "en" ? "Answer" : "正确"} <b className="break-all text-amber-300">{isBead ? grp(beadStr(p)) : answerText(p.answer, p.rem, fmtNum)}</b></>}</div>}
              </div>
            ) : n2b ? (
              <div className={cn("flex w-full flex-col items-center gap-4", IS_NATIVE && "gap-6")}>
                <BeadInputBoard digits={p.beadDigits ?? item.beadDigits} value={beadInput} onChange={setBeadInput} />
                <div className={cn("break-all text-center font-mono-tabular text-sm text-white/60", IS_NATIVE && "text-base")}>{tx("当前拨出:")}{IS_NATIVE ? grp(digitsNorm(beadInput)) : digitsNorm(beadInput)}</div>
                {beadTimed && <div className={cn("rounded-full border px-3 py-0.5 font-mono-tabular text-sm", (beadLeftMs ?? 0) <= 3000 ? "animate-pulse border-red-400/60 text-red-300" : "border-white/25 text-white/70")}>⏱ {Math.ceil((beadLeftMs ?? 0) / 1000)}s</div>}
                <button onClick={submit} className="w-full max-w-xs rounded-full bg-amber-400 py-3 text-sm font-black text-black">{tx("确定")}</button>
              </div>
            ) : (
              <form className="flex w-full flex-col items-center gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <div className="text-xs uppercase tracking-[0.25em] text-white/70">{see ? tx("刚才的数是多少?") : isBead ? tx("算盘上是几?") : showColumn ? tx("算出结果,填答案") : tx("凭记忆填答案")}</div>
                {see && beadTimed && <div className={cn("-mt-2 rounded-full border px-3 py-0.5 font-mono-tabular text-sm", (beadLeftMs ?? 0) <= 3000 ? "animate-pulse border-red-400/60 text-red-300" : "border-white/25 text-white/70")}>⏱ {Math.ceil((beadLeftMs ?? 0) / 1000)}s</div>}
                {needRem && <div className="-mt-2 text-sm font-bold text-amber-300">{tx("除不尽:填「商 余 余数」,如 22÷8 → 2余6")}</div>}
                {needDot && !!p.places && <div className="-mt-2 text-sm font-bold text-amber-300">{tx("答案保留")} {p.places} {tx("位小数")}</div>}
                <input ref={inputRef} value={input} inputMode={softKey(needDot ? "decimal" : "numeric")} autoComplete="off" onChange={(e) => setInput(needRem
                  ? e.target.value.replace(/[.。．…\s]+/g, REM_SEP).replace(/[^\d余]/g, "").replace(/^余+/, "").replace(/(余.*)余/g, "$1")
                  : e.target.value.replace(needDot ? /[^\d.]/g : /[^\d]/g, "").replace(/(\..*)\./g, "$1"))}
                  className="h-16 w-full rounded-xl border-2 border-amber-400 bg-white px-4 text-center font-mono-tabular text-3xl font-bold text-neutral-900 outline-none" />
                <div className="grid w-full grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                    <button type="button" key={d} onClick={() => setInput((v) => v + d)} className="h-12 rounded-xl border border-white/25 bg-white/10 font-mono-tabular text-2xl font-semibold transition-colors hover:bg-white/20 active:bg-white/30">{d}</button>
                  ))}
                  <button type="button" onClick={() => setInput((v) => v.slice(0, -1))} className="h-12 rounded-xl border border-white/25 bg-white/10 text-xl hover:bg-white/20">⌫</button>
                  <button type="button" onClick={() => setInput((v) => v + "0")} className="h-12 rounded-xl border border-white/25 bg-white/10 font-mono-tabular text-2xl font-semibold hover:bg-white/20">0</button>
                  {needRem
                    ? <button type="button" onClick={() => setInput((v) => (!v || v.includes(REM_SEP) ? v : v + REM_SEP))} className="h-12 rounded-xl border border-amber-300/50 bg-white/10 text-2xl font-semibold hover:bg-white/20">{tx("余")}</button>
                    : needDot
                    ? <button type="button" onClick={() => setInput((v) => (v.includes(".") ? v : (v || "0") + "."))} className="h-12 rounded-xl border border-amber-300/50 bg-white/10 font-mono-tabular text-2xl font-semibold hover:bg-white/20">.</button>
                    : <button type="button" onClick={() => setInput("")} className="h-12 rounded-xl border border-white/25 bg-white/10 text-sm hover:bg-white/20">{tx("清空")}</button>}
                </div>
                {(needDot || needRem) && <button type="button" onClick={() => setInput("")} className="text-xs text-white/60 underline-offset-2 hover:underline">{tx("清空")}</button>}
                <button type="submit" disabled={!input} className="w-full rounded-full bg-amber-400 py-3 text-sm font-black text-black disabled:opacity-40">{tx("提交")}{idx + 1 >= total ? " ✓" : ""}</button>
                {item.project === "listen" && <button type="button" onClick={replay} className="text-xs text-white/70 underline-offset-2 hover:underline">{tx("再听一遍")}</button>}
              </form>
            )}
            </div>
          </div>
        )}

        {/* 本轮汇总(学生) */}
        {phase === "done" && contest && (
          <div className="flex flex-col items-center gap-3 text-center"><div className="text-5xl">✅</div><h2 className="text-2xl font-black">{tx("全部做完")}</h2><p className="text-white/60">{tx("等待统一结束")}</p></div>
        )}
        {phase === "done" && !teach && !contest && (
          <div className="flex w-full max-w-2xl flex-col items-center gap-4">
            <div className="text-6xl">{correctCount === total ? "🎉" : correctCount >= total * 0.7 ? "👍" : "💪"}</div>
            <h2 className="text-2xl font-black">{round > 0 ? `${tx("错题重做")} #${round}` : tx("本项完成")} · {correctCount} / {total}</h2>
            <div className="grid w-full grid-cols-5 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
              {results.map((r, i) => (
                <div key={i} className={cn("rounded-lg border px-1.5 py-1.5 text-center", r.correct ? "border-emerald-400/50 bg-emerald-400/15" : "border-red-400/50 bg-red-400/15")}>
                  <div className="text-[10px] text-white/55">{i + 1}</div>
                  <div className="break-all font-mono-tabular text-sm font-bold">{r.correct ? "✓" : <>{r.given == null ? "—" : r.givenS ?? answerText(r.given, r.givenRem)}{hideAnswer ? <span className="text-[10px] text-red-300"> ✗</span> : <span className="text-[10px] text-white/55">≠{r.beadS ?? answerText(r.answer, r.rem)}</span>}</>}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              {wrongProblems.length > 0 && (
                <button onClick={startRetry} className="rounded-full bg-amber-400 px-8 py-2.5 text-sm font-black text-black transition-transform hover:scale-[1.02]">{tx("错题重做")} ({wrongProblems.length})</button>
              )}
              <button onClick={() => { stopAudio(); onExit(); }} className={cn("rounded-full px-8 py-2.5 text-sm font-bold", wrongProblems.length || nextItem ? "border border-white/30 text-white/85 hover:bg-white/10" : "bg-amber-400 text-black")}>
                {wrongProblems.length ? tx("先交作业,稍后再练") : nextItem ? tx("交作业 · 回清单") : tx("完成 · 交作业")}
              </button>
              {nextItem && (
                <button onClick={() => { stopAudio(); nextItem.go(); }} className={cn("rounded-full px-8 py-2.5 text-sm font-black transition-transform hover:scale-[1.02]", wrongProblems.length ? "border border-white/30 text-white/85 hover:bg-white/10" : "bg-amber-400 text-black")}>
                  {tx("下一项")}{lang === "en" ? ": " : ":"}{nextItem.label} →
                </button>
              )}
            </div>
            {wrongProblems.length > 0 && <p className="text-xs text-white/45">{tx("本轮成绩已记录;错题再做的每一轮也会记录,教练都看得到。")}</p>}
          </div>
        )}
      </div>

      {/* 教练:右侧上一题/下一题 + 字号 */}
      {teach && phase !== "count" && (
        <div className="fixed right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2 md:right-6" onClick={(e) => e.stopPropagation()}>
          <SideBtn onClick={prev} disabled={idx === 0} title="←">▲<span className="text-[10px]">{tx("上一题")}</span></SideBtn>
          <SideBtn onClick={replay} title="replay">↻<span className="text-[10px]">{tx("重播")}</span></SideBtn>
          <SideBtn onClick={next} title="→">▼<span className="text-[10px]">{tx("下一题")}</span></SideBtn>
          {phase === "play" && <SideBtn onClick={togglePause} title={tx("暂停/继续(空格)")}>{paused ? "▶" : "⏸"}<span className="text-[10px]">{paused ? tx("继续") : tx("暂停")}</span></SideBtn>}
          {/* 显示答案放在右侧栏,与上下题对齐(2026-10-16 用户) */}
          {(phase === "answer" || phase === "feedback") && !revealed && <SideBtn onClick={() => setRevealed(true)} title={tx("显示答案(回车)")}>👁<span className="text-[10px]">{tx("显示答案")}</span></SideBtn>}
        </div>
      )}
      {/* 2026-11-03 孟阳「调字号的位置到处都是」:字号统一到各项目配置页的「字号」滑块;2026-11-24 护眼开关也收到页面顶栏(全局),作答器里不再单放 */}
    </div>,
    document.body,
  );
}

function SideBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl border border-white/25 bg-black/40 text-xl font-bold text-white/90 backdrop-blur transition-colors hover:bg-white/15 disabled:opacity-30 md:h-16 md:w-16">
      {children}
    </button>
  );
}

/** 看算呈现:加减竖式整列 / 乘除横式,自适应缩放保证一屏放下。 */
/** 障碍算舞台:每一笔重新随机布局(有效数位置 + 干扰物);kind=digits 白色干扰数字 + 绿色有效数;shapes/filled 深绿底 + 绿色图形 + 白色有效数 */
const OBSTACLE_COUNT = { digits: { low: 40, mid: 85, high: 150 }, shapes: { low: 16, mid: 32, high: 55 }, filled: { low: 20, mid: 40, high: 70 } } as const;
function ObstacleStage({ p, strokeIdx, show, kind, level, scale }: { p: HwProblem; strokeIdx: number; show: boolean; kind: "digits" | "shapes" | "filled"; level: "low" | "mid" | "high"; scale: number }) {
  const term = p.terms[Math.min(strokeIdx, p.terms.length - 1)];
  const sign = p.signs[Math.min(strokeIdx, p.signs.length - 1)];
  const layout = useMemo(() => {
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const n = OBSTACLE_COUNT[kind][level];
    const digits = String(term).length;
    const noise = Array.from({ length: n }, (_, i) => ({
      x: rnd(2, 92), y: rnd(4, 90), rot: rnd(-40, 40), sz: rnd(0.7, 1.3), shape: i % 5,
      num: String(Math.floor(Math.random() * Math.pow(10, digits))).padStart(digits, "0").replace(/^0/, String(1 + Math.floor(Math.random() * 9))),
    }));
    return { noise, tx: rnd(12, 78), ty: rnd(14, 78) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokeIdx, term, kind, level]);
  const digitsKind = kind === "digits";
  // 干扰数字约 1/14 屏宽、密集铺满(录屏口径);有效数稍大
  const fs = `calc(clamp(1.3rem, 2.4vw, 2.3rem) * ${scale / 0.6})`;
  const fsTerm = `calc(${fs} * 1.35)`;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: digitsKind ? "#000" : "#2f4a2a" }}>
      {show && layout.noise.map((o, i) => digitsKind ? (
        <span key={i} className="absolute font-mono-tabular font-semibold text-white" style={{ left: `${o.x}%`, top: `${o.y}%`, fontSize: `calc(${fs} * ${o.sz})`, transform: `translate(-50%,-50%)` }}>{o.num}</span>
      ) : (
        <span key={i} className="absolute" style={{ left: `${o.x}%`, top: `${o.y}%`, width: `calc(${fs} * ${o.sz * (kind === "filled" ? 2.4 : 2)})`, height: `calc(${fs} * ${o.sz * (o.shape === 3 ? 1.2 : 2)})`, transform: `translate(-50%,-50%) rotate(${o.rot}deg)`, background: "#6cc04a",
          borderRadius: o.shape === 0 ? "50%" : o.shape === 1 ? "8%" : o.shape === 3 ? "50% / 50%" : "0",
          clipPath: o.shape === 2 ? "polygon(50% 0, 100% 100%, 0 100%)" : o.shape === 4 ? "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" : undefined }} />
      ))}
      {show && (
        <div className="absolute flex items-center whitespace-nowrap font-mono-tabular font-bold" style={{ left: `${layout.tx}%`, top: `${layout.ty}%`, transform: "translate(-50%,-50%)", fontSize: fsTerm, color: digitsKind ? "#3dff5a" : "#fff", textShadow: digitsKind ? "0 0 12px rgba(61,255,90,.5)" : "0 2px 8px rgba(0,0,0,.5)" }}>
          {/* 2026-11-03 孟阳「两个减号长短不一样」:等宽字体的 ASCII「-」太短,改用数学减号「−」(与加号等宽,观感同看算竖式) */}
          {sign === "-" && <span className="mr-2">−</span>}{fmtNum(term)}
        </div>
      )}
    </div>
  );
}

/** 马拉松滚动视口:rows 行高的窗口,第 i 笔在第 (rows + i − k) 行;k 连续增大即整列上滚;final 时在最后一笔下画线 */
function ScrollView({ p, k, rows, scale, final = false }: { p: HwProblem; k: number; rows: number; scale: number; final?: boolean }) {
  const s = scale / 0.6; // 字号默认 0.6 → 1 倍
  // 行高封顶 15vh:5 行视口必须整体落在屏幕内(放大字号或窄屏时不能超出舞台被裁掉)
  const font = `min(calc(clamp(2.8rem, 9vw, 7rem) * ${s}), 13vh)`; // 2026-10-15 付海东「马拉松太小」
  const rowh = `calc(${font} * 1.35)`;
  const fmt = (t: number) => (p.places ? Math.abs(t).toFixed(p.places) : fmtNum(Math.abs(t)));
  // 整列居中于屏幕(2026-10-14 付海东「数字怎么不在屏幕中间」):每行一个定宽块、块内按个位右对齐
  const width = Math.max(...p.terms.map((t) => fmt(t).length)) + 1.2;
  // Pad App(2026-11-05 付海东录屏「速度稍快时数字在屏幕上抖动、不稳定」):整列放在一层里用 translate3d 平移(GPU 合成),
  // 不再每帧改每一行的 top(安卓 WebView 每帧重排 + 文字阴影重绘会抖);网页端维持原写法不动
  if (IS_NATIVE) return (
    <div className="relative w-full overflow-hidden" style={{ height: `calc(${rowh} * ${rows})` }}>
      <div className="absolute inset-x-0 top-0" style={{ transform: `translate3d(0, calc(${rowh} * ${(rows - k).toFixed(4)}), 0)`, willChange: "transform", backfaceVisibility: "hidden" }}>
        {p.terms.map((t, i) => (
          <div key={i} className="absolute left-1/2 flex -translate-x-1/2 items-center justify-end whitespace-nowrap font-hand font-bold leading-none text-white" style={{ top: `calc(${rowh} * ${i})`, height: rowh, fontSize: font, width: `${width}ch` }}>
            {p.signs[i] === "-" && <span className="mr-3">-</span>}{fmt(t)}
          </div>
        ))}
      </div>
      {final && <div className="absolute left-1/2 -translate-x-1/2 border-b-4 border-white/80" style={{ top: `calc(${rowh} * ${rows - 1})`, width: `calc(${width}ch * 1.1 + 2rem)`, fontSize: font }} />}
    </div>
  );
  return (
    <div className="relative w-full overflow-hidden" style={{ height: `calc(${rowh} * ${rows})` }}>
      {p.terms.map((t, i) => {
        const row = rows + i - k;
        if (row < -1 || row > rows) return null;
        return (
          <div key={i} className="absolute left-1/2 flex -translate-x-1/2 items-center justify-end whitespace-nowrap font-hand font-bold leading-none text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]" style={{ top: `calc(${rowh} * ${row})`, height: rowh, fontSize: font, width: `${width}ch` }}>
            {p.signs[i] === "-" && <span className="mr-3">-</span>}{fmt(t)}{/* 用 ASCII 减号:手写字体没有 U+2212,之前减号画不出来(付海东「加减混合还是纯加」) */}
          </div>
        );
      })}
      {final && <div className="absolute left-1/2 -translate-x-1/2 border-b-4 border-white/80" style={{ top: `calc(${rowh} * ${rows - 1})`, width: `calc(${width}ch * 1.1 + 2rem)`, fontSize: font }} />}
    </div>
  );
}

/** 看算竖列(2026-10-15 付海东「字太小、放大后后面看不到」「不能换行,一题居中铺满全屏」):
 *  永远单列居中,列高占满舞台(tall=出题阶段 ~84vh),整列缩放到刚好填满;字号− 可缩小,字号+ 最多到填满(不溢出)。 */
export function GlanceView({ p, scale = 1, bead = false, tone = "dark", tall = false }: { p: HwProblem; scale?: number; bead?: boolean; tone?: "light" | "dark"; tall?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const f = scale / 0.6; // 默认 0.6 → 1
  const n = p.terms.length;
  const cols = 1; // 付海东:不能换行
  const per = n;
  const chunks = Array.from({ length: cols }, (_, c) => p.terms.slice(c * per, (c + 1) * per).map((t, k) => ({ t, i: c * per + k })));
  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current, card = cardRef.current;
      if (!box || !card || !card.offsetWidth || !card.offsetHeight) return;
      const s = Math.min(box.clientWidth / card.offsetWidth, box.clientHeight / card.offsetHeight, 8);
      setFit(s > 0.05 ? s : 0.05);
    };
    measure();
    window.addEventListener("resize", measure);
    // 手写体字体晚于首次测量加载 → 数字变宽「出格」;字体就绪与卡片尺寸变化都重测
    document.fonts?.ready.then(measure).catch(() => {});
    const ro = typeof ResizeObserver !== "undefined" && cardRef.current ? new ResizeObserver(measure) : null;
    if (ro && cardRef.current) ro.observe(cardRef.current);
    return () => { window.removeEventListener("resize", measure); ro?.disconnect(); };
  }, [p, cols]);
  const eff = Math.min(fit, fit * Math.max(0.5, Math.min(1, f))); // 缩小有效,放大靠分列
  return (
    <div ref={boxRef} className="glance-box flex w-full items-center justify-center overflow-hidden" style={{ height: tall ? "calc(100dvh - 7.5rem)" : "46vh" }}>
      <div style={{ transform: `scale(${eff})`, transformOrigin: "center" }}>
        <div ref={cardRef} className="px-10 py-2">
          {p.op ? (
            <div className="whitespace-nowrap font-hand text-6xl font-bold text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
              {fmtNum(p.terms[0])} <span className="text-amber-300">{p.op}</span> {fmtNum(p.terms[1])}
            </div>
          ) : (
            <div className="flex items-start gap-x-14">
              {chunks.map((col, c) => (
                <div key={c} className="flex flex-col items-end gap-y-1 font-hand text-4xl font-bold leading-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
                  {col.map(({ t, i }) => bead ? (
                    <div key={i} className="flex items-center justify-end gap-3 whitespace-nowrap">
                      <span className="inline-block w-6 text-center text-4xl">{p.signs[i] === "-" ? "-" : ""}</span><Soroban value={t} tone={tone} />
                    </div>
                  ) : (
                    <div key={i} className="whitespace-nowrap">
                      <span className="mr-2 inline-block text-center" style={{ width: "0.7em" }}>{p.signs[i] === "-" ? "-" : ""}</span>{fmtNum(t)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== 统一字号(2026-11-03 孟阳「每个项目调字号的位置都不一样,统一在一个位置」)=====
// 闪算 / 看算 / 心算马拉松 / 障碍算 / 作业共用一个字号(hw:flashScale,0.3–2,默认 0.6 = 100%),只在配置页 / 作业页顶部的「字号」滑块调。
const NUM_SCALE_KEY = "hw:flashScale";
export function getNumScale(): number { try { const v = Number(localStorage.getItem(NUM_SCALE_KEY)); return v >= 0.3 && v <= 2 ? v : 0.6; } catch { return 0.6; } }
export function NumScaleRow({ className }: { className?: string }) {
  const tx = useTx();
  const [v, setV] = useState<number>(getNumScale);
  useEffect(() => { try { localStorage.setItem(NUM_SCALE_KEY, String(v)); } catch { /* noop */ } }, [v]);
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="shrink-0 font-semibold text-muted-foreground">🔠 {tx("字号")}</span>
      <span className="text-[10px] text-muted-foreground">{tx("小")}</span>
      <Slider value={[v]} onValueChange={(x) => setV(x[0])} min={0.3} max={2} step={0.05} className="max-w-xs flex-1" />
      <span className="text-[10px] text-muted-foreground">{tx("大")}</span>
      {/* 示例数字跟闪算配置页一致:手写体「3,141」随滑块实时变大变小 */}
      <span className="font-hand text-2xl font-bold leading-none text-foreground" style={{ fontSize: `${Math.max(1, Math.min(4.2, (v / 0.6) * 2.2))}rem` }}>3,141</span>
    </div>
  );
}

// ===== 数珠互译:数字串 + 多排算盘(2026-11-08 用户「不要限制 15 位,可以有 100 位」)=====
const BEAD_ROW = 20; // 超过 25 位就按 20 档一排折行(从左往右、从上往下读;第一排放零头,后面每排对齐)
const digitsNorm = (s: string) => s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
/** 本题算盘值的数字串(新题有 beadS;旧数据退回 bead/answer) */
function beadStr(p: HwProblem, digits?: number): string {
  const s = p.beadS ?? String(p.bead ?? p.answer);
  return digits ? s.padStart(p.beadDigits ?? digits, "0") : s;
}
function beadRows(s: string): string[] {
  if (s.length <= 25) return [s];
  const out: string[] = []; let i = s.length % BEAD_ROW || BEAD_ROW;
  out.push(s.slice(0, i));
  for (; i < s.length; i += BEAD_ROW) out.push(s.slice(i, i + BEAD_ROW));
  return out;
}
const rowW = (n: number) => `${((n * ROD_W + 40) / (BEAD_ROW * ROD_W + 40)) * 100}%`; // 各排同一档宽
export function BeadBoard({ s, tone }: { s: string; tone: "light" | "dark" }) {
  const rows = beadRows(s);
  if (rows.length === 1) return <Soroban value={s} digits={s.length} tone={tone} big />;
  return (
    <div className="flex w-full max-w-5xl flex-col items-end gap-2">
      {rows.map((r, k) => <div key={k} style={{ width: rowW(r.length) }}><Soroban value={r} digits={r.length} tone={tone} big /></div>)}
    </div>
  );
}
function BeadInputBoard({ digits, value, onChange }: { digits: number; value: string; onChange: (s: string) => void }) {
  const full = value.replace(/\D/g, "").padStart(digits, "0").slice(-digits);
  const rows = beadRows(full);
  if (rows.length === 1) return <InteractiveSoroban digits={digits} value={full} onChangeStr={onChange} tone="dark" big />;
  let off = 0;
  return (
    <div className="flex w-full max-w-5xl flex-col items-end gap-2">
      {rows.map((r, k) => { const at = off; off += r.length; return (
        <div key={k} style={{ width: rowW(r.length) }}>
          <InteractiveSoroban digits={r.length} value={r} onChangeStr={(v) => onChange(full.slice(0, at) + v + full.slice(at + r.length))} tone="dark" big />
        </div>); })}
    </div>
  );
}
/** 看数(数码秒记):大字显示数字串,三位一组;长了自动缩小并折行 */
export function SeeNumber({ s, scale }: { s: string; scale: number }) {
  const n = s.length;
  const size = n <= 6 ? "clamp(4rem,16vw,11rem)" : n <= 12 ? "clamp(3rem,9vw,7rem)" : n <= 24 ? "clamp(2.2rem,5.5vw,4.4rem)" : "clamp(1.6rem,3.6vw,2.8rem)";
  return <div className="max-w-[94vw] break-all text-center font-hand font-bold leading-tight tracking-wide" style={{ fontSize: size, transform: `scale(${Math.min(1.3, scale / 0.6)})` }}>{grp(s)}</div>;
}
