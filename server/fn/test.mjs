// 本机自测(不连任何线上服务):node prepare.mjs && node test.mjs
//  1. blobs 适配层:读写 / json / 二进制 / list 前缀 / 删除 / 重启后数据还在
//  2. 比赛核心逻辑跑在 blobs 适配层上:建赛 → 报名 → 切场次 → 统一开始 → 作答 → 排名 → 结束 → 迟到补交
//  3. HTTP 运行器:函数都能加载,/.netlify/functions 与 /functions/v1 两种路径都通,CORS 预检正常
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "zx-fn-"));
process.env.BLOBS_DIR = TMP;
const ok = (m) => console.log("  ✓ " + m);

// ---------- 1. blobs ----------
console.log("1. blobs 适配层");
{
  const { getStore } = await import("./blobs.mjs");
  const s = getStore({ name: "t1", consistency: "strong" });
  await s.setJSON("c/a/meta", { x: 1 });
  await s.setJSON("c/a/reg/138", { n: "张三" });
  await s.setJSON("c/a/reg/139", { n: "李四" });
  await s.setJSON("c/b/meta", { x: 2 });
  assert.deepEqual(await s.get("c/a/meta", { type: "json" }), { x: 1 });
  assert.equal(await s.get("nope", { type: "json" }), null);
  assert.deepEqual((await s.list({ prefix: "c/a/reg/" })).blobs.map((b) => b.key), ["c/a/reg/138", "c/a/reg/139"]);
  ok("json 读写、前缀 list(c/a 与 c/a/meta 不冲突)");
  const bin = Buffer.from([0, 1, 2, 250, 255]);
  await s.set("audio/x", bin);
  assert.deepEqual(Buffer.from(await s.get("audio/x", { type: "arrayBuffer" })), bin);
  ok("二进制读写(语音缓存用)");
  await s.delete("c/b/meta");
  assert.equal((await s.list({ prefix: "c/b" })).blobs.length, 0);
  ok("删除");
  const fresh = (await import("./blobs.mjs?again")).getStore("t1"); // 模拟进程重启:重新扫描磁盘
  assert.equal((await fresh.list({ prefix: "c/a/" })).blobs.length, 3);
  ok("重启后从磁盘恢复索引");
}

// ---------- 2. 比赛核心 ----------
console.log("2. 比赛核心逻辑(跑在 blobs 适配层上)");
{
  const { getStore } = await import("./blobs.mjs");
  const { makeCore, orderFor } = await import("./functions/_contest-core.mjs");
  const s = getStore({ name: "contest", consistency: "strong" });
  const core = makeCore({
    get: (k) => s.get(k, { type: "json" }).catch(() => null),
    set: (k, v) => s.setJSON(k, v),
    list: async (p) => (await s.list({ prefix: p })).blobs.map((b) => b.key),
  });
  const org = { id: "org-1", admin: false };
  const item = { project: "flash", n: 20, digits: 1, count: 3, speedMs: 800 };
  const { contest } = await core("createContest", { title: "迁移自测赛", groups: [{ name: "A组" }], events: [{ project: "flash", name: "闪算" }], cfg: [{ item, minutes: 5 }] }, org);
  const cid = contest.id, G = contest.groups[0].id, E = contest.events[0].id;
  ok(`建赛 ${cid}(组别 ${G}、项目 ${E})`);

  // 两个校验位正确的身份证号
  const W = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2], C = "10X98765432";
  const ids = ["11010520100307001", "11010520100307002"].map((b) => b + C[W.reduce((a, w, i) => a + w * Number(b[i]), 0) % 11]);
  const jpg = "data:image/jpeg;base64," + Buffer.from("fake-jpeg").toString("base64");
  const phones = ["13800000001", "13800000002"], regs = [];
  for (const [i, phone] of phones.entries()) regs.push(await core("register", { cid, name: ["王小明", "李小红"][i], idNo: ids[i], phone, group: G, events: [E], photo: jpg, thumb: jpg }, null));
  assert.ok(regs.every((r) => r.examNo && r.password));
  ok("报名 2 人,考号 " + regs.map((r) => r.examNo).join("、"));
  await assert.rejects(core("register", { cid, name: "重复", idNo: ids[0], phone: "13800000009", group: G, events: [E], photo: jpg, thumb: jpg }, null), /身份证号已经报过名/);
  ok("同一身份证号不能重复报名");

  const logins = [];
  for (const [i, phone] of phones.entries()) logins.push(await core("login", { cid, phone, password: regs[i].password }, null));
  assert.ok(logins.every((l) => l.token));
  ok("考生登录");

  await core("setSession", { cid, group: G, event: E }, org);
  const problems = Array.from({ length: 20 }, (_, i) => ({ terms: [1, 2, 3 + (i % 3)], signs: ["+", "+", "+"], answer: 6 + (i % 3), seg: 0 }));
  const { state } = await core("start", { cid, problems, countdown: 3 }, org);
  await new Promise((r) => setTimeout(r, state.startAt - Date.now() + 100));
  ok("切场次 + 统一开始(倒计时 3 秒)");

  const st = await core("state", { cid, token: logins[0].token, withProblems: true }, null);
  assert.equal(st.problems?.length, 20);
  assert.ok(st.problems.every((p) => p.answer === undefined), "下发的题不能带答案");
  ok("考生拿到 20 题,不含答案");

  const order = orderFor(problems, state.sid, regs[0].examNo);
  for (let k = 0; k < 5; k++) {
    const orig = problems[order[k]];
    await core("answer", { token: logins[0].token, sid: state.sid, idx: k, value: String(k < 4 ? orig.answer : orig.answer + 1), at: Date.now() }, null);
  }
  const again = await core("answer", { token: logins[0].token, sid: state.sid, idx: 0, value: "999", at: Date.now() }, null);
  assert.equal(again.answered, 5, "同一题重复提交只算第一次");
  const scr = await core("screen", { cid }, null);
  const row = scr.ranking.rows.find((x) => x.examNo === regs[0].examNo);
  assert.equal(row.answered, 5); assert.equal(row.correct, 4); assert.equal(row.rank, 1);
  ok("作答 5 题对 4 题,重复提交不重复计分,大屏第 1 名");

  const { state: ended } = await core("end", { cid }, org);
  const lateOrig = problems[order[5]];
  const late = await core("answer", { token: logins[0].token, sid: state.sid, idx: 5, value: String(lateOrig.answer), at: ended.endAt }, null);
  assert.equal(late.correct, 5);
  ok("结束后 60 秒内,结束前交卷的答案补交成功");
  const res = await core("results", { cid }, org);
  assert.equal(res.sessions[0].rows[0].examNo, regs[0].examNo);
  ok("成绩导出");
}

