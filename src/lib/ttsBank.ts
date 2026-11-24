// 听算词块音频库(2026-09-21 系统性重做:稳定 + 快):
// 报题词汇是封闭集合 —— 零~九/十/一十…九千/万/亿/加减乘除以,共 44 词块,已按 3 音色预合成为静态
// mp3(public/tts-bank/zh/{voice}/tNN.mp3,Netlify CDN)。客户端一次载入解码后,报题用 Web Audio
// 逐词块精确调度拼播:零 API 调用、首题零等待、永不合成失败。
//
// 速度(2026-09-21 二次返工,付海东实测「5 档以上变声、7 档还是慢」):
// playbackRate 变速会连音调一起拉高 → 改为 ffmpeg atempo 预生成【变速不变调】速度档
// ({voice}/xNNN/tNN.mp3,NNN=速率×100;1.0 档在根目录)。播放按速度旋钮就近取档,倍率恒 1.0
// —— 音色任何档都不变;高档提速再叠间隔压缩。童声恒 ×1.25 升调扮童(各档一致)。
// 云端整句合成(warmTTS)与浏览器语音仍作兜底链。
// 词块顺序 = 文件名契约(tNN.mp3),与 scratchpad/gen-bank.mjs 生成脚本一致,勿改动顺序。
import { siteUrl } from "@/lib/appEnv";
import { numberToCN } from "@/lib/abacus";

const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const D1_9 = CN.slice(1);
// v2(2026-10-12 付海东「吐字不清/声音怪」):词块从单字升级为整个两位数(五十六整体一段),接缝减半、吐字自然。
// 顺序 = 文件名契约(public/tts-bank2/zh/{voice}/tNNN.mp3),与 scratchpad/gen-bank2.mjs 完全一致,勿改动。
export const TOKENS: string[] = [
  ...CN,                                                   // 零..九
  ...["", ...D1_9].map((d) => "十" + d),                   // 十..十九
  ...["", ...D1_9].map((d) => "一十" + d),                 // 一十..一十九(百位之后)
  ...D1_9.slice(1).flatMap((t) => ["", ...D1_9].map((d) => t + "十" + d)), // 二十..九十九
  ...D1_9.map((d) => d + "百"), ...D1_9.map((d) => d + "千"),
  "万", "亿", "加", "减", "乘以", "除以",
];
const TOKEN_IDX = new Map(TOKENS.map((t, i) => [t, i]));

// E 版「大词块」(2026-10-13 方案 B,用户「拼接有杂音,要更纯粹」):0–999 每个整数一段完整的音,一个三位数内部零接缝;
// 长数只在 千/万 交界处接(人读数时本就略有停顿)。顺序 = 文件名契约(public/tts-bank6/zh/{voice}/tNNNN.mp3),
// 与 scratchpad/gen-bank6.mjs bigTokens() 完全一致,勿改动。
export function bigTokens(): string[] {
  const t: string[] = [];
  for (let n = 0; n < 1000; n++) t.push(numberToCN(n));                                   // 1000:零 十 十五 一百零五 九百九十九
  for (let n = 1; n < 100; n++) t.push("零" + numberToCN(n).replace(/^十/, "一十"));         // 99:千/万之后的 零五 零一十五 零二十三
  for (let d = 1; d <= 9; d++) t.push(CN[d] + "千");                                        // 9
  for (let d = 1; d <= 9; d++) t.push(CN[d] + "万");                                        // 9
  t.push("万", "亿", "加", "减", "乘以", "除以");                                             // 6 → 共 1123
  t.push("点");                                                                              // 1124(2026-10-13 小数:一点二五;追加在末尾,不动既有序号)
  return t;
}
export const BIG_TOKENS: string[] = bigTokens();
const BIG_IDX = new Map(BIG_TOKENS.map((t, i) => [t, i]));

export type BankVoice = "female" | "male" | "child";

// ===== 速度档(变速不变调,ffmpeg atempo 预生成;与 public/tts-bank 目录契约一致) =====

