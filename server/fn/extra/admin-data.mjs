// 管理后台数据(自建服务器版):替代 Supabase 云端的同名 Edge Function,接口与 src/pages/Admin.tsx 的调用一致。
//   POST { action: "overview" }            → { users, attempts, correct }
//   POST { action: "users", limit?: 1000 } → { users: [{ id, nickname, email, created_at, total, correct, last_active }] }
// 鉴权:请求头带当前登录用户的令牌(supabase.functions.invoke 自动带),且该用户在 user_roles 里是 admin。
// prepare.mjs 会用这个文件覆盖 netlify/functions 里的旧版 admin-data(旧版走口令,后台已经不用了)。
import { withCors } from "./_cors.mjs";

const URL_ = process.env.SUPABASE_INTERNAL_URL || "http://kong:8000";
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const PAGE = 1000; // PostgREST 默认单次最多 1000 行,必须分页

const json = (statusCode, obj) => ({ statusCode, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, body: JSON.stringify(obj) });
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

async function rest(path, headers = svc) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers });
  if (!r.ok) throw new Error(`rest ${path} → ${r.status}`);
  return r;
}
async function count(table, filter = "") {
  const r = await rest(`${table}?select=id${filter}&limit=1`, { ...svc, Prefer: "count=exact" });
  return Number((r.headers.get("content-range") || "*/0").split("/")[1]) || 0;
}
async function all(table, select) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const rows = await (await rest(`${table}?select=${select}&order=created_at.asc`, { ...svc, Range: `${from}-${from + PAGE - 1}` })).json();
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
async function isAdmin(authHeader) {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "");
  if (!token || token === ANON) return false;
  const me = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!me?.id) return false;
  const roles = await (await rest(`user_roles?select=role&user_id=eq.${me.id}&role=eq.admin&limit=1`)).json();
  return roles.length > 0;
}

const inner = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  if (!SERVICE || !ANON) return json(500, { error: "服务器未配置 SUPABASE_SERVICE_ROLE / SUPABASE_ANON_KEY" });
  if (!(await isAdmin(event.headers.authorization))) return json(403, { error: "需要管理员账号" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "请求体解析失败" }); }
  try {
    if (body.action === "overview") {
      const [users, attempts, correct] = await Promise.all([count("profiles"), count("practice_attempts"), count("practice_attempts", "&correct=is.true")]);
      return json(200, { users, attempts, correct });
    }
    if (body.action === "users") {
      const limit = Math.max(1, Math.min(5000, Number(body.limit) || 1000));
      const authUsers = [];
      for (let page = 1; page <= 100; page++) {
        const r = await fetch(`${URL_}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: svc });
        if (!r.ok) throw new Error("读取用户失败 " + r.status);
        const list = (await r.json()).users || [];
        authUsers.push(...list);
        if (list.length < 200) break;
      }
      const [profs, atts] = await Promise.all([all("profiles", "id,nickname"), all("practice_attempts", "user_id,correct,created_at")]);
      const nick = new Map(profs.map((p) => [p.id, p.nickname]));
      const stat = new Map();
      for (const a of atts) {
        const s = stat.get(a.user_id) || { total: 0, correct: 0, last: null };
        s.total++; if (a.correct) s.correct++; if (!s.last || a.created_at > s.last) s.last = a.created_at;
        stat.set(a.user_id, s);
      }
      const users = authUsers
        .map((u) => { const s = stat.get(u.id); return { id: u.id, nickname: nick.get(u.id) ?? null, email: u.email || u.phone || "", created_at: u.created_at, total: s?.total || 0, correct: s?.correct || 0, last_active: s?.last || u.last_sign_in_at || null }; })
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
        .slice(0, limit);
      return json(200, { users });
    }
    return json(400, { error: "未知 action" });
  } catch (e) {
    console.error("[admin-data]", e);
    return json(502, { error: "读取数据失败" });
  }
};
export const handler = withCors(inner);
