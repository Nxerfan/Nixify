"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle2 } from "lucide-react";

/**
 * Status bar — bottom-fixed bar showing live system status + last activity.
 * Simulates periodic updates (every 10s) for a "live" feel.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function StatusBar() {
  const [time, setTime] = useState(new Date());
  const [lastOtpAgo, setLastOtpAgo] = useState("just now");

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
      // Simulate varying "last OTP" times
      const opts = ["just now", "1 min ago", "2 min ago", "3 min ago"];
      setLastOtpAgo(opts[Math.floor(Math.random() * opts.length)]);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs text-muted-foreground/70"
      
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4, ease: EASE }}
    >
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          System healthy
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <CheckCircle2 className="h-3 w-3 text-emerald-400/60" />
          All services operational
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden items-center gap-1.5 md:flex">
          <Activity className="h-3 w-3 text-emerald-400/60" />
          Last OTP: {lastOtpAgo}
        </span>
        <span className="font-mono tabular-nums">
          {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}
