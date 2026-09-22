"use client";

import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Usage Chart widget — 7-day OTP volume bar chart with pure CSS bars.
 * No recharts dependency needed; the bars animate in with staggered spring.
 */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MOCK_DATA = [120, 180, 95, 210, 175, 140, 195];

export function UsageChart() {
  const max = Math.max(...MOCK_DATA);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/40 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-medium text-foreground">Usage — Last 7 Days</h3>
      </div>

      <div className="flex h-32 items-end justify-between gap-2">
        {MOCK_DATA.map((val, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-full w-full items-end justify-center">
              <motion.div
                className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-emerald-600/80 to-teal-400/80"
                initial={{ height: 0 }}
                animate={{ height: `${(val / max) * 100}%` }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 100, damping: 15 }}
                whileHover={{ backgroundColor: "rgba(52,211,153,1)" }}
              />
            </div>
            <span className="text-xs text-muted-foreground/50">{DAYS[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
