import { useEffect, useRef } from "react";
import videoAsset from "@/assets/hero-bg.mp4.asset.json";

/**
 * Cinematic looping background video with a manual fade-in / fade-out loop.
 * - 0.5s fade-in at start, 0.5s fade-out before end
 * - On ended: opacity 0, wait 100ms, reset to 0 and play again
 */
export default function VideoBackdrop() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let raf = 0;
    const FADE = 0.5;

    const tick = () => {
      if (!v.duration || isNaN(v.duration)) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = v.currentTime;
      const d = v.duration;
      let o = 1;
      if (t < FADE) o = t / FADE;
      else if (t > d - FADE) o = Math.max(0, (d - t) / FADE);
      v.style.opacity = String(o);
      raf = requestAnimationFrame(tick);
    };

    const onEnded = () => {
      v.style.opacity = "0";
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
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <video
        ref={ref}
        src={videoAsset.url}
        muted
        playsInline
        autoPlay
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 0, transition: "opacity 120ms linear" }}
      />
      {/* Soft wash so foreground text & cards stay legible on light theme */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background/85" />
      <div className="absolute inset-0 bg-background/25" />
    </div>
  );
}
