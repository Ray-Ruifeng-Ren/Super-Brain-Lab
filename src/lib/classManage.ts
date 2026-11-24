// 班级管理(2026-10-12):教练直接给学生建账号(姓名 + 登录名 + 密码),学生用登录名+密码登录,登录后直达作业页。
// 学生与教练的关联只能由教练建账号产生(班级码自助加入已于同日去掉:账号必须经过收费的席位配额)。
// 没有 service_role 密钥,建账号走「影子客户端」:另起一个不保存会话的 supabase client 调 signUp,
// 不会挤掉教练自己的登录态;注册返回的学生会话顺手写一条 join 记录(RLS 要求本人写),学生即在教练班级里。
// 登录名映射成内部邮箱 <登录名>@stu.superbrainlab.org(与手机号→phone.superbrainlab.org 同一思路)。
// 成员姓名等信息教练可改:落 scores game='class' mode='member' meta{studentId,name,loginName}(最新一条为准)。
// 限制:没有 service_role 就无法改别人的密码 —— 密码只能建账号时设定;忘了只能再建一个登录名。
import { siteUrl } from "@/lib/appEnv";
import { createClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";

export const STUDENT_DOMAIN = "stu.superbrainlab.org";
export const LOGIN_RE = /^[a-z0-9_]{3,20}$/;
export const normalizeLogin = (s: string) => s.trim().toLowerCase();
export const isLoginName = (s: string) => LOGIN_RE.test(normalizeLogin(s));
export const loginToEmail = (login: string) => `${normalizeLogin(login)}@${STUDENT_DOMAIN}`;

export interface MemberInfo { studentId: string; name: string; loginName: string; groupId: string; updatedAt: string; linked?: boolean; removed?: boolean }
export interface Group { id: string; name: string; createdAt: string }

export async function createStudent(input: { loginName: string; name: string; password: string; age?: number; groupId?: string }): Promise<{ ok: boolean; error?: string; studentId?: string }> {
  const me = (await supabase.auth.getSession()).data.session?.user.id;
  if (!me) return { ok: false, error: "请先登录" };
  const loginName = normalizeLogin(input.loginName);
  if (!LOGIN_RE.test(loginName)) return { ok: false, error: "登录名只能用字母、数字、下划线,3–20 位" };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "请填写学生姓名" };
  if (input.password.length < 6) return { ok: false, error: "密码至少 6 位" };
  const shadow = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "sbl-shadow" },
  });
  const birthYear = input.age && input.age >= 3 && input.age <= 99 ? new Date().getFullYear() - Math.round(input.age) : undefined;
  const { data, error } = await shadow.auth.signUp({
    email: loginToEmail(loginName), password: input.password,
    options: { data: { nickname: name, name, managed: true, coachId: me, loginName, ...(birthYear ? { birthYear } : {}) } },
  });
  if (error) {
    const m = String(error.message);
    return { ok: false, error: /already registered|already exists|user_already_exists/i.test(m) ? "这个登录名已被使用,换一个" : m };
  }
  const studentId = data.user?.id;
  if (!studentId || !data.session) return { ok: false, error: "账号已创建但未能自动入班(后台可能开启了邮箱确认),请联系管理员" };
  // 学生会话写 join(RLS:只能写自己的 user_id)
  const { error: e2 } = await shadow.from("scores").insert({ user_id: studentId, game: "class", mode: "join", value: 0, meta: { coachId: me, loginName, byCoach: true } as never });
  try { await shadow.auth.signOut({ scope: "local" }); } catch { /* noop */ }
  if (e2) return { ok: false, error: `账号已创建,但入班失败:${e2.message}` };
  // 教练侧成员信息
  await supabase.from("scores").insert({ user_id: me, game: "class", mode: "member", value: 0, meta: { studentId, name, loginName, groupId: input.groupId ?? "" } as never });
  return { ok: true, studentId };
}

