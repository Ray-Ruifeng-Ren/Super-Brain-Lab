// Gauntlet Flash Math — 障碍闪电心算（v3：自由参数 + 三档干扰）
// 算式参数 = 用户自调（笔数 / 位数 / 闪速 / 减法）
// 干扰强度 = 三档（mild / strong / chaos），每档启用不同模组与强度参数
// 总难度 D = Df(算式) × Dc(干扰)，作为得分乘子

import { supabase } from "@/integrations/supabase/client";

export type ChaosLevel = "mild" | "strong" | "chaos";

export type ObstacleId = "drift" | "decoy" | "noise" | "blink" | "size" | "color";

export interface ChaosSpec {
  id: ChaosLevel;
  name: string;       // 中文短名
  label: string;      // UI 标签
  desc: string;
  multiplier: number; // 干扰难度系数 Dc
  obstacles: ObstacleId[];
  // 强度参数
  driftRange: number;     // 0..1 漂移区域占舞台的比例
  noiseCount: number;     // 噪点数字数量
  noiseOpacity: number;   // 噪点对比 0..1
  sizeJitter: number;     // 字号抖动幅度，例 0.3 = ±30%
  decoyCount: number;     // 干扰数字数量
  colorReverse: boolean;  // 是否启用颜色反转
}

export const CHAOS_LEVELS: Record<ChaosLevel, ChaosSpec> = {
  mild: {
    id: "mild",
    name: "低",
    label: "低 Mild",
    desc: "位置漂移 + 微弱噪点背景",
    multiplier: 1.4,
    obstacles: ["drift", "noise"],
    driftRange: 0.6,
    noiseCount: 20,
    noiseOpacity: 0.06,
    sizeJitter: 0,
    decoyCount: 0,
    colorReverse: false,
  },
  strong: {
    id: "strong",
    name: "中",
    label: "中 Strong",
    desc: "+ 字号抖动 + 1 个干扰假数字",
    multiplier: 1.9,
    obstacles: ["drift", "noise", "size", "decoy"],
    driftRange: 0.75,
    noiseCount: 40,
    noiseOpacity: 0.1,
    sizeJitter: 0.25,
    decoyCount: 1,
    colorReverse: false,
  },
  chaos: {
    id: "chaos",
    name: "强",
    label: "强 Chaos",
    desc: "+ 高密度噪点 + 2 干扰 + 颜色反转(橙色提示)",
    multiplier: 2.5,
    obstacles: ["drift", "noise", "size", "decoy", "color"],
    driftRange: 0.85,
    noiseCount: 70,
    noiseOpacity: 0.14,
    sizeJitter: 0.35,
    decoyCount: 2,
    colorReverse: true,
  },
};

export const CHAOS_ORDER: ChaosLevel[] = ["mild", "strong", "chaos"];

// 算式参数选项（与基线闪电心算保持兼容并扩展）
export const COUNT_OPTIONS = [3, 5, 7, 10, 15, 20];
export const DIGIT_OPTIONS = [1, 2, 3, 4];
export const SPEED_OPTIONS = [300, 400, 500, 700, 900, 1200];

export interface GauntletConfig {
  count: number;
  digits: number;
  speedMs: number;
  includeSub: boolean;
  chaos: ChaosLevel;
  blink: boolean; // M4 闪屏间隔，独立开关（光敏）
}

export const DEFAULT_GAUNTLET: GauntletConfig = {
  count: 5,
  digits: 2,
  speedMs: 700,
  includeSub: false,
  chaos: "strong",
  blink: false,
};

// 预设
export interface Preset {
  id: string;
  name: string;
  cfg: GauntletConfig;
}
export const PRESETS: Preset[] = [
  { id: "starter", name: "入门", cfg: { count: 3, digits: 1, speedMs: 900, includeSub: false, chaos: "mild", blink: false } },
  { id: "standard", name: "标准", cfg: { count: 5, digits: 2, speedMs: 700, includeSub: false, chaos: "strong", blink: false } },
  { id: "advanced", name: "进阶", cfg: { count: 7, digits: 2, speedMs: 500, includeSub: true, chaos: "strong", blink: false } },
  { id: "extreme", name: "极限", cfg: { count: 10, digits: 3, speedMs: 400, includeSub: true, chaos: "chaos", blink: false } },
];

// ─── 难度系数 ───
// Df = 1 + 0.10·(count-3) + 0.40·(digits-1) + 0.50·(900-speed)/200 + 0.30·subFlag
//    （以 5×2·900ms·纯加 ≈ 1.4 为基准；20×4·300ms·含减 ≈ 5.5）
export function computeDf(c: Pick<GauntletConfig, "count" | "digits" | "speedMs" | "includeSub">): number {
  const v =
    1 +
    0.1 * Math.max(0, c.count - 3) +
    0.4 * Math.max(0, c.digits - 1) +
    0.5 * Math.max(0, (900 - c.speedMs) / 200) +
    (c.includeSub ? 0.3 : 0);
  return Number(v.toFixed(2));
}

