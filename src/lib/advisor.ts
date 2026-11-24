// 综合训练 · AI 建议栏 —— 四因子进阶逻辑(2026-09-08 与教练侧共识):
// 排序:题型(纯加→混合) → 时间(压到≤1秒/笔) → 位数(主进阶轴,+1位后时间放宽重爬) → 笔数(永远最后)。
// 背景:全国训练盲区是为马拉松项目(两位数/三位数100笔)疯狂堆笔数;本建议引擎刻意把位数放在笔数之前。
// 窗口:同一配置桶(呈现方式+位数区间+纯加/混合)近 20 题;正确率≥70% 视为稳定,<40% 触发保护性放宽。
// 另有「弱项指法」规则:某指法分类错误率明显偏高时,优先推荐去 AI 陪练对应关卡专项。
import { weakestClass, COACH_STAGES } from "@/lib/fingering";
import { getLang } from "@/lib/langState";
import { ZH_EN_PLAY } from "@/lib/tx-play";

export interface AdvisorCfg {
  mode: "flash" | "glance" | "listen";
  op: string;
  digits: number;
  digitsMax: number;
  includeSub: boolean;
  speedMs: number;        // 闪算:单笔时间
  count: number;
  listenSpeed?: number;   // 听算:报题速度档 1–10(时间因子)
  glanceLimitSec?: number; // 看算:每题限时秒,0=不限时(时间因子)
}

export interface Advice {
  key: string;               // 规则+参数指纹(忽略后不再重复弹同一条)
  title: string;
  detail: string;
  patch: Partial<Pick<AdvisorCfg, "digits" | "digitsMax" | "includeSub" | "speedMs" | "count" | "listenSpeed" | "glanceLimitSec">>;
  coachStage?: number;       // 有值 = 「去专项」建议:切到 AI 陪练该关
}

const KEY = "flashmath:advisor";
const WINDOW = 20;
const STABLE = 0.8;  // 付海东 2026-09-12:准确率 ≥80% 才进阶
const FLOOR = 0.4;
const GRAD_COUNT = 10; // 位数毕业要求:笔数 ≥10(10~15 笔皆可)

type Rec = { c: boolean; s: number };
type Store = { recs: Record<string, Rec[]>; dismissed?: string };

const bucketOf = (cfg: AdvisorCfg) => `${cfg.mode}|${cfg.digits}-${cfg.digitsMax}|${cfg.includeSub ? 1 : 0}`;

function load(): Store {
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return { recs: typeof p.recs === "object" && p.recs ? p.recs : {}, dismissed: typeof p.dismissed === "string" ? p.dismissed : undefined };
  } catch { return { recs: {} }; }
}
function save(st: Store) { try { window.localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* noop */ } }

/** 每答完一题(综合训练·加减·非重练/错题模式)记一笔。 */
export function recordAdvisorResult(cfg: AdvisorCfg, correct: boolean): void {
  if (cfg.op !== "addsub") return;
  const st = load();
  const b = bucketOf(cfg);
  st.recs[b] = [...(st.recs[b] ?? []), { c: correct, s: cfg.speedMs }].slice(-40);
  save(st);
}

export function advisorWindow(cfg: AdvisorCfg): { n: number; acc: number } {
  const arr = (load().recs[bucketOf(cfg)] ?? []).slice(-WINDOW);
  return { n: arr.length, acc: arr.length ? arr.filter((r) => r.c).length / arr.length : 0 };
}

export function dismissAdvice(key: string): void { const st = load(); st.dismissed = key; save(st); }

const r50 = (ms: number) => Math.round(ms / 50) * 50;
const pct = (v: number) => Math.round(v * 100);

