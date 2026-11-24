// 珠码显示(数珠互译用)。2026-10-12 按付海东给的教材截图重画:
// 浅底、细双线梁、梁上每三档一个定位点、不画档杆与外框;只画拨上的珠;珠=扁菱形、上亮下暗的立体阴影、紧贴梁、上下紧挨。
import { getLang } from "@/lib/langState";
export const ROD_W = 60;                 // 档距
export const BEAD_RX = 23, BEAD_RY = 13; // 珠半宽 / 半高(扁菱形)
export const BAR_Y = 62;                 // 梁上沿 y(上方刚好放下拨上/未拨两个上珠位)
const BAR_H = 7;                         // 双线梁厚度
const PAD_TOP = 8;
export const SVG_H = BAR_Y + BAR_H + BEAD_RY * 2 * 5 + 10;

export function BeadDefs() {
  return (
    <defs>
      {/* 立体感:上面受光亮绿、下面背光深绿,再加一圈边缘暗化与落影(2026-10-13 付海东:更有实体感,去掉中线) */}
      <linearGradient id="beadTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7DF08A" /><stop offset="0.55" stopColor="#3FCB52" /><stop offset="1" stopColor="#2DB33F" />
      </linearGradient>
      <linearGradient id="beadBottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#25A636" /><stop offset="0.6" stopColor="#188A27" /><stop offset="1" stopColor="#0F6B1C" />
      </linearGradient>
      <filter id="beadShadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="2.2" stdDeviation="1.6" floodColor="#000" floodOpacity="0.35" />
      </filter>
      <linearGradient id="beamFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4A4A4A" /><stop offset="1" stopColor="#1E1E1E" />
      </linearGradient>
      <linearGradient id="beamFillDark" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F3ECDC" /><stop offset="1" stopColor="#C9BFA8" />
      </linearGradient>
    </defs>
  );
}

/** 立体绿珠:上半面受光、下半面背光,带落影;无中线。 */
export function Diamond({ cx, cy, faint = false, onClick }: { cx: number; cy: number; faint?: boolean; onClick?: () => void }) {
  const op = faint ? 0.22 : 1;
  const st = onClick ? { cursor: "pointer" as const } : undefined;
  return (
    <g opacity={op} style={st} onClick={onClick} filter={faint ? undefined : "url(#beadShadow)"}>
      <polygon points={`${cx - BEAD_RX},${cy} ${cx},${cy - BEAD_RY} ${cx + BEAD_RX},${cy}`} fill="url(#beadTop)" />
      <polygon points={`${cx - BEAD_RX},${cy} ${cx + BEAD_RX},${cy} ${cx},${cy + BEAD_RY}`} fill="url(#beadBottom)" />
      <polygon points={`${cx - BEAD_RX},${cy} ${cx},${cy - BEAD_RY} ${cx + BEAD_RX},${cy} ${cx},${cy + BEAD_RY}`} fill="none" stroke="#0B5A17" strokeOpacity={0.45} strokeWidth={0.8} strokeLinejoin="round" />
    </g>
  );
}

/** 拨上的珠紧贴梁;下珠之间紧挨着叠;没拨的珠靠边(仅可拨算盘淡显)。 */
export const heavenY = (active: boolean) => (active ? BAR_Y - BEAD_RY : PAD_TOP + BEAD_RY);
export const earthY = (i: number, active: boolean) => BAR_Y + BAR_H + BEAD_RY + (active ? i : i + 1) * (BEAD_RY * 2);

export type Tone = "light" | "dark"; // light=浅色页面(黑梁);dark=深色舞台(浅梁)
/** 梁:一条实心横梁 + 定位点(个位档起每三档一个)。 */
export function Beam({ w, digits, tone = "light" }: { w: number; digits: number; tone?: Tone }) {
  const dot = tone === "dark" ? "#2B2B2B" : "#F5F1E6";
  return (
    <g>
      <rect x={6} y={BAR_Y} width={w - 12} height={BAR_H} rx={2} fill={tone === "dark" ? "url(#beamFillDark)" : "url(#beamFill)"} />
      {Array.from({ length: digits }, (_, i) => (digits - 1 - i) % 3 === 0 && (
        <circle key={i} cx={i * ROD_W + 20 + ROD_W / 2} cy={BAR_Y + BAR_H / 2} r={2.4} fill={dot} />
      ))}
    </g>
  );
}

function Rod({ digit, x }: { digit: number; x: number }) {
  const cx = x + ROD_W / 2;
  const heavenActive = digit >= 5;
  const earth = digit % 5;
  return (
    <g>
      {heavenActive && <Diamond cx={cx} cy={heavenY(true)} />}
      {Array.from({ length: earth }, (_, i) => <Diamond key={i} cx={cx} cy={earthY(i, true)} />)}
    </g>
  );
}

/** 2026-10-12 付海东:不要底板、要大气 —— 透明背景直接画在页面上;big 时放到接近整屏宽。 */
export default function Soroban({ value, digits, tone = "light", big = false }: { value: number | string; digits?: number; tone?: Tone; big?: boolean }) {
  const str = String(value).padStart(digits || String(value).length, "0");
  const w = str.length * ROD_W + 40;
  return (
    <svg viewBox={`0 0 ${w} ${SVG_H}`} width="100%" style={{ maxWidth: big ? Math.min(w * 3.2, 1100) : Math.min(w * 1.8, 640) }} role="img" aria-label={`${getLang() === "en" ? "Abacus" : "算盘"} ${value}`}>
      <BeadDefs />
      <Beam w={w} digits={str.length} tone={tone} />
      {str.split("").map((d, i) => <Rod key={i} digit={Number(d)} x={i * ROD_W + 20} />)}
    </svg>
  );
}