/** 教练修改成员姓名 / 所属班级(追加最新一条)。 */
export async function updateMember(info: { studentId: string; name: string; loginName: string; groupId: string; linked?: boolean; removed?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const me = (await supabase.auth.getSession()).data.session?.user.id;
  if (!me) return { ok: false, error: "请先登录" };
  const { error } = await supabase.from("scores").insert({ user_id: me, game: "class", mode: "member", value: 0, meta: { studentId: info.studentId, name: info.name.trim(), loginName: info.loginName, groupId: info.groupId, linked: !!info.linked, removed: !!info.removed } as never });
  return error ? { ok: false, error: error.message } : { ok: true };
}
/** 移出班级(2026-10-14 付海东「添加错的学生无法删除」):表不可删,追加一条 removed:true 的 member 记录;学生端据此不再显示这位教练的作业。加回 = 再追加 removed:false。 */
export const removeMember = (m: MemberInfo) => updateMember({ ...m, removed: true });
export const restoreMember = (m: MemberInfo) => updateMember({ ...m, removed: false });

// ===== 班级(群组):教练把成员分到不同班,建账号时选班,布置作业可按班选人 =====
// scores game='class' mode='group' user_id=教练 meta{groupId,name}(同 groupId 最新一条为准;name 为空=已删除)
export async function getGroups(): Promise<Group[]> {
  const me = (await supabase.auth.getSession()).data.session?.user.id;
  if (!me) return [];
  const data = await fetchAllRows<{ created_at: string; meta: { groupId?: string; name?: string } | null }>((f, t) => supabase.from("scores").select("created_at,meta").eq("game", "class").eq("mode", "group").eq("user_id", me).order("created_at", { ascending: true }).order("id").range(f, t));
  const m = new Map<string, Group>();
  for (const r of data) {
    const id = String(r.meta?.groupId ?? "");
    if (!id) continue;
    const name = String(r.meta?.name ?? "");
    if (!name) m.delete(id); else m.set(id, { id, name, createdAt: m.get(id)?.createdAt ?? r.created_at });
  }
  return [...m.values()];
}

export async function saveGroup(groupId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const me = (await supabase.auth.getSession()).data.session?.user.id;
  if (!me) return { ok: false, error: "请先登录" };
  const { error } = await supabase.from("scores").insert({ user_id: me, game: "class", mode: "group", value: 0, meta: { groupId, name: name.trim() } as never });
  return error ? { ok: false, error: error.message } : { ok: true };
}
export const newGroupId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/** 教练维护的成员信息(studentId → 最新)。 */
export async function getMembers(): Promise<Map<string, MemberInfo>> {
  const me = (await supabase.auth.getSession()).data.session?.user.id;
  const out = new Map<string, MemberInfo>();
  if (!me) return out;
  const data = await fetchAllRows<{ created_at: string; meta: { studentId?: string; name?: string; loginName?: string; groupId?: string; linked?: boolean; removed?: boolean } | null }>((f, t) => supabase.from("scores").select("created_at,meta").eq("game", "class").eq("mode", "member").eq("user_id", me).order("created_at", { ascending: true }).order("id").range(f, t));
  for (const r of data) {
    const id = String(r.meta?.studentId ?? "");
    if (id) out.set(id, { studentId: id, name: String(r.meta?.name ?? ""), loginName: String(r.meta?.loginName ?? "") || out.get(id)?.loginName || "", groupId: String(r.meta?.groupId ?? ""), updatedAt: r.created_at, linked: !!r.meta?.linked || out.get(id)?.linked, removed: !!r.meta?.removed });
  }
  return out;
}

/** 重置学生密码(走 Netlify 函数,需服务端 service_role;未配置时返回明确提示)。 */
export async function resetStudentPassword(studentId: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const authToken = (await supabase.auth.getSession()).data.session?.access_token;
  if (!authToken) return { ok: false, error: "请先登录" };
  try {
    const r = await fetch(siteUrl("/.netlify/functions/reset-password"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ authToken, studentId, newPassword }) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true } : { ok: false, error: j.error || `失败(${r.status})` };
  } catch (e) { return { ok: false, error: String((e as Error).message || e) }; }
}

// ===== 添加已有账号(2026-10-13 付海东:学生自己注册过的账号没法加进班;误删后也加不回) =====
// 教练按昵称搜 profiles(公开),选中后写一条 member 记录 meta{studentId,linked:true}。学生端把「已授权教练写的 member 记录」
// 也视为入班(见 homework.getMyCoaches),所以不需要学生本人操作;关联的已有账号不占建号配额。
export async function searchProfiles(q: string): Promise<{ id: string; nickname: string }[]> {
  const needle = q.trim();
  if (needle.length < 1) return [];
  const { data } = await supabase.from("profiles").select("id,nickname").ilike("nickname", `%${needle.replace(/[%_]/g, "")}%`).limit(20);
  return ((data ?? []) as { id: string; nickname: string | null }[]).map((r) => ({ id: r.id, nickname: r.nickname || "(无昵称)" }));
}
export async function linkExistingStudent(info: { studentId: string; name: string; groupId: string }): Promise<{ ok: boolean; error?: string }> {
  const me = (await supabase.auth.getSession()).data.session?.user.id;
  if (!me) return { ok: false, error: "请先登录" };
  if (info.studentId === me) return { ok: false, error: "不能把自己加进班级" };
  const { error } = await supabase.from("scores").insert({ user_id: me, game: "class", mode: "member", value: 0, meta: { studentId: info.studentId, name: info.name.trim(), loginName: "", groupId: info.groupId, linked: true } as never });
  return error ? { ok: false, error: error.message } : { ok: true };
}
