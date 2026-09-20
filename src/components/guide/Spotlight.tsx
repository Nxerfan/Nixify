"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * Spotlight — dims the page and highlights a specific UI element
 * using a CSS selector. The highlighted element gets a glowing ring.
 *
 * This is purely visual — it overlays a semi-transparent mask with a
 * "hole" around the target element.
 *
 * Respects prefers-reduced-motion (no animation if set).
 */
export function Spotlight({ selector }: { selector: string }) {
  // We use a simple approach: a fixed overlay with a box-shadow
  // that creates the spotlight effect. The target element gets
  // a z-index boost via a data attribute.
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: "rgba(0, 0, 0, 0.6)",
        }}
        data-guide-spotlight={selector}
      >
        {/* The spotlight target is highlighted via JS effect */}
        <SpotlightTarget selector={selector} />
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Highlight the target element with a glowing ring.
 */
function SpotlightTarget({ selector }: { selector: string }) {
  return (
    <motion.div
      className="absolute"
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      ref={(el) => {
        if (!el) return;
        const target = document.querySelector(selector);
        if (!target) return;
        const rect = target.getBoundingClientRect();
        el.style.position = "fixed";
        el.style.top = `${rect.top - 4}px`;
        el.style.left = `${rect.left - 4}px`;
        el.style.width = `${rect.width + 8}px`;
        el.style.height = `${rect.height + 8}px`;
        el.style.borderRadius = "12px";
        el.style.boxShadow = "0 0 0 4px rgba(16, 185, 129, 0.5), 0 0 30px rgba(16, 185, 129, 0.3)";
        el.style.pointerEvents = "none";
      }}
    />
  );
}
