// 作业项目编辑器:教练布置作业 / 课堂演示 共用。
// 2026-10-12 付海东「参数界面太乱」→ 改成表单式:一行一个参数,数字框可键盘输入、两侧 ◀▶ 微调,去掉一排排预设按钮。
import { useState } from "react";
import { CARRY_LABEL, OBSTACLE_KIND_LABEL, OBSTACLE_LEVEL_LABEL, DEFAULT_ITEM, OP_LABEL, PROJECT_EMOJI, PROJECT_LABEL, itemLabel, normalizeItem, type HwItem, type HwOp, type HwProject } from "@/lib/homework";
import type { Carry2 } from "@/lib/abacus";
import { COACH_STAGES } from "@/lib/fingering";
import { cn } from "@/lib/utils";
import { useTx } from "@/lib/tx";
import { useI18n } from "@/lib/i18n";

export function HwItemEditor({ value, onChange, showCount = true, hideProject = false }: { value: HwItem; onChange: (it: HwItem) => void; showCount?: boolean; hideProject?: boolean }) {
  const tx = useTx();
  const { lang } = useI18n();
  const en = lang === "en";
  const it = value;
  const set = (patch: Partial<HwItem>) => onChange(normalizeItem({ ...it, ...patch }));
  const isBead = it.project === "bead";
  // 2026-10-16 付海东「作业里的界面都乱了」:列数以前按视口宽度定(1366 屏=4 列),布置作业的编辑器只有 ~450px 宽,被硬塞 4 列 → 改为按容器宽度分列(index.css .cfg-host)
  return (
    <div className="cfg-host"><div className="cfg-panel cfg-grid">
      {!hideProject && (
        <Row label="项目">
          <Seg options={(["flash", "listen", "glance", "bead", "scroll", "obstacle"] as HwProject[]).map((pj) => ({ v: pj, label: `${PROJECT_EMOJI[pj]} ${tx(PROJECT_LABEL[pj])}` }))} value={it.project}
            onChange={(pj) => set({ project: pj, op: pj === "flash" || pj === "scroll" || pj === "obstacle" ? "addsub" : it.op })} />
        </Row>
      )}

      {isBead ? (
        <>
          {/* 2026-11-08 用户「把数译珠换成数码秒记,珠译数保留」:新选只有 珠→数 / 看数;旧作业里的 数→珠 仍能显示、能做 */}
          <Row label="方向"><Seg options={[{ v: "b2n", label: "珠 → 数" }, ...(it.beadDir === "n2b" ? [{ v: "n2b" as const, label: "数 → 珠" }] : []), { v: "see", label: "数码秒记" }]} value={it.beadDir} onChange={(v) => set({ beadDir: v })} /></Row>
          <Row label="位数"><Num value={it.beadDigits} min={1} max={100} unit="位" onChange={(v) => set({ beadDigits: v })} /></Row>
          {it.beadDir !== "b2n" && <Row label={it.beadDir === "see" ? "答题时间" : "限时"}><Num value={it.beadLimitSec} min={0} max={120} unit="秒" onChange={(v) => set({ beadLimitSec: v })} /><span className="text-[11px] text-muted-foreground">{tx("0 = 不限时")}</span></Row>}
          {it.beadDir !== "n2b" && <Row label={it.beadDir === "see" ? "看数时间" : "呈现"}><Num value={it.beadSpeedMs / 1000} min={0.3} max={10} step={0.1} decimals={2} unit="秒" onChange={(v) => set({ beadSpeedMs: Math.round(v * 1000) })} /></Row>}
        </>
      ) : (
        <>
          {it.project !== "flash" && it.project !== "scroll" && it.project !== "obstacle" && (
            <Row label="运算"><Seg options={(["addsub", "mul", "div"] as HwOp[]).map((op) => ({ v: op, label: OP_LABEL[op] }))} value={it.op} onChange={(op) => set({ op })} /></Row>
          )}
          {it.op === "addsub" && (
            <>
              {/* 知识点(2026-10-14 付海东「大部分学生处于满五加/破五减阶段,教练要能按关布置」):复用 AI 陪练七关;马拉松不需要 */}
              {it.project !== "scroll" && it.project !== "obstacle" && <Row label="知识点" span>
                <Seg options={[{ v: "0", label: "不限" }, ...COACH_STAGES.map((st) => ({ v: String(st.id), label: st.short }))]} value={String(it.stage)} onChange={(v) => set({ stage: Number(v), stageLesson: -1, digits: Number(v) > 0 ? Math.min(it.digits, 6) : it.digits })} />
              </Row>}
              {it.stage > 0 && (() => { const st = COACH_STAGES.find((x) => x.id === it.stage)!; return (
                <Row label="变式">
                  <Seg options={[{ v: "-1", label: "全部" }, ...st.variantGroups.map((g, gi) => ({ v: String(gi), label: g.label }))]} value={String(it.stageLesson)} onChange={(v) => set({ stageLesson: Number(v) })} />
                  <span className="text-[11px] text-muted-foreground">{tx(st.rule)}</span>
                </Row>
              ); })()}
              {it.stage > 0 ? (
                <Row label="位数"><Num value={it.digits} min={1} max={6} unit="位" onChange={(v) => set({ digits: v, digitsMax: v })} /><span className="text-[11px] text-muted-foreground">{tx("每一笔的指法都受本关约束")}</span></Row>
              ) : (
                <Row label="位数">
                  <Pair label="最小"><Num value={it.digits} min={1} max={12} unit="位" onChange={(v) => set({ digits: v, digitsMax: Math.max(v, it.digitsMax) })} /></Pair>
                  <Pair label="最大"><Num value={it.digitsMax} min={it.digits} max={12} unit="位" onChange={(v) => set({ digitsMax: v })} /></Pair>
                </Row>
              )}
              <Row label="笔数"><Num value={it.count} min={2} max={50} unit="笔" onChange={(v) => set({ count: v })} /></Row>
              {it.stage === 0 && <Row label="题型"><Seg options={[{ v: "add", label: "纯加" }, { v: "mix", label: "加减混合" }]} value={it.includeSub ? "mix" : "add"} onChange={(v) => set({ includeSub: v === "mix" })} /></Row>}
            </>
          )}
          {it.op === "mul" && (
            <>
              <Row label="位数">
                <Pair label="被乘数"><Num value={it.mulA} min={1} max={6} unit="位" onChange={(v) => set({ mulA: v })} /></Pair>
                <Pair label="乘数"><Num value={it.mulB} min={1} max={6} unit="位" onChange={(v) => set({ mulB: v })} /></Pair>
              </Row>
              {/* 2026-10-13 付海东「乘算基础」:特定乘数(乘数各位只用选中的数字)+ 进位组合(2位×1位) */}
              <Row label="特定乘数">
                <Multi options={[1, 2, 3, 4, 5, 6, 7, 8, 9]} value={it.mulDigits} onChange={(v) => set({ mulDigits: v })} />
                <span className="text-[11px] text-muted-foreground">{it.mulDigits.length ? tx("乘数只用选中的数字") : tx("不选 = 随机")}</span>
              </Row>
              <Row label="进位组合">
                <Seg options={(["any", "cc", "cn", "nc", "nn"] as Carry2[]).map((c) => ({ v: c, label: CARRY_LABEL[c] }))} value={it.mulA === 2 && it.mulB === 1 ? it.mulCarry : "any"} onChange={(v) => set({ mulCarry: v })} />
                <span className="text-[11px] text-muted-foreground">{it.mulA === 2 && it.mulB === 1 ? tx("进位 = 积满十:67×2 十位 6×2=12 进、个位 7×2=14 进;34×2 都不进") : tx("仅 2位×1位 可选")}</span>
              </Row>
            </>
          )}
          {it.op === "div" && (
            <>
              <Row label="位数">
                <Pair label="除数"><Num value={it.divD} min={1} max={5} unit="位" onChange={(v) => set({ divD: v })} /></Pair>
                <Pair label="商"><Num value={it.divQ} min={1} max={6} unit="位" onChange={(v) => set({ divQ: v })} /></Pair>
              </Row>
              {/* 2026-10-13 付海东「基础除算」:特定除数 + 够除/不够除 */}
              <Row label="特定除数">
                <Multi options={[2, 3, 4, 5, 6, 7, 8, 9]} value={it.divDigits} onChange={(v) => set({ divDigits: v })} />
                <span className="text-[11px] text-muted-foreground">{it.divDigits.length ? tx("除数只用选中的数字") : tx("不选 = 随机")}</span>
              </Row>
              <Row label="够除">
                <Seg options={[{ v: "any", label: "两者均可" }, { v: "yes", label: "够除" }, { v: "no", label: "不够除" }]} value={it.divEnough} onChange={(v) => set({ divEnough: v })} />
                {/* 2026-10-21 付海东:无小数时不够除答「商……余数」,保留位数只跟「小数」走 */}
                <span className="text-[11px] text-muted-foreground">{tx("够除 = 整除;不够除 = 除不尽:无小数时答「商……余数」,有小数时答案四舍五入到保留位数")}</span>
              </Row>
            </>
          )}
          {it.project === "obstacle" && (
            <>
              {/* 障碍算(2026-10-15 付海东录屏):干扰程度 + 干扰类型 + 加速 */}
              <Row label="干扰程度"><Seg options={(["low", "mid", "high"] as const).map((v) => ({ v, label: OBSTACLE_LEVEL_LABEL[v] }))} value={it.obstacleLevel} onChange={(v) => set({ obstacleLevel: v })} /></Row>
              <Row label="干扰类型"><Seg options={(["digits", "shapes", "filled"] as const).map((v) => ({ v, label: OBSTACLE_KIND_LABEL[v] }))} value={it.obstacleKind} onChange={(v) => set({ obstacleKind: v })} /></Row>
              <Row label="加速">
                <Seg options={[{ v: "no", label: "无" }, { v: "yes", label: "有" }]} value={it.scrollAccel ? "yes" : "no"} onChange={(v) => set({ scrollAccel: v === "yes" })} />
                {it.scrollAccel && <span className="text-[11px] text-muted-foreground">{tx("后面每题快")} 20%{en ? ": " : ":"}{(it.speedMs * 0.8 / 1000).toFixed(1)}s{en ? ", " : "、"}{(it.speedMs * 0.6 / 1000).toFixed(1)}s …</span>}
              </Row>
            </>
          )}
          {it.project === "scroll" && (
            <>
              {/* 心算马拉松(2026-10-14 付海东录屏):整题滚动秒数(加速/小数/知识点按付海东要求去掉) */}
              <Row label="整题用时"><Num value={it.scrollSec} min={2} max={180} unit="秒" onChange={(v) => set({ scrollSec: v })} /><span className="text-[11px] text-muted-foreground">{tx("一道题所有数字出完的总时间")}</span></Row>
            </>
          )}
          {it.op !== "addsub" && (
            <Row label="小数">
              <Seg options={[{ v: "no", label: "无" }, { v: "yes", label: "有" }]} value={it.decimals ? "yes" : "no"} onChange={(v) => set({ decimals: v === "yes" })} />
              {it.decimals && (<><span className="ml-2 text-xs text-muted-foreground">{tx("保留")}</span><Num value={it.decimalPlaces} min={0} max={4} unit={en ? "places" : "位"} onChange={(v) => set({ decimalPlaces: v })} /></>)}
              <span className="text-[11px] text-muted-foreground">{it.op === "div" ? tx("被除数、除数都是小数;商的位数含小数位(商4位·保留2位 → 12.34)") : tx("随机小数位,数值在 0.01–100;答案四舍五入到保留位数")}</span>
            </Row>
          )}
          {(it.project === "flash" || it.project === "glance") && it.op === "addsub" && (
            <Row label="计算方法"><Seg options={[{ v: "mental", label: "心算" }, { v: "bead", label: "珠算" }]} value={it.method} onChange={(v) => set({ method: v })} /><span className="text-[11px] text-muted-foreground">{it.method === "bead" ? tx("每一笔显示珠码,脑中拨珠(心算导入)") : tx("显示数字")}</span></Row>
          )}
          {(it.project === "flash" || it.project === "obstacle") && <Row label="每笔"><Num value={it.speedMs / 1000} min={0.1} max={5} step={0.05} decimals={2} unit="秒" onChange={(v) => set({ speedMs: Math.round(v * 1000) })} /></Row>}
          {it.project === "listen" && (
            <>
              <Row label="语速"><Num value={it.listenSpeed} min={1} max={10} unit="档" onChange={(v) => set({ listenSpeed: v })} /><span className="text-[11px] text-muted-foreground">{tx("1 慢 · 5 正常 · 10 极快")}</span></Row>
              <Row label="间隔"><Num value={it.listenSec / 1000} min={0} max={6} step={0.1} decimals={2} unit="秒" onChange={(v) => set({ listenSec: Math.round(v * 1000) })} /></Row>
              <Row label="报加号"><Seg options={[{ v: "yes", label: "有" }, { v: "no", label: "无" }]} value={it.announcePlus ? "yes" : "no"} onChange={(v) => set({ announcePlus: v === "yes" })} /></Row>
              <Row label="音色"><Seg options={[{ v: "female", label: "女声" }, { v: "male", label: "男声" }]} value={it.listenVoice} onChange={(v) => set({ listenVoice: v })} /></Row>
            </>
          )}
          {it.project === "glance" && <Row label="限时"><Num value={it.glanceLimitSec} min={0} max={120} unit="秒" onChange={(v) => set({ glanceLimitSec: v })} /><span className="text-[11px] text-muted-foreground">{tx("0 = 不限时")}</span></Row>}
        </>
      )}
      {showCount && <Row label="题量"><Num value={it.n} min={1} max={100} unit="题" onChange={(v) => set({ n: v })} /></Row>}
      <div className="cfg-summary cfg-full">🏷️ {itemLabel(it)}</div>
    </div></div>
  );
}

