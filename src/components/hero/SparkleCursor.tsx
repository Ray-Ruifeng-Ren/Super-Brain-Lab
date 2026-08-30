import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getFlashBgHue, DEFAULT_FLASH_HUE, FLASH_BG_EVENT } from "@/lib/flashBackground";

/**
 * Starlight sparkle field that emits glowing particles where the cursor moves.
 * Fixed full-screen canvas, pointer-events: none.
 * 色相随「闪电心算」页所选背景变化(其它页面用默认暖金)。
 */
export default function SparkleCursor() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { pathname } = useLocation();
  const isFlash = pathname === "/play/flashmath";
  const hueRef = useRef(DEFAULT_FLASH_HUE);

  // 同步光标粒子色相:闪电心算页跟随所选背景;换背景时即时更新
  useEffect(() => {
    const sync = () => { hueRef.current = isFlash ? getFlashBgHue() : DEFAULT_FLASH_HUE; };
    sync();
    window.addEventListener(FLASH_BG_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FLASH_BG_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [isFlash]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number };
    const particles: P[] = [];
    let mx = -9999, my = -9999, lastEmit = 0;

    const emit = (x: number, y: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * 0.6 + 0.1;
        particles.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 0.15,
          life: 0,
          max: 60 + Math.random() * 60,
          size: Math.random() * 1.8 + 0.6,
          hue: hueRef.current + Math.random() * 18, // 跟随所选背景的色相
        });
      }
      if (particles.length > 600) particles.splice(0, particles.length - 600);
    };

    const onMove = (e: PointerEvent) => {
      mx = e.clientX; my = e.clientY;
      const now = performance.now();
      if (now - lastEmit > 16) {
        emit(mx, my, 3);
        lastEmit = now;
      }
    };
    const onLeave = () => { mx = -9999; my = -9999; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);

    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.005;
        const t = p.life / p.max;
        if (t >= 1) { particles.splice(i, 1); continue; }
        const alpha = (1 - t) * 0.9;
        const r = p.size * (1 + t * 0.8);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
        grad.addColorStop(0, `hsla(${p.hue}, 90%, 75%, ${alpha})`);
        grad.addColorStop(0.4, `hsla(${p.hue}, 85%, 60%, ${alpha * 0.4})`);
        grad.addColorStop(1, `hsla(${p.hue}, 80%, 50%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 6, 0, Math.PI * 2);
        ctx.fill();
        // bright core
        ctx.fillStyle = `hsla(${p.hue}, 95%, 92%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[5] h-full w-full"
    />
  );
}
