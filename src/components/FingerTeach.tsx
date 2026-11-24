// 指法教学 · 例题讲解(2026-11-02 用户:教练端新功能,老师上课用):
//   题目设置(像参考截图:题目1/题目2… + 竖式预览 + 开始)→ 讲解模式:左边竖式、中间算盘实时拨珠(在动的珠变红,同教材)、
//   拇指 / 食指跟着珠子动、右边讲解文字 + 语音;右栏按钮:讲解(空格)、变更题目(回车)、上一题(←)、下一题(→)。
//   讲解话术与拨珠由 lib/fingerTeach 生成(付海东教材 + 用户示范句)。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { buildLesson, beadsOf, parseAny, RHYME, RHYME_EN, type BeadAction, type Lesson } from "@/lib/fingerTeach";
import { useI18n } from "@/lib/i18n";
import { useTx } from "@/lib/tx";
import { prefetchSpeech, speak, stopSpeech } from "@/lib/teachVoice";
import { cn } from "@/lib/utils";
import handRestPng from "@/assets/hand/rest.png";
import handIndexPng from "@/assets/hand/index.png";
import handThumbPng from "@/assets/hand/thumb.png";

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

// ===== 题目设置 =====
const STORE = "teach:problems";
/** 教材里每一关的第一道例题(一键填入,老师可再改) */
export const BOOK_EXAMPLES: Record<number, string[]> = {
  1: ["3+6", "9-5"], 2: ["1+4", "32+45"], 3: ["5-4", "65-40"], 4: ["1+9", "21+89"],
  5: ["5+9", "55+89"], 6: ["10-9", "110-89"], 7: ["14-9", "144-89"],
};

