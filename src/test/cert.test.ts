// 等级鉴定 v2 回归:官方等级表(日本フラッシュ暗算検定)/出题规则/建议。
import { describe, it, expect } from "vitest";
import {
  CERT_LEVELS, CERT_PASS, CERT_SEMI, levelById, nextLevel, strokeMs, bestBadge,
  genCertProblem, certAdvice,
} from "@/lib/cert";

describe("等级鉴定(官方标准)", () => {
  it("C1 等级表:40 级,关键行逐一对照官方問題レベル一覧", () => {
    expect(CERT_LEVELS.length).toBe(40);
    expect(CERT_LEVELS.map((l) => l.rank)).toEqual(Array.from({ length: 40 }, (_, i) => i));
    const chk = (id: string, digits: number, count: number, timeSec: number | null, rule: string, title?: string) => {
      const l = levelById(id)!;
      expect([l.digits, l.count, l.timeSec, l.rule, l.title], id).toEqual([digits, count, timeSec, rule, title]);
    };
    chk("k20", 1, 3, null, "image");
    chk("k18", 1, 5, null, "image");
    chk("k13", 1, 20, 15, "nocarry");
    chk("k12", 2, 10, 10, "tens");
    chk("k11", 2, 15, 15, "zorome");
    chk("k10", 2, 2, 4, "normal");
    chk("k1", 2, 15, 13, "normal");
    chk("d1", 2, 15, 10, "normal");
    chk("d5", 3, 10, 7, "normal");
    chk("d10", 3, 15, 3, "normal");
    chk("d11", 3, 15, 2.8, "normal", "Bronze");
    chk("d20", 3, 15, 1.5, "normal", "Grand Master");
    // 二十段:每口仅 0.1 秒
    expect(strokeMs(levelById("d20")!)).toBe(100);
    expect(levelById("d10")!.label).toBe("十段");
    expect(levelById("d1")!.label).toBe("初段");
  });

  it("C2 出题:纯加法,位数/口数合规;特殊规则各守其约", () => {
    for (const id of ["k10", "k1", "d5", "d20"]) {
      const l = levelById(id)!;
      for (let i = 0; i < 20; i++) {
        const p = genCertProblem(l);
        expect(p.terms.length, id).toBe(l.count);
        expect(p.signs.every((s) => s === "+"), id).toBe(true);
        for (const t of p.terms) expect(String(t).length, `${id} 位数`).toBe(l.digits);
        expect(p.answer).toBe(p.terms.reduce((a, b) => a + b, 0));
      }
    }
    // image(20级):数字 1-9、总和 ≤9(严格不进位)
    for (let i = 0; i < 50; i++) {
      const p = genCertProblem(levelById("k20")!);
      expect(p.terms.every((t) => t >= 1 && t <= 9)).toBe(true);
      expect(p.answer).toBeLessThanOrEqual(9);
    }
    // tens(12级):全整十
    for (let i = 0; i < 30; i++) {
      const p = genCertProblem(levelById("k12")!);
      expect(p.terms.every((t) => t % 10 === 0 && t >= 10 && t <= 90)).toBe(true);
    }
    // zorome(11级):全叠数
    for (let i = 0; i < 30; i++) {
      const p = genCertProblem(levelById("k11")!);
      expect(p.terms.every((t) => t % 11 === 0 && t >= 11 && t <= 99)).toBe(true);
    }
    // nocarry(13级,20口):进位次数极少(仅个位顶死时的小步),粗验 ≤5 次
    for (let i = 0; i < 20; i++) {
      const p = genCertProblem(levelById("k13")!);
      let T = 0, carries = 0;
      for (const t of p.terms) { if ((T % 10) + t > 9) carries += 1; T += t; }
      expect(carries).toBeLessThanOrEqual(5);
    }
  });

  it("C3 徽章=通过里 rank 最高;nextLevel 顺序正确", () => {
    expect(bestBadge(new Set())).toBeNull();
    expect(bestBadge(new Set(["k20", "k13", "d2"]))!.id).toBe("d2");
    expect(nextLevel(levelById("k11")!)!.id).toBe("k10"); // 11级 → 10级(官方顺序)
    expect(nextLevel(levelById("k1")!)!.id).toBe("d1");   // 1级 → 初段
    expect(nextLevel(levelById("d20")!)).toBeUndefined();
  });

  it("C4 建议:50-60分准合格;差得多→退一级(更容易,绝不更难);合格给下一级;二十段封顶", () => {
    const l = levelById("d5")!;
    expect(certAdvice(l, CERT_SEMI, 4000, false).title).toContain("准合格");
    const fail = certAdvice(l, 3, 4000, false);
    expect(fail.suggestLevelId).toBe("d4");            // 五段没过 → 指向四段(时间更长)
    expect(fail.trainSpeedMs).toBe(strokeMs(levelById("d4")!)); // 训练参数也按更容易的一级
    expect(fail.trainDigits).toBe(3);
    expect(certAdvice(levelById("k20")!, 2, 4000, false).suggestLevelId).toBeUndefined(); // 最低档无更低
    const pass = certAdvice(l, CERT_PASS + 1, 4000, true);
    expect(pass.title).toContain("六段");
    expect(certAdvice(levelById("d20")!, 10, 4000, true).title).toContain("Grand Master");
  });
});

// C5 年龄组(2026-09-19):边界归组正确;组外不可选由 UI 置灰保证,这里锁分组函数
describe("C5 年龄组", () => {
  it("边界归组:6/7、9/10、12/13、17/18", async () => {
    const { groupForAge, AGE_GROUPS } = await import("@/lib/cert");
    expect(AGE_GROUPS.length).toBe(5);
    expect(groupForAge(3).id).toBe("kid");
    expect(groupForAge(6).id).toBe("kid");
    expect(groupForAge(7).id).toBe("child_a");
    expect(groupForAge(9).id).toBe("child_a");
    expect(groupForAge(10).id).toBe("child_b");
    expect(groupForAge(12).id).toBe("child_b");
    expect(groupForAge(13).id).toBe("youth");
    expect(groupForAge(17).id).toBe("youth");
    expect(groupForAge(18).id).toBe("adult");
    expect(groupForAge(60).id).toBe("adult");
  });
});
