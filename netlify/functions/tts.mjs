import { withCors } from "./_cors.mjs";
// 云端 TTS(方案 B):服务端用 OpenAI TTS 把整题报题合成一段 MP3,前端 <audio> 播放。
// 稳定(不看用户机器脸色)、跨设备一致。复用 OPENAI_API_KEY。
// 2026-09-08:模型 tts-1 → gpt-4o-mini-tts + 母语播音 instructions(旧模型英语音色念中文一股外国腔);
// 语速不再由服务端合成(该模型不支持 speed),前端用 audio.playbackRate 精确控制。
// gpt-4o-mini-tts 失败时自动回退 tts-1(同样按 1.0 合成,速度始终归前端 playbackRate 管,避免双重加速)。
// 2026-09-21 跨用户共享缓存(Netlify Blobs):键=hash(lang|音色|语速|文本)。任何用户首次合成后
// 存入,之后全站相同报题直接命中返回 —— 题目照常随机,但常见短题(一位数、少笔数)复现率高,
// 命中越攒越多。缓存层任何故障(本地 dev 无 Blobs 等)都静默跳过,绝不影响正常合成。
// 音色三选(女声/男声/童声);童声用明亮音色 + 指令扮演,OpenAI 无真正儿童音色
import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
import * as SECRETS from "./_secrets.mjs";

// 手动部署(netlify deploy --no-build)的函数运行时没有自动 Blobs 上下文 → 显式传 siteID+token
const cacheStore = () => {
  try {
    const siteID = process.env.NETLIFY_SITE_ID || SECRETS.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOBS_TOKEN || SECRETS.NETLIFY_BLOBS_TOKEN;
    return siteID && token ? getStore({ name: "tts-cache", siteID, token }) : getStore("tts-cache");
  } catch { return null; }
};

const VOICES = {
  zh: { female: "sage", male: "onyx", child: "coral" },
  en: { female: "nova", male: "onyx", child: "shimmer" },
};
const TTS1_VOICES = { female: "nova", male: "onyx", child: "shimmer" }; // 回退模型 tts-1 没有 coral
const INSTRUCTIONS = {
  zh: {
    female: "你是普通话为母语的数学听算报题员。用字正腔圆、自然地道的标准普通话朗读,吐字清晰、节奏均匀平稳,严禁任何外国口音。",
    male: "你是普通话为母语的男播音员,为数学听算报题。声音沉稳有力,字正腔圆、吐字清晰、节奏均匀平稳,严禁任何外国口音。",
    child: "你是一个七岁的中国小朋友,说标准普通话,为同学报听算题。用稚嫩、清脆、音调偏高的童声朗读,比平常语速放慢一成,字正腔圆、节奏均匀,严禁任何外国口音、严禁成年人的声线。",
  },
  en: {
    female: "You are a native English math dictation announcer. Read the numbers clearly and evenly at a steady pace.",
    male: "You are a native English male announcer with a deep steady voice, reading math dictation numbers clearly and evenly.",
    child: "You are a cheerful 7-year-old child native English speaker reading math dictation numbers in a high-pitched, youthful voice, slightly slower than normal, bright and clear, never sounding like an adult.",
  },
};

// 2026-11-02 指法教学讲解:engine "volc" 走火山 豆包语音 2.0(付海东选定的「知性女声」),
// 比 gpt-4o-mini-tts 念中文长句自然得多(用户:「声音感觉很死板」)。失败自动回退 OpenAI。
const VOLC_SPEAKERS = { teach: "zh_female_zhixingnv_uranus_bigtts", teach_en: "zh_female_yingyujiaoxue_uranus_bigtts" }; // teach_en:英文讲解(2026-11-08)用「Tina老师」英语教学音色
function splitJson(s) {
  const out = []; let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") { if (depth++ === 0) start = i; }
    else if (c === "}") { if (--depth === 0 && start >= 0) { try { out.push(JSON.parse(s.slice(start, i + 1))); } catch { /* skip */ } start = -1; } }
  }
  return out;
}
async function volcSynth(text, speaker, speechRate = 0) {
  const r = await fetch("https://openspeech.bytedance.com/api/v3/tts/unidirectional", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Api-Key": SECRETS.VOLC_TTS_ACCESS_KEY, "X-Api-Resource-Id": "seed-tts-2.0" },
    body: JSON.stringify({ user: { uid: "sbl-teach" }, req_params: { text, speaker, audio_params: { format: "mp3", sample_rate: 24000, speech_rate: speechRate } } }),
  });
  const raw = await r.text();
  if (!r.ok) throw new Error(`volc http ${r.status}`);
  const chunks = [];
  for (const o of splitJson(raw)) {
    if (o.data) chunks.push(Buffer.from(o.data, "base64"));
    if (o.code && o.code !== 0 && o.code !== 20000000) throw new Error(`volc code ${o.code}`);
  }
  if (!chunks.length) throw new Error("volc no audio");
  return Buffer.concat(chunks);
}

