#!/usr/bin/env node
// /feedback 开发闭环脚本:在开发机上拉取线上反馈、领取、完成回写。认证用 netlify/functions/_secrets.mjs 里的 FEEDBACK_CLI_KEY。
//   node scripts/feedback.mjs list [open|doing|done|hold|all]     列表(默认 open+doing)
//   node scripts/feedback.mjs show <id>                            详情;有截图时存到 scratchpad/feedback/<id>.jpg
//   node scripts/feedback.mjs take <id>                            标「处理中」
//   node scripts/feedback.mjs done <id> "<处理结果>"               标「已完成」并写结果
//   node scripts/feedback.mjs hold <id> "<原因>"                   搁置
//   node scripts/feedback.mjs reopen <id>                          重新打开
//   node scripts/feedback.mjs add "<标题>" [--detail ..] [--kind bug|opt|feature|other] [--area 训练] [--side web|pad|both] [--pri high|mid|low] [--from 谁]
// FEEDBACK_SITE=https://superbrainlab-main.netlify.app 可换接口地址(默认主域名)。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { FEEDBACK_CLI_KEY } = await import(path.join(ROOT, "netlify/functions/_secrets.mjs"));
const SITE = (process.env.FEEDBACK_SITE || "https://superbrainlab.org").replace(/\/$/, "");
const [cmd = "list", ...rest] = process.argv.slice(2);

async function api(action, body = {}) {
  const r = await fetch(`${SITE}/.netlify/functions/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, cliKey: FEEDBACK_CLI_KEY, ...body }) });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
const KIND = { bug: "问题", opt: "优化", feature: "新功能", other: "其他" }, SIDE = { web: "网页", pad: "Pad", both: "两端" }, PRI = { high: "高", mid: "中", low: "低" }, ST = { open: "待处理", doing: "处理中", done: "已完成", hold: "搁置" };
const when = (t) => (t ? new Date(t).toLocaleString("zh-CN", { hour12: false }).replace(/:\d\d$/, "") : "");
const line = (i) => `${i.id}  [${ST[i.status]}|${PRI[i.priority]}]  ${KIND[i.kind]}·${i.area}·${SIDE[i.side]}${i.from ? "·" + i.from : ""}${i.hasImage ? "·📎" : ""}  ${i.title}  (${when(i.createdAt)})`;
const flag = (name) => { const k = rest.indexOf(`--${name}`); return k >= 0 ? rest[k + 1] : undefined; };

try {
  if (cmd === "list") {
    const want = rest[0] || "";
    const { items } = await api("list", want && want !== "all" ? { status: want } : {});
    const shown = want ? items : items.filter((i) => i.status === "open" || i.status === "doing");
    if (!shown.length) console.log(want ? "没有这种状态的反馈" : "没有待处理的反馈");
    for (const i of shown) { console.log(line(i)); if (i.detail) console.log("    " + i.detail.replace(/\n/g, "\n    ").slice(0, 400)); }
  } else if (cmd === "show") {
    const { item } = await api("get", { id: rest[0] });
    console.log(line({ ...item, hasImage: !!item.image }));
    if (item.detail) console.log("\n" + item.detail);
    if (item.result) console.log("\n处理结果:" + item.result + (item.handledBy ? `(${item.handledBy})` : ""));
    if (item.image) {
      const dir = path.join(ROOT, "scratchpad/feedback"); fs.mkdirSync(dir, { recursive: true });
      const m = item.image.match(/^data:image\/(\w+);base64,(.+)$/); const f = path.join(dir, `${item.id}.${m[1] === "jpeg" ? "jpg" : m[1]}`);
      fs.writeFileSync(f, Buffer.from(m[2], "base64")); console.log("\n截图:" + f);
    }
  } else if (cmd === "take" || cmd === "reopen") {
    const { item } = await api("save", { item: { id: rest[0], status: cmd === "take" ? "doing" : "open" } }); console.log(line(item));
  } else if (cmd === "done" || cmd === "hold") {
    const { item } = await api("save", { item: { id: rest[0], status: cmd, result: rest[1] || "" } }); console.log(line(item)); if (item.result) console.log("处理结果:" + item.result);
  } else if (cmd === "add") {
    const { item } = await api("save", { item: { title: rest[0], detail: flag("detail") || "", kind: flag("kind") || "opt", area: flag("area") || "其他", side: flag("side") || "web", priority: flag("pri") || "mid", from: flag("from") || "" } });
    console.log(line(item));
  } else { console.error("用法见文件头注释"); process.exit(2); }
} catch (e) { console.error("✗ " + e.message); process.exit(1); }
