// 比赛系统后端核心(2026-11-04,/contest):报名 → 赛前训练 → 赛场比赛(后台统一开始 / 结束)→ 出分交付。
// 与存储、鉴权解耦:contest.mjs 用 Netlify Blobs + Supabase 登录包一层;本地开发 vite 插件用内存 Map 包一层。
// 存储键:
//   c/<cid>/meta                 比赛设置(标题、组别、项目、各组各项目的出题参数、报名截止)
//   c/<cid>/reg/<phone>          报名信息(姓名、组别、项目、考号、密码哈希、身份证号、年龄、小头像)
//   c/<cid>/photo/<phone>        报名照片(JPEG dataURL,组织者核验 / 本人查看)
//   c/<cid>/no/<examNo>          考号占位(防重复)
//   c/<cid>/state                当前场次(组别 + 项目、状态、开始 / 结束时间)
//   c/<cid>/s/<sid>/problems     本场题目(开始后才发给平板)
//   c/<cid>/s/<sid>/a/<examNo>   考生作答(每人一份,只有本人写)
//   c/<cid>/s/<sid>/info         本场记录(组别、项目、开始结束时间),导出排名用
//   c/<cid>/focus                大屏直播跟谁:考号 / "auto"(自动跟第一名)
//   c/<cid>/livetarget           大屏当前直播的考号(大屏轮询时解析写入;只有这台平板上报实时状态)
//   c/<cid>/s/<sid>/live/<examNo> 被直播考生的实时状态(第几题、看题 / 作答、已输入几位、速度档、上一题对错)
//   own/<uid>/<cid>              组织者名下的比赛
//   phone/<phone>/<cid>          手机号报过哪些比赛(登录用)
//   tok/<token>                  考生登录令牌
import { createHash, randomBytes, randomInt } from "node:crypto";

// 出题、呈现全部沿用训练系统(2026-11-04 用户「出题逻辑、呈现的字体都跟原来训练系统一样,不要重新弄」):
// 每个组别 × 项目的设置就是教练布置作业用的那份 HwItem(前端 HwItemEditor 编辑),统一开始时由后台网页用 homework.genProblems 出一套题传上来,
// 这里只负责保存、按时下发(去掉答案)和判分。
const now = () => Date.now();
const sha = (s) => createHash("sha256").update(s).digest("hex");
const clean = (s, n = 40) => String(s ?? "").replace(/[<>]/g, "").trim().slice(0, n);
const err = (status, msg) => Object.assign(new Error(msg), { status });
const PROJECTS = { flash: "闪算", listen: "听算", glance: "看算", bead: "数珠互译", scroll: "心算马拉松", obstacle: "障碍算" };
// 18 位居民身份证号(GB 11643 校验码 + 出生日期合法);年龄 = 周岁(2026-11-08 用户「报名要填身份证号、照片和年龄」)
const IDW = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2], IDC = "10X98765432";
export function idValid(id) {
  const s = String(id || "").toUpperCase();
  if (!/^\d{17}[\dX]$/.test(s)) return false;
  if (IDC[IDW.reduce((a, w, i) => a + w * Number(s[i]), 0) % 11] !== s[17]) return false;
  const y = +s.slice(6, 10), m = +s.slice(10, 12), d = +s.slice(12, 14), dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && dt.getTime() <= Date.now();
}
export function ageFromId(id, at = new Date()) {
  const y = +id.slice(6, 10), m = +id.slice(10, 12), d = +id.slice(12, 14);
  return at.getFullYear() - y - (at.getMonth() + 1 < m || (at.getMonth() + 1 === m && at.getDate() < d) ? 1 : 0);
}
const isJpeg = (s, max) => typeof s === "string" && s.startsWith("data:image/jpeg;base64,") && s.length <= max;
const jsonOk = (v, max) => { try { return JSON.stringify(v).length <= max; } catch { return false; } };
/** 判分(同 HomeworkRunner.submit):不够除带余数要商和余数都对;其余数值相等(小数题答案已按保留位数四舍五入) */
export function judge(p, value, rem) {
  if (value == null || value === "") return false;
  // 数珠互译(2026-11-08 最多 100 位):按数字串比,超过 15 位的数字不精确
  if (p.beadS) { const n = (x) => String(x).replace(/\D/g, "").replace(/^0+(?=\d)/, ""); return n(value) === n(p.beadS); }
  if (p.rem != null) return Number(value) === p.answer && Number(rem) === p.rem;
  return Math.abs(Number(value) - p.answer) < 1e-9;
}
// 每人题序(2026-11-08 大屏直播 / 切换考生屏幕):同一套题,每个考生按自己的种子在各难度段(p.seg)内打乱 ——
// 大屏放某个人正在做的题,别人不会正好下一题碰到;段的先后不变,难度递进不变,公平不变。
function seeded(seed) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** order[考生看到的第 k 题] = 原题号 */
export function orderFor(problems, sid, examNo) {
  const rnd = seeded(`${sid}:${examNo}`), idx = problems.map((_, i) => i);
  for (let i = 0; i < idx.length;) {
    let j = i; const sg = problems[i]?.seg ?? 0; while (j < idx.length && (problems[j]?.seg ?? 0) === sg) j++;
    for (let k = j - 1; k > i; k--) { const r = i + Math.floor(rnd() * (k - i + 1)); [idx[k], idx[r]] = [idx[r], idx[k]]; }
    i = j;
  }
  return idx;
}
const hideAnswer = (p) => { const { answer, rem, ...x } = p; return rem != null ? { ...x, rem: 0 } : x; }; // rem 留个占位:平板据此显示「商余余数」输入

