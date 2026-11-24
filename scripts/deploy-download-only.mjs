// 只更新安卓下载页(2026-11-06 用户「只更新下载链接,其他内容不用变」):
// 沿用上次部署的完整文件清单(含 JS/CSS),只替换 /download/ 下两个文件;函数也沿用上次部署。
import fs from "node:fs"; import crypto from "node:crypto";
const SITE = "a4cf5cf3-1e55-49ea-9055-7fd3dba3d160";
const cfg = JSON.parse(fs.readFileSync(process.env.HOME + "/Library/Preferences/netlify/config.json", "utf8"));
const TOKEN = Object.values(cfg.users).map((u) => u.auth?.token).find(Boolean);
const api = async (p, init = {}) => { const r = await fetch("https://api.netlify.com/api/v1" + p, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) } }); if (!r.ok) throw new Error(`${p} → ${r.status} ${await r.text()}`); return r.json(); };
const manifest = JSON.parse(fs.readFileSync("deploy-files.json", "utf8"));
const files = Object.fromEntries(manifest.files.map((f) => [f.path, f.sha]));
const DIR = process.env.HOME + "/Dev/zhuxiang-release/download", local = {};
for (const n of fs.readdirSync(DIR)) { const p = `${DIR}/${n}`, sha = crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex"); files[`/download/${n}`] = sha; local[sha] = [p, `/download/${n}`]; }
const fx = await api(`/deploys/${manifest.deployId}/functions`);
const functions = Object.fromEntries(fx.functions.map((f) => [f.n, f.d]));
const dep = await api(`/sites/${SITE}/deploys`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files, functions, draft: false, title: "download-only " + new Date().toISOString() }) });
console.log("deploy", dep.id, "required", dep.required?.length, "fn", dep.required_functions?.length);
for (const sha of dep.required || []) {
  const [p, rel] = local[sha] || []; if (!p) { console.error("unexpected required", sha); process.exit(3); }
  const r = await fetch(`https://api.netlify.com/api/v1/deploys/${dep.id}/files${encodeURI(rel)}`, { method: "PUT", headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/octet-stream" }, body: fs.readFileSync(p) });
  if (!r.ok) { console.error("upload fail", rel, r.status); process.exit(4); } console.log("uploaded", rel);
}
for (let i = 0; i < 60; i++) { const d = await api(`/deploys/${dep.id}`); if (d.state === "ready") { console.log("LIVE"); break; } await new Promise((r) => setTimeout(r, 2000)); }
manifest.deployId = dep.id; manifest.files = Object.entries(files).map(([path, sha]) => ({ path, sha }));
fs.writeFileSync("deploy-files.json", JSON.stringify(manifest));
