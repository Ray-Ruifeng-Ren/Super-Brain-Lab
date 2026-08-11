import { useEffect, useRef } from "react";

/**
 * Cinematic looping background video with a hand-rolled fade-in / fade-out
 * loop so the seam between iterations is invisible:
 *   - requestAnimationFrame continuously watches currentTime / duration
 *   - fade in  over the first 0.5s   (opacity 0 -> 1)
 *   - fade out over the last  0.5s   (opacity 1 -> 0)
 *   - on `ended`: opacity 0, wait 100ms, reset currentTime, play() again
 *
 * Gradient overlay (from-background via-transparent to-background) melts the
 * footage edges into the page background so the nav and cards stay legible.
 */
const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4";

const FADE = 0.5; // seconds at head/tail of each loop

export default function VideoBackdrop() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let raf = 0;

    const tick = () => {
      const { currentTime, duration } = v;
      if (duration && Number.isFinite(duration)) {
        let o = 1;
        if (currentTime < FADE) o = currentTime / FADE;
        else if (currentTime > duration - FADE)
          o = Math.max(0, (duration - currentTime) / FADE);
        v.style.opacity = o.toFixed(3);
      }
      raf = requestAnimationFrame(tick);
    };

    const onEnded = () => {
      v.style.opacity = "0";
      window.setTimeout(() => {
        v.currentTime = 0;
        void v.play().catch(() => {});
      }, 100);
    };

    v.addEventListener("ended", onEnded);
    void v.play().catch(() => {});
    raf = requestAnimationFrame(tick);

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <video
        ref={ref}
        src={VIDEO_URL}
        muted
        playsInline
        autoPlay
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 0 }}
      />
      {/* Edges melt into the page background; footage stays visible in the middle band. */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
    </div>
  );
}
