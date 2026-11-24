import { withCors } from "./_cors.mjs";
// 准考证号(考试码)服务 —— 2026-09-19 付费开考流程:
// 用户点开考 → 弹窗扫码加助手微信私转(级位 29.9 / 段位 39.9)→ 教练在 /admin 生成 20 位准考证号发给用户
// → 用户在弹窗输入 → 本函数核销 → 放行一场考试。一码一考,用后即焚(哪怕同一账号)。
//
// 码结构(20位, 无易混字符 I/O/0/1):KIND(1位: K=级位/D=段位) + 11位随机 + 8位 HMAC 签名。
// 签名密钥在 Netlify 环境变量 TICKET_SECRET —— 前端拿不到,码无法伪造;
// 生成需 TICKET_ADMIN_KEY(教练口令)。核销记录写 scores 表(game='ticket', 用用户自己的 JWT,受 RLS 保护;
// 公开可查已用状态,未发的码不存在于任何库,无泄露面)。
import crypto from "node:crypto";
import * as SECRETS from "./_secrets.mjs";

const SUPABASE_URL = "https://byjwwrhsafsuzgiydiuy.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5and3cmhzYWZzdXpnaXlkaXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTAxMjUsImV4cCI6MjEwMzg2NjEyNX0.3HIGb2oNNZR5O9J3hXmNr52ceBL4IQq4WTcHr-5IvNI";

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 字符,无 I O 0 1
const SIG_LEN = 8;
const RAND_LEN = 11; // 1 + 11 + 8 = 20 位

const fromBytes = (buf, n) => { let out = ""; for (let i = 0; i < n; i++) out += ALPHA[buf[i] % 32]; return out; };
const sign = (payload, secret) => fromBytes(crypto.createHmac("sha256", secret).update(payload).digest(), SIG_LEN);
const normalize = (raw) => String(raw || "").toUpperCase().replace(/[^A-Z2-9]/g, "");

const json = (statusCode, body) => ({ statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const inner = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const secret = process.env.TICKET_SECRET || SECRETS.TICKET_SECRET;
  const adminKey = process.env.TICKET_ADMIN_KEY || SECRETS.TICKET_ADMIN_KEY;
  if (!secret || !adminKey) return json(500, { error: "服务端未配置 TICKET_SECRET / TICKET_ADMIN_KEY" });

  let body; try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad json" }); }


  // ===== 生成(教练专用):管理员登录态即可(服务端查 user_roles);口令仅作 curl 后备 =====
  if (body.action === "issue") {
    let allowed = body.adminKey === adminKey
      || (typeof body.gatePw === "string" && body.gatePw.length > 0 && body.gatePw === SECRETS.ADMIN_GATE_PW);
    if (!allowed && body.authToken) {
      try {
        const uid = JSON.parse(Buffer.from(String(body.authToken).split(".")[1], "base64").toString()).sub;
        const rq = await fetch(`${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${uid}&role=eq.admin&limit=1`, {
          headers: { apikey: ANON, Authorization: `Bearer ${body.authToken}` },
        });
        const rr = await rq.json().catch(() => []);
        allowed = Array.isArray(rr) && rr.length > 0;
      } catch { /* allowed 保持 false */ }
    }
    if (!allowed) return json(403, { error: "需要管理员账号登录(或口令不对)" });
    const kind = body.kind === "D" ? "D" : "K";
    const count = Math.min(50, Math.max(1, Math.round(Number(body.count) || 1)));
    const codes = [];
    for (let i = 0; i < count; i++) {
      const payload = kind + fromBytes(crypto.randomBytes(RAND_LEN), RAND_LEN);
      codes.push(payload + sign(payload, secret));
    }
    return json(200, { codes });
  }

  // ===== 核销(考生开考) =====
  if (body.action === "redeem") {
    const code = normalize(body.code);
    if (code.length !== 1 + RAND_LEN + SIG_LEN) return json(400, { error: "准考证号应为 20 位,请检查是否抄全" });
    const payload = code.slice(0, 1 + RAND_LEN);
    if (sign(payload, secret) !== code.slice(1 + RAND_LEN)) return json(400, { error: "准考证号无效,请核对后重试" });
    const kind = code[0]; // K=级位 D=段位
    const wantKind = body.levelKind === "dan" ? "D" : "K";
    if (kind !== wantKind)
      return json(400, { error: kind === "K" ? "这是「级位」准考证号,不能用于段位考试" : "这是「段位」准考证号,不能用于级位考试" });
    const token = String(body.authToken || "");
    if (!token) return json(401, { error: "请先登录" });
    // 已用查询(核销记录公开可读)
    const q = await fetch(`${SUPABASE_URL}/rest/v1/scores?game=eq.ticket&select=id&meta->>code=eq.${code}&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    const rows = await q.json().catch(() => []);
    if (Array.isArray(rows) && rows.length > 0) return json(409, { error: "这个准考证号已经用过了(一码只能考一次),请联系助手获取新号" });
    // 核销:以用户身份落一条记录(RLS: 只能写自己的 user_id)
    let uid = "";
    try { uid = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()).sub || ""; } catch { /* noop */ }
    if (!uid) return json(401, { error: "登录态异常,请重新登录" });
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: uid, game: "ticket", mode: "used", value: 0, meta: { code, levelId: body.levelId || null } }),
    });
    if (!ins.ok) {
      const t = await ins.text().catch(() => "");
      return json(502, { error: "核销失败,请重试", detail: t.slice(0, 200) });
    }
    return json(200, { ok: true });
  }

  return json(400, { error: "unknown action" });
};

export const handler = withCors(inner);
