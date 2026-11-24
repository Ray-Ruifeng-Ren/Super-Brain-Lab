// 2026-11-08 比赛系统:速度三档(管理员设、考生选)、同项目多难度段、报名身份证 / 年龄、数珠互译 100 位按数字串判分
import { describe, it, expect } from "vitest";
import { ageFromId, contestProblems, estimateCount, idValid, normCfg, runItem, segmentsOf, tiersOf } from "@/lib/contest";
import { normalizeItem } from "@/lib/homework";
import { judge, idValid as idValidSrv } from "../../netlify/functions/_contest-core.mjs";

const mkId = (seq: number, birth = "20160315") => { const b = `110101${birth}${String(seq).padStart(3, "0")}`; const W = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]; return b + "10X98765432"[W.reduce((a, w, i) => a + w * Number(b[i]), 0) % 11]; };

describe("比赛 · 身份证 / 年龄", () => {
  it("校验码、出生日期;前后端一致;周岁", () => {
    const id = mkId(7);
    expect(idValid(id)).toBe(true); expect(idValidSrv(id)).toBe(true);
    const bad = id.slice(0, 17) + (id[17] === "0" ? "1" : "0");
    expect(idValid(bad)).toBe(false); expect(idValidSrv(bad)).toBe(false);
    expect(idValid(mkId(1, "20160231"))).toBe(false); // 2 月 31 日
    expect(ageFromId(mkId(1, "20160315"), new Date(2026, 2, 14))).toBe(9);
    expect(ageFromId(mkId(1, "20160315"), new Date(2026, 2, 15))).toBe(10);
  });
});

describe("比赛 · 速度三档", () => {
  it("闪算:默认 慢 1.4× / 中 / 快 0.7×;选档改每笔毫秒,比赛中不加速", () => {
    const c = normCfg({ item: normalizeItem({ project: "flash", speedMs: 1000 }), minutes: 5 });
    expect(tiersOf(c)).toEqual([1400, 1000, 700]);
    expect(runItem(c, 2).speedMs).toBe(700); expect(runItem(c, 0).speedMs).toBe(1400);
    const set = normCfg({ ...c, tiers: [1200, 800, 500] });
    expect(runItem(set, 1).speedMs).toBe(800);
  });
  it("听算按语速档;马拉松按每笔毫秒;看算没有速度档", () => {
    const l = normCfg({ item: normalizeItem({ project: "listen", listenSpeed: 5 }), minutes: 5 });
    expect(tiersOf(l)).toEqual([3, 5, 7]); expect(runItem(l, 2).listenSpeed).toBe(7);
    const s = normCfg({ item: normalizeItem({ project: "scroll", scrollSec: 20, count: 10, scrollAccel: true }), minutes: 5, tiers: [3000, 2000, 1000] });
    expect(runItem(s, 2).scrollTermMs).toBe(1000); expect(runItem(s, 2).scrollAccel).toBe(false);
    expect(tiersOf(normCfg({ item: normalizeItem({ project: "glance" }), minutes: 5 }))).toBeNull();
  });
});

describe("比赛 · 同项目多难度段", () => {
  it("按段顺序出题,每段按自己的题量,最后一段补足到限时", () => {
    const a = normalizeItem({ project: "flash", digits: 1, digitsMax: 1, count: 5, n: 10, speedMs: 500 });
    const b = normalizeItem({ project: "flash", digits: 3, digitsMax: 3, count: 5, n: 10, speedMs: 500 });
    const c = normCfg({ item: a, more: [b], minutes: 5 });
    expect(segmentsOf(c)).toHaveLength(2);
    const ps = contestProblems(c);
    expect(ps.length).toBe(Math.max(20, estimateCount(c)));
    expect(ps.slice(0, 10).every((p) => p.terms.every((t) => Math.abs(t) < 10))).toBe(true);
    expect(ps.slice(10, 20).every((p) => p.terms.every((t) => Math.abs(t) >= 100 && Math.abs(t) < 1000))).toBe(true);
  });
});

describe("比赛 · 数珠互译 / 数码秒记按数字串判分", () => {
  it("100 位不丢精度", () => {
    const s = "9" + "0123456789".repeat(9) + "876543210";
    const p = { terms: [Number(s)], signs: ["+"], answer: Number(s), bead: Number(s), beadS: s };
    expect(judge(p, s)).toBe(true);
    expect(judge(p, s.slice(0, -1) + "1")).toBe(false); // 末位不同:数字比较会误判为对
  });
});
