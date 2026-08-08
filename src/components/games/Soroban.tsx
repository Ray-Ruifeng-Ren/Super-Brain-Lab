// 算盘(日式一五珠)显示:上珠=5,下珠=1。看珠训练用。
const BEAD = "#3FB8F5";
const INK = "#4B3A28";

function Rod({ digit, x }: { digit: number; x: number }) {
  const beadW = 40, beadH = 20;
  const cx = x + beadW / 2 + 6;
  const heavenActive = digit >= 5;
  const earthActive = digit % 5;
  const heavenY = heavenActive ? 42 : 8;
  const slotTop = 78, slotH = 27;
  const beads = [];

  beads.push(
    <ellipse key="h" cx={cx} cy={heavenY + beadH / 2} rx={beadW / 2} ry={beadH / 2}
      fill={BEAD} stroke={INK} strokeOpacity={0.15} />,
  );
  for (let i = 0; i < 4; i++) {
    const active = i < earthActive;
    const pos = active ? i : i + 1; // 未激活的跳过空档下沉
    const y = slotTop + pos * slotH;
    beads.push(
      <ellipse key={"e" + i} cx={cx} cy={y + beadH / 2} rx={beadW / 2} ry={beadH / 2}
        fill={BEAD} fillOpacity={active ? 1 : 0.32} stroke={INK} strokeOpacity={0.15} />,
    );
  }
  return (
    <g>
      <line x1={cx} y1={4} x2={cx} y2={216} stroke="#E9DCC0" strokeWidth={3} />
      {beads}
    </g>
  );
}

export default function Soroban({ value, digits }: { value: number; digits?: number }) {
  const str = String(value).padStart(digits || String(value).length, "0");
  const rodW = 52;
  const w = str.length * rodW + 12;
  const barY = 70;
  return (
    <svg viewBox={`0 0 ${w} 224`} width="100%" style={{ maxWidth: Math.min(w * 1.7, 520) }} role="img" aria-label={`算盘 ${value}`}>
      <rect x={2} y={2} width={w - 4} height={220} rx={12} fill="#FFFDF7" stroke="#D9B78A" strokeWidth={2.5} />
      <rect x={2} y={barY} width={w - 4} height={8} fill="#D9B78A" />
      {str.split("").map((d, i) => (
        <Rod key={i} digit={Number(d)} x={i * rodW + 6} />
      ))}
    </svg>
  );
}