/** 听算速度档 1–10 → 语速倍数。
 *  2026-10-24 ① 教练「5 速太慢、6 速又有点快」:原 6–10(1.6/2.2/2.8/3.4/4.0)5→6 跳 60%,改为 5→10 等比;
 *  ② 用户「整体速度都快一些,每一档都适当增加」:整条曲线 ×1.15(10 档 4.0→4.6;超出 2.6× 词块档的部分靠压缩间隔)。
 *  结果:0.69 / 0.81 / 0.92 / 1.04 / 1.15 / 1.52 / 2.0 / 2.64 / 3.48 / 4.6 */
export const LISTEN_SPEED_BOOST = 1.15;
export function listenSpeedFactor(level: number): number {
  const l = Math.max(1, Math.min(10, level));
  const s = l <= 5 ? 0.6 + (l - 1) * 0.1 : Math.pow(4, (l - 5) / 5);
  return s * LISTEN_SPEED_BOOST;
}
export const BANK_TIERS = [0.7, 0.85, 1, 1.35, 1.7, 2.1, 2.6] as const; // 上限 2.6×:再高吐字必糊(v2 取消 3.2/4.0),高档靠间隔压缩

/** 目标语速 → 最近的预生成速度档(按对数距离;播放倍率恒 1.0,音调永不跑)。 */
export function tierFor(rate: number): number {
  let best: number = BANK_TIERS[0];
  for (const t of BANK_TIERS) if (Math.abs(Math.log(rate / t)) < Math.abs(Math.log(rate / best))) best = t;
  return best;
}

// 音源变体:A=tts-bank2(OpenAI gpt-4o-mini-tts + atempo) B=tts-bank3(OpenAI tts-1-hd 原生 speed)
// C=tts-bank4(macOS 母语普通话 Tingting 等,原生语速合成,2026-10-13 用户「像老外念中文」后新增并设为默认)
// D=tts-bank5(火山引擎 豆包语音合成 2.0:知性女声/磁性解说/儿童绘本,词块在载体句中连读合成后按时间戳切出,
//   各档原生 speech_rate;2026-10-13 付海东选定音色后上线并设为默认)
// E=tts-bank6(同 D 的火山音色,大词块 1123 个,默认)
export type BankVariant = "A" | "B" | "C" | "D" | "E";
const VARIANT_KEY = "listen:engine:v3"; // 键名升级:之前手动选过的用户也默认切到 E
const ROOTS: Record<BankVariant, string> = { A: "/tts-bank2", B: "/tts-bank3", C: "/tts-bank4", D: "/tts-bank5", E: "/tts-bank6" };
const DEFAULT_VARIANT: BankVariant = "E";
const isVariant = (v: unknown): v is BankVariant => v === "A" || v === "B" || v === "C" || v === "D" || v === "E";
export function getBankVariant(): BankVariant { try { const v = localStorage.getItem(VARIANT_KEY); return isVariant(v) ? v : DEFAULT_VARIANT; } catch { return DEFAULT_VARIANT; } }
export function setBankVariant(v: BankVariant) { try { localStorage.setItem(VARIANT_KEY, v); } catch { /* noop */ } }
const tokenSet = (v: BankVariant) => (v === "E" ? { list: BIG_TOKENS, idx: BIG_IDX, maxLen: 5, pad: 4 } : { list: TOKENS, idx: TOKEN_IDX, maxLen: 3, pad: 3 });
/** 童声倍率:A/B/C 用女声升调 ×1.25 扮童;D/E 是真童声音色,恒 1.0。 */
export function voicePlaybackRate(voice: BankVoice, variant: BankVariant = getBankVariant()): number {
  return voice === "child" && (variant === "A" || variant === "B" || variant === "C") ? 1.25 : 1;
}
// 2026-11-03 用户「说到万就有些停顿」:E 版「一万…九万」(1108–1116)的数中间块换成 w2 版 ——
// 原块从「X万，加七」逗号处切,「万」被读成拖长的句末音(0.45s,连读只 0.19s);w2 从连读「X万八千」切在「八」的闭塞处(scratchpad/gen-wan.mjs)。
// 新文件名而不是原地覆盖:词块库浏览器缓存 7 天(public/_headers)。只有女声 / 男声有 w2。
const W2_WAN = (v: BankVariant, voice: BankVoice, i: number, final: boolean) => v === "E" && !final && voice !== "child" && i >= 1108 && i <= 1116;
const tierPath = (voice: BankVoice, tier: number, i: number, final = false): string => {
  const v = getBankVariant();
  const dir = tier === 1 ? "" : `x${String(Math.round(tier * 100)).padStart(3, "0")}/`;
  return siteUrl(`${ROOTS[v]}/zh/${voice}/${dir}${final ? "f" : "t"}${String(i).padStart(tokenSet(v).pad, "0")}${W2_WAN(v, voice, i, final) ? "w2" : ""}.mp3`);
};

