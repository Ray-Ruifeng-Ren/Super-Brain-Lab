// 开发环境演示数据(仅 vite dev,地址带 ?demo=1 开启,生产构建不包含):
// 用一份内存里的示例数据模拟登录态和数据表,给软著用户手册截图用 —— 不连线上数据库、不碰真实账号。
type Row = Record<string, unknown> & { id: string; created_at: string };
const COACH = "00000000-0000-4000-8000-00000000c0ac", ADMIN = "00000000-0000-4000-8000-0000000000ad";
const day = (d: number, h = 18, m = 0) => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(h, m, 0, 0); return t.toISOString(); };
const dkey = (d: number) => day(d).slice(0, 10);
let seq = 1;
const rid = () => `00000000-0000-4000-8000-${String(seq++).padStart(12, "0")}`;
const STUDENTS = [["李沐阳", "g1"], ["张一诺", "g1"], ["陈思远", "g1"], ["刘子涵", "g1"], ["赵雨桐", "g2"], ["周可欣", "g2"], ["吴浩然", "g2"], ["孙梓萱", "g2"]].map(([name, g], i) => ({ id: `00000000-0000-4000-8000-0000000005${String(i).padStart(2, "0")}`, name, g, login: `zx${String(301 + i)}` }));
const ITEMS = [
  { project: "flash", op: "addsub", n: 10, count: 5, digits: 1, digitsMax: 1, stage: 2, speedMs: 800 },
  { project: "listen", op: "addsub", n: 10, count: 4, digits: 2, digitsMax: 2, includeSub: true, listenSpeed: 4 },
  { project: "glance", op: "addsub", n: 10, count: 5, digits: 2, digitsMax: 2, includeSub: true },
];
function genResults(n: number, wrong: number[]) {
  return Array.from({ length: n }, (_, i) => { const terms = [12 + i, 25, -(7 + (i % 5)), 31]; const answer = terms.reduce((a, b) => a + b, 0); const ok = !wrong.includes(i); return { terms: terms.map(Math.abs), signs: terms.map((t) => (t < 0 ? "-" : "+")), answer, given: ok ? answer : answer + 10, correct: ok, ms: 2600 + ((i * 731) % 2400) }; });
}
const tables: Record<string, Row[]> = { profiles: [], scores: [], practice_attempts: [], user_roles: [] };
tables.profiles.push({ id: COACH, created_at: day(60), nickname: "王老师", avatar_url: null });
tables.scores.push({ id: rid(), created_at: day(60), user_id: ADMIN, game: "coach", mode: "grant", value: 1, meta: { coachId: COACH, label: "王老师" } });
tables.scores.push({ id: rid(), created_at: day(40), user_id: COACH, game: "class", mode: "group", value: 0, meta: { groupId: "g1", name: "周六上午提高班" } });
tables.scores.push({ id: rid(), created_at: day(40), user_id: COACH, game: "class", mode: "group", value: 0, meta: { groupId: "g2", name: "周三晚基础班" } });
for (const s of STUDENTS) {
  tables.profiles.push({ id: s.id, created_at: day(38), nickname: s.name, avatar_url: null });
  tables.scores.push({ id: rid(), created_at: day(38), user_id: COACH, game: "class", mode: "member", value: 0, meta: { studentId: s.id, name: s.name, loginName: s.login, groupId: s.g } });
  tables.scores.push({ id: rid(), created_at: day(38), user_id: s.id, game: "class", mode: "join", value: 0, meta: { coachId: COACH, loginName: s.login } });
}
STUDENTS.forEach((s, si) => {
  for (const d of [1, 0]) {
    const aid = rid();
    tables.scores.push({ id: aid, created_at: day(d, 9), user_id: COACH, game: "hw", mode: "assign", value: ITEMS.length, meta: { studentId: s.id, title: d ? "满五加专项 + 听心算" : "今日作业 · 看心算两位数", note: d ? "先慢后快，错题记得重做" : "", items: ITEMS, date: dkey(d) } });
    if (d === 0 && si >= 6) continue; // 今天还有两个人没做
    ITEMS.forEach((it, idx) => {
      if (d === 0 && idx === 2 && si >= 4) return;
      const wrong = [[2], [], [4, 7], [1], [3, 8, 9], [], [5], [0, 6]][si];
      const results = genResults(it.n, wrong);
      tables.scores.push({ id: rid(), created_at: day(d, 19, 10 + idx * 6 + si), user_id: s.id, game: "hw", mode: "submit", value: results.filter((r) => r.correct).length, meta: { assignId: aid, itemIdx: idx, results, correct: results.filter((r) => r.correct).length, total: results.length, ms: results.reduce((a, r) => a + r.ms, 0), retry: false } });
    });
    if (d === 1 && si < 3) tables.scores.push({ id: rid(), created_at: day(d, 21), user_id: COACH, game: "hw", mode: "review", value: 5 - si, meta: { assignId: aid, stars: 5 - si, comment: ["速度很稳，继续保持！", "满五加有进步，听算再仔细点", "错题都改对了，很认真"][si] } });
  }
});
for (let i = 0; i < 60; i++) tables.practice_attempts.push({ id: rid(), created_at: day(i % 14, 18, i % 50), user_id: COACH, game: "flash", mode: "flash", terms: [3, 4, 2], signs: ["+", "+", "+"], answer: 9, correct: i % 7 !== 0, used_ms: 2000 + (i % 9) * 300 });

