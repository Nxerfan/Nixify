"use client";

import { useEffect, useRef } from "react";

/**
 * ─── Refined Ambient Background ────────────────────────────────────────────
 *
 * Simple at first glance. Stunning in the details.
 *
 * The same layered structure as before — base, mesh gradients, grid, particles,
 * grain, vignette — but every element has been polished until it feels
 * intentional, crafted, and alive.
 *
 * What changed:
 *   • Mesh gradient: 5 centers instead of 3, each on an independent Lissajous
 *     path with its own frequency, phase, and amplitude — never repeats.
 *   • Particles: two types — tiny drifting specks (35) with soft glow halos,
 *     and large soft bokeh orbs (6) that pulse like breathing.
 *   • Grid: thinner lines (0.5px), lower opacity, wider fade mask.
 *   • Cursor light: a barely-there pool of warm light that follows the mouse.
 *   • Everything uses a single requestAnimationFrame loop for perfect sync.
 *
 * Layers (back to front):
 *   1. Deep base fill       — #0A0F0D
 *   2. Living mesh gradient — 5 centers, Lissajous paths, CSS custom props
 *   3. Whisper grid         — 0.5px lines, radial fade mask
 *   4. Canvas               — drifting specks + breathing bokeh orbs
 *   5. Cursor light pool    — barely visible, follows mouse
 *   6. Film grain           — SVG feTurbulence, GPU-accelerated
 *   7. Vignette             — soft edge darkening
 *
 * All animation respects prefers-reduced-motion (freezes entirely).
 */

