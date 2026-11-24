// 试卷 PDF 导出(2026-10-26 付海东「Excel 在手机 WPS 上页码不对,也可以选择 PDF」)。
// 不依赖第三方库:按预览同一份版面模型(SheetSpec)把每页画到高分辨率 canvas,再把 JPEG 逐页装进一个最小 PDF。
// PDF 是「所见即所印」——页数、页边距、分页和预览完全一致,不受各家表格软件列宽算法影响。
import { paperGeom, sheetPages, type CellSpec, type RowSpec, type SheetSpec } from "@/lib/paper";
import { PAPER_FONTS, PLAIN_FONT } from "@/components/PaperPreview";

const S = 200 / 72; // 渲染分辨率:200 dpi(px / pt)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface PdfPage { sheet: SheetSpec; rows: RowSpec[]; qr?: HTMLImageElement | null }

/** 一页画到 canvas(与 PaperPreview 的 Page 组件同一套几何:页边距、缩放、单元格内边距 2pt、边框 0.75pt) */
function drawPage({ sheet, rows, qr }: PdfPage): HTMLCanvasElement {
  const P = paperGeom(sheet.paper);
  const cv = document.createElement("canvas");
  cv.width = Math.round(P.w * S); cv.height = Math.round(P.h * S);
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.scale(S, S);
  ctx.translate(P.mx, P.my);
  ctx.scale(sheet.scale, sheet.scale);
  ctx.textBaseline = "middle";
  const fontKind = sheet.font ?? "hand";
  let y = 0;
  for (const r of rows) {
    let x = 0;
    for (let c = 0; c < sheet.cols.length; ) {
      const cell = r.cells[c];
      const span = cell?.span ?? 1;
      const w = sum(sheet.cols.slice(c, c + span));
      if (cell) drawCell(ctx, cell, x, y, w, r.h, fontKind);
      x += w; c += span;
    }
    y += r.h;
  }
  const q = sheet.qr && qr ? sheet.qr : undefined;
  if (q && qr) {
    const left = sum(sheet.cols.slice(0, q.c)), top = sum(rows.slice(0, q.r).map((r) => r.h));
    const w = sum(sheet.cols.slice(q.c, q.c + q.cols)), h = sum(rows.slice(q.r, q.r + q.rows).map((r) => r.h));
    const side = Math.min(w, h) - 4;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, left + (w - side) / 2, top + (h - side) / 2, side, side);
  }
  return cv;
}

function drawCell(ctx: CanvasRenderingContext2D, cell: CellSpec, x: number, y: number, w: number, h: number, fontKind: "hand" | "hei") {
  const text = cell.v === "" || cell.v == null ? "" : String(cell.v);
  if (text) {
    ctx.save();
    ctx.beginPath(); ctx.rect(cell.dx ? x - w : x, y, cell.dx ? w * 3 : w, h); ctx.clip(); // 有 dx 的(乘除算式)允许左右越出格子
    const fam = cell.num ? PAPER_FONTS[fontKind] : PLAIN_FONT;
    ctx.font = `${cell.bold ? 700 : 400} ${cell.size}px ${fam}`; // 已在 pt 坐标系里,px 数值 = pt
    ctx.fillStyle = "#111";
    const ls = cell.num && fontKind === "hand" ? cell.size * 0.08 : 0; // 手写体字距 0.08em(同预览)
    const chars = [...text];
    let lsk = ls;
    let tw = chars.reduce((t, ch) => t + ctx.measureText(ch).width + ls, 0);
    // 兜底:万一比格子宽,整体(字号 + 字距)等比缩小到放得下 —— 宁可字小,不能裁掉数字
    const room = w - 4;
    if (!cell.dx && tw > room && tw > 0) { const k = room / tw; ctx.font = `${cell.bold ? 700 : 400} ${cell.size * k}px ${fam}`; lsk = ls * k; tw = chars.reduce((t, ch) => t + ctx.measureText(ch).width + lsk, 0); }
    const pad = 2;
    let tx = (cell.align === "left" ? x + pad : cell.align === "right" ? x + w - pad - tw : x + (w - tw) / 2) + (cell.dx ?? 0);
    const ty = y + h / 2;
    if (ls) for (const ch of chars) { ctx.fillText(ch, tx, ty); tx += ctx.measureText(ch).width + lsk; }
    else ctx.fillText(text, tx, ty);
    ctx.restore();
  }
  const b = cell.border ?? [];
  if (b.length) {
    ctx.save();
    ctx.strokeStyle = "#555"; ctx.lineWidth = 0.75;
    ctx.beginPath();
    if (b.includes("t")) { ctx.moveTo(x, y); ctx.lineTo(x + w, y); }
    if (b.includes("b")) { ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); }
    if (b.includes("l")) { ctx.moveTo(x, y); ctx.lineTo(x, y + h); }
    if (b.includes("r")) { ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + h); }
    ctx.stroke();
    ctx.restore();
  }
}

