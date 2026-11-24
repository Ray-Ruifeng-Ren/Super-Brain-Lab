// 出题系统 /exam(2026-10-25 用户:独立于教练端和学生端,能选不同题目类型打印;主打简单好用)
// 交互:选标签页 → 点级别/组别 → 直接出 A4 预览(套数/起始编号/单项/字号/换一批/答案)→ 打印 或 下载 Excel。
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { ExamPreview } from "@/components/ExamPreview";
import { Num, Seg } from "@/components/HwItemEditor";
import { EXAM_TABS, type ExamSpec, type Section } from "@/lib/exam/specs";
import { fillCount, sheetCount } from "@/lib/exam/capacity";
import { COACH_STAGES } from "@/lib/fingering";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useTx } from "@/lib/tx";

// 英文界面的按钮显示名(只改显示,specs.ts 的 id / label / 卷面标题不动):「一级」→「Lv 1」、能手级 → Expert、段位 → Dan
const CN_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const LEVEL_EN: Record<string, string> = { 能手级: "Expert", 段位: "Dan" };
function specLabelEn(label: string, tx: (s: string) => string): string {
  if (LEVEL_EN[label]) return LEVEL_EN[label];
  const m = /^(.+)级$/.exec(label);
  const n = m ? CN_NUM.indexOf(m[1]) : -1;
  return n > 0 ? `Lv ${n}` : tx(label);
}
// 比赛卡片里的组别行名(列宽只有 3.5rem,英文用短名;卡片标题已说明是哪个比赛)
const COMP_ROW_EN: Record<string, string> = { "A(B)组": "A(B)", "C(D)组": "C(D)", 选手组: "Player", A组: "A", B组: "B", C组: "C", D组: "D", 幼儿组: "Pre-K", 精英组: "Elite" };
function useSpecLabel() {
  const { lang } = useI18n();
  const tx = useTx();
  return (label: string) => (lang === "en" ? specLabelEn(label, tx) : label);
}

/** 本指法涉及的数字:各变式小课的并集(如满五加 1–4、进位加 1–9) */
const stageDigits = (st: (typeof COACH_STAGES)[number]) => [...new Set(st.variantGroups.flatMap((g) => g.xs))].sort((p, q) => p - q);

