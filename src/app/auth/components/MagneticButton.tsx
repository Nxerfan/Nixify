"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * MagneticButton — a wrapper that makes its child subtly pull toward the
 * cursor on hover, then springs back when the cursor leaves. The pull is
 * gentle (max ~12px) so it feels premium, not gimmicky.
 *
 * Pass any content (a Button, a link, etc.) as children.
 */

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number; // max px displacement
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}

export function MagneticButton({
  children,
  className = "",
  strength = 12,
  onClick,
  type = "button",
  disabled = false,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.5 });

  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    x.set(dx * strength);
    y.set(dy * strength);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={className}
    >
      <button type={type} onClick={onClick} disabled={disabled} className="w-full disabled:cursor-not-allowed">
        {children}
      </button>
    </motion.div>
  );
}
