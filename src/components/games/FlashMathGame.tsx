import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { submitScore } from "@/lib/leaderboard";
import { buildProblem, type Problem } from "@/lib/flashMath";
import { generateMultiply, generateDivide } from "@/lib/abacus";
import { difficultyD } from "@/lib/difficulty";
import { dingTick, dingGo } from "@/lib/beep";

type MDOp = "×" | "÷";
// answerStr:乘除的精确答案(大数用 BigInt 求得,避免超出 JS 安全整数导致算错)
type GProblem = Problem & { op?: MDOp; answerStr?: string };
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import { Mic, MicOff, Play, RotateCcw, Settings2, Check, X, Minus, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logAttempt, fetchWrongAttempts } from "@/lib/practiceLog";
import { recordMistakeAttempt, masteredSet, problemKey as mkKey, MASTERY_THRESHOLD } from "@/lib/mistakeMastery";

type Phase = "config" | "ready" | "playing" | "answer" | "result";

export type FlashMode = "flash" | "glance" | "listen"; // 呈现方式
export type OpType = "addsub" | "mul" | "div";         // 运算类型

export interface FlashCfg {
  mode: FlashMode; // 闪算(逐笔闪现) / 看算(整屏竖式) / 听算(语音报题)
  op: OpType;      // 加减 / 乘 / 除 —— 闪算恒为加减;看算、听算三选一
  count: number;
  digits: number;
  speedMs: number; // 闪算单笔时间
  listenSec: number; // 听算:每笔时间(ms)—— 每报一个数占多久(含停顿),同时决定语速
  listenLang: "zh" | "en"; // 听算:中文报数 / 英语听力
  includeSub: boolean;
  rounds: number;
  mulA: number; // 乘法:被乘数位数
  mulB: number; // 乘法:乘数位数
  divA: number; // 除法:被除数位数
  divB: number; // 除法:除数位数
}

const MODE_LABEL: Record<FlashMode, string> = { flash: "闪电心算", glance: "看算", listen: "听算" };
const OP_LABEL: Record<OpType, string> = { addsub: "加减", mul: "乘法", div: "除法" };
// 闪算只支持加减;看算、听算支持全部运算
const opsForMode = (m: FlashMode): OpType[] => (m === "flash" ? ["addsub"] : ["addsub", "mul", "div"]);
const DEFAULT_CFG: FlashCfg = { mode: "flash", op: "addsub", count: 5, digits: 2, speedMs: 700, listenSec: 1000, listenLang: "zh", includeSub: false, rounds: 1, mulA: 2, mulB: 2, divA: 3, divB: 1 };
const CFG_STORAGE_KEY = "flashmath:lastCfg";

function loadStoredCfg(): FlashCfg {
  if (typeof window === "undefined") return DEFAULT_CFG;
  try {
    const raw = window.localStorage.getItem(CFG_STORAGE_KEY);
    if (!raw) return DEFAULT_CFG;
    const p = JSON.parse(raw);
    const mode: FlashMode = ["glance", "listen"].includes(p.mode) ? p.mode : "flash";
    // 兼容旧存档:曾经把乘/除当作独立 mode
    const rawOp = p.op ?? (p.mode === "multiply" ? "mul" : p.mode === "divide" ? "div" : "addsub");
    const op: OpType = ["mul", "div"].includes(rawOp) ? rawOp : "addsub";
    return {
      mode,
      op: mode === "flash" ? "addsub" : op,
      count: Math.min(200, Math.max(1, Number(p.count) || DEFAULT_CFG.count)),
      digits: Math.min(7, Math.max(1, Number(p.digits) || DEFAULT_CFG.digits)),
      speedMs: Math.min(5000, Math.max(150, Number(p.speedMs) || DEFAULT_CFG.speedMs)),
      listenSec: Math.min(6000, Math.max(300, Number(p.listenSec) || 1000)),
      listenLang: p.listenLang === "en" ? "en" : "zh",
      includeSub: !!p.includeSub,
      rounds: Math.min(200, Math.max(1, Number(p.rounds) || DEFAULT_CFG.rounds)),
      mulA: Math.min(10, Math.max(1, Number(p.mulA) || DEFAULT_CFG.mulA)),
      mulB: Math.min(10, Math.max(1, Number(p.mulB) || DEFAULT_CFG.mulB)),
      divA: Math.min(10, Math.max(2, Number(p.divA) || DEFAULT_CFG.divA)),
      divB: Math.min(8, Math.max(1, Number(p.divB) || DEFAULT_CFG.divB)),
    };
  } catch {
    return DEFAULT_CFG;
  }
}

// 中文读数(听算 TTS)
const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const UNIT = ["", "十", "百", "千"];
const BIG = ["", "万", "亿"];
function numberToCN(n: number): string {
  if (n === 0) return "零";
  let s = String(n);
  const groups: string[] = [];
  while (s.length) { groups.unshift(s.slice(-4)); s = s.slice(0, -4); }
  let out = "";
  groups.forEach((g, gi) => {
    const val = Number(g);
    let seg = "", zero = false;
    const len = g.length;
    for (let i = 0; i < len; i++) {
      const dd = Number(g[i]); const pos = len - 1 - i;
      if (dd === 0) { zero = true; }
      else { if (zero && seg) seg += "零"; zero = false; seg += CN[dd] + UNIT[pos]; }
    }
    if (val !== 0) {
      // 跨节补零:高节非空、且本节不足千(千位为 0),中间要读「零」(如 一万零二百 / 一亿零一)
      if (out !== "" && val < 1000) out += "零";
      out += seg + BIG[groups.length - 1 - gi];
    }
  });
  return (out.replace(/^一十/, "十")) || "零";
}
// 英文读数(听算·英语听力):把数字转成英文单词,保证无论嗓音如何都读英文,而非阿拉伯数字被中文嗓音念成中文
const EN_ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const EN_SCALE = ["", "thousand", "million", "billion", "trillion"];
function enTriple(num: number): string {
  let str = "";
  const h = Math.floor(num / 100), r = num % 100;
  if (h) str += EN_ONES[h] + " hundred" + (r ? " " : "");
  if (r) {
    if (r < 20) str += EN_ONES[r];
    else { str += EN_TENS[Math.floor(r / 10)]; if (r % 10) str += "-" + EN_ONES[r % 10]; }
  }
  return str;
}
function numberToEN(n: number): string {
  if (n === 0) return "zero";
  const groups: number[] = [];
  let num = Math.abs(n);
  while (num > 0) { groups.push(num % 1000); num = Math.floor(num / 1000); }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    parts.push(enTriple(groups[i]) + (EN_SCALE[i] ? " " + EN_SCALE[i] : ""));
  }
  return (n < 0 ? "minus " : "") + parts.join(" ");
}
// 选一把尽量自然、柔和的嗓音(中文 / 英语各挑一把,优先在线/女声/高质量)
const voiceMatch = (lang: "zh" | "en") =>
  lang === "zh"
    ? (v: SpeechSynthesisVoice) => /zh|cmn|chinese|中文|普通话/i.test(`${v.lang} ${v.name}`)
    : (v: SpeechSynthesisVoice) => /^en/i.test(v.lang) || /english/i.test(v.name);