const loadImg = (src: string) => new Promise<HTMLImageElement>((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = src; });
const jpegBytes = (cv: HTMLCanvasElement) => new Promise<Uint8Array>((ok, bad) => cv.toBlob((b) => (b ? b.arrayBuffer().then((x) => ok(new Uint8Array(x)), bad) : bad(new Error("canvas 导出失败"))), "image/jpeg", 0.9));

/** 把若干张表(每张可多页)导出成 PDF。qrs[i] = 第 i 张表第一页的二维码(dataURL),没有就不画 */
export async function sheetsToPdf(sheets: { sheet: SheetSpec; qr?: string }[]): Promise<Blob> {
  // 手写体数字要等字体载入,否则 canvas 用回退字体画
  try { await Promise.race([document.fonts.load("16px 'ZHKJ Number'"), new Promise((r) => setTimeout(r, 3000))]); } catch { /* 用回退字体 */ }
  const pages: { w: number; h: number; pw: number; ph: number; jpg: Uint8Array }[] = [];
  for (const { sheet, qr } of sheets) {
    const qrImg = qr ? await loadImg(qr) : null;
    const P = paperGeom(sheet.paper);
    const list = sheetPages(sheet);
    for (let i = 0; i < list.length; i++) {
      const cv = drawPage({ sheet, rows: list[i], qr: i === 0 ? qrImg : null });
      pages.push({ w: P.w, h: P.h, pw: cv.width, ph: cv.height, jpg: await jpegBytes(cv) });
      await new Promise((r) => setTimeout(r, 0)); // 让出主线程,页面不卡
    }
  }
  return new Blob([buildPdf(pages)], { type: "application/pdf" });
}

/** 最小 PDF:每页一张满版 JPEG(DCTDecode) */
export function buildPdf(pages: { w: number; h: number; pw: number; ph: number; jpg: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const put = (x: string | Uint8Array) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n: number, body: () => void) => { offsets[n] = len; put(`${n} 0 obj\n`); body(); put("\nendobj\n"); };
  put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const N = pages.length;
  const pageId = (i: number) => 3 + i * 3, contId = (i: number) => 4 + i * 3, imgId = (i: number) => 5 + i * 3;
  obj(1, () => put("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => put(`<< /Type /Pages /Count ${N} /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] >>`));
  pages.forEach((p, i) => {
    obj(pageId(i), () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.w.toFixed(2)} ${p.h.toFixed(2)}] /Resources << /XObject << /Im0 ${imgId(i)} 0 R >> >> /Contents ${contId(i)} 0 R >>`));
    const cs = `q ${p.w.toFixed(2)} 0 0 ${p.h.toFixed(2)} 0 0 cm /Im0 Do Q`;
    obj(contId(i), () => { put(`<< /Length ${cs.length} >>\nstream\n`); put(cs); put("\nendstream"); });
    obj(imgId(i), () => {
      put(`<< /Type /XObject /Subtype /Image /Width ${p.pw} /Height ${p.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`);
      put(p.jpg); put("\nendstream");
    });
  });
  const total = 2 + N * 3;
  const xref = len;
  put(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= total; n++) put(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  put(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let o = 0;
  for (const b of parts) { out.set(b, o); o += b.length; }
  return out;
}
