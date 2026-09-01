import { useEffect, useRef } from "react";

/**
 * Subtle floating ember particles for the flash-math training backdrop.
 * Pure Canvas2D; no dependencies.
 */
export default function Embers() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    let particles: {
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      hue: number;
    }[] = [];

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn() {
      if (particles.length > 40) return;
      particles.push({
        x: Math.random() * width,
        y: height + Math.random() * 40,
        r: 0.5 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.3 - Math.random() * 0.8,
        life: 0,
        maxLife: 120 + Math.random() * 120,
        hue: 20 + Math.random() * 40,
      });
    }

    function frame() {
      ctx.clearRect(0, 0, width, height);
      if (Math.random() < 0.08) spawn();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const alpha = Math.sin((p.life / p.maxLife) * Math.PI);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${Math.max(0, alpha * 0.7)})`;
        ctx.fill();
        if (p.life >= p.maxLife || p.y < -10) {
          particles.splice(i, 1);
        }
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-60"
    />
  );
}