// ===== 数末词块(2026-10-24 用户「尾音掐得特别快…让它自然地呈现」)=====
// tNNNN 是「X加七」连读切出来的,尾巴紧(拼长数时接缝自然);fNNNN 是「X，加七」停顿处切的,带完整自然衰减。
// 每个数的【最后一块】用 fNNNN(键名 = 词块 + FINAL_MARK),数中间的块(「二千|三百四十五」的「二千」)仍用 tNNNN。只有 E 版有。
export const FINAL_MARK = "#";
const NO_FINAL = new Set(["加", "减", "乘以", "除以", "点"]);
const baseTok = (t: string) => (t.endsWith(FINAL_MARK) ? t.slice(0, -1) : t);
const finalOf = (tok: string): string | null => (getBankVariant() === "E" && !NO_FINAL.has(tok) ? tok + FINAL_MARK : null);
/** 一道题要载入的词块:全部普通词块 + 每个数末块的 fNNNN 版 */
export function termBankTokens(termTokens: string[][]): string[] {
  const out = termTokens.flat();
  for (const tk of termTokens) { const f = tk.length ? finalOf(tk[tk.length - 1]) : null; if (f) out.push(f); }
  return out;
}

/** 把 numberToCN 的输出切成词块:最少块数(接缝最少)的精确覆盖(动态规划,贪心最长匹配会在「一万零一百」上把「零一」吃掉而失败);
 *  含未知字符返回 null(交给云端兜底)。 */
export function tokenizeCN(s: string, variant: BankVariant = getBankVariant()): string[] | null {
  const { idx, maxLen } = tokenSet(variant);
  const n = s.length;
  // 从右往左:best[i] = 覆盖后缀 s[i..) 的最少块数;同块数时取更长的首块(接缝尽量落在 万/千 交界:二百三十四|万 而非 二百三十|四万)
  const best: number[] = new Array(n + 1).fill(Infinity);
  const pick: number[] = new Array(n + 1).fill(0);
  best[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let len = maxLen; len >= 1; len--) {
      if (i + len > n || !idx.has(s.slice(i, i + len)) || best[i + len] === Infinity) continue;
      if (best[i + len] + 1 < best[i]) { best[i] = best[i + len] + 1; pick[i] = len; }
    }
  }
  if (best[0] === Infinity) return null;
  const out: string[] = [];
  for (let i = 0; i < n; i += pick[i]) out.push(s.slice(i, i + pick[i]));
  return out;
}

/** 一个数的报读词块:整读=tokenizeCN(numberToCN);逐位读=每位单字。 */
export function numberTokens(n: number, unitStyle: boolean): string[] | null {
  const abs = Math.abs(n);
  if (!Number.isInteger(abs)) {
    // 小数:整数部分照常,「点」后逐位读(一点二五 / 零点零一二五);只有 E 版库有「点」,其它库返回 null 走兜底
    const [ip, fp] = String(abs).split(".");
    const head = unitStyle ? tokenizeCN(numberToCN(Number(ip))) : ip.split("").map((d) => CN[+d]);
    if (!head || !tokenSet(getBankVariant()).idx.has("点")) return null;
    return [...head, "点", ...fp.split("").map((d) => CN[+d])];
  }
  if (!unitStyle) return String(abs).split("").map((d) => CN[+d]);
  return tokenizeCN(numberToCN(abs));
}

// ===== 音频库载入(按音色缓存 AudioBuffer + 首尾静音裁剪点) =====

interface Clip { buf: AudioBuffer; start: number; dur: number; gain: number }

