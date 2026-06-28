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

// Per-module jewel palette — vintage botanical / arcana feel.
// top/bot = card field gradient stops; ink = primary readable color; gild = gold edge tone.
const PALETTE: Record<string, { top: string; bot: string; ink: string; gild: string; accent: string }> = {
  flashmath: { top: "#1f3a2e", bot: "#0f1f18", ink: "#f3e7c8", gild: "#caa75a", accent: "#e7b864" },
  gauntlet:  { top: "#3a1a1a", bot: "#1c0c0c", ink: "#f3dcc8", gild: "#c98a4b", accent: "#e07a4b" },
  schulte:   { top: "#1a2a3a", bot: "#0c1620", ink: "#dde6f2", gild: "#9bb7c9", accent: "#6da3c4" },
  nback:     { top: "#2e1a3a", bot: "#160a22", ink: "#ecd8f2", gild: "#a98ac0", accent: "#b07ed1" },
  reaction:  { top: "#3a2a10", bot: "#1f1608", ink: "#f6e6c2", gild: "#d8a64a", accent: "#f0b250" },
  cards:     { top: "#10302e", bot: "#07191a", ink: "#d8efe6", gild: "#7fb8a4", accent: "#56a892" },
  orbit:     { top: "#142244", bot: "#080f24", ink: "#dce4ff", gild: "#9aa6d6", accent: "#7a8cd4" },
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

        {/* ornate double frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[6px] rounded-[10px]"
          style={{ border: `1px solid ${p.gild}88` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[10px] rounded-[8px]"
          style={{ border: `0.5px solid ${p.gild}55` }}
        />

        {/* corner flourishes */}
        {[
          { t: 4, l: 4, r: "rotate(0deg)" },
          { t: 4, l: "auto", r: "rotate(90deg)", right: 4 },
          { t: "auto", l: 4, r: "rotate(-90deg)", bottom: 4 },
          { t: "auto", l: "auto", r: "rotate(180deg)", bottom: 4, right: 4 },
        ].map((c, i) => (
          <svg
            key={i}
            aria-hidden
            width="18" height="18" viewBox="0 0 24 24"
            className="pointer-events-none absolute"
            style={{
              top: c.t as number | string,
              left: c.l as number | string,
              right: (c as { right?: number }).right,
              bottom: (c as { bottom?: number }).bottom,
              transform: c.r,
              color: p.gild,
            }}
          >
            <path d="M2 2 H10 M2 2 V10 M2 2 Q8 4 10 10" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.85" />
            <circle cx="10" cy="10" r="0.9" fill="currentColor" opacity="0.7" />
          </svg>
        ))}

        {/* top bar — Roman numeral index + suit dot */}
        <div className="relative flex items-center justify-between px-4 pt-4">
          <span
            className="font-display text-[13px] leading-none"
            style={{ color: p.gild, letterSpacing: "0.12em" }}
          >
            {toRoman(index + 1)}
          </span>
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full"
            style={{
              border: `1px solid ${p.gild}99`,
              background: featured ? p.accent : "transparent",
            }}
          >
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: featured ? p.bot : p.gild }}
            />
          </span>
        </div>

        {/* art portrait window */}
        <div className="relative mx-4 mt-3">
          <div
            className="relative aspect-square w-full overflow-hidden rounded-[6px]"
            style={{
              background: `radial-gradient(80% 80% at 50% 35%, ${p.accent}33 0%, ${p.bot} 75%)`,
              boxShadow: `inset 0 0 0 1px ${p.gild}66, inset 0 0 24px ${p.bot}`,
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
                background: `radial-gradient(50% 30% at 50% 25%, ${p.accent}44, transparent 70%)`,
              }}
            />
          </div>
        </div>

        {/* meta */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
          <div
            className="mb-2 h-px w-full"
            style={{ background: `linear-gradient(90deg, transparent, ${p.gild}aa, transparent)` }}
          />
          <h3
            className="font-display text-[18px] leading-tight"
            style={{ color: p.ink, letterSpacing: "-0.01em" }}
          >
            {name}
          </h3>
          <p
            className="mt-1 font-mono-tabular text-[9px] uppercase"
            style={{ color: `${p.gild}`, letterSpacing: "0.22em", opacity: 0.85 }}
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
