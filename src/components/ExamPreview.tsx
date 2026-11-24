// 出题系统预览(2026-10-25):选题型 → A4 整页预览(套数 / 起始编号 / 全卷或单项 / 字号 / 换一批 / 试题⇄答案)→ 打印 或 下载 Excel。
// 版面与课堂演示的「打印试题」同一套模型(lib/paper SheetSpec),预览所见即打印所得;每套右上角二维码扫码看答案。
import { useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Printer, RefreshCw, Download, FileText } from "lucide-react";
import { Num } from "@/components/HwItemEditor";
import { Page, PT_PX } from "@/components/PaperPreview";
import { KEY_ORIGIN, PAPERS, onPaper, deliverFile, qrDataUrl, saveAnswerKey, sheetPages, sheetsToXlsx, type PaperFont, type PaperSize, type RowSpec, type SheetSpec } from "@/lib/paper";
import { genExam, type GenSection } from "@/lib/exam/generate";
import { examAnswerList, examSheets } from "@/lib/exam/layout";
import type { ExamSpec } from "@/lib/exam/specs";
import { toast } from "@/hooks/use-toast";
import { IS_NATIVE } from "@/lib/appEnv";
import { canPickDir, prepareSaveDir, savedDirName } from "@/lib/saveDir";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useTx } from "@/lib/tx";

type Only = "all" | "addsub" | "mul" | "div";
const ONLY_LABEL: Record<Only, string> = { all: "全卷", addsub: "加减算", mul: "乘算", div: "除算" }; // 也进卷面标题 / 文件名,保持中文;按钮显示走 tx
interface SetDoc { no: number; label: string; spec: ExamSpec; gen: GenSection[]; sheets: SheetSpec[] }

