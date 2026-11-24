// 听算词块库(2026-09-21):切词必须与 numberToCN 输出无损对齐 —— 拼回=原串,任何数都不掉字。
import { describe, it, expect } from "vitest";
import { TOKENS, BIG_TOKENS, tokenizeCN, numberTokens, tierFor, BANK_TIERS, voicePlaybackRate } from "@/lib/ttsBank";
import { numberToCN } from "@/lib/abacus";

describe("听算词块库", () => {
  it("T1 词块表 134 个,与生成脚本 gen-bank2.mjs 契约一致", () => {
    expect(TOKENS.length).toBe(134);
    expect(TOKENS[0]).toBe("零");
    expect(TOKENS[10]).toBe("十");
    expect(TOKENS[20]).toBe("一十");
    expect(TOKENS[30]).toBe("二十");
    expect(TOKENS[109]).toBe("九十九");
    expect(TOKENS[110]).toBe("一百");
    expect(TOKENS.slice(-6)).toEqual(["万", "亿", "加", "减", "乘以", "除以"]);
    expect(tokenizeCN("三百五十六", "D")).toEqual(["三百", "五十六"]);
    expect(tokenizeCN("一百一十五", "D")).toEqual(["一百", "一十五"]);
    expect(tokenizeCN("二千零五", "D")).toEqual(["二千", "零", "五"]);
  });

  it("T2 整读切词:0-99999 全量 + 关键大数,拼回恒等于 numberToCN 原串", () => {
    const check = (n: number) => {
      const s = numberToCN(n);
      for (const v of ["D", "E"] as const) {
        const t = tokenizeCN(s, v);
        expect(t, `${v} ${n} → ${s}`).not.toBeNull();
        expect(t!.join(""), `${v} ${n}`).toBe(s);
      }
    };
    for (let n = 0; n <= 99999; n++) check(n);
    for (const n of [100200, 999999, 1000000, 10000001, 123456789, 900000009]) check(n);
  }, 30000); // 10 万个数全量,机器忙时 5s 默认超时不够

  it("T5 E 版大词块 1124 个,与 gen-bank6.mjs bigTokens() 契约一致;长数只在千/万交界处接", () => {
    expect(BIG_TOKENS.length).toBe(1124);
    expect(new Set(BIG_TOKENS).size).toBe(1124);
    expect(BIG_TOKENS[0]).toBe("零");
    expect(BIG_TOKENS[10]).toBe("十");
    expect(BIG_TOKENS[115]).toBe("一百一十五");
    expect(BIG_TOKENS[999]).toBe("九百九十九");
    expect(BIG_TOKENS[1000]).toBe("零一");
    expect(BIG_TOKENS[1014]).toBe("零一十五");
    expect(BIG_TOKENS[1098]).toBe("零九十九");
    expect(BIG_TOKENS[1099]).toBe("一千");
    expect(BIG_TOKENS[1108]).toBe("一万");
    expect(BIG_TOKENS.slice(-7)).toEqual(["万", "亿", "加", "减", "乘以", "除以", "点"]);
    expect(numberTokens(1.25, true)).toEqual(["一", "点", "二", "五"]);
    expect(numberTokens(0.0125, true)).toEqual(["零", "点", "零", "一", "二", "五"]);
    expect(tokenizeCN(numberToCN(356), "E")).toEqual(["三百五十六"]);
    expect(tokenizeCN(numberToCN(7305), "E")).toEqual(["七千", "三百零五"]);
    expect(tokenizeCN(numberToCN(7015), "E")).toEqual(["七千", "零一十五"]);
    expect(tokenizeCN(numberToCN(10015), "E")).toEqual(["一万", "零一十五"]);
    expect(tokenizeCN(numberToCN(100005), "E")).toEqual(["十", "万", "零五"]);
    expect(tokenizeCN(numberToCN(12345678), "E")).toEqual(["一千", "二百三十四", "万", "五千", "六百七十八"]);
    expect(numberToCN(10015)).toBe("一万零一十五"); // 跨组补零
    expect(voicePlaybackRate("child", "C")).toBe(1.25);
    expect(voicePlaybackRate("child", "E")).toBe(1);
    expect(voicePlaybackRate("female", "C")).toBe(1);
  });

  it("T3 逐位读:每位一个单字词块", () => {
    expect(numberTokens(305, false)).toEqual(["三", "零", "五"]);
    expect(numberTokens(7, false)).toEqual(["七"]);
  });

  it("T4 速度档:就近取档,档表与 gen-tiers.sh 目录契约一致", () => {
    expect([...BANK_TIERS]).toEqual([0.7, 0.85, 1, 1.35, 1.7, 2.1, 2.6]);
    expect(tierFor(1.0)).toBe(1);    // 速度5(1.0)
    expect(tierFor(0.6)).toBe(0.7);  // 速度1 → 最慢档
    expect(tierFor(1.6)).toBe(1.7);  // 速度6
    expect(tierFor(2.2)).toBe(2.1);  // 速度7
    expect(tierFor(2.8)).toBe(2.6);  // 速度8
    expect(tierFor(3.4)).toBe(2.6);  // 速度9 → 封顶 2.6,余下靠间隔
    expect(tierFor(4.0)).toBe(2.6);  // 速度10
  });
});

// 2026-10-24 尾音:每个数的最后一块额外载入带自然尾音的 fNNNN 版(键名 词块+#),运算词/点不带
import { termBankTokens, FINAL_MARK } from "@/lib/ttsBank";
describe("数末词块", () => {
  it("每个数末块加 # 版,运算词不加", () => {
    const out = termBankTokens([["三十五"], ["加", "二十一"], ["减", "二千", "三百四十五"], ["乘以", "九"]]);
    expect(out).toEqual(expect.arrayContaining(["三十五", "加", "二十一", "二千", "三百四十五", "九", "三十五" + FINAL_MARK, "二十一" + FINAL_MARK, "三百四十五" + FINAL_MARK, "九" + FINAL_MARK]));
    expect(out).not.toContain("二千" + FINAL_MARK); // 数中间的块不用尾音版
    expect(out).not.toContain("加" + FINAL_MARK);
  });
});

import { listenSpeedFactor, tierFor as tierFor2 } from "@/lib/ttsBank";
describe("听算速度档曲线", () => {
  it("2026-10-24 整体提速 15%:每档都比原来快;5→10 每档倍率一致;6–8 落在不同的词块档", () => {
    const before = [0.6, 0.7, 0.8, 0.9, 1.0, 1.32, 1.74, 2.30, 3.03, 4.0];
    for (let l = 1; l <= 10; l++) expect(listenSpeedFactor(l)).toBeGreaterThan(before[l - 1] * 1.1);
    expect(listenSpeedFactor(5)).toBeCloseTo(1.15, 9);
    expect(listenSpeedFactor(10)).toBeCloseTo(4.6, 9);
    const r = [5, 6, 7, 8, 9].map((l) => listenSpeedFactor(l + 1) / listenSpeedFactor(l));
    for (const x of r) expect(x).toBeCloseTo(r[0], 9);
    expect([6, 7, 8].map((l) => tierFor2(listenSpeedFactor(l)))).toEqual([1.7, 2.1, 2.6]);
  });
});

