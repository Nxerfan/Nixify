"use client";

import { motion } from "framer-motion";
import { Grid3x3 } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Activity Heatmap — 7×24 grid showing OTP usage intensity by day × hour.
 * Emerald intensity = higher activity. A creative visual widget.
 */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Mock 7×24 data (0–4 intensity scale)
const HEATMAP = Array.from({ length: 7 }, (_, day) =>
  Array.from({ length: 24 }, (_, hour) => {
    // Simulate higher activity during work hours + weekdays
    const isWorkHour = hour >= 9 && hour <= 18;
    const isWeekday = day < 5;
    let intensity = 0;
    if (isWorkHour && isWeekday) intensity = 2 + Math.floor(Math.random() * 3);
    else if (isWorkHour || isWeekday) intensity = 1 + Math.floor(Math.random() * 2);
    else intensity = Math.random() > 0.5 ? 1 : 0;
    return Math.min(intensity, 4);
  }),
);

const INTENSITY_COLORS = ["rgba(75,85,99,0.1)", "rgba(52,211,153,0.2)", "rgba(52,211,153,0.4)", "rgba(52,211,153,0.65)", "rgba(52,211,153,0.9)"];

export function ActivityHeatmap() {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/40 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Grid3x3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-medium text-foreground">Activity Heatmap</h3>
        <span className="ml-auto text-xs text-muted-foreground/50">7 days × 24 hours</span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-1">
          {/* Day labels column */}
          <div className="flex flex-col gap-1 pr-1">
            <div className="h-3" />
            {DAYS.map((d) => (
              <div key={d} className="flex h-3 items-center justify-end pr-1 text-xs text-muted-foreground/50">{d}</div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="flex-1">
            {/* Hour labels */}
            <div className="mb-1 flex gap-0.5">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center text-xs text-gray-700" style={{ fontSize: 8 }}>
                  {h % 6 === 0 ? h : ""}
                </div>
              ))}
            </div>
            {/* Cells */}
            {HEATMAP.map((row, dayIdx) => (
              <div key={dayIdx} className="mb-1 flex gap-0.5">
                {row.map((intensity, hourIdx) => (
                  <motion.div
                    key={hourIdx}
                    className="aspect-square flex-1 rounded-sm"
                    style={{ backgroundColor: INTENSITY_COLORS[intensity] }}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (dayIdx * 24 + hourIdx) * 0.002, duration: 0.2, ease: EASE }}
                    title={`${DAYS[dayIdx]} ${hourIdx}:00 — ${intensity * 25}%`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground/50">Less</span>
        {INTENSITY_COLORS.map((c, i) => (
          <div key={i} className="h-3 w-3 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span className="text-xs text-muted-foreground/50">More</span>
      </div>
    </div>
  );
}
