// 用户反馈 / 开发闭环(/feedback 页面):管理员把用户反馈或自己的优化想法记进来,开发这边(Claude Code 会话里的 scripts/feedback.mjs)拉出来逐条实现,
// 做完标记「已完成」并写处理结果,页面上就能看到闭环。只有管理员账号能读写;脚本端用 _secrets.mjs 里的 FEEDBACK_CLI_KEY 认证。
// POST { action, authToken | cliKey, ... }
//   list { status? }           → { items }        列表不带图(只给 hasImage),按状态/优先级/时间排
//   get { id }                 → { item }         单条,带图
//   save { item }              → { item }         新增或修改(带 id 即修改;修改时没传的字段沿用旧值)
//   remove { id }              → { ok }
// 数据存 Netlify Blobs「feedback」,每条 f/<id>;迁到自建服务器时由 server/fn/blobs.mjs 接管,接口不变。
import { withCors } from "./_cors.mjs";
import { getStore } from "@netlify/blobs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import * as SECRETS from "./_secrets.mjs";

const SUPABASE_URL = "https://byjwwrhsafsuzgiydiuy.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5and3cmhzYWZzdXpnaXlkaXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTAxMjUsImV4cCI6MjEwMzg2NjEyNX0.3HIGb2oNNZR5O9J3hXmNr52ceBL4IQq4WTcHr-5IvNI";
const json = (statusCode, body) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) });

function store() {
  const siteID = process.env.NETLIFY_SITE_ID || SECRETS.NETLIFY_SITE_ID, token = process.env.NETLIFY_BLOBS_TOKEN || SECRETS.NETLIFY_BLOBS_TOKEN;
  return siteID && token ? getStore({ name: "feedback", siteID, token, consistency: "strong" }) : getStore({ name: "feedback", consistency: "strong" });
}
async function adminOf(authToken) {
  if (!authToken) return null;
  const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${authToken}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!me?.id) return null;
  const service = process.env.SUPABASE_SERVICE_ROLE || SECRETS.SUPABASE_SERVICE_ROLE;
  const roles = await fetch(`${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${me.id}&role=eq.admin&limit=1`, { headers: { apikey: service, Authorization: `Bearer ${service}` } }).then((r) => r.json()).catch(() => []);
  return Array.isArray(roles) && roles.length ? { id: me.id, email: me.email || "" } : null;
}
// 脚本端(开发机)认证:固定密钥,等长比较
function cliOk(key) {
  const want = process.env.FEEDBACK_CLI_KEY || SECRETS.FEEDBACK_CLI_KEY || "";
  if (!key || !want || key.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(want));
}

export const KINDS = ["bug", "opt", "feature", "other"];           // 问题 / 优化 / 新功能 / 其他
export const AREAS = ["训练", "教练", "比赛", "出题", "官网", "账号", "App", "其他"];
export const SIDES = ["web", "pad", "both"];
export const PRIORITIES = ["high", "mid", "low"];
export const STATUSES = ["open", "doing", "done", "hold"];          // 待处理 / 处理中 / 已完成 / 搁置
const PRI_RANK = { high: 0, mid: 1, low: 2 }, ST_RANK = { doing: 0, open: 1, hold: 2, done: 3 };
const IMG_MAX = 1_000_000; // 图片 data URL 最长 100 万字符(前端已压到 1400px JPEG)

const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").trim().slice(0, n);
const pick = (v, list, dft) => (list.includes(v) ? v : dft);
const strip = ({ image, ...rest }) => ({ ...rest, hasImage: !!image });

function normalize(e, prev) {
  const title = clean(e.title ?? prev?.title, 120);
  if (!title) throw Object.assign(new Error("请写一句标题"), { status: 400 });
  let image = prev?.image || "";
  if (e.image !== undefined) {
    image = String(e.image || "");
    if (image && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw Object.assign(new Error("图片格式不对"), { status: 400 });
    if (image.length > IMG_MAX) throw Object.assign(new Error("图片太大,请换小一点的截图"), { status: 400 });
  }
  const status = pick(e.status ?? prev?.status, STATUSES, "open");
  return {
    id: prev?.id || e.id,
    title,
    detail: clean(e.detail ?? prev?.detail, 4000),
    kind: pick(e.kind ?? prev?.kind, KINDS, "opt"),
    area: pick(e.area ?? prev?.area, AREAS, "其他"),
    side: pick(e.side ?? prev?.side, SIDES, "web"),
    priority: pick(e.priority ?? prev?.priority, PRIORITIES, "mid"),
    status,
    result: clean(e.result ?? prev?.result, 4000),
    image,
    from: clean(e.from ?? prev?.from, 60), // 反馈来自谁(学生 / 教练 / 付海东 / 自己……)
    createdAt: prev?.createdAt || Date.now(),
    updatedAt: Date.now(),
    doneAt: status === "done" ? prev?.doneAt || Date.now() : null,
  };
}

const inner = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad json" }); }
  try {
    const user = cliOk(body.cliKey) ? { id: "cli", email: "dev-cli" } : await adminOf(body.authToken);
    if (!user) return json(403, { error: "需要管理员账号登录" });
    const s = store();
    const idOk = (id) => /^[a-f0-9]{12}$/.test(id || "");
    if (body.action === "list") {
      const keys = (await s.list({ prefix: "f/" })).blobs.map((b) => b.key);
      let items = (await Promise.all(keys.map((k) => s.get(k, { type: "json" }).catch(() => null)))).filter(Boolean).map(strip);
      if (body.status && STATUSES.includes(body.status)) items = items.filter((x) => x.status === body.status);
      items.sort((a, b) => ST_RANK[a.status] - ST_RANK[b.status] || PRI_RANK[a.priority] - PRI_RANK[b.priority] || b.createdAt - a.createdAt);
      return json(200, { items });
    }
    if (body.action === "get") {
      if (!idOk(body.id)) return json(400, { error: "id 不对" });
      const item = await s.get(`f/${body.id}`, { type: "json" }).catch(() => null);
      return item ? json(200, { item }) : json(404, { error: "这条反馈不存在" });
    }
    if (body.action === "save") {
      const id = idOk(body.item?.id) ? body.item.id : null;
      const prev = id ? await s.get(`f/${id}`, { type: "json" }).catch(() => null) : null;
      if (id && !prev) return json(404, { error: "这条反馈不存在" });
      const item = normalize({ ...body.item, id: id || randomBytes(6).toString("hex") }, prev);
      item.by = prev?.by || user.email;
      if (prev && (prev.status !== item.status || prev.result !== item.result)) item.handledBy = user.email;
      await s.setJSON(`f/${item.id}`, item);
      return json(200, { item: strip(item) });
    }
    if (body.action === "remove") {
      if (!idOk(body.id)) return json(400, { error: "id 不对" });
      await s.delete(`f/${body.id}`);
      return json(200, { ok: true });
    }
    return json(400, { error: "未知操作" });
  } catch (e) {
    return json(e.status || 500, { error: e.status ? e.message : "服务器出错,请稍后再试" });
  }
};
export const handler = withCors(inner);