export default function ExamCenter() {
  const navigate = useNavigate();
  const tx = useTx();
  const [spec, setSpec] = useState<ExamSpec | null>(null);
  // 2026-10-25 用户「自定义出题还是单独一个 tab」→ 两个 tab;随后「先放等级鉴定」→「等级鉴定 · 比赛题型」排第一、默认打开
  const [tab, setTab] = useState<"custom" | "papers">(() => { try { return localStorage.getItem("exam:tab4") === "custom" ? "custom" : "papers"; } catch { return "papers"; } });
  const pick = (t: "custom" | "papers") => { setTab(t); try { localStorage.setItem("exam:tab4", t); } catch { /* noop */ } };
  const jd = EXAM_TABS.find((t) => t.id === "jd")!, comp = EXAM_TABS.find((t) => t.id === "comp")!;

  return (
    <div className="relative min-h-screen text-foreground">
      <div aria-hidden className="paper-bg pointer-events-none fixed inset-0 z-0" />
      <header className="sticky top-0 z-30 border-b border-[#B8925A]/40 bg-[#FBF5E6]/85 backdrop-blur">
        <div className="container flex items-center justify-between py-3">
          <button onClick={() => { try { sessionStorage.setItem("sbl_stay_home", "1"); } catch { /* noop */ } navigate("/"); }} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <img src="/logo-emblem.png?v=2" alt="珠象" className="mr-1 h-7 w-auto" />
            <ArrowLeft className="h-3.5 w-3.5" /> {tx("广场")} <span className="mx-1 text-muted-foreground/60">/</span> <span className="text-foreground">{tx("出题系统")}</span>
          </button>
          <AccountMenu />
        </div>
      </header>

      <main className="container relative z-10 max-w-6xl py-4 pb-12">
        <div className="mb-2 sm:mb-3">
          <h1 className="hp-title flex items-center gap-2 text-2xl font-black sm:text-3xl"><Printer className="h-6 w-6 sm:h-7 sm:w-7" /> {tx("出题系统")}</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">{tx("点级别直接出整套试卷（A4 / B4） · 可调张数、单项、字号 · 打印、下载 PDF 或 Excel · 右上角二维码扫码看答案")}</p>
        </div>

        <div className="mb-3 flex gap-2">
          {([["papers", "等级鉴定 · 比赛题型"], ["custom", "自定义出题"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => pick(id)} className={cn("hp-leather rounded-full px-4 py-2 text-sm font-bold transition-transform hover:-translate-y-0.5 sm:px-5 sm:py-2.5 sm:text-base", tab === id && "hp-leather-on")}>{tx(label)}</button>
          ))}
        </div>

        {/* 「等级鉴定 · 比赛题型」:两块占满一行、从上往下排(用户嫌三栏并排不好看) */}
        {tab === "papers" && <div className="space-y-3">
          <section className="hp-card p-3 sm:p-4">
            <h2 className="text-base font-black sm:text-lg">{tx("等级鉴定")}</h2>
            {jd.groups.map((g) => (
              <div key={g.title} className="mt-1">
                <p className="mb-1.5 text-xs font-bold text-[#7a5520]">{tx(g.title.replace("题型", ""))}</p>
                <SpecButtons specs={g.specs} onPick={setSpec} cols={11} />
              </div>
            ))}
          </section>

          <section className="hp-card p-3 sm:p-4">
            <h2 className="text-base font-black sm:text-lg">{tx("比赛题型")}</h2>
            {/* 2026-10-25 用户「比赛题型排版不好看」:世界 / 全国各一张小卡;卡内是「组别 × 加减算 / 乘算 / 除算」的整齐表格,
                没有的项目留浅色占位格,列对齐不参差;电脑上两张卡左右并排 */}
            <div className="mt-2 grid gap-3 lg:grid-cols-2">
              {comp.groups.map((g) => (
                <div key={g.title} className="rounded-2xl border border-[#e3cfa6] bg-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-[#B8925A]" />
                    <h3 className="text-sm font-black text-[#4a3415] sm:text-base">{tx(g.title.replace("模拟题", ""))}</h3>
                    <span className="text-[11px] text-muted-foreground">{tx(g.title.startsWith("世界") ? "按第九届模拟题样卷" : "按全国比赛样题")}</span>
                  </div>
                  <div className="grid grid-cols-[3.5rem_repeat(3,minmax(0,1fr))] items-center gap-1.5 sm:grid-cols-[4rem_repeat(3,minmax(0,1fr))]">
                    {(g.subs ?? [{ title: "", specs: g.specs }]).map((sub) => (
                      <CompRow key={sub.title} title={sub.title} specs={sub.specs} onPick={setSpec} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>}

        {tab === "custom" && (
          <section className="hp-card p-3 sm:p-4">
            <p className="mb-2 text-xs text-muted-foreground">{tx("自己定位数、笔数、小数；默认加减每张 20 题、乘除 60 题，想省纸可以调大每张题数，预览里选张数后打印或下载")}</p>
            <TrainBuilder onPreview={setSpec} />
          </section>
        )}
      </main>

      <ExamPreview spec={spec} onClose={() => setSpec(null)} />
    </div>
  );
}

// ===== 自定义出题:自己定位数、笔数;题量按一张 A4 自动定,只选张数 =====
type TrainKind = "addsub" | "mul" | "div";
function TrainBuilder({ onPreview }: { onPreview: (s: ExamSpec) => void }) {
  const { lang } = useI18n();
  const tx = useTx();
  const T = (zh: string, en: string) => (lang === "en" ? en : zh);
  const labW = lang === "en" ? "sm:w-20" : "sm:w-16"; // 英文行名(Operation / Questions)比两个汉字宽
  const [kind, setKind] = useState<TrainKind>("addsub");
  // 2026-10-25 用户「时间不需要」:自定义出题不设限时(卷面也不印限时)
  // 加减:最多 4 种位数各几笔
  const [rows, setRows] = useState<{ len: number; k: number }[]>([{ len: 3, k: 10 }, { len: 4, k: 0 }, { len: 2, k: 0 }, { len: 1, k: 0 }]);
  const [mixed, setMixed] = useState(true);
  const [dec, setDec] = useState(false);
  const [stage, setStage] = useState(0); // 指法知识点(0 = 不限;1–7 = COACH_STAGES)2026-11-06
  const [xs, setXs] = useState<number[]>([]); // 分数字(2026-11-12 付海东):空 = 本指法全部数字;否则只出这些数
  // 乘除
  const [a, setA] = useState(2), [b, setB] = useState(1);
  const [decN, setDecN] = useState(0), [places, setPlaces] = useState(2);

  const totalRows = rows.reduce((s, r) => s + r.k, 0);
  // 一张的题量按位数、笔数自动排满一张 A4(2026-10-26 用户「默认一张多少题,只让他调整张数,不让他调整题数」);张数在预览里选
  const make = useCallback((n: number): ExamSpec | null => {
    let sec: Section;
    let label: string;
    if (kind === "addsub") {
      if (totalRows < 2 || totalRows > 20) return null;
      const d: Record<number, number> = {};
      for (const r of rows) if (r.k > 0) d[r.len] = (d[r.len] ?? 0) + r.k;
      if (stage) {
        // 按指法知识点出题:每笔同为最大位数(≤6),加减由该指法决定(同 AI 陪练定向出题)
        const len = Math.min(6, Math.max(...rows.filter((r) => r.k > 0).map((r) => r.len)));
        const st = COACH_STAGES.find((x) => x.id === stage)!;
        const pick = xs.filter((x) => stageDigits(st).includes(x)).sort((p, q) => p - q);
        label = `${st.name}${pick.length ? `(${pick.join("、")})` : ""}·${len}位${totalRows}笔`;
        sec = { kind: "addsub", title: "加减算", onePage: true, parts: [{ n, d: { [len]: totalRows }, m: 0, stage, ...(pick.length ? { xs: pick } : {}) }] };
      } else {
      label = `${Object.entries(d).sort((x, y) => +y[0] - +x[0]).map(([l, k]) => `${l}位${k}笔`).join("+")}${mixed ? "加减混合" : "纯加"}${dec ? "（两位小数）" : ""}`;
      sec = { kind: "addsub", title: "加减算", onePage: true, parts: [{ n, d, m: mixed ? Math.max(1, Math.round(totalRows / 3)) : 0, dec }] };
      }
    } else {
      const k = Math.min(decN, n);
      label = kind === "mul" ? `${a}位×${b}位乘算` : `÷${a}位=${b}位除算`;
      sec = { kind, title: kind === "mul" ? "乘算" : "除算", onePage: true, freeDec: true, places: k ? places : 0, groups: [{ combos: [[a, b, n]], dec: k ? [Math.floor(k / 2), k - Math.floor(k / 2)] : undefined }] };
    }
    return { id: `train-${kind}`, label, title: `${label}练习`, level: "训练题", minutes: 0, sections: [sec] };
  }, [kind, rows, mixed, dec, a, b, decN, places, totalRows, stage, xs]);
  // 2026-10-27 付海东「加减固定 20 题、乘除 60 题」为默认;2026-10-31「做成可以设置的形式,默认这样没问题,但能调小,节省纸张」:
  // 把每张题数调大时行距和字自动收紧,最多到一页放得下的量(maxN);点「标准」回默认
  const [manualN, setManualN] = useState<number | null>(null);
  const maxN = useMemo(() => (make(1) ? fillCount((x) => make(x)!, kind) : 0), [make, kind]);
  // 加减标准 20 题;大位数一页放不下 20 题时,标准题量 = 一页放得下的量(2026-11-04 付海东「每次生成默认一张」)
  const baseN = kind === "addsub" ? Math.max(1, Math.min(20, maxN)) : 60, stepN = kind === "addsub" ? 5 : 10;
  const n = maxN ? Math.min(manualN ?? baseN, maxN) : 0;
  const pages = useMemo(() => (n ? sheetCount(make(n)!) : 0), [make, n]);
  const spec: ExamSpec | null = useMemo(() => (n ? make(n) : null), [make, n]);

  return (
    <div className="cfg-host">
      <div className="cfg-panel space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("w-full text-sm font-bold", labW)}>{T("项目", "Operation")}</span>
          <Seg options={[{ v: "addsub", label: "加减算" }, { v: "mul", label: "乘算" }, { v: "div", label: "除算" }]} value={kind} onChange={(v) => { setKind(v as TrainKind); setManualN(null); }} />
        </div>
        {kind === "addsub" ? (
          <>
            {/* 2026-10-25 用户「位数放一排,笔数放一排」,随后「加减的配置效果别变,别变成下拉」:
                仍用绿色 −/+ 步进器;四种位数一行、对应笔数下一行。手机上每个步进器竖排(+ 在上、− 在下),四个才放得下 */}
            <div>
              <div className="cfg-mini grid grid-cols-[2.5rem_repeat(4,minmax(0,1fr))] items-center justify-items-center gap-x-1 gap-y-2 sm:grid-cols-[3rem_repeat(4,max-content)] sm:justify-start sm:justify-items-start sm:gap-x-6">
                <span className="justify-self-start text-sm font-bold">{tx("位数")}</span>
                {rows.map((r, i) => (
                  <Num key={`l${i}`} value={r.len} min={1} max={10} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, len: v } : x)))} />
                ))}
                <span className="justify-self-start text-sm font-bold">{tx("笔数")}</span>
                {rows.map((r, i) => (
                  <Num key={`k${i}`} value={r.k} min={0} max={20} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, k: v } : x)))} />
                ))}
              </div>
              <p className={cn("mt-1 text-xs", totalRows > 20 ? "text-red-600" : "text-muted-foreground")}>{T(`每题共 ${totalRows} 笔（≤ 20），笔数为 0 的位数不出`, `${totalRows} terms per problem (≤ 20); digit sizes with 0 terms are skipped`)}</p>
            </div>
            {/* 指法知识点(2026-11-06 用户「把那几个指法的分类也做到出题系统里」) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("w-full text-sm font-bold", labW)}>{T("知识点", "Fingering")}</span>
              <div className="flex flex-wrap gap-1.5">
                {[{ id: 0, name: "不限" }, ...COACH_STAGES].map((st) => (
                  <button key={st.id} onClick={() => { setStage(st.id); setXs([]); }} className={cn("rounded-full border px-3 py-1 text-sm font-bold transition-colors", stage === st.id ? "border-[#ef8a3c] bg-[#ef8a3c] text-white" : "border-[#e8d3a8] bg-white text-[#7a5520] hover:bg-[#fff6e6]")}>{tx(st.name)}</button>
                ))}
              </div>
              {stage > 0 && (() => { const st = COACH_STAGES.find((x) => x.id === stage)!; const digs = stageDigits(st); const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-sm font-bold transition-colors", on ? "border-[#ef8a3c] bg-[#ef8a3c] text-white" : "border-[#e8d3a8] bg-white text-[#7a5520] hover:bg-[#fff6e6]"); return (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <span className={cn("w-full text-sm font-bold", labW)}>{T("分数字", "Digits")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setXs([])} className={chip(xs.length === 0)}>{tx("全部")}</button>
                    {st.variantGroups.map((g) => { const on = xs.length === g.xs.length && g.xs.every((x) => xs.includes(x)); return <button key={g.label} onClick={() => setXs(on ? [] : [...g.xs])} className={chip(on)}>{tx(g.label)}</button>; })}
                    <span className="mx-1 self-center text-xs text-muted-foreground">{T("或自选:", "or pick:")}</span>
                    {digs.map((x) => { const on = xs.includes(x); return <button key={x} onClick={() => setXs(on ? xs.filter((v) => v !== x) : [...xs, x].sort((p, q) => p - q))} className={cn(chip(on), "min-w-9 px-0")}>{x}</button>; })}
                  </div>
                  <p className="w-full text-xs text-muted-foreground">{xs.length ? T(`只出「${st.short}」里加减 ${xs.join("、")} 的题`, `Only ${st.short} problems with ${xs.join(", ")}`) : T(`本指法涉及的数字:${digs.join("、")};点选只练其中几个`, `Digits in this fingering: ${digs.join(", ")}; pick to restrict`)}</p>
                </div>
              ); })()}
              {stage > 0 && <p className="w-full text-xs text-muted-foreground">{T(`按「${COACH_STAGES.find((x) => x.id === stage)!.name}」出题:每笔都是 ${Math.min(6, Math.max(1, ...rows.filter((r) => r.k > 0).map((r) => r.len)))} 位(取上面最大的位数,最多 6 位),共 ${totalRows} 笔;每一笔都落在本指法上,加减由指法决定`, "Each term uses the chosen fingering; all terms share the largest digit size (≤ 6)")}</p>}
            </div>
            {!stage && <div className="flex flex-wrap items-center gap-3">
              <span className={cn("w-full text-sm font-bold", labW)}>{tx("类型")}</span>
              <Seg options={[{ v: "mix", label: "加减混合" }, { v: "add", label: "纯加" }]} value={mixed ? "mix" : "add"} onChange={(v) => setMixed(v === "mix")} />
              <Seg options={[{ v: "int", label: "整数" }, { v: "dec", label: "两位小数" }]} value={dec ? "dec" : "int"} onChange={(v) => setDec(v === "dec")} />
            </div>}
          </>
        ) : (
          <>
            {/* 2026-10-25 用户「和后面的要求对齐,应该放在前面」:每个小标签紧挨在自己的选择框前面,一行排下(之前「商」「保留」被挤到上一行末尾) */}
            {lang === "en" ? (
              // 英文标签长:手机上一行一对「标签 + 下拉」,电脑上两对一行;单位并进标签,下拉只显示数字
              <div className="grid grid-cols-[auto_minmax(0,6rem)] items-center gap-x-3 gap-y-2 sm:grid-cols-[auto_6rem_auto_6rem]">
                <span className="text-xs font-bold">{kind === "mul" ? "Multiplicand digits" : "Divisor digits"}</span>
                <Pick value={a} min={1} max={7} unit="" onChange={setA} />
                <span className="text-xs font-bold">{kind === "mul" ? "Multiplier digits" : "Quotient digits"}</span>
                <Pick value={b} min={1} max={7} unit="" onChange={setB} />
                <span className="text-xs font-bold">{kind === "mul" ? "Problems with decimals" : "Non-exact problems"}</span>
                <Pick value={Math.min(decN, n || 1)} min={0} max={Math.max(1, n)} unit="" onChange={setDecN} />
                <span className={cn("text-xs font-bold", !decN && "opacity-40")}>Decimal places</span>
                <Pick value={places} min={1} max={4} unit="" onChange={setPlaces} disabled={!decN} />
              </div>
            ) : (
              <div className="grid grid-cols-[2.5rem_auto_minmax(0,4.5rem)_auto_minmax(0,4.5rem)] items-center gap-x-2 gap-y-2">
                <span className="text-sm font-bold">位数</span>
                <span className="text-right text-xs text-muted-foreground">{kind === "mul" ? "被乘数" : "除数"}</span>
                <Pick value={a} min={1} max={7} unit="位" onChange={setA} />
                <span className="text-right text-xs text-muted-foreground">{kind === "mul" ? "乘数" : "商"}</span>
                <Pick value={b} min={1} max={7} unit="位" onChange={setB} />
                <span className="text-sm font-bold">小数</span>
                <span className="text-right text-xs text-muted-foreground">{kind === "mul" ? "带小数" : "除不尽"}</span>
                <Pick value={Math.min(decN, n || 1)} min={0} max={Math.max(1, n)} unit="题" onChange={setDecN} />
                <span className={cn("text-right text-xs text-muted-foreground", !decN && "opacity-40")}>保留</span>
                <Pick value={places} min={1} max={4} unit="位" onChange={setPlaces} disabled={!decN} />
              </div>
            )}
          </>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("w-full text-sm font-bold", labW)}>{tx("题量")}</span>
          <span className="flex items-center gap-2 text-sm">
            {T("每张", "Per sheet")}
            <Num value={n} min={stepN} max={Math.max(stepN, maxN)} step={stepN} unit={T("题", "")} onChange={(v) => setManualN(v === baseN ? null : v)} />
          </span>
          <button onClick={() => setManualN(null)} disabled={!maxN}
            className={cn("rounded-full border px-3 py-1 text-xs font-bold transition-colors", n === baseN ? "border-[#7a5520] bg-[#7a5520] text-white" : "border-[#d9c39b] bg-white/80 text-[#7a5520] hover:bg-white")}>
            {T(`标准 ${baseN} 题`, `Standard (${baseN})`)}
          </button>
          {maxN > baseN && (
            <button onClick={() => setManualN(maxN)}
              className={cn("rounded-full border px-3 py-1 text-xs font-bold transition-colors", n === maxN ? "border-[#7a5520] bg-[#7a5520] text-white" : "border-[#d9c39b] bg-white/80 text-[#7a5520] hover:bg-white")}>
              {T(`省纸 · 排满一张 ${maxN} 题`, `Save paper · fill sheet (${maxN})`)}
            </button>
          )}
          <span className="w-full text-xs text-muted-foreground">{lang === "en"
            ? (pages > 1 ? `These settings take ${pages} A4 pages per sheet.` : maxN > baseN ? "To save paper, raise the count: spacing and text tighten automatically." : "This size already fills the sheet.") + " Choose “Sheets” in the preview."
            : `${pages > 1 ? `这个位数笔数一张排 ${pages} 页 A4。` : maxN > baseN ? "想省纸就调大题数,行距和字会自动收紧。" : "这个位数笔数已经排满一张。"}要几张在预览里选「张数」。`}</span>
        </div>
        <button disabled={!spec} onClick={() => spec && onPreview(spec)} className="hp-leather hp-leather-on mt-2 flex w-full items-center justify-center gap-2 rounded-full py-3 text-lg font-black disabled:opacity-50">
          <Printer className="h-5 w-5" /> {tx("预览试卷")}
        </button>
      </div>
    </div>
  );
}