/** 响度归一:各词块单独合成,响度参差会让拼播忽大忽小(听感「生硬」的一部分)。按裁剪区 RMS 对齐到统一目标。 */
function loudnessGain(buf: AudioBuffer, start: number, dur: number): number {
  const ch = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const a = Math.floor(start * sr), b = Math.min(ch.length, Math.floor((start + dur) * sr));
  let sum = 0;
  for (let i = a; i < b; i++) sum += ch[i] * ch[i];
  const rms = Math.sqrt(sum / Math.max(1, b - a));
  if (!rms) return 1;
  return Math.max(0.7, Math.min(1.5, 0.09 / rms));
}
const banks = new Map<string, Map<string, Clip>>();   // key = `${voice}@${tier}`
const bankKey = (voice: BankVoice, tier: number) => `${getBankVariant()}:${voice}@${tier}`;
let ctx: AudioContext | null = null;

export function audioCtx(): AudioContext {
  if (!ctx) { setPlaybackSession(); ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); }
  return ctx;
}

// ===== iPhone / iPad 静音模式下听算无声(2026-11-03 家长「苹果手机和平板听力的声音都听不到」,网页版)=====
// iOS 上 Web Audio 默认属于「环境音」,侧边静音键 / 控制中心静音一开就完全没声(<audio> 播的提示音、讲解却照常响)。
// ① iOS 17+:navigator.audioSession.type = "playback",页面音频按「媒体播放」处理,不受静音键影响;
// ② 更老的 iOS 没这个 API:用户第一次点屏幕时循环播放一段无声 <audio>,把整页音频会话切成媒体播放(老办法,页面隐藏时暂停)。
// 两者都要在用户手势里触发,所以全局挂在第一次 pointerdown / touchend / keydown 上。
type AudioSessionNav = Navigator & { audioSession?: { type: string } };
function setPlaybackSession() {
  try { const s = (navigator as AudioSessionNav).audioSession; if (s && s.type !== "playback") s.type = "playback"; } catch { /* noop */ }
}
const IS_IOS = typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
let silentEl: HTMLAudioElement | null = null;
function silentWavUrl(): string {
  // 0.5 秒 8kHz 8bit 单声道静音 WAV(现场拼,不占文件)
  const n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}
export function unlockAudio() {
  setPlaybackSession();
  if (IS_IOS && !(navigator as AudioSessionNav).audioSession && !silentEl) {
    try {
      silentEl = new Audio(silentWavUrl()); silentEl.loop = true; silentEl.setAttribute("playsinline", "");
      silentEl.play().catch(() => { silentEl = null; }); // 没在手势里 → 下次点击再试
    } catch { silentEl = null; }
  }
  if (ctx && ctx.state === "suspended") void ctx.resume();
}
if (typeof window !== "undefined") {
  for (const ev of ["pointerdown", "touchend", "keydown"]) window.addEventListener(ev, unlockAudio, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!silentEl) return;
    if (document.hidden) silentEl.pause(); else void silentEl.play().catch(() => { /* noop */ });
  });
}

/** 首尾静音裁剪点(能量阈值扫描):合成词块 mp3 通常带 100-300ms 空白,不裁节奏会拖。
 *  余量随速度档收窄(压缩后的衰减尾也短了)—— 高速档固定余量会让拼播"一顿一顿"。 */
function trimPoints(buf: AudioBuffer, tier: number): { start: number; dur: number } {
  const ch = buf.getChannelData(0);
  const thr = 0.012;
  let a = 0, b = ch.length - 1;
  while (a < ch.length && Math.abs(ch[a]) < thr) a++;
  while (b > a && Math.abs(ch[b]) < thr) b--;
  const sr = buf.sampleRate;
  const start = Math.max(0, a / sr - 0.008);                        // 留 8ms 起音缓冲
  const end = Math.min(buf.duration, b / sr + Math.min(0.04, 0.05 / tier)); // 尾音余量:1×≈40ms → 4×≈12ms
  return { start, dur: Math.max(0.04, end - start) };
}

/** 按需载入词块(2026-10-14 用户「加载太慢,忘了它突然出声吓一跳」):只拉这道题用到的十几个词块(<1s),整套 1124 个在播放时后台补。
 *  tokens 省略 = 整套。幂等;同一词块并发只拉一次。返回 true 表示要的词块全部就绪。 */
