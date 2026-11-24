// 把 netlify/functions 复制到 server/fn/functions,改成能在自建服务器上跑的版本。原文件一个字不动。
// 改动只有三类,都是「换连接地址」,业务逻辑不变:
//   1. @netlify/blobs → ../blobs.mjs(数据存本机磁盘)
//   2. 写死的 Supabase 云端地址 → 环境变量 SUPABASE_INTERNAL_URL(服务器内网的 kong)
//   3. 写死的 anon 密钥 → 环境变量 SUPABASE_ANON_KEY(沿用原项目 JWT 密钥时两者相同,可不设)
// 每条替换都必须命中,命中不了就报错退出 —— 以后函数代码改了,这里会第一时间发现,不会悄悄连回云端。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "../../netlify/functions");
const OUT = path.join(HERE, "functions");
const CLOUD_URL = "https://byjwwrhsafsuzgiydiuy.supabase.co";

// 每个文件要做的替换:[正则, 替换, 预期命中次数]
const RULES = {
  "contest.mjs": ["blobs", "url", "anon"],
  "tts.mjs": ["blobs"],
  "delete-account.mjs": ["url", "anon"],
  "reset-password.mjs": ["url", "anon"],
  "ticket.mjs": ["url", "anon"],
  "ledger.mjs": ["blobs", "url", "anon"],
  "feedback.mjs": ["blobs", "url", "anon"],
  "login-alias.mjs": ["url"],
};
const RX = {
  blobs: [/from "@netlify\/blobs"/g, 'from "../blobs.mjs"'],
  url: [/const SUPABASE_URL = "https:\/\/byjwwrhsafsuzgiydiuy\.supabase\.co";/g, `const SUPABASE_URL = process.env.SUPABASE_INTERNAL_URL || "${CLOUD_URL}";`],
  anon: [/const ANON = ("eyJ[A-Za-z0-9_.-]+");/g, "const ANON = process.env.SUPABASE_ANON_KEY || $1;"],
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let failed = false;
for (const f of fs.readdirSync(SRC)) {
  if (!f.endsWith(".mjs")) continue;
  let code = fs.readFileSync(path.join(SRC, f), "utf8");
  for (const rule of RULES[f] || []) {
    const [rx, rep] = RX[rule];
    const n = (code.match(rx) || []).length;
    if (n !== 1) { console.error(`✗ ${f}:规则「${rule}」应命中 1 次,实际 ${n} 次`); failed = true; continue; }
    code = code.replace(rx, rep);
  }
  // 兜底检查:除 admin-data(走环境变量 SUPABASE_URL)外,不允许再有写死的云端地址
  const left = code.split(CLOUD_URL).length - 1 - (code.includes(`|| "${CLOUD_URL}"`) ? 1 : 0);
  if (left > 0) { console.error(`✗ ${f}:还有 ${left} 处写死的云端 Supabase 地址,请在 prepare.mjs 里加规则`); failed = true; }
  if (code.includes("@netlify/blobs")) { console.error(`✗ ${f}:还在引用 @netlify/blobs`); failed = true; }
  fs.writeFileSync(path.join(OUT, f), code);
}
// 自建服务器专用的函数(extra/)覆盖同名文件:admin-data 改成后台现在用的接口
const EXTRA = path.join(HERE, "extra");
for (const f of fs.existsSync(EXTRA) ? fs.readdirSync(EXTRA) : []) if (f.endsWith(".mjs")) { fs.copyFileSync(path.join(EXTRA, f), path.join(OUT, f)); console.log(`  · ${f} 用 extra/ 版本`); }
if (failed) process.exit(1);
console.log(`✓ 已准备 ${fs.readdirSync(OUT).length} 个文件 → ${path.relative(process.cwd(), OUT) || OUT}`);
