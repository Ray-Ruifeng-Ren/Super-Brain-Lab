import { withCors } from "./_cors.mjs";
// 重置学生密码(2026-10-13 家长「忘了密码进不去」):教练对自己建的学生 / 管理员对任何人,直接设新密码。
// 需要 Supabase service_role 密钥(Auth Admin API),放 _secrets.mjs 的 SUPABASE_SERVICE_ROLE(gitignore,不进仓库、不到前端)。
// 鉴权:body.authToken(调用者登录态)→ /auth/v1/user 取 uid → 管理员(user_roles) 或 该学生 user_metadata.coachId===uid
//       或 scores 里有 该学生 join 到 uid 的记录(教练班级成员)。
import * as SECRETS from "./_secrets.mjs";

const SUPABASE_URL = "https://byjwwrhsafsuzgiydiuy.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5and3cmhzYWZzdXpnaXlkaXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTAxMjUsImV4cCI6MjEwMzg2NjEyNX0.3HIGb2oNNZR5O9J3hXmNr52ceBL4IQq4WTcHr-5IvNI";
const json = (statusCode, body) => ({ statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const inner = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const service = process.env.SUPABASE_SERVICE_ROLE || SECRETS.SUPABASE_SERVICE_ROLE;
  if (!service) return json(503, { error: "服务端尚未配置 service_role 密钥,暂不能重置密码(请联系管理员配置)" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad json" }); }
  const { authToken, studentId, newPassword } = body;
  if (!authToken || !studentId) return json(400, { error: "缺少参数" });
  if (typeof newPassword !== "string" || newPassword.length < 6) return json(400, { error: "新密码至少 6 位" });

  // 1) 调用者身份
  const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${authToken}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!me?.id) return json(401, { error: "请先登录" });

  // 2) 目标学生(service_role 读)
  const target = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${studentId}`, { headers: { apikey: service, Authorization: `Bearer ${service}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!target?.id) return json(404, { error: "找不到该账号" });

  // 3) 授权:管理员 / 建号教练 / 班级教练
  let allowed = false;
  const roles = await fetch(`${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${me.id}&role=eq.admin&limit=1`, { headers: { apikey: service, Authorization: `Bearer ${service}` } }).then((r) => r.json()).catch(() => []);
  if (Array.isArray(roles) && roles.length) allowed = true;
  if (!allowed && target.user_metadata?.coachId === me.id) allowed = true;
  if (!allowed) {
    const joins = await fetch(`${SUPABASE_URL}/rest/v1/scores?select=id&game=eq.class&mode=eq.join&user_id=eq.${studentId}&meta-%3E%3EcoachId=eq.${me.id}&limit=1`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }).then((r) => r.json()).catch(() => []);
    if (Array.isArray(joins) && joins.length) allowed = true;
  }
  if (!allowed) return json(403, { error: "只能重置自己班级学生的密码" });

  // 4) 重置
  const up = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${studentId}`, {
    method: "PUT", headers: { apikey: service, Authorization: `Bearer ${service}`, "content-type": "application/json" },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!up.ok) { const t = await up.text().catch(() => ""); return json(502, { error: "重置失败", detail: t.slice(0, 200) }); }
  return json(200, { ok: true });
};

export const handler = withCors(inner);
