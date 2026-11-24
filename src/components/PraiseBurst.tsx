// 作答鼓励特效(2026-10-29;2026-11-08 用户「鼓励的样式多样一些,多一些新鲜感」→ 答对五种随机):
//   彩纸星星炸开 · 爱心往上飘 · 表情雨从上落下 · 星光圆环 · 火箭冲天;连对里程碑(big)粒子更多、范围更大。
//   答错 → 几颗星星和小拳头轻轻飘起,温和不刺眼。纯 CSS 动画(index.css .praise-p),每次 key 变化重放。
import { useMemo } from "react";

type P = { emoji: string; color?: string; dx: number; dy: number; x0: number; y0: number; size: number; delay: number; dur: number; rot: number };
const COLORS = ["#fbbf24", "#f472b6", "#60a5fa", "#34d399", "#a78bfa", "#fb923c"];
const NO_BITS = ["🌟", "💪", "✨", "🌱"];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

const VARIANTS: Record<string, (n: number, big: boolean) => P[]> = {
  // 彩纸 + 星星从中心炸开
  confetti: (n, big) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rnd(0, 0.4), r = (big ? 220 : 160) + rnd(0, big ? 140 : 90);
    const emoji = i % 3 === 0 ? pick(["⭐", "✨", "🌟", "🎉", "💫"]) : "";
    return { emoji, color: COLORS[i % COLORS.length], dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.8 - 30, x0: 0, y0: 0, size: emoji ? rnd(20, 32) : rnd(8, 14), delay: rnd(0, 80), dur: rnd(900, 1200), rot: rnd(-270, 270) };
  }),
  // 爱心从下往上飘
  hearts: (n, big) => Array.from({ length: Math.round(n * 0.6) }, () => ({ emoji: pick(["💖", "💛", "💙", "💚", "💜", "🧡"]), dx: rnd(-60, 60), dy: -rnd(180, big ? 380 : 280), x0: rnd(-220, 220), y0: rnd(40, 140), size: rnd(22, big ? 40 : 32), delay: rnd(0, 400), dur: rnd(1300, 1700), rot: rnd(-25, 25) })),
  // 表情雨从上方落下
  rain: (n, big) => Array.from({ length: Math.round(n * 0.7) }, () => ({ emoji: pick(["🎉", "🌟", "👏", "🥳", "⭐", "🍬", "🎈"]), dx: rnd(-30, 30), dy: rnd(260, big ? 460 : 360), x0: rnd(-320, 320), y0: -rnd(180, 300), size: rnd(22, big ? 40 : 32), delay: rnd(0, 500), dur: rnd(1200, 1600), rot: rnd(-90, 90) })),
  // 星光圆环:等距一圈向外扩散
  ring: (n, big) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, r = big ? 300 : 220; return { emoji: i % 2 ? "✨" : "⭐", dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.75, x0: 0, y0: 0, size: rnd(16, big ? 30 : 24), delay: (i % 4) * 30, dur: 1100, rot: rnd(-120, 120) }; }),
  // 火箭 / 烟花冲天
  rockets: (n, big) => Array.from({ length: Math.round(n * 0.45) }, (_, i) => ({ emoji: i % 3 === 0 ? "🚀" : pick(["🎆", "🎇", "✨", "🌟"]), dx: rnd(-80, 80), dy: -rnd(260, big ? 480 : 360), x0: rnd(-200, 200), y0: rnd(80, 160), size: rnd(22, big ? 40 : 32), delay: rnd(0, 350), dur: rnd(1000, 1400), rot: rnd(-20, 20) })),
};
const NAMES = Object.keys(VARIANTS);

export function PraiseBurst({ correct, big = false }: { correct: boolean; big?: boolean }) {
  const parts = useMemo<P[]>(() => {
    if (!correct) return Array.from({ length: 7 }, (_, i) => ({ emoji: NO_BITS[i % NO_BITS.length], dx: rnd(-130, 130), dy: -rnd(120, 240), x0: rnd(-100, 100), y0: 80, size: rnd(18, 28), delay: rnd(0, 250), dur: 1300, rot: rnd(-20, 20) }));
    return VARIANTS[pick(NAMES)](big ? 40 : 24, big);
  }, [correct, big]);
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-0 w-0">
      {parts.map((p, i) => (
        <span key={i} className="praise-p absolute"
          style={{ left: p.x0, top: p.y0, fontSize: p.size, width: p.emoji ? undefined : p.size, height: p.emoji ? undefined : p.size * 0.6, background: p.emoji ? undefined : p.color, borderRadius: p.emoji ? undefined : 2,
            ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px`, ["--rot" as string]: `${p.rot}deg`, animationDuration: `${p.dur}ms`, animationDelay: `${p.delay}ms` }}>
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
