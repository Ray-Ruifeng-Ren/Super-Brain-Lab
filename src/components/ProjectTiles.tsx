// 首页主入口(2026-10-13 二版:用户「四个有点土,换成古典书,hover 翻开」)
// 五本皮面精装书:闪算 / 听算 / 看算 / 数珠互译 / 脑力游戏。悬停时封面沿书脊翻开,露出内页说明与「进入」。
import { PALM_LINE, PALM_CREASE } from "@/assets/palmIcon";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

export const PROJECT_TILES = [
  { id: "flash", emoji: "⚡", zh: "闪算", en: "Flash", hero: "闪电侠", heroEn: "The Flash", href: "/play/flashmath?mode=flash", leather: "#7A1F2B", blurb: "数字逐笔闪现,心中走珠", blurbEn: "Numbers flash one by one" },
  { id: "listen", emoji: "🔊", zh: "听算", en: "Listen", hero: "顺风耳", heroEn: "Clairaudient", href: "/play/flashmath?mode=listen", leather: "#1F3A5F", blurb: "只听不看,听声成数", blurbEn: "Hear it, compute it" },
  { id: "glance", emoji: "👀", zh: "看算", en: "Glance", hero: "千里眼", heroEn: "Clairvoyant", href: "/play/flashmath?mode=glance", leather: "#2E5A3C", blurb: "整列竖式,一眼算清", blurbEn: "See the column, solve it" },
  { id: "bead", emoji: "🧮", zh: "数珠互译", en: "Beads", hero: "算盘侠", heroEn: "Abacus Hero", href: "/play/abacus?project=bead", leather: "#4A2A5A", blurb: "珠码与数字互相翻译", blurbEn: "Beads ⇄ numbers" },
  { id: "scroll", emoji: "🏃", zh: "心算马拉松", en: "Marathon", hero: "飞毛腿", heroEn: "Swift Feet", href: "/play/abacus?project=scroll", leather: "#8A5A1E", blurb: "数字滚动而过,边看边算", blurbEn: "Numbers scroll by; keep the total" },
  { id: "obstacle", emoji: "🌪️", zh: "障碍算", en: "Obstacle", hero: "定海神针", heroEn: "Unshakable", href: "/play/abacus?project=obstacle", leather: "#2F4A3B", blurb: "干扰中盯住有效的数", blurbEn: "Track the live number amid distractors" },
] as const;

const GAMES_BOOK = { id: "games", emoji: "🎮", zh: "脑力游戏", en: "Brain Games", hero: "七十二变", heroEn: "72 Transformations", href: "/games", leather: "#2B2B2B", blurb: "舒尔特 · 反应 · N-Back…", blurbEn: "Schulte · Reaction · N-Back…" };

