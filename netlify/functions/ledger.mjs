// 账单(/bill 页面):公司注资和各项支出。只有管理员账号能读写(页面上的管理口令只是前置门,真正的校验在这里)。
// POST { action, authToken, ... }
//   list                       → { entries }
//   save { entry }             → { entry }   新增或修改(带 id 即修改)
//   remove { id }              → { ok }
// 数据存 Netlify Blobs「ledger」,每笔一条 e/<id>;迁到自建服务器时由 server/fn/blobs.mjs 接管,接口不变。
import { withCors } from "./_cors.mjs";
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import * as SECRETS from "./_secrets.mjs";

const SUPABASE_URL = "https://byjwwrhsafsuzgiydiuy.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5and3cmhzYWZzdXpnaXlkaXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTAxMjUsImV4cCI6MjEwMzg2NjEyNX0.3HIGb2oNNZR5O9J3hXmNr52ceBL4IQq4WTcHr-5IvNI";
const json = (statusCode, body) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) });

function store() {
  const siteID = process.env.NETLIFY_SITE_ID || SECRETS.NETLIFY_SITE_ID, token = process.env.NETLIFY_BLOBS_TOKEN || SECRETS.NETLIFY_BLOBS_TOKEN;
  return siteID && token ? getStore({ name: "ledger", siteID, token, consistency: "strong" }) : getStore({ name: "ledger", consistency: "strong" });
}
async function adminOf(authToken) {
  if (!authToken) return null;
  const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${authToken}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!me?.id) return null;
  const service = process.env.SUPABASE_SERVICE_ROLE || SECRETS.SUPABASE_SERVICE_ROLE;
  const roles = await fetch(`${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${me.id}&role=eq.admin&limit=1`, { headers: { apikey: service, Authorization: `Bearer ${service}` } }).then((r) => r.json()).catch(() => []);
  return Array.isArray(roles) && roles.length ? { id: me.id, email: me.email || "" } : null;
}

const KINDS = new Set(["in", "out"]);
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
function normalize(e, prev) {
  const date = clean(e.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Object.assign(new Error("日期格式应为 2026-11-10"), { status: 400 });
  const kind = KINDS.has(e.kind) ? e.kind : "out";
  const item = clean(e.item, 60); if (!item) throw Object.assign(new Error("请填写项目"), { status: 400 });
  // 金额可以留空 = 待确认(不计入合计);填了就必须是不小于 0 的数,单位人民币元,保留两位小数
  const raw = e.amount === "" || e.amount == null ? null : Number(e.amount);
  if (raw != null && !(Number.isFinite(raw) && raw >= 0 && raw < 1e9)) throw Object.assign(new Error("金额不对"), { status: 400 });
  return { id: prev?.id || e.id, date, kind, item, category: clean(e.category, 20) || "其他", amount: raw == null ? null : Math.round(raw * 100) / 100, note: clean(e.note, 200), createdAt: prev?.createdAt || Date.now(), updatedAt: Date.now() };
}

const inner = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad json" }); }
  try {
    const user = await adminOf(body.authToken);
    if (!user) return json(403, { error: "需要管理员账号登录" });
    const s = store();
    if (body.action === "list") {
      const keys = (await s.list({ prefix: "e/" })).blobs.map((b) => b.key);
      const entries = (await Promise.all(keys.map((k) => s.get(k, { type: "json" }).catch(() => null)))).filter(Boolean);
      entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
      return json(200, { entries });
    }
    if (body.action === "save") {
      const id = body.entry?.id && /^[a-f0-9]{12}$/.test(body.entry.id) ? body.entry.id : null;
      const prev = id ? await s.get(`e/${id}`, { type: "json" }).catch(() => null) : null;
      if (id && !prev) return json(404, { error: "这笔账不存在" });
      const entry = normalize({ ...body.entry, id: id || randomBytes(6).toString("hex") }, prev);
      entry.by = user.email;
      await s.setJSON(`e/${entry.id}`, entry);
      return json(200, { entry });
    }
    if (body.action === "remove") {
      if (!/^[a-f0-9]{12}$/.test(body.id || "")) return json(400, { error: "id 不对" });
      await s.delete(`e/${body.id}`);
      return json(200, { ok: true });
    }
    return json(400, { error: "未知操作" });
  } catch (e) {
    return json(e.status || 500, { error: e.status ? e.message : "服务器出错,请稍后再试" });
  }
};
export const handler = withCors(inner);