export const newItem = (patch?: Partial<HwItem>): HwItem => normalizeItem({ ...DEFAULT_ITEM, ...patch });

// 参数卡片(2026-10-13 用户:全站配置参考珠心算「参数设置」弹窗的 UI):emoji 标题 + 奶油卡片
const ROW_EMOJI: Record<string, string> = { 项目: "🧭", 运算: "➗", 知识点: "📚", 变式: "🧩", 计算方法: "🧠", 干扰程度: "🌪️", 干扰类型: "🧩", 整题用时: "⏱️", 加速: "🚀", 特定乘数: "✖️", 进位组合: "🔼", 特定除数: "➗", 够除: "⚖️", 小数: "🔸", 位数: "🔢", 笔数: "✏️", 题型: "➕", 每笔: "⚡", 语速: "🔊", 间隔: "⏱️", 报加号: "➕", 报数位: "🔢", 报数: "🗣️", 语言: "🌐", 音色: "🎙️", 限时: "⏱️", 场数: "🏁", 题量: "📝", 方向: "🔁", 呈现: "⏱️", 字号: "🔠", 音源: "🎚️" };
export function Row({ label, children, span = false }: { label: string; children: React.ReactNode; span?: boolean }) {
  const tx = useTx();
  return (
    <div className={cn("cfg-card", span && "cfg-span")}>
      <div className="cfg-card-title"><span>{ROW_EMOJI[label] ?? "⚙️"}</span>{tx(label)}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** 成对参数(被乘数/乘数、除数/商、最小/最大):标签定宽、整组不拆行,换行后两组左对齐(2026-10-14 付海东「乘数应跟被乘数对齐」) */
export function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  const tx = useTx();
  return <span className="cfg-pair inline-flex items-center gap-2"><span className="inline-block min-w-[3.5rem] text-right text-xs text-muted-foreground">{tx(label)}</span>{children}</span>;
}

/** 多选数字胶囊(特定乘数/除数):点选切换,可全不选 */
export function Multi({ options, value, onChange }: { options: number[]; value: number[]; onChange: (v: number[]) => void }) {
  const on = new Set(value);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((d) => (
        <button key={d} type="button" onClick={() => { const next = new Set(on); if (next.has(d)) next.delete(d); else next.add(d); onChange([...next].sort((a, b) => a - b)); }}
          className={cn("cfg-pill min-w-[2.4rem] px-0 text-center", on.has(d) && "cfg-pill-on")}>{d}</button>
      ))}
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const tx = useTx();
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} className={cn("cfg-pill", value === o.v && "cfg-pill-on")}>{tx(o.label)}</button>
      ))}
    </span>
  );
}