const voiceScore = (lang: "zh" | "en") => (v: SpeechSynthesisVoice) => {
  let s = 0;
  const n = v.name.toLowerCase();
  // 本地嗓音优先:远程/网络嗓音(如 Google)在部分 Chrome 上会静默无声,本地嗓音可靠出声
  if (v.localService) s += 6;
  if (/(ting-?ting|婷婷|meijia|美佳|sinji|li-?mu|yu-?shu|samantha|karen|daniel|alex|female|女)/.test(n)) s += 3;
  if (/(neural|natural|premium|enhanced|自然)/.test(n)) s += 2;
  if (lang === "zh" ? /^zh-CN/i.test(v.lang) : /^en-US/i.test(v.lang)) s += 2;
  return s;
};
function bestVoice(lang: "zh" | "en", localOnly: boolean): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  let pool = voices.filter(voiceMatch(lang));
  if (localOnly) {
    const localPool = pool.filter((v) => v.localService);
    if (localPool.length) pool = localPool; // 有本地就只用本地
  }
  return pool.sort((a, b) => voiceScore(lang)(b) - voiceScore(lang)(a))[0] ?? null;
}
const voiceCache: Record<"zh" | "en", SpeechSynthesisVoice | null | undefined> = { zh: undefined, en: undefined };
function pickVoice(lang: "zh" | "en", forceLocal = false): SpeechSynthesisVoice | null {
  if (forceLocal) return bestVoice(lang, true); // 兜底重试:强制本地嗓音,不走缓存
  if (voiceCache[lang] !== undefined) return voiceCache[lang] as SpeechSynthesisVoice | null;
  if (!("speechSynthesis" in window)) return (voiceCache[lang] = null);
  if (!window.speechSynthesis.getVoices().length) return null; // 尚未加载,下次再选
  return (voiceCache[lang] = bestVoice(lang, false));
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => { voiceCache.zh = undefined; voiceCache.en = undefined; };
}
function speakTerm(text: string, rate: number, lang: "zh" | "en" = "zh"): Promise<void> {
  return new Promise((resolve) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) { setTimeout(resolve, 300); return; }
    let done = false, started = false;
    let iv: ReturnType<typeof setInterval>;
    let retry: ReturnType<typeof setTimeout>, cap: ReturnType<typeof setTimeout>;
    const finish = () => { if (!done) { done = true; clearInterval(iv); clearTimeout(retry); clearTimeout(cap); resolve(); } };
    const build = (forceLocal: boolean) => {
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(lang, forceLocal);
      if (v) u.voice = v;
      u.lang = lang === "zh" ? "zh-CN" : "en-US";
      u.rate = Math.max(0.6, Math.min(1.6, rate));
      u.pitch = 1.08; // 略微上扬更柔和
      u.volume = 1;
      u.onstart = () => { started = true; };
      u.onend = finish;
      u.onerror = finish;
      return u;
    };
    try { if (synth.paused) synth.resume(); } catch { /* noop */ }
    try { synth.speak(build(false)); } catch { finish(); return; }
    // Chrome 偶发把合成器卡在暂停态:说话中周期性 resume 唤醒(不因此结束)
    iv = setInterval(() => { try { if (synth.speaking) synth.resume(); } catch { /* noop */ } }, 3000);
    // 700ms 内没真正开始播放(远程嗓音静默失败)→ 取消,换本地嗓音重试一次
    retry = setTimeout(() => {
      if (!started && !done) {
        try { synth.cancel(); } catch { /* noop */ }
        try { synth.speak(build(true)); } catch { finish(); }
      }
    }, 700);
    // 兜底:按文本长度估算最长时长后强制结束,避免 onend 不触发时卡住
    cap = setTimeout(finish, Math.min(9000, 1400 + text.length * 220));
  });
}

// 参考世界珠算心算联合会 / 中国珠协比赛规则的近似积分体系：
// 总分 = round( 笔数 × 位数权重 × 速度系数 × 减法系数 )
// · 位数权重 digitWeight: 1→1, 2→1.4, 3→2, 4→2.8, 5→3.8, 6→5, 7→6.5（位数越多，难度非线性上升）
// · 速度系数 = clamp(1000 / speedMs, 0.4, 8)，以 1 秒/笔为基准 1.0；200ms 约 5.0
// · 减法系数 = 含减号 1.3，纯加 1.0（官方比赛对加减混合给予更高难度系数）
const DIGIT_WEIGHT = [0, 1, 1.4, 2, 2.8, 3.8, 5, 6.5];

export function previewScore(cfg: FlashCfg): number {
  if (cfg.op === "mul") {
    const wa = DIGIT_WEIGHT[cfg.mulA] ?? cfg.mulA, wb = DIGIT_WEIGHT[cfg.mulB] ?? cfg.mulB;
    return Math.round((wa + wb) * 12);
  }
  if (cfg.op === "div") {
    const wa = DIGIT_WEIGHT[cfg.divA] ?? cfg.divA, wb = DIGIT_WEIGHT[cfg.divB] ?? cfg.divB;
    return Math.round((wa + wb) * 12);
  }
  const w = DIGIT_WEIGHT[cfg.digits] ?? cfg.digits;
  const speed = Math.min(8, Math.max(0.4, 1000 / Math.max(cfg.speedMs, 100)));
  const sub = cfg.includeSub ? 1.3 : 1;
  return Math.round(cfg.count * w * speed * sub * 10);
}

function computeScore(cfg: FlashCfg, correct: boolean): number {
  if (!correct) return 0;
  return previewScore(cfg);
}