export function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fx = fxRef.current;
    if (!canvas || !fx) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // ── State ──────────────────────────────────────────────────────────────

    let w = window.innerWidth;
    let h = window.innerHeight;
    let mx = 0.5;
    let my = 0.5;
    let smx = 0.5;
    let smy = 0.5;
    let raf = 0;
    let resizeTimer = 0;

    // ── Resize (debounced) ─────────────────────────────────────────────────

    const resize = () => {
      cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(() => {
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w;
        canvas.height = h;
      });
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Mouse tracking ─────────────────────────────────────────────────────

    if (!reduced) {
      const onMouse = (e: MouseEvent) => {
        mx = e.clientX / w;
        my = e.clientY / h;
      };
      window.addEventListener("mousemove", onMouse);
    }

    // ── Gradient mesh centers (5 points, Lissajous paths) ──────────────────

    const centers = Array.from({ length: 5 }, (_, i) => ({
      baseX: [0.5, 0.7, 0.3, 0.5, 0.8][i],
      baseY: [0.3, 0.6, 0.7, 0.5, 0.2][i],
      ax: [0.2, 0.22, 0.18, 0.3, 0.15][i],
      ay: [0.25, 0.18, 0.22, 0.3, 0.15][i],
      fx: [0.13, 0.11, 0.17, 0.07, 0.19][i],
      fy: [0.17, 0.23, 0.13, 0.09, 0.21][i],
      px: [0.0, 1.2, 2.5, 3.7, 0.9][i],
      py: [0.5, 2.1, 0.8, 1.4, 3.2][i],
      amp: [0.12, 0.09, 0.07, 0.05, 0.06][i],
    }));

    // ── Particles: drifting specks ─────────────────────────────────────────

    const specks = reduced
      ? []
      : Array.from({ length: 35 }, () => ({
          x: Math.random(),
          y: Math.random(),
          vx: (Math.random() - 0.5) * 0.05,
          vy: (Math.random() - 0.5) * 0.035,
          r: 0.3 + Math.random() * 0.7,
          o: 0.15 + Math.random() * 0.3,
          hue: 150 + Math.random() * 25,
          phase: Math.random() * Math.PI * 2,
          driftAmp: 0.002 + Math.random() * 0.004,
          driftFreq: 0.3 + Math.random() * 0.4,
        }));

    // ── Particles: soft bokeh orbs ─────────────────────────────────────────

    const bokeh = reduced
      ? []
      : Array.from({ length: 6 }, (_, i) => ({
          x: Math.random(),
          y: Math.random(),
          vx: (Math.random() - 0.5) * 0.012,
          vy: (Math.random() - 0.5) * 0.008,
          r: 25 + Math.random() * 35,
          o: 0.02 + Math.random() * 0.03,
          color: (i % 2 === 0 ? [52, 211, 153] : [16, 185, 129]) as [
            number,
            number,
            number,
          ],
          phase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.2 + Math.random() * 0.3,
        }));

    // ── Cursor light CSS property ──────────────────────────────────────────

    fx.style.setProperty("--cursor-x", "50%");
    fx.style.setProperty("--cursor-y", "50%");

    // Set initial gradient positions
    const t0 = performance.now();

    // ── Single animation loop ──────────────────────────────────────────────

    const tick = (timestamp: number) => {
      const t = (timestamp - t0) / 1000;

      // ---- Guard canvas ----
      if (!canvas || !ctx) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      // ---- Smooth mouse (slow interpolation for fluid tracking) ----
      if (!reduced) {
        smx += (mx - smx) * 0.03;
        smy += (my - smy) * 0.03;
      }

      // ── 1. Update mesh gradient positions (CSS custom properties) ────────

      if (!reduced) {
        for (let i = 0; i < centers.length; i++) {
          const c = centers[i];
          const cx = (c.baseX + Math.sin(t * c.fx + c.px) * c.ax) * 100;
          const cy = (c.baseY + Math.cos(t * c.fy + c.py) * c.ay) * 100;
          fx.style.setProperty(`--mx${i + 1}`, `${cx}%`);
          fx.style.setProperty(`--my${i + 1}`, `${cy}%`);

          // Also vary the gradient opacity subtly over time
          const breath = 0.85 + 0.15 * Math.sin(t * 0.15 + c.px);
          const amp = c.amp !== undefined ? c.amp : 0.1;
          fx.style.setProperty(`--op${i + 1}`, `${(amp * breath).toFixed(3)}`);
        }

        // Cursor light position
        fx.style.setProperty("--cursor-x", `${smx * 100}%`);
        fx.style.setProperty("--cursor-y", `${smy * 100}%`);

        // Breathing overlay — very subtle brightness pulse
        const breathGlow = 0.97 + 0.03 * Math.sin(t * 0.35 + 1.0);
        fx.style.setProperty("--breath", `${breathGlow.toFixed(3)}`);
      }

      // ── 2. Clear canvas ──────────────────────────────────────────────────

      ctx.clearRect(0, 0, w, h);

      // ── 3. Draw drifting specks ──────────────────────────────────────────

      if (!reduced) {
        for (let i = 0; i < specks.length; i++) {
          const s = specks[i];

          // Organic drift — composite sine waves for non-linear motion
          s.x += s.vx + Math.sin(t * s.driftFreq + s.phase) * s.driftAmp;
          s.y +=
            s.vy + Math.cos(t * s.driftFreq * 0.7 + s.phase * 1.3) * s.driftAmp;

          // Wrap around (with soft edge for natural feel)
          if (s.x < -0.05) s.x = 1.05;
          if (s.x > 1.05) s.x = -0.05;
          if (s.y < -0.05) s.y = 1.05;
          if (s.y > 1.05) s.y = -0.05;

          const px = s.x * w;
          const py = s.y * h;

          // --- Glow halo (soft outer glow) ---
          ctx.beginPath();
          ctx.arc(px, py, s.r * 4.5, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${s.hue}, 75%, 55%, ${s.o * 0.1})`;
          ctx.fill();

          // --- Mid glow ---
          ctx.beginPath();
          ctx.arc(px, py, s.r * 2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${s.hue}, 80%, 60%, ${s.o * 0.3})`;
          ctx.fill();

          // --- Bright core ---
          ctx.beginPath();
          ctx.arc(px, py, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${s.hue}, 85%, 70%, ${s.o * 0.85})`;
          ctx.fill();
        }

        // ── 4. Draw soft bokeh orbs ────────────────────────────────────────

        for (let i = 0; i < bokeh.length; i++) {
          const b = bokeh[i];
          b.x += b.vx;
          b.y += b.vy;

          if (b.x < -0.1) b.x = 1.1;
          if (b.x > 1.1) b.x = -0.1;
          if (b.y < -0.1) b.y = 1.1;
          if (b.y > 1.1) b.y = -0.1;

          // Slow breathing pulse
          const pulse = 0.75 + 0.25 * Math.sin(t * b.pulseSpeed + b.phase);

          const bx = b.x * w;
          const by = b.y * h;
          const r = b.r * pulse;

          // 3-stop radial gradient for smooth falloff
          const grad = ctx.createRadialGradient(bx, by, 0, bx, by, r);
          const [cr, cg, cb] = b.color;
          const o = b.o * pulse;
          grad.addColorStop(0, `rgba(${cr},${cg},${cb},${o * 1.2})`);
          grad.addColorStop(0.25, `rgba(${cr},${cg},${cb},${o * 0.6})`);
          grad.addColorStop(0.55, `rgba(${cr},${cg},${cb},${o * 0.2})`);
          grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);

          ctx.beginPath();
          ctx.arc(bx, by, r, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(tick);
    };

    if (!reduced) raf = requestAnimationFrame(tick);

    // ── Cleanup ────────────────────────────────────────────────────────────

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeTimer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="ambient-bg pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      {/* Layer 1: Base color */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--background, oklch(0.145 0 0))" }}
      />

      {/* Layer 2: Living mesh gradient — 5 centers on Lissajous paths */}
      <div
        ref={fxRef}
        className="absolute inset-0"
        style={{
          background: [
            `radial-gradient(ellipse 55% 45% at var(--mx1, 50%) var(--my1, 30%), rgba(16,185,129,0.12), transparent 60%)`,
            `radial-gradient(ellipse 45% 55% at var(--mx2, 70%) var(--my2, 70%), rgba(20,184,166,0.09), transparent 60%)`,
            `radial-gradient(ellipse 50% 50% at var(--mx3, 30%) var(--my3, 60%), rgba(5,150,105,0.07), transparent 60%)`,
            `radial-gradient(ellipse 40% 60% at var(--mx4, 50%) var(--my4, 50%), rgba(52,211,153,0.05), transparent 55%)`,
            `radial-gradient(ellipse 60% 40% at var(--mx5, 80%) var(--my5, 20%), rgba(15,118,110,0.06), transparent 55%)`,
          ].join(", "),
          transition: "background 0.35s linear",
          filter: "brightness(var(--breath, 1))",
        }}
      />

      {/* Layer 3: Whisper grid — 0.5px lines, radial fade */}
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(52,211,153,0.7) 0.5px, transparent 0.5px)",
            "linear-gradient(90deg, rgba(52,211,153,0.7) 0.5px, transparent 0.5px)",
          ].join(", "),
          backgroundSize: "60px 60px",
          maskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />

      {/* Layer 4: Canvas — drifting specks + bokeh orbs */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Layer 5: Cursor light pool — barely visible, follows mouse */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          background:
            "radial-gradient(600px circle at var(--cursor-x, 50%) var(--cursor-y, 50%), rgba(16,185,129,0.04), transparent 60%)",
          transition: "background 0.6s linear",
        }}
      />

      {/* Layer 6: Film grain — SVG feTurbulence, GPU-accelerated */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.012] mix-blend-overlay"
        aria-hidden="true"
      >
        <filter id="ambient-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.75"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#ambient-grain)" />
      </svg>

      {/* Layer 7: Vignette — gentle edge darkening */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 32%, color-mix(in oklch, var(--background) 60%, transparent) 100%)",
        }}
      />
    </div>
  );
}