const inflightTok = new Map<string, Promise<void>>(); // key = `${bankKey}:${token}`
const finalMissing = new Set<string>(); // 取不到的数末块(key 同 inflightTok)
function bankMap(key: string): Map<string, Clip> {
  let m = banks.get(key);
  if (!m) {
    // 一套解码后约 60MB,内存里最多留 2 套(换速度档时淘汰最早的)
    while (banks.size >= 2) { const oldest = banks.keys().next().value; if (oldest === undefined) break; banks.delete(oldest); }
    m = new Map(); banks.set(key, m);
  }
  return m;
}
function loadToken(voice: BankVoice, tier: number, tok: string, i: number, m: Map<string, Clip>): Promise<void> {
  const k = `${bankKey(voice, tier)}:${tok}`;
  const final = tok.endsWith(FINAL_MARK);
  const hit = inflightTok.get(k);
  if (hit) return hit;
  const p = (async () => {
    // 2026-11-25 付海东「听算还是播不出来」:一道题十几个词块里任何一个网络抖动失败,整题就落到云端 / 浏览器语音(国内 Pad 上往往没声)。
    // 每块最多试 3 次(404 不重试),间隔 400ms / 800ms;只有真拿不到才算失败。
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 10_000); // 单个文件 10 秒没回就当失败重试,不让「准备中」卡死
      try { res = await fetch(tierPath(voice, tier, i, final), { signal: ctl.signal }); } catch { res = null; } finally { clearTimeout(tm); }
      if (res && (res.ok || res.status === 404)) break;
      await new Promise((ok) => setTimeout(ok, 400 * (attempt + 1)));
    }
    if (!res || !res.ok) {
      if (res?.status === 404 && final) finalMissing.add(k); // 线上还没有这一块 → 之后直接用普通块,不再每题重试
      throw new Error(`bank ${voice}@${tier} t${i} ${res ? "http " + res.status : "network"}`);
    }
    const buf = await audioCtx().decodeAudioData(await res.arrayBuffer());
    const tp = trimPoints(buf, tier);
    // 数末块:文件已精确切在自然衰减之后,尾部不再按阈值裁(阈值会把衰减段裁掉);响度仍按主体段算,免得尾巴拉低 RMS 把增益抬高
    const dur = final ? Math.max(tp.dur, buf.duration - tp.start) : tp.dur;
    m.set(tok, { buf, start: tp.start, dur, gain: loudnessGain(buf, tp.start, tp.dur) });
  })().finally(() => inflightTok.delete(k));
  inflightTok.set(k, p);
  return p;
}
export async function loadBank(voice: BankVoice, tier = 1, tokens?: string[]): Promise<boolean> {
  const { list, idx } = tokenSet(getBankVariant());
  const want = tokens ? [...new Set(tokens)].filter((t) => idx.has(baseTok(t))) : list;
  const m = bankMap(bankKey(voice, tier));
  const missing = want.filter((t) => !m.has(t));
  if (!missing.length) return true;
  try {
    // 数末块尽力而为:取不到就用普通块播,不让整道题落到云端兜底
    const finals = missing.filter((t) => t.endsWith(FINAL_MARK)), base = missing.filter((t) => !t.endsWith(FINAL_MARK));
    const finalsP = Promise.allSettled(finals.map((t) => loadToken(voice, tier, t, idx.get(baseTok(t))!, m)));
    // 这道题要的十几块并发取(要快);整套后台补齐时只开 6 路(2026-10-24:原 48 路并发,一开页面就是上千个请求的突发,
    // 同一出口 IP 容易被 Netlify 主域名限流 → 整站打不开)
    const width = tokens ? 48 : 6;
    for (let b = 0; b < base.length; b += width) {
      await Promise.all(base.slice(b, b + width).map((t) => loadToken(voice, tier, t, idx.get(baseTok(t))!, m)));
    }
    await finalsP;
    return want.every((t) => t.endsWith(FINAL_MARK) || m.has(t));
  } catch {
    return false; // 网络/解码失败 → 这道题走兜底
  }
}
// 数末块不预取整套(2026-10-24):每个学生多拉 1119 个文件,一个班同一出口 IP 容易被 Netlify 限流(本机批量下载时已触发过);
// 每道题只按需取这道题用到的几个 fNNNN(几百毫秒),同一块解码后留在内存里复用。

