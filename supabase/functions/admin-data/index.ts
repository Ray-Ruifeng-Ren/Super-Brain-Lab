import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Validate JWT from the caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing authorization" }, 401);

    const authClient = createClient(url, anonKey);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
    const userId = userData.user.id;

    // 2. Admin client (bypasses RLS)
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Authorize: must have the 'admin' role
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // 4. Read the requested slice of data
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = typeof body?.action === "string" ? body.action : "overview";

    if (action === "overview") {
      const [{ count: users }, { count: attempts }, { count: correct }] = await Promise.all([
        admin.from("profiles").select("*", { count: "exact", head: true }),
        admin.from("practice_attempts").select("*", { count: "exact", head: true }),
        admin
          .from("practice_attempts")
          .select("*", { count: "exact", head: true })
          .eq("correct", true),
      ]);

      return json({
        users: users ?? 0,
        attempts: attempts ?? 0,
        correct: correct ?? 0,
      });
    }

    if (action === "users") {
      const limit = Math.min(Number(body?.limit) || 100, 500);
      const offset = Math.max(Number(body?.offset) || 0, 0);

      const { data: profiles, error } = await admin
        .from("profiles")
        .select("id, nickname, created_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return json({ error: error.message }, 500);

      const ids = (profiles ?? []).map((p) => p.id);
      const { data: rows } = await admin
        .from("practice_attempts")
        .select("user_id, correct, created_at")
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

      const agg = new Map<string, { total: number; correct: number; last: string | null }>();
      for (const r of rows ?? []) {
        const a = agg.get(r.user_id) ?? { total: 0, correct: 0, last: null };
        a.total += 1;
        if (r.correct) a.correct += 1;
        if (!a.last || r.created_at > a.last) a.last = r.created_at;
        agg.set(r.user_id, a);
      }

      // emails from auth
      const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const emails = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? ""]));

      return json({
        users: (profiles ?? []).map((p) => ({
          id: p.id,
          nickname: p.nickname,
          email: emails.get(p.id) ?? "",
          created_at: p.created_at,
          total: agg.get(p.id)?.total ?? 0,
          correct: agg.get(p.id)?.correct ?? 0,
          last_active: agg.get(p.id)?.last ?? null,
        })),
      });
    }

    if (action === "attempts") {
      const limit = Math.min(Number(body?.limit) || 100, 500);
      const targetUser = typeof body?.user_id === "string" ? body.user_id : null;
      let q = admin
        .from("practice_attempts")
        .select("id, user_id, game, mode, terms, signs, answer, user_answer, correct, used_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (targetUser) q = q.eq("user_id", targetUser);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ attempts: data ?? [] });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
