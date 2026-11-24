// 注销账号核心(2026-11-08 上架必需):用调用者自己的登录令牌确认身份 → service_role 删除该账号在各表的数据 → 删除 auth 用户。
// 只删「令牌对应的那个人」,不接受任何别的 id;fetch 注入便于测试。
export async function deleteAccount({ token, supabaseUrl, anon, service, fetch: f = fetch }) {
  if (!token) return { status: 401, body: { error: "请先登录" } };
  if (!service) return { status: 503, body: { error: "服务端尚未配置,暂不能注销" } };
  const me = await f(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!me?.id || !/^[0-9a-f-]{36}$/i.test(me.id)) return { status: 401, body: { error: "登录已过期,请重新登录后再注销" } };
  const H = { apikey: service, Authorization: `Bearer ${service}`, Prefer: "return=minimal" };
  // 先删业务数据(训练记录、成绩 / 作业 / 班级、角色、资料),再删账号本身
  for (const [table, col] of [["practice_attempts", "user_id"], ["scores", "user_id"], ["user_roles", "user_id"], ["profiles", "id"]]) {
    const r = await f(`${supabaseUrl}/rest/v1/${table}?${col}=eq.${me.id}`, { method: "DELETE", headers: H }).catch(() => null);
    if (!r || (!r.ok && r.status !== 404)) return { status: 502, body: { error: `删除数据失败(${table}),请稍后再试` } };
  }
  const del = await f(`${supabaseUrl}/auth/v1/admin/users/${me.id}`, { method: "DELETE", headers: { apikey: service, Authorization: `Bearer ${service}` } }).catch(() => null);
  if (!del || !del.ok) return { status: 502, body: { error: "删除账号失败,请稍后再试" } };
  return { status: 200, body: { ok: true } };
}
