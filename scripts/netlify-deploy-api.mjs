// 按文件摘要发布到 Netlify(几秒完成,不需要本地有 230MB 词块库):
//  - 本地 dist 里的文件算 sha1;线上没变的文件(词块库/视频/试听等)沿用 deploy-files.json(上次部署清单)里的 sha
//  - 函数沿用上次部署的 zip 摘要(函数代码改了必须先用 netlify CLI 发一次,再刷新清单)
//  - 只上传 Netlify 回报 required 的文件;发布成功后自动刷新 deploy-files.json
// 用法(在构建工作区 ~/Dev/sbl-app):npm run build && node scripts/netlify-deploy-api.mjs [--dry]
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { execSync } from "node:child_process";
// 发布前先过类型检查(2026-10-17 曾把少 import 的构建发上线一分钟):tsc 不过就不发
if (!process.argv.includes("--skip-tsc")) { try { execSync("npx tsc --noEmit -p tsconfig.app.json", { stdio: "inherit" }); } catch { console.error("tsc 未通过,停止发布"); process.exit(9); } }
const SITE = "a4cf5cf3-1e55-49ea-9055-7fd3dba3d160", DRY = process.argv.includes("--dry");
const cfg = JSON.parse(fs.readFileSync(process.env.HOME + "/Library/Preferences/netlify/config.json", "utf8"));
const TOKEN = Object.values(cfg.users).map((u) => u.auth?.token).find(Boolean);
const api = async (p, init = {}) => { const r = await fetch("https://api.netlify.com/api/v1" + p, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) } }); if (!r.ok) throw new Error(`${init.method || "GET"} ${p} → ${r.status} ${await r.text()}`); return r.json(); };
if (!fs.existsSync("deploy-files.json")) { console.error("缺 deploy-files.json:先 node scripts/netlify-fetch-manifest.mjs"); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync("deploy-files.json", "utf8"));
const PREV = manifest.deployId;
const files = {}; for (const f of manifest.files) if (!f.path.startsWith("/assets/")) files[f.path] = f.sha; // 旧 JS/CSS 块不保留
const byShaPath = {}, relOfSha = {}; let newCount = 0; // relOfSha:发布路径(dist 外的 ~/Dev/zhuxiang-release 也要对)
const walk = (dir, rel = "") => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name), r = rel + "/" + e.name; if (e.isDirectory()) walk(p, r); else { const sha = crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex"); files[r] = sha; byShaPath[sha] = p; relOfSha[sha] = r; newCount++; } } };
walk("dist");
// 2026-11-03 安卓安装包下载页:~/Dev/zhuxiang-release 里的文件(download/ 页面 + 最新 APK)每次都一起发布,
// 不放 public/(否则会被打进 App 包里),也不放工作区(app-sync 的 rsync --delete 会删)。由 scripts/android-apk.sh 生成。
const EXTRA = process.env.HOME + "/Dev/zhuxiang-release";
if (fs.existsSync(EXTRA)) walk(EXTRA);
// FN_FROM=<部署 id>:函数摘要取自那次部署(比如新函数先用 CLI 发了草稿预览,再用本脚本带全量文件发生产,不用 CLI --prod、不丢词块库)
const fx = await api(`/deploys/${process.env.FN_FROM || PREV}/functions`);
const functions = Object.fromEntries(fx.functions.map((f) => [f.n, f.d]));
console.log(`digest: ${Object.keys(files).length} files (${newCount} local), functions: ${Object.keys(functions).join(",")}, prev ${PREV}`);
if (DRY) process.exit(0);
const dep = await api(`/sites/${SITE}/deploys`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files, functions, draft: false, title: "api-deploy " + new Date().toISOString() }) });
console.log("deploy", dep.id, "required files:", dep.required?.length, "required functions:", dep.required_functions?.length);
if (dep.required_functions?.length) { console.error("函数需要重新上传,请改用 netlify CLI 发布:", dep.required_functions); process.exit(2); }
// 并发上传 + 重试(2026-10-24 数末词块一次 1.5 万个文件,串行要几小时);并发别太高,Netlify 会限流
const req = dep.required || [];
for (const sha of req) if (!byShaPath[sha]) { console.error("required sha 不在本地:", sha); process.exit(3); }
let n = 0, cur = 0, failed = null;
const UPLOAD_CONC = Number(process.env.UPLOAD_CONC || 6);
await Promise.all(Array.from({ length: UPLOAD_CONC }, async () => {
  while (cur < req.length && !failed) {
    const p = byShaPath[req[cur++]];
    const rel = relOfSha[req[cur - 1]];
    for (let k = 0; ; k++) {
      const r = await fetch(`https://api.netlify.com/api/v1/deploys/${dep.id}/files${encodeURI(rel)}`, { method: "PUT", headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/octet-stream" }, body: fs.readFileSync(p) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
      if (r.ok) break;
      if (k >= 5) { failed = `${rel} ${r.status} ${await r.text()}`; break; }
      await new Promise((res) => setTimeout(res, 1000 * 2 ** k)); // 429/5xx 退避重试
    }
    if (++n % 500 === 0) console.log("uploaded", n, "/", req.length);
  }
}));
if (failed) { console.error("upload failed", failed); process.exit(4); }
console.log("uploaded", n, "files");
for (let i = 0; i < 80; i++) {
  const d = await api(`/deploys/${dep.id}`);
  if (d.state === "ready") {
    console.log("LIVE", d.ssl_url);
    // 刷新清单到这次部署(新 assets 进清单,下次继续增量)
    const newFiles = Object.entries(files).map(([p, sha]) => ({ path: p, sha }));
    fs.writeFileSync("deploy-files.json", JSON.stringify({ deployId: dep.id, files: newFiles }));
    process.exit(0);
  }
  if (d.state === "error") { console.error("deploy error:", d.error_message); process.exit(5); }
  await new Promise((r) => setTimeout(r, 3000));
}