// ── 云端语音识别(跨设备):录音上传到本站 Netlify Function → Whisper 识别 → 回填答案 ──
// 只依赖 MediaRecorder + getUserMedia(几乎所有现代浏览器都支持),不走 Google 语音服务,国内也能用。
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => { const s = String(fr.result); resolve(s.slice(s.indexOf(",") + 1)); };
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
// 英文数字单词 → 数值(答英语时用)
const EN_NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const EN_SCALE_MAP: Record<string, number> = { thousand: 1000, million: 1e6, billion: 1e9 };
function enWordsToNumber(text: string): number | null {
  const words = text.toLowerCase().replace(/-/g, " ").replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  let total = 0, current = 0, found = false;
  for (const w of words) {
    if (w in EN_NUM) { current += EN_NUM[w]; found = true; }
    else if (w === "hundred") { current = (current || 1) * 100; found = true; }
    else if (w in EN_SCALE_MAP) { current = (current || 1) * EN_SCALE_MAP[w]; total += current; current = 0; found = true; }
    // "and" 等词忽略
  }
  return found ? total + current : null;
}
/** 把识别文本解析成答案数字串:优先阿拉伯数字 → 中文数字 → 英文数字单词。 */
function parseAnswerText(text: string): string {
  if (!text) return "";
  const d = text.replace(/[,，\s]/g, "").match(/-?\d+/);
  if (d) return String(parseInt(d[0], 10));
  const zh = parseSpokenNumber(text);
  if (zh != null) return String(zh);
  const en = enWordsToNumber(text);
  if (en != null) return String(en);
  return "";
}
function useCloudSpeech(onText: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cb = useRef(onText);
  cb.current = onText;
  const supported =
    typeof window !== "undefined" && typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const start = async (lang: "zh" | "en") => {
    if (!supported) { toast({ title: "语音输入", description: "当前浏览器不支持录音,请用数字键盘作答。" }); return; }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast({ title: "语音输入", description: "没能打开麦克风。请在浏览器允许麦克风权限后重试(也可用数字键盘)。" });
      return;
    }
    chunksRef.current = [];
    let mr: MediaRecorder;
    try { mr = new MediaRecorder(stream); }
    catch { stream.getTracks().forEach((t) => t.stop()); toast({ title: "语音输入", description: "录音初始化失败,请用数字键盘。" }); return; }
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      if (!blob.size) return;
      setBusy(true);
      try {
        const b64 = await blobToBase64(blob);
        const res = await fetch("/.netlify/functions/transcribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ audio: b64, mime: blob.type, lang }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data && data.error) || "识别失败");
        cb.current(data.text || "");
      } catch (e: any) {
        toast({ title: "语音识别", description: String(e?.message || e || "识别失败,请重试或用数字键盘") });
      } finally { setBusy(false); }
    };
    mrRef.current = mr;
    mr.start();
    setRecording(true);
  };
  const stop = () => { try { mrRef.current?.stop(); } catch { /* noop */ } };
  useEffect(() => () => { try { mrRef.current?.stop(); } catch { /* noop */ } }, []);
  return { supported, recording, busy, start, stop };
}

