"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BookOpen, Search, X, Menu, Copy, Check, ArrowLeft, ArrowRight,
  ChevronRight,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import { useToast } from "@/hooks/use-toast";
import type { DocNavGroup } from "@/lib/docs/types";

/**
 * DocsShell — premium documentation layout with a surface system.
 *
 * VISUAL HIERARCHY (4 levels):
 *   Level 1: Page hero (on raw background — the only exception)
 *   Level 2: Chapter containers (DocsChapter — rounded panel with border)
 *   Level 3: Subsections inside chapters (DocsSubsection — tinted surface)
 *   Level 4: Technical detail surfaces (code, tables, callouts, params)
 *
 * SURFACE SYSTEM:
 *   - Page background: bg-background (darkest, used as spacing between chapters)
 *   - Chapter surface: bg-card/60 with border-border (elevated panel)
 *   - Subsection surface: bg-muted/40 with border-border/60 (nested tint)
 *   - Code surface: bg-card with border-gray-800 (darkest, distinct)
 *   - Callout surfaces: tinted (amber, sky, emerald, rose)
 *
 * SPACING RHYTHM:
 *   - Chapter gap: mb-8 (32px between chapter containers)
 *   - Subsection gap: space-y-4 (16px between subsections inside chapters)
 *   - Paragraph gap: space-y-3 (12px between paragraphs)
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
      const scrollY = window.scrollY + 140;
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
      {/* ── LEVEL 1: Hero area (on raw page background — intentional exception) ── */}
      <div className={`border-b border-border/40 ${isDashboard ? "" : "pt-20"}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-3 py-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <BookOpen className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              <p className="hidden text-sm text-muted-foreground sm:block">{subtitle}</p>
            </div>
            {isDashboard && backHref && (
              <Link
                href={backHref}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-border/40"
              >
                <BackArrow className="h-3.5 w-3.5" />
                {backLabel}
              </Link>
            )}
          </div>
          {quickLinks && quickLinks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-4">
              {quickLinks.map((ql, i) => (
                <button
                  key={i}
                  onClick={() => jumpToSection(ql.anchor)}
                  className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[11px] text-emerald-300 transition hover:bg-emerald-500/10"
                >
                  {ql.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main layout: sidebar + content ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
          {/* ── Sidebar (Level 2 surface) ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              {/* Sidebar panel — its own visual surface */}
              <div className="rounded-xl border border-border bg-card/60 p-3 backdrop-blur-sm">
                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={locale === "fa" ? "جستجو..." : "Search..."}
                    className="w-full rounded-lg border border-border bg-muted/60 py-1.5 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/40 focus:outline-none"
                  />
                </div>
                {/* Nav groups */}
                <nav className="space-y-3">
                  {filteredGroups.map((group) => (
                    <div key={group.label}>
                      <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
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
                                    ? "bg-emerald-500/15 text-emerald-300 font-medium ring-1 ring-emerald-500/20"
                                    : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
                                }`}
                              >
                                <Icon className="h-3 w-3 shrink-0" />
                                <span className="flex-1 truncate">{s.label}</span>
                                {s.methodBadge && (
                                  <Ltr>
                                    <span className="rounded bg-border/60 px-1 py-0.5 text-[7px] font-mono text-muted-foreground/70">
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
                <div className="mt-3 border-t border-border/60 pt-2">
                  <Link
                    href="/guide"
                    className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-emerald-400 transition hover:bg-emerald-500/10"
                  >
                    <BookOpen className="h-3 w-3" />
                    {locale === "fa" ? "راهنماها" : "Guides"}
                    <ArrowRight className={`h-3 w-3 ${isRTL ? "rotate-180" : ""}`} />
                  </Link>
                </div>
              </div>
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
                  className={`absolute top-0 h-full w-72 bg-card p-4 ${isRTL ? "left-0" : "right-0"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      {locale === "fa" ? "مستندات" : "Documentation"}
                    </h3>
                    <button onClick={() => setMobileNavOpen(false)} className="text-muted-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={locale === "fa" ? "جستجو..." : "Search..."}
                      className="w-full rounded-lg border border-border bg-muted/60 py-2 pl-8 pr-2 text-xs text-foreground"
                    />
                  </div>
                  <nav className="max-h-[calc(100vh-100px)] space-y-3 overflow-y-auto">
                    {filteredGroups.map((group) => (
                      <div key={group.label}>
                        <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
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
                                      : "text-muted-foreground hover:bg-border/40"
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

          {/* ── Content column — chapters live here ── */}
          <div className="min-w-0 max-w-3xl py-8">
            {/* Chapters are rendered by children as <DocsChapter> blocks */}
            <div className="space-y-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * LEVEL 2: Chapter Container
 * A major documentation chapter — a clearly defined visual surface with
 * its own border, background, padding, and header. Chapters are separated
 * by generous gaps (space-y-8 in the parent).
 * ══════════════════════════════════════════════════════════════════════════ */

export function DocsChapter({
  id,
  icon: Icon,
  title,
  description,
  badge,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 overflow-hidden rounded-2xl border border-border bg-card/50 shadow-xl shadow-black/30 ring-1 ring-gray-800/30 transition-all duration-200 hover:border-gray-700/60 hover:shadow-2xl hover:shadow-black/40"
    >
      {/* Chapter header — distinct visual zone */}
      <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-gray-900/40 to-gray-900/10 px-5 py-4 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
            {title}
            {badge && (
              <Ltr>
                <span className="rounded bg-border/60 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
                  {badge}
                </span>
              </Ltr>
            )}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {/* Chapter body — internal content with consistent padding */}
      <div className="space-y-4 p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * LEVEL 3: Subsection — a tinted surface inside a chapter
 * Used for grouping related content (e.g., "Request", "Response", "Parameters")
 * ══════════════════════════════════════════════════════════════════════════ */

export function DocsSubsection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      {title && (
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * LEVEL 4: Technical detail surfaces
 * ══════════════════════════════════════════════════════════════════════════ */

/** Code surface — darkest background, distinct from chapter/subsection */
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
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {label || lang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-border/40 hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre dir="ltr" className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono text-muted-foreground">{code}</code>
      </pre>
    </div>
  );
}

/** Endpoint block — a self-contained endpoint documentation module */
export function EndpointBlock({
  method,
  path,
  children,
}: {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  children?: React.ReactNode;
}) {
  const methodColor =
    method === "GET"
      ? "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/20"
      : method === "POST"
        ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20"
        : method === "DELETE"
          ? "bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/20"
          : "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
        <Ltr>
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${methodColor}`}>
            {method}
          </span>
        </Ltr>
        <Ltr>
          <code className="font-mono text-sm text-foreground">{path}</code>
        </Ltr>
      </div>
      {children}
    </div>
  );
}