const getCol = (r: Row, col: string): unknown => {
  const m = col.match(/^(\w+)->>?(\w+)$/);
  if (m) { const o = r[m[1]] as Record<string, unknown> | null | undefined; const v = o?.[m[2]]; return col.includes("->>") ? (v == null ? null : String(v)) : v; }
  return r[col];
};
type Filter = (r: Row) => boolean;
class Q {
  private fs: Filter[] = []; private ord: [string, boolean][] = []; private lim?: number; private rng?: [number, number];
  private one: "" | "single" | "maybe" = ""; private head = false; private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row[] | Record<string, unknown> | null = null; private joinProfiles = false;
  constructor(private t: string) {}
  select(cols = "*", opts?: { count?: string; head?: boolean }) { if (/profiles\(/.test(cols)) this.joinProfiles = true; if (opts?.head) this.head = true; return this; }
  eq(c: string, v: unknown) { this.fs.push((r) => String(getCol(r, c)) === String(v)); return this; }
  neq(c: string, v: unknown) { this.fs.push((r) => String(getCol(r, c)) !== String(v)); return this; }
  in(c: string, vs: unknown[]) { const s = new Set(vs.map(String)); this.fs.push((r) => s.has(String(getCol(r, c)))); return this; }
  gte(c: string, v: unknown) { this.fs.push((r) => String(getCol(r, c)) >= String(v)); return this; }
  lte(c: string, v: unknown) { this.fs.push((r) => String(getCol(r, c)) <= String(v)); return this; }
  gt(c: string, v: unknown) { this.fs.push((r) => String(getCol(r, c)) > String(v)); return this; }
  lt(c: string, v: unknown) { this.fs.push((r) => String(getCol(r, c)) < String(v)); return this; }
  is(c: string, v: unknown) { this.fs.push((r) => (getCol(r, c) ?? null) === v); return this; }
  like() { return this; } ilike() { return this; } or() { return this; } not() { return this; } filter() { return this; } contains() { return this; } match() { return this; }
  order(c: string, o?: { ascending?: boolean }) { this.ord.push([c, o?.ascending !== false]); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.rng = [a, b]; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]) { this.op = "insert"; this.payload = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: rid(), created_at: new Date().toISOString(), ...r }) as Row); return this; }
  upsert(rows: Record<string, unknown> | Record<string, unknown>[]) { this.op = "upsert"; this.payload = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: rid(), created_at: new Date().toISOString(), ...r }) as Row); return this; }
  update(obj: Record<string, unknown>) { this.op = "update"; this.payload = obj; return this; }
  delete() { this.op = "delete"; return this; }
  private run() {
    const T = tables[this.t] ?? (tables[this.t] = []);
    if (this.op === "insert" || this.op === "upsert") { const rows = this.payload as Row[]; for (const r of rows) { const i = T.findIndex((x) => x.id === r.id); if (i >= 0) T[i] = { ...T[i], ...r }; else T.push(r); } return { data: this.one ? rows[0] : rows, error: null }; }
    let rows = T.filter((r) => this.fs.every((f) => f(r)));
    if (this.op === "update") { rows.forEach((r) => Object.assign(r, this.payload)); return { data: rows, error: null }; }
    if (this.op === "delete") { tables[this.t] = T.filter((r) => !rows.includes(r)); return { data: rows, error: null }; }
    for (const [c, asc] of [...this.ord].reverse()) rows = [...rows].sort((a, b) => (String(getCol(a, c)) < String(getCol(b, c)) ? -1 : String(getCol(a, c)) > String(getCol(b, c)) ? 1 : 0) * (asc ? 1 : -1));
    const count = rows.length;
    if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim != null) rows = rows.slice(0, this.lim);
    if (this.joinProfiles) rows = rows.map((r) => ({ ...r, profiles: { nickname: (tables.profiles.find((p) => p.id === r.user_id)?.nickname as string) ?? null } }));
    if (this.head) return { data: null, error: null, count };
    if (this.one) return { data: rows[0] ?? null, error: this.one === "single" && !rows[0] ? { message: "not found" } : null, count };
    return { data: rows, error: null, count };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(ok?: (v: any) => any, bad?: (e: unknown) => any) { return Promise.resolve(this.run()).then(ok, bad); }
}
export function createDemoClient() {
  // ?demo=student:以学生「李沐阳」身份看(学生作业页);默认以教练「王老师」身份(在创建时读,client.ts 已先写好 sessionStorage)
  const asStudent = typeof window !== "undefined" && sessionStorage.getItem("sbl:demo") === "student";
  const me = asStudent ? STUDENTS[0] : null;
  const user = me ? { id: me.id, email: `${me.login}@example.com`, user_metadata: { nickname: me.name }, app_metadata: {}, aud: "authenticated", created_at: day(38) }
    : { id: COACH, email: "wang.laoshi@example.com", user_metadata: { nickname: "王老师" }, app_metadata: {}, aud: "authenticated", created_at: day(60) };
  const session = { access_token: "demo", refresh_token: "demo", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  const ok = <T,>(data: T) => Promise.resolve({ data, error: null });
  return {
    from: (t: string) => new Q(t),
    rpc: (name: string, args: { _user_id?: string; _role?: string }) => ok(name === "has_role" ? args?._user_id === ADMIN : null),
    functions: { invoke: () => ok(null) },
    auth: {
      getSession: () => ok({ session }),
      getUser: () => ok({ user }),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => { setTimeout(() => cb("SIGNED_IN", session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: () => ok({ session, user }), signUp: () => ok({ session, user }), signOut: () => ok(null),
      updateUser: () => ok({ user }), setSession: () => ok({ session, user }), resetPasswordForEmail: () => ok({}),
    },
  };
}
