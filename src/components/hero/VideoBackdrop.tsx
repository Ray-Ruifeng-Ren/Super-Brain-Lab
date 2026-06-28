import { useEffect, useRef } from "react";
import videoAsset from "@/assets/hero-bg.mp4.asset.json";

/**
 * Cinematic looping background video.
 * Starts visible (opacity 1) so it shows even before the first rAF tick.
 * 0.5s fade-in/out at the edges; 100ms hold on `ended` then restart.
 */
export default function VideoBackdrop() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let raf = 0;
    const FADE = 0.5;

    const tick = () => {
      const d = v.duration;
      if (d && !isNaN(d)) {
        const t = v.currentTime;
        let o = 1;
        if (t < FADE) o = Math.max(0.15, t / FADE);
        else if (t > d - FADE) o = Math.max(0.15, (d - t) / FADE);
        v.style.opacity = String(o);
      }
      raf = requestAnimationFrame(tick);
    };

    const onEnded = () => {
      v.style.opacity = "0.15";
      setTimeout(() => {
        v.currentTime = 0;
        void v.play().catch(() => {});
      }, 100);
    };

    v.addEventListener("ended", onEnded);
    void v.play().catch(() => {});
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <video
        ref={ref}
        src={videoAsset.url}
        muted
        playsInline
        autoPlay
        loop
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 1, transition: "opacity 120ms linear" }}
      />
      {/* Light parchment wash for legibility */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(250,247,238,0.35) 0%, rgba(250,247,238,0.10) 35%, rgba(20,15,8,0.25) 100%)",
        }}
      />
    </div>
  );
}
