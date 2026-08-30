// 难度系数 D —— 与《难度模型 v1》一致(位数指数 · 速度凸 · 笔数次线性 · 加减混合×1.3)。
// 加减(闪算/看算/听算):D = W位 × S × W笔 × μ
// 乘除:D = W位(实) × W位(法)

export interface DiffInput {
  mode: "flash" | "glance" | "listen"; // 呈现方式
  op: "addsub" | "mul" | "div";        // 运算类型
  count: number;
  digits: number;
  speedMs: number;
  listenSec: number;
  includeSub: boolean;
  mulA: number; mulB: number; divA: number; divB: number;
}

const Wd = (d: number) => Math.pow(1.6, Math.max(0, d - 1)); // 位数分,指数
const Sspd = (tSec: number) => Math.min(9, Math.pow(1 / Math.max(tSec, 0.05), 1.2)); // 速度分,凸,封顶9
const Wc = (n: number) => Math.min(3, Math.pow(Math.max(n, 1) / 5, 0.7)); // 笔数分,次线性,封顶3
const r1 = (v: number) => Math.round(v * 10) / 10;

/** 计算一道题(配置)的难度分 D。usedMs 仅看算加减需要(作答用时/笔 折算速度)。 */
export function difficultyD(cfg: DiffInput, usedMs = 0): number {
  if (cfg.op === "mul") return r1(Wd(cfg.mulA) * Wd(cfg.mulB));
  if (cfg.op === "div") return r1(Wd(cfg.divA) * Wd(cfg.divB));
  const mu = cfg.includeSub ? 1.3 : 1;
  let sSec: number;
  if (cfg.mode === "flash") sSec = cfg.speedMs / 1000;
  else if (cfg.mode === "listen") sSec = cfg.listenSec / 1000;
  else sSec = usedMs > 0 ? usedMs / Math.max(cfg.count, 1) / 1000 : 1; // 看算:作答用时/笔
  return r1(Wd(cfg.digits) * Sspd(sSec) * Wc(cfg.count) * mu);
}

/** 榜单项目前缀 —— 现按"呈现方式"分:flash / glance / listen。 */
export function modePrefix(mode: DiffInput["mode"]): string {
  return mode;
}

export const PROJECT_LABEL: Record<string, string> = {
  flash: "闪电心算", glance: "看算", listen: "听算",
};
