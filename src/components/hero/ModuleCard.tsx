import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import { ART } from "./art/ModuleArt";

type Props = {
  id: string;
  index: number;
  name: string;
  tagline: string;
  featured?: boolean;
  rotate: number;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  shift: number;
};

// Unified vintage deep-gold palette across every card.
const GOLD = {
  top: "#3a2a10",     // burnt amber top
  bot: "#1c1306",     // deep walnut bottom
  ink: "#f3e1b4",     // aged ivory text
  gild: "#caa258",    // gilded edge
  accent: "#e8b85a",  // bright gold highlight
};
const PALETTE: Record<string, typeof GOLD> = {
  flashmath: GOLD, gauntlet: GOLD, schulte: GOLD, nback: GOLD,
  reaction: GOLD, cards: GOLD, orbit: GOLD,
};

export function ModuleCard({
  id, index, name, tagline, featured, rotate, hovered, onHover, onLeave, shift,
}: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, sx: 50 });
  const Art = ART[id] ?? ART.flashmath;
  const p = PALETTE[id] ?? PALETTE.flashmath;

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({
      ry: (px - 0.5) * 14,
      rx: -(py - 0.5) * 10,
      sx: px * 100,
    });
  };
  const onOut = () => { setTilt({ rx: 0, ry: 0, sx: 50 }); onLeave(); };

  const baseRotate = hovered ? 0 : rotate;
  const lift = hovered ? -18 : 0;
  const scale = hovered ? 1.06 : 1;

  return (
    <Link
      ref={ref}
      to={`/play/${id}`}
      onMouseEnter={onHover}
      onMouseMove={onMove}
      onMouseLeave={onOut}
      className="group relative block aspect-[5/7] w-full"
      style={{
        perspective: 1400,
        zIndex: hovered ? 30 : 10 + index,
        transform: `translateX(${shift}px)`,
        transition: "transform 360ms cubic-bezier(.2,.7,.2,1), z-index 0s",
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[14px]"
        style={{
          background: `
            radial-gradient(120% 80% at 50% 0%, ${p.top} 0%, ${p.bot} 75%),
            linear-gradient(180deg, ${p.top}, ${p.bot})
          `,
          color: p.ink,
          boxShadow: hovered
            ? `0 30px 70px -28px rgba(8,10,14,0.55), 0 0 0 1px ${p.gild}55, inset 0 0 0 1px ${p.gild}66, inset 0 0 60px ${p.bot}`
            : `0 10px 28px -18px rgba(8,10,14,0.45), 0 0 0 1px ${p.gild}33, inset 0 0 0 1px ${p.gild}44`,
          transform: `translateY(${lift}px) rotate(${baseRotate}deg) scale(${scale}) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 420ms cubic-bezier(.2,.7,.2,1), box-shadow 300ms",
        }}
      >
        {/* aged parchment grain */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,240,200,0.7) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.4) 1px, transparent 1px)",
            backgroundSize: "3px 3px, 5px 5px",
            backgroundPosition: "0 0, 1px 2px",
          }}
        />

        {/* vignette */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 80% at 50% 110%, transparent 40%, ${p.bot} 95%)`,
          }}
        />

        {/* ornate triple frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[5px] rounded-[10px]"
          style={{ border: `1px solid ${p.gild}99` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[9px] rounded-[8px]"
          style={{ border: `0.5px solid ${p.gild}55` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[13px] rounded-[6px]"
          style={{ border: `0.5px dashed ${p.gild}44` }}
        />

        {/* corner flourishes — more elaborate */}
        {[
          { pos: { top: 6, left: 6 }, r: "rotate(0deg)" },
          { pos: { top: 6, right: 6 }, r: "rotate(90deg)" },
          { pos: { bottom: 6, left: 6 }, r: "rotate(-90deg)" },
          { pos: { bottom: 6, right: 6 }, r: "rotate(180deg)" },
        ].map((c, i) => (
          <svg
            key={i}
            aria-hidden
            width="26" height="26" viewBox="0 0 32 32"
            className="pointer-events-none absolute"
            style={{ ...c.pos, transform: c.r, color: p.gild }}
          >
            <path d="M2 2 H14 M2 2 V14" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.9" />
            <path d="M2 2 Q10 4 14 14 Q12 10 6 8 Q4 7 3 5" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.75" />
            <circle cx="14" cy="14" r="1" fill="currentColor" opacity="0.8" />
            <path d="M5 5 Q7 6 8 8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
          </svg>
        ))}

        {/* TOP BAR — Roman numeral + name + seal */}
        <div className="relative flex items-center gap-2.5 px-5 pt-5">
          <span
            className="font-display text-[15px] leading-none"
            style={{ color: p.gild, letterSpacing: "0.14em" }}
          >
            {toRoman(index + 1)}
          </span>
          <span
            aria-hidden
            className="block h-px flex-shrink-0"
            style={{ width: 10, background: `${p.gild}aa` }}
          />
          <h3
            className="flex-1 truncate font-display text-[14px] leading-none"
            style={{ color: p.ink, letterSpacing: "0.02em" }}
            title={name}
          >
            {name}
          </h3>
          <span
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
            style={{
              border: `1px solid ${p.gild}99`,
              background: featured ? p.accent : "transparent",
              boxShadow: `inset 0 0 4px ${p.bot}`,
            }}
          >
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: featured ? p.bot : p.gild }}
            />
          </span>
        </div>

        {/* ornamental divider under title */}
        <div className="relative mx-5 mt-2 flex items-center gap-1.5">
          <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${p.gild}88)` }} />
          <svg width="10" height="6" viewBox="0 0 10 6" style={{ color: p.gild }}>
            <path d="M0 3 L4 3 M6 3 L10 3 M5 0 L5 6 M3 1 L5 3 L7 1 M3 5 L5 3 L7 5" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.85" />
          </svg>
          <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${p.gild}88, transparent)` }} />
        </div>

        {/* art portrait window */}
        <div className="relative mx-5 mt-3">
          <div
            className="relative aspect-square w-full overflow-hidden rounded-[6px]"
            style={{
              background: `radial-gradient(80% 80% at 50% 35%, ${p.accent}33 0%, ${p.bot} 75%)`,
              boxShadow: `inset 0 0 0 1px ${p.gild}88, inset 0 0 0 2.5px ${p.bot}, inset 0 0 0 3px ${p.gild}55, inset 0 0 30px ${p.bot}`,
            }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: p.accent }}
            >
              <div className="h-[78%] w-[78%]">
                <Art />
              </div>
            </div>
            {/* halo */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(50% 30% at 50% 25%, ${p.accent}55, transparent 70%)`,
              }}
            />
            {/* portrait corner ticks */}
            {[
              { top: 3, left: 3, r: 0 },
              { top: 3, right: 3, r: 90 },
              { bottom: 3, left: 3, r: -90 },
              { bottom: 3, right: 3, r: 180 },
            ].map((c, i) => (
              <svg key={i} aria-hidden width="8" height="8" viewBox="0 0 8 8" className="absolute" style={{ ...c, transform: `rotate(${c.r}deg)`, color: p.gild }}>
                <path d="M0 0 H4 M0 0 V4" fill="none" stroke="currentColor" strokeWidth="0.8" />
              </svg>
            ))}
          </div>
        </div>

        {/* BOTTOM — tagline + scrollwork */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${p.gild}88)` }} />
            <svg width="14" height="6" viewBox="0 0 14 6" style={{ color: p.gild }}>
              <path d="M0 3 Q3 0 7 3 Q11 6 14 3" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.85" />
              <circle cx="7" cy="3" r="0.8" fill="currentColor" opacity="0.9" />
            </svg>
            <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${p.gild}88, transparent)` }} />
          </div>
          <p
            className="text-center font-mono-tabular text-[9px] uppercase"
            style={{ color: p.gild, letterSpacing: "0.28em", opacity: 0.9 }}
          >
            {tagline}
          </p>
        </div>

        {/* sweep shine on hover */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: hovered ? 0.6 : 0,
            background: `linear-gradient(105deg, transparent 35%, ${p.gild}55 ${tilt.sx}%, transparent 65%)`,
            mixBlendMode: "screen",
          }}
        />

      </div>
    </Link>
  );
}

function toRoman(n: number): string {
  const map: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let s = "", r = n;
  for (const [v, sym] of map) while (r >= v) { s += sym; r -= v; }
  return s;
}
