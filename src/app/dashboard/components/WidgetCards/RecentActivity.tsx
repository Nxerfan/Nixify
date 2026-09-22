"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { Activity, UserPlus, LogIn, Mail, CheckCircle2, KeyRound } from "lucide-react";
import type { ActivityItem } from "@/hooks/useDashboardData";

const EASE = [0.22, 1, 0.36, 1] as const;

const TYPE_CONFIG: Record<ActivityItem["type"], { icon: React.ComponentType<{ className?: string; style?: CSSProperties }>; color: string }> = {
  signup: { icon: UserPlus, color: "#34d399" },
  signin: { icon: LogIn, color: "#2dd4bf" },
  otp_sent: { icon: Mail, color: "#6ee7b7" },
  otp_verified: { icon: CheckCircle2, color: "#14b8a6" },
  password_reset: { icon: KeyRound, color: "#5eead4" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface RecentActivityProps {
  activities: ActivityItem[];
  loading: boolean;
}

/**
 * Recent Activity widget — vertical timeline of events with type-colored icons
 * and relative timestamps. Items fade+slide in with stagger.
 */

export function RecentActivity({ activities, loading }: RecentActivityProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/40 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-medium text-foreground">Recent Activity</h3>
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-border/50" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-32 animate-pulse rounded bg-border/50" />
                <div className="h-2 w-20 animate-pulse rounded bg-border/40" />
              </div>
            </div>
          ))
        ) : (
          activities.map((act, i) => {
            const cfg = TYPE_CONFIG[act.type];
            return (
              <motion.div
                key={act.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-800/20"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3, ease: EASE }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${cfg.color}15` }}
                >
                  <cfg.icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-muted-foreground">{act.description}</p>
                  <p className="truncate text-xs text-muted-foreground/50">{act.email}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground/50">{timeAgo(act.timestamp)}</span>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
