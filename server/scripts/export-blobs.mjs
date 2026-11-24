// 把 Netlify Blobs 里的数据(比赛数据 contest、报题语音缓存 tts-cache)导出成新服务器 blobs 适配层的文件格式。
// 只读线上,不写、不删。在本机构建目录跑:
//   cd ~/Dev/sbl-app && node server/scripts/export-blobs.mjs [输出目录] [--with-tts]
// 然后 rsync -a <输出目录>/ root@服务器:/srv/zhuxiang/blobs/
// tts-cache 只是缓存(没有也能用,会重新合成),量大时可以不带;contest 必须带(比赛、报名、成绩都在里面)。
import fs from "node:fs";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import * as S from "../../netlify/functions/_secrets.mjs";

const args = process.argv.slice(2);
const OUT = path.resolve(args.find((a) => !a.startsWith("--")) || "blobs-export");
const stores = ["contest", ...(args.includes("--with-tts") ? ["tts-cache"] : [])];
const siteID = S.NETLIFY_SITE_ID, token = S.NETLIFY_BLOBS_TOKEN;
if (!siteID || !token) { console.error("✗ _secrets.mjs 里缺 NETLIFY_SITE_ID / NETLIFY_BLOBS_TOKEN"); process.exit(1); }

for (const name of stores) {
  const s = getStore({ name, siteID, token, consistency: "strong" });
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  const keys = [];
  for await (const page of s.list({ paginate: true })) keys.push(...page.blobs.map((b) => b.key));
  let n = 0, bytes = 0;
  const CONC = 8;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (keys.length) {
      const key = keys.pop();
      const buf = Buffer.from(await s.get(key, { type: "arrayBuffer" }));
      fs.writeFileSync(path.join(dir, encodeURIComponent(key)), buf); // 和 server/fn/blobs.mjs 同一编码规则
      n++; bytes += buf.length;
      if (n % 500 === 0) console.log(`  ${name}: ${n} 条…`);
    }
  }));
  console.log(`✓ ${name}: ${n} 条,${(bytes / 1048576).toFixed(1)} MB → ${dir}`);
}
