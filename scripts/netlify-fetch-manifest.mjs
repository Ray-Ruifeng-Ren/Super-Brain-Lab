// 拉某次 Netlify 部署的完整文件清单(path → sha1),写到当前目录 deploy-files.json;给 netlify-deploy-api.mjs 用。
// 用法:node scripts/netlify-fetch-manifest.mjs [deployId]   (不传 = 站点当前已发布的那次)
import fs from "node:fs";
const SITE = "a4cf5cf3-1e55-49ea-9055-7fd3dba3d160";
const cfg = JSON.parse(fs.readFileSync(process.env.HOME + "/Library/Preferences/netlify/config.json", "utf8"));
const TOKEN = Object.values(cfg.users).map((u) => u.auth?.token).find(Boolean);
const api = async (p) => { const r = await fetch("https://api.netlify.com/api/v1" + p, { headers: { Authorization: `Bearer ${TOKEN}` } }); if (!r.ok) throw new Error(`${p} → ${r.status}`); return r.json(); };
let id = process.argv[2];
if (!id) { const site = await api(`/sites/${SITE}`); id = site.published_deploy.id; }
const all = [];
for (let page = 1; ; page++) {
  const arr = await api(`/deploys/${id}/files?per_page=100&page=${page}`);
  if (!Array.isArray(arr) || !arr.length) break;
  all.push(...arr.map((f) => ({ path: f.path, sha: f.sha })));
}
fs.writeFileSync("deploy-files.json", JSON.stringify({ deployId: id, files: all }));
console.log("manifest", id, "files:", all.length);
