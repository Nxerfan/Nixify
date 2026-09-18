"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

const TIPS = [
  "Use sandbox mode with mg_test_ keys to test OTP flows without sending real emails.",
  "Webhooks can be signed with HMAC-SHA256 — always verify the signature on your server.",
  "Rate limits are 3 sends/min per email. Implement exponential backoff in your HTTP client.",
  "OTP codes expire after 10 minutes. Request a new code if the user takes longer.",
  "Customize email themes in the Branding page. Template availability varies by plan.",
  "Check the Analytics page for real-time verification trends and heatmaps.",
  "Use the command palette (⌘K) to navigate the dashboard faster.",
];

/**
 * Tip of the Day — rotates through helpful tips every 10 seconds with a
 * crossfade. A small, practical widget that adds value without clutter.
 */

export function TipOfTheDay() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % TIPS.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/20 to-gray-950/40 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <Lightbulb className="h-4 w-4 text-amber-400" />
        </motion.div>
        <h3 className="text-sm font-medium text-gray-200">Tip of the Day</h3>
      </div>

      <div className="relative h-16">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            className="absolute inset-0 text-sm leading-relaxed text-gray-400"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {TIPS[index]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="mt-2 flex gap-1">
        {TIPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-1 rounded-full transition-all ${
              i === index ? "w-6 bg-emerald-400" : "w-1.5 bg-gray-700 hover:bg-gray-600"
            }`}
            aria-label={`Tip ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
