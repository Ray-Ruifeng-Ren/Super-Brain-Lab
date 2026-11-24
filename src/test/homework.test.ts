// 作业系统纯函数:配置规整、出题、标签、进度归纳、班级码
import { describe, it, expect } from "vitest";
import { DEFAULT_ITEM, normalizeItem, genProblems, itemLabel, summarize, type HwAssignment, type HwSubmission } from "@/lib/homework";

describe("作业系统", () => {
  it("H1 normalizeItem:夹取范围、闪算强制加减、位数上限不小于下限", () => {
    const it = normalizeItem({ project: "flash", op: "mul", n: 999, digits: 4, digitsMax: 2, speedMs: 5 });
    expect(it.op).toBe("addsub");
    expect(it.n).toBe(100);
    expect(it.digitsMax).toBe(4);
    expect(it.speedMs).toBe(100);
    expect(normalizeItem(undefined)).toEqual(DEFAULT_ITEM);
  });

  it("H2 出题:各项目题量/形状正确", () => {
    const add = genProblems(normalizeItem({ project: "flash", count: 7, digits: 2, digitsMax: 3, includeSub: true, n: 12 }));
    expect(add.length).toBe(12);
    for (const p of add) {
      expect(p.terms.length).toBe(7);
      expect(p.terms.every((t) => t >= 10 && t <= 999)).toBe(true);
      expect(p.answer).toBe(p.terms.reduce((s, t, i) => s + (p.signs[i] === "-" ? -t : t), 0));
    }
    const mul = genProblems(normalizeItem({ project: "glance", op: "mul", mulA: 2, mulB: 1, n: 5 }));
    for (const p of mul) { expect(p.op).toBe("×"); expect(p.answer).toBe(p.terms[0] * p.terms[1]); }
    const div = genProblems(normalizeItem({ project: "listen", op: "div", divD: 1, divQ: 2, n: 5 }));
    for (const p of div) { expect(p.op).toBe("÷"); expect(p.terms[0]).toBe(p.terms[1] * p.answer); expect(String(p.answer).length).toBe(2); }
    const bead = genProblems(normalizeItem({ project: "bead", beadDigits: 3, n: 4 }));
    for (const p of bead) { expect(p.bead).toBe(p.answer); expect(p.answer).toBeLessThan(1000); expect(p.beadDigits).toBe(3); }
  });

  it("H3 标签可读", () => {
    expect(itemLabel(normalizeItem({ project: "flash", digits: 2, digitsMax: 2, count: 5, speedMs: 700, n: 10 }))).toBe("闪算 · 纯加 2位×5笔 · 0.7s/笔 · 10题");
    expect(itemLabel(normalizeItem({ project: "bead", beadDir: "n2b", beadDigits: 2, n: 8 }))).toBe("数珠互译 · 数→珠 2位 · 8题");
    expect(itemLabel(normalizeItem({ project: "glance", op: "div", divD: 1, divQ: 2, glanceLimitSec: 10, n: 5 }))).toContain("限时10s");
  });

  it("H4 进度归纳:未开始/进行中/已完成,错题重做不计入首做正确率,最终全对看最后一轮", () => {
    const a: HwAssignment = { id: "A", coachId: "c", studentId: "s", title: "t", note: "", items: [DEFAULT_ITEM, DEFAULT_ITEM], createdAt: "2026-10-11T00:00:00Z", date: "2026-10-11" };
    const sub = (itemIdx: number, correct: number, total: number, retry: boolean, t: string): HwSubmission =>
      ({ id: t, assignId: "A", studentId: "s", itemIdx, results: [], correct, total, ms: 1000, retry, createdAt: t });
    expect(summarize(a, []).status).toBe("todo");
    const s1 = summarize(a, [sub(0, 7, 10, false, "2026-10-11T01:00:00Z")]);
    expect(s1.status).toBe("doing"); expect(s1.doneCount).toBe(1); expect(s1.correct).toBe(7);
    const s2 = summarize(a, [
      sub(0, 7, 10, false, "2026-10-11T01:00:00Z"), sub(0, 3, 3, true, "2026-10-11T01:05:00Z"), sub(1, 10, 10, false, "2026-10-11T01:10:00Z"),
    ]);
    expect(s2.status).toBe("done");
    expect(s2.correct).toBe(17); expect(s2.answered).toBe(20); // 重做不计入首做
    expect(s2.items[0].retries.length).toBe(1);
    expect(s2.items[0].finalAllCorrect).toBe(true);
  });

});