export function computeDc(chaos: ChaosLevel, blink: boolean): number {
  const base = CHAOS_LEVELS[chaos].multiplier;
  return Number((base + (blink ? 0.2 : 0)).toFixed(2));
}

export function computeD(cfg: GauntletConfig): number {
  return Number((computeDf(cfg) * computeDc(cfg.chaos, cfg.blink)).toFixed(2));
}

// 单局得分：基线 1000 + 速度奖励 200，乘以总难度 D
export function computeGauntletScore(
  cfg: GauntletConfig,
  correct: boolean,
  usedMs: number,
  answerWindowMs: number,
): number {
  if (!correct) return 0;
  const speedBonus = Math.max(0, (answerWindowMs - usedMs) / answerWindowMs) * 200;
  return Math.round((1000 + speedBonus) * computeD(cfg));
}

export function previewMaxScore(cfg: GauntletConfig): number {
  return Math.round((1000 + 200) * computeD(cfg));
}

// 三星阈值：满分的 0.85 / 0.7 / 0.5
export function starsFor(cfg: GauntletConfig, score: number): number {
  const max = previewMaxScore(cfg);
  if (score >= max * 0.85) return 3;
  if (score >= max * 0.7) return 2;
  if (score >= max * 0.5) return 1;
  return 0;
}

// ─── 排行榜 mode 编码 ───
// 例：5x2-700@strong  /  10x3-400+@chaos+blink
export function encodeMode(cfg: GauntletConfig): string {
  return `${cfg.count}x${cfg.digits}-${cfg.speedMs}${cfg.includeSub ? "+" : ""}@${cfg.chaos}${cfg.blink ? "+blink" : ""}`;
}

export function decodeMode(mode: string): GauntletConfig | null {
  const m = mode.match(/^(\d+)x(\d+)-(\d+)(\+?)@(mild|strong|chaos)(\+blink)?$/);
  if (!m) return null;
  return {
    count: Number(m[1]),
    digits: Number(m[2]),
    speedMs: Number(m[3]),
    includeSub: m[4] === "+",
    chaos: m[5] as ChaosLevel,
    blink: !!m[6],
  };
}

// ─── 通榜 GFI（Gauntlet Focus Index）───
// 扫描该用户所有玩过的 mode，按各自 D 加权求和，鼓励多配置覆盖。
// 三星额外 ×1.15。
export async function computeGauntletGFI(userId: string): Promise<{
  gfi: number;
  bestByMode: Record<string, { value: number; stars: number; D: number }>;
  modes: number;
}> {
  const { data } = await supabase
    .from("scores")
    .select("mode,value,meta")
    .eq("game", "gauntlet")
    .eq("user_id", userId);
  const bestByMode: Record<string, { value: number; stars: number; D: number }> = {};
  if (data) {
    for (const r of data as any[]) {
      const mode = String(r.mode);
      if (mode === "overall") continue;
      const cfg = decodeMode(mode);
      if (!cfg) continue;
      const v = typeof r.value === "string" ? Number(r.value) : Number(r.value);
      if (!Number.isFinite(v)) continue;
      const stars = Number(r.meta?.stars ?? 0);
      const D = computeD(cfg);
      const cur = bestByMode[mode];
      if (!cur || v > cur.value) bestByMode[mode] = { value: v, stars, D };
    }
  }
  let gfi = 0;
  let modes = 0;
  for (const key of Object.keys(bestByMode)) {
    const b = bestByMode[key];
    modes += 1;
    const starBonus = b.stars >= 3 ? 1.15 : 1;
    // 用 sqrt(D) 抑制极端高 D 配置垄断 GFI
    gfi += b.value * Math.sqrt(b.D) * starBonus;
  }
  return { gfi: Math.round(gfi), bestByMode, modes };
}

export async function submitGauntletOverall(userId: string): Promise<number> {
  const { gfi, modes } = await computeGauntletGFI(userId);
  if (gfi <= 0) return 0;
  const { data: prev } = await supabase
    .from("scores")
    .select("value")
    .eq("game", "gauntlet")
    .eq("mode", "overall")
    .eq("user_id", userId)
    .order("value", { ascending: false })
    .limit(1);
  const prevBest = prev && prev.length > 0 ? Number((prev[0] as any).value) : 0;
  if (gfi <= prevBest) return gfi;
  await supabase.from("scores").insert({
    user_id: userId,
    game: "gauntlet",
    mode: "overall",
    value: gfi,
    meta: { modes } as any,
  });
  return gfi;
}
