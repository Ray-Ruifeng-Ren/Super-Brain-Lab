import { useEffect, useRef } from "react";

/**
 * Cinematic background: a procedurally-drawn fractal tree that sways with
 * a low-frequency wind field. Warm amber leaves twinkle and occasionally
 * drift downward. Canvas2D, fixed full-screen, pointer-events-none.
 */
export default function TreeBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Pre-generate a stable tree skeleton (so structure doesn't reshuffle
    // every frame; only sway angles vary).
    type Branch = {
      depth: number;
      x1: number; y1: number;
      len: number;
      angle: number;       // base angle
      width: number;
      swayPhase: number;   // per-branch phase offset
      swayAmp: number;     // amplitude multiplier
      leaf?: { hue: number; size: number; twinkle: number };
    };
    const branches: Branch[] = [];
    const leaves: { bIdx: number; ox: number; oy: number; hue: number; size: number; twinkle: number }[] = [];

    const rand = (() => {
      // seeded prng for stable structure
      let s = 1337;
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
      };
    })();

    const buildTree = (
      x: number, y: number, len: number, angle: number, depth: number, width: number, parentIdx: number,
    ) => {
      const idx = branches.length;
      branches.push({
        depth, x1: x, y1: y, len, angle, width,
        swayPhase: rand() * Math.PI * 2,
        swayAmp: 0.6 + rand() * 0.8,
      });
      if (depth >= 9) {
        // attach leaves at tips
        const n = 3 + Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) {
          leaves.push({
            bIdx: idx,
            ox: (rand() - 0.5) * 18,
            oy: (rand() - 0.5) * 18,
            hue: 28 + rand() * 22, // amber → gold
            size: 1.6 + rand() * 2.2,
            twinkle: rand() * Math.PI * 2,
          });
        }
        return;
      }
      const branchCount = depth < 3 ? 2 : (rand() < 0.35 ? 3 : 2);
      for (let i = 0; i < branchCount; i++) {
        const spread = 0.45 + rand() * 0.35;
        const childAngle = angle + (i === 0 ? -spread : i === 1 ? spread : (rand() - 0.5) * 0.6);
        const childLen = len * (0.68 + rand() * 0.12);
        buildTree(0, 0, childLen, childAngle, depth + 1, width * 0.72, idx);
      }
    };

    buildTree(0, 0, 130, -Math.PI / 2, 0, 9, -1);

    // Falling leaf particles
    type Falling = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; hue: number; life: number; max: number; size: number };
    const falling: Falling[] = [];

    let raf = 0;
    const t0 = performance.now();

    const drawTree = (now: number) => {
      const t = (now - t0) / 1000;
      // Soft warm wash
      ctx.clearRect(0, 0, w, h);

      // dusk gradient sky
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "rgba(28, 22, 14, 0.55)");
      sky.addColorStop(0.55, "rgba(38, 26, 14, 0.35)");
      sky.addColorStop(1, "rgba(18, 12, 6, 0.75)");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // ground glow
      const glow = ctx.createRadialGradient(w * 0.5, h * 1.02, 0, w * 0.5, h * 1.02, h * 0.7);
      glow.addColorStop(0, "rgba(200, 140, 60, 0.18)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Global wind
      const wind = Math.sin(t * 0.35) * 0.06 + Math.sin(t * 1.1) * 0.025;

      // Walk tree recursively using stored skeleton.
      ctx.save();
      ctx.translate(w / 2, h + 20);

      // We need to recompute endpoints using sway each frame.
      const ends: { x: number; y: number; angle: number }[] = new Array(branches.length);

      const drawBranch = (i: number, x: number, y: number, parentAngle: number) => {
        const b = branches[i];
        // Sway: deeper branches sway more, modulated by global wind
        const sway = wind * b.swayAmp * (b.depth + 1) * 0.12 + Math.sin(t * 1.6 + b.swayPhase) * 0.015 * b.depth;
        const angle = parentAngle + (b.angle - (i === 0 ? -Math.PI / 2 : parentAngle)) + sway;
        // Simpler: just use stored angle + sway, but apply parent rotation via recursion.
        const a = b.angle + sway + (parentAngle - (i === 0 ? -Math.PI / 2 : parentAngle));
        const ex = x + Math.cos(a) * b.len;
        const ey = y + Math.sin(a) * b.len;

        ctx.strokeStyle = b.depth < 4
          ? `rgba(58, 38, 22, ${0.95 - b.depth * 0.05})`
          : `rgba(96, 64, 36, ${0.85 - b.depth * 0.04})`;
        ctx.lineWidth = Math.max(0.6, b.width);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ends[i] = { x: ex, y: ey, angle: a };

        // Children: find branches whose parent is this one. We built them
        // in order, so children of i are the next N entries with depth+1
        // until depth drops. Easier: re-derive from structure by recursion.
      };

      // Re-walk via a parallel recursive builder mirroring buildTree order.
      let cursor = 0;
      const walk = (px: number, py: number, parentAngle: number, depth: number) => {
        const i = cursor++;
        const b = branches[i];
        const sway = wind * b.swayAmp * (b.depth + 1) * 0.10 + Math.sin(t * 1.8 + b.swayPhase) * 0.012 * (b.depth + 1);
        // root angle is absolute; children angles are relative to parent
        const a = depth === 0 ? b.angle + sway : parentAngle + (b.angle - (-Math.PI / 2)) * 0.4 + sway;
        const ex = px + Math.cos(a) * b.len;
        const ey = py + Math.sin(a) * b.len;

        const trunk = b.depth < 4;
        ctx.strokeStyle = trunk
          ? `rgba(52, 34, 20, ${0.95})`
          : `rgba(110, 76, 44, ${Math.max(0.35, 0.9 - b.depth * 0.05)})`;
        ctx.lineWidth = Math.max(0.6, b.width);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ends[i] = { x: ex, y: ey, angle: a };

        if (b.depth < 9) {
          // figure out children count the same way buildTree did is hard
          // without storing parent map. Instead, store children indices.
        }
      };
      // The recursion above is complex without a parent map. Use stored map approach below.
      cursor = 0;
      // (we'll do this properly via the precomputed parent map — see below)
      void drawBranch;
      void walk;

      ctx.restore();

      raf = requestAnimationFrame(drawTree);
    };

    // --- Replace draw with proper parent-mapped walker -----------------
    // Rebuild branches with parent indices.
    branches.length = 0;
    leaves.length = 0;
    type B2 = Branch & { parent: number; children: number[] };
    const tree: B2[] = [];
    const build2 = (parent: number, len: number, angle: number, depth: number, width: number): number => {
      const idx = tree.length;
      tree.push({
        depth, x1: 0, y1: 0, len, angle, width,
        swayPhase: rand() * Math.PI * 2,
        swayAmp: 0.5 + rand() * 0.9,
        parent, children: [],
      });
      if (parent >= 0) tree[parent].children.push(idx);
      if (depth >= 9) {
        const n = 4 + Math.floor(rand() * 4);
        for (let i = 0; i < n; i++) {
          leaves.push({
            bIdx: idx,
            ox: (rand() - 0.5) * 22,
            oy: (rand() - 0.5) * 22,
            hue: 24 + rand() * 28,
            size: 1.4 + rand() * 2.4,
            twinkle: rand() * Math.PI * 2,
          });
        }
        return idx;
      }
      const branchCount = depth < 2 ? 2 : (rand() < 0.4 ? 3 : 2);
      for (let i = 0; i < branchCount; i++) {
        const spread = 0.38 + rand() * 0.35;
        const childAngle = (i === 0 ? -spread : i === 1 ? spread : (rand() - 0.5) * 0.7);
        const childLen = len * (0.7 + rand() * 0.1);
        build2(idx, childLen, childAngle, depth + 1, width * 0.72);
      }
      return idx;
    };
    build2(-1, 140, -Math.PI / 2, 0, 11);

    cancelAnimationFrame(raf);

    const ends2: { x: number; y: number; angle: number }[] = new Array(tree.length);

    const render = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);

      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "rgba(26, 20, 12, 0.55)");
      sky.addColorStop(0.55, "rgba(40, 28, 16, 0.30)");
      sky.addColorStop(1, "rgba(16, 10, 4, 0.78)");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // distant fog/mist
      const fog = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, Math.max(w, h) * 0.6);
      fog.addColorStop(0, "rgba(180, 140, 90, 0.10)");
      fog.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, w, h);

      const wind = Math.sin(t * 0.4) * 0.06 + Math.sin(t * 1.2 + 1.1) * 0.025;

      ctx.save();
      ctx.translate(w / 2, h + 30);

      const walk = (i: number, px: number, py: number, parentAbsAngle: number) => {
        const b = tree[i];
        const depthFactor = (b.depth + 1) / 10;
        const sway = wind * b.swayAmp * depthFactor + Math.sin(t * 1.6 + b.swayPhase) * 0.02 * depthFactor;
        const a = b.parent < 0
          ? b.angle + sway
          : parentAbsAngle + b.angle + sway;
        const ex = px + Math.cos(a) * b.len;
        const ey = py + Math.sin(a) * b.len;

        const trunk = b.depth < 3;
        ctx.strokeStyle = trunk
          ? "rgba(48, 30, 18, 0.95)"
          : `rgba(108, 72, 42, ${Math.max(0.32, 0.88 - b.depth * 0.05)})`;
        ctx.lineWidth = Math.max(0.5, b.width);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ends2[i] = { x: ex, y: ey, angle: a };
        for (const c of b.children) walk(c, ex, ey, a);
      };
      walk(0, 0, 0, -Math.PI / 2);

      // Leaves
      for (const lf of leaves) {
        const e = ends2[lf.bIdx];
        if (!e) continue;
        const twink = 0.5 + 0.5 * Math.sin(t * 2.2 + lf.twinkle);
        const x = e.x + lf.ox + Math.sin(t * 1.3 + lf.twinkle) * 1.5;
        const y = e.y + lf.oy + Math.cos(t * 1.1 + lf.twinkle) * 1.2;
        const alpha = 0.55 + 0.45 * twink;
        const r = lf.size;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        grd.addColorStop(0, `hsla(${lf.hue}, 85%, 65%, ${0.9 * alpha})`);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${lf.hue}, 90%, 78%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // occasionally spawn a falling leaf
        if (Math.random() < 0.0006) {
          falling.push({
            x: w / 2 + x, y: h + 30 + y,
            vx: (Math.random() - 0.5) * 0.4 + wind * 6,
            vy: 0.2 + Math.random() * 0.3,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.04,
            hue: lf.hue, life: 0, max: 600 + Math.random() * 400,
            size: lf.size * 1.2,
          });
        }
      }
      ctx.restore();

      // Falling leaves in world space
      for (let i = falling.length - 1; i >= 0; i--) {
        const f = falling[i];
        f.life++;
        f.vx += (Math.sin((t + i) * 0.8) * 0.02) + wind * 0.04;
        f.vy += 0.004;
        f.x += f.vx; f.y += f.vy; f.rot += f.vr;
        if (f.life > f.max || f.y > h + 40 || f.x < -40 || f.x > w + 40) {
          falling.splice(i, 1); continue;
        }
        const a = Math.max(0, 1 - f.life / f.max);
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.fillStyle = `hsla(${f.hue}, 85%, 65%, ${0.8 * a})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size * 1.6, f.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // top vignette for legibility
      const vg = ctx.createLinearGradient(0, 0, 0, h);
      vg.addColorStop(0, "rgba(10,6,2,0.45)");
      vg.addColorStop(0.4, "rgba(10,6,2,0.0)");
      vg.addColorStop(1, "rgba(10,6,2,0.35)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(render);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#1a1208]">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
