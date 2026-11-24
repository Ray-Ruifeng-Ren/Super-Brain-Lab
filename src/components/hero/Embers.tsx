/** A few faint rising embers — decorative spark accents for the 闪电心算 page. */
const EMBERS = [
  { left: "6%", size: 7, dur: 6.5, delay: 0 },
  { left: "18%", size: 5, dur: 8, delay: 1.6 },
  { left: "31%", size: 8, dur: 7, delay: 3.1 },
  { left: "44%", size: 5, dur: 9, delay: 0.8 },
  { left: "57%", size: 6, dur: 7.6, delay: 2.4 },
  { left: "12%", size: 4, dur: 8.6, delay: 4.2 },
  { left: "38%", size: 6, dur: 6.8, delay: 5 },
];

export default function Embers() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="animate-ember absolute bottom-2 rounded-full"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            background: "radial-gradient(circle, hsl(213 100% 70%) 0%, hsl(217 95% 55% / 0) 72%)",
            boxShadow: "0 0 8px 2px hsl(215 100% 62% / 0.55)",
            animationDuration: `${e.dur}s`,
            animationDelay: `${e.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
