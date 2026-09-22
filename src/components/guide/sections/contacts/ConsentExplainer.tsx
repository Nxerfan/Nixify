"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BellRing, BellOff, ShieldAlert, ShieldOff, Check, X, HelpCircle,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { ConsentExplainerCopy } from "@/lib/guide/content/types";

/**
 * Marketing / Consent Status Explainer.
 *
 * Uses the ACTUAL current consent model from src/lib/consent/service.ts and
 * src/app/dashboard/contacts/[id]/page.tsx:
 *
 *   marketing_status   ∈ { unknown, subscribed, unsubscribed }
 *   suppressed         ∈ { true, false }   (separate from marketing_status)
 *   eligible           = (marketing_status === "subscribed") AND !suppressed
 *
 * Manual operations on the contact detail page:
 *   Subscribe            → POST /api/dashboard/contacts/:id/subscribe
 *                          Sets marketing_status = subscribed AND lifts any
 *                          active manual/unsubscribe suppression.
 *   Unsubscribe          → POST /api/dashboard/contacts/:id/unsubscribe
 *                          Sets marketing_status = unsubscribed AND creates
 *                          an active suppression entry.
 *   Manually Suppress    → POST /api/dashboard/suppressions
 *                          body: { email, reason: "manual" }
 *                          Does NOT unsubscribe the contact. Only creates a
 *                          suppression entry. marketing_status is unchanged.
 *   Lift Suppression      → POST /api/dashboard/suppressions/:suppressionId
 *                          Deactivates the suppression entry only. Does NOT
 *                          subscribe the contact.
 *
 * Provider-driven suppressions (hard_bounce, complaint) are
 * NON_LIFTABLE_BY_RESUBSCRIBE — an ordinary Subscribe will NOT lift them.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call here is
 * only for the `dir` wrapper.
 *
 * The interactive matrix below shows each (marketing_status, suppressed)
 * combination and the resulting `eligible` flag — including the valid
 * subscribed + suppressed=true combination that Manually Suppress can
 * produce (eligible = false because suppression blocks marketing).
 */

const ICONS = {
  subscribe: BellRing,
  unsubscribe: BellOff,
  suppress: ShieldAlert,
  lift: ShieldOff,
} as const;

type IconKey = keyof typeof ICONS;

const MATRIX: { status: string; suppressed: boolean; eligible: boolean }[] = [
  { status: "subscribed", suppressed: false, eligible: true },
  { status: "subscribed", suppressed: true, eligible: false },
  { status: "unsubscribed", suppressed: false, eligible: false },
  { status: "unsubscribed", suppressed: true, eligible: false },
  { status: "unknown", suppressed: false, eligible: false },
  { status: "unknown", suppressed: true, eligible: false },
];

export function ConsentExplainer({ copy }: { copy: ConsentExplainerCopy }): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  return (
    <article className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-foreground sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{copy.subheading}</p>
      </header>

      {/* Three concept cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {copy.conceptCards.map((col, i) => (
          <motion.div
            key={i}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, delay: prefersReducedMotion ? 0 : i * 0.05 }}
            className="rounded-xl border border-border bg-muted/40 p-4"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300">
              <Ltr>{col.label}</Ltr>
            </p>
            <p className="mt-1 text-xs font-medium text-foreground">
              <Ltr>{col.value}</Ltr>
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">{col.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Combination matrix */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-muted/40 px-4 py-2">
          <p className="text-xs font-semibold text-foreground">{copy.matrixTitle}</p>
          <p className="text-[10px] text-muted-foreground/70">{copy.matrixSubtitle}</p>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">{copy.marketingCol}</th>
              <th className="px-3 py-2 font-medium">{copy.suppressedCol}</th>
              <th className="px-3 py-2 font-medium text-right">{copy.eligibleCol}</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 text-foreground">
                  <Ltr>{row.status}</Ltr>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  <Ltr>{String(row.suppressed)}</Ltr>
                </td>
                <td className="px-3 py-2 text-right">
                  {row.eligible ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      <Check className="h-3 w-3" />
                      {copy.eligibleYes}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                      <X className="h-3 w-3" />
                      {copy.eligibleNo}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Explicit actions */}
      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">{copy.actionsTitle}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {copy.actions.map((action, i) => {
            const Icon = ICONS[action.icon as IconKey];
            const toneCls =
              action.icon === "subscribe"
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                : action.icon === "lift"
                  ? "border-sky-500/20 bg-sky-500/5 text-sky-300"
                  : "border-rose-500/20 bg-rose-500/5 text-rose-300";
            return (
              <motion.div
                key={i}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, delay: prefersReducedMotion ? 0 : i * 0.04 }}
                className={`rounded-xl border ${toneCls} p-3`}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <p className="text-xs font-semibold text-foreground">
                    <Ltr>{action.label}</Ltr>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
                <p className="mt-1 text-[10px] text-muted-foreground/70">{action.also}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Import note */}
      <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-200/80">{copy.importNote}</p>
      </div>

      {/* Non-liftable provider suppression note */}
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
        <p className="text-xs text-rose-200/80">{copy.nonLiftableNote}</p>
      </div>
    </article>
  );
}
