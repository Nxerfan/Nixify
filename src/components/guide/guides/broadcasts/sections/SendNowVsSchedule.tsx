"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Send, Clock, AlertTriangle, Info } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { SendNowVsScheduleCopy } from "@/lib/guide/content/guides/broadcasts-types";

/**
 * Send now vs Schedule — creative section.
 *
 * Side-by-side comparison of the two launch modes:
 *   - Send now     → scheduledAt: null  →  worker claims immediately
 *   - Schedule      → scheduledAt: ISO   →  worker dispatch gated
 *
 * Both enter queued status; both snapshot the audience at the launch click
 * (NOT at the scheduled time — the snapshot does not refresh). The
 * dashboard UI does NOT yet expose a date picker — the schedule path is
 * API-only. Pass scheduledAt in the API request body to schedule.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read
 * locale directly — it renders the resolved copy. The `useLocale` call
 * is only for the `dir` wrapper.
 *
 * Tokens (scheduledAt: null, scheduledAt: 2026-09-22T09:00:00Z,
 * idempotency_conflict, 409, BROADCAST_EMAILS) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */
export function SendNowVsSchedule({
  copy,
}: {
  copy: SendNowVsScheduleCopy;
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

      {/* Two cards side by side */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {/* Send now card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              {copy.sendNowCard.badge}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <Send className="h-4 w-4" />
            </span>
          </div>
          <p className="mb-1 font-mono text-xs text-emerald-200">
            <Ltr>{copy.sendNowCard.title}</Ltr>
          </p>
          <p className="text-xs text-gray-400">{copy.sendNowCard.body}</p>
        </motion.div>

        {/* Schedule card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, delay: prefersReducedMotion ? 0 : 0.1 }}
          className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              {copy.scheduleCard.badge}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <p className="mb-1 font-mono text-xs text-amber-200">
            <Ltr>{copy.scheduleCard.title}</Ltr>
          </p>
          <p className="text-xs text-gray-400">{copy.scheduleCard.body}</p>
        </motion.div>
      </div>

      {/* Comparison table */}
      <div className="mb-5 overflow-hidden rounded-xl border border-gray-800/60">
        <table className="w-full text-xs">
          <thead className="bg-gray-900/40">
            <tr className="border-b border-gray-800/60 text-left text-[10px] uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2 font-medium">{""}</th>
              <th className="px-3 py-2 font-medium text-emerald-300">
                <span className="inline-flex items-center gap-1">
                  <Send className="h-3 w-3" />
                  {copy.sendNowCard.badge}
                </span>
              </th>
              <th className="px-3 py-2 font-medium text-amber-300">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {copy.scheduleCard.badge}
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
                <td className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500">
                  {row.dimension}
                </td>
                <td className="px-3 py-2 text-[11px] text-gray-300">
                  <Ltr>{row.sendNowValue}</Ltr>
                </td>
                <td className="px-3 py-2 text-[11px] text-gray-200">
                  <Ltr>{row.scheduleValue}</Ltr>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* UI-exposed note */}
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p className="text-xs text-gray-300">{copy.uiExposedNote}</p>
      </div>

      {/* Warning footer */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="mb-1.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <p className="text-sm font-semibold text-amber-200">
            {copy.warningTitle}
          </p>
        </div>
        <p className="text-xs text-gray-400">{copy.warningBody}</p>
      </div>
    </article>
  );
}
