"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Webhook, Database, Clock, GitBranch, ShieldAlert, Archive, Info,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { DeliveryTimelineCopy, TimelineStepCopy } from "@/lib/guide/content/guides/emails-types";

/**
 * Delivery timeline — EmailDeliveryEvent history + never-regress rules.
 *
 * Renders the 6-step explanation of how webhook events are stored (immutable,
 * deduped, ordered by occurredAt). Then renders the 4 never-regress rules as
 * a scenario → outcome list. Then renders the side-by-side before/after
 * comparison table for event ordering. Footnote reinforces the audit-trail
 * invariant.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper.
 *
 * Tokens (providerEventId, occurredAt, (provider, providerEventId),
 * POST /api/.../events, suppressEmailInTx(...), @@unique([...]), store-all-events)
 * stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const STEP_TONE_CLASS: Record<TimelineStepCopy["tone"], string> = {
  ui: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  state: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  downstream: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

const STEP_TONE_DOT: Record<TimelineStepCopy["tone"], string> = {
  ui: "bg-sky-400",
  state: "bg-emerald-400",
  downstream: "bg-amber-400",
};

/** Tone → lucide icon mapping for the step rows. */
function StepIcon({ tone }: { tone: TimelineStepCopy["tone"] }): React.ReactElement {
  if (tone === "ui") return <Webhook className="h-3.5 w-3.5" />;
  if (tone === "state") return <Database className="h-3.5 w-3.5" />;
  return <ShieldAlert className="h-3.5 w-3.5" />;
}

export function DeliveryTimeline({
  copy,
}: {
  copy: DeliveryTimelineCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  return (
    <article
      className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7"
      dir={dir}
    >
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">
          {copy.heading}
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      {/* Steps */}
      <div className="mb-6">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {copy.stepsTitle}
        </p>
        <ol className="relative space-y-3 border-l border-gray-800/60 pl-4">
          {copy.steps.map((s, i) => (
            <motion.li
              key={s.badge}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: dir === "rtl" ? -4 : 4 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.05 }}
              className="relative"
            >
              {/* Node */}
              <span className={`absolute -left-[1.4rem] top-1 flex h-3 w-3 items-center justify-center rounded-full border ${STEP_TONE_CLASS[s.tone]}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${STEP_TONE_DOT[s.tone]}`} />
              </span>
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md border px-1 font-mono text-[10px] ${STEP_TONE_CLASS[s.tone]}`}>
                  <Ltr>{s.badge}</Ltr>
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-200">
                  <StepIcon tone={s.tone} />
                  {s.title}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">{s.body}</p>
              {s.token && (
                <p className="mt-0.5 font-mono text-[10px] text-gray-500">
                  <Ltr>{s.token}</Ltr>
                </p>
              )}
            </motion.li>
          ))}
        </ol>
      </div>

      {/* Never-regress rules */}
      <div className="mb-6">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {copy.regressTitle}
        </p>
        <p className="mb-3 text-xs text-gray-500">{copy.regressSubtitle}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {copy.regressRules.map((r, i) => (
            <motion.div
              key={i}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
              className="rounded-xl border border-gray-800/60 bg-gray-950/60 p-3"
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <GitBranch className="h-3 w-3 text-amber-400" />
                <p className="font-mono text-[11px] text-gray-300">
                  <Ltr>{r.scenario}</Ltr>
                </p>
              </div>
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[9px] font-medium uppercase tracking-wider text-gray-500">
                  →
                </span>
                <span className="font-mono text-[11px] text-emerald-300">
                  <Ltr>{r.outcome}</Ltr>
                </span>
              </div>
              <p className="text-[11px] text-gray-400">{r.rationale}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Comparison table */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {copy.comparisonTitle}
        </p>
        <div className="overflow-hidden rounded-xl border border-gray-800/60">
          <table className="w-full text-xs">
            <thead className="bg-gray-900/40">
              <tr className="border-b border-gray-800/60 text-left text-[10px] uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {"dimension"}
                  </span>
                </th>
                <th className="px-3 py-2 font-medium text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <Archive className="h-3 w-3" />
                    before
                  </span>
                </th>
                <th className="px-3 py-2 font-medium text-emerald-300">
                  <span className="inline-flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    at-or-after
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {copy.comparison.map((row, i) => (
                <motion.tr
                  key={i}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: dir === "rtl" ? 4 : -4 }}
                  whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, delay: prefersReducedMotion ? 0 : i * 0.04 }}
                  className="border-b border-gray-800/60 last:border-0"
                >
                  <td className="px-3 py-2 text-[11px] text-gray-300">
                    {row.dimension}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-400">
                    {row.beforeValue === "—" ? (
                      <span className="text-gray-700">—</span>
                    ) : (
                      <Ltr>{row.beforeValue}</Ltr>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-200">
                    {row.afterValue === "—" ? (
                      <span className="text-gray-700">—</span>
                    ) : (
                      <Ltr>{row.afterValue}</Ltr>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footnote */}
      <div className="flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p className="text-xs text-gray-300">{copy.footnote}</p>
      </div>
    </article>
  );
}