// 2026-10-12:撤回按批、听算报加号可选
describe("作业系统 · 批次与加号", () => {
  it("H6 batchKey:同标题同时刻落库的为一批;报加号关闭时标签带「不报加」", async () => {
    const { batchKey, normalizeItem: norm, itemLabel: lbl } = await import("@/lib/homework");
    const t = "2026-10-12T01:00:00.123Z";
    expect(batchKey({ title: "A", createdAt: t })).toBe(batchKey({ title: "A", createdAt: t }));
    expect(batchKey({ title: "A", createdAt: t })).not.toBe(batchKey({ title: "B", createdAt: t }));
    expect(norm({ project: "listen" }).announcePlus).toBe(true);
    expect(lbl(norm({ project: "listen", announcePlus: false, n: 5 }))).toContain("不报加");
  });
});

// 2026-10-12 教练授权:只认管理员写的记录,同一账号取最后一条(授权/撤销)
describe("教练授权归纳", () => {
  it("H7 reduceGrants", async () => {
    const { reduceGrants } = await import("@/lib/coachAccess");
    const row = (user_id: string, mode: string, coachId: string, t: string) => ({ user_id, mode, created_at: t, meta: { coachId, label: coachId } });
    const admins = new Set(["admin1"]);
    const rows = [
      row("student", "grant", "student", "2026-10-12T00:00:00Z"),   // 自封,无效
      row("admin1", "grant", "fu", "2026-10-12T00:01:00Z"),
      row("admin1", "grant", "yu", "2026-10-12T00:02:00Z"),
      row("admin1", "revoke", "yu", "2026-10-12T00:03:00Z"),
    ];
    expect(reduceGrants(rows, admins).map((g) => g.coachId)).toEqual(["fu"]);
  });
});

// 2026-10-12 班级管理:登录名规则与内部邮箱映射
describe("班级管理", () => {
  it("H8 登录名:字母数字下划线 3–20 位,大小写归一;映射到 stu 域邮箱", async () => {
    const { isLoginName, loginToEmail, normalizeLogin } = await import("@/lib/classManage");
    expect(isLoginName("YuYong")).toBe(true);
    expect(isLoginName("2024001")).toBe(true);
    expect(isLoginName("ab")).toBe(false);
    expect(isLoginName("余勇")).toBe(false);
    expect(isLoginName("a@b")).toBe(false);
    expect(normalizeLogin(" YuYong ")).toBe("yuyong");
    expect(loginToEmail("YuYong")).toBe("yuyong@stu.superbrainlab.org");
  });
});

describe("教练配额", () => {
  it("H9 quota 记录:管理员追加席位计入,最新为准;非管理员无效", async () => {
    const { reduceGrants, BASE_SEATS } = await import("@/lib/coachAccess");
    expect(BASE_SEATS).toBe(10);
    const rows = [
      { user_id: "admin1", mode: "grant", created_at: "2026-10-12T00:00:00Z", meta: { coachId: "fu", label: "fu" } },
      { user_id: "admin1", mode: "quota", created_at: "2026-10-12T00:01:00Z", meta: { coachId: "fu", seats: 5 } },
      { user_id: "admin1", mode: "quota", created_at: "2026-10-12T00:02:00Z", meta: { coachId: "fu", seats: 20 } },
      { user_id: "fu", mode: "quota", created_at: "2026-10-12T00:03:00Z", meta: { coachId: "fu", seats: 999 } },
    ];
    const g = reduceGrants(rows, new Set(["admin1"]));
    expect(g).toHaveLength(1); expect(g[0].extraSeats).toBe(20);
  });
});

