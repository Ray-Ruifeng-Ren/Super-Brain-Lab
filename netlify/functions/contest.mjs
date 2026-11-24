// 比赛系统接口(/game):POST { action, ...body },组织者操作带 authToken(Supabase 登录态)。业务在 _contest-core.mjs。
import { withCors } from "./_cors.mjs";
import { getStore } from "@netlify/blobs";
import * as SECRETS from "./_secrets.mjs";
import { makeCore } from "./_contest-core.mjs";

const SUPABASE_URL = "https://byjwwrhsafsuzgiydiuy.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5and3cmhzYWZzdXpnaXlkaXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTAxMjUsImV4cCI6MjEwMzg2NjEyNX0.3HIGb2oNNZR5O9J3hXmNr52ceBL4IQq4WTcHr-5IvNI";
const json = (statusCode, body) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) });

function store() {
  const siteID = process.env.NETLIFY_SITE_ID || SECRETS.NETLIFY_SITE_ID, token = process.env.NETLIFY_BLOBS_TOKEN || SECRETS.NETLIFY_BLOBS_TOKEN;
  return siteID && token ? getStore({ name: "contest", siteID, token, consistency: "strong" }) : getStore({ name: "contest", consistency: "strong" });
}
let core;
function getCore() {
  if (core) return core;
  const s = store();
  core = makeCore({
    get: (k) => s.get(k, { type: "json" }).catch(() => null),
    set: (k, v) => s.setJSON(k, v),
    list: async (prefix) => (await s.list({ prefix })).blobs.map((b) => b.key),
  });
  return core;
}
async function userOf(authToken) {
  if (!authToken) return null;
  const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${authToken}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!me?.id) return null;
  const service = process.env.SUPABASE_SERVICE_ROLE || SECRETS.SUPABASE_SERVICE_ROLE;
  const roles = service ? await fetch(`${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${me.id}&role=eq.admin&limit=1`, { headers: { apikey: service, Authorization: `Bearer ${service}` } }).then((r) => r.json()).catch(() => []) : [];
  return { id: me.id, admin: Array.isArray(roles) && roles.length > 0 };
}
const inner = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad json" }); }
  const { action, authToken, ...rest } = body;
  try {
    const user = await userOf(authToken);
    return json(200, await getCore()(action, rest, user));
  } catch (e) {
    return json(e.status || 500, { error: e.status ? e.message : "服务器出错,请稍后再试" });
  }
};
export const handler = withCors(inner);
