"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  LogOut,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { NixifyLogo } from "@/components/nixify-logo";
import {
  useLocale,
  useTranslations,
} from "@/lib/i18n/LocaleProvider";
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
  const { dir } = useLocale();
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

  // Scroll-aware hide/show — paused while the mobile menu is open so the
  // header never disappears underneath the open panel.
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

  // Escape closes the mobile menu + lock body scroll while it is open.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  // Auto-close the mobile menu on route change. This is a safety net for
  // programmatic navigation (router.push / back/forward) — the in-Link
  // `onClick` handlers close the menu for user-initiated clicks. The effect
  // dep is `[pathname]` only, so it does NOT cascade: a new pathname fires
  // the effect exactly once, closes the menu, and the menu stays closed.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync of external state (route) to UI state (menu open); effect deps are [pathname] only so it does NOT cascade
    setMobileOpen(false);
  }, [pathname]);

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

  const navItems = [
    { href: "/", label: t("header.nav.home"), active: pathname === "/" },
    {
      href: "/docs",
      label: t("header.nav.docs"),
      active: pathname === "/docs" || pathname === "/dashboard/docs",
    },
    {
      href: "/pricing",
      label: t("header.nav.pricing"),
      active: pathname === "/pricing",
    },
    {
      href: "/dashboard/playground",
      label: t("header.nav.playground"),
      active: pathname === "/dashboard/playground",
    },
  ];

  return (
    <>
      <motion.header
        dir={dir}
        className="fixed inset-x-0 top-0 z-50"
        animate={{ y: hidden && !mobileOpen ? -110 : 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        {/* ── Background layer (glass + subtle gradient border on scroll) ── */}
        <div
          className={cn(
            "absolute inset-0 transition-all duration-500",
            scrolled
              ? "border-b border-emerald-500/10 bg-[#060907]/80 backdrop-blur-xl"
              : "border-b border-white/[0.06] bg-[#060907]/40 backdrop-blur-md",
          )}
        />
        {/* Inner ring on scroll — barely-there premium edge */}
        <motion.div
          className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-emerald-500/[0.04]"
          animate={{ opacity: scrolled ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        />
        {/* Top edge gradient glow */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
          animate={{ opacity: scrolled ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        />

        {/* ── Inner container ──
            Mobile: simple flex row — hamburger at the START edge, logo
            centered, locale switcher at the END edge. No 3-col grid on
            mobile (it creates dead space and floats the hamburger).
            Desktop (md+): 3-col grid keeps the nav perfectly centered. */}
        <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-3 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-3">

          {/* ── START edge ──
              Mobile: hamburger button (44×44 touch target, anchored to the
              start edge — no dead space).
              Desktop: logo. */}
          {/* Mobile hamburger — START edge */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="relative grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-border/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 md:hidden"
            aria-label={t("header.aria.toggleMenu")}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
          >
            <HamburgerIcon open={mobileOpen} />
          </button>

          {/* Desktop logo — START (hidden on mobile, mobile shows centered logo below) */}
          <div className="hidden items-center justify-self-start md:flex">
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

          {/* ── CENTER ──
              Mobile: centered logo (between hamburger and locale switcher).
              Desktop: nav links. */}
          {/* Mobile centered logo */}
          <Link
            href="/"
            className="flex items-center gap-2 md:hidden"
            aria-label="Nixify"
          >
            <NixifyLogo size={26} />
            <span className="text-base font-semibold tracking-tight text-foreground">
              Nixify
            </span>
          </Link>

          {/* Desktop nav */}
          <nav
            aria-label={t("header.aria.primaryNav")}
            className="hidden items-center justify-center gap-1 md:flex"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={item.active}
              />
            ))}
          </nav>

          {/* ── END edge ── */}
          <div className="flex items-center justify-end gap-1.5">
            {state === "authed" ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden text-muted-foreground hover:bg-emerald-500/10 hover:text-foreground sm:flex"
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-4" aria-hidden="true" />
                    <span>{t("header.nav.dashboard")}</span>
                  </Link>
                </Button>

                {/* Profile avatar — click-based dropdown (mobile-friendly) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="group flex items-center gap-2 rounded-full border border-border/60 bg-border/20 py-1 ps-1 pe-2.5 transition-all hover:border-emerald-500/30 hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={t("header.accountFallback")}
                    >
                      <span
                        className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-bold text-gray-900 shadow-[0_0_0_1px_rgba(16,185,129,0.3),0_4px_12px_-2px_rgba(16,185,129,0.45)]"
                        aria-hidden="true"
                      >
                        {initials}
                      </span>
                      <span className="hidden text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground sm:inline">
                        {user?.fullName?.split(" ")[0] ||
                          user?.email?.split("@")[0] ||
                          t("header.accountFallback")}
                      </span>
                      <ChevronDown
                        className="size-3.5 text-muted-foreground/60 transition-transform duration-300 group-data-[state=open]:rotate-180"
                        aria-hidden="true"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="min-w-[15rem] p-1.5"
                  >
                    <div className="border-b border-border/60 px-3 py-2.5">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user?.fullName || t("header.userFallback")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground/70">
                        {user?.email}
                      </p>
                    </div>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-300 focus:bg-emerald-500/10 focus:text-emerald-600 dark:text-emerald-300"
                      >
                        <LayoutDashboard className="size-4" aria-hidden="true" />
                        {t("header.nav.dashboard")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        void handleLogout();
                      }}
                      disabled={loggingOut}
                      className="mt-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-300 focus:bg-rose-500/10 focus:text-rose-300"
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                      {loggingOut ? t("header.signingOut") : t("header.signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden text-muted-foreground hover:bg-emerald-500/10 hover:text-foreground sm:inline-flex"
                >
                  <Link href="/auth">{t("header.nav.signIn")}</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="hidden bg-emerald-600 text-white shadow-[0_4px_20px_-6px_rgba(16,185,129,0.5)] transition-all hover:bg-emerald-500 hover:shadow-[0_6px_28px_-4px_rgba(16,185,129,0.55)] sm:inline-flex"
                >
                  <Link href="/auth">{t("header.nav.signUp")}</Link>
                </Button>
              </>
            )}

            {/* Locale switcher — desktop (mobile uses the one in the mobile panel) */}
            <div className="hidden md:block">
              <LocaleSwitcher />
            </div>
            {/* Note: the mobile hamburger is at the START edge (above), not here.
                The END edge on mobile shows only the locale switcher (in the mobile
                panel) — keeping this div clean for desktop actions. */}
          </div>
        </div>
      </motion.header>

      {/* ── Mobile menu panel ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            dir={dir}
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Panel — slides down from the header */}
            <motion.nav
              id="mobile-nav-panel"
              aria-label={t("header.aria.primaryNav")}
              className={cn(
                "absolute inset-x-0 top-16 max-h-[calc(100vh-4rem)] overflow-y-auto",
                "border-b border-emerald-500/10 bg-[#060907]/95 backdrop-blur-2xl",
                "shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]",
              )}
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              <div className="mx-auto max-w-7xl px-4 pb-6 pt-3 sm:px-6">
                {/* Primary nav links */}
                <div className="space-y-1">
                  {navItems.map((item, i) => (
                    <MobileLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      active={item.active}
                      onClick={() => setMobileOpen(false)}
                      index={i}
                    />
                  ))}
                </div>

                {/* Divider */}
                <div className="my-4 h-px bg-gradient-to-r from-transparent via-border/70 to-transparent" />

                {/* Auth actions (Sign in / Sign up OR Dashboard / Sign out) */}
                {state === "authed" ? (
                  <div className="space-y-1">
                    <MobileActionLink
                      href="/dashboard"
                      icon={LayoutDashboard}
                      label={t("header.nav.dashboard")}
                      onClick={() => setMobileOpen(false)}
                      index={navItems.length}
                    />
                    <MobileActionButton
                      icon={LogOut}
                      label={
                        loggingOut ? t("header.signingOut") : t("header.signOut")
                      }
                      onClick={() => {
                        setMobileOpen(false);
                        void handleLogout();
                      }}
                      variant="danger"
                      index={navItems.length + 1}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.05 + navItems.length * 0.04,
                        duration: 0.25,
                      }}
                    >
                      <Button
                        asChild
                        variant="outline"
                        className="h-11 w-full border-border/60 bg-transparent text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-300"
                      >
                        <Link
                          href="/auth"
                          onClick={() => setMobileOpen(false)}
                        >
                          {t("header.nav.signIn")}
                        </Link>
                      </Button>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.05 + (navItems.length + 1) * 0.04,
                        duration: 0.25,
                      }}
                    >
                      <Button
                        asChild
                        className="h-11 w-full bg-emerald-600 text-white shadow-[0_4px_20px_-6px_rgba(16,185,129,0.5)] hover:bg-emerald-500"
                      >
                        <Link
                          href="/auth"
                          onClick={() => setMobileOpen(false)}
                        >
                          {t("header.nav.signUp")}
                        </Link>
                      </Button>
                    </motion.div>
                  </div>
                )}

                {/* Locale switcher — mobile */}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-border/40 bg-border/20 px-3 py-2">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                    {t("locale.switcher.title")}
                  </span>
                  <LocaleSwitcher />
                </div>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer to offset the fixed header height */}
      <div className="h-16" aria-hidden="true" />
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
        "group relative isolate inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
        active
          ? "text-emerald-600 dark:text-emerald-300"
          : "text-muted-foreground/90 hover:text-foreground",
      )}
    >
      {label}
      {/* Active pill — springs into place via layoutId */}
      {active && (
        <motion.div
          layoutId="nav-active-pill"
          className="absolute inset-0 -z-10 rounded-full bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      {/* Hover pill — gentle fade */}
      <span
        className={cn(
          "absolute inset-0 -z-10 rounded-full bg-border/40 transition-opacity duration-200",
          active ? "opacity-0" : "opacity-0 group-hover:opacity-100",
        )}
        aria-hidden="true"
      />
    </Link>
  );
}

