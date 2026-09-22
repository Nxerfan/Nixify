"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface FeedItem {
  id: number;
  text: string;
  time: string;
}

const SAMPLE_EVENTS = [
  "New signup: alice@example.com",
  "OTP verified: bob@example.com",
  "Code sent: charlie@example.com",
  "Sign-in: diana@example.com",
  "Password reset: eve@example.com",
  "New signup: frank@example.com",
  "OTP verified: grace@example.com",
  "Code sent: henry@example.com",
];

/**
 * Live Feed widget — simulates a real-time event stream using setInterval.
 * New items slide in from the top with a spring; old items are removed.
 * For demo purposes only — replace with WebSocket/SSE in production.
 */

export function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    let id = 0;
    const interval = setInterval(() => {
      const text = SAMPLE_EVENTS[Math.floor(Math.random() * SAMPLE_EVENTS.length)];
      const item: FeedItem = {
        id: id++,
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      setItems((prev) => [item, ...prev].slice(0, 6));
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/40 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Radio className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-medium text-foreground">Live Feed</h3>
        <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live
        </span>
      </div>

      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {items.length === 0 && (
            <motion.p
              className="py-4 text-center text-xs text-muted-foreground/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Waiting for events...
            </motion.p>
          )}
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs"
            >
              <span className="font-mono text-muted-foreground/50">{item.time}</span>
              <span className="text-muted-foreground">{item.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
