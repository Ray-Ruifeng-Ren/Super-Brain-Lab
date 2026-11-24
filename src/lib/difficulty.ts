// 难度系数 D —— 与《难度模型 v1》一致(位数指数 · 速度凸 · 笔数次线性 · 加减混合×1.3)。
// 加减(闪算/看算/听算):D = W位 × S × W笔 × μ
// 乘除(2026-09 v2,付海东反馈):任何位数超过 5 位后边际难度减半(分水岭);
//   乘法 D = 4×(eff(被乘位)·eff(乘位))^0.85;
//   除法与被除数无关,D = 4×(eff(除数位)^0.8 × 商位^1.2)^0.85(商权重是除数的 1.5 倍)。

export interface DiffInput {
  mode: "flash" | "glance" | "listen"; // 呈现方式
  op: "addsub" | "mul" | "div";        // 运算类型
  count: number;
  digits: number;
  digitsMax?: number; // 加减:位数上限(混合位数);缺省=digits(定长)
  speedMs: number;
  listenSec: number;
  listenSpeed?: number; // 听算速度档 1–10(越快越难)
  includeSub: boolean;
  mulA: number; mulB: number;
  divD: number; // 除法:除数位数
  divQ: number; // 除法:商位数
}

const Wd = (d: number) => Math.pow(1.6, Math.max(0, d - 1)); // 位数分,指数
const Sspd = (tSec: number) => Math.min(9, Math.pow(1 / Math.max(tSec, 0.05), 1.2)); // 速度分,凸,封顶9
const Wc = (n: number) => Math.min(3, Math.pow(Math.max(n, 1) / 5, 0.7)); // 笔数分,次线性,封顶3
const r1 = (v: number) => Math.round(v * 10) / 10;

/** 位数有效值:5 位是分水岭,超过后每多一位只按半位计(边际难度减半)。 */
const effDigits5 = (x: number) => {
  const d = Math.max(1, x);
  return d <= 5 ? d : 5 + (d - 5) * 0.5;
};

/**
 * 乘法难度分 —— 两操作数位数之积的次线性增长,超 5 位分水岭。
 * 参考:2×2≈13,3×3≈26,4×4≈42,5×5≈62;4×5≈51,4×6≈55,4×7≈60,4×8≈64(超5位后仍递增但差距缩小)。
 */
export function mulD(aDigits: number, bDigits: number): number {
  const ab = effDigits5(aDigits) * effDigits5(bDigits);
  return r1(4 * Math.pow(ab, 0.85));
}

/**
 * 除法难度分 —— 只由 除数位数 与 商位数 决定,与被除数无关(付海东 2026-09)。
 * 商权重是除数的 1.5 倍(指数 1.2 vs 0.8);除数超 5 位走分水岭。
 * 排序:除2商2 > 除1商2 > 除2商1;除2商3 > 除3商2 > 除2商2;除5商6 > 除6商5 > 除5商5。
 * 参考:除1商1=4,除2商2=13,除2商3≈20,除5商5≈62,除5商6≈74,除8商3≈44。
 */
export function divisionD(divisorDigits: number, quotientDigits: number): number {
  const d = effDigits5(divisorDigits);
  const q = Math.max(1, quotientDigits);
  return r1(4 * Math.pow(Math.pow(d, 0.8) * Math.pow(q, 1.2), 0.85));
}

/** 计算一道题(配置)的难度分 D。usedMs 仅看算加减需要(作答用时/笔 折算速度)。 */
export function difficultyD(cfg: DiffInput, usedMs = 0): number {
  if (cfg.op === "mul") return mulD(cfg.mulA, cfg.mulB);
  if (cfg.op === "div") return divisionD(cfg.divD, cfg.divQ);
  const mu = cfg.includeSub ? 1.3 : 1;
  const effDigits = (cfg.digits + (cfg.digitsMax ?? cfg.digits)) / 2; // 混合位数按平均位数计难度
  let sSec: number;
  if (cfg.mode === "flash") sSec = cfg.speedMs / 1000;
  else if (cfg.mode === "listen") sSec = Math.max(0.3, 1.5 - (cfg.listenSpeed ?? 5) * 0.12); // 速度档越高→有效每笔越短→越难
  else sSec = usedMs > 0 ? usedMs / Math.max(cfg.count, 1) / 1000 : 1; // 看算:作答用时/笔
  return r1(Wd(effDigits) * Sspd(sSec) * Wc(cfg.count) * mu);
}

/** 榜单项目前缀 —— 现按"呈现方式"分:flash / glance / listen。 */
export function modePrefix(mode: DiffInput["mode"]): string {
  return mode;
}

export const PROJECT_LABEL: Record<string, string> = {
  flash: "闪电心算", glance: "看算", listen: "听算",
};
