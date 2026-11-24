import { withCors } from "./_cors.mjs";
// 注销账号(2026-11-08):POST,Authorization: Bearer <用户登录令牌>。业务在 _delete-account-core.mjs。
// 需要 _secrets.mjs 的 SUPABASE_SERVICE_ROLE(gitignore,不进仓库、不到前端)。
import * as SECRETS from "./_secrets.mjs";
import { deleteAccount } from "./_delete-account-core.mjs";

const SUPABASE_URL = "https://byjwwrhsafsuzgiydiuy.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5and3cmhzYWZzdXpnaXlkaXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTAxMjUsImV4cCI6MjEwMzg2NjEyNX0.3HIGb2oNNZR5O9J3hXmNr52ceBL4IQq4WTcHr-5IvNI";

const inner = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const r = await deleteAccount({ token, supabaseUrl: SUPABASE_URL, anon: ANON, service: process.env.SUPABASE_SERVICE_ROLE || SECRETS.SUPABASE_SERVICE_ROLE });
  return { statusCode: r.status, headers: { "content-type": "application/json" }, body: JSON.stringify(r.body) };
};
export const handler = withCors(inner);
