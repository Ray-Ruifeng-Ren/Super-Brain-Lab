// 打印试题预览(2026-10-25 用户:点「打印试题」先出 A4 预览,下方「确认下载 / 取消」;题量、字号可直接改,预览实时更新)
// 预览和 Excel 用同一份版面模型(lib/paper.ts paperSheets):列宽、行高、分页、缩放一致,所见即所印。
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw } from "lucide-react";
import { Num } from "@/components/HwItemEditor";
import { genProblem, type HwItem, type HwProblem } from "@/lib/homework";
import { prepareSaveDir } from "@/lib/saveDir";
import { A4, KEY_ORIGIN, paperGeom, buildPaperXlsx, defaultFontPt, deliverFile, paperSheets, paperTitle, qrDataUrl, savePaperKey, sheetPages, type CellSpec, type RowSpec, type SheetSpec } from "@/lib/paper";
import { toast } from "@/hooks/use-toast";
import { useTx } from "@/lib/tx";

export const PT_PX = 96 / 72; // CSS:1pt = 1.333px
/** 卷面字体(手写体 = 站内题面数字字体 ZHKJ Number,中文回退苹方/微软雅黑) */
/** 标题/表头/题号:普通黑体字(同官方卷面) */
export const PLAIN_FONT = "'PingFang SC', 'Microsoft YaHei', 'Heiti SC', Arial, sans-serif";
export const PAPER_FONTS: Record<"hand" | "hei", string> = {
  hand: "'ZHKJ Number', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  hei: "'Heiti SC', 'SimHei', 'Microsoft YaHei', 'PingFang SC', sans-serif",
};
const sumW = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function Page({ sheet, rows, first, qr, fit }: { sheet: SheetSpec; rows: RowSpec[]; first: boolean; qr: string; fit: number }) {
  const total = sumW(sheet.cols);
  const border = (c: CellSpec) => {
    const s = "0.75pt solid #555";
    const e = c.border ?? [];
    return { borderTop: e.includes("t") ? s : undefined, borderBottom: e.includes("b") ? s : undefined, borderLeft: e.includes("l") ? s : undefined, borderRight: e.includes("r") ? s : undefined };
  };
  const q = first ? sheet.qr : undefined;
  const P = paperGeom(sheet.paper);
  const qBox = q && (() => {
    const left = sumW(sheet.cols.slice(0, q.c)), top = sumW(rows.slice(0, q.r).map((r) => r.h));
    const w = sumW(sheet.cols.slice(q.c, q.c + q.cols)), h = sumW(rows.slice(q.r, q.r + q.rows).map((r) => r.h));
    const side = Math.min(w, h) - 4;
    return { left: left + (w - side) / 2, top: top + (h - side) / 2, side };
  })();
  return (
    // 外层按容器宽度缩放整页(fit),里层按 Excel 打印缩放(sheet.scale)
    <div style={{ width: P.w * PT_PX * fit, height: P.h * PT_PX * fit }} className="mx-auto shrink-0 overflow-hidden bg-white shadow-[0_2px_14px_rgba(0,0,0,0.18)]">
      <div style={{ width: `${P.w}pt`, height: `${P.h}pt`, padding: `${P.my}pt ${P.mx}pt`, transform: `scale(${fit})`, transformOrigin: "top left" }}>
        <div style={{ width: `${total}pt`, transform: `scale(${sheet.scale})`, transformOrigin: "top left", position: "relative", fontFamily: PLAIN_FONT, color: "#111" }}>
          {rows.map((r, ri) => (
            <div key={ri} style={{ height: `${r.h}pt`, display: "flex" }}>
              {(() => {
                const out: JSX.Element[] = [];
                for (let c = 0; c < sheet.cols.length; ) {
                  const cell = r.cells[c];
                  const span = cell?.span ?? 1;
                  const w = sumW(sheet.cols.slice(c, c + span));
                  out.push(
                    <div key={c} style={{ width: `${w}pt`, height: `${r.h}pt`, flex: "none", display: "flex", alignItems: "center", justifyContent: cell?.align === "left" ? "flex-start" : cell?.align === "right" ? "flex-end" : "center", padding: "0 2pt", boxSizing: "border-box", whiteSpace: "nowrap", overflow: cell?.dx ? "visible" : "hidden", fontSize: cell ? `${cell.size}pt` : undefined, fontWeight: cell?.bold ? 700 : 400, ...(cell?.num ? { fontFamily: PAPER_FONTS[sheet.font ?? "hand"], letterSpacing: (sheet.font ?? "hand") === "hand" ? "0.08em" : undefined } : {}), ...(cell ? border(cell) : {}) }}>
                      {cell?.dx ? <span style={{ position: "relative", left: `${cell.dx}pt` }}>{cell.v}</span> : cell?.v}
                    </div>,
                  );
                  c += span;
                }
                return out;
              })()}
            </div>
          ))}
          {qBox && <img src={qr} alt="" style={{ position: "absolute", left: `${qBox.left}pt`, top: `${qBox.top}pt`, width: `${qBox.side}pt`, height: `${qBox.side}pt`, imageRendering: "pixelated" }} />}
        </div>
      </div>
    </div>
  );
}