export function TeachSetup({ onStart }: { onStart: (problems: string[]) => void }) {
  // 2026-11-08 英文界面:整页和报错都用英文(讲解见 TeachStage)
  const { lang } = useI18n(); const en = lang === "en"; const T = (zh: string, e: string) => (en ? e : zh);
  const [rows, setRows] = useState<string[]>(() => {
    try { const v = JSON.parse(localStorage.getItem(STORE) || "[]"); if (Array.isArray(v) && v.length) return [...v.map(String), ...Array(Math.max(0, 5 - v.length)).fill("")]; } catch { /* noop */ }
    return ["", "", "", "", ""];
  });
  const [shown, setShown] = useState<Set<number>>(new Set());
  // 2026-11-08 用户「输入 * / 之后显示乘除号,默认要有说明」:* → ×、/ → ÷ 输入时就换;另给 × ÷ 按钮,插到最后点过的那一行(平板键盘不好找 * /)
  const [focusRow, setFocusRow] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const norm = (v: string) => v.replace(/[*＊xX✕]/g, "×").replace(/[/／]/g, "÷");
  const insertOp = (op: "×" | "÷") => {
    const el = inputs.current[focusRow], i = focusRow;
    const pos = el?.selectionStart ?? rows[i].length;
    setRows((rs) => rs.map((x, j) => (j === i ? x.slice(0, pos) + op + x.slice(el?.selectionEnd ?? pos) : x)));
    window.setTimeout(() => { el?.focus(); el?.setSelectionRange(pos + 1, pos + 1); }, 0);
  };
  const [tried, setTried] = useState(false);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(rows.filter((r) => r.trim()))); } catch { /* noop */ } }, [rows]);
  const filled = rows.map((r, i) => ({ r: r.trim(), i })).filter((x) => x.r);
  const errors = new Map(filled.map(({ r, i }) => { const p = parseAny(r, en ? "en" : "zh"); return [i, "error" in p ? p.error : ""] as const; }));
  const ok = filled.filter(({ i }) => !errors.get(i));

  return (
    <div className="space-y-3">
      <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
        {rows.map((r, i) => {
          const err = r.trim() ? errors.get(i) : "";
          const p = r.trim() && !err ? parseAny(r, en ? "en" : "zh") : null;
          return (
            <div key={i}>
              <div className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-sm text-muted-foreground">{T(`题目${i + 1}:`, `Q${i + 1}:`)}</span>
                <input ref={(el) => { inputs.current[i] = el; }} onFocus={() => setFocusRow(i)} value={r} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? norm(e.target.value) : x)))} placeholder={T("如 2+7、43*4(显示 43×4)、48/2(显示 48÷2)", "e.g. 2+7, 43*4 (shows 43×4), 48/2 (shows 48÷2)")}
                  inputMode="text" autoCapitalize="none" autoCorrect="off"
                  className={cn("h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 font-mono-tabular text-base", err && (tried || r.length > 2) ? "border-red-400" : "border-input")} />
                <button onClick={() => setShown((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} disabled={!p}
                  className={cn("h-10 shrink-0 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-40", shown.has(i) ? "bg-sky-700" : "bg-sky-500")}>{T("竖式", "Preview")}</button>
                {rows.length > 1 && <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="shrink-0 text-muted-foreground hover:text-red-500" title={T("删除这一题", "Remove")}><X className="h-4 w-4" /></button>}
              </div>
              {err && (tried || r.length > 2) && <p className="ml-16 mt-1 text-xs text-red-600">{err}</p>}
              {p && !("error" in p) && shown.has(i) && <div className="ml-16 mt-1 inline-block rounded-lg bg-muted/50 px-4 py-2">{p.kind === "addsub" ? <Vertical terms={p.terms} small /> : <span className="font-mono-tabular text-lg font-bold">{p.a} {p.kind} {p.b} =</span>}</div>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setRows((rs) => [...rs, ""])} className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted">{T("＋ 添加题目", "＋ Add problem")}</button>
        <button onClick={() => setRows(["", "", "", "", ""])} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted">{T("清空", "Clear")}</button>
        {/* 2026-11-08 用户「这个去掉」:去掉教材例题 / 乘法 / 除法一键填入,题目由老师自己输入;
            「下面说明加减乘除都可以出,以及符号输入」:说明放在这一行,× ÷ 按钮插到最后点过的那一行 */}
        <span className="ml-auto flex gap-1.5">
          {(["×", "÷"] as const).map((op) => <button key={op} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertOp(op)} className="h-7 w-9 rounded-md border border-border bg-background text-base font-bold hover:bg-muted" title={T(`在题目${focusRow + 1}里插入 ${op}`, `Insert ${op} into Q${focusRow + 1}`)}>{op}</button>)}
        </span>
      </div>
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {en ? (<>
          <b className="text-foreground">All four operations:</b> + and − can chain several numbers (e.g. 2+7, 45+38-12, up to 8 numbers); × and ÷ take two numbers (e.g. 43×4, 1344÷56; division must divide evenly).<br />
          <b className="text-foreground">Typing the signs:</b> plus <b className="text-foreground">+</b>, minus <b className="text-foreground">-</b>; type <b className="text-foreground">*</b> for <b className="text-foreground">×</b> and <b className="text-foreground">/</b> for <b className="text-foreground">÷</b> (they convert automatically), or tap the × ÷ buttons.
        </>) : (<>
        <b className="text-foreground">加减乘除都可以出:</b>加减可以连着多个数(如 2+7、45+38-12,最多 8 个数);乘除每题两个数(如 43×4、1344÷56,除法要能整除)。<br />
        <b className="text-foreground">符号怎么输:</b>加号 <b className="text-foreground">+</b>、减号 <b className="text-foreground">-</b>;乘号输入 <b className="text-foreground">*</b> 自动变成 <b className="text-foreground">×</b>,除号输入 <b className="text-foreground">/</b> 自动变成 <b className="text-foreground">÷</b>;也可以点右边的 × ÷ 按钮。
        </>)}
      </div>
      <div className="flex items-center justify-end gap-3 pt-1">
        <span className="mr-auto text-xs text-muted-foreground">{ok.length ? T(`共 ${ok.length} 题,讲解时可按 ← → 切换`, `${ok.length} problem(s) · use ← → to switch while teaching`) : T("至少输入一道题", "Enter at least one problem")}</span>
        <button disabled={!ok.length} onClick={() => { setTried(true); if (ok.length === filled.length) onStart(ok.map((x) => x.r)); }}
          className="rounded-lg bg-sky-500 px-10 py-2.5 text-base font-bold text-white disabled:opacity-40">{T("开 始", "Start")}</button>
      </div>
      {tried && ok.length !== filled.length && <p className="text-right text-xs text-red-600">{T("有题目格式不对,改好再开始", "Some problems aren't valid — fix them first")}</p>}
    </div>
  );
}

