"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck, Eye, CheckCircle2, XCircle, Info,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  ScopesExplainerCopy,
  ScopeExampleCopy,
} from "@/lib/guide/content/guides/api-keys-types";

/**
 * Scopes explainer — full vs read_only, with examples.
 *
 * Renders two scope cards (full = emerald, read_only = sky), then renders
 * a per-endpoint matrix showing what each scope can call. Footnote points
 * to hasScope() in src/lib/dx/api-keys.ts.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper.
 *
 * Tokens (full, read_only, HTTP method names like GET / POST, file paths)
 * stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

export function ScopesExplainer({
  copy,
}: {
  copy: ScopesExplainerCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  return (
    <article
      className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-7"
      dir={dir}
    >
      <header className="mb-5">
        <h3 className="text-lg font-bold text-foreground sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.subheading}</p>
      </header>

      {/* Two scope cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {/* full card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
              <Ltr>{copy.fullCard.badge}</Ltr>
            </span>
            <span className="ml-auto text-[11px] text-emerald-700 dark:text-emerald-300">{copy.fullCard.title}</span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{copy.fullCard.body}</p>
          <ul className="mt-3 space-y-1">
            {copy.fullCard.bullets.map((bullet, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
              >
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* read_only card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : 0.05 }}
          className="rounded-xl border border-sky-500/40 bg-sky-500/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <Eye className="h-4 w-4 text-sky-400" />
            <span className="inline-flex items-center rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-mono text-sky-300">
              <Ltr>{copy.readOnlyCard.badge}</Ltr>
            </span>
            <span className="ml-auto text-[11px] text-sky-300">{copy.readOnlyCard.title}</span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{copy.readOnlyCard.body}</p>
          <ul className="mt-3 space-y-1">
            {copy.readOnlyCard.bullets.map((bullet, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
              >
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-sky-400" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Examples matrix */}
      <div className="mb-5">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {copy.matrixTitle}
        </p>
        <p className="mb-3 text-xs text-muted-foreground">{copy.matrixSubtitle}</p>

        {/* Header row */}
        <div className="hidden lg:grid grid-cols-12 gap-2 px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="col-span-5">{copy.methodCol}</div>
          <div className="col-span-4">{copy.descCol}</div>
          <div className="col-span-1 text-center">{copy.fullCol}</div>
          <div className="col-span-2 text-center">{copy.readOnlyCol}</div>
        </div>

        <div className="space-y-1">
          {copy.examples.map((ex, i) => (
            <ExampleRow
              key={i}
              ex={ex}
              copy={copy}
              prefersReducedMotion={!!prefersReducedMotion}
              delay={i * 0.04}
            />
          ))}
        </div>
      </div>

      {/* Custom-scopes note (sky-blue) */}
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p className="text-[11px] text-muted-foreground">{copy.customScopesNote}</p>
      </div>

      {/* Footnote */}
      <p className="rounded-xl border border-border bg-card/60 p-3 text-xs text-muted-foreground">
        {copy.footnote}
      </p>
    </article>
  );
}

/* ─── Example row ────────────────────────────────────────────────────────── */

function ExampleRow({
  ex,
  copy,
  prefersReducedMotion,
  delay,
}: {
  ex: ScopeExampleCopy;
  copy: ScopesExplainerCopy;
  prefersReducedMotion: boolean;
  delay: number;
}): React.ReactElement {
  const accentBorder =
    ex.tone === "write" ? "border-rose-500/30" : "border-emerald-500/30";
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, delay: prefersReducedMotion ? 0 : delay }}
      className={`rounded-xl border ${accentBorder} bg-muted/40 p-3`}
    >
      <div className="lg:grid lg:grid-cols-12 lg:gap-2 lg:items-center">
        {/* Method */}
        <div className="lg:col-span-5 mb-1 lg:mb-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground lg:hidden">
            {copy.methodCol}
          </p>
          <p className="font-mono text-[11px] text-foreground">
            <Ltr>{ex.method}</Ltr>
          </p>
        </div>
        {/* Description */}
        <div className="lg:col-span-4 mb-1 lg:mb-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground lg:hidden">
            {copy.descCol}
          </p>
          <p className="text-[11px] text-muted-foreground">{ex.desc}</p>
        </div>
        {/* full */}
        <div className="lg:col-span-1 mb-1 lg:mb-0 lg:text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground lg:hidden">
            {copy.fullCol}
          </p>
          {ex.full ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>
        {/* read_only */}
        <div className="lg:col-span-2 lg:text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground lg:hidden">
            {copy.readOnlyCol}
          </p>
          {ex.readOnly ? (
            <CheckCircle2 className="h-4 w-4 text-sky-400" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
