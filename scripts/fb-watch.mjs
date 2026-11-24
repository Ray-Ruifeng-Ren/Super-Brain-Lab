// 轮询线上 /feedback,发现新的「待处理」就输出一行并退出(后台任务退出 = 叫醒 Claude 处理)。已见过的 id 记在 scratchpad/fb-seen.json。
// 用法:node scripts/fb-watch.mjs --init(只记录现状不输出)| --once | --exit-on-new(默认每 5 分钟查一次,最多挂 15 天)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { FEEDBACK_CLI_KEY } = await import(path.join(ROOT, "netlify/functions/_secrets.mjs"));
const SEEN = path.join(ROOT, "scratchpad/fb-seen.json");
fs.mkdirSync(path.dirname(SEEN), { recursive: true });
const seen = new Set(fs.existsSync(SEEN) ? JSON.parse(fs.readFileSync(SEEN, "utf8")) : []);
const once = process.argv.includes("--once"), init = process.argv.includes("--init"), exitOnNew = process.argv.includes("--exit-on-new");
const started = Date.now(), MAX_MS = 15 * 24 * 3600 * 1000;
let found = 0;
const KIND = { bug: "问题", opt: "优化", feature: "新功能", other: "其他" }, SIDE = { web: "网页", pad: "Pad", both: "两端" }, PRI = { high: "高", mid: "中", low: "低" };
for (;;) {
  try {
    const r = await fetch("https://superbrainlab.org/.netlify/functions/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "list", status: "open", cliKey: FEEDBACK_CLI_KEY }) });
    const { items = [] } = r.ok ? await r.json() : {};
    for (const i of items) {
      if (seen.has(i.id)) continue;
      seen.add(i.id);
      found++;
      if (!init) console.log(`NEW ${i.id} [${PRI[i.priority]}] ${KIND[i.kind]}·${i.area}·${SIDE[i.side]}${i.from ? "·" + i.from : ""}${i.hasImage ? "·📎" : ""} ${i.title}`);
    }
    fs.writeFileSync(SEEN, JSON.stringify([...seen]));
  } catch (e) { process.stderr.write("poll failed: " + e.message + "\n"); }
  if (once || init) break;
  if (exitOnNew && found) process.exit(0);
  if (Date.now() - started > MAX_MS) { console.log("WATCH_EXPIRED 15d"); process.exit(0); }
  await new Promise((ok) => setTimeout(ok, Number(process.env.POLL_MS) || 300_000));
}