function SpecButtons({ specs, onPick, compact, cols }: { specs: ExamSpec[]; onPick: (s: ExamSpec) => void; compact?: boolean; cols?: number }) {
  const show = useSpecLabel();
  return (
    // 等级:手机一行 6 个、电脑一行 11 个;比赛:每个组别三个按钮,电脑上定宽不拉满整行
    <div className={cn("grid flex-1 gap-1.5", cols === 11 ? "grid-cols-6 sm:grid-cols-11" : "grid-cols-3 sm:max-w-md", !compact && !cols && "sm:grid-cols-4")}>
      {specs.map((s) => (
        <button key={s.id} onClick={() => onPick(s)} className={cn("whitespace-nowrap rounded-xl border border-[#d9c39b] bg-white/75 text-sm font-bold text-[#4a3415] shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md sm:text-base", cols ? "px-0 py-1" : compact ? "px-2 py-1" : "px-2 py-3", show(s.label).length > 5 && "text-xs")}>
          {show(s.label)}
        </button>
      ))}
    </div>
  );
}

/** 紧凑下拉选择(位数 / 笔数):比 −/+ 步进器窄,四个能在手机上排一行 */
function Pick({ value, min, max, unit, onChange, disabled }: { value: number; min: number; max: number; unit: string; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))}
      className={cn("h-9 w-full rounded-lg border border-[#d9c39b] bg-white/85 px-1 text-center text-sm font-bold text-[#4a3415] shadow-sm disabled:opacity-40", value === 0 && "text-muted-foreground")}>
      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((v) => <option key={v} value={v}>{unit ? `${v} ${unit}` : v}</option>)}
    </select>
  );
}

