import { siteUrl, softKey } from "@/lib/appEnv";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { submitScore } from "@/lib/leaderboard";
import { buildProblem, type Problem } from "@/lib/flashMath";
import { generateMultiply, generateDivide } from "@/lib/abacus";
import { genProblem as genHwProblem, DEFAULT_ITEM as HW_DEFAULT_ITEM, answerText, parseRemAnswer, REM_SEP } from "@/lib/homework";
import { difficultyD, modePrefix } from "@/lib/difficulty";
import { getProjectRanks } from "@/lib/leaderboard";
import { supabase } from "@/integrations/supabase/client";
import { dingTick, dingGo } from "@/lib/beep";

import { COACH_STAGES, generateCoachProblem, loadCoachProgress, recordCoachResult, setCoachStage, stageWindow, recordClassOutcome, classesOfProblem, mergeCloudCoachProgress, type CoachProgress, type FingeringClass } from "@/lib/fingering";
import { getAdvice, recordAdvisorResult, dismissAdvice, type AdvisorCfg } from "@/lib/advisor";

type MDOp = "×" | "÷";
// answerStr:乘除的精确答案(大数用 BigInt 求得,避免超出 JS 安全整数导致算错)
// classes:AI 陪练题每一笔的指法类别(按拨珠状态判定),结果页分笔归因用
// places:小数题——答案按保留位数四舍五入,作答按数值比较;rem:不够除·无小数——answer=整数商,作答「商余余数」
type GProblem = Problem & { op?: MDOp; answerStr?: string; classes?: FingeringClass[]; places?: number; rem?: number };
import { parseSpokenNumber } from "@/lib/parseSpokenNumber";
import { Mic, MicOff, Play, RotateCcw, Settings2, Check, X, Minus, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logAttempt, fetchWrongAttempts, fetchCoachSeq } from "@/lib/practiceLog";
import { loadBank, bankReady, speakTokens, numberTokens, termBankTokens, listenSpeedFactor, tierFor, getBankVariant, setBankVariant, voicePlaybackRate, type BankVariant, type BankVoice } from "@/lib/ttsBank";
import { Row, Seg, Num, Pair } from "@/components/HwItemEditor";
import Soroban from "@/components/games/Soroban";
import { useTx } from "@/lib/tx";
import { useEyeCare, EYE_CARE_STAGE_BG } from "@/lib/eyeCare";
import { useI18n } from "@/lib/i18n";
import { getLang } from "@/lib/langState";
import { getPraiseOn, setPraiseOn, getFxOn, setFxOn, pickPraise, praiseEmoji, praiseText, preloadPraise, playPraise, stopPraise, chime } from "@/lib/praise";
import { PraiseBurst } from "@/components/PraiseBurst";
import { CoachPanel } from "@/components/CoachPanel";
import { useAuth } from "@/hooks/useAuth";
import { recordMistakeAttempt, masteredSet, problemKey as mkKey, MASTERY_THRESHOLD } from "@/lib/mistakeMastery";

type Phase = "config" | "ready" | "prep" | "playing" | "answer" | "result";

export type FlashMode = "flash" | "glance" | "listen"; // 呈现方式
export type OpType = "addsub" | "mul" | "div";         // 运算类型

export interface FlashCfg {
  mode: FlashMode; // 闪算(逐笔闪现) / 看算(整屏竖式) / 听算(语音报题)
  op: OpType;      // 加减 / 乘 / 除 —— 闪算恒为加减;看算、听算三选一
  count: number;
  digits: number;    // 加减:最小位数
  digitsMax: number; // 加减:最大位数(> digits 时混合位数,均匀分布)
  speedMs: number; // 闪算单笔时间
  flashScale: number; // 闪算:闪现数字字号倍数(0.5–1.6),滑块可调,自动记忆
  method: "mental" | "bead"; // 计算方法(2026-10-14):bead=每笔显示珠码(心算导入)
  listenSec: number; // 听算:每两笔数之间的间隔(ms)
  listenSpeed: number; // 听算:速度档 1–10(参考「报题速度」)——按速度衡量,位数越多读得越久是自然的
  announcePlus: boolean; // 听算:报加号(是=念「加」;否=加法只念数字,减法仍念「减」)
  announceUnit: boolean; // 听算:报数位(是=整读带单位「二千三百四十五」;否=逐位读「二三四五」)
  listenLang: "zh" | "en"; // 听算:中文报数 / 英语听力
  listenVoice: "female" | "male" | "child"; // 听算音色:女声/男声/童声
  glanceLimitSec: number; // 看算:每题限时(秒);0 = 不限时
  includeSub: boolean;
  rounds: number;
  mulA: number; // 乘法:被乘数位数
  mulB: number; // 乘法:乘数位数
  divD: number; // 除法:除数位数(难度只看除数与商,与被除数无关)
  divQ: number; // 除法:商位数
  // 2026-10-19 与教练端同步(用户「广场看算的乘除还没有小数点」):够除/不够除 + 小数,出题直接复用作业出题器
  divEnough: "any" | "yes" | "no"; // 除法:两者均可/够除(整除)/不够除(除不尽:无小数答「商……余数」,有小数按 decimalPlaces 四舍五入)
  decimals: boolean;               // 看算乘除:带小数
  decimalPlaces: number;           // 保留位数 0–4
}

const MODE_LABEL: Record<FlashMode, string> = { flash: "闪电心算", glance: "看算", listen: "听算" };
const OP_LABEL: Record<OpType, string> = { addsub: "加减", mul: "乘法", div: "除法" };
// 闪算只支持加减;看算、听算支持全部运算
const opsForMode = (m: FlashMode): OpType[] => (m === "flash" ? ["addsub"] : ["addsub", "mul", "div"]);
const DEFAULT_CFG: FlashCfg = { mode: "flash", op: "addsub", count: 5, digits: 2, digitsMax: 2, speedMs: 700, flashScale: 0.6, method: "mental", listenSec: 800, listenSpeed: 5, announcePlus: true, announceUnit: true, listenLang: "zh", listenVoice: "female", glanceLimitSec: 0, includeSub: false, rounds: 1, mulA: 2, mulB: 2, divD: 1, divQ: 3, divEnough: "any", decimals: false, decimalPlaces: 2 };
// 听算速度档(1–10)→ 语音 rate:档1≈0.6(慢)… 档10≈2.3(很快);1↔10 差距更大、快端更快
const speedToRate = (lvl: number) => Math.max(0.5, Math.min(3.5, 0.6 + (lvl - 1) * (2.4 / 9)));

// 听算目标语速:中速(档5)=1.0 正常语速;慢档更慢、快档才快。
// 档1≈0.6,档5=1.0(正常),档10=4.0(极速报数)。两侧斜率不同(1.0 以下空间小)。
// 2026-09-21 付海东两轮「还不够快」→ 快侧斜率 0.36→0.45→0.6,词块库速度档加到 4.0×。
const ttsSpeedFor = listenSpeedFactor; // 速度档曲线统一在 ttsBank(2026-10-24 改为 5→10 等比)

// 听算:把一道题拼成一整段报题文本(云端一次合成);数与数之间停顿用标点近似
function buildListenText(problem: GProblem, cfg: FlashCfg): string {
  const lang = cfg.listenLang;
  const say = (n: number) =>
    cfg.announceUnit
      ? (lang === "zh" ? numberToCN(n) : numberToEN(n))
      : String(Math.abs(n)).split("").map((d) => (lang === "zh" ? "零一二三四五六七八九"[+d] : d)).join(" ");
  if (problem.op) {
    const verb = lang === "zh" ? (problem.op === "×" ? "乘以" : "除以") : (problem.op === "×" ? "times" : "divided by");
    return `${say(problem.terms[0])} ${verb} ${say(problem.terms[1])}`;
  }
  // 高速档播放端要 ~2x 倍速,停顿会被同比压缩 —— 按目标倍速放大「选标点用的间隔」,倍速后气口仍在
  const gap = cfg.listenSec * Math.max(1, ttsSpeedFor(cfg.listenSpeed));
  const sep = lang === "zh"
    ? (gap <= 150 ? "、" : gap <= 550 ? "," : gap <= 1100 ? "。" : "。。")
    : (gap <= 150 ? ", " : gap <= 700 ? ". " : ".. ");
  let t = say(problem.terms[0]);
  for (let i = 1; i < problem.terms.length; i++) {
    const sub = problem.signs[i] === "-";
    const word = sub ? (lang === "zh" ? "减" : "minus") : (cfg.announcePlus ? (lang === "zh" ? "加" : "plus") : "");
    t += sep + (word ? word + " " : "") + say(problem.terms[i]);
  }
  return t;
}

// 调用云端 TTS 合成 MP3,返回可播放的对象 URL(失败抛错,由调用方回退浏览器语音)
// 音频恒按 1.0 语速合成(母语播音),播放速度由 <audio>.playbackRate 控制 —— 切速度档不必重新合成。
type TtsPace = "slow" | "normal" | "fast";
// 档位→合成端语速档:1-3 慢速合成,4-6 正常,7-10 让模型读快(前端只做小倍率微调,音质不毛糙)
const paceFor = (listenSpeed: number): TtsPace => (listenSpeed <= 3 ? "slow" : listenSpeed <= 6 ? "normal" : "fast");
// 实测 gpt-4o-mini-tts 不吃语速指令(fast 措辞反而略放慢换清晰),合成端不再抵扣倍速;
// fast 档仅保留「吐字利落、数字间留停顿」的措辞 —— 源头更干净,高倍速压缩后不粘连。
const PACE_FACTOR: Record<TtsPace, number> = { slow: 1.0, normal: 1.0, fast: 1.0 };
async function fetchTTS(text: string, lang: "zh" | "en", voiceType: "female" | "male" | "child", pace: TtsPace): Promise<string> {
  // 2026-11-25 付海东截图「正在准备语音…」一直转:云端合成没有超时,国内链路挂住就永远不回。25 秒没回就当失败,落到浏览器语音。
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 25_000);
  const res = await fetch(siteUrl("/.netlify/functions/tts"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, lang, voiceType, pace }),
    signal: ctl.signal,
  }).finally(() => clearTimeout(tm));
  if (!res.ok) throw new Error("tts-unavailable");
  const blob = await res.blob();
  if (!blob.size) throw new Error("tts-empty");
  return URL.createObjectURL(blob);
}

// 极短静音 WAV(用户手势内播它来"解锁"音频元素,规避自动播放限制)
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export const FLASH_CHALLENGE_EVENT = "flash:challenge";

// 从榜单记录的 mode(+ speedMs)还原出一份训练配置(用于"挑战TA");挑战恒为单局 rounds=1
function modeToCfg(mode: string, speedMs?: number): FlashCfg {
  const base: FlashCfg = { ...DEFAULT_CFG, rounds: 1 };
  base.mode = mode.startsWith("glance") ? "glance" : mode.startsWith("listen") ? "listen" : "flash";
  if (speedMs) base.speedMs = speedMs;
  const mul = mode.match(/mul-(\d+)x(\d+)/);
  const div = mode.match(/div-(\d+)d(\d+)q/); // 新格式:除数d商q
  const divOld = mode.match(/div-(\d+)_(\d+)/); // 旧格式:被除数_除数 → 换算
  const add = mode.match(/(\d+)q-(\d+)(?:_(\d+))?d/); // 位数支持 定长(Xd)或区间(X_Yd)
  if (mul) { base.op = "mul"; base.mulA = +mul[1]; base.mulB = +mul[2]; }
  else if (div) { base.op = "div"; base.divD = +div[1]; base.divQ = +div[2]; }
  else if (divOld) { base.op = "div"; base.divD = +divOld[2]; base.divQ = Math.max(1, +divOld[1] - +divOld[2] + 1); }
  const nd = /-nd/.test(mode), dec = mode.match(/-dec(\d)/);
  if (nd && base.op === "div") base.divEnough = "no";
  if (dec && base.op !== "addsub") { base.decimals = true; base.decimalPlaces = +dec[1]; }
  if (add && !mul && !div && !divOld) { base.op = "addsub"; base.count = +add[1]; base.digits = +add[2]; base.digitsMax = add[3] ? +add[3] : +add[2]; base.includeSub = mode.includes("-sub"); }
  return base;
}

// 挑战弹窗里的小步进器
function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const btn = "flex h-6 w-6 items-center justify-center rounded-md border border-border text-sm leading-none text-foreground transition-colors hover:bg-muted disabled:opacity-40";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <button className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <span className="w-8 text-center font-mono-tabular text-sm font-semibold text-foreground">{value}</span>
        <button className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

