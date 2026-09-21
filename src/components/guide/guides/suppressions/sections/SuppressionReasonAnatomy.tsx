"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2, Ban, User, Link2, Server, AlertOctagon,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  SuppressionReasonAnatomyCopy,
  ReasonAnatomyRowCopy,
} from "@/lib/guide/content/guides/suppressions-types";

/**
 * Suppression reason anatomy — the four reason codes decoded.
 *
 * Renders the four suppression reasons (manual, unsubscribe, hard_bounce,
 * complaint) as a table-style grid: each row shows the reason code (LTR
 * token), the badge label, what triggers it, who writes it, and whether
 * it is liftable by an ordinary resubscribe. The two non-liftable rows
 * (hard_bounce, complaint) are visually distinct — they map to the
 * NON_LIFTABLE_BY_RESUBSCRIBE set in src/lib/consent/service.ts.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper + arrow direction.
 *
 * Tokens (reason codes like manual/unsubscribe/hard_bounce/complaint,
 * NON_LIFTABLE_BY_RESUBSCRIBE, file path src/lib/consent/service.ts,
 * ResubscribeBlockedError, POST /api/dashboard/suppressions) stay LTR via
 * <Ltr>.
 *
 * NO real API calls — purely visual.
 */

/** Icon for "who writes this reason". */
function WrittenByIcon({
  row,
}: {
  row: ReasonAnatomyRowCopy;
}): React.ReactElement {
  if (row.reason === "manual") return <User className="h-3 w-3" />;
  if (row.reason === "unsubscribe") return <Link2 className="h-3 w-3" />;
  if (row.reason === "hard_bounce" || row.reason === "complaint") {
    return <Server className="h-3 w-3" />;
  }
  return <AlertOctagon className="h-3 w-3" />;
}

export function SuppressionReasonAnatomy({
  copy,
}: {
  copy: SuppressionReasonAnatomyCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  return (
    <article
      className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7"
      dir={dir}
    >
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-300">{copy.subheading}</p>
      </header>

      {/* Reason reference "table" */}
      <div className="mb-6">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.tableTitle}
        </p>

        {/* Header row — hidden on mobile (cards stack) */}
        <div className="hidden lg:grid grid-cols-12 gap-2 px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          <div className="col-span-2">{copy.columns.reason}</div>
          <div className="col-span-2">{copy.columns.label}</div>
          <div className="col-span-3">{copy.columns.trigger}</div>
          <div className="col-span-2">{copy.columns.writtenBy}</div>
          <div className="col-span-3 text-right">{copy.columns.liftable}</div>
        </div>

        <div className="space-y-2">
          {copy.rows.map((row, i) => {
            const isLiftable = row.liftableByResubscribe;
            return (
              <motion.div
                key={row.reason}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.05 }}
                className={`rounded-xl border p-3 ${
                  isLiftable
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-rose-500/40 bg-rose-500/5"
                }`}
              >
                <div className="lg:grid lg:grid-cols-12 lg:gap-2">
                  {/* Reason code */}
                  <div className="lg:col-span-2 mb-1 lg:mb-0">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 lg:hidden">
                      {copy.columns.reason}
                    </p>
                    <span className="font-mono text-xs text-gray-200">
                      <Ltr>{row.reason}</Ltr>
                    </span>
                  </div>
                  {/* Badge label */}
                  <div className="lg:col-span-2 mb-1 lg:mb-0">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 lg:hidden">
                      {copy.columns.label}
                    </p>
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] ${
                        isLiftable
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                      }`}
                    >
                      {row.label}
                    </span>
                  </div>
                  {/* Trigger */}
                  <div className="lg:col-span-3 mb-1 lg:mb-0">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 lg:hidden">
                      {copy.columns.trigger}
                    </p>
                    <p className="text-[11px] text-gray-300 leading-relaxed">{row.trigger}</p>
                  </div>
                  {/* Written by */}
                  <div className="lg:col-span-2 mb-1 lg:mb-0">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 lg:hidden">
                      {copy.columns.writtenBy}
                    </p>
                    <p className="text-[11px] text-gray-300 inline-flex items-center gap-1">
                      <WrittenByIcon row={row} />
                      {row.writtenBy}
                    </p>
                  </div>
                  {/* Liftable */}
                  <div className="lg:col-span-3 lg:text-right">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 lg:hidden">
                      {copy.columns.liftable}
                    </p>
                    {isLiftable ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        {copy.legendLiftable}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-300">
                        <Ban className="h-3 w-3" />
                        <Ltr>NON_LIFTABLE_BY_RESUBSCRIBE</Ltr>
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.legendTitle}
        </p>
        <div className="flex flex-wrap gap-3 text-[11px] text-gray-300">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            {copy.legendLiftable}
          </span>
          <span className="inline-flex items-center gap-1">
            <Ban className="h-3 w-3 text-rose-400" />
            {copy.legendNonLiftable}
          </span>
        </div>
      </div>

      {/* Footnote */}
      <p className="rounded-xl border border-gray-800/60 bg-gray-950/60 p-3 text-xs text-gray-300">
        {copy.footnote}
      </p>
    </article>
  );
}
