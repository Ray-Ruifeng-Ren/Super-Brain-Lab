// 指法教学的讲解语音(2026-11-02):整句走云端 TTS(火山 豆包「知性女声」,讲课口吻;失败回退 OpenAI)(与听算同一个 /tts 函数,全站共享缓存,同一句话第二次起秒出),
// 拿不到就用浏览器自带语音兜底;都不行也不卡流程(按字数估一个时长继续往下讲)。
import { siteUrl } from "@/lib/appEnv";

const cache = new Map<string, Promise<string | null>>();
/** 预取:进讲解前把这一题所有句子先合成好,讲的时候不等 */
export function prefetchSpeech(texts: string[], lang: "zh" | "en" = "zh") { for (const t of texts) void audioUrl(t, lang); }

// 英文讲解的数字转成英文单词再合成:Tina 老师是中英双语音色,看到阿拉伯数字会按中文读(「Add 89」读成「八十九」)。
// 屏幕上的文字不变,只改送去合成的那一份。
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = ["", " thousand", " million", " billion", " trillion"];
function under1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? "-" + ONES[r % 10] : "");
  return h ? ONES[h] + " hundred" + (r ? " " + rest : "") : rest;
}
function intWords(s: string): string {
  if (s.length > 1 && s[0] === "0") return s.split("").map((d) => ONES[+d]).join(" "); // 08 → zero eight(积占两档,逐位读)
  if (s.length > 15) return s.split("").map((d) => ONES[+d]).join(" ");
  let n = Number(s);
  if (n === 0) return "zero";
  const parts: string[] = [];
  for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) if (n % 1000) parts.unshift(under1000(n % 1000) + SCALES[i]);
  return parts.join(" ");
}
const ORD: Record<string, string> = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };
function ordWords(s: string): string {
  const w = intWords(s), m = w.match(/^(.*?)([a-z]+)$/)!;
  const last = m[2];
  return m[1] + (ORD[last] ?? (last.endsWith("y") ? last.slice(0, -1) + "ieth" : last + "th"));
}
export function enSpeech(text: string): string {
  return text
    .replace(/(\d)\s*×\s*(\d)/g, "$1 times $2").replace(/(\d)\s*÷\s*(\d)/g, "$1 divided by $2")
    .replace(/(\d)\s*\+\s*(\d)/g, "$1 plus $2").replace(/(\d)\s*[-−]\s*(\d)/g, "$1 minus $2").replace(/\s*=\s*/g, " equals ")
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, (_, d: string) => ordWords(d))
    .replace(/(\d+)\.(\d+)/g, (_, a: string, b: string) => `${intWords(a)} point ${b.split("").map((d) => ONES[+d]).join(" ")}`)
    .replace(/\d+/g, (d) => intWords(d));
}

// 英文讲解(2026-11-08):voice teach_en = 火山「Tina老师」英语教学音色(与英文鼓励语音同一个)
function audioUrl(raw: string, lang: "zh" | "en" = "zh"): Promise<string | null> {
  const text = lang === "en" ? enSpeech(raw) : raw;
  let p = cache.get(`${lang}|${text}`);
  if (!p) {
    p = fetch(siteUrl("/.netlify/functions/tts"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, lang, engine: "volc", voice: lang === "en" ? "teach_en" : "teach" }) })
      .then(async (r) => (r.ok ? r.blob() : null))
      .then((b) => (b && b.size ? URL.createObjectURL(b) : null))
      .catch(() => null);
    cache.set(`${lang}|${text}`, p);
  }
  return p;
}

let current: { cancel: () => void } | null = null;
export function stopSpeech() { current?.cancel(); current = null; }

/** 读一句;resolve 于读完(取消 / 出错也 resolve)。onStart(总时长 ms) 在真正开始出声时回调,用来让手的动作对上说话的进度 */
export function speak(text: string, onStart?: (ms: number) => void, lang: "zh" | "en" = "zh"): Promise<void> {
  stopSpeech();
  let cancelled = false;
  let audio: HTMLAudioElement | null = null;
  const handle = { cancel: () => { cancelled = true; try { audio?.pause(); } catch { /* noop */ } try { window.speechSynthesis?.cancel(); } catch { /* noop */ } } };
  current = handle;
  const guess = Math.min(15000, 600 + text.length * 260);
  return new Promise<void>((resolve) => {
    let done = false;
    const end = () => { if (!done) { done = true; resolve(); } };
    const timer = window.setTimeout(end, guess + 4000);
    void audioUrl(text, lang).then((url) => {
      if (cancelled) { clearTimeout(timer); return end(); }
      if (url) {
        audio = new Audio(url);
        audio.onplaying = () => { const d = audio?.duration; onStart?.(d && isFinite(d) ? d * 1000 : guess); };
        audio.onended = () => { clearTimeout(timer); end(); };
        audio.onerror = () => { clearTimeout(timer); end(); };
        audio.play().catch(() => fallback());
      } else fallback();
    });
    function fallback() {
      try {
        const synth = window.speechSynthesis;
        if (!synth) { window.setTimeout(end, guess); return; }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === "en" ? "en-US" : "zh-CN"; u.rate = 0.95;
        u.onstart = () => onStart?.(guess);
        u.onend = () => { clearTimeout(timer); end(); };
        u.onerror = () => { clearTimeout(timer); end(); };
        synth.speak(u);
      } catch { window.setTimeout(end, guess); }
    }
  });
}
