// 2026-11-02 指法教学 · 例题讲解:话术按用户整理的八类话术;每一步拨珠合法、结果等于算术答案
import { describe, it, expect } from "vitest";
import { buildLesson, lessonScript, parseExpr, beadsOf, type Lesson } from "@/lib/fingerTeach";

const L = (s: string) => { const l = buildLesson(s); if ("error" in l) throw new Error(l.error); return l as Lesson; };

describe("指法教学 · 例题讲解", () => {
  it("用户话术逐字对照(八类)", () => {
    const want: Record<string, string> = {
      "2+7": "2加7等于，右手拇指拨入2，加7，右手拇指和食指同时拨入7，答案等于9",
      "9-6": "9减6等于，右手拇指和食指同时拨入9，减6，右手拇指和食指同时减6，答案等于3",
      "3+4": "3加4等于，右手拇指拨入3，加4，下珠不够加，找4的补数6，右手拇指和食指同时双下补数6，答案等于7",
      "7-3": "7减3等于，右手拇指和食指同时拨入7，减3，下珠不够减，找3的补数7，右手拇指和食指同时双上补数7，答案等于4",
      "3+9": "3加9等于，右手拇指拨入3，加9，本档不够加，找9的补数1，右手食指拨去1的同时，左手拇指进1，答案等于12",
      "12-4": "12减4等于，右手拨入12，减4，本档不够减，找4的补数6，右手加6，同时左手在十位档借1，答案等于8",
      "5+6": "5加6等于，右手拨入5，加6，本档不够加，且不能减补进1，加几就上几进1，右手拇指和食指双上6，同时左手在十位档进一，答案等于11",
      "12-6": "12减6等于，右手拨入12，减6，本档不够减，且不能借1加补，减几就下几借1，右手拇指和食指双下6，同时左手在十位档借1，答案等于6",
    };
    for (const [e, t] of Object.entries(want)) expect(lessonScript(L(e)), e).toBe(t);
  });
  it("2+7(直加)动作:拇指食指双合", () => {
    expect(L("2+7").steps[1].actions[0]).toMatchObject({ move: "双合", finger: "both", upper: "down", lower: 2 });
  });
  it("用户示范 3+4(满五加):双下补数,双下 4 的补数 1,答案 7", () => {
    const l = L("3+4");
    expect(l.steps[1].cls).toBe("满五加");
    expect(l.steps[1].say).toBe("加4，下珠不够加，找4的补数6，右手拇指和食指同时双下补数6");
    expect(l.steps[1].actions[0]).toMatchObject({ move: "双下", upper: "down", lower: -1, before: 3, after: 7 });
    expect(lessonScript(l)).toContain("答案等于7");
  });
  it("教材各类例题:判类正确、答案正确", () => {
    const cases: [string, string, number][] = [
      ["9-5", "直减", 4], ["5-4", "破五减", 1], ["1+9", "进位加", 10], ["5+9", "破五进位加", 14],
      ["10-9", "退位减", 1], ["14-9", "退位满五减", 5], ["12-6", "退位满五减", 6], ["10-6", "退位减", 4],
    ];
    for (const [s, cls, ans] of cases) {
      const l = L(s);
      expect(l.steps[1].cls, s).toBe(cls);
      expect(l.answer, s).toBe(ans);
    }
  });
  it("多位数从高位到低位(教材 55+89:先 +80 再 +9),带档位名", () => {
    const l = L("55+89");
    expect(l.steps.map((s) => s.label)).toEqual(["55", "+80", "+9"]);
    expect(l.steps[1].say.startsWith("加89，十位上，")).toBe(true);
    expect(l.steps[2].say.startsWith("个位上，")).toBe(true);
    expect(l.answer).toBe(144);
    expect(l.rods).toBe(3);
  });
  it("连续进位 / 连续退位 / 满五十加", () => {
    expect(L("99+1").answer).toBe(100);
    expect(L("99+1").steps[1].say).toContain("十位档不够，再向百位档进1");
    expect(L("100-1").answer).toBe(99);
    expect(L("100-1").steps[1].say).toContain("十位档不够，再向百位档借1");
    expect(L("45+5").answer).toBe(50); // 个位进位,十位 4+1 满五加 = 满五十加
  });
  it("随机 3000 题:每个动作珠子合法(上珠 0/1、下珠 0–4),逐档变化与说明一致,最终等于答案", () => {
    for (let n = 0; n < 3000; n++) {
      const k = 2 + Math.floor(Math.random() * 3);
      const terms: number[] = []; let run = 0;
      for (let i = 0; i < k; i++) {
        const mag = Math.floor(Math.random() * (i === 0 ? 999 : 400)) + 1;
        const t = i > 0 && Math.random() < 0.4 && run - mag >= 0 ? -mag : mag;
        terms.push(t); run += t;
      }
      const s = terms.map((t, i) => (i === 0 ? `${t}` : t > 0 ? `+${t}` : `${t}`)).join("");
      const l = L(s);
      const rods = Array(l.rods).fill(0);
      for (const st of l.steps) for (const a of st.actions) {
        expect(rods[a.rod], s).toBe(a.before);
        const b0 = beadsOf(a.before), b1 = beadsOf(a.after);
        expect(b1.lower >= 0 && b1.lower <= 4 && (b1.upper === 0 || b1.upper === 1), s).toBe(true);
        expect(b0.upper + (a.upper === "down" ? 1 : a.upper === "up" ? -1 : 0), `${s} 上珠`).toBe(b1.upper);
        expect(b0.lower + (a.lower ?? 0), `${s} 下珠`).toBe(b1.lower);
        rods[a.rod] = a.after;
      }
      expect(rods.reduceRight((v, d) => v * 10 + d, 0), s).toBe(l.answer);
    }
  });
  it("不进位不退位全部右手;进位 / 退位时前一档用左手", () => {
    for (const s of ["2+7", "3+4", "9-5", "5-4", "23+34", "78-26"]) {
      for (const st of L(s).steps) for (const a of st.actions) expect(a.hand, s).toBe("right");
      expect(L(s).steps.map((x) => x.say).join(), s).not.toContain("左手");
    }
    const c = L("8+5");
    expect(c.steps[1].actions.map((a) => [a.rod, a.hand])).toEqual([[0, "right"], [1, "left"]]);
    expect(c.steps[1].say).toContain("左手拇指进1");
    const b = L("12-6");
    expect(b.steps[1].actions.map((a) => [a.rod, a.hand])).toEqual([[0, "right"], [1, "left"]]);
    expect(b.steps[1].say).toContain("同时左手在十位档借1");
    expect(L("45+5").steps[1].actions.map((a) => a.hand)).toEqual(["right", "left"]); // 满五十加:前一档左手
  });
  it("两位数先讲十位档、再讲个位档,各讲各的(23+34:十位 2+3 满五加、个位 3+4 满五加)", () => {
    const l = L("23+34");
    expect(l.steps.map((s) => s.label)).toEqual(["23", "+30", "+4"]);
    expect(l.steps[1].say).toBe("加34，十位上，下珠不够加，找3的补数7，右手拇指和食指同时双下补数7");
    expect(l.steps[2].say).toBe("个位上，下珠不够加，找4的补数6，右手拇指和食指同时双下补数6");
    expect(l.answer).toBe(57);
  });
  it("输入校验", () => {
    expect("error" in parseExpr("")).toBe(true);
    expect("error" in parseExpr("3×4")).toBe(true);
    expect("error" in parseExpr("3-5")).toBe(true);
    expect(parseExpr(" 45 ＋ 38 ")).toEqual({ terms: [45, 38] });
    expect(parseExpr("12－6=")).toEqual({ terms: [12, -6] });
  });
});
