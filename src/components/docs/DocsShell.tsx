"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  BookOpen, ArrowLeft, ArrowRight, Search, X, Menu, Copy, Check,
  ChevronDown, ExternalLink,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import { useToast } from "@/hooks/use-toast";
import type { DocNavGroup, DocSection } from "@/lib/docs/types";

/**
 * DocsShell — the premium documentation layout shell.
 *
 * Shared by both public /docs and dashboard /dashboard/docs.
 *
 * Features:
 *   - Desktop sidebar with grouped sections + active highlighting
 *   - Mobile slide-out navigation
 *   - Client-side search (section/anchor filtering)
 *   - Task-oriented quick links
 *   - Sticky sidebar on desktop
 *   - Code blocks with copy button + LTR direction
 *   - Content width optimized for readability
 *   - RTL-aware layout
 *   - Reduced-motion support
 *   - Back-to-dashboard link (dashboard variant only)
 *   - Guides bridge links
 */

interface DocsShellProps {
  navGroups: DocNavGroup[];
  quickLinks?: { label: string; anchor: string }[];
  title: string;
  subtitle: string;
  isDashboard?: boolean;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}

export function DocsShell({
  navGroups,
  quickLinks,
  title,
  subtitle,
  isDashboard = false,
  backHref,
  backLabel,
  children,
}: DocsShellProps) {
  const { dir, locale } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeSection, setActiveSection] = React.useState<string>("");
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  // All sections flattened for search
  const allSections = React.useMemo(() => {
    return navGroups.flatMap(g => g.sections);
  }, [navGroups]);

  // Filtered sections based on search
  const filteredGroups = React.useMemo(() => {
    if (!searchQuery.trim()) return navGroups;
    const q = searchQuery.toLowerCase();
    return navGroups.map(g => ({
      ...g,
      sections: g.sections.filter(s =>
        s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
      ),
    })).filter(g => g.sections.length > 0);
  }, [navGroups, searchQuery]);

  // Track active section on scroll
  React.useEffect(() => {
    const handler = () => {
      const scrollY = window.scrollY + 120;
      for (const s of allSections) {
        const el = document.getElementById(s.id);
        if (el) {
          const top = el.offsetTop;
          const bottom = top + el.offsetHeight;
          if (scrollY >= top && scrollY < bottom) {
            setActiveSection(s.id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, [allSections]);

  function jumpToSection(id: string) {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const top = el.offsetTop - 100;
      window.scrollTo({ top, behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
    setMobileNavOpen(false);
  }

  return (
    <div className="relative min-h-screen pb-48" dir={dir}>
      {/* Header */}
      <div className={`border-b border-gray-800/40 bg-gray-950/40 backdrop-blur-xl ${isDashboard ? "" : "pt-20"}`}>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <BookOpen className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-100 sm:text-2xl">{title}</h1>
              <p className="text-sm text-gray-300">{subtitle}</p>
            </div>
            {isDashboard && backHref && (
              <Link
                href={backHref}
                className="hidden items-center gap-1.5 rounded-lg border border-gray-800/60 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-gray-800/40 sm:flex"
              >
                <BackArrow className="h-3.5 w-3.5" />
                {backLabel}
              </Link>
            )}
          </div>

          {/* Quick links (task-oriented) */}
          {quickLinks && quickLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {quickLinks.map((ql, i) => (
                <button
                  key={i}
                  onClick={() => jumpToSection(ql.anchor)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/10"
                >
                  {ql.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={locale === "fa" ? "جستجو..." : "Search..."}
                  className="w-full rounded-lg border border-gray-800/60 bg-gray-950/60 py-2 pl-9 pr-3 text-xs text-gray-200 placeholder:text-gray-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>

              {/* Nav groups */}
              <nav className="space-y-4">
                {filteredGroups.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {group.label}
                    </p>
                    <ul className="space-y-0.5">
                      {group.sections.map((s) => {
                        const Icon = s.icon;
                        const isActive = activeSection === s.id;
                        return (
                          <li key={s.id}>
                            <button
                              onClick={() => jumpToSection(s.id)}
                              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                                isActive
                                  ? "bg-emerald-500/10 text-emerald-300"
                                  : "text-gray-300 hover:bg-gray-800/40 hover:text-gray-200"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              <span className="flex-1 truncate">{s.label}</span>
                              {s.methodBadge && (
                                <Ltr>
                                  <span className="rounded bg-gray-800/60 px-1 py-0.5 text-[8px] font-mono text-gray-300">
                                    {s.methodBadge}
                                  </span>
                                </Ltr>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>

              {/* Guides bridge */}
              <div className="border-t border-gray-800/40 pt-3">
                <Link
                  href="/guide"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 transition hover:bg-emerald-500/10"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {locale === "fa" ? "راهنماها" : "Guides"}
                  <ArrowRight className={`h-3 w-3 ${isRTL ? "rotate-180" : ""}`} />
                </Link>
              </div>
            </div>
          </aside>

          {/* Mobile nav toggle */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Mobile nav drawer */}
          <AnimatePresence>
            {mobileNavOpen && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileNavOpen(false)}
              >
                <motion.div
                  initial={prefersReducedMotion ? { x: 0 } : { x: isRTL ? "100%" : "-100%" }}
                  animate={{ x: 0 }}
                  exit={prefersReducedMotion ? { x: 0 } : { x: isRTL ? "100%" : "-100%" }}
                  transition={{ duration: 0.3 }}
                  className={`absolute top-0 h-full w-72 bg-gray-950 p-4 ${isRTL ? "left-0" : "right-0"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-100">
                      {locale === "fa" ? "مستندات" : "Documentation"}
                    </h3>
                    <button onClick={() => setMobileNavOpen(false)} className="text-gray-300 hover:text-gray-200">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={locale === "fa" ? "جستجو..." : "Search..."}
                      className="w-full rounded-lg border border-gray-800/60 bg-gray-900/60 py-2 pl-9 pr-3 text-xs text-gray-200"
                    />
                  </div>
                  <nav className="max-h-[calc(100vh-120px)] space-y-4 overflow-y-auto">
                    {filteredGroups.map((group) => (
                      <div key={group.label}>
                        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          {group.label}
                        </p>
                        <ul className="space-y-0.5">
                          {group.sections.map((s) => {
                            const Icon = s.icon;
                            const isActive = activeSection === s.id;
                            return (
                              <li key={s.id}>
                                <button
                                  onClick={() => jumpToSection(s.id)}
                                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                                    isActive
                                      ? "bg-emerald-500/10 text-emerald-300"
                                      : "text-gray-300 hover:bg-gray-800/40"
                                  }`}
                                >
                                  <Icon className="h-3.5 w-3.5 shrink-0" />
                                  <span className="flex-1">{s.label}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </nav>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          <div className="min-w-0 space-y-8 pt-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Reusable components for docs content ──────────────────────────────── */

export function DocCard({
  id,
  icon: Icon,
  title,
  description,
  children,
  methodBadge,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
  methodBadge?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Icon className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
              {title}
              {methodBadge && (
                <Ltr>
                  <span className="rounded bg-gray-800/60 px-1.5 py-0.5 text-[9px] font-mono text-gray-300">
                    {methodBadge}
                  </span>
                </Ltr>
              )}
            </h2>
            {description && <p className="text-sm text-gray-300">{description}</p>}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

export function CodeBlock({
  code,
  lang,
  label,
}: {
  code: string;
  lang: string;
  label?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: "Copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-800/60 bg-gray-950/80">
      <div className="flex items-center justify-between border-b border-gray-800/40 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {label || lang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-gray-300 transition hover:bg-gray-800/40 hover:text-gray-200"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre dir="ltr" className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono text-gray-300">{code}</code>
      </pre>
    </div>
  );
}

export function EndpointBlock({
  method,
  path,
  children,
}: {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  children: React.ReactNode;
}) {
  const methodColor =
    method === "GET"
      ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
      : method === "POST"
        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        : method === "DELETE"
          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
          : "bg-amber-500/10 text-amber-400 border-amber-500/20";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Ltr>
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${methodColor}`}>
            {method}
          </span>
        </Ltr>
        <Ltr>
          <code className="font-mono text-sm text-gray-200">{path}</code>
        </Ltr>
      </div>
      {children}
    </div>
  );
}

export function ParamTable({
  params,
}: {
  params: { name: string; type: string; required: boolean; description: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800/60">
      <table className="w-full text-sm">
        <thead className="bg-gray-900/40">
          <tr className="border-b border-gray-800/60 text-left text-xs text-gray-300">
            <th className="px-3 py-2 font-medium">Parameter</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Required</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i} className="border-b border-gray-800/40 last:border-0">
              <td className="px-3 py-2">
                <Ltr>
                  <code className="font-mono text-xs text-emerald-300">{p.name}</code>
                </Ltr>
              </td>
              <td className="px-3 py-2">
                <Ltr>
                  <code className="font-mono text-xs text-gray-300">{p.type}</code>
                </Ltr>
              </td>
              <td className="px-3 py-2">
                {p.required ? (
                  <span className="text-[10px] font-medium text-rose-400">required</span>
                ) : (
                  <span className="text-[10px] font-medium text-gray-400">optional</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-gray-300">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GuideBridgeLink({ href, label }: { href: string; label: string }) {
  const isRTL = useLocale().dir === "rtl";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/10"
    >
      <BookOpen className="h-3 w-3" />
      {label}
      <ArrowRight className={`h-3 w-3 ${isRTL ? "rotate-180" : ""}`} />
    </Link>
  );
}