/** 指定词块(省略=整套)是否已就绪 */
export const bankReady = (voice: BankVoice, tier = 1, tokens?: string[]): boolean => {
  const m = banks.get(bankKey(voice, tier));
  if (!m) return false;
  if (!tokens) return m.size >= tokenSet(getBankVariant()).list.length;
  return tokens.every((t) => m.has(t) || (t.endsWith(FINAL_MARK) && finalMissing.has(`${bankKey(voice, tier)}:${t}`)));
};

// ===== 报题调度 =====

export interface SpeakHandle { done: Promise<void>; cancel: () => void; pause: () => void; resume: () => void; paused: () => boolean }

/**
 * 播报一道题(词块精确调度)。速度由预生成的 tier(变调已消除)承担;
 * rate 只用于童声恒定 ×1.25 升调扮童 —— 女/男声恒 1.0,任何速度档都不变声。
 * @param termTokens 每个数(含前置运算词)的词块序列,如 [["三十","五"],["加","二十","一"]]
 * @param termGapMs 数与数之间隔;onTerm 每个数开播回调(高亮用)
 */
export function speakTokens(
  voice: BankVoice, tier: number, termTokens: string[][], rate: number, termGapMs: number,
  onTerm?: (idx: number) => void,
): SpeakHandle {
  const bank = banks.get(bankKey(voice, tier))!;
  const ac = audioCtx();
  if (ac.state === "suspended") void ac.resume();
  const sources: AudioBufferSourceNode[] = [];
  let cancelled = false;
  let paused = false;
  // 词块衔接(2026-10-11 付海东「声音生硬」):每块首尾各 25ms 淡入/淡出,相邻块搭接这 25ms 做等功率交叉淡化
  // —— 接缝处没有硬切和爆音,一个数读起来是连着的;慢档在块间再留一点气口(自然语流里字与字本就有间隙)。
  const FADE = 0.012; // v2:短淡化,少糊字
  const legatoGap = tier >= 2 ? 0 : 0.02 / (tier * rate);
  const termGap = Math.max(0.1, termGapMs / 1000);
  let t = ac.currentTime + 0.08;
  let totalEnd = t;
  const termStarts: number[] = [];
  termTokens.forEach((tokens) => {
    termStarts.push(t);
    tokens.forEach((tok, ti) => {
      // 数末块优先用带自然尾音的 fNNNN(没载到就用普通块)
      const clip = (ti === tokens.length - 1 ? bank.get(tok + FINAL_MARK) : undefined) ?? bank.get(tok)!;
      const src = ac.createBufferSource();
      src.buffer = clip.buf;
      src.playbackRate.value = rate;
      const g = ac.createGain();
      const end = t + clip.dur / rate;
      const fadeIn = Math.min(FADE, (end - t) / 2), fadeOut = fadeIn;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(clip.gain, t + fadeIn);
      g.gain.setValueAtTime(clip.gain, end - fadeOut);
      g.gain.linearRampToValueAtTime(0, end);
      src.connect(g).connect(ac.destination);
      src.start(t, clip.start, clip.dur);
      sources.push(src);
      t = end - fadeOut + legatoGap; // 下一块压在本块淡出段上进来
      totalEnd = end;
    });
    t = totalEnd + termGap;
  });
  // 进度全部以 AudioContext 时钟为准(而非墙钟定时器):暂停=ac.suspend() 时钟停摆,
  // 已调度的词块原位冻结,恢复后严丝合缝接着播 —— 教练演示「点屏幕暂停」靠这个。
  let nextTerm = 0;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((r) => { resolveDone = r; });
  const tick = window.setInterval(() => {
    if (cancelled) return;
    const now = ac.currentTime;
    while (nextTerm < termStarts.length && now >= termStarts[nextTerm] - 0.02) { onTerm?.(nextTerm); nextTerm++; }
    if (now >= totalEnd + 0.1) { window.clearInterval(tick); resolveDone(); }
  }, 40);
  return {
    done,
    cancel: () => {
      cancelled = true;
      window.clearInterval(tick);
      sources.forEach((s) => { try { s.stop(); } catch { /* noop */ } });
      if (paused) { paused = false; void ac.resume(); }
    },
    pause: () => { if (!paused && !cancelled) { paused = true; void ac.suspend(); } },
    resume: () => { if (paused) { paused = false; void ac.resume(); } },
    paused: () => paused,
  };
}