/** 比赛表格的一行:组别名 + 加减算 / 乘算 / 除算 三格(没有的项目留浅色占位) */
function CompRow({ title, specs, onPick }: { title: string; specs: ExamSpec[]; onPick: (s: ExamSpec) => void }) {
  const byKind = (k: "addsub" | "mul" | "div") => specs.find((s) => s.sections.every((x) => x.kind === k));
  const show = useSpecLabel();
  const { lang } = useI18n();
  return (
    <>
      <span className="truncate text-sm font-black text-[#4a3415]">{lang === "en" ? (COMP_ROW_EN[title] ?? title) : title}</span>
      {(["addsub", "mul", "div"] as const).map((k) => {
        const s = byKind(k);
        return s ? (
          <button key={k} onClick={() => onPick(s)} className="whitespace-nowrap rounded-xl border border-[#d9c39b] bg-white/85 py-1.5 text-sm font-bold text-[#4a3415] shadow-sm transition hover:-translate-y-0.5 hover:border-[#B8925A] hover:bg-white hover:shadow-md">
            {show(s.label)}
          </button>
        ) : (
          <span key={k} className="rounded-xl border border-dashed border-[#e6d4b0] py-1.5 text-center text-sm text-[#d8c39d]">—</span>
        );
      })}
    </>
  );
}