// 加减号步进器核心(中间可直接输入:聚焦自由输入、失焦/回车校验并夹取)
function NumStepper({ value, min, max, step = 1, decimals = 0, suffix, onChange }: {
  value: number; min: number; max: number; step?: number; decimals?: number; suffix?: string; onChange: (v: number) => void;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const clamp = (v: number) => Math.min(max, Math.max(min, decimals ? v : Math.round(v)));
  const disp = decimals ? value.toFixed(decimals) : String(value);
  const commit = (raw: string) => { const v = Number(raw); if (!Number.isNaN(v) && raw.trim() !== "") onChange(clamp(v)); };
  const btn = "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-lg leading-none text-foreground transition-colors hover:bg-muted disabled:opacity-40";
  return (
    <div className="flex items-center justify-center gap-1.5">
      <button className={btn} disabled={value <= min} onClick={() => onChange(clamp(+(value - step).toFixed(4)))}>−</button>
      <input
        inputMode="decimal"
        value={focused ? text : disp}
        onFocus={() => { setFocused(true); setText(disp); }}
        onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={() => { setFocused(false); commit(text); }}
        onKeyDown={(e) => { if (e.key === "Enter") { commit(text); (e.currentTarget as HTMLInputElement).blur(); } }}
        className="h-9 w-14 rounded-md border border-input bg-background text-center font-mono-tabular text-sm font-semibold outline-none focus:border-primary"
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      <button className={btn} disabled={value >= max} onClick={() => onChange(clamp(+(value + step).toFixed(4)))}>+</button>
    </div>
  );
}

// 配置块 = 标签 + 步进器
function EditStepper(props: { label: string; hint?: string; value: number; min: number; max: number; step?: number; decimals?: number; suffix?: string; onChange: (v: number) => void }) {
  const { label, hint, ...rest } = props;
  return <ConfigItem label={label} hint={hint}><NumStepper {...rest} /></ConfigItem>;
}

/** 乘除小数只在看算开(听算报小数没有词块);闪算恒为加减 */
const mdDecimals = (c: FlashCfg) => c.mode === "glance" && c.op !== "addsub" && c.decimals;
/** 榜单/日志 mode 后缀:不够除 -ndN、小数 -decN(挑战TA 能还原;榜单前缀不变) */
const mdSuffix = (c: FlashCfg) => (c.op === "div" && c.divEnough === "no" ? "-nd" : "") + (mdDecimals(c) ? `-dec${c.decimalPlaces}` : "");

// 一句话描述配置(挑战弹窗里给用户看)
function describeCfg(c: FlashCfg): string {
  if (getLang() === "en") return describeCfgEn(c);
  const m = MODE_LABEL[c.mode];
  const dz = mdDecimals(c) ? ` · 小数·保留${c.decimalPlaces}位` : "";
  if (c.op === "mul") return `${m} · 乘法 ${c.mulA}位 × ${c.mulB}位${dz}`;
  if (c.op === "div") return `${m} · 除法 除数${c.divD}位 · 商${c.divQ}位${c.divEnough === "no" ? (mdDecimals(c) ? " · 不够除" : " · 不够除·带余数") : c.divEnough === "yes" ? " · 够除" : ""}${dz}`;
  const digitsLabel = c.digitsMax > c.digits ? `${c.digits}-${c.digitsMax}位` : `${c.digits}位`;
  const parts = [`${c.count}笔`, digitsLabel];
  if (c.mode === "flash") parts.push(`${+(c.speedMs / 1000).toFixed(3)}秒/笔`);
  parts.push(c.includeSub ? "加减混合" : "纯加");
  return `${m} · ${parts.join(" · ")}`;
}

const MODE_LABEL_EN: Record<FlashMode, string> = { flash: "Flash Math", glance: "Glance", listen: "Listen" };
function describeCfgEn(c: FlashCfg): string {
  const m = MODE_LABEL_EN[c.mode];
  const dz = mdDecimals(c) ? ` · decimals, round to ${c.decimalPlaces}` : "";
  if (c.op === "mul") return `${m} · Multiply ${c.mulA}-digit × ${c.mulB}-digit${dz}`;
  if (c.op === "div") return `${m} · Divide ${c.divD}-digit divisor · ${c.divQ}-digit quotient${c.divEnough === "no" ? (mdDecimals(c) ? " · not divisible" : " · with remainder") : c.divEnough === "yes" ? " · divisible" : ""}${dz}`;
  const digitsLabel = c.digitsMax > c.digits ? `${c.digits}-${c.digitsMax} digits` : `${c.digits} digits`;
  const parts = [`${c.count} terms`, digitsLabel];
  if (c.mode === "flash") parts.push(`${+(c.speedMs / 1000).toFixed(3)}s/term`);
  parts.push(c.includeSub ? "add & subtract" : "add only");
  return `${m} · ${parts.join(" · ")}`;
}

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
      digits: Math.min(10, Math.max(1, Number(p.digits) || DEFAULT_CFG.digits)),
      digitsMax: Math.min(10, Math.max(1, Number(p.digitsMax) || Number(p.digits) || DEFAULT_CFG.digitsMax)),
      speedMs: Math.min(5000, Math.max(50, Number(p.speedMs) || DEFAULT_CFG.speedMs)),
      flashScale: Math.min(1.5, Math.max(0.1, Number(p.flashScale) || 0.6)),
      listenSec: Math.min(6000, Math.max(0, Number(p.listenSec) ?? 800)),
      listenSpeed: Math.min(10, Math.max(1, Math.round(Number(p.listenSpeed) || 5))),
      announcePlus: p.announcePlus === undefined ? true : !!p.announcePlus,
      announceUnit: p.announceUnit === undefined ? true : !!p.announceUnit,
      listenLang: p.listenLang === "en" ? "en" : "zh",
      listenVoice: p.listenVoice === "male" ? "male" : "female", // 2026-10-13 童声下架:旧配置里的 child 归到女声
      method: p.method === "bead" ? "bead" : "mental",
      glanceLimitSec: Math.min(120, Math.max(0, Number(p.glanceLimitSec) || 0)),
      includeSub: !!p.includeSub,
      rounds: Math.min(200, Math.max(1, Number(p.rounds) || DEFAULT_CFG.rounds)),
      mulA: Math.min(10, Math.max(1, Number(p.mulA) || DEFAULT_CFG.mulA)),
      mulB: Math.min(10, Math.max(1, Number(p.mulB) || DEFAULT_CFG.mulB)),
      // 除法新配置:除数位数 + 商位数;兼容旧存档(divA=被除数位/divB=除数位 → 换算)
      divD: Math.min(8, Math.max(1, Number(p.divD) || Number(p.divB) || DEFAULT_CFG.divD)),
      divQ: Math.min(8, Math.max(1, Number(p.divQ) || (Number(p.divA) && Number(p.divB) ? Number(p.divA) - Number(p.divB) + 1 : 0) || DEFAULT_CFG.divQ)),
      divEnough: p.divEnough === "yes" || p.divEnough === "no" ? p.divEnough : "any",
      decimals: !!p.decimals,
      decimalPlaces: Math.min(4, Math.max(0, Number.isFinite(Number(p.decimalPlaces)) && p.decimalPlaces !== undefined ? Math.round(Number(p.decimalPlaces)) : 2)),
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
      u.rate = Math.max(0.5, Math.min(3.5, rate)); // 放开上限,档10 才能真正快(部分嗓音高速会含糊)
      u.pitch = 1.08; // 略微上扬更柔和
      u.volume = 1;
      u.onstart = () => { started = true; };
      u.onend = finish;
      u.onerror = finish;
      return u;
    };
    const primary = pickVoice(lang, false); // 本次将用到的嗓音(可能为 null=浏览器默认)
    try { if (synth.paused) synth.resume(); } catch { /* noop */ }
    try { synth.speak(build(false)); } catch { finish(); return; }
    // Chrome 偶发把合成器卡在暂停态:说话中周期性 resume 唤醒(不因此结束)
    iv = setInterval(() => { try { if (synth.speaking) synth.resume(); } catch { /* noop */ } }, 3000);
    // 仅当没有可用本地嗓音(用了远程/默认,可能静默失败)时,才在 900ms 无起播后换本地重试;
    // 若本来就是本地嗓音,绝不 cancel 重试(慢机器上起播偏慢,cancel 会把正常播放打断成静音)。
    if (!primary || !primary.localService) {
      retry = setTimeout(() => {
        if (!started && !done) {
          try { synth.cancel(); } catch { /* noop */ }
          try { synth.speak(build(true)); } catch { finish(); }
        }
      }, 900);
    }
    // 兜底:按文本长度估算最长时长后强制结束(逐笔短语音,15 秒足够)
    cap = setTimeout(finish, Math.min(15000, 1600 + text.length * 320));
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
    const wa = DIGIT_WEIGHT[cfg.divD] ?? cfg.divD, wb = DIGIT_WEIGHT[cfg.divQ] ?? cfg.divQ;
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
    const en = getLang() === "en";
    const vTitle = en ? "Voice input" : "语音输入";
    if (!supported) { toast({ title: vTitle, description: en ? "This browser can't record audio. Please use the keypad." : "当前浏览器不支持录音,请用数字键盘作答。" }); return; }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast({ title: vTitle, description: en ? "Couldn't open the microphone. Allow mic access in your browser and try again (or use the keypad)." : "没能打开麦克风。请在浏览器允许麦克风权限后重试(也可用数字键盘)。" });
      return;
    }
    chunksRef.current = [];
    let mr: MediaRecorder;
    try { mr = new MediaRecorder(stream); }
    catch { stream.getTracks().forEach((t) => t.stop()); toast({ title: vTitle, description: en ? "Recording failed to start. Please use the keypad." : "录音初始化失败,请用数字键盘。" }); return; }
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      if (!blob.size) return;
      setBusy(true);
      try {
        const b64 = await blobToBase64(blob);
        const res = await fetch(siteUrl("/.netlify/functions/transcribe"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ audio: b64, mime: blob.type, lang }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data && data.error) || (en ? "Recognition failed" : "识别失败"));
        cb.current(data.text || "");
      } catch (e: any) {
        toast({ title: en ? "Speech recognition" : "语音识别", description: String(e?.message || e || (en ? "Recognition failed. Try again or use the keypad." : "识别失败,请重试或用数字键盘")) });
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
      <span className="text-[10px] text-muted-foreground">{getLang() === "en" ? "s" : "秒"}</span>
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
  const tx = useTx();
  const { lang } = useI18n();
  const T = (zh: string, en: string) => (lang === "en" ? en : zh);
  // 看算竖式字号(2026-11-03 统一到配置页「字号」滑块;50%–100% = 铺满可视区的比例)
  const [glanceScale, setGlanceScale] = useState<number>(() => { try { const v = Number(localStorage.getItem("glance:scale")); return v >= 0.5 && v <= 1 ? v : 1; } catch { return 1; } });
  useEffect(() => { try { localStorage.setItem("glance:scale", String(glanceScale)); } catch { /* noop */ } }, [glanceScale]);
  const [cfg, setCfg] = useState<FlashCfg>(() => {
    const c = loadStoredCfg();
    const mode = initialMode ?? c.mode;
    return { ...c, mode, op: mode === "flash" ? "addsub" : c.op };
  });
  const [phase, setPhase] = useState<Phase>("config");
  const [countdown, setCountdown] = useState(3);
  const [answerLeft, setAnswerLeft] = useState(0); // 看算限时:题目呈现阶段的倒计时秒
  const submitBusyRef = useRef(false); // 提交防重入锁(长按 Enter/连点提交)
  // 作答鼓励(2026-10-29 用户「鼓励也放在自主练习里」,与作业同一套:语音 + 特效,开关共用 localStorage)
  const [praiseOn, setPraiseOnState] = useState(getPraiseOn);
  const [fxOn, setFxOnState] = useState(getFxOn);
  const [cheerState, setCheerState] = useState<{ id: number; key: string; correct: boolean; streak: number; emoji: string } | null>(null);
  const streakRef = useRef(0);
  const cheerIdRef = useRef(0);
  const praiseLang = lang === "en" ? "en" : "zh";
  useEffect(() => { preloadPraise(praiseLang); }, [praiseLang]);
  /** 一题交卷后:提示音 + 语音 + 特效浮层;resolve 于「至少停留(对 1.1s / 错 1.6s)且语音说完(≤3.5s)」 */
  const cheer = (correct: boolean): Promise<void> => {
    streakRef.current = correct ? streakRef.current + 1 : 0;
    const key = pickPraise(correct, streakRef.current);
    const id = ++cheerIdRef.current;
    setCheerState({ id, key, correct, streak: streakRef.current, emoji: praiseEmoji(key) });
    const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
    let voice: Promise<void> = Promise.resolve();
    if (praiseOn) { chime(correct); voice = wait(220).then(() => playPraise(key, praiseLang)); }
    const done = Promise.all([wait(correct ? 1100 : 1600), Promise.race([voice, wait(3500)])]).then(() => undefined);
    void done.then(() => setCheerState((c) => (c?.id === id ? null : c)));
    return done;
  };
  const [problem, setProblem] = useState<GProblem | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [showTerm, setShowTerm] = useState(true);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ correct: boolean; score: number; answered: number | string } | null>(null);
  const [isReplay, setIsReplay] = useState(false);
  type RoundRecord = { problem: GProblem; answered: number | string; correct: boolean; score: number };
  const [session, setSession] = useState<{ round: number; correct: number; totalScore: number; history: RoundRecord[] }>(
    { round: 0, correct: 0, totalScore: 0, history: [] },
  );
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheRef = useRef<Map<string, string>>(new Map());                            // 已合成音频池(LRU,容量6:支撑「预储备下一题」)
  const ttsPendingRef = useRef<{ key: string; promise: Promise<string> } | null>(null);  // 正在合成的请求(去重,支持预取)
  const [ttsFallback, setTtsFallback] = useState(false); // 云端 TTS 不可用时,提示已回退到浏览器语音
  const [preparing, setPreparing] = useState(false);      // 听算:语音合成中(准备好再播),前端显示"准备中"
  // 「准备中」超过 12 秒就露出逃生口:先用浏览器语音播这道题(2026-11-25 国内网络慢时不让学生干等)
  const [prepLong, setPrepLong] = useState(false);
  useEffect(() => { if (!preparing) { setPrepLong(false); return; } const t = window.setTimeout(() => setPrepLong(true), 12_000); return () => window.clearTimeout(t); }, [preparing]);
  const forceWebRef = useRef<() => void>(() => {});

  // ── 挑战TA:从榜单点"挑战"→ 弹窗确认 → 用TA配置单局挑战 → 成功/失败 ──
  const [challengeInfo, setChallengeInfo] = useState<{ nickname: string; targetD: number; targetCfg: FlashCfg } | null>(null);
  const [challengeCfg, setChallengeCfg] = useState<FlashCfg | null>(null); // 弹窗里可编辑的挑战配置(默认=对手配置)
  const [challengeResult, setChallengeResult] = useState<{ won: boolean; nickname: string; targetD: number; yourD: number; rank?: number } | null>(null);
  const [pendingChallengeStart, setPendingChallengeStart] = useState(false);
  const [showDiffHelp, setShowDiffHelp] = useState(false); // 难度系数怎么算 弹窗
  // 成绩上传状态(结果页展示 + 失败可重试);payload 存最近一次成功答对的提交内容供手动补交。
  const [saveState, setSaveState] = useState<null | { ok: boolean; error?: string; retrying?: boolean }>(null);
  const lastSubmitRef = useRef<{ game: "flashmath"; mode: string; value: number; meta: Record<string, unknown> } | null>(null);
  const challengeActiveRef = useRef<{ nickname: string; targetD: number; yourD: number } | null>(null);
  const preChallengeCfgRef = useRef<FlashCfg | null>(null); // 挑战前的用户配置,挑战结束后还原(不改用户默认配置)

  // 预取/取用云端音频:LRU 池(容量14,支撑更深的预储备)命中立即返回;否则发起(或复用在途)合成。key = 语言|音色|语速档|文本
  const warmTTS = (text: string, lang: "zh" | "en", voiceType: "female" | "male" | "child", pace: TtsPace): Promise<string> => {
    const key = `${lang}|${voiceType}|${pace}|${text}`;
    const m = ttsCacheRef.current;
    const hit = m.get(key);
    if (hit) { m.delete(key); m.set(key, hit); return Promise.resolve(hit); } // LRU touch
    if (ttsPendingRef.current?.key === key) return ttsPendingRef.current.promise;
    const promise = fetchTTS(text, lang, voiceType, pace).then((url) => {
      m.set(key, url);
      while (m.size > 14) { const k0 = m.keys().next().value as string; const u0 = m.get(k0)!; m.delete(k0); URL.revokeObjectURL(u0); }
      if (ttsPendingRef.current?.key === key) ttsPendingRef.current = null;
      return url;
    });
    ttsPendingRef.current = { key, promise };
    return promise;
  };
  const nextProblemRef = useRef<GProblem | null>(null); // 预储备的下一题(听算轮间零等待)
  const eyeCare = useEyeCare(); // 全局护眼开关(顶栏),舞台改浅色
  const usedMistakeKeysRef = useRef<Set<string>>(new Set());
  const clearedThisSessionRef = useRef<{ key: string; expr: string }[]>([]);
  // 结果页「再练一次」:对错题原地重练,记录每次重练的答案与对错
  type RetryAttempt = { answered: number | string; correct: boolean }; // 余数题存文字「2……6」
  const [retryIdx, setRetryIdx] = useState<number | null>(null); // 正在重练的题在 history 中的下标
  const [retryLog, setRetryLog] = useState<Record<number, RetryAttempt[]>>({});
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const preRetryProblemRef = useRef<GProblem | null>(null);

  // ── AI 陪练(指法进阶) + 综合训练教练建议 ──
  const [coachOn, setCoachOnState] = useState<boolean>(() => { try { return window.localStorage.getItem("flashmath:coachOn") === "1"; } catch { return false; } });
  const [coachProg, setCoachProg] = useState<CoachProgress>(() => (typeof window === "undefined" ? { stage: 1, recent: {}, passed: [] } : loadCoachProgress()));
  const { user: authUser } = useAuth();
  // 陪练进度账号级同步(2026-09-12「换设备 27/100 不动」反馈):本地只是缓存,
  // 登录后从云端 practice_attempts 重建各关窗口/通关状态,跨设备一致。
  useEffect(() => {
    if (!authUser?.id) return;
    let on = true;
    fetchCoachSeq().then((seq) => { if (on && seq.length) setCoachProg(mergeCloudCoachProgress(seq)); });
    return () => { on = false; };
  }, [authUser?.id]);
  const [adviceVer, setAdviceVer] = useState(0);
  const setCoachOn = (on: boolean) => { setCoachOnState(on); try { window.localStorage.setItem("flashmath:coachOn", on ? "1" : "0"); } catch { /* noop */ } };
  const coachActive = coachOn && cfg.op === "addsub" && !mistakeMode;
  const coachStage = COACH_STAGES.find((s) => s.id === coachProg.stage) ?? COACH_STAGES[0];
  // 变式小课(练习册结构):每关记住所选小课,-1 = 全部
  const [coachLesson, setCoachLessonState] = useState<Record<number, number>>(() => {
    try { const p = JSON.parse(window.localStorage.getItem("flashmath:coachLesson") || "{}"); return typeof p === "object" && p ? p : {}; } catch { return {}; }
  });
  const setCoachLesson = (stageId: number, gi: number) => {
    setCoachLessonState((prev) => {
      const next = { ...prev, [stageId]: gi };
      try { window.localStorage.setItem("flashmath:coachLesson", JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };
  const coachLessonIdx = coachLesson[coachProg.stage] ?? -1;
  const coachLessonXs = coachLessonIdx >= 0 ? coachStage.variantGroups[coachLessonIdx]?.xs ?? null : null;
  const advCfg: AdvisorCfg = { mode: cfg.mode, op: cfg.op, digits: cfg.digits, digitsMax: cfg.digitsMax, includeSub: cfg.includeSub, speedMs: cfg.speedMs, count: cfg.count, listenSpeed: cfg.listenSpeed, glanceLimitSec: cfg.glanceLimitSec };
  const advice = useMemo(
    () => (typeof window !== "undefined" && !coachActive && cfg.op === "addsub" && !mistakeMode ? getAdvice(advCfg) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coachActive, mistakeMode, cfg.mode, cfg.op, cfg.digits, cfg.digitsMax, cfg.includeSub, cfg.speedMs, cfg.count, cfg.listenSpeed, cfg.glanceLimitSec, adviceVer, lang],
  );

  useEffect(() => onCfgChange?.(cfg), [cfg, onCfgChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    nextProblemRef.current = null; // 配置一变,预储备的下一题作废
    try {
      window.localStorage.setItem(CFG_STORAGE_KEY, JSON.stringify(cfg));
    } catch {}
  }, [cfg]);

  const problemKey = (terms: number[], signs: string[], answer: number) =>
    `${signs.join("")}|${terms.join(",")}|${answer}`;

  const loadProblem = async (): Promise<GProblem | null> => {
    if ((cfg.op === "div" && cfg.divEnough === "no") || mdDecimals(cfg)) {
      // 不够除 / 小数:与教练布置作业同一个出题器(无小数的不够除答「商……余数」;小数题答案按保留位数四舍五入,且不会舍成 0)
      const h = genHwProblem({ ...HW_DEFAULT_ITEM, project: "glance", op: cfg.op, mulA: cfg.mulA, mulB: cfg.mulB, divD: cfg.divD, divQ: cfg.divQ, divEnough: cfg.divEnough, decimals: mdDecimals(cfg), decimalPlaces: cfg.decimalPlaces });
      return { terms: h.terms, signs: h.signs, answer: h.answer, op: h.op, places: h.places, rem: h.rem };
    }
    if (cfg.op === "mul") {
      const { a, b } = generateMultiply(cfg.mulA, cfg.mulB);
      const answerStr = (BigInt(a) * BigInt(b)).toString(); // 精确大数乘积
      return { terms: [a, b], signs: ["+", "+"], answer: Number(answerStr), answerStr, op: "×" };
    }
    if (cfg.op === "div") {
      // 配置即出题参数:除数=divD 位、商=divQ 位,整除,被除数自动推导(难度与被除数无关)。
      const g = generateDivide(cfg.divD, cfg.divQ);
      return { terms: [g.dividend, g.divisor], signs: ["+", "+"], answer: g.quotient, answerStr: String(g.quotient), op: "÷" };
    }
    if (coachActive) {
      // AI 陪练:按当前关卡定向出题(个位数,每一笔指法 ∈ 本关允许集,约 70% 命中目标指法)
      const p = generateCoachProblem(coachProg.stage, cfg.count, cfg.digits, coachLessonXs);
      return { terms: p.terms, signs: p.signs, answer: p.answer, classes: p.classes };
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
    return buildProblem(cfg.count, cfg.digits, cfg.includeSub, cfg.digitsMax);
  };

  const submit = async (raw: string, timedOut = false) => {
    if (!problem) return;
    // 防重入(2026-09-12 课堂事故):长按 Enter(键盘自动重复)/连点提交会并发十几次 submit,
    // 成绩重复入库、场次被连吃 —— 一次作答只放行一个 submit,进入下一题作答阶段时解锁。
    if (submitBusyRef.current) return;
    const usedMs = Date.now() - startTimeRef.current;
    let value: number;
    let correct: boolean;
    let remShown: string | null = null; // 余数题:展示用的作答文字
    if (problem.rem != null) {
      // 不够除·无小数:商和余数都要对;没写余数算错(记录里 userAnswer 记商)
      const pr = parseRemAnswer(raw);
      const digits = raw.replace(/\D/g, "");
      if (!pr && !digits) { if (!timedOut) return; value = NaN; correct = false; }
      else { value = pr ? pr.q : Number(digits); correct = !!pr && pr.q === problem.answer && pr.r === problem.rem; remShown = pr ? answerText(pr.q, pr.r, fmtNum) : fmtNum(value); }
    } else if (problem.places != null) {
      // 小数/不够除:按数值比较(答案已四舍五入到保留位数)
      const t = raw.replace(/[,，\s]/g, "").replace(/[。．]/g, ".");
      const v = t && /^\d*\.?\d*$/.test(t) && t !== "." ? Number(t) : null;
      if (v == null) { if (!timedOut) return; value = NaN; correct = false; }
      else { value = v; correct = Math.abs(v - problem.answer) < 1e-9; }
    } else if (problem.answerStr) {
      // 乘除:按数字串精确比较(支持超大结果,不受 JS 浮点精度影响)
      const userStr = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
      if (!userStr) { if (!timedOut) return; value = NaN; correct = false; } // 超时未答=错
      else { correct = userStr === problem.answerStr; value = Number(userStr); }
    } else {
      const v = parseSpokenNumber(raw);
      if (v == null) { if (!timedOut) return; value = NaN; correct = false; }
      else { value = v; correct = v === problem.answer; }
    }
    submitBusyRef.current = true; // 解析已通过,正式上锁(放在解析后:空输入/解析失败的提前 return 不占锁)
    const cheerDone = cheer(correct);
    const score = computeScore(cfg, correct);

    const mode =
      cfg.op === "mul" ? `${cfg.mode}-mul-${cfg.mulA}x${cfg.mulB}${mdSuffix(cfg)}` :
      cfg.op === "div" ? `${cfg.mode}-div-${cfg.divD}d${cfg.divQ}q${mdSuffix(cfg)}` :
      coachActive ? `${cfg.mode}-coach-s${coachProg.stage}-${cfg.count}q` :
      `${cfg.mode}-${cfg.count}q-${cfg.digits}_${cfg.digitsMax}d${cfg.includeSub ? "-sub" : ""}`;
    logAttempt({
      game: "flashmath",
      mode: retryIdx != null ? `${mode}-retry` : mode, // 重练标记:云端重建陪练进度时不计入(与本地口径一致)
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
      setRetryLog((prev) => ({ ...prev, [idx]: [...(prev[idx] ?? []), { answered: remShown ?? value, correct }] }));
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
        clearedThisSessionRef.current.push({ key: k, expr: `${gExpr(problem)} = ${ansStr(problem)}` });
      }
    }

    // AI 陪练:记关卡进度(近100题≥80%通关);综合训练:喂教练建议引擎
    if (cfg.op === "addsub" && !mistakeMode) {
      // 指法分类错误统计(错哪类→建议栏推荐去哪关专项);陪练题用引擎标好的类别,综合题按个位档推算
      const cls = problem.classes ?? classesOfProblem(problem.terms, problem.signs);
      if (cls.length) recordClassOutcome(cls, correct);
      if (coachActive) {
        const r = recordCoachResult(coachProg.stage, correct);
        setCoachProg(r.progress);
        if (r.justPassed) {
          toast(lang === "en"
            ? { title: `🎉 Stage ${coachProg.stage} “${tx(coachStage.name)}” cleared!`, description: coachProg.stage < COACH_STAGES.length ? `Stage ${coachProg.stage + 1} unlocked. Switch stages on the settings page (this round stays on the current stage).` : "All seven stages cleared. You've mastered the fingering system!" }
            : { title: `🎉 第${coachProg.stage}关「${coachStage.name}」通关!`, description: coachProg.stage < COACH_STAGES.length ? `第${coachProg.stage + 1}关已点亮,想换关到配置页点选(本轮继续练当前关)` : "七关全部通关,指法体系毕业!" });
        }
      } else {
        recordAdvisorResult(advCfg, correct);
        setAdviceVer((v) => v + 1);
      }
    }

    if (correct && !coachActive) {
      const payload = {
        game: "flashmath" as const,
        mode,
        value: score,
        meta: { speedMs: cfg.speedMs, D: difficultyD(cfg, usedMs) } as Record<string, unknown>,
      };
      lastSubmitRef.current = payload;
      const r = await submitScore(payload);
      setSaveState({ ok: r.ok, error: r.error });
      if (!r.ok) {
        toast(
          r.error === "未登录"
            ? { title: T("登录后即可上榜", "Log in to get on the leaderboard"), description: T("本局成绩未保存到云端。", "This score wasn't saved to the cloud.") }
            : { variant: "destructive", title: T("成绩上传失败", "Score upload failed"), description: lang === "en" ? `${r.error ?? "Network error"} — tap “Retry upload” on the results page.` : `${r.error ?? "网络异常"} —— 结果页可点「重试上传」。` },
        );
      }
    }

    const nextRound = session.round + 1;
    const record: RoundRecord = { problem, answered: remShown ?? value, correct, score };
    const newSession = {
      round: nextRound,
      correct: session.correct + (correct ? 1 : 0),
      totalScore: session.totalScore + score,
      history: [...session.history, record],
    };
    setSession(newSession);
    onFinished?.();

    if (nextRound < cfg.rounds) {
      await cheerDone; // 鼓励说完再出下一题(听算不和报题叠音)
      const next = nextProblemRef.current ?? await loadProblem();
      nextProblemRef.current = null;
      if (next) {
        setProblem(next);
        setStepIdx(0);
        setInput("");
        setResult(null);
        setPhase("prep"); // 组间用更轻的「准备…」过渡(仅第一组有完整 3-2-1)
        return;
      }
    }
    setResult({ correct, score, answered: remShown ?? value });
    setPhase("result");
    // 挑战TA:本局结束,判定成功/失败(单局全对即成功);成功则查最新名次;随后还原用户配置
    if (challengeActiveRef.current) {
      const active = challengeActiveRef.current;
      const won = newSession.correct === cfg.rounds;
      const prefix = modePrefix(cfg.mode);
      const chOp = cfg.op; // 挑战所用运算(加减/乘/除)—— 名次按同运算榜取
      challengeActiveRef.current = null;
      (async () => {
        let rank: number | undefined;
        if (won) {
          try {
            const { data: u } = await supabase.auth.getUser();
            if (u.user) {
              const { difficulty } = await getProjectRanks("flashmath", prefix, 200);
              // 榜单已按运算隔离,取「同运算」里本人那条的组内名次
              const mine = difficulty.find((x) => x.user_id === u.user!.id && x.op === chOp);
              if (mine) rank = mine.rank;
            }
          } catch { /* noop */ }
        }
        setChallengeResult({ won, nickname: active.nickname, targetD: active.targetD, yourD: active.yourD, rank });
      })();
      if (preChallengeCfgRef.current) { setCfg(preChallengeCfgRef.current); preChallengeCfgRef.current = null; }
    }
    // Session ended: notify about any mastered-and-cleared problems
    const cleared = clearedThisSessionRef.current;
    if (cleared.length > 0) {
      toast({
        title: T("🎉 恭喜！错题已过关", "🎉 Mistakes mastered!"),
        description: (lang === "en" ? `${cleared.length} problem(s) answered right ${MASTERY_THRESHOLD} times in a row and removed from your mistake book:\n` : `${cleared.length} 道题已连续答对 ${MASTERY_THRESHOLD} 次，从错题本中移除：\n`) +
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
    stopPraise(); setCheerState(null); streakRef.current = 0;
    cloud.stop();
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    // 中途退出挑战:还原用户自己的配置
    challengeActiveRef.current = null;
    if (preChallengeCfgRef.current) { setCfg(preChallengeCfgRef.current); preChallengeCfgRef.current = null; }
    setPhase("config");
    setProblem(null);
    setInput("");
    setResult(null);
    setStepIdx(0);
    setIsReplay(false);
    setRetryIdx(null);
    setRetryLog({});
    setExpandedRows(new Set());
    setSaveState(null);
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
    // 听算:在用户点击(手势)内解锁播放,避免倒计时后延迟调用时「没声音」。
    if (cfg.mode === "listen" && typeof window !== "undefined") {
      // 1) 解锁 HTML <audio> 自动播放:手势内静音播一小段(用独立临时元素,不碰真正的播放 ref)
      try {
        const u = new Audio(SILENT_WAV);
        u.muted = true;
        u.play().then(() => { try { u.pause(); } catch { /* noop */ } }).catch(() => {});
      } catch { /* noop */ }
      // 2) 预热浏览器语音合成(回退路径 + 触发嗓音加载)
      if (window.speechSynthesis) {
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
    }
    usedMistakeKeysRef.current.clear();
    clearedThisSessionRef.current = [];
    // 听算:配置页已预热的第一题直接用(题+语音都备好,点开始零等待);cfg 一变 nextProblemRef 即作废
    const pre = cfg.mode === "listen" && !mistakeMode ? nextProblemRef.current : null;
    nextProblemRef.current = null;
    const p = pre ?? (await loadProblem());
    if (!p) {
      toast({ title: T("没有错题可以练", "No mistakes to practice"), description: T("请关闭「只练错题」开关。", "Turn off “Mistakes only”.") });
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
    // 听算(英文):先把整段语音准备好(前端显示"准备中"),就绪后再进倒计时 → 播放时开头完整、无空白。
    // 中文走词块库,这里绝不云端合成 —— 长题(多笔多位数)合成要好几秒,曾把「开始」卡成一直出不来;
    // 库若还在下载,播放 effect 会等它(秒级)。
    if (cfg.mode === "listen" && cfg.listenLang !== "zh") {
      setPreparing(true);
      try { await warmTTS(buildListenText(p, cfg), cfg.listenLang, cfg.listenVoice, paceFor(cfg.listenSpeed)); } catch { /* 播放时会回退 */ }
      setPreparing(false);
    }
    setPhase("ready");
  };

  // 挑战TA:监听榜单派发的事件 → 弹出确认弹窗
  useEffect(() => {
    const onChallenge = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d?.mode) return;
      const targetCfg = modeToCfg(d.mode, d.speedMs);
      setChallengeInfo({ nickname: d.nickname || "TA", targetD: Number(d.D) || 0, targetCfg });
      setChallengeCfg(targetCfg); // 默认=对手配置,用户可在弹窗里调高
    };
    // 榜单运算 tab ↔ 左侧配置「运算」双向联动:榜单点击派发 flash:setop,这里切换 cfg.op
    const onSetOp = (e: Event) => {
      const op = (e as CustomEvent).detail?.op;
      if (op !== "addsub" && op !== "mul" && op !== "div") return;
      setCfg((c) => (c.mode === "flash" || c.op === op ? c : { ...c, op })); // 闪算恒为加减,不切
    };
    window.addEventListener(FLASH_CHALLENGE_EVENT, onChallenge);
    window.addEventListener("flash:setop", onSetOp);
    return () => {
      window.removeEventListener(FLASH_CHALLENGE_EVENT, onChallenge);
      window.removeEventListener("flash:setop", onSetOp);
    };
  }, []);

  // 弹窗点"开始挑战":套用(可能已调整的)挑战配置,标记挑战进行中,再启动本局
  const startChallenge = () => {
    if (!challengeInfo || !challengeCfg) return;
    if (mistakeMode) onMistakeModeChange?.(false); // 挑战不走错题池
    preChallengeCfgRef.current = cfg; // 先存下用户自己的配置
    setCfg(challengeCfg);
    challengeActiveRef.current = { nickname: challengeInfo.nickname, targetD: challengeInfo.targetD, yourD: difficultyD(challengeCfg) };
    setChallengeResult(null);
    setChallengeInfo(null);
    setPendingChallengeStart(true);
  };
  // cfg 更新到位后再开始(setCfg 是异步的,等下一轮渲染 beginCountdown 才拿到新 cfg)
  useEffect(() => {
    if (!pendingChallengeStart) return;
    setPendingChallengeStart(false);
    beginCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChallengeStart]);


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

  // 组间「准备」:只有第一组走完整 3-2-1;后续各组用更轻的「准备…」短过渡(给反应时间,不重复倒数)
  useEffect(() => {
    if (phase !== "prep") return;
    dingTick();
    timerRef.current = window.setTimeout(() => setPhase("playing"), 1400);
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

  // 提交锁解锁:每次进入作答阶段(新一轮/重练)放行一次提交
  useEffect(() => {
    if (phase === "answer") submitBusyRef.current = false;
  }, [phase]);

  // 看算:呈现竖式。限时=题目「呈现时间」(不含作答):
  //  · 不限时(0):竖式常驻,直接进作答,竖式一直可见;
  //  · 限时(>0):竖式只显示 N 秒(倒计时),到点隐藏并进入作答,学生凭记忆填(作答不再计时)。
  useEffect(() => {
    if (phase !== "playing" || !problem || cfg.mode !== "glance") return;
    if (cfg.glanceLimitSec > 0) {
      setAnswerLeft(cfg.glanceLimitSec);
      const deadline = Date.now() + cfg.glanceLimitSec * 1000;
      const iv = window.setInterval(() => {
        const left = Math.ceil((deadline - Date.now()) / 1000);
        if (left <= 0) { clearInterval(iv); setAnswerLeft(0); startTimeRef.current = Date.now(); setPhase("answer"); }
        else setAnswerLeft(left);
      }, 200);
      return () => clearInterval(iv);
    }
    startTimeRef.current = Date.now();
    setPhase("answer");
  }, [phase, problem, cfg.mode, cfg.glanceLimitSec]);

  const [bankVariant, setBankVariantState] = useState<BankVariant>(() => getBankVariant());
  // 速度旋钮 → 词块速度档(变速不变调,预生成);童声恒 ×1.25 升调,所以取档先除回去
  const bankTier = () => tierFor(ttsSpeedFor(cfg.listenSpeed) / voicePlaybackRate(cfg.listenVoice as BankVoice));
  /** 一道题的听算词块(中文词块库);含词块库没有的字(非 E 版的小数等)返回 null → 云端兜底 */
  const tokensFor = (pr: GProblem): string[][] | null => {
    if (pr.op) {
      const t0 = numberTokens(pr.terms[0], cfg.announceUnit);
      const t1 = numberTokens(pr.terms[1], cfg.announceUnit);
      if (!t0 || !t1) return null;
      return [t0, [pr.op === "×" ? "乘以" : "除以", ...t1]];
    }
    const out: string[][] = [];
    for (let i = 0; i < pr.terms.length; i++) {
      const nt = numberTokens(pr.terms[i], cfg.announceUnit);
      if (!nt) return null;
      const sub = pr.signs[i] === "-";
      const lead = i === 0 ? [] : sub ? ["减"] : cfg.announcePlus ? ["加"] : [];
      out.push([...lead, ...nt]);
    }
    return out;
  };

  // 听算·词块音频库预载(2026-09-21 稳定性重做):中文听算一进来就把当前音色+速度档的
  // 44 词块载好,之后报题全本地拼播 —— 零合成调用、零等待、永不失败;换速度/音色即换档预载。
  // 库在 CDN,浏览器强缓存,只有首次有下载。
  useEffect(() => {
    // 2026-11-24 家长「听心算又卡又不能用」:之前一进听算就后台拉整套 1119 个词块(约 18MB、上千个请求),和当前题抢带宽、还会被 Netlify 限流。
    // 改为只拉已预热的第一题 / 换档后当前题用到的十几个词块;其余按需 + 开播后预取下一题。
    if (cfg.mode !== "listen" || cfg.listenLang !== "zh") return;
    const pr = nextProblemRef.current ?? problem;
    const tk = pr ? tokensFor(pr) : null;
    if (tk) void loadBank(cfg.listenVoice as BankVoice, bankTier(), termBankTokens(tk));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.mode, cfg.listenLang, cfg.listenVoice, cfg.listenSpeed, bankVariant]);

  // 听算·配置页预热(2026-09-19「产出时间太长」):还没点「开始挑战」,就把第一题出好、
  // 整段语音合成好 —— 配置每次变动后静置 700ms 触发;cfg 变化会作废旧预热(见 cfg effect)。
  useEffect(() => {
    if (phase !== "config" || cfg.mode !== "listen" || mistakeMode) return;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          if (nextProblemRef.current) return; // 已有有效预热
          const p = await loadProblem();
          if (p && phase === "config") {
            nextProblemRef.current = p;
            if (cfg.listenLang !== "zh") await warmTTS(buildListenText(p, cfg), cfg.listenLang, cfg.listenVoice, paceFor(cfg.listenSpeed)); // 云端预热只留给英文
            else { const tk = tokensFor(p); if (tk) void loadBank(cfg.listenVoice as BankVoice, bankTier(), termBankTokens(tk)); } // 中文:先把第一题的十几个词块拉好,点开始零等待
          }
        } catch { /* 点开始时会正常合成 */ }
      })();
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cfg, mistakeMode, coachOn]);

  // 听算·预取:题目一确定,就在 3-2-1 倒计时/组间准备阶段后台把整段音频合成好,
  // 等到"播放"时直接秒开 —— 声音与「请听题」画面同时出现,不用再干等合成。
  useEffect(() => {
    if (cfg.mode !== "listen" || !problem || cfg.listenLang === "zh") return; // 中文走词块库,无需云端预取
    if (phase !== "ready" && phase !== "prep" && phase !== "playing") return;
    warmTTS(buildListenText(problem, cfg), cfg.listenLang, cfg.listenVoice, paceFor(cfg.listenSpeed)).catch(() => { /* 播放时会回退 */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, problem, cfg.mode, cfg.listenSec, cfg.listenSpeed, cfg.announcePlus, cfg.announceUnit, cfg.listenLang, cfg.listenVoice]);

  // 听算·播放:优先用(通常已预取好的)云端 MP3;失败自动回退浏览器逐笔语音。
  useEffect(() => {
    if (phase !== "playing" || !problem || cfg.mode !== "listen") return;
    let cancelled = false;
    setShowTerm(true);
    setStepIdx(0);
    const lang = cfg.listenLang;
    const say = (n: number) =>
      cfg.announceUnit
        ? (lang === "zh" ? numberToCN(n) : numberToEN(n))
        : String(Math.abs(n)).split("").map((d) => (lang === "zh" ? "零一二三四五六七八九"[+d] : d)).join(" ");
    const done = () => { if (!cancelled) { startTimeRef.current = Date.now(); setPhase("answer"); } };

    // 回退:浏览器逐笔语音
    const webSpeech = async () => {
      const rate = speedToRate(cfg.listenSpeed);
      const waitMs = Math.max(0, cfg.listenSec - 180);
      if (problem.op) {
        const verb = lang === "zh" ? (problem.op === "×" ? "乘以" : "除以") : (problem.op === "×" ? "times" : "divided by");
        await speakTerm(`${say(problem.terms[0])} ${verb} ${say(problem.terms[1])}`, rate, lang);
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        for (let i = 0; i < problem.terms.length; i++) {
          if (cancelled) return;
          setStepIdx(i);
          const sub = problem.signs[i] === "-";
          const word = i === 0 ? "" : sub ? (lang === "zh" ? "减" : "minus") : (cfg.announcePlus ? (lang === "zh" ? "加" : "plus") : "");
          await speakTerm((word ? word + " " : "") + say(problem.terms[i]), rate, lang);
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
      done();
    };

    // ===== 首选:词块音频库本地拼播(中文可切词)——稳定、瞬时、任何档不变声。
    // 库还在下载(刚换速度档/音色)就【等它】(约1MB,秒级),绝不抢跑掉进云端:
    // 云端合成 15 笔多位数的长题要好几秒(付海东「一直出不来」),播放还被限速(「又慢了」)。
    let bankHandle: { cancel: () => void } | null = null;
    let escaped = false; // 用户点了「先用浏览器语音」:之后到达的词块 / 云端结果都作废
    forceWebRef.current = () => { if (cancelled || escaped) return; escaped = true; bankHandle?.cancel(); setPreparing(false); setTtsFallback(true); void webSpeech(); };
    const tier = tierFor(ttsSpeedFor(cfg.listenSpeed) / voicePlaybackRate(cfg.listenVoice as BankVoice));
    const buildTermTokens = (): string[][] | null => tokensFor(problem);
    const bankTokens = cfg.listenLang === "zh" ? buildTermTokens() : null;

    const playBank = (tts: string[][]) => {
      setPreparing(false);
      setTtsFallback(false);
      // 提速全靠预生成速度档(变速不变调)+ 间隔压缩;倍率女/男恒 1.0(永不变声)、童声恒 1.25 升调扮童
      const rate = voicePlaybackRate(cfg.listenVoice as BankVoice); // D/E 真童声不升调
      const termGapMs = Math.max(30, cfg.listenSec / ttsSpeedFor(cfg.listenSpeed));
      const h = speakTokens(cfg.listenVoice as BankVoice, tier, tts, rate, termGapMs, (ti) => { if (!cancelled) setStepIdx(ti); });
      bankHandle = h;
      void h.done.then(() => done());
    };

    const cloudPath = async () => {
      try {
        setPreparing(true); // 语音合成中 → 前端显示"准备中",就绪后再播(避免开头空白/像没报全)
        const url = await warmTTS(buildListenText(problem, cfg), cfg.listenLang, cfg.listenVoice, paceFor(cfg.listenSpeed)); // 命中预取则立即返回
        if (cancelled || escaped) return;
        setPreparing(false);
        setTtsFallback(false);
        // 每题新建独立音频元素(warmTTS 已把整段 blob 下载完,可完整从头播放)
        try { audioRef.current?.pause(); } catch { /* noop */ }
        const audio = new Audio(url);
        // 语速在播放端调(音频按 1.0 母语语速合成);preservesPitch 默认开,变速不变调。
        // 童声:关闭保调 + 提速 30% → 音调抬高约 4.5 个半音(用户试听选定档;OpenAI 无真童声,靠升调逼近),
        // 合成端 instructions 已让童声放慢朗读,提速后语速与其他音色相当。
        // 目标总语速 = 前端倍率 × 合成端语速档 —— 高档由合成端出大头,前端倍率压小,杜绝"太紧太尖"
        const paceF = PACE_FACTOR[paceFor(cfg.listenSpeed)];
        if (cfg.listenVoice === "child") {
          // 童声靠关保调升调扮童音:音调 ∝ 总倍率,封顶 1.72(≈+9.4半音),高档不再炸成"花栗鼠"
          (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false;
          audio.playbackRate = Math.min(1.72, Math.max(1.05, (ttsSpeedFor(cfg.listenSpeed) / paceF) * 1.3));
        } else {
          audio.playbackRate = Math.min(2.1, Math.max(0.55, ttsSpeedFor(cfg.listenSpeed) / paceF));
        }
        audioRef.current = audio;
        audio.onended = done;
        audio.onerror = () => { if (!cancelled) webSpeech(); };
        await audio.play();
        // 预储备:当前题开播后,后台生成下一题并预合成语音(轮间/再来零等待)
        if (!mistakeMode && retryIdx == null) {
          void (async () => {
            try {
              const np = await loadProblem();
              if (np && !cancelled) {
                nextProblemRef.current = np;
                if (cfg.listenLang !== "zh") await warmTTS(buildListenText(np, cfg), cfg.listenLang, cfg.listenVoice, paceFor(cfg.listenSpeed));
              }
            } catch { /* 播放时会回退 */ }
          })();
        }
      } catch {
        if (!cancelled && !escaped) { setPreparing(false); setTtsFallback(true); await webSpeech(); } // 云端不可用 → 浏览器语音兜底
      }
    };

    // 开播后预取下一题(先出好题,再拉它的十几个词块),轮间零等待;不再后台拉整套词块(2026-11-24)
    const prefetchNextBank = () => {
      if (mistakeMode || retryIdx != null) return;
      void (async () => {
        try {
          const np = nextProblemRef.current ?? await loadProblem();
          if (!np || cancelled) return;
          nextProblemRef.current = np;
          const tk = tokensFor(np);
          if (tk) void loadBank(cfg.listenVoice as BankVoice, tier, termBankTokens(tk));
        } catch { /* 下一题开播时再取 */ }
      })();
    };
    if (bankTokens) {
      // 只等这道题的词块(2026-10-14 用户「加载太慢」):十几个文件 <1s
      const needed = termBankTokens(bankTokens); // 含每个数末块的自然尾音版
      if (bankReady(cfg.listenVoice as BankVoice, tier, needed)) { playBank(bankTokens); prefetchNextBank(); }
      else {
        setPreparing(true); // 词块下载中("准备中"一闪而过);真失败才落云端
        void loadBank(cfg.listenVoice as BankVoice, tier, needed).then((ok) => {
          if (cancelled || escaped) return;
          if (ok) { playBank(bankTokens); prefetchNextBank(); }
          else void cloudPath();
        });
      }
    } else {
      void cloudPath();
    }

    return () => {
      cancelled = true;
      bankHandle?.cancel();
      try { audioRef.current?.pause(); } catch { /* noop */ }
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, problem, cfg.mode, cfg.listenSec, cfg.listenSpeed, cfg.announcePlus, cfg.announceUnit, cfg.listenLang, cfg.listenVoice]);

  const isMd = cfg.op !== "addsub"; // 乘 / 除:操作数位数配置 + 算式呈现

  // 挑战TA:确认弹窗(可调配置 + 实时 D + 提示)+ 结算(超越/平手/失败 + 名次)
  const chYourD = challengeCfg ? difficultyD(challengeCfg) : 0;
  const chTargetD = challengeInfo?.targetD ?? 0;
  const chCmp = chYourD > chTargetD ? "higher" : chYourD < chTargetD ? "lower" : "equal";
  const patchChallenge = (p: Partial<FlashCfg>) => setChallengeCfg((c) => (c ? { ...c, ...p } : c));
  const chPill = (active: boolean) => cn("rounded px-2 py-0.5 text-[11px] font-medium transition-colors", active ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground");
  // 单题模式:结果页顶部状态跟随「最近一次作答」——有再练时看最后一次再练,否则看原始作答
  const retries0 = cfg.rounds === 1 ? (retryLog[0] ?? []) : [];
  const lastRetry0 = result && !result.correct && retries0.length > 0 ? retries0[retries0.length - 1] : null;
  const overlays = (
    <>
      {showDiffHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowDiffHelp(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{T("难度系数 D 怎么算?", "How is difficulty D calculated?")}</h3>
            {lang === "en" ? (
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>Add/Sub (Flash/Glance/Listen): <b className="text-foreground">D = digit score × speed score × term score × sub factor</b></p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Digit score = 1.6^(digits−1) — exponential: more digits, much harder</li>
                <li>Speed score = (1 ÷ seconds per term)^1.2, capped at 9 — faster is harder</li>
                <li>Term score = (terms ÷ 5)^0.7, capped at 3 — grows sub-linearly</li>
                <li>With subtraction ×1.3, add only ×1</li>
              </ul>
              <p>Multiply: <b className="text-foreground">D = 4 × (multiplicand digits × multiplier digits)^0.85</b></p>
              <p>Divide: <b className="text-foreground">D = 4 × (divisor digits^0.8 × quotient digits^1.2)^0.85</b> — only the divisor and quotient count, not the dividend; the quotient weighs 1.5× the divisor</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>5 digits is the watershed: beyond 5 digits, each extra multiplicand / multiplier / divisor digit counts as half a digit (still harder, but the gap narrows, e.g. 4-digit × 6/7/8-digit)</li>
                <li>Examples: divisor 2 / quotient 2 (13.0) &gt; divisor 1 / quotient 2 (8.1) &gt; divisor 2 / quotient 1 (6.4); divisor 5 / quotient 6 (74.3) &gt; divisor 8 / quotient 3 (43.8)</li>
              </ul>
              <p className="text-muted-foreground/70">The leaderboard ranks you by the highest D you've answered correctly in that project.</p>
            </div>
            ) : (
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>加减(闪算/看算/听算):<b className="text-foreground">D = 位数分 × 速度分 × 笔数分 × 加减系数</b></p>
              <ul className="ml-4 list-disc space-y-1">
                <li>位数分 = 1.6^(位数−1) —— 指数,位数越多越难</li>
                <li>速度分 = (1 ÷ 每笔秒数)^1.2,封顶 9 —— 越快越难</li>
                <li>笔数分 = (笔数 ÷ 5)^0.7,封顶 3 —— 次线性</li>
                <li>含减法 ×1.3,纯加 ×1</li>
              </ul>
              <p>乘法:<b className="text-foreground">D = 4 × (被乘数位 × 乘数位)^0.85</b></p>
              <p>除法:<b className="text-foreground">D = 4 × (除数位^0.8 × 商位^1.2)^0.85</b> —— 只看除数和商,与被除数无关;商的权重是除数的 1.5 倍</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>5 位是分水岭:被乘数 / 乘数 / 除数超过 5 位后,每多一位只按半位计(难度仍升但差距缩小,如 4位×6/7/8位)</li>
                <li>例:除2位商2位(13.0) &gt; 除1位商2位(8.1) &gt; 除2位商1位(6.4);除5位商6位(74.3) &gt; 除8位商3位(43.8)</li>
              </ul>
              <p className="text-muted-foreground/70">榜单取你在该项目里答对过的最高 D 排名。</p>
            </div>
            )}
            <button onClick={() => setShowDiffHelp(false)} className="mt-4 h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground">{T("知道了", "Got it")}</button>
          </div>
        </div>
      )}
      {challengeInfo && challengeCfg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setChallengeInfo(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-600">⚔ {T("发起挑战", "Challenge")}</div>
            {/* 对手成绩:突出显示 */}
            <div className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-amber-700">{lang === "en" ? `${challengeInfo.nickname}'s score` : `${challengeInfo.nickname} 的成绩`}</span>
                <span className="font-mono-tabular text-sm font-bold text-amber-600">D {chTargetD.toFixed(1)}</span>
              </div>
              <div className="mt-0.5 text-sm font-semibold text-foreground">{describeCfg(challengeInfo.targetCfg)}</div>
            </div>
            {/* 你目前挑战的配置(随下方调整实时变化) */}
            <div className="mt-2 text-center text-xs text-muted-foreground">{T("你目前挑战:", "Your challenge: ")}<span className="font-semibold text-foreground">{describeCfg(challengeCfg)}</span></div>

            <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[11px] font-semibold text-foreground">{T("你的挑战配置(可调高以超越 TA)", "Your settings (raise them to beat this score)")}</div>
              {challengeCfg.op === "addsub" ? (
                <>
                  <Stepper label={tx("笔数")} value={challengeCfg.count} min={1} max={200} onChange={(v) => patchChallenge({ count: v })} />
                  <Stepper label={tx("位数")} value={challengeCfg.digits} min={1} max={10} onChange={(v) => patchChallenge({ digits: v, digitsMax: v })} />
                  {challengeCfg.mode === "flash" && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{T("单笔时间", "Per term")}</span>
                      <div className="flex items-center gap-1.5">
                        <button className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-sm leading-none hover:bg-muted disabled:opacity-40" disabled={challengeCfg.speedMs <= 100} onClick={() => patchChallenge({ speedMs: Math.max(100, challengeCfg.speedMs - 100) })}>−</button>
                        <span className="w-14 text-center font-mono-tabular text-sm font-semibold text-foreground">{(challengeCfg.speedMs / 1000).toFixed(1)}{T("秒", "s")}</span>
                        <button className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-sm leading-none hover:bg-muted disabled:opacity-40" disabled={challengeCfg.speedMs >= 5000} onClick={() => patchChallenge({ speedMs: Math.min(5000, challengeCfg.speedMs + 100) })}>+</button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{tx("运算")}</span>
                    <div className="flex gap-1">
                      <button onClick={() => patchChallenge({ includeSub: false })} className={chPill(!challengeCfg.includeSub)}>{tx("纯加")}</button>
                      <button onClick={() => patchChallenge({ includeSub: true })} className={chPill(challengeCfg.includeSub)}>{tx("加减混合")}</button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">{T("乘/除挑战按对手配置进行:", "Multiply/divide challenges use the opponent's settings: ")}{describeCfg(challengeCfg)}</p>
              )}
            </div>

            <div className={cn("mt-3 rounded-lg px-3 py-2 text-center text-xs font-semibold",
              chCmp === "higher" ? "bg-emerald-500/10 text-emerald-600" : chCmp === "lower" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600")}>
              {lang === "en"
                ? `Your D ${chYourD.toFixed(1)} — ${chCmp === "higher" ? "higher: answer right to beat them!" : chCmp === "lower" ? "lower: raise your settings to beat them" : "equal: answer right to tie"}`
                : <>你的难度 D {chYourD.toFixed(1)} —— {chCmp === "higher" ? "高于 TA,答对即超越!" : chCmp === "lower" ? "低于 TA,调高配置才能超越" : "与 TA 持平,答对即打成平手"}</>}
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setChallengeInfo(null)} className="h-9 flex-1 rounded-md border border-border text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">{T("取消", "Cancel")}</button>
              <button onClick={startChallenge} className="h-9 flex-1 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">{tx("开始挑战")}</button>
            </div>
          </div>
        </div>
      )}
      {challengeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setChallengeResult(null)}>
          <div className="animate-pop-in w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center text-foreground shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl">{!challengeResult.won ? "💪" : challengeResult.yourD > challengeResult.targetD ? "🏆" : challengeResult.yourD < challengeResult.targetD ? "✅" : "🤝"}</div>
            <h3 className={cn("mt-3 text-2xl font-bold", challengeResult.won ? "text-primary" : "text-foreground")}>
              {!challengeResult.won ? T("挑战失败", "Challenge failed") : challengeResult.yourD > challengeResult.targetD ? T("超越成功!", "You beat them!") : challengeResult.yourD < challengeResult.targetD ? T("挑战完成", "Challenge complete") : T("打成平手!", "It's a tie!")}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {lang === "en" ? (!challengeResult.won
                ? `Not this time. Try again to beat ${challengeResult.nickname}!`
                : challengeResult.rank
                  ? (challengeResult.yourD > challengeResult.targetD
                      ? `With D ${challengeResult.yourD.toFixed(1)} you passed ${challengeResult.nickname}. You're now #${challengeResult.rank}!`
                      : challengeResult.yourD < challengeResult.targetD
                        ? `Challenge done (D ${challengeResult.yourD.toFixed(1)}). You're now #${challengeResult.rank}.`
                        : `Tied with ${challengeResult.nickname} (D ${challengeResult.yourD.toFixed(1)}). You're now #${challengeResult.rank} (earlier score ranks first on ties).`)
                  : "Challenge won! Log in to get on the leaderboard.")
              : !challengeResult.won
                ? `这次没做对,再来一次超越 ${challengeResult.nickname}!`
                : challengeResult.rank
                  ? (challengeResult.yourD > challengeResult.targetD
                      ? `你以 D ${challengeResult.yourD.toFixed(1)} 超越了 ${challengeResult.nickname},当前第 ${challengeResult.rank} 名!`
                      : challengeResult.yourD < challengeResult.targetD
                        ? `完成挑战(D ${challengeResult.yourD.toFixed(1)}),当前第 ${challengeResult.rank} 名。`
                        : `与 ${challengeResult.nickname} 打成平手(D ${challengeResult.yourD.toFixed(1)}),当前第 ${challengeResult.rank} 名(同分先到者靠前)。`)
                  : "挑战成功!登录后成绩即可上榜。"}
            </p>
            <button onClick={() => setChallengeResult(null)} className="mt-4 h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground">{T("知道了", "Got it")}</button>
          </div>
        </div>
      )}
    </>
  );

  // 听算:语音准备中 —— 覆盖式"准备中"界面,准备好再进倒计时/播放(点开始后先呈现,避免开头空白)
  if (preparing) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" />
          <span className="relative text-3xl">🔊</span>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{T("正在准备语音…", "Preparing audio…")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{prepLong ? T("网络较慢,语音还在下载…", "Slow network, audio still downloading…") : T("合成好整段题目后再开始播报,确保从第一个数完整听到", "The whole problem is generated before playback, so you hear it from the very first number")}</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        {prepLong && (
          <button type="button" onClick={() => forceWebRef.current()} className="rounded-full border border-border bg-background/80 px-4 py-1.5 text-sm text-foreground hover:bg-muted">
            {T("先用浏览器语音播报这道题", "Play this one with the browser voice")}
          </button>
        )}
      </div>
    );
  }

  if (phase === "config") {
    return (
      <div className="hw-lg hw-compact flex flex-col gap-3">
        {overlays}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5 text-primary" />
            <span className="whitespace-nowrap text-xl font-black text-foreground sm:text-2xl">{tx(MODE_LABEL[cfg.mode])}{cfg.op !== "addsub" ? ` · ${tx(OP_LABEL[cfg.op])}` : ""}</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:inline">· {tx("训练配置")}</span>
          </div>
          {!isMd && onMistakeModeChange && (
            <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[11px] text-muted-foreground">
              <span>{tx("只练错题")}</span>
              <Switch checked={mistakeMode} onCheckedChange={onMistakeModeChange} />
            </label>
          )}
        </div>

        {/* 综合训练 / AI 陪练 双模式 tab(仅加减) */}
        {cfg.op === "addsub" && !mistakeMode && (
          <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
            <button onClick={() => setCoachOn(false)} className={cn("flex h-8 flex-1 items-center justify-center rounded text-[12px] font-medium transition-colors", !coachOn ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {tx("综合训练")}
            </button>
            <button onClick={() => setCoachOn(true)} className={cn("flex h-8 flex-1 items-center justify-center gap-1.5 rounded text-[12px] font-medium transition-colors", coachOn ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {tx("AI 陪练")}
              <span className="rounded-full bg-accent px-1.5 py-px text-[9px] font-semibold text-accent-foreground">{T(`第${coachProg.stage}关`, `Stage ${coachProg.stage}`)}</span>
            </button>
          </div>
        )}

        {/* 综合训练 · 教练建议栏(四因子:题型→时间→位数→笔数,位数优先于笔数) */}
        {advice && (
          <div className="flex items-start justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-primary">💡 {T("教练建议:", "Coach tip: ")}{advice.title}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{advice.detail}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {advice.coachStage ? (
                <button onClick={() => { setCoachOn(true); setCoachProg(setCoachStage(advice.coachStage!)); }} className="h-7 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">{T("去专项", "Practice it")}</button>
              ) : (
                <button onClick={() => setCfg({ ...cfg, ...advice.patch })} className="h-7 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">{T("一键应用", "Apply")}</button>
              )}
              <button onClick={() => { dismissAdvice(advice.key); setAdviceVer((v) => v + 1); }} className="h-7 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground">{T("忽略", "Dismiss")}</button>
            </div>
          </div>
        )}

        {/* AI 陪练面板(2026-11-08 可视化升级 → components/CoachPanel):进阶地图 + 本关正确率环 / 最近 20 题 + 指法掌握度 */}
        {coachActive && (
          <CoachPanel prog={coachProg} stage={coachStage} lessonIdx={coachLessonIdx} T={T} tx={tx}
            onStage={(id) => setCoachProg(setCoachStage(id))} onLesson={setCoachLesson} />
        )}

        {!isMd && mistakeMode && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-[11px] text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{T("「只练错题」已开启：题目将从错题池抽取，配置仅影响闪现速度。", "“Mistakes only” is on: problems come from your mistake pool; settings only affect flash speed.")}</span>
          </div>
        )}

        {/* 训练配置(2026-10-12 与教练端统一为表单式:一行一个参数,数字框可键入、◀▶ 微调) */}
        <div className="cfg-host"><div className="cfg-panel cfg-grid">
          {cfg.mode !== "flash" && (
            <Row label="运算">
              <Seg options={opsForMode(cfg.mode).map((o) => ({ v: o, label: OP_LABEL[o] }))} value={cfg.op}
                onChange={(o) => { if (o !== "addsub") onMistakeModeChange?.(false); setCfg({ ...cfg, op: o }); }} />
            </Row>
          )}
          {cfg.op === "mul" && (
            <Row label="位数">
              <Pair label="被乘数"><Num value={cfg.mulA} min={1} max={10} unit="位" onChange={(n) => setCfg({ ...cfg, mulA: n })} /></Pair>
              <Pair label="乘数"><Num value={cfg.mulB} min={1} max={10} unit="位" onChange={(n) => setCfg({ ...cfg, mulB: n })} /></Pair>
            </Row>
          )}
          {cfg.op === "div" && (
            <Row label="位数">
              {/* 除数位+商位 ≤ 15,保证被除数(=除数×商)不超出 JS 安全整数精度 */}
              <Pair label="除数"><Num value={cfg.divD} min={1} max={Math.min(8, 15 - cfg.divQ)} unit="位" onChange={(n) => setCfg({ ...cfg, divD: n })} /></Pair>
              <Pair label="商"><Num value={cfg.divQ} min={1} max={Math.min(8, 15 - cfg.divD)} unit="位" onChange={(n) => setCfg({ ...cfg, divQ: n })} /></Pair>
            </Row>
          )}
          {cfg.op === "div" && (
            <Row label="够除">
              <Seg options={[{ v: "any", label: "两者均可" }, { v: "yes", label: "够除" }, { v: "no", label: "不够除" }]} value={cfg.divEnough} onChange={(v) => setCfg({ ...cfg, divEnough: v })} />
              <span className="text-[11px] text-muted-foreground">{tx("够除 = 整除;不够除 = 除不尽:无小数时答「商……余数」,有小数时答案四舍五入到保留位数")}</span>
            </Row>
          )}
          {cfg.mode === "glance" && cfg.op !== "addsub" && (
            <Row label="小数">
              <Seg options={[{ v: "no", label: "无" }, { v: "yes", label: "有" }]} value={cfg.decimals ? "yes" : "no"} onChange={(v) => setCfg({ ...cfg, decimals: v === "yes" })} />
              {cfg.decimals && (<><span className="ml-2 text-xs text-muted-foreground">{tx("保留")}</span><Num value={cfg.decimalPlaces} min={0} max={4} unit="位" onChange={(v) => setCfg({ ...cfg, decimalPlaces: v })} /></>)}
              <span className="text-[11px] text-muted-foreground">{cfg.op === "div" ? tx("被除数、除数都是小数;商的位数含小数位(商4位·保留2位 → 12.34)") : tx("随机小数位,数值在 0.01–100;答案四舍五入到保留位数")}</span>
            </Row>
          )}
          {!isMd && !coachActive && (
            <Row label="位数">
              <Pair label="最小"><Num value={cfg.digits} min={1} max={12} unit="位" onChange={(v) => setCfg({ ...cfg, digits: v, digitsMax: Math.max(v, cfg.digitsMax) })} /></Pair>
              <Pair label="最大"><Num value={cfg.digitsMax} min={cfg.digits} max={12} unit="位" onChange={(v) => setCfg({ ...cfg, digitsMax: v })} /></Pair>
            </Row>
          )}
          {!isMd && coachActive && (
            <Row label="位数"><Num value={Math.min(6, cfg.digits)} min={1} max={6} unit="位" onChange={(v) => setCfg({ ...cfg, digits: v, digitsMax: v })} /><span className="text-[11px] text-muted-foreground">{T("各档指法均受本关约束", "every rod follows this stage's fingering")}</span></Row>
          )}
          {!isMd && <Row label="笔数"><Num value={cfg.count} min={1} max={200} unit="笔" onChange={(v) => setCfg({ ...cfg, count: v })} /></Row>}
          {!isMd && !coachActive && (
            <Row label="题型"><Seg options={[{ v: "add", label: "纯加" }, { v: "mix", label: "加减混合" }]} value={cfg.includeSub ? "mix" : "add"} onChange={(v) => setCfg({ ...cfg, includeSub: v === "mix" })} /></Row>
          )}
          {(cfg.mode === "flash" || cfg.mode === "glance") && cfg.op === "addsub" && !coachActive && (
            <Row label="计算方法"><Seg options={[{ v: "mental", label: "心算" }, { v: "bead", label: "珠算" }]} value={cfg.method} onChange={(v) => setCfg({ ...cfg, method: v })} /><span className="text-[11px] text-muted-foreground">{cfg.method === "bead" ? tx("每一笔显示珠码,脑中拨珠(心算导入)") : tx("显示数字")}</span></Row>
          )}
          {cfg.mode === "flash" && (
            <Row label="每笔"><Num value={cfg.speedMs / 1000} min={0.05} max={5} step={0.05} decimals={2} unit="秒" onChange={(v) => setCfg({ ...cfg, speedMs: Math.round(v * 1000) })} /></Row>
          )}
          {cfg.mode === "listen" && (
            <>
              <Row label="语速"><Num value={cfg.listenSpeed} min={1} max={10} unit="档" onChange={(v) => setCfg({ ...cfg, listenSpeed: v })} /><span className="text-[11px] text-muted-foreground">{tx("1 慢 · 5 正常 · 10 极快")}</span></Row>
              <Row label="间隔"><Num value={cfg.listenSec / 1000} min={0} max={6} step={0.1} decimals={2} unit="秒" onChange={(v) => setCfg({ ...cfg, listenSec: Math.round(v * 1000) })} /></Row>
              {/* 2026-10-13 用户「广场听算一屏放不下」:报加号+报数位、语言+音色各并成一行 */}
              <Row label="报数">
                <span className="text-xs text-muted-foreground">{tx("加号")}</span><Seg options={[{ v: "yes", label: "有" }, { v: "no", label: "无" }]} value={cfg.announcePlus ? "yes" : "no"} onChange={(v) => setCfg({ ...cfg, announcePlus: v === "yes" })} />
                <span className="ml-2 text-xs text-muted-foreground">{tx("数位")}</span><Seg options={[{ v: "yes", label: "整读带单位" }, { v: "no", label: "逐位读" }]} value={cfg.announceUnit ? "yes" : "no"} onChange={(v) => setCfg({ ...cfg, announceUnit: v === "yes" })} />
              </Row>
              <Row label="音色">
                <Seg options={[{ v: "zh", label: "中文" }, { v: "en", label: "English" }]} value={cfg.listenLang} onChange={(v) => setCfg({ ...cfg, listenLang: v })} />
                <span className="ml-2 text-xs text-muted-foreground">{tx("音色")}</span><Seg options={[{ v: "female", label: "女声" }, { v: "male", label: "男声" }]} value={cfg.listenVoice} onChange={(v) => setCfg({ ...cfg, listenVoice: v })} />
              </Row>
              {cfg.listenLang === "zh" && import.meta.env.DEV && (
                <Row label="音源"><Seg options={[{ v: "E", label: "E 豆包大词块(推荐)" }, { v: "D", label: "D 豆包" }, { v: "C", label: "C 普通话" }, { v: "A", label: "A" }, { v: "B", label: "B" }]} value={bankVariant} onChange={(v: BankVariant) => { setBankVariant(v); setBankVariantState(v); }} /><span className="text-[11px] text-muted-foreground">{tx("D 为豆包 2.0;C 为 macOS 普通话;A/B 为旧线路")}</span></Row>
              )}
            </>
          )}
          {cfg.mode === "glance" && (
            <Row label="限时"><Num value={cfg.glanceLimitSec} min={0} max={120} unit="秒" onChange={(v) => setCfg({ ...cfg, glanceLimitSec: v })} /><span className="text-[11px] text-muted-foreground">{tx("0 = 不限时")}</span></Row>
          )}
          <Row label="场数"><Num value={cfg.rounds} min={1} max={200} unit="场" onChange={(v) => setCfg({ ...cfg, rounds: v })} /></Row>
          {cfg.mode === "glance" && (
            <Row label="字号" span>
              <div className="flex flex-1 items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{T("小", "S")}</span>
                <Slider value={[glanceScale]} onValueChange={(v) => setGlanceScale(v[0])} min={0.5} max={1} step={0.05} className="max-w-xs flex-1" />
                <span className="text-[10px] text-muted-foreground">{T("大", "L")}</span>
                {/* 示例数字跟闪算一致(2026-11-03 孟阳「字号示例没做,跟闪算统一」) */}
                <span className="font-hand text-2xl font-bold leading-none text-foreground" style={{ fontSize: `${Math.max(1, glanceScale * 2.6)}rem` }}>{grp("3141592653".slice(0, Math.max(1, Math.min(6, cfg.digitsMax))))}</span>
              </div>
            </Row>
          )}
          {cfg.mode === "flash" && (
            <Row label="字号" span>
              <div className="flex flex-1 items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{T("小", "S")}</span>
                <Slider value={[cfg.flashScale]} onValueChange={(v) => setCfg({ ...cfg, flashScale: v[0] })} min={0.1} max={1.5} step={0.05} className="max-w-xs flex-1" />
                <span className="text-[10px] text-muted-foreground">{T("大", "L")}</span>
                <span className="font-hand text-2xl font-bold leading-none text-foreground" style={{ fontSize: `${Math.max(1, cfg.flashScale * 2.6)}rem` }}>{grp("3141592653".slice(0, Math.max(1, Math.min(6, cfg.digitsMax))))}</span>
              </div>
            </Row>
          )}
        </div></div>

        {/* 粘底:底部 5 大 tab 高约 91px,按钮始终停在其上方,不用滚动也能点开始 */}
        <Button onClick={beginCountdown} size="lg" className="cfg-start sticky bottom-[6.5rem] z-20 h-12 rounded-full text-xl font-black">
          <Play className="mr-2 h-6 w-6" /> {tx("开始挑战")}
        </Button>

        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground/80">{T("难度系数 D 是怎么算的?", "How is difficulty D calculated?")}</span>
            <button onClick={() => setShowDiffHelp(true)} className="shrink-0 rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/10">{T("更多 ›", "More ›")}</button>
          </div>
          <div className="mt-1 text-[10px]">{T("加减:D = 位数分 × 速度分 × 笔数分 × 加减系数;乘法:看两乘数位数;除法:只看除数和商的位数(商权重更高),与被除数无关。超过 5 位有分水岭。", "Add/Sub: D = digit score × speed score × term score × sub factor. Multiply: based on both factors' digits. Divide: only divisor and quotient digits count (quotient weighs more), not the dividend. 5 digits is a watershed.")}</div>
        </div>
      </div>
    );
  }

  // ── 出题大屏(接近整屏):ready / playing / answer / result ──
  const glanceCol = cfg.mode === "glance" && cfg.op === "addsub"; // 看算·加减:竖式整列
  const glanceExpr = cfg.mode === "glance" && cfg.op !== "addsub"; // 看算·乘除:算式 a × b
  // 作答阶段是否显示题目:仅「不限时」常驻;限时模式题目只在呈现阶段可见,作答时隐藏(凭记忆填)
  const showColumn = glanceCol && cfg.glanceLimitSec === 0;
  const showExpr = glanceExpr && cfg.glanceLimitSec === 0;
  const opLabel = cfg.op !== "addsub" ? ` · ${tx(OP_LABEL[cfg.op])}` : "";

  return createPortal(
    <div
      className={cn("flash-stage fixed inset-0 z-50 flex flex-col overflow-y-auto text-white", eyeCare && "stage-light")}
      style={{ background: eyeCare ? EYE_CARE_STAGE_BG : "radial-gradient(120% 90% at 50% 25%, #3a2513 0%, #1c1108 55%, #0e0803 100%)" }}
    >
      <div className="flex shrink-0 items-center justify-between px-5 py-3">
        <span className="text-sm font-bold text-white/90">
          {tx(MODE_LABEL[cfg.mode])}{opLabel}
          {retryIdx != null
            ? <span className="ml-2 text-amber-300">· {T("再练一次", "Retry")}</span>
            : cfg.rounds > 1 && <span className="ml-2 text-white/55">{T(`第 ${session.round + 1} / ${cfg.rounds} 场`, `Round ${session.round + 1} / ${cfg.rounds}`)}</span>}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => { const v = !praiseOn; setPraiseOnState(v); setPraiseOn(v); if (!v) stopPraise(); }} title={praiseOn ? tx("关掉鼓励语音") : tx("打开鼓励语音")}
            className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-white/10", praiseOn ? "border-white/25 text-white/80" : "border-white/15 text-white/40")}>{praiseOn ? "🔊" : "🔇"} {tx("语音")}</button>
          <button onClick={() => { const v = !fxOn; setFxOnState(v); setFxOn(v); }} title={fxOn ? tx("关掉答题特效") : tx("打开答题特效")}
            className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-white/10", fxOn ? "border-white/25 text-white/80" : "border-white/15 text-white/40 line-through")}>✨ {tx("特效")}</button>
          <button onClick={retryIdx != null ? cancelRetry : reset} className="rounded-full border border-white/25 px-3 py-1 text-xs text-white/80 transition-colors hover:bg-white/10">✕ {retryIdx != null ? T("返回结果", "Back to results") : T("退出", "Exit")}</button>
        </div>
      </div>
      {/* 作答鼓励浮层:不挡操作(pointer-events-none),几秒后自动消失 */}
      {cheerState && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center">
          {fxOn && <PraiseBurst key={cheerState.id} correct={cheerState.correct} big={cheerState.key.startsWith("s")} />}
          <div className="animate-pop-in relative z-10 flex flex-col items-center gap-2 rounded-3xl bg-black/55 px-8 py-5 backdrop-blur-sm">
            <div className="text-6xl">{cheerState.emoji}</div>
            <div className={cn("text-center text-3xl font-black", cheerState.correct ? "text-emerald-300" : "text-amber-200")}>{praiseText(cheerState.key, praiseLang)}</div>
            {cheerState.correct && cheerState.streak >= 2 && <div className="rounded-full bg-amber-400/20 px-3 py-0.5 text-sm font-bold text-amber-200">🔥 {lang === "en" ? `${cheerState.streak} in a row` : `连对 ${cheerState.streak} 题`}</div>}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10">
        {phase === "ready" && (
          <div className="flex flex-col items-center">
            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-white/55">{T("准备", "Ready")}</div>
            <div key={countdown} className="animate-pop-in font-mono-tabular font-bold text-white" style={{ fontSize: "clamp(6rem,22vw,15rem)", lineHeight: 1 }}>{countdown}</div>
          </div>
        )}

        {phase === "prep" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-xs uppercase tracking-[0.3em] text-white/55">{T("准备下一题", "Next problem")}</div>
            <div className="animate-pulse font-bold text-white" style={{ fontSize: "clamp(2.5rem,9vw,5rem)" }}>{T("准备…", "Get ready…")}</div>
            <div className="font-mono-tabular text-white/60">{T(`第 ${session.round + 1} / ${cfg.rounds} 题`, `Problem ${session.round + 1} / ${cfg.rounds}`)}</div>
          </div>
        )}

        {phase === "playing" && problem && cfg.mode === "flash" && (
          <div className="flex w-full max-w-5xl flex-col items-center gap-6">
            <div className="h-1 w-full max-w-3xl overflow-hidden rounded bg-white/15">
              <div className="h-full bg-amber-400 transition-all duration-100" style={{ width: `${((Math.min(stepIdx, problem.terms.length - 1) + 1) / problem.terms.length) * 100}%` }} />
            </div>
            <div className="flex min-h-[44vh] items-center justify-center">
              {showTerm && stepIdx < problem.terms.length ? (
                cfg.method === "bead" && cfg.op === "addsub" ? (
                  <div key={stepIdx} className="flex items-center gap-6" style={{ transform: `scale(${Math.min(1.4, cfg.flashScale / 0.6)})` }}>
                    {problem.signs[stepIdx] === "-" && <span className="font-hand font-bold leading-none" style={{ fontSize: "clamp(3rem,10vw,7rem)" }}>-</span>}
                    <Soroban value={problem.terms[stepIdx]} tone="dark" big />
                  </div>
                ) : (
                <div key={stepIdx} className="flex items-baseline gap-3" style={{ transform: `scale(${cfg.flashScale})` }}>
                  {problem.signs[stepIdx] === "-" && <span className="font-hand font-bold leading-none text-white" style={{ fontSize: "clamp(5rem,22vw,15rem)" }}>-</span>}
                  <span className="font-hand font-bold leading-none text-white" style={{ fontSize: "clamp(5rem,22vw,15rem)" }}>{fmtNum(problem.terms[stepIdx])}</span>
                </div>
                )
              ) : (
                <div className="h-3 w-3" />
              )}
            </div>
            <div className="font-mono-tabular text-sm text-white/50">{Math.min(stepIdx + 1, problem.terms.length)} / {problem.terms.length} · {cfg.speedMs}ms</div>
          </div>
        )}

        {phase === "playing" && problem && cfg.mode === "listen" && (
          <div className="flex flex-col items-center gap-6 text-white">
            <div className="animate-bounce select-none" style={{ fontSize: "clamp(5rem,16vw,9rem)" }}>🔊</div>
            <p className="text-2xl font-semibold text-white/90">{T("请听题,用心算～", "Listen and compute in your head")}</p>
            {ttsFallback && (
              <p className="text-xs text-white/50">{T("云端语音暂不可用,已用浏览器语音兜底(若仍无声,请确认已配置 OPENAI_API_KEY)", "Cloud audio unavailable; using browser speech instead (if still silent, check that OPENAI_API_KEY is set)")}</p>
            )}
            <div className="h-1 w-64 overflow-hidden rounded bg-white/15">
              <div className="h-full animate-pulse bg-amber-400" style={{ width: "100%" }} />
            </div>
          </div>
        )}

        {phase === "playing" && problem && cfg.mode === "glance" && cfg.glanceLimitSec > 0 && (
          <div className={cn("flex w-full flex-col items-center gap-5", glanceCol ? "max-w-4xl" : "max-w-xl")}>
            {glanceCol && <GlanceStack terms={problem.terms} signs={problem.signs} bead={cfg.method === "bead"} tall scale={glanceScale} />}
            {glanceExpr && problem.op && (
              <FitBox dep={`${problem.terms[0]}${problem.op}${problem.terms[1]}`} heightVh={46}>
                <div className="whitespace-nowrap px-12 py-8 font-hand font-bold text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]" style={{ fontSize: "5rem" }}>
                  {fmtNum(problem.terms[0])} <span className="text-amber-300">{problem.op}</span> {fmtNum(problem.terms[1])}
                </div>
              </FitBox>
            )}
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/70">
              <span>{T("记住这道题", "Memorize it")}</span>
              <span className={cn("rounded-full border px-2 py-0.5 font-mono-tabular normal-case tracking-normal", answerLeft <= 3 ? "border-red-400/60 text-red-300 animate-pulse" : "border-white/25 text-white/70")}>⏱ {answerLeft}s</span>
            </div>
          </div>
        )}

        {phase === "answer" && problem && (
          /* 2026-11-03 孟阳「平板这个键盘不全」:平板横屏时题目在左、键盘在右(.answer-split,index.css),竖屏 / 手机仍上下排 */
          <div className={cn("flex w-full flex-col items-center gap-5", showColumn ? "max-w-4xl" : showExpr ? "max-w-xl" : "max-w-md", (showColumn || (showExpr && problem.op)) && "answer-split")}>
            {(showColumn || (showExpr && problem.op)) && (
              <div className="answer-left w-full">
                {showColumn && <GlanceStack terms={problem.terms} signs={problem.signs} scale={glanceScale} />}
                {showExpr && problem.op && (
                  <FitBox dep={`${problem.terms[0]}${problem.op}${problem.terms[1]}`} heightVh={46}>
                    <div className="whitespace-nowrap px-12 py-8 font-hand font-bold text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]" style={{ fontSize: "5rem" }}>
                      {fmtNum(problem.terms[0])} <span className="text-amber-300">{problem.op}</span> {fmtNum(problem.terms[1])}
                    </div>
                  </FitBox>
                )}
              </div>
            )}
            <div className="answer-right flex w-full flex-col items-center gap-5">
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">{showColumn ? T("看清竖式,填答案", "Read the column and answer") : showExpr ? tx("算出结果,填答案") : tx("凭记忆填答案")}</div>
            {problem.rem != null && <div className="-mt-2 text-sm font-bold text-amber-300">{tx("除不尽:填「商 余 余数」,如 22÷8 → 2余6")}</div>}
            {!!problem.places && <div className="-mt-2 text-sm font-bold text-amber-300">{T(`答案保留 ${problem.places} 位小数`, `Round to ${problem.places} decimal places`)}</div>}
            <Input
              autoFocus
              inputMode={softKey(problem.places ? "decimal" : "numeric")}
              value={input}
              onChange={(e) => setInput(problem.rem != null ? e.target.value.replace(/[.。．…]+/g, REM_SEP).replace(/(余.*)余/g, "$1") : e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input.trim() && submit(input)}
              placeholder={T("点下方数字键 / 键盘输入 / 语音", "Keypad / keyboard / voice")}
              className="h-16 w-full rounded-xl border-2 border-amber-400 bg-white text-center font-mono-tabular text-3xl font-bold text-foreground md:text-3xl" /* md:text-3xl:基础 Input 自带 md:text-sm,宽屏会把答案缩成 14px(2026-11-03「每个项目字体不统一」) */
            />
            {cloud.recording && (
              <div className="text-center text-xs text-red-200">{T("🎙️ 录音中,说出答案后点「结束」…", "🎙️ Recording: say your answer, then tap “Stop”…")}</div>
            )}
            {cloud.busy && (
              <div className="text-center text-xs text-white/70">{T("识别中…", "Recognizing…")}</div>
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
              <button onClick={() => setInput((v) => v.slice(0, -1))} className="h-14 rounded-xl border border-white/25 bg-white/10 text-xl text-white transition-colors hover:bg-white/20 active:bg-white/30" aria-label={T("删除", "Delete")}>⌫</button>
              <button onClick={() => setInput((v) => v + "0")} className="h-14 rounded-xl border border-white/25 bg-white/10 font-mono-tabular text-2xl font-semibold text-white transition-colors hover:bg-white/20 active:bg-white/30">0</button>
              {problem.rem != null
                ? <button onClick={() => setInput((v) => (!v || v.includes(REM_SEP) ? v : v + REM_SEP))} className="h-14 rounded-xl border border-amber-300/50 bg-white/10 text-2xl font-semibold text-white transition-colors hover:bg-white/20 active:bg-white/30" aria-label={T("余数", "Remainder")}>{tx("余")}</button>
                : problem.places
                ? <button onClick={() => setInput((v) => (v.includes(".") ? v : (v || "0") + "."))} className="h-14 rounded-xl border border-amber-300/50 bg-white/10 font-mono-tabular text-2xl font-semibold text-white transition-colors hover:bg-white/20 active:bg-white/30" aria-label={T("小数点", "Decimal point")}>.</button>
                : <button onClick={() => setInput("")} className="h-14 rounded-xl border border-white/25 bg-white/10 text-sm text-white transition-colors hover:bg-white/20 active:bg-white/30">{tx("清空")}</button>}
            </div>
            {(!!problem.places || problem.rem != null) && <button onClick={() => setInput("")} className="-mt-2 text-xs text-white/60 underline-offset-2 hover:underline">{tx("清空")}</button>}
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
                  {cloud.busy ? T("识别中…", "Recognizing…")
                    : cloud.recording ? (<><MicOff className="mr-1.5 h-3.5 w-3.5 animate-pulse" /> {T("结束", "Stop")}</>)
                    : (<><Mic className="mr-1.5 h-3.5 w-3.5" /> {T("语音作答", "Voice answer")}</>)}
                </Button>
              )}
              <Button onClick={() => submit(input)} disabled={!input.trim()} className="flex-1">{tx("提交")}</Button>
            </div>
            {cfg.mode === "listen" && (
              <button onClick={() => { setStepIdx(0); setPhase("playing"); }} className="text-xs text-white/70 underline-offset-2 hover:underline">{tx("再听一遍")}</button>
            )}
            </div>
          </div>
        )}

        {phase === "result" && problem && result && (
          <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl bg-card p-5 text-foreground shadow-2xl animate-slide-up">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full border-2",
            (lastRetry0 ? lastRetry0.correct : result.correct)
              ? "border-primary bg-primary/5 text-primary"
              : "border-destructive bg-destructive/5 text-destructive",
          )}
        >
          {(lastRetry0 ? lastRetry0.correct : result.correct) ? <Check className="h-7 w-7" strokeWidth={2.5} /> : <X className="h-7 w-7" strokeWidth={2.5} />}
        </div>
        <div className="text-center">
          <div className={cn("text-2xl font-bold", (lastRetry0 ? lastRetry0.correct : result.correct) ? "text-primary" : "text-destructive")}>
            {lastRetry0
              ? (lastRetry0.correct ? T("🎉 再练成功 · 这次答对了!", "🎉 Got it right this time!") : T("再练仍答错", "Still not right"))
              : (result.correct ? T("🎉 恭喜你答对!", "🎉 Correct!") : T("答错了", "Not quite"))}
          </div>
          {lastRetry0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              {T("这次你答的", "You answered")} <span className={cn("font-mono-tabular font-semibold", lastRetry0.correct ? "text-primary" : "text-destructive")}>{fmtAns(lastRetry0.answered)}</span>
              {lastRetry0.correct ? T(" · 再练不计入榜单", " · retries don't count toward the board") : T(" · 别灰心,再试一次", " · don't give up, try again")}
            </div>
          )}
        </div>
        {coachActive && (() => {
          // 结果页本关进度条(2026-11-08 可视化升级):近 N 题答对数 / 通关所需,已通关金色
          const w = stageWindow(coachProg, coachStage.id), passed = coachProg.passed.includes(coachStage.id);
          return (
            <div className="w-full rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
              <div className="flex items-baseline justify-between text-[11px]"><span className="font-semibold text-primary">{lang === "en" ? `AI Coach · Stage ${coachStage.id} “${tx(coachStage.name)}”` : `AI 陪练 · 第${coachStage.id}关「${coachStage.name}」`}</span>
                <span className="font-mono-tabular text-muted-foreground">{passed ? T("已通关 ✓", "Passed ✓") : `${w.correct} / ${Math.ceil(w.need * 0.8)} ${T("通关", "to pass")}`}</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all duration-700", passed ? "bg-gradient-to-r from-amber-300 to-amber-500" : "bg-gradient-to-r from-primary/70 to-primary")} style={{ width: `${passed ? 100 : Math.min(100, (w.correct / Math.max(1, Math.ceil(w.need * 0.8))) * 100)}%` }} /></div>
              <div className="mt-1 text-[10px] text-muted-foreground">{T("陪练成绩不计入榜单", "Coach practice isn't ranked")}</div>
            </div>
          );
        })()}
        {result.correct && saveState && (
          saveState.ok ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Check className="h-3.5 w-3.5" /> {T("成绩已上榜", "Score posted")}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {saveState.error === "未登录" ? T("未登录,成绩未上传", "Not logged in; score not uploaded") : T("成绩未上传", "Score not uploaded")}
              </div>
              {saveState.error !== "未登录" && lastSubmitRef.current && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saveState.retrying}
                  onClick={async () => {
                    setSaveState({ ok: false, error: saveState.error, retrying: true });
                    const r = await submitScore(lastSubmitRef.current!);
                    setSaveState({ ok: r.ok, error: r.error });
                    if (r.ok) toast({ title: T("已补交成绩", "Score uploaded") });
                  }}
                >
                  {saveState.retrying ? T("上传中…", "Uploading…") : T("重试上传", "Retry upload")}
                </Button>
              )}
            </div>
          )
        )}
        {cfg.rounds > 1 && (
          <div className="w-full rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{T(`本轮 ${cfg.rounds} 场总计`, `Total of ${cfg.rounds} rounds`)}</div>
            <div className="mt-1 flex items-center justify-center font-mono-tabular">
              <div className="text-center">
                <div className="text-xl font-semibold text-foreground">{session.correct} / {cfg.rounds}</div>
                <div className="text-[10px] text-muted-foreground">{T("正确", "Correct")}</div>
              </div>
            </div>
            <div className="mt-3 max-h-60 overflow-y-auto rounded-md border border-border bg-card">
              <table className="w-full font-mono-tabular text-[11px]">
                <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">#</th>
                    <th className="px-2 py-1 text-left font-medium">{T("算式", "Problem")}</th>
                    <th className="px-2 py-1 text-right font-medium">{tx("答案")}</th>
                    <th className="px-2 py-1 text-right font-medium">{T("你的", "Yours")}</th>
                    <th className="px-2 py-1 text-center font-medium">{T("再练", "Retry")}</th>
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
                          <td className="px-2 py-1 text-right">{ansStr(r.problem)}</td>
                          <td className={cn("px-2 py-1 text-right", r.correct ? "text-primary" : "text-destructive")}>{fmtAns(r.answered)}</td>
                          <td className="px-2 py-1 text-center whitespace-nowrap">
                            {r.correct ? (
                              <span className="text-muted-foreground/40">—</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                {last && (
                                  <button onClick={() => toggleExpand(i)} title={T("展开重练记录", "Show retry history")}
                                    className={cn("inline-flex items-center rounded px-0.5", last.correct ? "text-primary" : "text-destructive")}>
                                    {last.correct ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <X className="h-3.5 w-3.5" strokeWidth={2.5} />}
                                    {retries.length > 1 && <span className="ml-0.5 text-[9px]">×{retries.length}</span>}
                                  </button>
                                )}
                                <button onClick={() => startRetry(i)}
                                  className="inline-flex items-center gap-0.5 rounded border border-primary/40 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10">
                                  <RotateCcw className="h-3 w-3" /> {T("再练", "Retry")}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {expanded && retries.length > 0 && (
                          <tr className="bg-muted/30">
                            <td colSpan={5} className="px-3 py-1.5">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                                <span className="font-medium text-foreground/70">{T("重练记录", "Retries")}</span>
                                {retries.map((a, k) => (
                                  <span key={k} className={cn("inline-flex items-center gap-0.5", a.correct ? "text-primary" : "text-destructive")}>
                                    {T(`第${k + 1}次 · 你的`, `#${k + 1} · yours`)} {fmtAns(a.answered)} {a.correct ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
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
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{T("正确答案", "Correct answer")}</div>
          <div className="my-0.5 font-mono-tabular text-2xl font-semibold">{ansStr(problem)}</div>
          {!result.correct && retries0.length === 0 && (
            <div className="text-[11px] text-muted-foreground">
              {T("你的回答", "Your answer")} <span className="font-mono-tabular font-medium text-destructive">{fmtAns(result.answered)}</span>
            </div>
          )}
          {!result.correct && retries0.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
              <span className="text-muted-foreground">{T("作答记录", "Attempts")}</span>
              <span className="inline-flex items-center gap-0.5 font-mono-tabular text-destructive">
                {T("首次", "1st")} {fmtAns(result.answered)} <X className="h-3 w-3" strokeWidth={2.5} />
              </span>
              {retries0.map((a, k) => (
                <span key={k} className={cn("inline-flex items-center gap-0.5 font-mono-tabular", a.correct ? "text-primary" : "text-destructive")}>
                  {T(`再练${k + 1}`, `Retry ${k + 1}`)} {fmtAns(a.answered)} {a.correct ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 border-t border-border pt-2 font-mono-tabular text-sm text-muted-foreground break-words leading-relaxed">
            {gExpr(problem)}{" = "}{ansStr(problem)}
          </div>
          {problem.classes && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-border pt-2">
              <span className="text-[10px] text-muted-foreground">{T("分笔指法", "Fingering by term")}</span>
              {problem.classes.map((c, i) => {
                const isTarget = (coachStage.target as string[]).includes(c);
                return (
                  <span key={i} className={cn("rounded px-1.5 py-0.5 font-mono-tabular text-[10px]", isTarget ? "bg-primary/10 font-medium text-primary" : "bg-muted text-muted-foreground")}>
                    {i + 1}·{problem.signs[i] === "-" ? "−" : i === 0 ? "" : "+"}{problem.terms[i]} {tx(c)}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {cfg.rounds === 1 && !result.correct && (
          <div className="w-full rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-foreground/80">
                {retries0.some((a) => a.correct) ? T("已巩固这道题,还想再练?", "Got it now. Practice again?") : T("答错了?原题再练一次", "Missed it? Try the same problem again")}
              </span>
              <Button size="sm" variant="outline" onClick={() => startRetry(0)} className="h-7 px-2 text-[11px]">
                <RotateCcw className="mr-1 h-3 w-3" /> {T("再练一次", "Try again")}
              </Button>
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground">{T("再练仅供巩固练习,不计入榜单与关卡进度(已知道答案,成绩不作数)。", "Retries are for practice only and don't count toward the board or stage progress (you already know the answer).")}</div>
          </div>
        )}
        {/* AI 教练:每场练完直接在结果页给进阶建议(升笔数/压时间/升位数) */}
        {advice && !coachActive && cfg.op === "addsub" && !mistakeMode && retryLog[0] === undefined && (
          <div className="flex w-full items-start justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-left">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-primary">🎯 {T("AI 教练:", "AI Coach: ")}{advice.title}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{advice.detail}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {advice.coachStage ? (
                <button onClick={() => { setCoachOn(true); setCoachProg(setCoachStage(advice.coachStage!)); reset(); }} className="h-7 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground">{T("去专项", "Practice it")}</button>
              ) : (
                <button onClick={() => { setCfg({ ...cfg, ...advice.patch }); }} className="h-7 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground">{T("一键应用", "Apply")}</button>
              )}
              <button onClick={() => { dismissAdvice(advice.key); setAdviceVer((v) => v + 1); }} className="h-7 rounded-md border border-border px-2 text-[11px] text-muted-foreground">{T("忽略", "Dismiss")}</button>
            </div>
          </div>
        )}
        <div className="flex w-full gap-2">
          <Button variant="outline" onClick={reset} className="flex-1" size="sm">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" /> {T("改配置", "Settings")}
          </Button>
          <Button onClick={beginCountdown} className="flex-1" size="sm">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {T("再来", "Again")}
          </Button>
        </div>
          </div>
        )}
      </div>
      {overlays}
    </div>,
    document.body,
  );
}

// 千位逗号:每三位一个(支持超大数字串,如乘法的精确大数)
const grp = (s: string) => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
// 只给整数部分加逗号(小数部分不分组:1234.5678 → 1,234.5678)
function fmtNum(n: number): string { const [i, f] = String(Math.abs(n)).split("."); return (n < 0 ? "-" : "") + grp(i) + (f !== undefined ? "." + f : ""); }
// 作答展示:超时未答(NaN)显示「超时」;其余带千位逗号
function fmtAns(n: number | string): string { return typeof n === "string" ? remEn(n) : Number.isNaN(n) ? (getLang() === "en" ? "Timed out" : "超时") : fmtNum(n); }
// 英文界面:余数题「2余6」「2……6」显示为「2 R 6」(只改显示,作答/存储仍用 REM_SEP)
function remEn(s: string): string { return getLang() === "en" ? s.split(REM_SEP).join(" R ").replace(/……/g, " R ") : s; }
// 正确答案(乘除大数用精确串)带千位逗号
function ansStr(p: GProblem): string { return p.rem != null ? remEn(answerText(p.answer, p.rem, fmtNum)) : p.answerStr ? grp(p.answerStr) : fmtNum(p.answer); }

// 算式文本(用于结果/记录回顾):加减显式带 + / − 号;数字带千位逗号;乘除用 a × b
function gExpr(p: GProblem): string {
  if (p.op) return `${fmtNum(p.terms[0])} ${p.op} ${fmtNum(p.terms[1])}`;
  return p.terms
    .map((t, i) => (i === 0 ? (p.signs[i] === "-" ? `-${fmtNum(t)}` : `${fmtNum(t)}`) : p.signs[i] === "-" ? ` - ${fmtNum(t)}` : ` + ${fmtNum(t)}`))
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
function GlanceStack({ terms, signs, bead = false, tall = false, scale = 1 }: { terms: number[]; signs: string[]; bead?: boolean; tall?: boolean; scale?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // 2026-11-03 孟阳「调字号的位置到处都是」:字号统一在配置页「字号」滑块调(glance:scale),这里不再放 − +
  const userScale = scale;
  const [fit, setFit] = useState(1);
  // 2026-10-15 付海东「字太小、放大后后面看不到」:整列缩放到填满列高;字号+ 不溢出,改为拆 2/3 列并排
  const n = terms.length;
  const cols = 1; // 2026-10-15 付海东:不能换行,一题居中铺满
  const per = n;
  const chunks = Array.from({ length: cols }, (_, c) => terms.slice(c * per, (c + 1) * per).map((t, k) => ({ t, i: c * per + k })));
  const eff = Math.min(fit, fit * Math.max(0.5, Math.min(1, userScale)));

  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current, card = cardRef.current;
      if (!box || !card) return;
      const w = card.offsetWidth, h = card.offsetHeight;
      if (!w || !h) return;
      const s = Math.min(box.clientWidth / w, box.clientHeight / h, 8);
      setFit(s > 0.05 ? s : 0.05);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [terms, cols]);


  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div ref={boxRef} className="glance-box flex w-full items-center justify-center overflow-hidden" style={{ height: tall ? "80vh" : "50vh" }}>
        <div style={{ transform: `scale(${eff})`, transformOrigin: "center" }}>
          {/* 2026-09-08 去掉白色卡片(用户反馈显小气):数字直接融在背景上 */}
          <div ref={cardRef} className="px-10 py-6">
            {/* 一整列竖排;放不下就整体缩小,始终单列一屏 */}
            <div className="flex items-start gap-x-14">
              {chunks.map((col, c) => (
                <div key={c} className="flex flex-col items-end gap-y-1 font-hand text-3xl font-bold leading-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
                  {col.map(({ t, i }) => bead ? (
                    <div key={i} className="flex items-center justify-end gap-3 whitespace-nowrap">
                      <span className="inline-block w-6 text-center text-4xl">{signs[i] === "-" ? "-" : ""}</span><Soroban value={t} tone="dark" />
                    </div>
                  ) : (
                    <div key={i} className="whitespace-nowrap">
                      <span className="mr-2 inline-block text-center" style={{ width: "0.7em" }}>{signs[i] === "-" ? "-" : ""}</span>{fmtNum(t)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DigitField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return <EditStepper label={label} hint={getLang() === "en" ? `${min} – ${max} digits` : `${min} – ${max} 位`} value={value} min={min} max={max} suffix={getLang() === "en" ? "digits" : "位"} onChange={onChange} />;
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