export function ExamPreview({ spec, onClose }: { spec: ExamSpec | null; onClose: () => void }) {
  const open = !!spec;
  const tx = useTx();
  const { lang } = useI18n();
  const T = (zh: string, en: string) => (lang === "en" ? en : zh);
  const [sets, setSets] = useState(1);
  const [startNo, setStartNo] = useState(1);
  const [only, setOnly] = useState<Only>("all");
  const [fontPt, setFontPt] = useState(12);
  const [dirName, setDirName] = useState<string | null>(null); // 电脑版 Edge/Chrome:PDF/Excel 直接存进的文件夹
  useEffect(() => { void savedDirName().then(setDirName); }, []);
  const [font, setFont] = useState<PaperFont>(() => { try { return localStorage.getItem("exam:font") === "hei" ? "hei" : "hand"; } catch { return "hand"; } });
  useEffect(() => { try { localStorage.setItem("exam:font", font); } catch { /* noop */ } }, [font]);
  // 纸张:默认 A4(2026-10-25 用户「默认 A4」),可切 B4(整页等比放大);不记忆,每次打开都从 A4 开始
  const [paper, setPaper] = useState<PaperSize>("A4");
  useEffect(() => { setPaper("A4"); }, [spec?.id]);
  const [seed, setSeed] = useState(0);
  const [showAns, setShowAns] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState<"" | "print" | "xlsx" | "pdf">("");
  const [qr, setQr] = useState("");
  useEffect(() => { if (open) { setSets(1); setStartNo(1); setOnly("all"); setShowAns(false); setZoom(false); setSeed((s) => s + 1); } }, [open, spec?.id]);
  useEffect(() => { void qrDataUrl(`${KEY_ORIGIN}/key/preview`).then(setQr); }, []);

  const kinds = useMemo(() => (spec ? [...new Set(spec.sections.map((s) => s.kind))] : []), [spec]);
  // 题目只在 套数/换一批/题型 变化时重出;字号、单项、编号只影响排版
  // 2026-10-26 付海东「鉴定乘除法单项一打开,一张只有 10 道题,改为一张有 2 套」+ 样卷(珠算普通四级 乘/除单项):
  // 鉴定卷的乘算 / 除算单项 → 每张纸排满 40 题(左 1–20、右 21–40,题号连续),由整套组成:珠心算每套 20 题 = 2 套/张,珠算每套 10 题 = 4 套/张。
  // 此时「张数」= 打几张;一张一个二维码
  const pairMode = !!spec && !spec.style && (only === "mul" || only === "div");
  const isTrain = !!spec && spec.id.startsWith("train");
  const perSet = useMemo(() => (spec && pairMode ? Math.max(1, genExam(spec).filter((g) => g.sec.kind === only).reduce((n, g) => n + g.problems.length, 0)) : 1), [spec, pairMode, only]);
  const setsPerPage = pairMode ? Math.max(1, Math.floor(40 / perSet)) : 1;
  const gens = useMemo(() => (spec ? Array.from({ length: sets * setsPerPage }, () => genExam(spec)) : []), [spec, sets, seed, setsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps
  const docs: SetDoc[] = useMemo(() => {
    if (!spec) return [];
    if (pairMode) {
      const out: SetDoc[] = [];
      for (let k = 0; k < sets; k++) {
        const no = startNo + k;
        const part = gens.slice(k * setsPerPage, (k + 1) * setsPerPage).flatMap((g) => g.filter((x) => x.sec.kind === only));
        if (!part.length) continue;
        // 几套合成一个部分:题号 1–40 连续,打乱顺序(同样卷,各种位数穿插)
        const problems = part.flatMap((g) => g.problems).map((p) => [Math.random(), p] as const).sort((x, y) => x[0] - y[0]).map(([, p]) => p);
        const gen: GenSection[] = [{ sec: { ...part[0].sec, newPage: false }, problems }];
        const label = `第${no}张`;
        const s2 = { ...spec, level: `${spec.level} · ${ONLY_LABEL[only]}单项 · ${label}`, title: `${spec.title}（${ONLY_LABEL[only]}单项）` };
        out.push({ no, label, spec: s2, gen, sheets: onPaper(examSheets(s2, gen, { fontPt, font, only }), paper) });
      }
      return out;
    }
    return gens.map((gen, k) => {
      const no = startNo + k;
      // 世界比赛样卷版式:标题带套号「…模拟题（1）」,单项不改标题(每张本来就只有一个部分)
      const waama = !!spec.style; // 世界 / 全国比赛逐张版式
      const unit = isTrain ? "张" : "套"; // 自定义出题:一张就是一套(题量自动排满一张),按「张」计
      const s2 = { ...spec, level: `${spec.level} · 第${no}${unit}`, title: only === "all" || waama ? spec.title : `${spec.title}（${ONLY_LABEL[only]}单项）` };
      return { no, label: `第${no}${unit}`, spec: s2, gen, sheets: onPaper(examSheets(s2, gen, { fontPt, font, only: only === "all" ? undefined : only, setNo: waama ? no : undefined }), paper) };
    });
  }, [spec, gens, startNo, only, fontPt, font, paper, pairMode, sets, setsPerPage]);
  const pages = docs.flatMap((d) => sheetPages(d.sheets[showAns ? 1 : 0]).map((rows, pi) => ({ sheet: d.sheets[showAns ? 1 : 0], rows, first: pi === 0, no: d.no, label: d.label })));

  // 预览区尺寸 → 整页缩放(默认整页一眼看全;「放大」按宽铺满)
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!boxEl) return;
    const read = () => setBox({ w: boxEl.clientWidth, h: boxEl.clientHeight });
    const ro = new ResizeObserver(read); ro.observe(boxEl); read();
    return () => ro.disconnect();
  }, [boxEl]);
  const pageW = PAPERS[paper].w * PT_PX, pageH = PAPERS[paper].h * PT_PX;
  const fit = box.w > 120 && box.h > 120 ? (zoom ? Math.min(1.4, (box.w - 32) / pageW) : Math.min((box.w - 32) / pageW, (box.h - 32) / pageH)) : 0.5;

  /** 每套存一份答案,拿到各自的扫码链接 */
  const saveKeys = async () => Promise.all(docs.map((d) => {
    const { labels, answers, exprs } = examAnswerList(d.gen, only === "all" ? undefined : only);
    return saveAnswerKey({ title: `${d.spec.title} · ${d.label}`, label: spec?.level ?? "", kind: "md", answers, exprs, labels });
  }));

  const doPrint = async () => {
    if (busy) return;
    // App 内 WKWebView 不支持 window.print → 生成 PDF 弹系统分享面板,面板里有「打印」(AirPrint)
    if (IS_NATIVE) { await doPdf(); return; }
    setBusy("print");
    try {
      const urls = await saveKeys();
      const qrs = await Promise.all(urls.map(qrDataUrl));
      // 打印:试题在前、答案在后(答案页单独成页,不想要可在打印对话框里选页)
      const all = docs.flatMap((d, k) => [0, 1].flatMap((si) => sheetPages(d.sheets[si]).map((rows, pi) => ({ sheet: d.sheets[si], rows, first: si === 0 && pi === 0, qr: qrs[k] }))));
      const html = renderToStaticMarkup(<>{all.map((p, i) => <div key={i} style={{ pageBreakAfter: "always" }}><Page sheet={p.sheet} rows={p.rows} first={p.first} qr={p.qr} fit={1} /></div>)}</>);
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument!;
      doc.open();
      const fontUrl = `${window.location.origin}/fonts/zhkj-number.ttf`;
      doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${spec?.title ?? "试题"}</title><style>@font-face{font-family:'ZHKJ Number';src:url('${fontUrl}') format('truetype');font-weight:400 700}@page{size:${PAPERS[paper].mm[0]}mm ${PAPERS[paper].mm[1]}mm;margin:0}html,body{margin:0;padding:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${html}</body></html>`);
      doc.close();
      // 手写体要等字体载完再打印,否则第一次打出来是默认字体
      try { await Promise.race([doc.fonts.load("16px 'ZHKJ Number'").then(() => doc.fonts.ready), new Promise((r) => setTimeout(r, 3000))]); } catch { /* 字体失败就用回退字体 */ }
      setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); setTimeout(() => iframe.remove(), 60_000); }, 200);
    } catch (e) {
      toast({ variant: "destructive", title: tx("打印失败"), description: String((e as Error)?.message ?? e) });
    } finally { setBusy(""); }
  };

  // 2026-10-26 付海东「Excel 在手机上页码不对,也可以选择 PDF」:PDF 与预览逐页一致(每套 = 试题页 + 答案页)
  const doPdf = async () => {
    if (busy || !spec) return;
    const dir = await prepareSaveDir(); // 要在点击手势里最先调用(第一次选文件夹,之后直接保存不弹窗)
    setBusy("pdf");
    try {
      const urls = await saveKeys();
      const qrs = await Promise.all(urls.map(qrDataUrl));
      const { sheetsToPdf } = await import("@/lib/pdfExport");
      const blob = await sheetsToPdf(docs.flatMap((d, k) => d.sheets.map((sheet, si) => ({ sheet, qr: si === 0 ? qrs[k] : undefined }))));
      const d = new Date(), p2 = (n: number) => String(n).padStart(2, "0");
      const filename = `${spec.title}${only === "all" ? "" : `_${ONLY_LABEL[only]}`}_${paper}_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}.pdf`.replace(/[\\/:*?"<>| ·]/g, "_");
      // 2026-10-27 付海东嫌弹窗多:浏览器下载 / App 分享时不再弹我们自己的提示(浏览器、系统已有);直接存进文件夹时给一句「存到哪了」
      if ((await deliverFile(blob, filename, dir)) === "dir") { toast({ title: T(`已保存到「${dir!.name}」文件夹`, `Saved to “${dir!.name}”`), description: filename }); void savedDirName().then(setDirName); }
    } catch (e) {
      toast({ variant: "destructive", title: tx("生成失败"), description: String((e as Error)?.message ?? e) });
    } finally { setBusy(""); }
  };

  const doXlsx = async () => {
    if (busy || !spec) return;
    const dir = await prepareSaveDir();
    setBusy("xlsx");
    try {
      const urls = await saveKeys();
      const sheets = docs.flatMap((d, k) => d.sheets.map((s, si) => ({ ...s, name: `${d.label}${si ? "答案" : "试题"}`, qr: s.qr ? { ...s.qr, url: urls[k] } : undefined })));
      const { blob, filename } = await sheetsToXlsx(sheets, urls[0], `${spec.title}${only === "all" ? "" : `_${ONLY_LABEL[only]}`}`);
      if ((await deliverFile(blob, filename, dir)) === "dir") { toast({ title: T(`已保存到「${dir!.name}」文件夹`, `Saved to “${dir!.name}”`), description: filename }); void savedDirName().then(setDirName); }
    } catch (e) {
      toast({ variant: "destructive", title: tx("生成失败"), description: String((e as Error)?.message ?? e) });
    } finally { setBusy(""); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent className="flex h-[94dvh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <div className="border-b px-4 py-3">
          <DialogTitle className="flex flex-wrap items-baseline gap-2 text-lg font-black">
            {spec?.title}
            {!!spec?.minutes && <span className="text-xs font-normal text-muted-foreground">{T(`限时 ${spec.minutes} 分钟`, `Time limit ${spec.minutes} min`)}</span>}
            {spec?.ref && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800" title={spec.ref}>{T("参考题型", "Reference format")} · {spec.ref}</span>}
          </DialogTitle>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-2"><span className="text-muted-foreground">{tx(pairMode || isTrain ? "张数" : "套数")}</span><Num value={sets} min={1} max={20} unit={pairMode || isTrain ? "张" : "套"} onChange={setSets} />{isTrain && (() => { const q = spec?.sections.reduce((n, sec) => n + (sec.kind === "addsub" ? sec.parts.reduce((m, p) => m + p.n, 0) : sec.groups.reduce((m, g) => m + g.combos.reduce((k, c) => k + c[2], 0), 0)), 0); return <span className="text-xs text-muted-foreground">{T(`每张 ${q} 题`, `${q} per sheet`)}</span>; })()}{pairMode && <span className="text-xs text-muted-foreground">{T(`每张 40 题（${setsPerPage} 套）`, `40 per sheet (${setsPerPage} sets)`)}</span>}</div>
            <div className="flex items-center gap-2"><span className="text-muted-foreground">{tx("起始编号")}</span><Num value={startNo} min={1} max={999} onChange={setStartNo} /></div>
            <div className="flex items-center gap-2"><span className="text-muted-foreground">{tx("字号")}</span><Num value={fontPt} min={9} max={22} unit="pt" onChange={setFontPt} /></div>
            <div className="flex overflow-hidden rounded-full border text-xs" title={tx("鉴定标准:正文字体采用国际通用的手写体或黑体")}>
              {(["hand", "hei"] as const).map((k) => <button key={k} onClick={() => setFont(k)} className={cn("px-3 py-1", font === k && "bg-foreground text-background")}>{tx(k === "hand" ? "手写体" : "黑体")}</button>)}
            </div>
            {kinds.length > 1 && (
              <div className="flex overflow-hidden rounded-full border text-xs">
                {(["all", ...kinds] as Only[]).map((k) => (
                  <button key={k} onClick={() => setOnly(k)} className={cn("px-3 py-1", only === k && "bg-foreground text-background")}>{tx(ONLY_LABEL[k])}</button>
                ))}
              </div>
            )}
            <button onClick={() => setSeed((s) => s + 1)} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" /> {tx("换一批")}</button>
            <div className="flex overflow-hidden rounded-full border text-xs">
              <button onClick={() => setShowAns(false)} className={cn("px-3 py-1", !showAns && "bg-foreground text-background")}>{tx("试题")}</button>
              <button onClick={() => setShowAns(true)} className={cn("px-3 py-1", showAns && "bg-foreground text-background")}>{tx("答案")}</button>
            </div>
            <div className="flex overflow-hidden rounded-full border text-xs" title={tx("版面按 A4 排,B4 整页等比放大")}>
              {(["A4", "B4"] as const).map((k) => <button key={k} onClick={() => setPaper(k)} className={cn("px-3 py-1", paper === k && "bg-foreground text-background")}>{T(`${k} 纸`, k)}</button>)}
            </div>
            <button onClick={() => setZoom((z) => !z)} className="rounded-full border px-3 py-1 text-xs hover:bg-muted">{tx(zoom ? "看整页" : "放大")}</button>
            <span className="text-xs text-muted-foreground">{paper} · {pages.length} {T("页", pages.length === 1 ? "page" : "pages")}</span>
          </div>
        </div>
        <div ref={setBoxEl} className="relative min-h-0 flex-1 overflow-auto bg-neutral-200">
          <div className={zoom ? "flex flex-col items-center gap-4 p-4" : "flex min-h-full flex-wrap content-start items-start justify-center gap-4 p-4"}>
            {pages.map((p, i) => (
              <div key={i} className="relative">
                {docs.length > 1 && p.first && <span className="absolute -top-0 left-1 z-10 rounded bg-foreground/80 px-1.5 text-[10px] text-background">{T(p.label, `${pairMode || isTrain ? "Sheet" : "Set"} ${p.no}`)}</span>}
                <Page sheet={p.sheet} rows={p.rows} first={p.first} qr={qr} fit={fit} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t px-3 py-3 sm:gap-3 sm:px-4">
          {canPickDir() ? (
            <span className="text-xs text-muted-foreground">
              {dirName ? (lang === "en" ? <>Saving to “<b className="text-foreground">{dirName}</b>”</> : <>保存到「<b className="text-foreground">{dirName}</b>」</>) : tx("第一次下载会让你选保存文件夹,之后直接保存")}
              <button onClick={async () => { const d = await prepareSaveDir(true); if (d) { setDirName(d.name); toast({ title: T(`以后保存到「${d.name}」文件夹`, `Will save to “${d.name}” from now on`), description: tx("点 PDF / Excel 直接保存,不再弹「另存为」") }); } }}
                className="ml-1.5 font-medium text-[#7a5520] underline-offset-2 hover:underline">{tx(dirName ? "更改" : "现在选")}</button>
            </span>
          ) : <span className="hidden text-xs text-muted-foreground lg:block">{tx("PDF / 打印与预览逐页一致;Excel 方便再编辑(每套含试题和答案)")}</span>}
          <button onClick={onClose} disabled={!!busy} className="ml-auto hidden rounded-full border px-5 py-2 text-sm font-bold hover:bg-muted disabled:opacity-50 sm:block">{tx("取消")}</button>
          <button onClick={doXlsx} disabled={!!busy} className="ml-auto flex items-center gap-1.5 rounded-full border-2 border-[#7a5520] px-3 py-2 text-sm font-black text-[#7a5520] hover:bg-[#7a5520]/10 disabled:opacity-60 sm:ml-0 sm:px-5">
            {busy === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel
          </button>
          <button onClick={doPdf} disabled={!!busy} className="flex items-center gap-1.5 rounded-full border-2 border-[#7a5520] px-3 py-2 text-sm font-black text-[#7a5520] hover:bg-[#7a5520]/10 disabled:opacity-60 sm:px-5">
            {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
          </button>
          <button onClick={doPrint} disabled={!!busy} className="flex items-center gap-1.5 rounded-full bg-[#7a5520] px-4 py-2 text-sm font-black text-white hover:bg-[#6a4818] disabled:opacity-60 sm:px-6">
            {busy === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} {tx("打印")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { RowSpec };