// 神话人物金线徽记(2026-10-13 用户:每个 logo 用神话人物):闪电侠 / 顺风耳 / 千里眼 / 算盘侠 / 七十二变(游戏)
export function Emblem({ id, emoji }: { id: string; emoji?: string }) {
  const g = "#E8CC8A";
  const common = { fill: "none", stroke: g, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 80 80" width="76" height="76" aria-hidden>
      <circle cx="40" cy="40" r="35" {...common} strokeWidth={1.6} opacity={0.9} />
      <circle cx="40" cy="40" r="30.5" {...common} strokeWidth={0.8} opacity={0.6} />
      {/* 指法教学(2026-11-03 用户给的手掌图改金色镂空,确认后更新):描线矢量,线宽不随缩放变化 */}
      {id === "teach" && (
        <g transform="translate(19.00 17.26) scale(0.02244) translate(0 2072) scale(0.1 -0.1)" strokeLinejoin="round">
          {PALM_LINE.map((d, i) => <path key={i} d={d} fill={g} stroke={g} strokeWidth={1.1} vectorEffect="non-scaling-stroke" />)}
          {PALM_CREASE.map((d, i) => <path key={`c${i}`} d={d} fill={g} stroke={g} strokeWidth={0.45} vectorEffect="non-scaling-stroke" opacity={0.85} />)}
        </g>
      )}
      {id === "flash" && (<>
        <polygon points="44,16 28,44 39,44 34,64 54,34 43,34 50,16" fill={g} stroke={g} strokeWidth={1} strokeLinejoin="round" />
        <path d="M18 30h9M14 40h11M18 50h9" {...common} />
      </>)}
      {id === "listen" && (<>
        <path d="M46 22c-9-4-18 2-18 12 0 5 3 7 3 12 0 5 2 8 7 8 5 0 6-4 7-7 2-4 8-6 8-14 0-5-3-9-7-11z" {...common} />
        <path d="M36 32c2-3 7-3 8 1 1 3-2 5-3 8" {...common} strokeWidth={1.6} />
        <path d="M14 28c5 0 6 4 11 4M12 40c6 0 7 4 13 4M14 52c5 0 6 4 11 4" {...common} strokeWidth={1.6} />
      </>)}
      {id === "glance" && (<>
        <path d="M16 40c7-10 16-15 24-15s17 5 24 15c-7 10-16 15-24 15s-17-5-24-15z" {...common} />
        <circle cx="40" cy="40" r="7" fill={g} />
        <circle cx="43" cy="37" r="2" fill="#2B2B2B" opacity={0.8} />
        <path d="M40 14v6M40 60v6M20 22l4 4M60 22l-4 4M20 58l4-4M60 58l-4-4" {...common} strokeWidth={1.6} />
      </>)}
      {id === "bead" && (<>
        <rect x="19" y="22" width="42" height="36" rx="4" {...common} />
        <path d="M19 34h42" {...common} />
        <path d="M30 22v36M40 22v36M50 22v36" {...common} strokeWidth={1.2} opacity={0.7} />
        <polygon points="30,25 35,29 30,33 25,29" fill={g} /><polygon points="50,25 55,29 50,33 45,29" fill={g} />
        <polygon points="30,37 35,41 30,45 25,41" fill={g} /><polygon points="40,37 45,41 40,45 35,41" fill={g} /><polygon points="40,46 45,50 40,54 35,50" fill={g} /><polygon points="50,37 55,41 50,45 45,41" fill={g} />
        <path d="M14 18l5 4M66 18l-5 4" {...common} strokeWidth={1.6} />
      </>)}
      {id === "scroll" && (<>
        {/* 飞毛腿 · 心算马拉松:秒表(表盘 + 表冠 + 指针 + 四刻度)+ 左侧两道风线,线描风格与千里眼一致 */}
        <circle cx="42" cy="44" r="16" {...common} />
        <path d="M38 22h8M42 22v6M54 28l4-4M42 44l7-7" {...common} />
        <circle cx="42" cy="44" r="1.8" fill={g} />
        <path d="M42 31v3M42 54v3M29 44h3M52 44h3" {...common} strokeWidth={1.6} />
        <path d="M12 36h9M10 44h8M12 52h9" {...common} strokeWidth={2} opacity={0.85} />
      </>)}
      {id === "obstacle" && (<>
        {/* 定海神针 · 障碍算:干扰噪点中的一个瞄准圈 */}
        <circle cx="40" cy="42" r="11" {...common} strokeWidth={2.6} />
        <circle cx="40" cy="42" r="3" fill={g} />
        <path d="M40 24v7M40 53v7M22 42h7M51 42h7" {...common} strokeWidth={2.4} />
        {[[18, 22], [60, 20], [24, 60], [58, 62], [14, 40], [66, 44], [30, 16], [52, 66]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2" fill={g} opacity={0.55} />)}
      </>)}
      {!["flash", "listen", "glance", "bead", "games", "scroll", "obstacle", "teach"].includes(id) && <text x="40" y="49" textAnchor="middle" fontSize="28">{emoji ?? "✦"}</text>}
      {id === "games" && (<>
        <path d="M24 30h32a10 10 0 0 1 10 10v2a9 9 0 0 1-16 5l-2-3H32l-2 3a9 9 0 0 1-16-5v-2a10 10 0 0 1 10-10z" {...common} />
        <path d="M28 36v8M24 40h8" {...common} /><circle cx="52" cy="38" r="1.8" fill={g} /><circle cx="57" cy="42" r="1.8" fill={g} />
        <path d="M40 18l2 5 5-2-2 5 5 2-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-2-2-5 5 2z" fill={g} opacity={0.9} transform="translate(0,-8) scale(.55) translate(33,8)" />
      </>)}
    </svg>
  );
}

export function Book({ b }: { b: { id: string; emoji: string; zh: string; en: string; hero: string; heroEn: string; href: string; leather: string; blurb: string; blurbEn: string } }) {
  const { lang } = useI18n();
  return (
    <Link to={b.href} className="book group block" aria-label={lang === "en" ? b.en : b.zh}>
      <div className="book-inner">
        {/* 内页:翻开后可见 */}
        <div className="book-page">
          <div className="book-page-rule" />
          <div className="px-4 pt-7 text-center">
            <div className="font-display text-lg font-bold text-[#3A2A1A]">{lang === "en" ? b.en : b.zh}</div>
            <div className="text-[10px] tracking-[0.25em] text-[#8B6B3E]">{lang === "en" ? b.heroEn : b.hero}</div>
            <div className="mt-2 text-[11px] leading-relaxed text-[#6B5A45]">{lang === "en" ? b.blurbEn : b.blurb}</div>
            <div className="mt-5 inline-block rounded-full border border-[#8B6B3E]/50 px-3 py-1 text-[11px] font-bold text-[#6B4E22]">{lang === "en" ? "Open →" : "进入 →"}</div>
          </div>
        </div>
        {/* 封面 */}
        <div className="book-cover" style={{ background: `linear-gradient(135deg, ${b.leather} 0%, ${b.leather} 55%, #000 160%)` }}>
          <div className="book-cover-frame" />
          <div className="flex h-full flex-col items-center justify-center gap-1.5">
            <Emblem id={b.id} emoji={b.emoji} />
            <span className="font-display text-xl font-bold tracking-[0.2em] text-[#E8CC8A]">{lang === "en" ? b.en : b.zh}</span>
            <span className="text-[11px] tracking-[0.3em] text-[#E8CC8A]/80">{lang === "en" ? b.heroEn : b.hero}</span>
          </div>
          <div className="book-ribbon" />
        </div>
        <div className="book-spine" style={{ background: b.leather }} />
      </div>
    </Link>
  );
}

export function ProjectTiles() {
  // 2026-11-02 用户「一行4个一行三个」:七本书排成 4 + 3 两行居中(窄屏每行内部仍可换行)
  const all = [...PROJECT_TILES, GAMES_BOOK];
  const rows = [all.slice(0, 4), all.slice(4)];
  return (
    <div className="flex flex-col items-center gap-3 sm:gap-6 md:gap-8">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end justify-center gap-3 sm:gap-6 md:gap-8">
          {row.map((b) => <Book key={b.id} b={b} />)}
        </div>
      ))}
    </div>
  );
}
