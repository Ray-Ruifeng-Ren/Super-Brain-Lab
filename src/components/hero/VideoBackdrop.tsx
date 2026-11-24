import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getFlashBg, getFlashBgTransform, FLASH_BG_EVENT, CALM_BG } from "@/lib/flashBackground";

/**
 * Global cinematic background video with a SEAMLESS crossfade loop:
 * two stacked <video> players ping-pong — when the active one nears its tail,
 * the standby starts from 0 underneath at full opacity while the active one
 * (on top) fades out. The frame never dips to black between iterations.
 * (旧版是 淡出→黑场100ms→淡入 的单 video 循环,每 14 秒闪一次黑,已废弃。)
 *
 * Route-aware source:
 *   - /play/flashmath (闪电心算) → user-picked scene (默认安静无视频).
 *   - everything else            → the valley scene.
 * On a route change the players re-mount and fade back in from 0.
 *
 * Gradient overlay (from-background via-transparent to-background) melts the
 * footage edges into the page background so nav/cards/panels stay legible.
 */
// const VALLEY_URL = "/hero-cinematic.mp4"; // 已不再全局播放(见下)

const FADE = 0.7; // seconds of crossfade at each loop seam

export default function VideoBackdrop() {
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
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
  // 2026-10-15 自检:全站已是羊皮纸/首页渐变等不透明底,山谷视频完全看不见却每页都在下载(3MB)+ 解码 → 只在闪电心算页且用户选了场景时才播
  const src = isFlash && flashBg !== CALM_BG ? flashBg : null;
  const fit = isFlash ? getFlashBgTransform() : undefined; // 角色取景:放大+右移

  useEffect(() => {
    const a = refA.current, b = refB.current;
    if (!a || !b) return;
    let active = a, standby = b;
    let switching = false, firstPlay = true, raf = 0;
    a.style.opacity = "0"; a.style.zIndex = "2";
    b.style.opacity = "0"; b.style.zIndex = "1";

    const tick = () => {
      const d = active.duration;
      const ct = active.currentTime;
      if (d && Number.isFinite(d) && !active.paused) {
        if (firstPlay && ct < FADE) {
          // 仅首次进场:从底色淡入
          active.style.opacity = (ct / FADE).toFixed(3);
        } else if (ct > d - FADE) {
          if (!switching) {
            // 接缝提前 FADE 秒:备用播放器从 0 起播,垫在下层全亮
            switching = true;
            firstPlay = false;
            standby.style.zIndex = "1";
            standby.style.opacity = "1";
            standby.currentTime = 0;
            void standby.play().catch(() => {});
            active.style.zIndex = "2";
          }
          // 上层旧一轮淡出,露出下层新一轮 —— 无黑场
          active.style.opacity = Math.max(0, (d - ct) / FADE).toFixed(3);
        } else {
          active.style.opacity = "1";
        }
      }
      // 旧一轮播完(或已透明):交换角色
      if (switching && (active.ended || Number(active.style.opacity) <= 0.01)) {
        active.pause();
        active.style.opacity = "0";
        const t = active; active = standby; standby = t;
        switching = false;
      }
      raf = requestAnimationFrame(tick);
    };

    void a.play().catch(() => {});
    raf = requestAnimationFrame(tick);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        void active.play().catch(() => {});
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [src]);

  const videoCls = "absolute inset-0 h-full w-full object-cover";
  const videoStyle = { opacity: 0, transform: fit, transformOrigin: "center" } as const;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      {src && (
        <>
          <video key={src + "-a"} ref={refA} src={src} muted playsInline autoPlay preload="auto" className={videoCls} style={videoStyle} />
          <video key={src + "-b"} ref={refB} src={src} muted playsInline preload="auto" className={videoCls} style={videoStyle} />
        </>
      )}

      {/* Edges melt into the page background; footage stays visible in the middle band. */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-background via-transparent to-background" />
    </div>
  );
}
