// 比赛系统后端核心(netlify/functions/_contest-core.mjs)全流程:报名 → 登录 → 切换场次 → 统一开始 → 判分 → 排名 → 锁定
import { describe, it, expect, vi } from "vitest";
import { makeCore, judge } from "../../netlify/functions/_contest-core.mjs";
import { genProblems, newItemForTest } from "./contestHelpers";

// 合法的 18 位身份证号(校验码按 GB 11643 算)+ 报名照片占位(2026-11-08 报名加身份证 / 照片 / 年龄)
const mkId = (seq: number, birth = "20160315") => { const b = `110101${birth}${String(seq).padStart(3, "0")}`; const W = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]; return b + "10X98765432"[W.reduce((a, w, i) => a + w * Number(b[i]), 0) % 11]; };
const PH = { photo: "data:image/jpeg;base64,AAAA", thumb: "data:image/jpeg;base64,AAAA" };

const memCore = () => {
  const mem = new Map<string, unknown>();
  return makeCore({ get: async (k: string) => (mem.has(k) ? structuredClone(mem.get(k)) : null), set: async (k: string, v: unknown) => void mem.set(k, structuredClone(v)), list: async (p: string) => [...mem.keys()].filter((k) => k.startsWith(p)) });
};
const admin = { id: "u1", admin: false };

describe("比赛系统", () => {
  it("判分同训练系统:数值相等;不够除带余数要商和余数都对", () => {
    expect(judge({ answer: 12 }, 12)).toBe(true);
    expect(judge({ answer: 1.25 }, 1.25)).toBe(true);
    expect(judge({ answer: 12 }, null)).toBe(false);
    expect(judge({ answer: 2, rem: 6 }, 2, 6)).toBe(true);
    expect(judge({ answer: 2, rem: 6 }, 2, null)).toBe(false);
  });

  it("全流程:同组同项目统一开始、判分、排名、到点锁定;不是本场考生不能答", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-06T09:00:00+08:00"));
    const h = memCore();
    const item = newItemForTest();
    const { contest } = await h("createContest", { title: "测试赛", events: [{ project: "flash" }], cfg: [{ item, minutes: 5 }] }, admin);
    const cid = contest.id;
    const a = await h("register", { cid, name: "甲", phone: "13800000001", group: "g1", events: ["e1"], idNo: mkId(1), ...PH });
    const b = await h("register", { cid, name: "乙", phone: "13800000002", group: "g1", events: ["e1"], idNo: mkId(2), ...PH });
    const c = await h("register", { cid, name: "丙", phone: "13800000003", group: "g2", events: ["e1"], idNo: mkId(3), ...PH });
    await expect(h("register", { cid, name: "甲", phone: "13800000001", group: "g1", events: ["e1"], idNo: mkId(1), ...PH })).rejects.toThrow(/报过名/);
    expect(new Set([a.examNo, b.examNo, c.examNo]).size).toBe(3);
    const ta = (await h("login", { phone: "13800000001", password: a.password })).token;
    const tb = (await h("login", { phone: "13800000002", password: b.password })).token;
    const tc = (await h("login", { phone: "13800000003", password: c.password })).token;
    await expect(h("login", { phone: "13800000001", password: "000000" })).rejects.toThrow();
    await expect(h("setSession", { cid, group: "g1", event: "e1" }, { id: "other", admin: false })).rejects.toThrow(/组织者/);

    const { state } = await h("setSession", { cid, group: "g1", event: "e1" }, admin);
    await expect(h("start", { cid, countdown: 5, problems: [] }, admin)).rejects.toThrow(/题目/);
    const { state: run } = await h("start", { cid, countdown: 5, problems: genProblems(item, 30) }, admin);
    // 开始前拿不到题
    expect((await h("state", { cid, token: ta, withProblems: true })).problems).toBeUndefined();
    vi.setSystemTime(run.startAt + 100);
    const s = await h("state", { cid, token: ta, withProblems: true });
    expect(s.mine).toBe(true); expect(s.problems.length).toBe(30); expect(s.problems[0].answer).toBeUndefined();
    expect((await h("state", { cid, token: tc })).mine).toBe(false);
    await expect(h("answer", { token: tc, sid: state.sid, idx: 0, value: 1 })).rejects.toThrow(/不是本场/);
    const sum = (i: number) => s.problems[i].terms.reduce((x: number, y: number, k: number) => x + (s.problems[i].signs?.[k] === "-" ? -y : y), 0);
    await h("answer", { token: ta, sid: state.sid, idx: 0, value: sum(0) });
    await h("answer", { token: ta, sid: state.sid, idx: 1, value: sum(1) });
    vi.setSystemTime(run.startAt + 5000);
    // 每人题序不同(2026-11-08 大屏直播防泄题):乙按自己拿到的顺序答
    const sb = await h("state", { cid, token: tb, withProblems: true });
    expect(sb.problems.map((p: { terms: number[] }) => p.terms.join()).sort()).toEqual(s.problems.map((p: { terms: number[] }) => p.terms.join()).sort());
    const sumB = (i: number) => sb.problems[i].terms.reduce((x: number, y: number, k: number) => x + (sb.problems[i].signs?.[k] === "-" ? -y : y), 0);
    await h("answer", { token: tb, sid: state.sid, idx: 0, value: sumB(0) });
    await h("answer", { token: tb, sid: state.sid, idx: 1, value: -999999 });
    const again = await h("answer", { token: ta, sid: state.sid, idx: 0, value: 999 }); // 同一题只算第一次
    expect(again.correct).toBe(2);
    const scr = await h("screen", { cid });
    expect(scr.ranking.rows.map((r: { name: string; correct: number; answered: number }) => [r.name, r.correct, r.answered])).toEqual([["甲", 2, 2], ["乙", 1, 2]]);
    // 到点锁定
    vi.setSystemTime(run.endAt + 5000);
    await expect(h("answer", { token: tb, sid: state.sid, idx: 2, value: sumB(2) })).rejects.toThrow(/锁定/);
    expect((await h("state", { cid })).state.status).toBe("ended");
    // 大屏直播:默认跟第一名;组织者可切到乙;只有被直播的平板能上报;直播数据不含答案
    expect(scr.target).toBe(a.examNo);
    await h("focus", { cid, examNo: b.examNo }, admin);
    expect((await h("screen", { cid })).target).toBe(b.examNo);
    expect((await h("state", { cid, token: tb })).live).toBe(true);
    expect((await h("state", { cid, token: ta })).live).toBe(false);
    expect((await h("liveEv", { token: ta, sid: state.sid, idx: 2, phase: "play", typed: 0, tier: 1 })).ok).toBe(false);
    expect((await h("liveEv", { token: tb, sid: state.sid, idx: 2, phase: "play", typed: 0, tier: 2 })).ok).toBe(true);
    const lv = await h("live", { cid, examNo: b.examNo });
    expect(lv.live.k).toBe(2); expect(lv.live.tier).toBe(2); expect(lv.problem.terms.join()).toBe(sb.problems[2].terms.join()); expect(lv.problem.answer).toBeUndefined();
    const res = await h("results", { cid }, admin);
    expect(res.sessions).toHaveLength(1); expect(res.sessions[0].rows[0].rank).toBe(1);
    vi.useRealTimers();
  });
});

