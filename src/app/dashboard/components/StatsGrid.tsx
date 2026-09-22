"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Users, Activity, Mail, UserPlus } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Stats grid — 4 stat cards with animated count-up numbers. The count-up uses
 * framer-motion's useSpring + useTransform for a smooth, spring-based animation
 * that starts when the card enters view.
 */

interface StatsGridProps {
  stats: {
    totalUsers: number;
    activeSessions: number;
    otpSentToday: number;
    signupsThisWeek: number;
  } | null;
  loading: boolean;
}

const CARD_CONFIG = [
  { key: "totalUsers", label: "Total Users", icon: Users, color: "#34d399" },
  { key: "activeSessions", label: "Active Sessions", icon: Activity, color: "#2dd4bf" },
  { key: "otpSentToday", label: "OTPs Sent Today", icon: Mail, color: "#6ee7b7" },
  { key: "signupsThisWeek", label: "Signups This Week", icon: UserPlus, color: "#14b8a6" },
] as const;

export function StatsGrid({ stats, loading }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARD_CONFIG.map((card, i) => (
        <motion.div
          key={card.key}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.08, duration: 0.4, ease: EASE }}
        >
          <StatCard
            label={card.label}
            value={stats ? stats[card.key] : 0}
            icon={card.icon}
            color={card.color}
            loading={loading}
          />
        </motion.div>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; style?: CSSProperties }>;
  color: string;
  loading: boolean;
}) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/40 p-5 backdrop-blur-xl"
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Hover glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at 50% 0%, ${color}15, transparent 70%)` }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
      />

      <div className="relative flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground/70">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>

      <div className="relative mt-3">
        {loading ? (
          <div className="h-8 w-20 animate-pulse rounded bg-border/50" />
        ) : (
          <CountUpValue value={value} color={color} />
        )}
      </div>
    </motion.div>
  );
}

/** Animated count-up number using spring physics. */
function CountUpValue({ value, color }: { value: number; color: string }) {
  const spring = useSpring(0, { stiffness: 60, damping: 18 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString());

  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <motion.span ref={ref} className="text-2xl font-bold tabular-nums" style={{ color }}>
      <motion.span>{display}</motion.span>
    </motion.span>
  );
}
