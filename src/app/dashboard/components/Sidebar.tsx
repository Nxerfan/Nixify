"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { onProfileUpdated } from "@/lib/profile-events";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Sidebar — fixed navigation panel. Contains the logo, grouped nav links, and
 * a real authenticated-user profile footer with Settings + Sign out actions.
 *
 * Active-state logic:
 *   - Derived from `usePathname()` — never hardcoded.
 *   - `/dashboard` is active ONLY on the exact root (`/dashboard`).
 *   - Each section highlights only its own navigation item.
 *   - Nested routes keep their parent section active (e.g.
 *     `/dashboard/contacts/123` keeps "Contacts" active).
 *   - Dashboard is NEVER shown as active while the user is inside
 *     Broadcasts, Emails, Automations, etc.
 */

interface SidebarProps {
  onNavigate?: () => void;
}

interface NavItem {
  /** Translation key, e.g. "dashboard.nav.dashboard". */
  key: string;
  icon: LucideIcon;
  href: string;
  /** Group label key. */
  group: "main" | "content" | "developer" | "account";
}

const NAV_ITEMS: NavItem[] = [
  // Main — overview + activity
  { key: "dashboard.nav.dashboard", icon: LayoutDashboard, href: "/dashboard", group: "main" },
  { key: "dashboard.nav.activity", icon: Activity, href: "/dashboard/activity", group: "main" },
  { key: "dashboard.nav.analytics", icon: BarChart3, href: "/dashboard/analytics", group: "main" },

  // Content — email, contacts, broadcasts
  { key: "dashboard.nav.emails", icon: Mail, href: "/dashboard/emails", group: "content" },
  { key: "dashboard.nav.contacts", icon: Users, href: "/dashboard/contacts", group: "content" },
  { key: "dashboard.nav.suppressions", icon: ShieldOff, href: "/dashboard/suppressions", group: "content" },
  { key: "dashboard.nav.broadcasts", icon: Megaphone, href: "/dashboard/broadcasts", group: "content" },
  { key: "dashboard.nav.templates", icon: FileText, href: "/dashboard/templates", group: "content" },
  { key: "dashboard.nav.automations", icon: Zap, href: "/dashboard/automations", group: "content" },
  { key: "dashboard.nav.branding", icon: Palette, href: "/dashboard/branding", group: "content" },

  // Developer — API keys, webhooks, playground, logs, docs
  { key: "dashboard.nav.apiKeys", icon: KeyRound, href: "/dashboard/api-keys", group: "developer" },
  { key: "dashboard.nav.webhooks", icon: Webhook, href: "/dashboard/webhooks", group: "developer" },
  { key: "dashboard.nav.playground", icon: FlaskConical, href: "/dashboard/playground", group: "developer" },
  { key: "dashboard.nav.logs", icon: ScrollText, href: "/dashboard/logs", group: "developer" },
  { key: "dashboard.nav.docs", icon: BookOpen, href: "/dashboard/docs", group: "developer" },

  // Account — notifications, settings
  { key: "dashboard.nav.notifications", icon: Bell, href: "/dashboard/notifications", group: "account" },
  { key: "dashboard.nav.settings", icon: Settings, href: "/dashboard/settings", group: "account" },
];

const GROUP_LABEL_KEYS: Record<NavItem["group"], string | null> = {
  main: null, // no label for the first group
  content: "dashboard.nav.groups.content",
  developer: "dashboard.nav.groups.developer",
  account: "dashboard.nav.groups.account",
};

/**
 * Determine if a nav item is active based on the current pathname.
 *
 * - `/dashboard` (exact) is active ONLY when pathname === "/dashboard".
 * - Other items are active when pathname === item.href OR
 *   pathname.startsWith(item.href + "/") (nested routes keep parent active).
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(href + "/");
}

interface UserProfile {
  fullName: string | null;
  email: string;
  plan: string;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = () => {
      fetch("/api/profile/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data?.user) return;
          setUser({
            fullName: data.user.fullName ?? null,
            email: data.user.email ?? "",
            plan: data.user.plan ?? "FREE",
          });
        })
        .catch(() => {});
    };
    loadProfile();
    // Listen for profile updates from Settings so the sidebar refreshes
    // the display name without requiring a full page reload.
    const unsub = onProfileUpdated(loadProfile);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // best-effort
    }
    router.push("/auth");
  }

  // Derive initials from real user data.
  const displayName =
    user?.fullName ||
    user?.email?.split("@")[0] ||
    t("dashboard.nav.userFallback");
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Group items for rendering.
  const groups: NavItem["group"][] = ["main", "content", "developer", "account"];

  return (
    <aside
      className="flex h-full w-64 flex-col border-r border-border/60 bg-card"
      
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
        </div>
        <span className="text-base font-semibold text-foreground">Nixify</span>
      </div>

      {/* Nav — grouped with labels */}
      <nav className="mt-2 flex-1 overflow-y-auto px-3" aria-label="Sidebar navigation">
        {groups.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
          const labelKey = GROUP_LABEL_KEYS[group];
          return (
            <div key={group} className="mb-4">
              {labelKey && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  {t(labelKey)}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item, i) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <motion.div
                      key={item.key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.02, duration: 0.2, ease: EASE }}
                    >
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? "bg-emerald-500/10 text-emerald-300 font-medium"
                            : "text-muted-foreground hover:bg-border/30 hover:text-foreground"
                        }`}
                        aria-current={active ? "page" : undefined}
                      >
                        {active && (
                          <span className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-emerald-400 ltr:left-0 rtl:right-0" />
                        )}
                        <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{t(item.key)}</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User profile footer — real data + actions */}
      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-bold text-gray-900">
            {initials || "?"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-xs font-medium text-foreground">
              {displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground/70">
              {user ? t(`dashboard.nav.plans.${user.plan.toLowerCase()}`) : ""}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-2 flex gap-1">
          <Link
            href="/dashboard/settings"
            onClick={onNavigate}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-border/40 hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
            {t("dashboard.nav.settings")}
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            {signingOut ? t("dashboard.nav.signingOut") : t("dashboard.nav.signOut")}
          </button>
        </div>
      </div>
    </aside>
  );
}
