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

// Per-module portrait palette — vintage TCG jewel tones.
const PALETTE: Record<string, { top: string; bot: string; glow: string; ink: string }> = {
  flashmath: { top: "#3a7a4e", bot: "#0f2818", glow: "#a8e6a3", ink: "#0c1d10" },
  gauntlet:  { top: "#9b2a1c", bot: "#2a0a06", glow: "#ffb88a", ink: "#1d0604" },
  schulte:   { top: "#2a6aa0", bot: "#0a1c30", glow: "#9ed7ff", ink: "#06141f" },
  nback:     { top: "#7235a8", bot: "#1a0830", glow: "#d8a8ff", ink: "#13041f" },
  reaction:  { top: "#c8861e", bot: "#3a1f06", glow: "#ffd87a", ink: "#1f0f02" },
  cards:     { top: "#1f7a6a", bot: "#06201c", glow: "#7df0d2", ink: "#04140f" },
  orbit:     { top: "#3346a0", bot: "#0a1030", glow: "#a8b8ff", ink: "#06081f" },
};

// Gold tones for ornate frame
const GOLD = {
  dark: "#6e4a18",
  mid:  "#a17828",
  light: "#e4c46a",
  pale: "#f6e3a0",
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
        transition: "transform 360ms cubic-bezier(.2,.7,.2,1)",
      }}
    >
      <div
        className="relative h-full w-full"
        style={{
          transform: `translateY(${lift}px) rotate(${baseRotate}deg) scale(${scale}) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 420ms cubic-bezier(.2,.7,.2,1)",
          filter: hovered
            ? "drop-shadow(0 28px 36px rgba(20,10,0,0.55)) drop-shadow(0 0 14px rgba(255,210,120,0.35))"
            : "drop-shadow(0 12px 18px rgba(20,10,0,0.45))",
        }}
      >
        <svg viewBox="0 0 200 280" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <defs>
            {/* Parchment fill */}
            <linearGradient id={`parch-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f3e3b8" />
              <stop offset="0.5" stopColor="#e6c98a" />
              <stop offset="1" stopColor="#c79b4a" />
            </linearGradient>

            {/* Gold frame gradient */}
            <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={GOLD.dark} />
              <stop offset="0.35" stopColor={GOLD.light} />
              <stop offset="0.55" stopColor={GOLD.pale} />
              <stop offset="0.75" stopColor={GOLD.mid} />
              <stop offset="1" stopColor={GOLD.dark} />
            </linearGradient>
            <linearGradient id={`gold-h-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={GOLD.pale} />
              <stop offset="0.5" stopColor={GOLD.light} />
              <stop offset="1" stopColor={GOLD.dark} />
            </linearGradient>

            {/* Portrait gradient */}
            <radialGradient id={`port-${id}`} cx="0.5" cy="0.35" r="0.75">
              <stop offset="0" stopColor={p.glow} stopOpacity="0.85" />
              <stop offset="0.4" stopColor={p.top} />
              <stop offset="1" stopColor={p.bot} />
            </radialGradient>

            {/* Blue gem for cost */}
            <radialGradient id={`gem-${id}`} cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#cfeaff" />
              <stop offset="0.4" stopColor="#3a8ad8" />
              <stop offset="1" stopColor="#0a2a55" />
            </radialGradient>

            {/* Arched portrait window clip */}
            <clipPath id={`arch-${id}`}>
              <path d="M 50 80 Q 50 50 100 50 Q 150 50 150 80 L 150 165 Q 100 175 50 165 Z" />
            </clipPath>

            {/* Card outer shape (rounded rect with slight gothic top) */}
            <path id={`outline-${id}`}
              d="M 12 4 L 188 4 Q 196 4 196 14 L 196 266 Q 196 276 188 276 L 12 276 Q 4 276 4 266 L 4 14 Q 4 4 12 4 Z"
            />
          </defs>

          {/* Card body — parchment */}
          <use href={`#outline-${id}`} fill={`url(#parch-${id})`} />

          {/* Parchment noise via pattern of dots */}
          <use href={`#outline-${id}`} fill="rgba(90,50,10,0.06)" style={{ mixBlendMode: "multiply" }} />

          {/* Outer thick gold frame */}
          <use
            href={`#outline-${id}`}
            fill="none"
            stroke={`url(#gold-${id})`}
            strokeWidth="7"
          />
          {/* Inner gold pin-line */}
          <use
            href={`#outline-${id}`}
            fill="none"
            stroke={GOLD.dark}
            strokeWidth="0.6"
            opacity="0.7"
            transform="translate(0,0)"
          />
          {/* Inner highlight line */}
          <rect x="10" y="10" width="180" height="260" rx="6" fill="none"
            stroke={GOLD.pale} strokeWidth="0.4" opacity="0.55" />

          {/* PORTRAIT ARCHED WINDOW */}
          <g>
            {/* arched window backing */}
            <path
              d="M 50 80 Q 50 50 100 50 Q 150 50 150 80 L 150 165 Q 100 175 50 165 Z"
              fill={`url(#port-${id})`}
            />
            {/* Inside-portrait art */}
            <g clipPath={`url(#arch-${id})`}>
              <foreignObject x="55" y="55" width="90" height="120">
                <div
                 
                  style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: p.glow,
                  }}
                >
                  <div style={{ width: "85%", height: "85%" }}>
                    <Art />
                  </div>
                </div>
              </foreignObject>
            </g>
            {/* halo */}
            <ellipse cx="100" cy="80" rx="40" ry="14" fill={p.glow} opacity="0.25" />

            {/* Ornate arched gold frame around window */}
            <path
              d="M 50 80 Q 50 50 100 50 Q 150 50 150 80 L 150 165 Q 100 175 50 165 Z"
              fill="none"
              stroke={`url(#gold-h-${id})`}
              strokeWidth="3.5"
            />
            {/* keystone ornament at top of arch */}
            <circle cx="100" cy="48" r="4" fill={`url(#gold-h-${id})`} stroke={GOLD.dark} strokeWidth="0.6" />
            <circle cx="100" cy="48" r="1.6" fill={GOLD.dark} />

            {/* side scrollwork */}
            <path d="M 48 95 Q 38 105 48 120 Q 38 130 48 145" stroke={GOLD.dark} strokeWidth="0.8" fill="none" opacity="0.7" />
            <path d="M 152 95 Q 162 105 152 120 Q 162 130 152 145" stroke={GOLD.dark} strokeWidth="0.8" fill="none" opacity="0.7" />
          </g>

          {/* COST GEM — top left, blue diamond */}
          <g>
            <polygon points="22,16 38,28 22,46 6,28" fill={GOLD.dark} />
            <polygon points="22,18 36,28 22,44 8,28" fill={`url(#gold-${id})`} />
            <polygon points="22,22 33,28 22,40 11,28" fill={`url(#gem-${id})`} />
            {/* gem highlight */}
            <polygon points="22,24 28,28 22,30 18,28" fill="#e6f4ff" opacity="0.7" />
            {/* numeral */}
            <text
              x="22" y="32" textAnchor="middle"
              fill="#fff"
              fontFamily="'Instrument Serif', Georgia, serif"
              fontSize="14"
              fontWeight="400"
              style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.5)", strokeWidth: "0.4" }}
            >
              {index + 1}
            </text>
          </g>

          {/* featured marker — small ruby */}
          {featured && (
            <g>
              <circle cx="178" cy="26" r="7" fill={GOLD.dark} />
              <circle cx="178" cy="26" r="5.5" fill="#c8203a" />
              <circle cx="176" cy="24" r="1.5" fill="#ffd0d0" opacity="0.9" />
            </g>
          )}

          {/* NAME BANNER */}
          <g>
            <path
              d="M 18 200 L 28 195 L 172 195 L 182 200 L 172 218 L 28 218 Z"
              fill={`url(#gold-${id})`}
              stroke={GOLD.dark}
              strokeWidth="0.8"
            />
            <path
              d="M 18 200 L 28 195 L 172 195 L 182 200 L 172 218 L 28 218 Z"
              fill="none"
              stroke={GOLD.pale}
              strokeWidth="0.4"
              opacity="0.7"
              transform="translate(0,1.5) scale(0.99,0.95)"
              style={{ transformOrigin: "100px 207px" }}
            />
            {/* inset banner field */}
            <path
              d="M 32 200 L 168 200 L 162 214 L 38 214 Z"
              fill="rgba(40,20,5,0.55)"
            />
            <foreignObject x="32" y="200" width="136" height="14">
              <div
               
                style={{
                  width: "100%", height: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: "10.5px",
                  color: GOLD.pale,
                  letterSpacing: "0.02em",
                  textShadow: "0 1px 0 rgba(0,0,0,0.6)",
                  lineHeight: 1,
                  textAlign: "center",
                  padding: "0 4px",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </div>
            </foreignObject>
          </g>

          {/* TAGLINE PANEL (scroll) */}
          <g>
            <rect x="22" y="226" width="156" height="40" rx="3"
              fill="rgba(60,35,10,0.18)"
              stroke={GOLD.dark}
              strokeWidth="0.5"
              opacity="0.9"
            />
            <foreignObject x="24" y="228" width="152" height="36">
              <div
               
                style={{
                  width: "100%", height: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  textAlign: "center",
                  fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
                  fontSize: "7px",
                  letterSpacing: "0.22em",
                  color: "rgba(60,35,10,0.85)",
                  textTransform: "uppercase",
                  padding: "0 6px",
                  lineHeight: 1.4,
                }}
              >
                {tagline}
              </div>
            </foreignObject>
          </g>

          {/* CORNER FLOURISHES */}
          {[
            { tx: 10, ty: 10, r: 0 },
            { tx: 190, ty: 10, r: 90 },
            { tx: 190, ty: 270, r: 180 },
            { tx: 10, ty: 270, r: 270 },
          ].map((c, i) => (
            <g key={i} transform={`translate(${c.tx} ${c.ty}) rotate(${c.r})`}>
              <path
                d="M 0 0 L 14 0 M 0 0 L 0 14 M 2 2 Q 8 4 12 10"
                fill="none" stroke={GOLD.dark} strokeWidth="0.7" opacity="0.85"
              />
              <circle cx="12" cy="12" r="1.1" fill={GOLD.light} />
            </g>
          ))}
        </svg>

        {/* Sweep shine on hover */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[14px] overflow-hidden"
          style={{
            opacity: hovered ? 0.7 : 0,
            background: `linear-gradient(105deg, transparent 35%, rgba(255,235,170,0.55) ${tilt.sx}%, transparent 65%)`,
            mixBlendMode: "screen",
            transition: "opacity 300ms",
          }}
        />
      </div>
    </Link>
  );
}
