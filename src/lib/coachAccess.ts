// 教练权限(2026-10-12):管理员在 /admin 指定哪些账号能看到/使用教练端;没指定的账号前端完全看不到入口。
// 零迁移:授权落 scores 表 game='coach' mode='grant'|'revoke' user_id=管理员 meta{coachId,label}。
// 防伪造:任何人都能往 scores 写自己 user_id 的行,所以读取时用数据库函数 has_role(写入者,'admin')(匿名可调)
// 核验写入者是管理员,非管理员写的授权一律无效。管理员自己天然是教练。
import { supabase } from "@/integrations/supabase/client";

export const BASE_SEATS = 10; // 每位教练默认可建的学生账号数;超出由管理员(付费后)追加
export const QUOTA_ENFORCED = true; // 2026-10-12 用户:默认 10 个,后台可加(曾短暂关闭)
export interface CoachGrant { coachId: string; label: string; grantedAt: string; by: string; extraSeats: number }

const adminCache = new Map<string, Promise<boolean>>();
/** 某账号是否管理员(结果缓存)。 */
export function isAdmin(userId: string): Promise<boolean> {
  let p = adminCache.get(userId);
  if (!p) {
    // has_role 不在生成的类型表里(手写 SQL 函数):按 never 绕过类型,Promise.resolve 补上 catch
    p = Promise.resolve(supabase.rpc("has_role" as never, { _user_id: userId, _role: "admin" } as never)).then((r: { data?: unknown }) => r.data === true).catch(() => false);
    adminCache.set(userId, p);
  }
  return p;
}

type Row = { user_id: string; mode: string; created_at: string; meta: { coachId?: string; label?: string; seats?: number } | null };

/** 把授权/撤销记录归纳成当前有效教练(纯函数,便于测试):只认管理员写的,同一账号取最后一条。 */
export function reduceGrants(rows: Row[], adminIds: Set<string>): CoachGrant[] {
  const state = new Map<string, CoachGrant | null>();
  const seats = new Map<string, number>(); // mode='quota':追加席位(最新一条为准)
  for (const r of rows) {
    if (!adminIds.has(r.user_id)) continue;
    const id = String(r.meta?.coachId ?? "");
    if (!id) continue;
    if (r.mode === "quota") { seats.set(id, Math.max(0, Math.round(Number(r.meta?.seats) || 0))); continue; }
    state.set(id, r.mode === "grant" ? { coachId: id, label: String(r.meta?.label ?? ""), grantedAt: r.created_at, by: r.user_id, extraSeats: 0 } : null);
  }
  return [...state.values()].filter((g): g is CoachGrant => !!g).map((g) => ({ ...g, extraSeats: seats.get(g.coachId) ?? 0 }));
}

async function adminsAmong(rows: Row[]): Promise<Set<string>> {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const flags = await Promise.all(ids.map((id) => isAdmin(id)));
  return new Set(ids.filter((_, i) => flags[i]));
}

/** 当前全部有效教练(管理后台列表用)。 */
export async function listCoaches(): Promise<CoachGrant[]> {
  const { data } = await supabase.from("scores").select("user_id,mode,created_at,meta").eq("game", "coach").order("created_at", { ascending: true }).limit(2000);
  const rows = (data ?? []) as Row[];
  return reduceGrants(rows, await adminsAmong(rows));
}

/** 某账号是否教练:管理员天然是;否则看有效授权。 */
export async function isCoach(userId: string): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  const { data } = await supabase.from("scores").select("user_id,mode,created_at,meta").eq("game", "coach").eq("meta->>coachId", userId).order("created_at", { ascending: true }).limit(200);
  const rows = (data ?? []) as Row[];
  return reduceGrants(rows, await adminsAmong(rows)).length > 0;
}

export async function grantCoach(coachId: string, label: string): Promise<{ ok: boolean; error?: string }> {
  const me = (await supabase.auth.getSession()).data.session?.user.id;
  if (!me) return { ok: false, error: "请先登录" };
  const { error } = await supabase.from("scores").insert({ user_id: me, game: "coach", mode: "grant", value: 1, meta: { coachId, label } as never });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function revokeCoach(coachId: string, label: string): Promise<{ ok: boolean; error?: string }> {
  const me = (await supabase.auth.getSession()).data.session?.user.id;
  if (!me) return { ok: false, error: "请先登录" };
  const { error } = await supabase.from("scores").insert({ user_id: me, game: "coach", mode: "revoke", value: 0, meta: { coachId, label } as never });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** 管理员设置某教练的追加席位(付费后手动加;总配额 = BASE_SEATS + extra)。 */
export async function setCoachSeats(coachId: string, extra: number, label: string): Promise<{ ok: boolean; error?: string }> {
  const me = (await supabase.auth.getSession()).data.session?.user.id;
  if (!me) return { ok: false, error: "请先登录" };
  const seats = Math.max(0, Math.round(extra));
  const { error } = await supabase.from("scores").insert({ user_id: me, game: "coach", mode: "quota", value: seats, meta: { coachId, seats, label } as never });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** 我的账号配额:管理员不限;教练 = 默认 10 + 管理员追加。 */
export async function getMySeats(userId: string): Promise<number> {
  if (!QUOTA_ENFORCED) return 9999;
  if (await isAdmin(userId)) return 9999;
  const { data } = await supabase.from("scores").select("user_id,mode,created_at,meta").eq("game", "coach").eq("meta->>coachId", userId).order("created_at", { ascending: true }).limit(200);
  const rows = (data ?? []) as Row[];
  const g = reduceGrants(rows, await adminsAmong(rows))[0];
  return BASE_SEATS + (g?.extraSeats ?? 0);
}