function MobileLink({
  href,
  label,
  active,
  onClick,
  index,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04, duration: 0.25 }}
    >
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "flex min-h-[44px] items-center rounded-xl px-3.5 text-sm font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
          active
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20"
            : "text-muted-foreground hover:bg-border/40 hover:text-foreground",
        )}
      >
        <span className="flex-1">{label}</span>
        {/* Directional chevron — flips in RTL via logical `dir` */}
        <ChevronRight
          className="size-4 opacity-40 rtl:hidden"
          aria-hidden="true"
        />
        <ChevronLeft
          className="hidden size-4 opacity-40 rtl:block"
          aria-hidden="true"
        />
      </Link>
    </motion.div>
  );
}

function MobileActionLink({
  href,
  icon: Icon,
  label,
  onClick,
  index,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04, duration: 0.25 }}
    >
      <Link
        href={href}
        onClick={onClick}
        className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3.5 text-sm font-medium text-muted-foreground transition-all hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      >
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </Link>
    </motion.div>
  );
}

function MobileActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  index,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04, duration: 0.25 }}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
          variant === "danger"
            ? "text-rose-300 hover:bg-rose-500/10"
            : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-300",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </button>
    </motion.div>
  );
}

/**
 * Hamburger morph — three lines collapse into an X.
 *
 * Layout (container = 20px / line = 2px):
 *   • top line center y = 6  → rotates +45° and moves to y = 10
 *   • middle line center y = 10 → scales X to 0 and fades out
 *   • bottom line center y = 14 → rotates -45° and moves to y = 10
 *
 * The two outer lines meet at the container's vertical center (y = 10)
 * forming a clean X.
 */
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <div className="relative size-5" aria-hidden="true">
      <motion.span
        className="absolute left-0 right-0 top-[5px] h-0.5 rounded-full bg-current"
        animate={open ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
        style={{ transformOrigin: "center" }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      />
      <motion.span
        className="absolute left-0 right-0 top-[9px] h-0.5 rounded-full bg-current"
        animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
        style={{ transformOrigin: "center" }}
        transition={{ duration: 0.18 }}
      />
      <motion.span
        className="absolute left-0 right-0 bottom-[5px] h-0.5 rounded-full bg-current"
        animate={open ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
        style={{ transformOrigin: "center" }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      />
    </div>
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
