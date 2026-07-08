"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Star } from "lucide-react";
import { TESTIMONIALS } from "@/lib/pricingData";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Testimonials — horizontal scroll of 3 customer quotes with avatars.
 */
export function Testimonials() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  return (
    <div ref={ref} className="mb-20">
      <div className="mb-8 text-center">
        <span className="mb-2 inline-block text-xs font-medium uppercase tracking-wider text-emerald-400/70">
          Loved by builders
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-gray-100">
          Join 2,500+ teams already using Nixify
        </h2>
      </div>

      <div className="flex snap-x gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-3 lg:overflow-visible">
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={t.name}
            className="min-w-[280px] snap-center rounded-2xl border border-gray-800/40 bg-gray-950/40 p-5 backdrop-blur-xl lg:min-w-0"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.1, duration: 0.5, ease: EASE }}
          >
            {/* Stars */}
            <div className="mb-3 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <Star key={j} className="h-3.5 w-3.5 fill-emerald-400/60 text-emerald-400/60" />
              ))}
            </div>

            <p className="text-sm leading-relaxed text-gray-300">"{t.quote}"</p>

            <div className="mt-4 flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: `${t.accent}20`, color: t.accent }}
              >
                {t.initials}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">{t.name}</p>
                <p className="text-xs text-gray-600">{t.role} · {t.company}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
