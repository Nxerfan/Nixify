"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Custom cursor system:
 *   - 8px dot (zero lag)
 *   - 32px ring (spring follow, scales on hover)
 *   - 400px spotlight glow (soft, follows cursor with delay)
 *
 * Disabled on touch devices (pointer:coarse) and reduced-motion.
 */

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function CustomCursor() {
  const isCoarse = useMediaQuery("(pointer: coarse)");
  const isReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const enabled = !isCoarse && !isReduced;

  const [hovering, setHovering] = useState(false);
  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);
  const ringX = useSpring(dotX, { stiffness: 350, damping: 28, mass: 0.5 });
  const ringY = useSpring(dotY, { stiffness: 350, damping: 28, mass: 0.5 });

  // Spotlight — slower spring for a trailing glow
  const spotX = useSpring(dotX, { stiffness: 80, damping: 20, mass: 1.5 });
  const spotY = useSpring(dotY, { stiffness: 80, damping: 20, mass: 1.5 });

  useEffect(() => {
    if (!enabled) return;
    const move = (e: MouseEvent) => {
      dotX.set(e.clientX);
      dotY.set(e.clientY);
    };
    const over = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const interactive = target.closest("button, a, input, label, [role='button'], [data-cursor='hover']");
      setHovering(!!interactive);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
    };
  }, [enabled, dotX, dotY]);

  if (!enabled) return null;

  return (
    <>
      {/* Spotlight glow — large, soft, trailing */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-0 rounded-full"
        style={{
          x: spotX,
          y: spotY,
          width: 600,
          height: 600,
          marginLeft: -300,
          marginTop: -300,
          background: "radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 60%)",
        }}
        animate={{ scale: hovering ? 1.2 : 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
      />

      {/* Small dot — zero lag */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[9999] rounded-full"
        style={{
          x: dotX, y: dotY, width: 8, height: 8, marginLeft: -4, marginTop: -4,
          backgroundColor: "rgba(52,211,153,0.9)",
        }}
        animate={{ scale: hovering ? 0.5 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
      />

      {/* Larger ring — spring follow */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[9998] rounded-full border"
        style={{ x: ringX, y: ringY, width: 32, height: 32, marginLeft: -16, marginTop: -16 }}
        animate={{
          scale: hovering ? 1.6 : 1,
          borderColor: hovering ? "rgba(52,211,153,0.7)" : "rgba(156,163,175,0.25)",
          backgroundColor: hovering ? "rgba(52,211,153,0.08)" : "rgba(0,0,0,0)",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      />
    </>
  );
}
