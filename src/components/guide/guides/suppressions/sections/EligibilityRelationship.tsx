"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  EligibilityRelationshipCopy,
} from "@/lib/guide/content/guides/suppressions-types";

/**
 * Eligibility relationship — how suppression + marketing_status combine.
 *
 * Renders three concept cards (marketing_status, suppressed, eligible),
 * then a 6-row eligibility matrix enumerating every (marketing_status,
 * suppressed) → eligible combination. Below the matrix is the two-gate
 * rule callout and the non-liftable note for hard_bounce/complaint.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read
 * locale directly — it renders the resolved copy. The `useLocale` call
 * is only for the `dir` wrapper.
 *
 * Tokens (marketing_status values like subscribed/unsubscribed/unknown,
 * suppressed true/false, eligible true/false, NON_LIFTABLE_BY_RESUBSCRIBE)
 * stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

export function EligibilityRelationship({
  copy,
}: {
  copy: EligibilityRelationshipCopy;
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

      {/* Concept cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {copy.conceptCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.05 }}
            className="rounded-xl border border-border bg-card/60 p-3"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{card.label}</p>
            <p className="mt-1 font-mono text-[11px] text-emerald-300">
              <Ltr>{card.value}</Ltr>
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">{card.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Matrix */}
      <div className="mb-5">
        <p className="mb-1 text-sm font-semibold text-foreground">{copy.matrixTitle}</p>
        <p className="mb-3 text-[11px] text-muted-foreground">{copy.matrixSubtitle}</p>
        <div className="overflow-hidden rounded-xl border border-border">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-px bg-border/60 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <div className="col-span-5 bg-card/60 px-3 py-2">{copy.marketingCol}</div>
            <div className="col-span-4 bg-card/60 px-3 py-2">{copy.suppressedCol}</div>
            <div className="col-span-3 bg-card/60 px-3 py-2 text-right">{copy.eligibleCol}</div>
          </div>
          {/* Rows */}
          <div className="divide-y divide-gray-800/60">
            {copy.matrix.map((row, i) => {
              const isYes = row.eligible;
              return (
                <motion.div
                  key={i}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
                  whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, delay: prefersReducedMotion ? 0 : i * 0.04 }}
                  className={`grid grid-cols-12 gap-2 px-3 py-2 text-[11px] ${
                    isYes ? "bg-emerald-500/5" : "bg-muted/40"
                  }`}
                >
                  <div className="col-span-5 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                        row.marketingStatus === "subscribed"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : row.marketingStatus === "unsubscribed"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                            : "border-slate-500/40 bg-slate-500/10 text-slate-300"
                      }`}
                    >
                      <Ltr>{row.marketingStatus}</Ltr>
                    </span>
                  </div>
                  <div className="col-span-4 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                        row.suppressed
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      <Ltr>{row.suppressed ? "suppressed: true" : "suppressed: false"}</Ltr>
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-1.5">
                    {isYes ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        {copy.eligibleYes}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-300 font-medium">
                        <XCircle className="h-3 w-3" />
                        {copy.eligibleNo}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-gate rule */}
      <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
        <p className="text-sm font-semibold text-emerald-300">{copy.ruleTitle}</p>
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{copy.ruleBody}</p>
      </div>

      {/* Non-liftable note */}
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3">
        <div className="mb-1 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <p className="text-sm font-semibold text-rose-300">
            <Ltr>NON_LIFTABLE_BY_RESUBSCRIBE</Ltr>
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{copy.nonLiftableNote}</p>
      </div>
    </article>
  );
}