/** 竖式:右对齐,减数带负号,结果可选 */
function Vertical({ terms, answer, current, small = false }: { terms: number[]; answer?: number | null; current?: number; small?: boolean }) {
  return (
    <div className={cn("inline-flex flex-col items-end font-mono-tabular font-bold leading-tight", small ? "text-lg" : "text-4xl")}>
      {terms.map((t, i) => (
        <div key={i} className={cn("rounded px-1 transition-colors", current === i && "bg-amber-300/40 text-[#7a1f2b]")}>{t < 0 ? `−${-t}` : t}</div>
      ))}
      <div className={cn("my-1 w-full border-t-2 border-current", small ? "" : "border-t-[3px]")} />
      <div className={cn("min-h-[1.25em] px-1 text-[#1f6b2c]", answer == null && "opacity-0")}>{answer ?? 0}</div>
    </div>
  );
}

// ===== 算盘几何(SVG 用户坐标) =====
const RW = 84, RX = 34, RY = 17, LEFT = 30, TOP = 22, FT = 14, BEAM = 124, BH = 9;
const UP_REST = TOP + FT + RY + 2, UP_ON = BEAM - RY;
const lowY = (i: number, on: boolean) => BEAM + BH + RY + (on ? i : i + 1) * 2 * RY;
const BOTTOM = BEAM + BH + 10 * RY + 6;
const H = BOTTOM + FT + 28;
const cxOf = (rod: number, n: number) => LEFT + (n - 1 - rod) * RW + RW / 2; // rod 0 = 个位,在最右

function Bead({ x, y, red }: { x: number; y: number; red: boolean }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 560ms cubic-bezier(.4,.1,.2,1)" }}>
      <polygon points={`${-RX},0 0,${-RY} ${RX},0`} fill={red ? "url(#tb-redTop)" : "url(#tb-greenTop)"} />
      <polygon points={`${-RX},0 ${RX},0 0,${RY}`} fill={red ? "url(#tb-redBot)" : "url(#tb-greenBot)"} />
      <polygon points={`${-RX},0 0,${-RY} ${RX},0 0,${RY}`} fill="none" stroke={red ? "#7a0f12" : "#0B5A17"} strokeOpacity={0.5} strokeWidth={1} />
    </g>
  );
}