// 数字框:可键盘直接输入,两侧 ◀ ▶ 微调(按住连续变),失焦/回车夹取到范围
export function Num({ value, min, max, step = 1, unit, decimals = 0, onChange }: { value: number; min: number; max: number; step?: number; unit?: string; decimals?: number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const tx = useTx();
  const { lang } = useI18n();
  const fix = (v: number) => +Math.min(max, Math.max(min, v)).toFixed(decimals);
  const shown = decimals ? value.toFixed(decimals) : String(value);
  const commit = () => {
    if (text !== null && text.trim() !== "") { const v = Number(text); if (Number.isFinite(v)) onChange(fix(v)); }
    setText(null);
  };
  const nudge = (d: number) => onChange(fix(value + d));
  const hold = (d: number) => {
    nudge(d);
    let t = window.setTimeout(function rep() { nudge(d); t = window.setTimeout(rep, 70); }, 400);
    const stop = () => { clearTimeout(t); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
    window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop);
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" className="cfg-round" disabled={value <= min} onPointerDown={() => hold(-step)}>−</button>
      <input inputMode="decimal" value={text ?? shown} title={lang === "en" ? `${min}–${max}, type to enter` : `${min}–${max},可直接输入`}
        onFocus={() => setText(shown)} onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { commit(); (e.currentTarget as HTMLInputElement).blur(); } if (e.key === "ArrowUp") { e.preventDefault(); nudge(step); } if (e.key === "ArrowDown") { e.preventDefault(); nudge(-step); } }}
        className="cfg-num" />
      <button type="button" className="cfg-round" disabled={value >= max} onPointerDown={() => hold(step)}>+</button>
      {unit && <span className="whitespace-nowrap text-xs font-bold text-[#8B6B3E]">{tx(unit)}</span>}
    </span>
  );
}
