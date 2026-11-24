// 打印试题(2026-10-25):Excel 版式 + 答案(参考教练给的 乘法_2位乘3位 / 除法 / 加减算_3-3位10笔 .xls)
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { normalizeItem, genProblems } from "@/lib/homework";
import { buildPaperXlsx, paperTitle, paperSheets, sheetPages } from "@/lib/paper";

const OUT = process.env.PAPER_OUT; // 设了就把样张写出来人工看

async function roundTrip(item: ReturnType<typeof normalizeItem>, fontPt?: number) {
  const problems = genProblems(item);
  const { bytes, filename } = await buildPaperXlsx(item, problems, "https://superbrainlab.org/key/test", fontPt ? { fontPt } : undefined);
  const buf = Buffer.from(bytes as ArrayBuffer); // jsdom 的 Blob 读不出二进制,直接用 bytes
  if (OUT) (await import("node:fs")).writeFileSync(`${OUT}/${filename}`, buf);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return { wb, problems, filename, bytes };
}

describe("打印试题", () => {
  it("乘法 2位×3位 60 题:3 组 × 20 行,答案表与题目一一对应,右上角有二维码", async () => {
    const item = normalizeItem({ project: "glance", op: "mul", mulA: 2, mulB: 3, n: 60 });
    expect(paperTitle(item)).toBe("2位×3位乘算练习");
    const { wb, problems, filename } = await roundTrip(item);
    expect(filename).toMatch(/^2位×3位乘算练习_\d{12}\.xlsx$/);
    const [q, a] = wb.worksheets;
    expect(q.name).toBe("乘算题"); expect(a.name).toBe("乘算答案");
    expect(q.getCell(1, 1).value).toBe("2位×3位乘算练习");
    expect(q.getImages().length).toBe(1);
    // 第 21 题在第二组第一行(列 7..12),第 41 题在第三组
    expect(q.getCell(5, 7).value).toBe(21); expect(q.getCell(5, 13).value).toBe(41);
    expect(q.getCell(5, 2).value).toBe(problems[0].terms[0]); expect(q.getCell(5, 3).value).toBe("×");
    expect(q.getCell(5, 6).value ?? "").toBe(""); // 题目表答题格留空
    expect(a.getCell(2, 6).value).toBe(problems[0].answer);
    expect(a.getCell(2, 12).value).toBe(problems[20].answer);
  });
  it("除法不够除·无小数:答案写「商……余数」", async () => {
    const item = normalizeItem({ project: "glance", op: "div", divD: 1, divQ: 2, divEnough: "no", decimals: false, n: 12 });
    expect(paperTitle(item)).toContain("带余数");
    const { wb, problems } = await roundTrip(item);
    const a = wb.worksheets[1];
    expect(String(a.getCell(2, 6).value)).toBe(`${problems[0].answer}……${problems[0].rem}`);
    expect(wb.worksheets[0].getCell(5, 3).value).toBe("÷");
  });
  it("加减 3位10笔 16 题:每排 8 题竖式,减数带负号,答案表一一对应", async () => {
    const item = normalizeItem({ project: "glance", op: "addsub", digits: 3, digitsMax: 3, count: 10, includeSub: true, n: 16 });
    expect(paperTitle(item)).toBe("加减算 3-3位10笔");
    const { wb, problems } = await roundTrip(item);
    const [q, a] = wb.worksheets;
    expect(q.getImages().length).toBe(1);
    expect(q.getCell(4, 1).value).toBe("(1)"); expect(q.getCell(4, 8).value).toBe("(8)");
    for (let k = 0; k < 10; k++) {
      const p = problems[1];
      expect(q.getCell(5 + k, 2).value).toBe(p.signs[k] === "-" ? -p.terms[k] : p.terms[k]);
    }
    // 第二排从 (9) 开始:4 表头 + 10 行 + 答题格 + 空行 → 第 17 行
    expect(q.getCell(17, 1).value).toBe("(9)");
    expect(a.getCell(3, 1).value).toBe(problems[0].answer);
    expect(a.getCell(6, 1).value).toBe(problems[8].answer); // 答案表第二排
  });
  it("预览与 Excel 同一版面:字号调大 → 乘除改 2 组并分页(字真的变大、不整体缩小),Excel 里有对应分页符", async () => {
    const item = normalizeItem({ project: "glance", op: "mul", mulA: 2, mulB: 3, n: 60 });
    const ps = genProblems(item);
    const s14 = paperSheets(item, ps, { fontPt: 14 })[0], s20 = paperSheets(item, ps, { fontPt: 20 })[0];
    expect(s14.cols.length).toBe(18); expect(sheetPages(s14).length).toBe(1); expect(s14.scale).toBe(1);
    expect(s20.cols.length).toBe(12); expect(sheetPages(s20).length).toBeGreaterThan(1); expect(s20.scale).toBe(1);
    const { wb, bytes } = await roundTrip(item, 20);
    const q = wb.worksheets[0];
    expect(q.getCell(5, 13).value ?? null).toBe(null); // 只有 2 组(12 列)
    // exceljs 读回时不解析分页符,直接看 xml
    const JSZip = (await import("jszip")).default;
    const xml = await (await JSZip.loadAsync(bytes)).file("xl/worksheets/sheet1.xml")!.async("string");
    expect((xml.match(/<brk /g) ?? []).length).toBe(sheetPages(s20).length - 1);
    expect(xml).toMatch(/<pageSetup[^>]*scale="100"/);
    // 加减字号 24:每排少于 8 题
    const as = normalizeItem({ project: "glance", op: "addsub", digits: 3, digitsMax: 3, count: 10, n: 16 });
    expect(paperSheets(as, genProblems(as), { fontPt: 24 })[0].cols.length).toBeLessThan(8);
  });
});
