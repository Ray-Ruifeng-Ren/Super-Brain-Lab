// 用注册时填的邮箱登录(2026-11-12 印度用户 SARADA:用手机号注册、附带填了邮箱,登录时填邮箱 → 找不到账号):
// 账号底层是 <区号><号码>@phone.superbrainlab.org,邮箱只存在资料里。这里把「资料里的邮箱」换算成真正的登录账号,
// 前端拿到后再用密码登录一次;密码不经过这里,查不到就返回空。
// POST { email } → { account: "919884010800@phone.superbrainlab.org" | null }
import { withCors } from "./_cors.mjs";
import * as SECRETS from "./_secrets.mjs";

const SUPABASE_URL = "https://byjwwrhsafsuzgiydiuy.supabase.co";
const json = (statusCode, body) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) });

const inner = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad json" }); }
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith("@phone.superbrainlab.org") || email.endsWith("@stu.superbrainlab.org")) return json(200, { account: null });
  const service = process.env.SUPABASE_SERVICE_ROLE || SECRETS.SUPABASE_SERVICE_ROLE;
  if (!service) return json(500, { error: "服务端未配置" });
  const h = { apikey: service, Authorization: `Bearer ${service}` };
  try {
    const matches = [];
    for (let page = 1; page <= 50; page++) {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: h });
      if (!r.ok) return json(502, { error: "查询失败" });
      const users = (await r.json()).users || [];
      for (const u of users) if (String(u.user_metadata?.signup_email || "").trim().toLowerCase() === email) matches.push(u);
      if (users.length < 200) break;
    }
    if (!matches.length) return json(200, { account: null });
    // 同一个邮箱注册了多次(如先打错手机号又重注册):取最近登录过的,否则取最新注册的
    matches.sort((a, b) => (b.last_sign_in_at || b.created_at).localeCompare(a.last_sign_in_at || a.created_at));
    return json(200, { account: matches[0].email });
  } catch {
    return json(500, { error: "服务器出错,请稍后再试" });
  }
};
export const handler = withCors(inner);
