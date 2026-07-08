"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  LayoutDashboard,
  Activity,
  Settings,
  Mail,
  Bell,
  Palette,
  BarChart3,
  KeyRound,
  Webhook,
  FlaskConical,
  BookOpen,
  ScrollText,
} from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Sidebar — fixed navigation panel. Contains the logo, nav links, and a
 * user profile footer. Collapsible on mobile (handled by parent layout).
 */

interface SidebarProps {
  onNavigate?: () => void;
}

const NAV_ITEMS = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    active: true,
  },
  {
    label: "Activity",
    icon: Activity,
    href: "/dashboard/activity",
    active: false,
  },
  { label: "Emails", icon: Mail, href: "/dashboard/emails", active: false },
  {
    label: "Analytics",
    icon: BarChart3,
    href: "/dashboard/analytics",
    active: false,
  },
  {
    label: "Branding",
    icon: Palette,
    href: "/dashboard/branding",
    active: false,
  },
  {
    label: "API Keys",
    icon: KeyRound,
    href: "/dashboard/api-keys",
    active: false,
  },
  {
    label: "Webhooks",
    icon: Webhook,
    href: "/dashboard/webhooks",
    active: false,
  },
  {
    label: "Playground",
    icon: FlaskConical,
    href: "/dashboard/playground",
    active: false,
  },
  {
    label: "Logs",
    icon: ScrollText,
    href: "/dashboard/logs",
    active: false,
  },
  { label: "Docs", icon: BookOpen, href: "/dashboard/docs", active: false },
  {
    label: "Notifications",
    icon: Bell,
    href: "/dashboard/notifications",
    active: false,
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
    active: false,
  },
];

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <aside
      className="flex h-full w-60 flex-col border-r border-gray-800/40 p-4"
      style={{ backgroundColor: "#060907" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
        </div>
        <span className="text-base font-semibold text-gray-100">Nixify</span>
      </div>

      {/* Nav */}
      <nav className="mt-6 flex-1 space-y-1">
        {NAV_ITEMS.map((item, i) => (
          <motion.a
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              item.active
                ? "bg-emerald-500/10 text-emerald-300"
                : "text-gray-400 hover:bg-gray-800/30 hover:text-gray-200"
            }`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.3, ease: EASE }}
          >
            {item.active && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-emerald-400"
              />
            )}
            <item.icon className="h-4 w-4" />
            {item.label}
          </motion.a>
        ))}
      </nav>

      {/* User profile footer */}
      <div className="border-t border-gray-800/40 pt-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-bold text-gray-900">
            AM
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-xs font-medium text-gray-200">
              Alex Morgan
            </p>
            <p className="truncate text-xs text-gray-500">Pro plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
