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
  Users,
  FileText,
  Zap,
  ShieldOff,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Sidebar — fixed navigation panel. Contains the logo, nav links, and a
 * user profile footer. Collapsible on mobile (handled by parent layout).
 *
 * Labels are sourced from the translation dictionary via `useTranslations()`.
 * Service names (Broadcasts, Webhooks, Playground) remain canonical English
 * product names — they are NOT translated, even on Persian pages.
 */

interface SidebarProps {
  onNavigate?: () => void;
}

interface NavItem {
  /** Translation key, e.g. "dashboard.nav.dashboard". */
  key: string;
  icon: LucideIcon;
  href: string;
  active?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard.nav.dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    active: true,
  },
  {
    key: "dashboard.nav.activity",
    icon: Activity,
    href: "/dashboard/activity",
    active: false,
  },
  { key: "dashboard.nav.emails", icon: Mail, href: "/dashboard/emails", active: false },
  { key: "dashboard.nav.contacts", icon: Users, href: "/dashboard/contacts", active: false },
  {
    key: "dashboard.nav.suppressions",
    icon: ShieldOff,
    href: "/dashboard/suppressions",
    active: false,
  },
  {
    key: "dashboard.nav.broadcasts",
    icon: Megaphone,
    href: "/dashboard/broadcasts",
    active: false,
  },
  {
    key: "dashboard.nav.templates",
    icon: FileText,
    href: "/dashboard/templates",
    active: false,
  },
  {
    key: "dashboard.nav.automations",
    icon: Zap,
    href: "/dashboard/automations",
    active: false,
  },
  {
    key: "dashboard.nav.analytics",
    icon: BarChart3,
    href: "/dashboard/analytics",
    active: false,
  },
  {
    key: "dashboard.nav.branding",
    icon: Palette,
    href: "/dashboard/branding",
    active: false,
  },
  {
    key: "dashboard.nav.apiKeys",
    icon: KeyRound,
    href: "/dashboard/api-keys",
    active: false,
  },
  {
    key: "dashboard.nav.webhooks",
    icon: Webhook,
    href: "/dashboard/webhooks",
    active: false,
  },
  {
    key: "dashboard.nav.playground",
    icon: FlaskConical,
    href: "/dashboard/playground",
    active: false,
  },
  {
    key: "dashboard.nav.logs",
    icon: ScrollText,
    href: "/dashboard/logs",
    active: false,
  },
  { key: "dashboard.nav.docs", icon: BookOpen, href: "/dashboard/docs", active: false },
  {
    key: "dashboard.nav.notifications",
    icon: Bell,
    href: "/dashboard/notifications",
    active: false,
  },
  {
    key: "dashboard.nav.settings",
    icon: Settings,
    href: "/dashboard/settings",
    active: false,
  },
];

export function Sidebar({ onNavigate }: SidebarProps) {
  const t = useTranslations();

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
      <nav className="mt-6 flex-1 space-y-1" aria-label="Sidebar navigation">
        {NAV_ITEMS.map((item, i) => {
          const label = t(item.key);
          return (
            <motion.a
              key={item.key}
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
              aria-current={item.active ? "page" : undefined}
            >
              {item.active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="sidebar-active-indicator absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-emerald-400"
                />
              )}
              <item.icon className="h-4 w-4" aria-hidden="true" />
              <span>{label}</span>
            </motion.a>
          );
        })}
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