describe("比赛 · 网络晚到的答案(2026-11-09)", () => {
  it("交卷时刻在结束前、60 秒内送达 → 照样算;交卷时刻在结束后 → 拒收;排名用交卷时刻", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-06T09:00:00+08:00"));
    const h = memCore();
    const item = newItemForTest();
    const { contest } = await h("createContest", { title: "晚到测试", events: [{ project: "flash" }], cfg: [{ item, minutes: 1 }] }, admin);
    const cid = contest.id;
    const a = await h("register", { cid, name: "甲", phone: "13900000001", group: "g1", events: ["e1"], idNo: mkId(11), ...PH });
    const ta = (await h("login", { phone: "13900000001", password: a.password })).token;
    const { state } = await h("setSession", { cid, group: "g1", event: "e1" }, admin);
    const { state: run } = await h("start", { cid, countdown: 5, problems: genProblems(item, 10) }, admin);
    vi.setSystemTime(run.startAt + 100);
    const s = await h("state", { cid, token: ta, withProblems: true });
    const sum = (i: number) => s.problems[i].terms.reduce((x: number, y: number, k: number) => x + (s.problems[i].signs?.[k] === "-" ? -y : y), 0);
    vi.setSystemTime(run.endAt + 20000); // 结束后 20 秒才送到(网络抖动)
    const r = await h("answer", { token: ta, sid: state.sid, idx: 0, value: sum(0), at: run.endAt - 5000 });
    expect(r.correct).toBe(1);
    await expect(h("answer", { token: ta, sid: state.sid, idx: 1, value: sum(1), at: run.endAt + 1000 })).rejects.toThrow(/锁定/);
    await h("end", { cid }, admin).catch(() => {});
    const r2 = await h("answer", { token: ta, sid: state.sid, idx: 2, value: sum(2), at: run.endAt - 1000 });
    expect(r2.answered).toBe(2);
    vi.useRealTimers();
  });
});
