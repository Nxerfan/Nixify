"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

/**
 * Confetti burst — ~40 emerald/teal particles that explode outward from
 * center on mount, then fade. Pure CSS/framer-motion, no canvas needed.
 * Respects prefers-reduced-motion (static if enabled — but we render nothing
 * since the parent checks reduced-motion before showing).
 */

const COLORS = ["#34d399", "#10b981", "#14b8a6", "#2dd4bf", "#6ee7b7"];
const PARTICLE_COUNT = 40;

export function Confetti() {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
        const velocity = 80 + Math.random() * 120;
        return {
          id: i,
          x: Math.cos(angle) * velocity,
          y: Math.sin(angle) * velocity,
          rotate: Math.random() * 360,
          scale: 0.5 + Math.random() * 0.8,
          color: COLORS[i % COLORS.length],
          size: 4 + Math.random() * 6,
          delay: Math.random() * 0.1,
        };
      }),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
          animate={{
            x: p.x,
            y: p.y + 40, // gravity pull
            opacity: [1, 1, 0],
            scale: p.scale,
            rotate: p.rotate,
          }}
          transition={{
            duration: 1.2 + Math.random() * 0.4,
            delay: p.delay,
            ease: [0.22, 1, 0.36, 1],
            opacity: { duration: 1.5, delay: p.delay, times: [0, 0.6, 1] },
          }}
        />
      ))}
    </div>
  );
}