// ---------- 3. HTTP 运行器 ----------
console.log("3. HTTP 运行器");
{
  const PORT = 18000 + Math.floor(Math.random() * 1000);
  const p = spawn(process.execPath, [path.join(HERE, "server.mjs")], { env: { ...process.env, PORT: String(PORT), BLOBS_DIR: TMP }, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; p.stdout.on("data", (d) => (log += d)); p.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 50 && !log.includes("监听"); i++) await new Promise((r) => setTimeout(r, 100));
  try {
    assert.match(log, /已加载 \d+ 个函数/);
    for (const f of ["contest", "tts", "delete-account", "reset-password", "ticket", "transcribe", "admin-data"]) assert.ok(log.includes(f), `应加载函数 ${f}`);
    ok(log.match(/已加载[^\n]+/)[0]);
    const base = `http://127.0.0.1:${PORT}`;
    const r1 = await fetch(`${base}/.netlify/functions/contest`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "contestInfo", cid: "nope" }) });
    assert.equal(r1.status, 404); assert.match((await r1.json()).error, /比赛不存在/);
    assert.equal(r1.headers.get("access-control-allow-origin"), "*");
    ok("/.netlify/functions/contest 正常返回(不存在的比赛 → 404)");
    const r2 = await fetch(`${base}/functions/v1/contest`, { method: "OPTIONS" });
    assert.equal(r2.status, 204);
    ok("/functions/v1 路径 + CORS 预检");
    const r3 = await fetch(`${base}/.netlify/functions/nope`, { method: "POST" });
    assert.equal(r3.status, 404);
    ok("未知函数 → 404");
  } finally { p.kill(); }
}
// ---------- 4. admin-data(用模拟的 Supabase 接口) ----------
console.log("4. 管理后台 admin-data");
{
  const http = await import("node:http");
  const ADMIN = "tok-admin", USER = "tok-user";
  const users = Array.from({ length: 3 }, (_, i) => ({ id: "u" + i, email: `u${i}@x.com`, created_at: `2026-0${i + 1}-01T00:00:00Z` }));
  const atts = [{ user_id: "u0", correct: true, created_at: "2026-05-01" }, { user_id: "u0", correct: false, created_at: "2026-05-02" }, { user_id: "u2", correct: true, created_at: "2026-06-01" }];
  const mock = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x"), auth = req.headers.authorization || "";
    const send = (o, h = {}) => { res.writeHead(200, { "content-type": "application/json", ...h }); res.end(JSON.stringify(o)); };
    if (u.pathname === "/auth/v1/user") { if (auth === `Bearer ${ADMIN}`) return send({ id: "u0" }); if (auth === `Bearer ${USER}`) return send({ id: "u1" }); res.writeHead(401); return res.end(); }
    if (auth !== "Bearer svc") { res.writeHead(401); return res.end(); }
    if (u.pathname === "/rest/v1/user_roles") return send(u.searchParams.get("user_id") === "eq.u0" ? [{ role: "admin" }] : []);
    if (u.pathname === "/auth/v1/admin/users") return send({ users });
    const t = u.pathname.split("/").pop();
    if (req.headers.prefer === "count=exact") { const n = t === "profiles" ? 3 : u.searchParams.get("correct") ? 2 : 3; return send([], { "content-range": `0-0/${n}` }); }
    if (t === "profiles") return send(users.map((x, i) => ({ id: x.id, nickname: "昵称" + i })));
    if (t === "practice_attempts") return send(atts);
    send([]);
  }).listen(0);
  const mport = mock.address().port;
  Object.assign(process.env, { SUPABASE_INTERNAL_URL: `http://127.0.0.1:${mport}`, SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE: "svc" });
  const { handler } = await import("./functions/admin-data.mjs");
  const call = (tok, body) => handler({ httpMethod: "POST", headers: { authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }).then((r) => ({ status: r.statusCode, data: JSON.parse(r.body) }));
  assert.equal((await call(USER, { action: "overview" })).status, 403);
  assert.equal((await call("anon", { action: "overview" })).status, 403);
  ok("非管理员、未登录都被拒绝(403)");
  const ov = await call(ADMIN, { action: "overview" });
  assert.deepEqual(ov.data, { users: 3, attempts: 3, correct: 2 });
  ok("overview:3 个用户、3 次答题、2 次答对");
  const us = (await call(ADMIN, { action: "users", limit: 1000 })).data.users;
  assert.equal(us.length, 3); assert.equal(us[0].id, "u2");
  const u0 = us.find((x) => x.id === "u0");
  assert.deepEqual([u0.total, u0.correct, u0.nickname, u0.last_active], [2, 1, "昵称0", "2026-05-02"]);
  ok("users:按注册时间倒序,每人答题数、正确数、昵称、最近活跃都对");
  mock.close();
}

