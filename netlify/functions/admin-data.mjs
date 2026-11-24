import { withCors } from "./_cors.mjs";
// 管理员数据分析:用 Supabase service_role 密钥(仅服务端)聚合所有用户 + 练习数据。
// 口令校验通过才返回。需在 Netlify 配置:ADMIN_PASSWORD、SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY。
import { createClient } from "@supabase/supabase-js";

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(obj),
});
const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

const inner = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const pw = process.env.ADMIN_PASSWORD;
  // URL 非机密(前端已公开),内置默认值,可不在 Netlify 配置
  const url = process.env.SUPABASE_URL || "https://oahajzzwgxawcwvtxnze.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pw || !key) return json(500, { error: "服务端未配置 ADMIN_PASSWORD 或 SUPABASE_SERVICE_ROLE_KEY(请在 Netlify 环境变量里添加这两个)。" });

  let body; try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "请求体解析失败" }); }
  if ((body.password || "") !== pw) return json(401, { error: "口令错误" });

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // 1) 所有注册用户(分页)
  const users = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return json(502, { error: "读取用户失败", detail: error.message });
    const list = data?.users || [];
    users.push(...list);
    if (list.length < 200) break;
  }

  // 2) 昵称
  const { data: profs } = await sb.from("profiles").select("*").limit(20000);
  const nickBy = new Map();
  for (const p of profs || []) nickBy.set(p.user_id || p.id, p.nickname);

  // 3) 练习记录聚合(正确率/活跃/天数/分项)
  const { data: attempts } = await sb.from("practice_attempts")
    .select("user_id,game,correct,created_at").order("created_at", { ascending: false }).limit(100000);
  // 4) 最高难度 D
  const { data: scores } = await sb.from("scores").select("user_id,meta").limit(50000);

  const stat = new Map();
  const now = Date.now();
  const todayK = dayKey(new Date(now).toISOString());
  const activeToday = new Set(), active7 = new Set();
  for (const a of attempts || []) {
    let s = stat.get(a.user_id);
    if (!s) { s = { total: 0, correct: 0, days: new Set(), last: null, byGame: {} }; stat.set(a.user_id, s); }
    s.total++; if (a.correct) s.correct++;
    s.days.add(dayKey(a.created_at));
    if (!s.last || a.created_at > s.last) s.last = a.created_at;
    s.byGame[a.game] = (s.byGame[a.game] || 0) + 1;
    if (dayKey(a.created_at) === todayK) activeToday.add(a.user_id);
    if (now - new Date(a.created_at).getTime() <= 7 * 864e5) active7.add(a.user_id);
  }
  const maxD = new Map();
  for (const sc of scores || []) { const d = Number(sc.meta?.D) || 0; if (d > (maxD.get(sc.user_id) || 0)) maxD.set(sc.user_id, d); }

  const rows = users.map((u) => {
    const s = stat.get(u.id) || { total: 0, correct: 0, days: new Set(), last: null, byGame: {} };
    return {
      email: u.email || "(无邮箱)",
      nickname: nickBy.get(u.id) || "",
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at || null,
      attempts: s.total,
      correct: s.correct,
      accuracy: s.total ? Math.round((s.correct / s.total) * 100) : null,
      activeDays: s.days.size,
      lastActive: s.last,
      byGame: s.byGame,
      maxD: maxD.get(u.id) || 0,
    };
  }).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const totalAttempts = rows.reduce((x, r) => x + r.attempts, 0);
  const totalCorrect = rows.reduce((x, r) => x + r.correct, 0);
  return json(200, {
    totals: {
      users: rows.length,
      attempts: totalAttempts,
      accuracy: totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : null,
      activeToday: activeToday.size,
      active7: active7.size,
    },
    users: rows,
    generatedAt: new Date(now).toISOString(),
  });
};

export const handler = withCors(inner);
