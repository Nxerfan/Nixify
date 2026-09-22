"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  motion,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { LogOut, LayoutDashboard, Sparkles, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { NixifyLogo } from "@/components/nixify-logo";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

type AuthState = "loading" | "authed" | "anon";

const EASE = [0.22, 1, 0.36, 1] as const;

interface UserInfo {
  email: string;
  fullName: string | null;
}

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const t = useTranslations();
  const [state, setState] = React.useState<AuthState>("loading");
  const [user, setUser] = React.useState<UserInfo | null>(null);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  // Auth check — fetch user info. Re-runs on every route change so the header
  // updates immediately after login/logout without needing a full page reload.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setState("authed");
          setUser({
            email: data.user?.email ?? "",
            fullName: data.user?.fullName ?? null,
          });
        } else {
          setState("anon");
          setUser(null);
        }
      } catch {
        if (!cancelled) setState("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Scroll-aware
  React.useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      if (y > lastY && y > 100 && !mobileOpen) setHidden(true);
      else setHidden(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mobileOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setState("anon");
      setUser(null);
      toast({
        title: t("header.toast.loggedOut"),
        description: t("header.toast.loggedOutDesc"),
      });
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  // Derive initials from user name or email
  const initials = React.useMemo(() => {
    if (user?.fullName) {
      return user.fullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "?";
  }, [user]);

  return (
    <>
      <motion.header
        className="fixed top-0 z-50 w-full"
        animate={{ y: hidden ? -100 : 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {/* Background layer */}
        <div
          className={cn(
            "absolute inset-0 border-b transition-all duration-500",
            scrolled
              ? "border-emerald-500/10 bg-[#060907]/85 backdrop-blur-xl"
              : "border-transparent bg-[#060907]/40 backdrop-blur-md",
          )}
        />

        {/* Top edge glow */}
        <motion.div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"
          animate={{ opacity: scrolled ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        />

        {/* ── 3-column grid for perfect centering ── */}
        <div className="relative mx-auto grid h-16 w-full max-w-7xl grid-cols-3 items-center px-4 sm:px-6">
          {/* ── Left: Logo ── */}
          <div className="flex items-center justify-self-start">
            <MagneticLink href="/" className="group flex items-center gap-2.5">
              <motion.div
                className="flex items-center justify-center"
                whileHover={{ scale: 1.06 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <NixifyLogo size={28} />
              </motion.div>
              <span className="text-base font-semibold tracking-tight text-foreground">
                Nixify
              </span>
            </MagneticLink>
          </div>

          {/* ── Center: Nav — perfectly centered regardless of side content ── */}
          <nav
            className="hidden items-center justify-center gap-0.5 md:flex"
            aria-label={t("header.aria.primaryNav")}
          >
            <NavLink href="/" label={t("header.nav.home")} active={pathname === "/"} />
            <NavLink
              href="/docs"
              label={t("header.nav.docs")}
              active={pathname === "/docs" || pathname === "/dashboard/docs"}
            />
            <NavLink
              href="/pricing"
              label={t("header.nav.pricing")}
              active={pathname === "/pricing"}
            />
            <NavLink
              href="/dashboard/playground"
              label={t("header.nav.playground")}
              active={pathname === "/dashboard/playground"}
            />
          </nav>

          {/* ── Right: Actions ── */}
          <div className="flex items-center justify-end gap-1.5">
            {state === "authed" ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden text-muted-foreground hover:text-foreground hover:bg-emerald-500/10 sm:flex"
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-4" aria-hidden="true" />
                    <span>{t("header.nav.dashboard")}</span>
                  </Link>
                </Button>

                {/* Profile avatar with dropdown */}
                <div className="group relative">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 rounded-full border border-border/40 bg-border/30 py-1 pl-1 pr-3 transition-all hover:border-emerald-500/30 hover:bg-border/50"
                  >
                    <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-bold text-gray-900">
                      {initials}
                    </div>
                    <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
                      {user?.fullName?.split(" ")[0] ||
                        user?.email?.split("@")[0] ||
                        t("header.accountFallback")}
                    </span>
                  </Link>

                  {/* Hover dropdown */}
                  <div className="invisible absolute right-0 top-full z-50 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                    <div className="w-48 overflow-hidden rounded-xl border border-border bg-[#060907]/95 p-2 backdrop-blur-xl">
                      <div className="border-b border-border/60 px-3 py-2">
                        <p className="truncate text-xs font-medium text-foreground">
                          {user?.fullName || t("header.userFallback")}
                        </p>
                        <p className="truncate text-xs text-muted-foreground/50">
                          {user?.email}
                        </p>
                      </div>
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300"
                      >
                        <LayoutDashboard className="size-3.5" />
                        {t("header.nav.dashboard")}
                      </Link>
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300"
                      >
                        <LogOut className="size-3.5" />
                        {loggingOut ? t("header.signingOut") : t("header.signOut")}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Free plan badge */}
                <motion.span
                  className="hidden items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300/80 lg:flex"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.3,
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  }}
                >
                  <Sparkles className="size-3" />
                  {t("header.badge.freePlan")}
                </motion.span>

                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground hover:bg-emerald-500/10"
                >
                  <Link href="/auth">{t("header.nav.signIn")}</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.3)]"
                >
                  <Link href="/auth">{t("header.nav.signUp")}</Link>
                </Button>
              </>
            )}

            {/* Language switcher — desktop */}
            <LocaleSwitcher />

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="ml-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-border/40 hover:text-foreground md:hidden"
              aria-label={t("header.aria.toggleMenu")}
            >
              {mobileOpen ? (
                <X className="size-5" />
              ) : (
                <Menu className="size-5" />
              )}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.nav
              className="absolute left-0 right-0 top-16 space-y-1 border-b border-emerald-500/10 bg-[#060907]/95 p-4 backdrop-blur-xl"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              {[
                { href: "/", label: t("header.nav.home") },
                { href: "/docs", label: t("header.nav.docs") },
                { href: "/pricing", label: t("header.nav.pricing") },
                { href: "/dashboard/playground", label: t("header.nav.playground") },
                { href: "/auth", label: t("header.nav.signInOrSignUp") },
              ].map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              {/* Language switcher — mobile */}
              <div className="border-t border-border/60 pt-2">
                <LocaleSwitcher />
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer */}
      <div className="h-16" />
    </>
  );
}

// ---- Sub-components --------------------------------------------------------

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative px-3 py-2 text-sm font-medium transition-colors",
        active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {/* Active indicator — springs into place */}
      {active && (
        <motion.div
          layoutId="nav-active"
          className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-emerald-400"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
      {/* Hover indicator — gentle fade */}
      <div
        className={cn(
          "absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-gray-600 transition-opacity duration-300",
          active ? "opacity-0" : "opacity-0 group-hover:opacity-100",
        )}
      />
    </Link>
  );
}

function MagneticLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.5 });

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    x.set(dx * 6);
    y.set(dy * 6);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: springX, y: springY }}
      className={cn(
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-md",
        className,
      )}
    >
      {children}
    </motion.a>
  );
}
