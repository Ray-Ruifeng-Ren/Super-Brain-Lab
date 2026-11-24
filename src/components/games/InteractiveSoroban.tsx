// 可拨的珠码(数珠互译「数→珠」作答用):与 Soroban 同款画法,点珠即拨。拨上的珠实心;没拨的珠淡显(要看得见才好点)。
// 上珠点一下=拨上/拨回(5);下珠:点未拨的第 i 颗 → 该颗及以上全部拨上(值 i+1);点已拨的第 i 颗 → 该颗及以下拨回(值 i)。
import { BAR_Y, BeadDefs, Beam, Diamond, ROD_W, SVG_H, earthY, heavenY, type Tone } from "./Soroban";
import { getLang } from "@/lib/langState";
import { IS_NATIVE } from "@/lib/appEnv";

function Rod({ digit, x, onDigit, roomy }: { digit: number; x: number; onDigit: (d: number) => void; roomy?: boolean }) {
  const cx = x + ROD_W / 2;
  const heavenActive = digit >= 5;
  const earth = digit % 5;
  const toggleHeaven = () => onDigit(heavenActive ? digit - 5 : digit + 5);
  const tapEarth = (i: number) => onDigit((heavenActive ? 5 : 0) + (i < earth ? i : i + 1));
  return (
    <g>
      {/* Pad App(2026-11-05 付海东「太挤」):画一根淡档杆,多位数时看得清每颗珠属于哪一档;每颗下珠整档宽都可点 */}
      {roomy && <line x1={cx} y1={4} x2={cx} y2={SVG_H - 4} stroke="#C9B48A" strokeOpacity={0.28} strokeWidth={2} />}
      <rect x={cx - ROD_W / 2} y={2} width={ROD_W} height={BAR_Y - 2} fill="transparent" style={{ cursor: "pointer" }} onClick={toggleHeaven} />
      {roomy && Array.from({ length: 4 }, (_, i) => <rect key={`h${i}`} x={cx - ROD_W / 2 + 2} y={earthY(i, i < earth) - 13} width={ROD_W - 4} height={26} fill="transparent" style={{ cursor: "pointer" }} onClick={() => tapEarth(i)} />)}
      <Diamond cx={cx} cy={heavenY(heavenActive)} faint={!heavenActive} onClick={toggleHeaven} />
      {Array.from({ length: 4 }, (_, i) => <Diamond key={i} cx={cx} cy={earthY(i, i < earth)} faint={i >= earth} onClick={() => tapEarth(i)} />)}
    </g>
  );
}

/** value 可以是数字串(2026-11-08 数珠互译最多 100 位,超过 15 位数字不精确):onChangeStr 回传完整数字串(含前导 0) */
export default function InteractiveSoroban({ digits, value, onChange, onChangeStr, tone = "light", big = false }: { digits: number; value: number | string; onChange?: (v: number) => void; onChangeStr?: (s: string) => void; tone?: Tone; big?: boolean }) {
  const str = (typeof value === "string" ? value.replace(/\D/g, "") : String(Math.max(0, value))).padStart(digits, "0").slice(-digits);
  const w = digits * ROD_W + 40;
  const setDigit = (i: number, d: number) => {
    const arr = str.split("");
    arr[i] = String(Math.max(0, Math.min(9, d)));
    onChangeStr?.(arr.join(""));
    onChange?.(Number(arr.join("")));
  };
  return (
    <svg viewBox={`0 0 ${w} ${SVG_H}`} width="100%" style={{ maxWidth: big ? Math.min(w * 3.2, 1100) : Math.min(w * 2, 640), touchAction: "manipulation" }} role="img" aria-label={`${getLang() === "en" ? "Abacus" : "算盘"} ${value}`}>
      <BeadDefs />
      <Beam w={w} digits={digits} tone={tone} />
      {str.split("").map((d, i) => <Rod key={i} digit={Number(d)} x={i * ROD_W + 20} roomy={IS_NATIVE} onDigit={(nd) => setDigit(i, nd)} />)}
    </svg>
  );
}
