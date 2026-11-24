// 自建服务器上的云函数运行器:把 netlify/functions 里的 handler(event) 原样挂到一个 HTTP 服务上。
//   /.netlify/functions/<名字>   —— 网页和 App 现在调用的路径,不用改前端
//   /functions/v1/<名字>         —— supabase.functions.invoke(经 nginx 的 /sb-api/functions/v1/ 转过来)
// 函数文件由 prepare.mjs 从 netlify/functions 复制并做少量替换,原文件不动。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FN_DIR = process.env.FN_DIR || path.join(HERE, "functions");
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 12 * 1024 * 1024; // 比赛报名照片、语音作答录音都是 base64,留足余量

const handlers = new Map();
for (const f of fs.readdirSync(FN_DIR)) {
  if (!f.endsWith(".mjs") || f.startsWith("_")) continue; // _ 开头的是共用模块,Netlify 也不把它当函数
  const mod = await import(pathToFileURL(path.join(FN_DIR, f)).href);
  if (typeof mod.handler === "function") handlers.set(f.slice(0, -4), mod.handler);
}
console.log(`[fn] 已加载 ${handlers.size} 个函数:${[...handlers.keys()].join(", ")}`);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error("too large"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const TEXTUAL = /^(text\/|application\/(json|x-www-form-urlencoded|xml|javascript))/;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/healthz") { res.writeHead(200, { "content-type": "text/plain" }); return res.end("ok"); }
  const m = url.pathname.match(/^\/(?:\.netlify\/functions|functions\/v1)\/([A-Za-z0-9_-]+)\/?$/);
  const handler = m && handlers.get(m[1]);
  if (!handler) { res.writeHead(404, { "content-type": "application/json" }); return res.end('{"error":"not found"}'); }
  const t0 = Date.now();
  try {
    const raw = await readBody(req);
    const ctype = String(req.headers["content-type"] || "");
    const binary = raw.length > 0 && ctype && !TEXTUAL.test(ctype);
    const event = {
      httpMethod: req.method,
      path: url.pathname,
      rawUrl: `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}${req.url}`,
      headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(", ") : v])),
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: raw.length ? (binary ? raw.toString("base64") : raw.toString("utf8")) : null,
      isBase64Encoded: binary,
    };
    const out = (await handler(event, {})) || { statusCode: 204 };
    const body = out.body == null ? "" : out.isBase64Encoded ? Buffer.from(out.body, "base64") : out.body;
    res.writeHead(out.statusCode || 200, out.headers || {});
    res.end(body);
    console.log(`[fn] ${req.method} ${m[1]} → ${out.statusCode || 200} ${Date.now() - t0}ms`);
  } catch (e) {
    console.error(`[fn] ${m[1]} 出错:`, e);
    res.writeHead(e.status || 500, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({ error: e.status === 413 ? "请求太大" : "服务器出错,请稍后再试" }));
  }
});
server.listen(PORT, () => console.log(`[fn] 监听 :${PORT}`));
