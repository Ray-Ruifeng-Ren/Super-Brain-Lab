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
        {/* Layer 1: SVG fractal noise — real fiber grain */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.92  0 0 0 0 0.78  0 0 0 0 0.52  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            backgroundSize: "240px 240px",
            opacity: 0.35,
            mixBlendMode: "screen",
          }}
        />

        {/* Layer 2: coarse paper fibre — large soft turbulence */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='3' seed='3'/><feColorMatrix values='0 0 0 0 0.05  0 0 0 0 0.03  0 0 0 0 0.01  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            backgroundSize: "100% 100%",
            opacity: 0.55,
            mixBlendMode: "multiply",
          }}
        />

        {/* Layer 3: foxing — scattered amber age spots */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 18% 22%, rgba(120,70,20,0.55) 0%, transparent 4%),
              radial-gradient(circle at 78% 14%, rgba(90,50,15,0.5) 0%, transparent 3%),
              radial-gradient(circle at 64% 58%, rgba(110,65,20,0.45) 0%, transparent 5%),
              radial-gradient(circle at 12% 78%, rgba(80,45,12,0.5) 0%, transparent 4%),
              radial-gradient(circle at 88% 86%, rgba(120,70,25,0.4) 0%, transparent 5%),
              radial-gradient(circle at 42% 38%, rgba(95,55,18,0.35) 0%, transparent 6%)
            `,
            mixBlendMode: "multiply",
          }}
        />

        {/* Layer 4: vignette — burnt edges */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(130% 90% at 50% 50%, transparent 35%, ${p.bot} 100%)`,
            opacity: 0.85,
          }}
        />

        {/* Layer 5: water-stain wash — top-left */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 40% at 22% 18%, rgba(60,30,8,0.3) 0%, transparent 70%)",
            mixBlendMode: "multiply",
          }}
        />


        {/* ornate triple frame — gilded with wear */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[5px] rounded-[10px]"
          style={{
            border: `1.2px solid ${p.gild}`,
            boxShadow: `inset 0 0 0 0.5px ${p.accent}66, 0 0 0 0.5px rgba(0,0,0,0.4)`,
          }}
        />
        {/* gilt specular highlight — diagonal gleam on frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[5px] rounded-[10px]"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,230,160,0.55) 0%, transparent 18%, transparent 60%, rgba(255,220,150,0.35) 78%, transparent 95%)",
            mixBlendMode: "screen",
            padding: "1.2px",
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
        {/* gilt wear — dark chips eaten out of the frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[5px] rounded-[10px]"
          style={{
            background:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 -0.4'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            backgroundSize: "100% 100%",
            opacity: 0.5,
            mixBlendMode: "multiply",
            padding: "1.2px",
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[9px] rounded-[8px]"
          style={{ border: `0.5px solid ${p.gild}66` }}
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
        <div className="relative flex items-start gap-2.5 px-5 pt-5">
          <span
            className="font-display text-[15px] leading-[1.15] pt-[1px]"
            style={{ color: p.gild, letterSpacing: "0.14em" }}
          >
            {toRoman(index + 1)}
          </span>
          <h3
            className="flex-1 font-display text-[13.5px] leading-[1.18]"
            style={{
              color: p.ink,
              letterSpacing: "0.02em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
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