/** 平滑过渡一个点(手指尖跟着珠子走;SVG 线段端点不能用 CSS 过渡,用 rAF 插值) */
function useTween(target: { x: number; y: number }, ms = 560) {
  const [cur, setCur] = useState(target);
  const from = useRef(target);
  const curRef = useRef(target);
  useEffect(() => {
    from.current = curRef.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const v = { x: from.current.x + (target.x - from.current.x) * e, y: from.current.y + (target.y - from.current.y) * e };
      curRef.current = v; setCur(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target.x, target.y, ms]);
  return cur;
}

// ===== 手(2026-11-04 用户「手不够真」→ 给了参考软件截图,「直接抠他那个图,不要自己再画」) =====
// src/assets/hand/*.png 是从参考截图抠出来的侧视左手(指尖朝右),拆成三块:手掌(含蜷着的三指)/ 食指 / 拇指;
// 坐标 = 参考截图原图像素。食指、拇指各自绕指根转 + 沿指长微伸缩去够要拨的珠;右手水平镜像。
const HAND_PCS = {
  rest: { href: handRestPng, x: 31.5, y: 77.75, w: 219, h: 172.5 },
  thumb: { href: handThumbPng, x: 150, y: 191, w: 124.75, h: 61.25 },
  index: { href: handIndexPng, x: 168, y: 66, w: 177.25, h: 66.25 },
};
const HAND_S = 0.7; // 参考截图里珠半宽约 48.5px,这里 RX = 34 → 同参考软件的手珠比例
const IDX_PIV = { x: 182, y: 108 }, IDX_TIP = { x: 337, y: 89 }; // 食指尖:指腹底(往下拨时贴珠顶)
const THB_PIV = { x: 150, y: 232 }, THB_TIP = { x: 266, y: 220 }; // 拇指尖:指尖顶(往上拨时贴珠底)
type Pt = { x: number; y: number };
const deg = (r: number) => (r * 180) / Math.PI;
/** 手指绕指根转到目标 + 沿指长伸缩(图片手指,只放 0.85–1.15 倍,不至于变形) */
function aim(piv: Pt, tip: Pt, target: Pt) {
  const a0 = Math.atan2(tip.y - piv.y, tip.x - piv.x), a1 = Math.atan2(target.y - piv.y, target.x - piv.x);
  const k = Math.max(0.85, Math.min(1.15, Math.hypot(target.x - piv.x, target.y - piv.y) / Math.hypot(tip.x - piv.x, tip.y - piv.y)));
  return `translate(${piv.x} ${piv.y}) rotate(${deg(a1 - a0).toFixed(2)}) rotate(${deg(a0).toFixed(2)}) scale(${k.toFixed(3)} 1) rotate(${(-deg(a0)).toFixed(2)}) translate(${-piv.x} ${-piv.y})`;
}
const HandImg = ({ p, transform }: { p: (typeof HAND_PCS)["rest"]; transform?: string }) => (
  <image href={p.href} x={p.x} y={p.y} width={p.w} height={p.h} transform={transform} preserveAspectRatio="none" />
);

/** 一只手:indexTip / thumbTip 是食指尖、拇指尖要落的位置(没用到的那根手指保持自然捏姿) */
function HandArt({ side, thumbTip, indexTip, idle, show }: { side: "left" | "right"; thumbTip: Pt | null; indexTip: Pt | null; idle: Pt; show: boolean }) {
  const m = side === "right" ? 1 : -1, s = HAND_S, fx = s * -m; // 右手镜像
  const di = { x: (IDX_TIP.x - THB_TIP.x) * fx, y: (IDX_TIP.y - THB_TIP.y) * s }; // 自然捏姿下 食指尖 − 拇指尖
  // 只用一根手指时,另一根按自然捏姿推出来;都没有就停在 idle(拇指尖)
  const tT = thumbTip ?? (indexTip ? { x: indexTip.x - di.x, y: indexTip.y - di.y } : idle);
  const iT = indexTip ?? { x: tT.x + di.x, y: tT.y + di.y };
  const I = useTween(iT), T = useTween(tT);
  const rx = (IDX_TIP.x + THB_TIP.x) / 2, ry = (IDX_TIP.y + THB_TIP.y) / 2;
  const o = { x: (I.x + T.x) / 2 - rx * fx, y: (I.y + T.y) / 2 - ry * s };
  const loc = (p: Pt) => ({ x: (p.x - o.x) / fx, y: (p.y - o.y) / s });
  const ti = aim(IDX_PIV, IDX_TIP, loc(I)), tt = aim(THB_PIV, THB_TIP, loc(T));
  return (
    // 淡入淡出要快(2026-11-04:慢淡出时半透明的手截图很难看)
    <g style={{ opacity: show ? 1 : 0, transition: "opacity 120ms" }} pointerEvents="none">
      <g transform={`translate(${o.x.toFixed(1)} ${o.y.toFixed(1)}) scale(${fx.toFixed(4)} ${s})`}>
        <HandImg p={HAND_PCS.rest} />
        <HandImg p={HAND_PCS.thumb} transform={tt} />
        <HandImg p={HAND_PCS.index} transform={ti} />
      </g>
    </g>
  );
}

interface HandPlan { side: "left" | "right"; thumb: { x: number; y: number } | null; index: { x: number; y: number } | null }
/** 一次拨珠:哪些珠在动(变红);手放在哪、拇指 / 食指尖从哪推到哪(approach = 指尖贴到珠上,push = 跟着珠子到位) */
function plan(a: BeadAction, n: number, phase: "approach" | "push"): { moving: Set<string>; hand: HandPlan } {
  const cx = cxOf(a.rod, n), b0 = beadsOf(a.before);
  const moving = new Set<string>();
  const left = a.hand === "left";
  const m = left ? -1 : 1;
  let thumb: { x: number; y: number } | null = null, index: { x: number; y: number } | null = null;
  const at = (y0: number, y1: number) => (phase === "push" ? y1 : y0);
  const tipX = cx + m * RX * 0.4;
  if (a.upper) {
    moving.add(`${a.rod}u`);
    index = a.upper === "down" ? { x: tipX, y: at(UP_REST - RY + 3, UP_ON - RY + 3) } : { x: tipX, y: at(UP_ON + RY - 3, UP_REST + RY - 3) };
  }
  if (a.lower) {
    const k = Math.abs(a.lower);
    const first = a.lower > 0 ? b0.lower : b0.lower - k, last = first + k - 1;
    for (let i = first; i <= last; i++) moving.add(`${a.rod}l${i}`);
    // 下珠往上拨用拇指(从下面推);往下拨单独用食指、双下 / 双分时拇指(从上面拨)
    const useThumb = a.lower > 0 || a.finger === "both";
    const p = a.lower > 0 ? { x: tipX, y: at(lowY(last, false) + RY - 3, lowY(last, true) + RY - 3) } : { x: tipX, y: at(lowY(first, true) - RY + 3, lowY(first, false) - RY + 3) };
    if (useThumb) thumb = p; else index = p;
  }
  return { moving, hand: { side: left ? "left" : "right", thumb, index } };
}

/** numbered:乘除讲解 —— 档从左数「1 2 3…」(不标个十百、不点个位);mark:这一步从哪一档起,上方画 ▼(同参考软件) */
function Abacus({ rods, acts, phase, numbered = false, mark, en = false }: { rods: number[]; acts: BeadAction[]; phase: "approach" | "push" | null; numbered?: boolean; mark?: number; en?: boolean }) {
  const n = rods.length, W = LEFT * 2 + n * RW;
  const SHIFT = 40; // 手画在框外(overflow visible),算盘本身尽量大
  // 进位 / 退位时右手(本档)和左手(前一档)同时拨:每只手各取自己的那个动作
  const plans = acts.map((a) => plan(a, n, phase ?? "approach"));
  const moving = new Set(plans.flatMap((q) => [...q.moving]));
  const R0 = plans.find((q) => q.hand.side === "right")?.hand, L = plans.find((q) => q.hand.side === "left")?.hand;
  // 2026-11-09 用户「手指咋没了」:右手一直留在画面上(同参考软件)—— 拨完停在刚拨的位置,讲话时不消失;开讲前在个位旁待机。左手只在进位 / 退位时出现
  const lastR = useRef<{ n: number; hand: HandPlan } | null>(null);
  if (R0) lastR.current = { n, hand: R0 };
  else if (lastR.current && lastR.current.n !== n) lastR.current = null; // 换题(档数变了)回待机位
  const R = R0 ?? lastR.current?.hand;
  const PLACES = en ? ["1s", "10s", "100s", "1K", "10K", "100K"] : ["个", "十", "百", "千", "万", "十万"];
  return (
    <svg viewBox={`${-SHIFT} 0 ${W + SHIFT * 2} ${H}`} className="h-full max-h-[64vh] w-auto max-w-full overflow-visible" style={{ overflow: "visible" }} role="img" aria-label="算盘">
      <defs>
        <linearGradient id="tb-greenTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7DF08A" /><stop offset="0.6" stopColor="#3FCB52" /><stop offset="1" stopColor="#2DB33F" /></linearGradient>
        <linearGradient id="tb-greenBot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#25A636" /><stop offset="1" stopColor="#0F6B1C" /></linearGradient>
        <linearGradient id="tb-redTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF8A80" /><stop offset="0.6" stopColor="#E53935" /><stop offset="1" stopColor="#C62828" /></linearGradient>
        <linearGradient id="tb-redBot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B71C1C" /><stop offset="1" stopColor="#7F0E0E" /></linearGradient>
      </defs>
      {/* 框、档、梁 */}
      <rect x={LEFT - 8} y={TOP} width={n * RW + 16} height={FT} rx={3} fill="#2b2b2b" />
      <rect x={LEFT - 8} y={BOTTOM} width={n * RW + 16} height={FT} rx={3} fill="#2b2b2b" />
      {rods.map((_, r) => <line key={r} x1={cxOf(r, n)} y1={TOP + FT} x2={cxOf(r, n)} y2={BOTTOM} stroke="#E0A33A" strokeWidth={5} />)}
      <rect x={LEFT - 8} y={BEAM} width={n * RW + 16} height={BH} rx={2} fill="#e8e3d6" stroke="#8a8274" strokeWidth={1} />
      {rods.map((_, r) => <text key={r} x={cxOf(r, n)} y={TOP + FT - 2.5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">{numbered ? n - r : PLACES[r] ?? ""}</text>)}
      {!numbered && <circle cx={cxOf(0, n)} cy={BEAM + BH / 2} r={2.6} fill="#333" />}
      {mark != null && <polygon points={`${cxOf(mark, n) - 11},${TOP - 18} ${cxOf(mark, n) + 11},${TOP - 18} ${cxOf(mark, n)},${TOP - 2}`} fill="#c0392b" style={{ transition: "all 300ms" }} />}
      {/* 珠 */}
      {rods.map((d, r) => {
        const b = beadsOf(d), x = cxOf(r, n);
        return (
          <g key={r}>
            <Bead x={x} y={b.upper ? UP_ON : UP_REST} red={moving.has(`${r}u`)} />
            {[0, 1, 2, 3].map((i) => <Bead key={i} x={x} y={lowY(i, i < b.lower)} red={moving.has(`${r}l${i}`)} />)}
          </g>
        );
      })}
      {/* 手(线稿,同参考软件):右手握笔从右边来,左手(进 1 / 退 1 的前一档)从左边来 */}
      <HandArt side="right" thumbTip={R?.thumb ?? null} indexTip={R?.index ?? null} idle={{ x: cxOf(0, n) + RX * 0.4, y: lowY(0, false) + RY }} show />
      <HandArt side="left" thumbTip={L?.thumb ?? null} indexTip={L?.index ?? null} idle={{ x: cxOf(n - 1, n) - RX * 0.4, y: lowY(0, false) + RY }} show={!!phase && !!L} />
    </svg>
  );
}

/** 一步的动作分成几「拍」:一拍里右手、左手各最多一个动作,同时拨(用户话术「右手…的同时，左手拇指进1」);
 *  同一只手的下一个动作(多位数首个数逐档拨入、连续进位再往前一档)放到下一拍 */
function beatsOf(actions: BeadAction[]): BeadAction[][] {
  const out: BeadAction[][] = [];
  for (const a of actions) {
    const cur = out[out.length - 1];
    if (cur && !cur.some((x) => x.hand === a.hand)) cur.push(a); else out.push([a]);
  }
  return out;
}

// ===== 讲解模式 =====
/** demoStep(仅商店截图用):直接定格到第 N 步「手在拨珠」的画面,不播放 */
export function TeachStage({ problems, onClose, onEdit, demoStep }: { problems: string[]; onClose: () => void; onEdit: () => void; demoStep?: number }) {
  const { lang } = useI18n(); const en = lang === "en"; const T = (zh: string, e: string) => (en ? e : zh); const tx = useTx();
  // 英文界面:讲解话术、口诀、语音全英文(2026-11-08 用户「如果是英文的话,讲解也要全是英文」)
  const lessons = useMemo(() => problems.map((p) => buildLesson(p, en ? "en" : "zh")).filter((l): l is Lesson => !("error" in l)), [problems, en]);
  const [idx, setIdx] = useState(0);
  const lesson = lessons[Math.min(idx, lessons.length - 1)];
  // demoStep(商店截图):首帧就是定格画面(手不从待机位滑过来)
  const demo = useMemo(() => {
    if (!lesson || demoStep == null) return null;
    const r = Array(lesson.rods).fill(0);
    lesson.steps.slice(0, demoStep).forEach((st) => st.actions.forEach((a) => { r[a.rod] = a.after; }));
    const st = lesson.steps[demoStep];
    return { rods: r, acts: st?.actions.slice(0, 1) ?? [], phase: (st?.actions.length ? "approach" : null) as "approach" | null };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [rods, setRods] = useState<number[]>(() => demo?.rods ?? Array(lesson?.rods ?? 2).fill(0));
  const [stepIdx, setStepIdx] = useState(demoStep ?? -1);
  const [acts, setActs] = useState<BeadAction[]>(demo?.acts ?? []);
  const [phase, setPhase] = useState<"approach" | "push" | null>(demo?.phase ?? null);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const run = useRef(0);

  const intro = lesson ? (en ? `${lesson.speakExpr} equals` : `${lesson.speakExpr}等于`) : "";
  const outro = lesson ? (en ? `The answer is ${lesson.answer}` : `答案等于${lesson.answer}`) : "";
  const resetView = useCallback(() => {
    run.current++; stopSpeech();
    setRods(Array(lesson?.rods ?? 2).fill(0)); setStepIdx(-1); setActs([]); setPhase(null); setPlaying(false); setFinished(false);
  }, [lesson]);
  useEffect(() => {
    if (demo) return;
    resetView();
    if (lesson) prefetchSpeech([intro, ...lesson.steps.map((s) => s.say), outro], en ? "en" : "zh");
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { run.current++; stopSpeech(); }, []);

  const say = useCallback((t: string, onStart?: (ms: number) => void) => {
    if (voiceOn) return speak(t, onStart, en ? "en" : "zh");
    const ms = Math.min(5000, 500 + t.length * 120); onStart?.(ms); return wait(ms);
  }, [voiceOn]);
  const play = useCallback(async () => {
    if (!lesson) return;
    const id = ++run.current;
    stopSpeech();
    const fresh = Array(lesson.rods).fill(0);
    setRods(fresh); setFinished(false); setActs([]); setPhase(null); setStepIdx(-1); setPlaying(true);
    await say(intro);
    for (let i = 0; i < lesson.steps.length; i++) {
      if (id !== run.current) return;
      const st = lesson.steps[i];
      setStepIdx(i);
      // 2026-11-02 用户「每一步先讲解,再做动作」:这一步的话整句讲完,手再伸过去拨;进位 / 退位右手左手同时拨
      await say(st.say);
      if (id !== run.current) return;
      for (const beat of beatsOf(st.actions)) {
        if (id !== run.current) return;
        setActs(beat); setPhase("approach");
        await wait(650);
        if (id !== run.current) return;
        setRods((r) => { const n = [...r]; for (const a of beat) n[a.rod] = a.after; return n; });
        setPhase("push");
        await wait(800);
      }
      setPhase(null);
      await wait(350);
    }
    setActs([]); setFinished(true);
    await say(outro);
    if (id === run.current) setPlaying(false);
  }, [lesson, say, intro, outro]);
  const stop = () => { run.current++; stopSpeech(); setPlaying(false); setPhase(null); };

  const go = (d: number) => { if (lessons.length) setIdx((i) => Math.max(0, Math.min(lessons.length - 1, i + d))); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); if (playing) stop(); else void play(); }
      else if (e.key === "Enter") { e.preventDefault(); stop(); onEdit(); }
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Escape") { stop(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!lesson) return null;
  const st = stepIdx >= 0 ? lesson.steps[stepIdx] : null;
  const cls = st && st.cls !== "拨入" ? st.cls : lesson.classes[0];
  const Btn = ({ label, hint, onClick, hot = false, disabled = false }: { label: string; hint?: string; onClick: () => void; hot?: boolean; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled} className={cn("w-full rounded-xl px-2 py-2 text-center text-sm font-black text-white shadow transition hover:brightness-110 disabled:opacity-40", hot ? "bg-[#d9442b]" : "bg-[#ef8a3c]")}>
      {label}{hint && <span className="block text-[10px] font-normal opacity-85">{hint}</span>}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#f3ead6] text-[#2b2116]" style={{ backgroundImage: "radial-gradient(120% 90% at 50% 20%, #fbf5e6 0%, #efe3c6 100%)" }}>
      {/* 顶部:七个指法阶段(当前这一步属于哪一关就亮哪一关) */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-4 pt-3">
        {/* 课堂投屏露出品牌:金象徽标 + 字标(与首页同一套图) */}
        <img src="/logo-emblem.png?v=2" alt="" className="h-8 w-auto" />
        <img src="/logo-text.png?v=2" alt="珠象" className="mr-2 h-8 w-auto" />
        <span className="mr-1 text-sm font-black">{T("指法教学 · 例题讲解", "Fingering lessons")}</span>
        {/* 2026-11-09 用户「最上面 tab 也去掉」:去掉七个指法阶段标签 */}
      </div>
      <div className="flex min-h-0 flex-1 gap-3 px-4 pb-3 pt-2">
        {/* 竖式(加减);乘除没有左栏 —— 算式和答案在算盘上方一排(2026-11-08 付海东「题目答案最好在一排」) */}
        {!lesson.op && (
          <div className="flex w-[17%] min-w-[110px] flex-col items-center justify-start pt-6">
            <Vertical terms={lesson.terms} answer={finished ? lesson.answer : null} current={st?.term} />
          </div>
        )}
        {/* 算盘 + 讲解 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {lesson.op && (
            <div className="flex shrink-0 items-baseline justify-center gap-4 whitespace-nowrap pt-1 font-mono-tabular text-5xl font-bold">
              <span>{lesson.a} {lesson.op} {lesson.b} =</span>
              <span className={cn("min-w-[2ch] text-[#1f6b2c] transition-opacity", !finished && "opacity-0")}>{lesson.answer}</span>
            </div>
          )}
          <div className="flex min-h-0 flex-1 items-center justify-center"><Abacus rods={rods} acts={acts} phase={phase} numbered={!!lesson.op} mark={lesson.op ? st?.mark : undefined} en={en} /></div>
          <div className="mt-2 rounded-2xl border border-[#d9c39b] bg-white/80 px-5 py-3 shadow-sm">
            <div className="flex items-baseline gap-3">
              {st && <span className="shrink-0 rounded-md bg-[#7a1f2b] px-2 py-0.5 font-mono-tabular text-sm font-bold text-white">{st.label}</span>}
              <p className="min-h-[2.2em] text-lg font-bold leading-snug sm:text-xl">
                {finished ? T(`答案等于 ${lesson.answer}`, `The answer is ${lesson.answer}`) : st ? st.say : playing ? `${lesson.expr.replace(/-/g, " − ").replace(/\+/g, " + ").replace(/([×÷])/g, " $1 ")} ${T("等于…", "= …")}` : T("按「讲解」或空格键开始", "Press “Explain” or the space bar to start")}
              </p>
            </div>
            {lesson.rule ? <p className="mt-1.5 border-t border-dashed border-[#d9c39b] pt-1.5 text-sm text-[#6b5536]">📖 {lesson.rule}</p>
              : cls && <p className="mt-1.5 border-t border-dashed border-[#d9c39b] pt-1.5 text-sm text-[#6b5536]">📖 {en ? RHYME_EN[cls] : `${cls}:${RHYME[cls]}`}</p>}
          </div>
        </div>
        {/* 右栏按钮(同参考截图) */}
        <div className="flex w-[110px] shrink-0 flex-col gap-2 rounded-2xl bg-white/70 p-2 shadow">
          <Btn label={T("返 回", "Back")} onClick={() => { stop(); onClose(); }} />
          <Btn label={playing ? T("停 止", "Stop") : finished ? T("再讲一遍", "Again") : T("讲 解", "Explain")} hint={T("(空格键)", "(Space)")} hot onClick={() => (playing ? stop() : void play())} />
          <Btn label={T("变更题目", "Edit")} hint={T("(回车键)", "(Enter)")} onClick={() => { stop(); onEdit(); }} />
          <Btn label={T("上一题", "Previous")} hint={T("(向左键)", "(←)")} onClick={() => go(-1)} disabled={idx === 0} />
          <Btn label={T("下一题", "Next")} hint={T("(向右键)", "(→)")} onClick={() => (idx < lessons.length - 1 ? go(1) : (stop(), onEdit()))} />
          <div className="mt-1 border-t border-[#e2d2b3] pt-2 text-center font-mono-tabular text-sm font-bold text-[#8a6d45]">{idx + 1}/{lessons.length}</div>
          <button onClick={() => { setVoiceOn((v) => !v); stopSpeech(); }} className="mt-auto rounded-lg border border-[#e2d2b3] py-1.5 text-xs">{voiceOn ? T("🔊 语音开", "🔊 Voice on") : T("🔇 语音关", "🔇 Voice off")}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
