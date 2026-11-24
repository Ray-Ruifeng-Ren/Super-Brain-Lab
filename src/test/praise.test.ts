// 2026-11-08 鼓励语库:≥60 句、每句都有中英文语音文件;情境挑选(连对里程碑 / 错后马上对 / 秒答)、最近 8 句不重复
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pickPraise, pickFinish, PRAISE_TEXT } from "@/lib/praise";

describe("作答鼓励语库", () => {
  it("中英各 ≥60 句,键一致,每句都有 mp3", () => {
    const zh = Object.keys(PRAISE_TEXT.zh), en = Object.keys(PRAISE_TEXT.en);
    expect(zh.length).toBeGreaterThanOrEqual(60);
    expect(en.sort()).toEqual([...zh].sort());
    for (const lang of ["zh", "en"] as const) for (const k of zh) expect(existsSync(join(process.cwd(), "public", "praise", lang, `${k}.mp3`)), `${lang}/${k}`).toBe(true);
  });
  it("情境:里程碑、错后马上对、答错安慰;最近 8 句不重复", () => {
    pickPraise(true, 1);
    expect(["s3", "s3b"]).toContain(pickPraise(true, 3));
    expect(["s10", "s10b"]).toContain(pickPraise(true, 10));
    expect(pickPraise(false, 0)).toMatch(/^no\d+$/);
    expect(pickPraise(true, 1)).toMatch(/^b\d$/); // 上一题错 → 这题对
    const seq = Array.from({ length: 40 }, () => pickPraise(true, 1, 9999));
    for (let i = 8; i < seq.length; i++) expect(seq.slice(i - 8, i)).not.toContain(seq[i]);
    expect(["all", "all2"]).toContain(pickFinish(true));
  });
});