// 2026-10-26 布施:作业暂存 —— 做了一部分点暂存,下次点进去从下一题接着做
import { activeDraft, type HwDraft, type HwSubmission as HwSub } from "@/lib/homework";
describe("作业暂存", () => {
  const prob = { terms: [1, 2], signs: ["+", "+"] as ("+" | "-")[], answer: 3 };
  const res = (n: number) => Array.from({ length: n }, () => ({ terms: [1, 2], signs: ["+", "+"] as ("+" | "-")[], answer: 3, given: 3, correct: true, ms: 1000 }));
  const d = (createdAt: string, done: number, total = 30): HwDraft => ({ assignId: "A", itemIdx: 0, problems: Array(total).fill(prob), results: res(done), round: 0, createdAt });
  const sub = (createdAt: string): HwSub => ({ id: "s", assignId: "A", studentId: "u", itemIdx: 0, results: res(30), correct: 30, total: 30, ms: 1, retry: false, createdAt });
  it("取同一项最新的暂存;之后提交过就失效;做完的、没做的不算", () => {
    expect(activeDraft([d("2026-10-26T01:00:00Z", 10), d("2026-10-26T02:00:00Z", 20)], [], "A", 0)?.results.length).toBe(20);
    expect(activeDraft([d("2026-10-26T02:00:00Z", 20)], [sub("2026-10-26T03:00:00Z")], "A", 0)).toBeNull();
    expect(activeDraft([d("2026-10-26T04:00:00Z", 20)], [sub("2026-10-26T03:00:00Z")], "A", 0)?.results.length).toBe(20); // 交过一次后又开始新一轮暂存
    expect(activeDraft([d("2026-10-26T02:00:00Z", 30)], [], "A", 0)).toBeNull();
    expect(activeDraft([d("2026-10-26T02:00:00Z", 0)], [], "A", 0)).toBeNull();
    expect(activeDraft([d("2026-10-26T02:00:00Z", 20)], [], "A", 1)).toBeNull(); // 别的项不受影响
  });
});

// 2026-11-02 老师「学生做了作业,后台看不到」:记录再多也要取全
describe("教练端数据取全", () => {
  it("fetchAllRows 翻到最后一页,不停在 1000 行;读失败重试一次", async () => {
    const { fetchAllRows } = await import("@/lib/fetchAll");
    const total = 2350, rows = Array.from({ length: total }, (_, i) => i);
    let calls = 0, failed = false;
    const got = await fetchAllRows<number>(async (f, t) => {
      calls++;
      if (f === 1000 && !failed) { failed = true; return { data: null, error: new Error("net") }; }
      return { data: rows.slice(f, t + 1) };
    });
    expect(got).toEqual(rows);
    expect(calls).toBe(4); // 3 页 + 1 次重试
  });
  it("连续读失败:重试 3 次后标记 failed,页面才能提示老师", async () => {
    const { fetchAllRows, fetchHealth } = await import("@/lib/fetchAll");
    fetchHealth.failed = false;
    let calls = 0;
    const got = await fetchAllRows<number>(async () => { calls++; return { data: null, error: new Error("down") }; });
    expect(got).toEqual([]);
    expect(calls).toBe(3);
    expect(fetchHealth.failed).toBe(true);
    fetchHealth.failed = false;
  });
  it("正好整千行时再取一页确认结束", async () => {
    const { fetchAllRows } = await import("@/lib/fetchAll");
    const got = await fetchAllRows<number>(async (f, t) => ({ data: Array.from({ length: 2000 }, (_, i) => i).slice(f, t + 1) }));
    expect(got.length).toBe(2000);
  });
  it("forChunks 分批并发,结果不丢、顺序不变", async () => {
    const { forChunks } = await import("@/lib/fetchAll");
    const ids = Array.from({ length: 1022 }, (_, i) => `a${i}`);
    let running = 0, peak = 0, batches = 0;
    const got = await forChunks(ids, async (c) => { batches++; running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 1)); running--; return c; });
    expect(got).toEqual(ids);
    expect(batches).toBe(11);
    expect(peak).toBeLessThanOrEqual(6);
  });
  it("summarize 分组缓存后结果不变:首做 / 重做按时间,不串作业", () => {
    const a = { id: "a1", items: [{}, {}] } as unknown as HwAssignment, b = { id: "b1", items: [{}] } as unknown as HwAssignment;
    const sub = (assignId: string, itemIdx: number, retry: boolean, createdAt: string, correct: number): HwSubmission => ({ id: createdAt, assignId, studentId: "s", itemIdx, results: [], correct, total: 5, ms: 1000, retry, createdAt });
    const subs = [sub("a1", 0, true, "2026-11-02T10:00:00Z", 5), sub("b1", 0, false, "2026-11-02T09:30:00Z", 3), sub("a1", 0, false, "2026-11-02T09:00:00Z", 2)];
    const p = summarize(a, subs);
    expect(p.status).toBe("doing");
    expect(p.items[0].first?.correct).toBe(2);
    expect(p.items[0].retries.length).toBe(1);
    expect(p.items[0].finalAllCorrect).toBe(true);
    expect(summarize(b, subs).status).toBe("done");
    expect(summarize({ id: "none", items: [{}] } as unknown as HwAssignment, subs).status).toBe("todo");
  });
});
