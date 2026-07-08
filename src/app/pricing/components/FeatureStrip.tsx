"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Zap, Shield, Headphones, Globe } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

const ITEMS = [
  { icon: Zap, label: "99.9% Uptime", sub: "Reliable delivery" },
  { icon: Shield, label: "Enterprise Security", sub: "DKIM + SPF + DMARC" },
  { icon: Headphones, label: "24/7 Support", sub: "Always here for you" },
  { icon: Globe, label: "Global Delivery", sub: "SMTP worldwide" },
];

/**
 * Feature strip — horizontal bar of 4 key value props with icons.
 * Sits above the pricing cards.
 */
export function FeatureStrip() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      className="mb-10 grid grid-cols-2 gap-3 rounded-2xl border border-gray-800/40 bg-gray-950/40 p-4 backdrop-blur-xl sm:grid-cols-4"
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {ITEMS.map((item, i) => (
        <motion.div
          key={item.label}
          className="flex items-center gap-2.5"
          initial={{ opacity: 0, x: -8 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: i * 0.08, duration: 0.4, ease: EASE }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
            <item.icon className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-200">{item.label}</p>
            <p className="text-xs text-gray-600">{item.sub}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