// ---------- 5. 账单 ledger(模拟 Supabase 鉴权) ----------
console.log("5. 账单 ledger");
{
  const http = await import("node:http");
  const mock = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x"), auth = req.headers.authorization || "";
    const send = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (u.pathname === "/auth/v1/user") { if (auth === "Bearer tok-admin") return send({ id: "u0", email: "boss@x.com" }); if (auth === "Bearer tok-user") return send({ id: "u1" }); res.writeHead(401); return res.end(); }
    if (u.pathname === "/rest/v1/user_roles") return send(u.searchParams.get("user_id") === "eq.u0" ? [{ role: "admin" }] : []);
    send([]);
  }).listen(0);
  Object.assign(process.env, { SUPABASE_INTERNAL_URL: `http://127.0.0.1:${mock.address().port}`, SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE: "svc" });
  const { handler } = await import("./functions/ledger.mjs");
  const call = (tok, body) => handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ authToken: tok, ...body }) }).then((r) => ({ status: r.statusCode, data: JSON.parse(r.body) }));
  assert.equal((await call("tok-user", { action: "list" })).status, 403);
  assert.equal((await call(undefined, { action: "list" })).status, 403);
  ok("非管理员、未登录都被拒绝");
  const a = (await call("tok-admin", { action: "save", entry: { date: "2026-11-10", kind: "in", item: "注资", category: "注资", amount: 5000 } })).data.entry;
  const b = (await call("tok-admin", { action: "save", entry: { date: "2026-11-10", kind: "out", item: "软件著作权登记", category: "资质与认证", amount: "500" } })).data.entry;
  const c = (await call("tok-admin", { action: "save", entry: { date: "2026-11-11", kind: "out", item: "火山引擎语音合成", amount: "" } })).data.entry;
  assert.equal(c.amount, null); assert.equal(b.amount, 500); assert.equal(b.by, "boss@x.com");
  assert.equal((await call("tok-admin", { action: "save", entry: { date: "11/10", item: "x", amount: 1 } })).status, 400);
  assert.equal((await call("tok-admin", { action: "save", entry: { date: "2026-11-10", item: "x", amount: -5 } })).status, 400);
  ok("记账:注资、支出、金额待确认;日期和负数金额会被拒绝");
  await call("tok-admin", { action: "save", entry: { ...b, amount: 520, note: "含加急" } });
  let list = (await call("tok-admin", { action: "list" })).data.entries;
  assert.equal(list.length, 3); assert.equal(list[0].id, c.id); assert.equal(list.find((x) => x.id === b.id).amount, 520);
  assert.equal(list.find((x) => x.id === b.id).createdAt, b.createdAt);
  ok("修改金额和备注,列表按日期倒序");
  await call("tok-admin", { action: "remove", id: a.id });
  list = (await call("tok-admin", { action: "list" })).data.entries;
  assert.deepEqual(list.map((x) => x.id).sort(), [b.id, c.id].sort());
  ok("删除");
  mock.close();
}

