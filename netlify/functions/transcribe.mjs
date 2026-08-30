// 云端语音识别:浏览器上传录音 → 本函数转发到 OpenAI Whisper → 返回文本。
// 浏览器只跟自己的站点通信,识别在服务端完成,任何设备/网络(含国内)均可用,绕过 Google 语音服务封锁。
// 需在 Netlify 环境变量配置 OPENAI_API_KEY。

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(obj),
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return json(500, { error: "服务端未配置 OPENAI_API_KEY(请在 Netlify 站点环境变量里添加)。" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "请求体解析失败" }); }
  const { audio, mime = "audio/webm", lang } = body;
  if (!audio) return json(400, { error: "缺少音频数据" });

  let bytes;
  try { bytes = Buffer.from(audio, "base64"); } catch { return json(400, { error: "音频解码失败" }); }
  if (!bytes.length) return json(400, { error: "音频为空" });

  const ext = /mp4|m4a/.test(mime) ? "mp4" : /ogg/.test(mime) ? "ogg" : /wav/.test(mime) ? "wav" : "webm";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), `answer.${ext}`);
  form.append("model", "whisper-1");
  form.append("temperature", "0");
  if (lang === "zh" || lang === "en") form.append("language", lang);
  // 提示模型:答案是一个数字,倾向输出阿拉伯数字
  form.append("prompt", lang === "en" ? "The spoken answer is a number, e.g. 1234." : "口述的答案是一个数字,例如 1234。");

  let r;
  try {
    r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } catch (e) {
    return json(502, { error: "无法连接语音服务", detail: String(e).slice(0, 200) });
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return json(502, { error: "语音识别失败", detail: t.slice(0, 300) });
  }
  const data = await r.json().catch(() => ({}));
  return json(200, { text: (data.text || "").trim() });
};
