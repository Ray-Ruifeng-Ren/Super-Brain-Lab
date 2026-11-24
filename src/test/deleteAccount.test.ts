// 注销账号云函数(2026-11-08 上架必需):只删令牌本人的数据,顺序 = 训练记录 → 成绩 → 角色 → 资料 → 账号;身份不对 / 删除失败都不往下删
import { describe, it, expect } from "vitest";
import { deleteAccount } from "../../netlify/functions/_delete-account-core.mjs";

const UID = "11111111-2222-3333-4444-555555555555";
function fakeFetch(opts: { user?: object | null; fail?: string } = {}) {
  const calls: string[] = [];
  const f = async (url: string, init?: { method?: string }) => {
    calls.push(`${init?.method ?? "GET"} ${url.replace("https://x.supabase.co", "")}`);
    if (url.endsWith("/auth/v1/user")) return { ok: !!opts.user, json: async () => opts.user } as Response;
    if (opts.fail && url.includes(opts.fail)) return { ok: false, status: 500 } as Response;
    return { ok: true, status: 204 } as Response;
  };
  return { f, calls };
}
const base = { token: "tok", supabaseUrl: "https://x.supabase.co", anon: "a", service: "s" };

describe("注销账号", () => {
  it("令牌本人:依次删 4 张表再删账号", async () => {
    const { f, calls } = fakeFetch({ user: { id: UID } });
    const r = await deleteAccount({ ...base, fetch: f as typeof fetch });
    expect(r.status).toBe(200);
    expect(calls).toEqual([
      "GET /auth/v1/user",
      `DELETE /rest/v1/practice_attempts?user_id=eq.${UID}`,
      `DELETE /rest/v1/scores?user_id=eq.${UID}`,
      `DELETE /rest/v1/user_roles?user_id=eq.${UID}`,
      `DELETE /rest/v1/profiles?id=eq.${UID}`,
      `DELETE /auth/v1/admin/users/${UID}`,
    ]);
  });
  it("没登录 / 令牌无效:什么都不删", async () => {
    const { f, calls } = fakeFetch({ user: null });
    expect((await deleteAccount({ ...base, fetch: f as typeof fetch })).status).toBe(401);
    expect(calls).toEqual(["GET /auth/v1/user"]);
    expect((await deleteAccount({ ...base, token: "", fetch: f as typeof fetch })).status).toBe(401);
  });
  it("中途失败:停下,不删账号", async () => {
    const { f, calls } = fakeFetch({ user: { id: UID }, fail: "/scores" });
    expect((await deleteAccount({ ...base, fetch: f as typeof fetch })).status).toBe(502);
    expect(calls.some((c) => c.includes("/auth/v1/admin/users"))).toBe(false);
  });
});