// ---------- 6. 用户反馈 feedback(管理员 + 脚本密钥两种认证) ----------
console.log("6. 用户反馈 feedback");
{
  const http = await import("node:http");
  const mock = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x"), auth = req.headers.authorization || "";
    const send = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (u.pathname === "/auth/v1/user") { if (auth === "Bearer tok-admin") return send({ id: "u0", email: "boss@x.com" }); if (auth === "Bearer tok-user") return send({ id: "u1" }); res.writeHead(401); return res.end(); }
    if (u.pathname === "/rest/v1/user_roles") return send(u.searchParams.get("user_id") === "eq.u0" ? [{ role: "admin" }] : []);
    send([]);
  }).listen(0);
  Object.assign(process.env, { SUPABASE_INTERNAL_URL: `http://127.0.0.1:${mock.address().port}`, SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE: "svc", FEEDBACK_CLI_KEY: "cli-key-test" });
  const { handler } = await import("./functions/feedback.mjs");
  const call = (auth, body) => handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ ...auth, ...body }) }).then((r) => ({ status: r.statusCode, data: JSON.parse(r.body) }));
  const admin = { authToken: "tok-admin" }, cli = { cliKey: "cli-key-test" };
  assert.equal((await call({ authToken: "tok-user" }, { action: "list" })).status, 403);
  assert.equal((await call({ cliKey: "wrong-key-xx" }, { action: "list" })).status, 403);
  assert.equal((await call({}, { action: "list" })).status, 403);
  ok("非管理员、错密钥、未登录都被拒绝");
  const png = "data:image/png;base64," + Buffer.from("fake-png").toString("base64");
  const a = (await call(admin, { action: "save", item: { title: "英文讲解里数字还是中文", detail: "付海东反馈", kind: "bug", area: "教练", side: "both", priority: "high", from: "付海东", image: png } })).data.item;
  const b = (await call(admin, { action: "save", item: { title: "出题加分数字", kind: "feature", area: "出题", priority: "mid" } })).data.item;
  const c = (await call(cli, { action: "add" })).status; assert.equal(c, 400);
  assert.equal(a.hasImage, true); assert.equal(a.image, undefined); assert.equal(a.status, "open"); assert.equal(a.by, "boss@x.com");
  assert.equal((await call(admin, { action: "save", item: { title: "" } })).status, 400);
  assert.equal((await call(admin, { action: "save", item: { title: "x", image: "data:text/plain;base64,QQ==" } })).status, 400);
  ok("录入:列表不带图只给 hasImage;空标题、非图片都被拒绝");
  let list = (await call(cli, { action: "list" })).data.items;
  assert.deepEqual(list.map((x) => x.id), [a.id, b.id]);
  assert.equal((await call(cli, { action: "get", id: a.id })).data.item.image, png);
  ok("脚本密钥能读列表(高优先级在前)和带图详情");
  const d = (await call(cli, { action: "save", item: { id: a.id, status: "doing" } })).data.item;
  assert.equal(d.status, "doing"); assert.equal(d.title, a.title); assert.equal(d.hasImage, true); assert.equal(d.handledBy, "dev-cli");
  const e = (await call(cli, { action: "save", item: { id: a.id, status: "done", result: "enSpeech 把数字转成英文单词,已发布" } })).data.item;
  assert.equal(e.status, "done"); assert.ok(e.doneAt); assert.equal(e.by, "boss@x.com");
  list = (await call(admin, { action: "list" })).data.items;
  assert.deepEqual(list.map((x) => x.status), ["open", "done"]);
  assert.equal((await call(admin, { action: "list", status: "done" })).data.items.length, 1);
  ok("领取 → 完成回写:没传的字段沿用旧值,已完成排最后,按状态筛选");
  await call(admin, { action: "remove", id: b.id });
  assert.deepEqual((await call(admin, { action: "list" })).data.items.map((x) => x.id), [a.id]);
  ok("删除");
  mock.close();
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log("\n全部通过");
