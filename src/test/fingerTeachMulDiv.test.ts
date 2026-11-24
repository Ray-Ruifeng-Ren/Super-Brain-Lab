// 2026-11-08 指法教学 · 乘除法讲解:按付海东录屏(参考软件「空盘前乘法」「商除法」)的讲法逐句对照;用户「乘法不说首位有数,有进位 M+N、没有进位 M+N−1」
import { describe, it, expect } from "vitest";
import { buildLesson, type Lesson } from "@/lib/fingerTeach";

const L = (s: string) => { const l = buildLesson(s); if ("error" in l) throw new Error(l.error); return l as Lesson; };
const says = (s: string) => L(s).steps.map((x) => x.say);

describe("乘法讲解(空盘前乘法)", () => {
  it("356×4:4 与 356 逐位相乘,积占两档依次右移,有进位 → M+N", () => {
    expect(says("356×4")).toEqual([
      "4与356，逐位相乘，从算盘左边第一档起拨珠",
      "四三一二，从左边第一档起，拨入12",
      "四五二零，从左边第二档起，加上20",
      "四六二四，从左边第三档起，加上24",
      "有进位，积的位数是M加N，3加1等于4位",
    ]);
    expect(L("356×4").answer).toBe(1424);
  });
  it("43×2:口诀一位数不念零(二四得八),拨珠仍 0 要占位;没有进位 → M+N−1(不说「首位有数」)", () => {
    const s = says("43×2");
    expect(s[1]).toBe("二四得八，从左边第一档起，拨入08，0要占位");
    expect(s[2]).toBe("二三得六，从左边第二档起，加上06，0要占位");
    expect(s.at(-1)).toBe("没有进位，积的位数是M加N减1，2加1减1等于2位");
    expect(s.join("")).not.toMatch(/首位|得零[1-9一二三四五六七八九]/);
    expect(says("11×1")[1]).toBe("一一得一，从左边第一档起，拨入01，0要占位");
  });
  it("12×43:43 与 12 逐位相乘,四一 / 四二 / 三一 / 三二 依次从第 1 / 2 / 2 / 3 档起", () => {
    const s = says("12×43");
    expect(s[0]).toBe("43与12，逐位相乘，从算盘左边第一档起拨珠");
    expect(s.slice(1, 5)).toEqual(["四一得四，从左边第一档起，拨入04，0要占位", "四二得八，从左边第二档起，加上08，0要占位", "三一得三，从左边第二档起，加上03，0要占位", "三二得六，从左边第三档起，加上06，0要占位"]);
    expect(L("12×43").answer).toBe(516);
  });
  it("1–4 位 × 1–3 位 随机 400 题:算盘拨完读数 = 乘积", () => {
    for (let t = 0; t < 400; t++) {
      const a = 1 + Math.floor(Math.random() * 9999), b = 1 + Math.floor(Math.random() * 999);
      const l = buildLesson(`${a}×${b}`); expect("error" in l, `${a}×${b}`).toBe(false);
    }
  });
});

describe("除法讲解(商除法)", () => {
  it("48÷2:第三档起拨入,够除隔档置商,首商够除 → M−N+1", () => {
    expect(says("48÷2")).toEqual([
      "从左边第三档起，拨入48",
      "4除以2，够除，隔档置商2",
      "二二得四，从左边第二档起，减去04",
      "8除以2，够除，隔档置商4",
      "四二得八，从左边第三档起，减去08",
      "首商够除，商的位数是M减N加1，2减1加1等于2位",
    ]);
  });
  it("1344÷56:不够除挨着被除数立商,逐位相乘减积,首商不够除 → M−N", () => {
    expect(says("1344÷56")).toEqual([
      "从左边第三档起，拨入1344",
      "13除以56，不够除，用134除以56，挨着被除数立商2",
      "2与56，逐位相乘，二五一零，从左边第三档起，减去10",
      "二六一二，从左边第四档起，减去12",
      "22除以56，不够除，用224除以56，挨着被除数立商4",
      "4与56，逐位相乘，四五二零，从左边第四档起，减去20",
      "四六二四，从左边第五档起，减去24",
      "首商不够除，商的位数是M减N，4减2等于2位",
    ]);
    expect(L("1344÷56").answer).toBe(24);
  });
  it("48÷24(录屏):够除隔档置商2,二二得四从第二档、二四得八从第三档减", () => {
    const s = says("48÷24");
    expect(s[1]).toBe("48除以24，够除，隔档置商2");
    expect(s[2]).toBe("2与24，逐位相乘，二二得四，从左边第二档起，减去04");
    expect(s[3]).toBe("二四得八，从左边第三档起，减去08");
  });
  it("商中间有 0(408÷4 = 102)、末尾有 0(120÷4 = 30);随机整除 400 题都讲得通", () => {
    expect(L("408÷4").answer).toBe(102); expect(L("120÷4").answer).toBe(30);
    for (let t = 0; t < 400; t++) {
      const d = 2 + Math.floor(Math.random() * 98), q = 1 + Math.floor(Math.random() * 9999);
      const l = buildLesson(`${d * q}÷${d}`); expect("error" in l, `${d * q}÷${d}`).toBe(false);
    }
    expect("error" in buildLesson("49÷2")).toBe(true); // 有余数不讲
  });
});

describe("英文讲解(2026-11-08 用户「如果是英文的话,讲解也要全是英文」)", () => {
  const han = /[一-鿿]/;
  it("加减乘除各一题:每一步都是英文、没有中文字;答案与中文版相同", () => {
    for (const e of ["2+7", "55+89", "144-89", "356×4", "43×2", "1344÷56", "48÷2"]) {
      const en = buildLesson(e, "en"), zh = buildLesson(e);
      if ("error" in en || "error" in zh) throw new Error(e);
      expect(en.answer).toBe(zh.answer);
      expect(en.speakExpr).not.toMatch(han);
      for (const st of en.steps) { expect(st.say, `${e}: ${st.say}`).not.toMatch(han); expect(st.label).not.toMatch(han); }
      if (en.rule) expect(en.rule).not.toMatch(han);
    }
    expect((buildLesson("356×4", "en") as Lesson).steps.map((x) => x.say)[1]).toBe("4 times 3 is 12: from the 1st rod on the left, set 12");
    expect((buildLesson("43×2", "en") as Lesson).steps.at(-1)!.say).toBe("No carry, so the product has M plus N minus 1 digits: 2 plus 1 minus 1 is 2 digits");
  });
  it("报错也是英文;中文默认不受影响", () => {
    const r = buildLesson("49÷2", "en"); expect("error" in r && r.error).toMatch(/divides evenly/);
    const z = buildLesson("49÷2"); expect("error" in z && z.error).toMatch(/整除/);
  });
});