// ---------- 业务 ----------
export function makeCore({ get, set, list }) {
  const meta = async (cid) => { const m = await get(`c/${cid}/meta`); if (!m) throw err(404, "比赛不存在"); return m; };
  const mustOwn = async (cid, user) => { const m = await meta(cid); if (!user) throw err(401, "请先登录"); if (!user.admin && m.owner !== user.id) throw err(403, "只有比赛组织者可以操作"); return m; };
  const tokenOf = async (token) => { const t = token && (await get(`tok/${token}`)); if (!t) throw err(401, "请重新登录"); return t; };
  const publicMeta = (m) => ({ id: m.id, title: m.title, groups: m.groups, events: m.events, cfg: m.cfg, regDeadline: m.regDeadline, venue: m.venue, date: m.date });

  async function sessionRanking(cid, sid, m, st, full = false) {
    const info = (await get(`c/${cid}/s/${sid}/info`)) || st;
    const regs = await Promise.all((await list(`c/${cid}/reg/`)).map((k) => get(k)));
    const cands = regs.filter((x) => x && x.group === info.group && x.events.includes(info.event));
    const rows = await Promise.all(cands.map(async (x) => {
      const a = (await get(`c/${cid}/s/${sid}/a/${x.examNo}`)) || {};
      return { examNo: x.examNo, name: x.name, answered: a.answered || 0, correct: a.correct || 0, lastAt: a.lastCorrectAt || 0, joined: !!a.joinedAt, ...(full ? { school: x.school || "", idNo: x.idNo || "", age: x.age ?? "" } : {}) };
    }));
    rows.sort((p, q) => q.correct - p.correct || (p.lastAt || Infinity) - (q.lastAt || Infinity) || p.examNo.localeCompare(q.examNo));
    rows.forEach((x, i) => { x.rank = i > 0 && x.correct === rows[i - 1].correct && x.lastAt === rows[i - 1].lastAt ? rows[i - 1].rank : i + 1; });
    const g = m.groups.find((x) => x.id === info.group), e = m.events.find((x) => x.id === info.event);
    return { sid, group: g?.name ?? info.group, event: e?.name ?? info.event, startAt: info.startAt, endAt: info.endAt, status: info.status, rows };
  }

  const A = {
    // —— 组织者 ——
    async createContest(b, user) {
      if (!user) throw err(401, "请先登录");
      const id = randomBytes(4).toString("hex");
      const groups = (b.groups?.length ? b.groups : [{ name: "A组" }, { name: "B组" }, { name: "C组" }]).slice(0, 12).map((g, i) => ({ id: "g" + (i + 1), name: clean(g.name, 12) || `${"ABCDEFGHIJKL"[i]}组` }));
      const events = (b.events || []).filter((e) => PROJECTS[e.project]).slice(0, 8).map((e, i) => ({ id: "e" + (i + 1), project: e.project, name: clean(e.name, 12) || PROJECTS[e.project] }));
      if (!events.length) throw err(400, "至少选一个项目");
      const cfg = {}; for (const g of groups) { cfg[g.id] = {}; for (const [i, e] of events.entries()) cfg[g.id][e.id] = b.cfg?.[i] ?? null; }
      if (!jsonOk(cfg, 200000)) throw err(400, "设置太大");
      const m = { id, owner: user.id, title: clean(b.title, 40) || "珠心算比赛", venue: clean(b.venue, 40), date: clean(b.date, 20), regDeadline: b.regDeadline || null, groups, events, cfg, createdAt: now() };
      await set(`c/${id}/meta`, m); await set(`own/${user.id}/${id}`, { at: now() }); await set(`c/${id}/state`, { status: "idle" });
      return { contest: m };
    },
    async myContests(_b, user) {
      if (!user) throw err(401, "请先登录");
      const ids = (await list(`own/${user.id}/`)).map((k) => k.split("/").pop());
      const ms = (await Promise.all(ids.map((id) => get(`c/${id}/meta`)))).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
      return { contests: ms.map(publicMeta) };
    },
    async saveContest(b, user) {
      const m = await mustOwn(b.cid, user);
      const groups = Array.isArray(b.groups) ? b.groups.slice(0, 12).map((g, i) => ({ id: g.id || "g" + randomBytes(3).toString("hex") + i, name: clean(g.name, 12) || "组" })) : m.groups;
      const events = Array.isArray(b.events) ? b.events.filter((e) => PROJECTS[e.project]).slice(0, 8).map((e, i) => ({ id: e.id || "e" + randomBytes(3).toString("hex") + i, project: e.project, name: clean(e.name, 12) || PROJECTS[e.project] })) : m.events;
      const cfg = {};
      for (const g of groups) { cfg[g.id] = {}; for (const e of events) { const c = b.cfg?.[g.id]?.[e.id] ?? m.cfg?.[g.id]?.[e.id] ?? null; cfg[g.id][e.id] = c && {
        item: c.item, minutes: Math.max(1, Math.min(120, Number(c.minutes) || 5)),
        // 难度段(同项目组合不同难度)与慢 / 中 / 快三档速度(2026-11-08)
        ...(Array.isArray(c.more) && c.more.length ? { more: c.more.slice(0, 8) } : {}),
        ...(Array.isArray(c.tiers) && c.tiers.length === 3 && c.tiers.every((v) => Number(v) > 0) ? { tiers: c.tiers.map(Number) } : {}),
      }; } }
      if (!jsonOk(cfg, 200000)) throw err(400, "设置太大");
      const n = { ...m, title: clean(b.title ?? m.title, 40), venue: clean(b.venue ?? m.venue, 40), date: clean(b.date ?? m.date, 20), regDeadline: b.regDeadline ?? m.regDeadline, groups, events, cfg };
      await set(`c/${m.id}/meta`, n);
      return { contest: n };
    },
    async registrations(b, user) {
      await mustOwn(b.cid, user);
      const regs = (await Promise.all((await list(`c/${b.cid}/reg/`)).map((k) => get(k)))).filter(Boolean).sort((a, b) => a.examNo.localeCompare(b.examNo));
      return { regs: regs.map(({ pw, ...x }) => x) };
    },
    async focus(b, user) { // 大屏直播切到某考生 / 自动跟第一名
      await mustOwn(b.cid, user);
      const v = b.examNo === "auto" || !b.examNo ? "auto" : String(b.examNo);
      await set(`c/${b.cid}/focus`, v);
      return { focus: v };
    },
    async photo(b, user) { // 报名照片:组织者核验
      await mustOwn(b.cid, user);
      return { photo: (await get(`c/${b.cid}/photo/${b.phone}`)) || null };
    },
    async resetPassword(b, user) {
      await mustOwn(b.cid, user);
      const r = await get(`c/${b.cid}/reg/${b.phone}`); if (!r) throw err(404, "没有这个考生");
      const pw = String(randomInt(100000, 1000000)); r.pw = sha(r.phone + ":" + pw); await set(`c/${b.cid}/reg/${r.phone}`, r);
      return { password: pw };
    },
    // 测试用(2026-11-04 用户「先不用考生登录,我先测一下流程」):组织者一键加测试考生、直接以某考生身份打开平板
    async addTestRegs(b, user) {
      const m = await mustOwn(b.cid, user);
      const NAMES = ["王小明", "李华", "张伟", "赵敏", "陈晨", "刘洋", "杨帆", "周婷", "吴昊", "郑爽", "孙悦", "马超"];
      const have = (await list(`c/${m.id}/reg/`)).length, n = Math.max(1, Math.min(30, b.n | 0 || 6)), out = [];
      for (let i = 0; i < n; i++) {
        const k = have + i, g = m.groups[k % m.groups.length];
        let phone = ""; for (let t = 0; t < 30 && !phone; t++) { const c = "199" + String(randomInt(0, 1e8)).padStart(8, "0"); if (!(await get(`c/${m.id}/reg/${c}`))) phone = c; }
        let examNo = ""; for (let t = 0; t < 50 && !examNo; t++) { const c = `${"ABCDEFGHIJKL"[m.groups.indexOf(g)]}${String(randomInt(1, 10000)).padStart(4, "0")}`; if (!(await get(`c/${m.id}/no/${c}`))) examNo = c; }
        await set(`c/${m.id}/no/${examNo}`, { phone });
        const r = { phone, name: `${NAMES[k % NAMES.length]}${k >= NAMES.length ? Math.floor(k / NAMES.length) + 1 : ""}`, group: g.id, events: m.events.map((e) => e.id), examNo, test: true, pw: sha(phone + ":" + randomInt(100000, 1000000)), at: now() };
        await set(`c/${m.id}/reg/${phone}`, r); out.push(r.examNo);
      }
      return { added: out };
    },
    async asCandidate(b, user) {
      await mustOwn(b.cid, user);
      if (!(await get(`c/${b.cid}/reg/${b.phone}`))) throw err(404, "没有这个考生");
      const token = randomBytes(18).toString("hex"); await set(`tok/${token}`, { cid: b.cid, phone: b.phone, at: now() });
      return { token };
    },
    async setSession(b, user) {
      const m = await mustOwn(b.cid, user);
      const st = (await get(`c/${b.cid}/state`)) || {};
      if (st.status === "running" && now() < st.endAt) throw err(409, "当前场次还在进行中,先统一结束");
      if (!m.groups.some((g) => g.id === b.group) || !m.events.some((e) => e.id === b.event)) throw err(400, "组别或项目不对");
      const n = { status: "ready", group: b.group, event: b.event, sid: `${b.group}-${b.event}-${randomBytes(3).toString("hex")}`, setAt: now() };
      await set(`c/${b.cid}/state`, n);
      await set(`c/${b.cid}/s/${n.sid}/info`, { group: n.group, event: n.event, status: "ready" });
      return { state: n };
    },
    async start(b, user) {
      const m = await mustOwn(b.cid, user);
      const st = await get(`c/${b.cid}/state`);
      if (!st || st.status !== "ready") throw err(409, "先切换到要比的场次");
      const c = m.cfg[st.group]?.[st.event];
      if (!c?.item) throw err(400, "这个组别 × 项目还没设置出题参数");
      const problems = b.problems;
      if (!Array.isArray(problems) || !problems.length || problems.length > 500 || problems.some((p) => typeof p?.answer !== "number") || !jsonOk(problems, 400000)) throw err(400, "题目不对");
      await set(`c/${b.cid}/s/${st.sid}/problems`, problems);
      const startAt = now() + Math.max(3, Math.min(15, b.countdown ?? 5)) * 1000, endAt = startAt + c.minutes * 60000;
      const n = { ...st, status: "running", startAt, endAt };
      await set(`c/${b.cid}/state`, n);
      await set(`c/${b.cid}/s/${st.sid}/info`, { group: st.group, event: st.event, status: "running", startAt, endAt });
      return { state: n };
    },
    async end(b, user) {
      await mustOwn(b.cid, user);
      const st = await get(`c/${b.cid}/state`);
      if (!st || st.status !== "running") throw err(409, "没有正在进行的场次");
      const n = { ...st, status: "ended", endAt: Math.min(st.endAt, now()) };
      await set(`c/${b.cid}/state`, n);
      await set(`c/${b.cid}/s/${st.sid}/info`, { group: st.group, event: st.event, status: "ended", startAt: st.startAt, endAt: n.endAt });
      return { state: n };
    },
    async results(b, user) {
      const m = await mustOwn(b.cid, user);
      const sids = [...new Set((await list(`c/${b.cid}/s/`)).map((k) => k.split("/")[3]))];
      const out = [];
      for (const sid of sids) { const info = await get(`c/${b.cid}/s/${sid}/info`); if (info?.startAt) out.push(await sessionRanking(b.cid, sid, m, info, true)); }
      out.sort((p, q) => p.startAt - q.startAt);
      return { title: m.title, sessions: out };
    },

    // —— 公开:报名 / 大屏 / 状态 ——
    async contestInfo(b) { return { contest: publicMeta(await meta(b.cid)) }; },
    async register(b) {
      const m = await meta(b.cid);
      if (m.regDeadline && now() > new Date(m.regDeadline).getTime()) throw err(403, "报名已截止");
      const phone = String(b.phone || "").replace(/\D/g, "");
      if (!/^1\d{10}$/.test(phone)) throw err(400, "请填写 11 位手机号");
      const name = clean(b.name, 16); if (!name) throw err(400, "请填写姓名");
      const g = m.groups.find((x) => x.id === b.group); if (!g) throw err(400, "请选择组别");
      const events = (b.events || []).filter((id) => m.events.some((e) => e.id === id)); if (!events.length) throw err(400, "至少选一个项目");
      const idNo = String(b.idNo || "").toUpperCase().replace(/\s/g, "");
      if (!idValid(idNo)) throw err(400, "身份证号不对,请核对 18 位号码");
      const age = ageFromId(idNo);
      if (!isJpeg(b.photo, 400000) || !isJpeg(b.thumb, 40000)) throw err(400, "请上传本人照片");
      if (await get(`c/${m.id}/reg/${phone}`)) throw err(409, "这个手机号已经报过名了,直接用手机号登录");
      for (const k of await list(`c/${m.id}/reg/`)) { const o = await get(k); if (o?.idNo === idNo) throw err(409, "这个身份证号已经报过名了"); }
      const gi = m.groups.indexOf(g);
      let examNo = "";
      for (let t = 0; t < 50 && !examNo; t++) { const c = `${"ABCDEFGHIJKL"[gi]}${String(randomInt(1, 10000)).padStart(4, "0")}`; if (!(await get(`c/${m.id}/no/${c}`))) examNo = c; }
      await set(`c/${m.id}/no/${examNo}`, { phone });
      const pw = String(randomInt(100000, 1000000));
      const r = { phone, name, group: g.id, events, examNo, school: clean(b.school, 30), idNo, age, thumb: b.thumb, hasPhoto: true, pw: sha(phone + ":" + pw), at: now() };
      await set(`c/${m.id}/photo/${phone}`, b.photo);
      await set(`c/${m.id}/reg/${phone}`, r); await set(`phone/${phone}/${m.id}`, { at: now() });
      return { examNo, password: pw, name, group: g.name };
    },
    async login(b) {
      const phone = String(b.phone || "").replace(/\D/g, ""), pw = String(b.password || "");
      const cids = b.cid ? [b.cid] : (await list(`phone/${phone}/`)).map((k) => k.split("/").pop());
      for (const cid of cids.reverse()) {
        const r = await get(`c/${cid}/reg/${phone}`);
        if (r && r.pw === sha(phone + ":" + pw)) { const token = randomBytes(18).toString("hex"); await set(`tok/${token}`, { cid, phone, at: now() }); return { token, cid }; }
      }
      throw err(401, "手机号或密码不对");
    },
    async me(b) {
      const t = await tokenOf(b.token); const m = await meta(t.cid); const r = await get(`c/${t.cid}/reg/${t.phone}`);
      const { pw, ...reg } = r;
      return { contest: publicMeta(m), reg, groupName: m.groups.find((g) => g.id === r.group)?.name };
    },
    async state(b) {
      const st = (await get(`c/${b.cid}/state`)) || { status: "idle" };
      const out = { now: now(), state: st };
      if (st.status === "running" && now() > st.endAt) out.state = { ...st, status: "ended" };
      if (b.token && st.sid) {
        const t = await get(`tok/${b.token}`);
        if (t && t.cid === b.cid) {
          const r = await get(`c/${b.cid}/reg/${t.phone}`);
          out.mine = !!r && r.group === st.group && r.events.includes(st.event);
          if (out.mine) {
            const m = await meta(b.cid);
            out.cfg = m.cfg[st.group][st.event];
            const a = await get(`c/${b.cid}/s/${st.sid}/a/${r.examNo}`);
            const needOrder = (a && Object.keys(a.answers || {}).length) || (b.withProblems && st.status === "running" && now() >= st.startAt);
            const problems = needOrder ? (await get(`c/${b.cid}/s/${st.sid}/problems`)) || [] : [];
            const order = needOrder ? orderFor(problems, st.sid, r.examNo) : [];
            const inv = new Map(order.map((o, k) => [o, k]));
            out.progress = a ? { answered: a.answered, correct: a.correct, done: Object.keys(a.answers || {}).map((o) => inv.get(Number(o)) ?? -1).filter((k) => k >= 0) } : null;
            if (b.withProblems && st.status === "running" && now() >= st.startAt) out.problems = order.map((o) => hideAnswer(problems[o]));
            out.live = (await get(`c/${b.cid}/livetarget`)) === r.examNo; // 大屏正在直播我 → 平板上报实时状态
          }
        }
      }
      return out;
    },
    async answer(b) {
      const t = await tokenOf(b.token); const st = await get(`c/${t.cid}/state`);
      if (!st || st.sid !== b.sid) throw err(409, "本场已结束");
      // 2026-11-09 补交(用户问「中国 100 人比赛能不能办」→ 跨境网络会丢包):平板把交卷时刻 at(按服务器钟)带上,
      // 网络抖动导致晚到的答案,只要交卷时刻在结束前、且 60 秒内送达,照样算;排名用交卷时刻,不吃网络延迟的亏
      const tm = now(), at = Number(b.at);
      const late = Number.isFinite(at) && at >= st.startAt && at <= st.endAt && tm <= st.endAt + 60000;
      if (st.status !== "running" && !(st.status === "ended" && late)) throw err(409, "本场已结束");
      if (tm < st.startAt) throw err(409, "还没开始"); if (tm > st.endAt + 3000 && !late) throw err(409, "时间到,已锁定");
      const when = Number.isFinite(at) && at >= st.startAt && at <= tm ? at : tm;
      const r = await get(`c/${t.cid}/reg/${t.phone}`);
      if (!r || r.group !== st.group || !r.events.includes(st.event)) throw err(403, "不是本场考生");
      const problems = await get(`c/${t.cid}/s/${st.sid}/problems`); const i = orderFor(problems || [], st.sid, r.examNo)[b.idx | 0]; const p = problems?.[i]; if (p == null || i == null) throw err(400, "题号不对");
      const key = `c/${t.cid}/s/${st.sid}/a/${r.examNo}`;
      const a = (await get(key)) || { answers: {}, answered: 0, correct: 0, joinedAt: tm };
      if (a.answers[i] != null) return { ok: true, answered: a.answered, correct: a.correct }; // 每题只算第一次提交
      const ok = judge(p, b.value, b.rem);
      a.answers[i] = b.value == null ? "" : String(b.value) + (b.rem != null ? `余${b.rem}` : ""); a.answered++; if (ok) { a.correct++; a.lastCorrectAt = Math.max(a.lastCorrectAt || 0, when); } a.lastAt = Math.max(a.lastAt || 0, when);
      await set(key, a);
      // 大屏正在直播这位考生:记下这题对错(大屏亮 ✓ / ✗,不显示答案)
      if ((await get(`c/${t.cid}/livetarget`)) === r.examNo) {
        const lk = `c/${t.cid}/s/${st.sid}/live/${r.examNo}`; const lv = (await get(lk)) || {};
        await set(lk, { ...lv, lastOk: { ok, at: tm, n: a.answered } });
      }
      return { ok: true, answered: a.answered, correct: a.correct };
    },
    // 被直播的平板上报实时状态(只有大屏正在直播的那一台才会发;看题 / 作答 / 已输入位数 / 速度档)
    async liveEv(b) {
      const t = await tokenOf(b.token); const st = await get(`c/${t.cid}/state`);
      if (!st || st.status !== "running" || st.sid !== b.sid) return { ok: false };
      const r = await get(`c/${t.cid}/reg/${t.phone}`);
      if (!r || (await get(`c/${t.cid}/livetarget`)) !== r.examNo) return { ok: false };
      const problems = (await get(`c/${t.cid}/s/${st.sid}/problems`)) || [];
      const orig = orderFor(problems, st.sid, r.examNo)[b.idx | 0];
      const lk = `c/${t.cid}/s/${st.sid}/live/${r.examNo}`; const lv = (await get(lk)) || {};
      const phase = b.phase === "answer" ? "answer" : "play";
      const same = lv.k === (b.idx | 0) && lv.phase === phase;
      await set(lk, { ...lv, k: b.idx | 0, orig, phase, at: same ? lv.at : now(), typed: Math.max(0, Math.min(120, b.typed | 0)), tier: Math.max(0, Math.min(2, b.tier | 0)) });
      return { ok: true };
    },
    // 大屏直播屏:某考生此刻的题(不含答案)+ 状态 + 成绩
    async live(b) {
      const m = await meta(b.cid); const st = (await get(`c/${b.cid}/state`)) || { status: "idle" };
      const examNo = String(b.examNo || "");
      if (!st.sid || !examNo) return { now: now(), state: st };
      const no = await get(`c/${b.cid}/no/${examNo}`); const r = no && (await get(`c/${b.cid}/reg/${no.phone}`));
      if (!r) return { now: now(), state: st };
      const lv = await get(`c/${b.cid}/s/${st.sid}/live/${examNo}`);
      const a = (await get(`c/${b.cid}/s/${st.sid}/a/${examNo}`)) || {};
      const problems = lv?.orig != null ? (await get(`c/${b.cid}/s/${st.sid}/problems`)) || [] : [];
      return {
        now: now(), state: st, cfg: m.cfg?.[st.group]?.[st.event] ?? null, project: m.events.find((e) => e.id === st.event)?.project,
        student: { examNo, name: r.name, school: r.school || "", answered: a.answered || 0, correct: a.correct || 0 },
        live: lv || null, problem: lv?.orig != null && problems[lv.orig] ? hideAnswer(problems[lv.orig]) : null,
      };
    },
    async join(b) { // 平板进入候场:登记已入座(大屏显示到场人数)
      const t = await tokenOf(b.token); const st = await get(`c/${t.cid}/state`); if (!st?.sid) return { ok: true };
      const r = await get(`c/${t.cid}/reg/${t.phone}`); if (!r || r.group !== st.group || !r.events.includes(st.event)) return { ok: true };
      const key = `c/${t.cid}/s/${st.sid}/a/${r.examNo}`; if (!(await get(key))) await set(key, { answers: {}, answered: 0, correct: 0, joinedAt: now() });
      return { ok: true };
    },
    async screen(b) {
      const m = await meta(b.cid); const st = (await get(`c/${b.cid}/state`)) || { status: "idle" };
      if (!st.sid) return { now: now(), title: m.title, state: st };
      const rk = await sessionRanking(b.cid, st.sid, m, { ...st, status: st.status === "running" && now() > st.endAt ? "ended" : st.status });
      // 大屏直播对象:组织者指定的考号;没指定 / 自动 → 第一名(还没人答题就第一个到场的)
      const focus = (await get(`c/${b.cid}/focus`)) || "auto";
      const target = focus !== "auto" && rk.rows.some((x) => x.examNo === focus) ? focus : (rk.rows.find((x) => x.joined) ?? rk.rows[0])?.examNo ?? null;
      if (target && (await get(`c/${b.cid}/livetarget`)) !== target) await set(`c/${b.cid}/livetarget`, target);
      return { now: now(), title: m.title, state: st, ranking: rk, focus, target };
    },
  };
  const OWNER_ONLY = new Set(["focus", "photo", "addTestRegs", "asCandidate", "createContest", "myContests", "saveContest", "registrations", "resetPassword", "setSession", "start", "end", "results"]);
  return async function handle(action, body, user) {
    const fn = A[action]; if (!fn) throw err(400, "未知操作");
    if (OWNER_ONLY.has(action) && !user) throw err(401, "请先登录");
    return fn(body || {}, user);
  };
}