export function PaperPreview({ item, open, onClose }: { item: HwItem; open: boolean; onClose: () => void }) {
  const tx = useTx();
  const [n, setN] = useState(item.n);
  const [fontPt, setFontPt] = useState(defaultFontPt(item));
  const [font, setFont] = useState<"hand" | "hei">(() => { try { return localStorage.getItem("exam:font") === "hei" ? "hei" : "hand"; } catch { return "hand"; } });
  const [pool, setPool] = useState<HwProblem[]>([]);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState("");
  const [showAns, setShowAns] = useState(false);
  // 每次打开按当前配置重置
  useEffect(() => {
    if (!open) return;
    setN(item.n); setFontPt(defaultFontPt(item)); setShowAns(false); setZoom(false);
    setPool(Array.from({ length: item.n }, () => genProblem(item)));
  }, [open, item]);
  // 题量加了就补题、减了就截(已出的题不变,预览不乱跳)
  useEffect(() => { if (open && pool.length < n) setPool((p) => [...p, ...Array.from({ length: n - p.length }, () => genProblem(item))]); }, [n, open, pool.length, item]);
  useEffect(() => { void qrDataUrl(`${KEY_ORIGIN}/key/preview`).then(setQr); }, []);
  const problems = useMemo(() => pool.slice(0, n), [pool, n]);
  const it = useMemo(() => ({ ...item, n }), [item, n]);
  const sheets = useMemo(() => (problems.length === n ? paperSheets(it, problems, { fontPt }).map((x) => ({ ...x, font })) : null), [it, problems, n, fontPt, font]);
  const sheet = sheets ? sheets[showAns ? 1 : 0] : null;
  const pages = sheet ? sheetPages(sheet) : [];

  // 预览区宽度 → 页面缩放。用回调 ref:弹窗每次打开都是新节点,要跟着它观察;刚挂上时宽度可能还是 0(开场动画),先用保守值
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!boxEl) return;
    const read = () => setBox({ w: boxEl.clientWidth, h: boxEl.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(boxEl); read();
    return () => ro.disconnect();
  }, [boxEl]);
  // 默认「整页」:一页 A4 完整放进预览区(宽高都不超),一眼看全局(2026-10-25 用户);多页时并排,放得下几页就排几页。
  // 「放大」:按宽度铺满,滚动看细节。
  const [zoom, setZoom] = useState(false);
  const pageW = A4.w * PT_PX, pageH = A4.h * PT_PX, PAD = 32;
  const fit = box.w > 120 && box.h > 120
    ? (zoom ? Math.min(1.4, (box.w - PAD) / pageW) : Math.min((box.w - PAD) / pageW, (box.h - PAD) / pageH))
    : 0.5;

  const confirm = async () => {
    if (busy || !sheets) return;
    const dir = await prepareSaveDir(); // 电脑版 Edge/Chrome:第一次选文件夹,之后直接保存不弹「另存为」
    setBusy(true);
    try {
      const url = await savePaperKey(it, problems);
      const { blob, filename } = await buildPaperXlsx(it, problems, url, { fontPt, font });
      if ((await deliverFile(blob, filename, dir)) === "dir") toast({ title: `${tx("已保存到")}「${dir!.name}」`, description: filename });
      onClose();
    } catch (e) {
      toast({ variant: "destructive", title: tx("生成失败"), description: String((e as Error)?.message ?? e) });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent className="flex h-[94dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="border-b px-4 py-3">
          <DialogTitle className="text-lg font-black">{tx("打印试题")} · {paperTitle(item)}</DialogTitle>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <div className="flex items-center gap-2"><span className="text-muted-foreground">{tx("题量")}</span><Num value={n} min={1} max={200} unit={tx("题")} onChange={setN} /></div>
            <div className="flex items-center gap-2"><span className="text-muted-foreground">{tx("字号")}</span><Num value={fontPt} min={9} max={28} unit="pt" onChange={setFontPt} /></div>
            <div className="flex overflow-hidden rounded-full border text-xs">
              {(["hand", "hei"] as const).map((k) => <button key={k} onClick={() => { setFont(k); try { localStorage.setItem("exam:font", k); } catch { /* noop */ } }} className={k === font ? "bg-foreground px-3 py-1 text-background" : "px-3 py-1"}>{tx(k === "hand" ? "手写体" : "黑体")}</button>)}
            </div>
            <button onClick={() => setPool(Array.from({ length: n }, () => genProblem(item)))} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" /> {tx("换一批题")}</button>
            <div className="flex overflow-hidden rounded-full border text-xs">
              <button onClick={() => setShowAns(false)} className={showAns ? "px-3 py-1" : "bg-foreground px-3 py-1 text-background"}>{tx("试题")}</button>
              <button onClick={() => setShowAns(true)} className={showAns ? "bg-foreground px-3 py-1 text-background" : "px-3 py-1"}>{tx("答案")}</button>
            </div>
            <button onClick={() => setZoom((z) => !z)} className="rounded-full border px-3 py-1 text-xs hover:bg-muted">{zoom ? tx("看整页") : tx("放大")}</button>
            <span className="text-xs text-muted-foreground">A4 · {pages.length} {tx("页")}{sheet && sheet.scale < 0.999 ? ` · ${tx("缩放")} ${Math.round(sheet.scale * 100)}%` : ""}</span>
          </div>
        </div>
        <div ref={setBoxEl} className="relative min-h-0 flex-1 overflow-auto bg-neutral-200">
          <div className={zoom ? "flex flex-col items-center gap-4 p-4" : "flex min-h-full flex-wrap content-center items-center justify-center gap-4 p-4"}>
            {sheet && pages.map((rows, pi) => <Page key={pi} sheet={sheet} rows={rows} first={pi === 0} qr={qr} fit={fit} />)}
          </div>
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-3">
          <span className="hidden text-xs text-muted-foreground sm:block">{tx("Excel 含试题和答案两张表;右上角二维码扫码看答案")}</span>
          <button onClick={onClose} disabled={busy} className="ml-auto rounded-full border px-5 py-2 text-sm font-bold hover:bg-muted disabled:opacity-50">{tx("取消下载")}</button>
          <button onClick={confirm} disabled={busy || !sheets} className="flex items-center gap-2 rounded-full bg-[#7a5520] px-6 py-2 text-sm font-black text-white hover:bg-[#6a4818] disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {tx("确认下载")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