/** 取当前配置下的一条建议(优先级取首条命中);无数据/被忽略/无可升级项 → null。 */
export function getAdvice(cfg: AdvisorCfg): Advice | null {
  if (cfg.op !== "addsub") return null;
  const { n, acc } = advisorWindow(cfg);
  // 英文界面(2026-10-27):同一套规则,只换文案;E(zh, en) 按当前语言取
  const en = getLang() === "en";
  const E = (zh: string, enText: string) => (en ? enText : zh);
  const digitsLabel = en
    ? (cfg.digitsMax > cfg.digits ? `${cfg.digits}-${cfg.digitsMax} digits` : `${cfg.digits} digits`)
    : (cfg.digitsMax > cfg.digits ? `${cfg.digits}-${cfg.digitsMax}位` : `${cfg.digits}位`);
  const easeDetail = E("稳住正确率再谈提速,连续挫败反而练不动。", "Steady your accuracy before speeding up; repeated misses stall progress.");
  let a: Advice | null = null;

  const listenSpeed = cfg.listenSpeed ?? 5;
  const glanceLimit = cfg.glanceLimitSec ?? 0;
  // 各呈现方式的「时间因子」是否已到位(≈1秒/笔的等价线):闪算≤1s/笔;听算≥8档;看算限时≤笔数秒
  const timeMaxed =
    cfg.mode === "flash" ? cfg.speedMs <= 1000 :
    cfg.mode === "listen" ? listenSpeed >= 8 :
    glanceLimit > 0 && glanceLimit <= Math.max(3, cfg.count);

  // ① 保护:正确率过低,先放宽时间——别硬撑
  if (n >= 10 && acc < FLOOR) {
    if (cfg.mode === "flash" && cfg.speedMs < 5000) {
      const to = Math.min(5000, r50(cfg.speedMs * 1.25));
      a = { key: `ease|${bucketOf(cfg)}|${to}`, title: E(`正确率 ${pct(acc)}%,建议先放宽单笔时间到 ${(to / 1000).toFixed(2)} 秒`, `Accuracy ${pct(acc)}%. Try slowing to ${(to / 1000).toFixed(2)}s per term`), detail: easeDetail, patch: { speedMs: to } };
    } else if (cfg.mode === "listen" && listenSpeed > 1) {
      a = { key: `ease|${bucketOf(cfg)}|${listenSpeed - 1}`, title: E(`正确率 ${pct(acc)}%,建议报题速度降到 ${listenSpeed - 1} 档`, `Accuracy ${pct(acc)}%. Try lowering the speed to level ${listenSpeed - 1}`), detail: easeDetail, patch: { listenSpeed: listenSpeed - 1 } };
    } else if (cfg.mode === "glance" && glanceLimit > 0) {
      a = { key: `ease|${bucketOf(cfg)}|0`, title: E(`正确率 ${pct(acc)}%,建议先取消每题限时`, `Accuracy ${pct(acc)}%. Try removing the time limit for now`), detail: easeDetail, patch: { glanceLimitSec: 0 } };
    }
  }

  // ①.5 弱项指法:某分类错误率 ≥30%(暴露≥15题)→ 推荐去 AI 陪练专项(错哪类练哪类)
  if (!a) {
    const weak = weakestClass();
    if (weak) {
      const st = COACH_STAGES.find((s) => s.id === weak.stageId);
      a = {
        key: `weak|${weak.cls}|${Math.round(weak.rate * 10)}`,
        title: E(`「${weak.cls}」类错误率 ${pct(weak.rate)}%,推荐去 AI 陪练第${weak.stageId}关专项`, `“${ZH_EN_PLAY[weak.cls] ?? weak.cls}” error rate ${pct(weak.rate)}%. Try AI Coach stage ${weak.stageId}`),
        detail: E(`错哪类练哪类,比继续刷综合更高效。${st ? `口诀:${st.formula}` : ""}`, `Drilling the exact weak spot beats more mixed practice.${st ? ` Rule: ${ZH_EN_PLAY[st.formula] ?? st.formula}` : ""}`),
        patch: {},
        coachStage: weak.stageId,
      };
    }
  }

  if (!a && n >= WINDOW && acc >= STABLE) {
    if (!cfg.includeSub) {
      // ② 题型:纯加稳定 → 开加减混合
      a = { key: `mix|${bucketOf(cfg)}`, title: E(`纯加已稳定(近${n}题 ${pct(acc)}%),建议开「加减混合」`, `Add-only is steady (${pct(acc)}% over ${n}). Try “Add & subtract”`), detail: E("混合才是真实运算能力,比继续刷纯加更值。", "Mixed problems build real skill; worth more than more add-only."), patch: { includeSub: true } };
    } else if (cfg.count < GRAD_COUNT) {
      // ②.5 笔数:位数毕业要求 10~15 笔,先把笔数提上来(在本位数内)
      a = { key: `cnt10|${bucketOf(cfg)}`, title: E(`${digitsLabel}·${cfg.count}笔已稳定(${pct(acc)}%),建议笔数提到 10 笔`, `${digitsLabel} · ${cfg.count} terms is steady (${pct(acc)}%). Try 10 terms`), detail: E("本位数毕业标准:10~15 笔 · ≤1秒/笔 · 80%,先把笔数提上来。", "To graduate a digit level: 10–15 terms · ≤1s/term · 80%. Raise the terms first."), patch: { count: 10 } };
    } else if (!timeMaxed) {
      // ③ 时间:各呈现方式压到 ≈1秒/笔 的等价线
      if (cfg.mode === "flash") {
        const to = Math.max(1000, r50(cfg.speedMs * 0.8));
        a = { key: `speed|${bucketOf(cfg)}|${to}`, title: E(`${digitsLabel}混合已稳定(${pct(acc)}%),建议单笔时间降到 ${(to / 1000).toFixed(2)} 秒`, `${digitsLabel} mixed is steady (${pct(acc)}%). Try ${(to / 1000).toFixed(2)}s per term`), detail: E("先把速度压到 1 秒/笔,再升位数。", "Get to 1s per term before adding digits."), patch: { speedMs: to } };
      } else if (cfg.mode === "listen") {
        a = { key: `speed|${bucketOf(cfg)}|${listenSpeed + 1}`, title: E(`${digitsLabel}混合已稳定(${pct(acc)}%),建议报题速度提到 ${listenSpeed + 1} 档`, `${digitsLabel} mixed is steady (${pct(acc)}%). Try speed level ${listenSpeed + 1}`), detail: E("先把报题速度提上来(目标 8 档),再升位数。", "Raise the reading speed (target: level 8) before adding digits."), patch: { listenSpeed: Math.min(10, listenSpeed + 1) } };
      } else {
        const to = glanceLimit === 0 ? Math.max(5, cfg.count * 2) : Math.max(Math.max(3, cfg.count), Math.round(glanceLimit * 0.8));
        a = { key: `speed|${bucketOf(cfg)}|${to}`, title: en
          ? (glanceLimit === 0 ? `${digitsLabel} mixed is steady (${pct(acc)}%). Try a ${to}s time limit` : `${digitsLabel} mixed is steady (${pct(acc)}%). Try tightening the limit to ${to}s`)
          : (glanceLimit === 0 ? `${digitsLabel}混合已稳定(${pct(acc)}%),建议开每题限时 ${to} 秒` : `${digitsLabel}混合已稳定(${pct(acc)}%),建议限时收紧到 ${to} 秒`), detail: E("先把作答时间压到约 1 秒/笔,再升位数。", "Get to about 1s per term before adding digits."), patch: { glanceLimitSec: to } };
      }
    } else if (cfg.digitsMax < 10) {
      // ④ 位数毕业(全位数同构,付海东 2026-09-12):笔数≥10 + ≤1秒/笔 + 80% → 升 1 位,
      // 笔数回到 5 重新起步、时间放宽重爬(如 二位10笔1秒80% → 三位5笔)
      const d = cfg.digitsMax + 1;
      const patch: Advice["patch"] = { digits: d, digitsMax: d, count: 5 };
      let extra = "";
      if (cfg.mode === "flash") { patch.speedMs = Math.min(5000, r50(cfg.speedMs * 1.5)); extra = E(`、单笔时间放宽到 ${(patch.speedMs / 1000).toFixed(2)} 秒`, `, ${(patch.speedMs / 1000).toFixed(2)}s per term`); }
      else if (cfg.mode === "listen") { patch.listenSpeed = Math.max(1, listenSpeed - 2); extra = E(`、报题速度回到 ${patch.listenSpeed} 档`, `, speed level ${patch.listenSpeed}`); }
      else { patch.glanceLimitSec = 0; extra = E("、先不限时", ", no time limit"); }
      a = { key: `digits|${bucketOf(cfg)}|${d}`, title: E(`${digitsLabel}·${cfg.count}笔·速度达标·${pct(acc)}%,毕业!建议升 ${d} 位,从 5 笔重新起步${extra}`, `${digitsLabel} · ${cfg.count} terms · on pace · ${pct(acc)}%: graduated! Move up to ${d} digits, restart at 5 terms${extra}`), detail: E("位数毕业三项:10~15笔 · ≤1秒/笔 · 80%。升位后笔数回 5,循环再爬。", "Graduation: 10–15 terms · ≤1s/term · 80%. After moving up, terms reset to 5 and you climb again."), patch };
    } else if (cfg.count < 100) {
      // ⑤ 笔数:位数/时间/题型都到位,才轮到它
      const to = Math.min(100, cfg.count * 2);
      a = { key: `count|${bucketOf(cfg)}|${to}`, title: E(`各轴都到位了,可以加笔数 → ${to} 笔`, `Everything's on target. Add terms → ${to}`), detail: E("笔数放最后升,面向马拉松项目(两位数/三位数100笔)。", "Terms come last, building toward marathon events (100 terms of 2–3 digits)."), patch: { count: to } };
    }
  }

  if (!a) return null;
  if (load().dismissed === a.key) return null;
  return a;
}