function NumInput({
  value, onChange, min, max, suffix, placeholder,
}: { value: number | null; onChange: (n: number) => void; min: number; max: number; suffix?: string; placeholder?: string }) {
  const [text, setText] = useState(value != null ? String(value) : "");
  useEffect(() => setText(value != null ? String(value) : ""), [value]);
  const commit = (s: string) => {
    const n = parseInt(s.replace(/\D/g, ""), 10);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    else setText(value != null ? String(value) : "");
  };
  return (
    <div className="flex items-center gap-1.5">
      <Input
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-7 w-12 rounded-md border-border bg-background px-1 py-0 text-center font-mono-tabular text-[11px] font-medium"
      />
      {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function SecInput({
  value, onChange, min, max, placeholder,
}: { value: number | null; onChange: (n: number) => void; min: number; max: number; placeholder?: string }) {
  const [text, setText] = useState(value != null ? String(value / 1000) : "");
  useEffect(() => setText(value != null ? String(value / 1000) : ""), [value]);
  const commit = (s: string) => {
    const n = parseFloat(s);
    if (Number.isFinite(n)) {
      const ms = Math.round(Math.min(max, Math.max(min, n * 1000)));
      onChange(ms);
    } else {
      setText(value != null ? String(value / 1000) : "");
    }
  };
  return (
    <div className="flex items-center gap-1.5">
      <Input
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-7 w-12 rounded-md border-border bg-background px-1 py-0 text-center font-mono-tabular text-[11px] font-medium"
      />
      <span className="text-[10px] text-muted-foreground">秒</span>
    </div>
  );
}

export function FlashMathGame({
  onFinished,
  onCfgChange,
  mistakeMode = false,
  onMistakeModeChange,
  initialMode,
}: {
  onFinished?: () => void;
  onCfgChange?: (cfg: FlashCfg) => void;
  mistakeMode?: boolean;
  onMistakeModeChange?: (v: boolean) => void;
  initialMode?: FlashMode;
}) {
  const [cfg, setCfg] = useState<FlashCfg>(() => {
    const c = loadStoredCfg();
    const mode = initialMode ?? c.mode;
    return { ...c, mode, op: mode === "flash" ? "addsub" : c.op };
  });
  const [phase, setPhase] = useState<Phase>("config");
  const [countdown, setCountdown] = useState(3);
  const [problem, setProblem] = useState<GProblem | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [showTerm, setShowTerm] = useState(true);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ correct: boolean; score: number; answered: number } | null>(null);
  const [isReplay, setIsReplay] = useState(false);
  type RoundRecord = { problem: GProblem; answered: number; correct: boolean; score: number };
  const [session, setSession] = useState<{ round: number; correct: number; totalScore: number; history: RoundRecord[] }>(
    { round: 0, correct: 0, totalScore: 0, history: [] },
  );
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const usedMistakeKeysRef = useRef<Set<string>>(new Set());
  const clearedThisSessionRef = useRef<{ key: string; expr: string }[]>([]);
  // 结果页「再练一次」:对错题原地重练,记录每次重练的答案与对错
  type RetryAttempt = { answered: number; correct: boolean };
  const [retryIdx, setRetryIdx] = useState<number | null>(null); // 正在重练的题在 history 中的下标
  const [retryLog, setRetryLog] = useState<Record<number, RetryAttempt[]>>({});
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const preRetryProblemRef = useRef<GProblem | null>(null);

  useEffect(() => onCfgChange?.(cfg), [cfg, onCfgChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CFG_STORAGE_KEY, JSON.stringify(cfg));
    } catch {}
  }, [cfg]);

  const problemKey = (terms: number[], signs: string[], answer: number) =>
    `${signs.join("")}|${terms.join(",")}|${answer}`;

  const loadProblem = async (): Promise<GProblem | null> => {
    if (cfg.op === "mul") {
      const { a, b } = generateMultiply(cfg.mulA, cfg.mulB);
      const answerStr = (BigInt(a) * BigInt(b)).toString(); // 精确大数乘积
      return { terms: [a, b], signs: ["+", "+"], answer: Number(answerStr), answerStr, op: "×" };
    }
    if (cfg.op === "div") {
      const qd = Math.max(1, cfg.divA - cfg.divB + 1);
      const { dividend, divisor, quotient } = generateDivide(cfg.divB, qd);
      return { terms: [dividend, divisor], signs: ["+", "+"], answer: quotient, answerStr: String(quotient), op: "÷" };
    }
    if (mistakeMode) {
      const wrong = await fetchWrongAttempts("flashmath", 1000);
      if (wrong.length === 0) return null;
      const mastered = masteredSet("flashmath");
      // dedupe by problem identity, drop already-mastered ones
      const uniq = new Map<string, typeof wrong[number]>();
      for (const w of wrong) {
        const k = problemKey(w.terms, w.signs, w.answer);
        if (mastered.has(k)) continue;
        if (!uniq.has(k)) uniq.set(k, w);
      }
      if (uniq.size === 0) return null;
      const pool = Array.from(uniq.entries());
      // prefer not-yet-used in this session
      let candidates = pool.filter(([k]) => !usedMistakeKeysRef.current.has(k));
      if (candidates.length === 0) {
        usedMistakeKeysRef.current.clear();
        candidates = pool;
      }
      const [k, w] = candidates[Math.floor(Math.random() * candidates.length)];
      usedMistakeKeysRef.current.add(k);
      return { terms: w.terms, signs: w.signs as ("+" | "-")[], answer: w.answer };
    }
    return buildProblem(cfg.count, cfg.digits, cfg.includeSub);
  };

  const submit = async (raw: string) => {
    if (!problem) return;
    const usedMs = Date.now() - startTimeRef.current;
    let value: number;
    let correct: boolean;
    if (problem.answerStr) {
      // 乘除:按数字串精确比较(支持超大结果,不受 JS 浮点精度影响)
      const userStr = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
      if (!userStr) return;
      correct = userStr === problem.answerStr;
      value = Number(userStr);
    } else {
      const v = parseSpokenNumber(raw);
      if (v == null) return;
      value = v;
      correct = v === problem.answer;
    }
    const score = computeScore(cfg, correct);

    const mode =
      cfg.op === "mul" ? `${cfg.mode}-mul-${cfg.mulA}x${cfg.mulB}` :
      cfg.op === "div" ? `${cfg.mode}-div-${cfg.divA}_${cfg.divB}` :
      `${cfg.mode}-${cfg.count}q-${cfg.digits}d${cfg.includeSub ? "-sub" : ""}`;
    logAttempt({
      game: "flashmath",
      mode,
      terms: problem.terms,
      signs: problem.signs,
      answer: problem.answer,
      userAnswer: value,
      correct,
      usedMs,
    });

    // 「再练一次」:记录这次重练结果,回到结果页(不计入本局积分/榜单,仅作为练习记录)
    if (retryIdx != null) {
      const idx = retryIdx;
      setRetryLog((prev) => ({ ...prev, [idx]: [...(prev[idx] ?? []), { answered: value, correct }] }));
      setRetryIdx(null);
      setInput("");
      setStepIdx(0);
      setProblem(preRetryProblemRef.current); // 还原结果页原本的题
      setPhase("result");
      return;
    }

    if (mistakeMode) {
      const k = mkKey(problem.signs, problem.terms, problem.answer);
      const { justMastered } = recordMistakeAttempt("flashmath", k, correct);
      if (justMastered) {
        clearedThisSessionRef.current.push({ key: k, expr: `${gExpr(problem)} = ${problem.answerStr ?? problem.answer}` });
      }
    }

    if (correct) {
      const r = await submitScore({
        game: "flashmath",
        mode,
        value: score,
        meta: { speedMs: cfg.speedMs, D: difficultyD(cfg, usedMs) },
      });
      if (!r.ok && r.error === "未登录") {
        toast({ title: "登录后即可上榜", description: "本局成绩未保存到云端。" });
      }
    }

    const nextRound = session.round + 1;
    const record: RoundRecord = { problem, answered: value, correct, score };
    const newSession = {
      round: nextRound,
      correct: session.correct + (correct ? 1 : 0),
      totalScore: session.totalScore + score,
      history: [...session.history, record],
    };
    setSession(newSession);
    onFinished?.();

    if (nextRound < cfg.rounds) {
      const next = await loadProblem();
      if (next) {
        setProblem(next);
        setStepIdx(0);
        setInput("");
        setResult(null);
        setPhase("playing");
        return;
      }
    }
    setResult({ correct, score, answered: value });
    setPhase("result");
    // Session ended: notify about any mastered-and-cleared problems
    const cleared = clearedThisSessionRef.current;
    if (cleared.length > 0) {
      toast({
        title: "🎉 恭喜！错题已过关",
        description: `${cleared.length} 道题已连续答对 ${MASTERY_THRESHOLD} 次，从错题本中移除：\n` +
          cleared.map((c) => `· ${c.expr}`).join("\n"),
      });
      clearedThisSessionRef.current = [];
    }
  };

  const cloud = useCloudSpeech((text) => {
    const parsed = parseAnswerText(text);
    setInput(parsed || text.replace(/\D/g, "")); // 解析成数字回填;失败则保留数字部分供修改
  });

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    cloud.stop();
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    setPhase("config");
    setProblem(null);
    setInput("");
    setResult(null);
    setStepIdx(0);
    setIsReplay(false);
    setRetryIdx(null);
    setRetryLog({});
    setExpandedRows(new Set());
    setSession({ round: 0, correct: 0, totalScore: 0, history: [] });
  };

  // 结果页点「再练一次」:把该题作为全屏重练(复用倒计时→呈现→作答的流程),练完回结果页
  const startRetry = (idx: number) => {
    const rec = session.history[idx];
    if (!rec) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    // 听算重练:在点击手势内预热语音,避免倒计时后没声音
    if (cfg.mode === "listen" && typeof window !== "undefined" && window.speechSynthesis) {
      try {
        const s = window.speechSynthesis;
        s.cancel(); s.getVoices();
        const warm = new SpeechSynthesisUtterance(" ");
        warm.volume = 0; warm.lang = cfg.listenLang === "zh" ? "zh-CN" : "en-US";
        s.speak(warm);
      } catch { /* noop */ }
    }
    preRetryProblemRef.current = problem;
    setProblem(rec.problem);
    setInput("");
    setStepIdx(0);
    setRetryIdx(idx);
    setPhase("ready");
  };
  const cancelRetry = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    cloud.stop();
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    setRetryIdx(null);
    setInput("");
    setStepIdx(0);
    setProblem(preRetryProblemRef.current);
    setPhase("result");
  };
  const toggleExpand = (i: number) =>
    setExpandedRows((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const beginCountdown = async () => {
    // 听算:在用户点击(手势)内预热语音合成 —— 解锁 Chrome 自动播放限制 + 触发嗓音加载,
    // 避免倒计时后延迟调用 speak 时「没声音」或嗓音未就绪(英语读成中文)。
    if (cfg.mode === "listen" && typeof window !== "undefined" && window.speechSynthesis) {
      try {
        const s = window.speechSynthesis;
        s.cancel();
        s.getVoices();
        const warm = new SpeechSynthesisUtterance(" ");
        warm.volume = 0;
        warm.lang = cfg.listenLang === "zh" ? "zh-CN" : "en-US";
        s.speak(warm);
      } catch { /* noop */ }
    }
    usedMistakeKeysRef.current.clear();
    clearedThisSessionRef.current = [];
    const p = await loadProblem();
    if (!p) {
      toast({ title: "没有错题可以练", description: "请关闭「只练错题」开关。" });
      return;
    }
    if (mistakeMode) {
      usedMistakeKeysRef.current.add(problemKey(p.terms, p.signs, p.answer));
    }
    setProblem(p);
    setIsReplay(mistakeMode);
    setStepIdx(0);
    setInput("");
    setResult(null);
    setRetryIdx(null);
    setRetryLog({});
    setExpandedRows(new Set());
    setSession({ round: 0, correct: 0, totalScore: 0, history: [] });
    setPhase("ready");
  };


  // 3-2-1 倒计时准备(每个数字一声「叮」,开始时「叮～」)
  useEffect(() => {
    if (phase !== "ready") return;
    setCountdown(3);
    dingTick();
    let n = 3;
    const tick = () => {
      n--;
      if (n <= 0) {
        dingGo();
        setPhase("playing");
      } else {
        setCountdown(n);
        dingTick();
        timerRef.current = window.setTimeout(tick, 700);
      }
    };
    timerRef.current = window.setTimeout(tick, 700);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  // 闪算:逐笔闪现
  useEffect(() => {
    if (phase !== "playing" || !problem || cfg.mode !== "flash") return;
    if (stepIdx >= problem.terms.length) {
      startTimeRef.current = Date.now();
      setPhase("answer");
      return;
    }
    setShowTerm(true);
    const blankMs = Math.max(50, Math.min(120, cfg.speedMs * 0.15));
    const showMs = Math.max(100, cfg.speedMs - blankMs);
    timerRef.current = window.setTimeout(() => {
      setShowTerm(false);
      timerRef.current = window.setTimeout(() => setStepIdx((i) => i + 1), blankMs);
    }, showMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, stepIdx, problem, cfg.speedMs, cfg.mode]);

  // 看算:一次呈现(加减竖式 / 乘除算式)—— 直接进入作答
  useEffect(() => {
    if (phase !== "playing" || !problem || cfg.mode !== "glance") return;
    startTimeRef.current = Date.now();
    setPhase("answer");
  }, [phase, problem, cfg.mode]);

  // 听算:语音逐笔报数
  useEffect(() => {
    if (phase !== "playing" || !problem || cfg.mode !== "listen") return;
    let cancelled = false;
    setShowTerm(true);
    const perTerm = Math.max(300, cfg.listenSec);      // 每笔时间(每个数占多久,含停顿)
    const rate = Math.max(0.75, Math.min(1.5, 1150 / perTerm)); // 时间越短,语速越快
    const lang = cfg.listenLang;                        // 中文报数 / 英语听力
    const say = (n: number) => (lang === "zh" ? numberToCN(n) : numberToEN(n));
    (async () => {
      if (problem.op) {
        // 乘 / 除:整句报题,读完停 1 个「每笔时间」
        setStepIdx(0);
        const verb = lang === "zh"
          ? (problem.op === "×" ? "乘以" : "除以")
          : (problem.op === "×" ? "times" : "divided by");
        await speakTerm(`${say(problem.terms[0])} ${verb} ${say(problem.terms[1])}`, rate, lang);
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, perTerm));
      } else {
        // 加减:逐笔报数,每个数占满一个「每笔时间」(不足补停顿)
        for (let i = 0; i < problem.terms.length; i++) {
          if (cancelled) return;
          setStepIdx(i);
          const sub = problem.signs[i] === "-";
          const prefix = i === 0 ? "" : lang === "zh" ? (sub ? "减 " : "加 ") : (sub ? "minus " : "plus ");
          const t0 = Date.now();
          await speakTerm(prefix + say(problem.terms[i]), rate, lang);
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, Math.max(150, perTerm - (Date.now() - t0))));
        }
      }
      if (!cancelled) { startTimeRef.current = Date.now(); setPhase("answer"); }
    })();
    return () => { cancelled = true; window.speechSynthesis?.cancel(); };
  }, [phase, problem, cfg.mode, cfg.listenSec, cfg.listenLang]);

  const isMd = cfg.op !== "addsub"; // 乘 / 除:操作数位数配置 + 算式呈现

  if (phase === "config") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">{MODE_LABEL[cfg.mode]}{cfg.op !== "addsub" ? ` · ${OP_LABEL[cfg.op]}` : ""}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">· 训练配置</span>
          </div>
          {!isMd && onMistakeModeChange && (
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>只练错题</span>
              <Switch checked={mistakeMode} onCheckedChange={onMistakeModeChange} />
            </label>
          )}
        </div>

        {cfg.mode !== "flash" && (
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card p-2">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">运算</span>
            {opsForMode(cfg.mode).map((o) => (
              <button
                key={o}
                onClick={() => {
                  if (o !== "addsub") onMistakeModeChange?.(false); // 乘/除无错题池
                  setCfg({ ...cfg, op: o });
                }}
                className={cn(
                  "inline-flex h-7 items-center justify-center rounded-md border px-3 text-[11px] font-medium transition-colors",
                  cfg.op === o
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}
              >
                {OP_LABEL[o]}
              </button>
            ))}
          </div>
        )}

        {!isMd && mistakeMode && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-[11px] text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>「只练错题」已开启：题目将从错题池抽取，配置仅影响闪现速度。</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {cfg.op === "mul" && (
            <>
              <DigitField label="被乘数位数" value={cfg.mulA} min={1} max={10} onChange={(n) => setCfg({ ...cfg, mulA: n })} />
              <DigitField label="乘数位数" value={cfg.mulB} min={1} max={10} onChange={(n) => setCfg({ ...cfg, mulB: n })} />
            </>
          )}
          {cfg.op === "div" && (
            <>
              <DigitField label="被除数位数" value={cfg.divA} min={2} max={10} onChange={(n) => setCfg({ ...cfg, divA: n })} />
              <DigitField label="除数位数" value={cfg.divB} min={1} max={8} onChange={(n) => setCfg({ ...cfg, divB: n })} />
            </>
          )}
          {isMd && (
            <ConfigItem label="场数" hint="连续场数">
              <div className="flex flex-wrap items-center gap-1">
                {[1, 5, 10, 20, 50].map((n) => (
                  <button key={n} onClick={() => setCfg({ ...cfg, rounds: n })} className={cn("inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px] font-medium transition-colors", cfg.rounds === n ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30")}>{n}</button>
                ))}
                <NumInput value={[1, 5, 10, 20, 50].includes(cfg.rounds) ? null : cfg.rounds} onChange={(n) => setCfg({ ...cfg, rounds: n })} min={1} max={200} suffix="场" />
              </div>
            </ConfigItem>
          )}
          {cfg.mode === "listen" && (
          <ConfigItem label="每笔时间" hint="每个数报多久(含停顿)">
            <div className="flex flex-wrap items-center gap-1">
              {[
                { label: "0.6秒", value: 600 },
                { label: "0.8秒", value: 800 },
                { label: "1秒", value: 1000 },
                { label: "1.5秒", value: 1500 },
                { label: "2秒", value: 2000 },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setCfg({ ...cfg, listenSec: t.value })}
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                    cfg.listenSec === t.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  {t.label}
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground">或</span>
              <SecInput value={[600,800,1000,1500,2000].includes(cfg.listenSec) ? null : cfg.listenSec} onChange={(n) => setCfg({ ...cfg, listenSec: n })} min={300} max={6000} />
            </div>
          </ConfigItem>
          )}
          {cfg.mode === "listen" && (
          <ConfigItem label="听力语言" hint="中文报数 / 英语听力">
            <div className="flex items-center gap-1.5">
              <Pill active={cfg.listenLang === "zh"} onClick={() => setCfg({ ...cfg, listenLang: "zh" })}>中文</Pill>
              <Pill active={cfg.listenLang === "en"} onClick={() => setCfg({ ...cfg, listenLang: "en" })}>English</Pill>
            </div>
          </ConfigItem>
          )}
          {!isMd && (<>
          <ConfigItem label="笔数" hint="1 – 200">
            <div className="flex flex-wrap items-center gap-1">
              {[5, 10, 15, 20, 30].map((n) => (
                <button
                  key={n}
                  onClick={() => setCfg({ ...cfg, count: n })}
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                    cfg.count === n
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  {n}笔
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground">或</span>
              <NumInput value={[5,10,15,20,30].includes(cfg.count) ? null : cfg.count} onChange={(n) => setCfg({ ...cfg, count: n })} min={1} max={200} suffix="笔" />
            </div>
          </ConfigItem>
          <ConfigItem label="位数" hint="1 – 7 位">
            <div className="flex flex-wrap items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setCfg({ ...cfg, digits: n })}
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                    cfg.digits === n
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  {n}位
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground">或</span>
              <NumInput value={[1,2,3,4,5].includes(cfg.digits) ? null : cfg.digits} onChange={(n) => setCfg({ ...cfg, digits: n })} min={1} max={7} suffix="位" />
            </div>
          </ConfigItem>
          {cfg.mode === "flash" && (
          <ConfigItem label="单笔时间" hint="0.15 – 5 秒">
            <div className="flex flex-wrap items-center gap-1">
              {[
                { label: "0.1秒", value: 100 },
                { label: "0.3秒", value: 300 },
                { label: "0.5秒", value: 500 },
                { label: "1秒", value: 1000 },
                { label: "1.5秒", value: 1500 },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setCfg({ ...cfg, speedMs: t.value })}
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                    cfg.speedMs === t.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  {t.label}
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground">或</span>
              <SecInput value={[100,300,500,1000,1500].includes(cfg.speedMs) ? null : cfg.speedMs} onChange={(n) => setCfg({ ...cfg, speedMs: n })} min={150} max={5000} />
            </div>
          </ConfigItem>
          )}
          {cfg.mode === "glance" && cfg.op === "addsub" && (
          <ConfigItem label="看算" hint="整列同时呈现">
            <div className="text-[11px] leading-relaxed text-muted-foreground">竖式一次性显示,看清后直接口算填答案。</div>
          </ConfigItem>
          )}
          <ConfigItem label="减法 / 场数" hint="减号 + 连续场数">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="w-10 shrink-0 text-[10px] text-muted-foreground">减法</span>
                <Pill active={!cfg.includeSub} onClick={() => setCfg({ ...cfg, includeSub: false })}>无</Pill>
                <Pill active={cfg.includeSub} onClick={() => setCfg({ ...cfg, includeSub: true })}>有</Pill>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="mt-1.5 w-10 shrink-0 text-[10px] text-muted-foreground">场数</span>
                <div className="flex flex-wrap items-center gap-1">
                  {[1, 5, 10, 20, 50].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCfg({ ...cfg, rounds: n })}
                      className={cn(
                        "inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px] font-medium transition-colors",
                        cfg.rounds === n
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  <NumInput value={[1,5,10,20,50].includes(cfg.rounds) ? null : cfg.rounds} onChange={(n) => setCfg({ ...cfg, rounds: n })} min={1} max={200} suffix="场" />
                </div>
              </div>
            </div>
          </ConfigItem>
          </>)}
        </div>


        <Button onClick={beginCountdown} size="lg" className="h-12 text-base font-semibold">
          <Play className="mr-2 h-5 w-5" /> 开始挑战
        </Button>

        <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>本配置答对一题可获</span>
            <span className="font-mono-tabular text-sm font-semibold text-primary">{previewScore(cfg)} 分</span>
          </div>
          {!isMd && (
          <div className="mt-0.5 text-[10px]">
            积分 = 笔数 × 位数权重(1/1.4/2/2.8/3.8/5/6.5) × 速度系数(1000/ms) × 减法系数(1.3)
          </div>
          )}
        </div>
      </div>
    );
  }

  // ── 出题大屏(接近整屏):ready / playing / answer / result ──
  const showColumn = cfg.mode === "glance" && cfg.op === "addsub"; // 看算·加减:竖式整列
  const showExpr = cfg.mode === "glance" && cfg.op !== "addsub";   // 看算·乘除:算式 a × b
  const opLabel = cfg.op !== "addsub" ? ` · ${OP_LABEL[cfg.op]}` : "";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto text-white"
      style={{ background: "radial-gradient(120% 90% at 50% 25%, #3a2513 0%, #1c1108 55%, #0e0803 100%)" }}
    >
      <div className="flex shrink-0 items-center justify-between px-5 py-3">
        <span className="text-sm font-bold text-white/90">
          {MODE_LABEL[cfg.mode]}{opLabel}
          {retryIdx != null
            ? <span className="ml-2 text-[hsl(28_95%_62%)]">· 再练一次</span>
            : cfg.rounds > 1 && <span className="ml-2 text-white/55">第 {session.round + 1} / {cfg.rounds} 场</span>}
        </span>
        <button onClick={retryIdx != null ? cancelRetry : reset} className="rounded-full border border-white/25 px-3 py-1 text-xs text-white/80 transition-colors hover:bg-white/10">✕ {retryIdx != null ? "返回结果" : "退出"}</button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10">
        {phase === "ready" && (
          <div className="flex flex-col items-center">
            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-white/55">准备</div>
            <div key={countdown} className="animate-pop-in font-mono-tabular font-bold text-white" style={{ fontSize: "clamp(6rem,22vw,15rem)", lineHeight: 1 }}>{countdown}</div>
          </div>
        )}

        {phase === "playing" && problem && cfg.mode === "flash" && (
          <div className="flex w-full max-w-5xl flex-col items-center gap-6">
            <div className="h-1 w-full max-w-3xl overflow-hidden rounded bg-white/15">
              <div className="h-full bg-[hsl(28_95%_58%)] transition-all duration-100" style={{ width: `${((Math.min(stepIdx, problem.terms.length - 1) + 1) / problem.terms.length) * 100}%` }} />
            </div>
            <div className="flex min-h-[44vh] items-center justify-center">
              {showTerm && stepIdx < problem.terms.length ? (
                <div key={stepIdx} className="flex items-center gap-5">
                  {problem.signs[stepIdx] === "-" && <Minus style={{ width: "clamp(3rem,8vw,6.5rem)", height: "clamp(3rem,8vw,6.5rem)" }} className="text-[hsl(20_90%_62%)]" strokeWidth={3} />}
                  <span className="font-mono-tabular font-bold leading-none text-white" style={{ fontSize: "clamp(5rem,22vw,15rem)" }}>{problem.terms[stepIdx]}</span>
                </div>
              ) : (
                <div className="h-3 w-3 rounded-full bg-white/25" />
              )}
            </div>
            <div className="font-mono-tabular text-sm text-white/50">{Math.min(stepIdx + 1, problem.terms.length)} / {problem.terms.length} · {cfg.speedMs}ms</div>
          </div>
        )}

        {phase === "playing" && problem && cfg.mode === "listen" && (
          <div className="flex flex-col items-center gap-6 text-white">
            <div className={cn("select-none", showTerm && "animate-bounce")} style={{ fontSize: "clamp(5rem,16vw,9rem)" }}>🔊</div>
            <p className="text-lg font-semibold text-white/90">
              {problem.op ? "正在报题，用心算～" : `正在报第 ${Math.min(stepIdx + 1, problem.terms.length)} / ${problem.terms.length} 笔，用心算～`}
            </p>
            <div className="h-1 w-64 overflow-hidden rounded bg-white/15">
              <div className="h-full bg-[hsl(28_95%_58%)] transition-all" style={{ width: `${problem.op ? 100 : ((stepIdx + 1) / problem.terms.length) * 100}%` }} />
            </div>
          </div>
        )}

        {phase === "answer" && problem && (
          <div className={cn("flex w-full flex-col items-center gap-5", showColumn ? "max-w-4xl" : showExpr ? "max-w-xl" : "max-w-md")}>
            {showColumn && <GlanceStack terms={problem.terms} signs={problem.signs} />}
            {showExpr && problem.op && (
              <FitBox dep={`${problem.terms[0]}${problem.op}${problem.terms[1]}`} heightVh={46}>
                <div className="whitespace-nowrap rounded-2xl bg-white/95 px-12 py-8 font-mono-tabular font-bold text-foreground shadow-2xl" style={{ fontSize: "5rem" }}>
                  {problem.terms[0]} <span className="text-primary">{problem.op}</span> {problem.terms[1]}
                </div>
              </FitBox>
            )}
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">{showColumn ? "看清竖式,填答案" : showExpr ? "算出结果,填答案" : "输入答案"}</div>
            <Input
              autoFocus
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input.trim() && submit(input)}
              placeholder="点下方数字键 / 键盘输入 / 语音"
              className="h-16 w-full rounded-xl border-white/30 bg-white text-center font-mono-tabular text-3xl text-foreground"
            />
            {cloud.recording && (
              <div className="text-center text-xs text-red-200">🎙️ 录音中,说出答案后点「结束」…</div>
            )}
            {cloud.busy && (
              <div className="text-center text-xs text-white/70">识别中…</div>
            )}
            {/* 屏幕数字键盘:任何设备/网络都能稳定输入,不依赖麦克风或物理键盘 */}
            <div className="grid w-full grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  onClick={() => setInput((v) => v + d)}
                  className="h-14 rounded-xl border border-white/25 bg-white/10 font-mono-tabular text-2xl font-semibold text-white transition-colors hover:bg-white/20 active:bg-white/30"
                >
                  {d}
                </button>
              ))}
              <button onClick={() => setInput((v) => v.slice(0, -1))} className="h-14 rounded-xl border border-white/25 bg-white/10 text-xl text-white transition-colors hover:bg-white/20 active:bg-white/30" aria-label="删除">⌫</button>
              <button onClick={() => setInput((v) => v + "0")} className="h-14 rounded-xl border border-white/25 bg-white/10 font-mono-tabular text-2xl font-semibold text-white transition-colors hover:bg-white/20 active:bg-white/30">0</button>
              <button onClick={() => setInput("")} className="h-14 rounded-xl border border-white/25 bg-white/10 text-sm text-white transition-colors hover:bg-white/20 active:bg-white/30">清空</button>
            </div>
            <div className="flex w-full gap-2">
              {cloud.supported && (
                <Button
                  variant="outline"
                  disabled={cloud.busy}
                  onClick={() => (cloud.recording ? cloud.stop() : cloud.start(cfg.mode === "listen" && cfg.listenLang === "en" ? "en" : "zh"))}
                  className={cn(
                    "flex-1 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white",
                    cloud.recording && "border-red-400/70 text-red-200 hover:text-red-200",
                  )}
                >
                  {cloud.busy ? "识别中…"
                    : cloud.recording ? (<><MicOff className="mr-1.5 h-3.5 w-3.5 animate-pulse" /> 结束</>)
                    : (<><Mic className="mr-1.5 h-3.5 w-3.5" /> 语音作答</>)}
                </Button>
              )}
              <Button onClick={() => submit(input)} disabled={!input.trim()} className="flex-1">提交</Button>
            </div>
            {cfg.mode === "listen" && (
              <button onClick={() => { setStepIdx(0); setPhase("playing"); }} className="text-xs text-white/70 underline-offset-2 hover:underline">再听一遍</button>
            )}
          </div>
        )}

        {phase === "result" && problem && result && (
          <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl bg-card p-5 text-foreground shadow-2xl animate-slide-up">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full border-2",
            result.correct
              ? "border-primary bg-primary/5 text-primary"
              : "border-destructive bg-destructive/5 text-destructive",
          )}
        >
          {result.correct ? <Check className="h-7 w-7" strokeWidth={2.5} /> : <X className="h-7 w-7" strokeWidth={2.5} />}
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {result.correct ? "正确" : "错误"}
          </div>
          <div className="mt-0.5 font-mono-tabular text-5xl font-semibold text-foreground">
            {result.correct ? `+${result.score}` : "0"}
          </div>
          <div className="text-[11px] text-muted-foreground">分</div>
        </div>
        {cfg.rounds > 1 && (
          <div className="w-full rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">本轮 {cfg.rounds} 场总计</div>
            <div className="mt-1 flex items-center justify-center gap-4 font-mono-tabular">
              <div className="text-center">
                <div className="text-xl font-semibold text-foreground">{session.correct} / {cfg.rounds}</div>
                <div className="text-[10px] text-muted-foreground">正确</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-xl font-semibold text-primary">{session.totalScore}</div>
                <div className="text-[10px] text-muted-foreground">总分</div>
              </div>
            </div>
            <div className="mt-3 max-h-60 overflow-y-auto rounded-md border border-border bg-card">
              <table className="w-full font-mono-tabular text-[11px]">
                <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">#</th>
                    <th className="px-2 py-1 text-left font-medium">算式</th>
                    <th className="px-2 py-1 text-right font-medium">答案</th>
                    <th className="px-2 py-1 text-right font-medium">你的</th>
                    <th className="px-2 py-1 text-right font-medium">得分</th>
                    <th className="px-2 py-1 text-center font-medium">再练</th>
                  </tr>
                </thead>
                <tbody>
                  {session.history.map((r, i) => {
                    const retries = retryLog[i] ?? [];
                    const last = retries[retries.length - 1];
                    const expanded = expandedRows.has(i);
                    return (
                      <Fragment key={i}>
                        <tr className={cn("border-t border-border", r.correct ? "" : "bg-destructive/5")}>
                          <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-1 break-words">{gExpr(r.problem)}</td>
                          <td className="px-2 py-1 text-right">{r.problem.answerStr ?? r.problem.answer}</td>
                          <td className={cn("px-2 py-1 text-right", r.correct ? "text-primary" : "text-destructive")}>{r.answered}</td>
                          <td className="px-2 py-1 text-right text-muted-foreground">{r.score}</td>
                          <td className="px-2 py-1 text-center whitespace-nowrap">
                            {r.correct ? (
                              <span className="text-muted-foreground/40">—</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                {last && (
                                  <button onClick={() => toggleExpand(i)} title="展开重练记录"
                                    className={cn("inline-flex items-center rounded px-0.5", last.correct ? "text-primary" : "text-destructive")}>
                                    {last.correct ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <X className="h-3.5 w-3.5" strokeWidth={2.5} />}
                                    {retries.length > 1 && <span className="ml-0.5 text-[9px]">×{retries.length}</span>}
                                  </button>
                                )}
                                <button onClick={() => startRetry(i)}
                                  className="inline-flex items-center gap-0.5 rounded border border-primary/40 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10">
                                  <RotateCcw className="h-3 w-3" /> 再练
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {expanded && retries.length > 0 && (
                          <tr className="bg-muted/30">
                            <td colSpan={6} className="px-3 py-1.5">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                                <span className="font-medium text-foreground/70">重练记录</span>
                                {retries.map((a, k) => (
                                  <span key={k} className={cn("inline-flex items-center gap-0.5", a.correct ? "text-primary" : "text-destructive")}>
                                    第{k + 1}次 · 你的 {a.answered} {a.correct ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="w-full rounded-md border border-border p-3 text-center">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">正确答案</div>
          <div className="my-0.5 font-mono-tabular text-2xl font-semibold">{problem.answerStr ?? problem.answer}</div>
          {!result.correct && (
            <div className="text-[11px] text-muted-foreground">
              你的回答 <span className="font-mono-tabular font-medium text-destructive">{result.answered}</span>
            </div>
          )}
          <div className="mt-2 border-t border-border pt-2 font-mono-tabular text-sm text-muted-foreground break-words leading-relaxed">
            {gExpr(problem)}{" = "}{problem.answerStr ?? problem.answer}
          </div>
        </div>
        {cfg.rounds === 1 && !result.correct && (
          <div className="w-full rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-foreground/80">答错了?原题再练一次</span>
              <Button size="sm" variant="outline" onClick={() => startRetry(0)} className="h-7 px-2 text-[11px]">
                <RotateCcw className="mr-1 h-3 w-3" /> 再练一次
              </Button>
            </div>
            {(retryLog[0]?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-primary/20 pt-2 text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground/70">重练记录</span>
                {(retryLog[0] ?? []).map((a, k) => (
                  <span key={k} className={cn("inline-flex items-center gap-0.5", a.correct ? "text-primary" : "text-destructive")}>
                    第{k + 1}次 · 你的 {a.answered} {a.correct ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex w-full gap-2">
          <Button variant="outline" onClick={reset} className="flex-1" size="sm">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" /> 改配置
          </Button>
          <Button onClick={beginCountdown} className="flex-1" size="sm">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 再来
          </Button>
        </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// 算式文本(用于结果/记录回顾):加减显式带 + / − 号,避免加号被渲染成空格导致「37」和「3+7」混淆;乘除用 a × b
function gExpr(p: GProblem): string {
  if (p.op) return `${p.terms[0]} ${p.op} ${p.terms[1]}`;
  return p.terms
    .map((t, i) => (i === 0 ? (p.signs[i] === "-" ? `−${t}` : `${t}`) : p.signs[i] === "-" ? ` − ${t}` : ` + ${t}`))
    .join("");
}

// 通用自适应容器:测量内容,整体缩放以在给定高度的盒子内单行/单列完整显示,不换行不滚动。
function FitBox({ children, dep, heightVh = 46 }: { children: React.ReactNode; dep?: unknown; heightVh?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current, card = cardRef.current;
      if (!box || !card) return;
      const w = card.offsetWidth, h = card.offsetHeight;
      if (!w || !h) return;
      const s = Math.min(box.clientWidth / w, box.clientHeight / h, 3);
      setFit(s > 0.05 ? s : 0.05);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [dep, heightVh]);
  return (
    <div ref={boxRef} className="flex w-full items-center justify-center overflow-hidden" style={{ height: `${heightVh}vh` }}>
      <div style={{ transform: `scale(${fit})`, transformOrigin: "center" }}>
        <div ref={cardRef}>{children}</div>
      </div>
    </div>
  );
}

// 看算竖式:整屏自适应(超出时自动分栏 + 整体缩放,保证一屏内完整显示,不滚动)+ 字号微调
function GlanceStack({ terms, signs }: { terms: number[]; signs: string[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [userScale, setUserScale] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const v = Number(window.localStorage.getItem("glance:scale"));
    return v >= 0.5 && v <= 1 ? v : 1;
  });
  const [fit, setFit] = useState(1);

  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current, card = cardRef.current;
      if (!box || !card) return;
      const w = card.offsetWidth, h = card.offsetHeight;
      if (!w || !h) return;
      const s = Math.min(box.clientWidth / w, box.clientHeight / h, 3);
      setFit(s > 0.05 ? s : 0.05);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [terms]);

  useEffect(() => { try { window.localStorage.setItem("glance:scale", String(userScale)); } catch { /* noop */ } }, [userScale]);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div ref={boxRef} className="flex w-full items-center justify-center overflow-hidden" style={{ height: "58vh" }}>
        <div style={{ transform: `scale(${fit * userScale})`, transformOrigin: "center" }}>
          <div ref={cardRef} className="rounded-2xl bg-white/95 px-10 py-6 shadow-2xl">
            {/* 一整列竖排;放不下就整体缩小,始终单列一屏 */}
            <div className="flex flex-col items-end gap-y-1 font-mono-tabular text-3xl font-bold leading-tight text-foreground">
              {terms.map((t, i) => (
                <div key={i} className="whitespace-nowrap">
                  <span className="mr-2 inline-block text-center text-primary" style={{ width: "0.7em" }}>{signs[i] === "-" ? "−" : ""}</span>{t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-white/75">
        <span className="text-xs">字号</span>
        <button onClick={() => setUserScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2)))} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/25 text-lg leading-none hover:bg-white/10">−</button>
        <button onClick={() => setUserScale((s) => Math.min(1, +(s + 0.1).toFixed(2)))} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/25 text-lg leading-none hover:bg-white/10">+</button>
      </div>
    </div>
  );
}

function DigitField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const presets: number[] = [];
  for (let i = min; i <= Math.min(max, min + 4); i++) presets.push(i); // 几个固定选择
  return (
    <ConfigItem label={label} hint={`${min} – ${max} 位`}>
      <div className="flex flex-wrap items-center gap-1">
        {presets.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              "inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
              value === n
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
            )}
          >
            {n}位
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground">或</span>
        <NumInput value={presets.includes(value) ? null : value} onChange={onChange} min={min} max={max} suffix="位" />
      </div>
    </ConfigItem>
  );
}

function ConfigItem({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