/** Parameter table — inside its own bordered surface */
export function ParamTable({
  params,
}: {
  params: { name: string; type: string; required: boolean; description: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr className="border-b border-border/60 text-left text-muted-foreground/70">
            <th className="px-3 py-2 font-medium">Parameter</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Required</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2">
                <Ltr><code className="font-mono text-xs text-emerald-300">{p.name}</code></Ltr>
              </td>
              <td className="px-3 py-2">
                <Ltr><code className="font-mono text-xs text-muted-foreground">{p.type}</code></Ltr>
              </td>
              <td className="px-3 py-2">
                {p.required ? (
                  <span className="text-[10px] text-rose-400">required</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/70">optional</span>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Quick start step — numbered, with its own visual zone */
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
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-400 ring-1 ring-emerald-500/20">
          {n}
        </div>
        <div className="flex-1 space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Callout surfaces — purpose-specific tinted blocks */
export function Note({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-sky-500/20 bg-sky-500/5 text-sky-200/80",
    warning: "border-amber-500/20 bg-amber-500/5 text-amber-200/80",
    success: "border-emerald-500/20 bg-emerald-500/5 text-emerald-200/80",
  };
  return (
    <div className={`rounded-lg border ${styles[type]} px-3 py-2 text-xs`}>
      {children}
    </div>
  );
}

/** Guide link — inline cross-reference */
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
