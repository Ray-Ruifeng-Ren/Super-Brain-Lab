import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getFlashBg, getFlashBgTransform, FLASH_BG_EVENT, CALM_BG } from "@/lib/flashBackground";

/**
 * Global cinematic background video with a hand-rolled fade-in / fade-out loop
 * so the seam between iterations is invisible.
 *
 * Route-aware source:
 *   - /play/flashmath (闪电心算) → the 火花 fire scene (thematic).
 *   - everything else            → the valley scene.
 * On a route change the video re-mounts and fades back in from 0.
 *
 * Gradient overlay (from-background via-transparent to-background) melts the
 * footage edges into the page background so nav/cards/panels stay legible.
 */
const VALLEY_URL = "/hero-cinematic.mp4";

const FADE = 0.5; // seconds at head/tail of each loop

export default function VideoBackdrop() {
  const ref = useRef<HTMLVideoElement>(null);
  const { pathname } = useLocation();
  const isFlash = pathname === "/play/flashmath";
  // 闪电心算页背景可由用户自选,存本设备;监听切换事件即时更新
  const [flashBg, setFlashBg] = useState(getFlashBg);
  useEffect(() => {
    if (!isFlash) return;
    const sync = () => setFlashBg(getFlashBg());
    sync();
    window.addEventListener(FLASH_BG_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FLASH_BG_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [isFlash]);
  // 练习页默认「安静」(无视频):src 为 null,只留干净底色;首页/选了视频才播放。
  const src = !isFlash ? VALLEY_URL : flashBg === CALM_BG ? null : flashBg;
  const fit = isFlash ? getFlashBgTransform() : undefined; // 角色取景:放大+右移

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.style.opacity = "0";
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
  }, [src]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      {src && <video
        key={src}
        ref={ref}
        src={src}
        muted
        playsInline
        autoPlay
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 0, transform: fit, transformOrigin: "center" }}
      />}

      {/* Edges melt into the page background; footage stays visible in the middle band. */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
    </div>
  );
}
