// Gauntlet Flash Math — 障碍闪电心算
// 复用 buildProblem 出题，仅在"呈现层"叠加 6 个障碍模组。
// 难度系数 D 由模组权重之和决定，用于排行榜归一化。

import { supabase } from "@/integrations/supabase/client";

export type ObstacleId =
  | "drift" // M1 位置漂移
  | "decoy" // M2 干扰数字（灰色斜体）
  | "noise" // M3 噪点背景
  | "blink" // M4 闪屏间隔
  | "size" // M5 字号抖动
  | "color"; // M6 颜色反转符号（高阶）

export interface ObstacleSpec {
  id: ObstacleId;
  name: string;
  desc: string;
  weight: number; // 难度权重
}

export const OBSTACLES: Record<ObstacleId, ObstacleSpec> = {
  drift: { id: "drift", name: "位置漂移", desc: "数字在屏幕中央安全区随机出现", weight: 0.8 },
  decoy: { id: "decoy", name: "干扰数字", desc: "灰色斜体的假数字需忽略", weight: 1.0 },
  noise: { id: "noise", name: "噪点背景", desc: "低对比度背景纹理", weight: 0.6 },
  blink: { id: "blink", name: "闪屏间隔", desc: "数字之间穿插短暂闪屏", weight: 0.5 },
  size: { id: "size", name: "字号抖动", desc: "字号 ±30% 随机变化", weight: 0.4 },
  color: { id: "color", name: "颜色反转", desc: "橙色数字符号反转（蓝加橙减/反之）", weight: 1.2 },
};

export interface LevelConfig {
  level: number; // 1..10
  count: number;
  digits: number;
  speedMs: number;
  includeSub: boolean;
  obstacles: ObstacleId[];
  decoyCount: number; // 0/1/2
  // 难度系数 D = 1 + Σ weight
  difficulty: number;
}

function computeD(obs: ObstacleId[]): number {
  return Number((1 + obs.reduce((s, o) => s + OBSTACLES[o].weight, 0)).toFixed(2));
}

export const LEVELS: LevelConfig[] = [
  mk(1, 5, 1, 1000, false, ["drift"], 0),
  mk(2, 5, 2, 900, false, ["drift", "size"], 0),
  mk(3, 6, 2, 800, true, ["drift", "blink"], 0),
  mk(4, 7, 2, 700, true, ["drift", "decoy"], 1),
  mk(5, 7, 3, 700, true, ["drift", "decoy", "noise"], 1),
  mk(6, 8, 3, 600, true, ["drift", "decoy", "blink"], 2),
  mk(7, 9, 3, 550, true, ["drift", "decoy", "noise", "size"], 2),
  mk(8, 10, 3, 500, true, ["drift", "decoy", "blink", "color"], 2),
  mk(9, 10, 4, 450, true, ["drift", "decoy", "noise", "blink", "color"], 2),
  mk(10, 12, 4, 400, true, ["drift", "decoy", "noise", "blink", "size", "color"], 2),
];

function mk(
  level: number,
  count: number,
  digits: number,
  speedMs: number,
  includeSub: boolean,
  obstacles: ObstacleId[],
  decoyCount: number,
): LevelConfig {
  return {
    level,
    count,
    digits,
    speedMs,
    includeSub,
    obstacles,
    decoyCount,
    difficulty: computeD(obstacles),
  };
}

export const GAUNTLET_MAX_LEVEL = 10;

// 等级权重（对数曲线，鼓励通关而非死磕高等级）
export const GAUNTLET_LEVEL_WEIGHTS = LEVELS.map(
  (l) => +(Math.log2(l.level + 1) / Math.log2(11)).toFixed(3),
);

// 单局得分：基线 1000 全对 + 速度奖励 200，再乘难度系数
export function computeGauntletScore(
  level: LevelConfig,
  correct: boolean,
  usedMs: number,
  answerWindowMs: number,
): number {
  if (!correct) return 0;
  const raw = 1000;
  const speedBonus = Math.max(0, (answerWindowMs - usedMs) / answerWindowMs) * 200;
  return Math.round((raw + speedBonus) * level.difficulty);
}

// 获取三星阈值（满分的 0.85/0.7/0.5）
export function starsFor(level: LevelConfig, score: number): number {
  const max = Math.round((1000 + 200) * level.difficulty);
  if (score >= max * 0.85) return 3;
  if (score >= max * 0.7) return 2;
  if (score >= max * 0.5) return 1;
  return 0;
}

// 通榜 GFI（Gauntlet Focus Index）
export async function computeGauntletGFI(userId: string): Promise<{
  gfi: number;
  bestByLevel: Record<number, { value: number; stars: number }>;
  cleared: number;
}> {
  const { data } = await supabase
    .from("scores")
    .select("mode,value,meta")
    .eq("game", "gauntlet")
    .eq("user_id", userId)
    .like("mode", "L%");
  const bestByLevel: Record<number, { value: number; stars: number }> = {};
  if (data) {
    for (const r of data as any[]) {
      const m = String(r.mode).match(/^L(\d+)$/);
      if (!m) continue;
      const lv = Number(m[1]);
      if (lv < 1 || lv > GAUNTLET_MAX_LEVEL) continue;
      const v = typeof r.value === "string" ? Number(r.value) : r.value;
      const stars = Number(r.meta?.stars ?? 0);
      const cur = bestByLevel[lv];
      if (!cur || v > cur.value) bestByLevel[lv] = { value: v, stars };
    }
  }
  let gfi = 0;
  let cleared = 0;
  for (let lv = 1; lv <= GAUNTLET_MAX_LEVEL; lv++) {
    const b = bestByLevel[lv];
    if (!b) continue;
    cleared += 1;
    const starBonus = b.stars >= 3 ? 1.15 : 1;
    gfi += b.value * GAUNTLET_LEVEL_WEIGHTS[lv - 1] * starBonus;
  }
  return { gfi: Math.round(gfi), bestByLevel, cleared };
}

export async function submitGauntletOverall(userId: string): Promise<number> {
  const { gfi, cleared } = await computeGauntletGFI(userId);
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
    meta: { cleared } as any,
  });
  return gfi;
}