const inner = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  const key = process.env.OPENAI_API_KEY || process.env.openaiAPI;

  let body; try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, body: "bad json" }; }
  const text = (body.text || "").slice(0, 4000);
  if (!text) return { statusCode: 400, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "缺少文本" }) };
  const lang = body.lang === "en" ? "en" : "zh";
  const vt = ["male", "child"].includes(body.voiceType) ? body.voiceType : "female";
  const voice = body.voice || VOICES[lang][vt];
  // 语速三档:高速档让模型自己读快(前端只做 ≤1.6x 微调),避免大倍率变速的"太紧太尖"伪影
  const pace = ["slow", "fast"].includes(body.pace) ? body.pace : "normal";
  const PACE_NOTE = {
    zh: {
      slow: "",
      normal: "",
      fast: " 吐字格外干净利落,每个数字读得短促清脆,数字之间保留清晰的短停顿,绝不拖音、绝不粘连。",
    },
    en: {
      slow: "",
      normal: "",
      fast: " Articulate each number crisply and briefly, with a clear short pause between numbers; never drawl or slur.",
    },
  };

  // 2026-10-12 B 线路:tts-1-hd 支持原生 speed(0.25–4),用于生成「原生快读」词块库做 A/B 试听
  const engine = body.engine === "tts1" ? "tts1" : body.engine === "volc" ? "volc" : "4o";
  const speed = Math.max(0.25, Math.min(4, Number(body.speed) || 1));
  // ===== 共享缓存:命中直接返回(零 OpenAI 调用) =====
  const cacheKey = createHash("sha256").update(`${engine}|${speed}|${lang}|${voice}|${vt}|${pace}|${text}`).digest("hex");
  const store = cacheStore();
  if (store) {
    try {
      const hit = await store.get(cacheKey, { type: "arrayBuffer" });
      if (hit && hit.byteLength > 0) {
        return {
          statusCode: 200,
          headers: { "content-type": "audio/mpeg", "cache-control": "no-store", "x-tts-cache": "hit" },
          body: Buffer.from(hit).toString("base64"),
          isBase64Encoded: true,
        };
      }
    } catch { /* 缓存读失败 → 当未命中,正常合成 */ }
  }

  const call = (payload) =>
    fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  if (engine === "volc") {
    try {
      const buf = await volcSynth(text, VOLC_SPEAKERS[body.voice] || VOLC_SPEAKERS.teach, Math.max(-50, Math.min(100, Number(body.rate) || 0)));
      if (store) { try { await store.set(cacheKey, buf); } catch { /* noop */ } }
      return { statusCode: 200, headers: { "content-type": "audio/mpeg", "cache-control": "no-store", "x-tts-cache": store ? "miss-stored" : "off", "x-tts-engine": "volc" }, body: buf.toString("base64"), isBase64Encoded: true };
    } catch (e) { console.error("volc tts failed", String(e).slice(0, 200)); /* 火山失败 → 落到下面 OpenAI(讲课口吻) */ }
  }
  if (!key) return { statusCode: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "服务端未配置 OPENAI_API_KEY / openaiAPI(与语音输入同一个)。" }) };
  const TEACH_NOTE = lang === "en" ? "You are a warm, lively abacus teacher explaining bead moves to children in class. Natural and friendly, clear pauses at commas, light emphasis on key numbers." : "你是一位亲切、有活力的小学珠心算老师,正在课堂上给孩子们讲解拨珠指法。语气自然生动、像在跟学生说话,有轻重缓急,逗号处自然停顿,关键词稍加强调,严禁播音腔和外国口音。";
  let r;
  try {
    if (engine === "volc") {
      r = await call({ model: "gpt-4o-mini-tts", input: text, voice: "coral", instructions: TEACH_NOTE, response_format: "mp3" });
    } else if (engine === "tts1") {
      r = await call({ model: "tts-1-hd", input: text, voice: TTS1_VOICES[vt], speed, response_format: "mp3" });
    } else {
      r = await call({ model: "gpt-4o-mini-tts", input: text, voice, instructions: INSTRUCTIONS[lang][vt] + PACE_NOTE[lang][pace], response_format: "mp3" });
      if (!r.ok) r = await call({ model: "tts-1", input: text, voice: TTS1_VOICES[vt], response_format: "mp3" });
    }
  } catch (e) {
    return { statusCode: 502, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "无法连接 TTS", detail: String(e).slice(0, 200) }) };
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { statusCode: 502, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "TTS 合成失败", detail: t.slice(0, 300) }) };
  }
  const buf = Buffer.from(await r.arrayBuffer());
  // 合成成功 → 写入共享缓存,之后全站相同报题直接命中(写失败不影响本次返回)
  if (store && buf.length > 0) {
    try { await store.set(cacheKey, buf); } catch { /* noop */ }
  }
  return {
    statusCode: 200,
    headers: { "content-type": "audio/mpeg", "cache-control": "no-store", "x-tts-cache": store ? "miss-stored" : "off" },
    body: buf.toString("base64"),
    isBase64Encoded: true,
  };
};

export const handler = withCors(inner);
