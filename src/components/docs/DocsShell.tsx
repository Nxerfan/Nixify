"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BookOpen, Search, X, Menu, Copy, Check, ArrowLeft, ArrowRight,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import { useToast } from "@/hooks/use-toast";
import type { DocNavGroup } from "@/lib/docs/types";

/**
 * DocsShell — premium editorial documentation layout.
 *
 * Design principles:
 *   - Content is the hero, not cards
 *   - Clean reading flow with strong typography
 *   - Compact left navigation (not card-wrapped)
 *   - Editorial content column with proper max-width
 *   - Optional right-side TOC for current section anchors
 *   - Mobile slide-out navigation
 *   - Search with keyboard accessibility
 *   - Code blocks with copy + LTR direction
 *   - RTL-aware layout
 *
 * Avoids:
 *   - Card soup (every paragraph in a bordered panel)
 *   - Excessive gradients/decoration
 *   - Generic SaaS widget appearance
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

  const allSections = React.useMemo(() => {
    return navGroups.flatMap(g => g.sections);
  }, [navGroups]);

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
    <div className="min-h-screen pb-48" dir={dir}>
      {/* Compact premium header */}
      <div className={`border-b border-gray-800/40 ${isDashboard ? "" : "pt-20"}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-3 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <BookOpen className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-gray-100">{title}</h1>
              <p className="hidden text-xs text-gray-400 sm:block">{subtitle}</p>
            </div>
            {isDashboard && backHref && (
              <Link
                href={backHref}
                className="flex items-center gap-1.5 rounded-lg border border-gray-800/60 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-gray-800/40"
              >
                <BackArrow className="h-3.5 w-3.5" />
                {backLabel}
              </Link>
            )}
          </div>
          {quickLinks && quickLinks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-3">
              {quickLinks.map((ql, i) => (
                <button
                  key={i}
                  onClick={() => jumpToSection(ql.anchor)}
                  className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[11px] text-emerald-300 transition hover:bg-emerald-500/10"
                >
                  {ql.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-10">
          {/* Left navigation — compact, not card-wrapped */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={locale === "fa" ? "جستجو..." : "Search..."}
                  className="w-full rounded-lg border border-gray-800/60 bg-gray-950/60 py-1.5 pl-8 pr-2 text-xs text-gray-200 placeholder:text-gray-600 focus:border-emerald-500/40 focus:outline-none"
                />
              </div>
              {/* Nav groups */}
              <nav className="space-y-3">
                {filteredGroups.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-wider text-gray-600">
                      {group.label}
                    </p>
                    <ul className="space-y-px">
                      {group.sections.map((s) => {
                        const Icon = s.icon;
                        const isActive = activeSection === s.id;
                        return (
                          <li key={s.id}>
                            <button
                              onClick={() => jumpToSection(s.id)}
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
                                isActive
                                  ? "bg-emerald-500/10 text-emerald-300 font-medium"
                                  : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-200"
                              }`}
                            >
                              <Icon className="h-3 w-3 shrink-0" />
                              <span className="flex-1 truncate">{s.label}</span>
                              {s.methodBadge && (
                                <Ltr>
                                  <span className="rounded bg-gray-800/60 px-1 py-0.5 text-[7px] font-mono text-gray-500">
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
              <Link
                href="/guide"
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-emerald-400 transition hover:bg-emerald-500/10"
              >
                <BookOpen className="h-3 w-3" />
                {locale === "fa" ? "راهنماها" : "Guides"}
                <ArrowRight className={`h-3 w-3 ${isRTL ? "rotate-180" : ""}`} />
              </Link>
            </div>
          </aside>

          {/* Mobile nav */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

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
                  transition={{ duration: 0.25 }}
                  className={`absolute top-0 h-full w-72 bg-gray-950 p-4 ${isRTL ? "left-0" : "right-0"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-100">
                      {locale === "fa" ? "مستندات" : "Documentation"}
                    </h3>
                    <button onClick={() => setMobileNavOpen(false)} className="text-gray-400">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={locale === "fa" ? "جستجو..." : "Search..."}
                      className="w-full rounded-lg border border-gray-800/60 bg-gray-900/60 py-2 pl-8 pr-2 text-xs text-gray-200"
                    />
                  </div>
                  <nav className="max-h-[calc(100vh-100px)] space-y-3 overflow-y-auto">
                    {filteredGroups.map((group) => (
                      <div key={group.label}>
                        <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-wider text-gray-600">
                          {group.label}
                        </p>
                        <ul className="space-y-px">
                          {group.sections.map((s) => {
                            const Icon = s.icon;
                            const isActive = activeSection === s.id;
                            return (
                              <li key={s.id}>
                                <button
                                  onClick={() => jumpToSection(s.id)}
                                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
                                    isActive
                                      ? "bg-emerald-500/10 text-emerald-300"
                                      : "text-gray-400 hover:bg-gray-800/40"
                                  }`}
                                >
                                  <Icon className="h-3 w-3 shrink-0" />
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

          {/* Content — editorial reading column */}
          <div className="min-w-0 max-w-3xl space-y-10 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Editorial content components ──────────────────────────────────────── */

export function DocSection({
  id,
  icon: Icon,
  title,
  description,
  methodBadge,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  methodBadge?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-4 flex items-center gap-2.5 border-b border-gray-800/40 pb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-100">
            {title}
            {methodBadge && (
              <Ltr>
                <span className="rounded bg-gray-800/60 px-1.5 py-0.5 text-[8px] font-mono text-gray-400">
                  {methodBadge}
                </span>
              </Ltr>
            )}
          </h2>
          {description && <p className="text-xs text-gray-400">{description}</p>}
        </div>
      </div>
      <div className="space-y-4 text-sm leading-relaxed text-gray-300">
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
    <div className="group relative overflow-hidden rounded-lg border border-gray-800/60 bg-gray-950/60">
      <div className="flex items-center justify-between border-b border-gray-800/40 px-3 py-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {label || lang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-gray-400 transition hover:bg-gray-800/40 hover:text-gray-200"
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

export function EndpointRow({
  method,
  path,
}: {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
}) {
  const methodColor =
    method === "GET"
      ? "bg-sky-500/10 text-sky-400"
      : method === "POST"
        ? "bg-emerald-500/10 text-emerald-400"
        : method === "DELETE"
          ? "bg-rose-500/10 text-rose-400"
          : "bg-amber-500/10 text-amber-400";

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-800/40 bg-gray-950/40 px-3 py-2">
      <Ltr>
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${methodColor}`}>
          {method}
        </span>
      </Ltr>
      <Ltr>
        <code className="font-mono text-sm text-gray-200">{path}</code>
      </Ltr>
    </div>
  );
}

export function ParamTable({
  params,
}: {
  params: { name: string; type: string; required: boolean; description: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-800/40">
      <table className="w-full text-xs">
        <thead className="bg-gray-900/30">
          <tr className="border-b border-gray-800/40 text-left text-gray-500">
            <th className="px-3 py-2 font-medium">Parameter</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Required</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i} className="border-b border-gray-800/30 last:border-0">
              <td className="px-3 py-2">
                <Ltr><code className="font-mono text-xs text-emerald-300">{p.name}</code></Ltr>
              </td>
              <td className="px-3 py-2">
                <Ltr><code className="font-mono text-xs text-gray-400">{p.type}</code></Ltr>
              </td>
              <td className="px-3 py-2">
                {p.required ? (
                  <span className="text-[10px] text-rose-400">required</span>
                ) : (
                  <span className="text-[10px] text-gray-500">optional</span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-300">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
        {n}
      </div>
      <div className="flex-1 space-y-2">
        <h4 className="text-sm font-medium text-gray-200">{title}</h4>
        {children}
      </div>
    </div>
  );
}

export function Note({
  type = "info",
  children,
}: {
  type?: "info" | "warning";
  children: React.ReactNode;
}) {
  const cls = type === "warning"
    ? "border-amber-500/20 bg-amber-500/5 text-amber-200/80"
    : "border-sky-500/20 bg-sky-500/5 text-sky-200/80";
  return (
    <div className={`rounded-lg border ${cls} px-3 py-2 text-xs`}>
      {children}
    </div>
  );
}

export function GuideLink({ href, label }: { href: string; label: string }) {
  const isRTL = useLocale().dir === "rtl";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs text-emerald-400 transition hover:text-emerald-300"
    >
      <BookOpen className="h-3 w-3" />
      {label}
      <ArrowRight className={`h-3 w-3 ${isRTL ? "rotate-180" : ""}`} />
    </Link>
  );
}
