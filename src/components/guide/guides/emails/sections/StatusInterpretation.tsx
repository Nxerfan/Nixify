"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Mail, Server, Inbox, RefreshCw, AlertOctagon, Ban, Info, AlertTriangle,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  StatusInterpretationCopy,
  StatusInterpretationRowCopy,
} from "@/lib/guide/content/guides/emails-types";

/**
 * Status interpretation — per-status meaning matrix.
 *
 * Renders the 9 status codes as a 4-column matrix: status code (LTR) +
 * human label / what triggers it / side effect / what you can do. Each
 * row carries a tone accent (matching the conceptual dashboard's tone
 * palette).
 *
 * Three side notes follow the matrix:
 *   - SMTP-delivered note: SMTP can't reach the delivered state (no webhooks).
 *   - Unknown recovery note: unknown is recovery-aware (a later webhook can
 *     still advance it).
 *   - Never-regress note: the 4 never-regress rules.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper.
 *
 * Tokens (status codes, lastErrorCode strings like smtp_5xx_permanent /
 * provider_connection_timeout, occurredAt) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const TONE_CLASS: Record<StatusInterpretationRowCopy["tone"], string> = {
  neutral: "border-slate-500/30 bg-slate-500/5 text-slate-300",
  good: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  warn: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  bad: "border-rose-500/30 bg-rose-500/5 text-rose-300",
  recovery: "border-purple-500/30 bg-purple-500/5 text-purple-300",
};

const TONE_BADGE_CLASS: Record<StatusInterpretationRowCopy["tone"], string> = {
  neutral: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  recovery: "border-purple-500/40 bg-purple-500/10 text-purple-300",
};

/** Decorative icon per status code. */
function RowIcon({ code }: { code: StatusInterpretationRowCopy["code"] }): React.ReactElement {
  if (code === "queued") return <Mail className="h-3.5 w-3.5" />;
  if (code === "provider_accepted") return <Server className="h-3.5 w-3.5" />;
  if (code === "delivered") return <Inbox className="h-3.5 w-3.5" />;
  if (code === "deferred") return <RefreshCw className="h-3.5 w-3.5" />;
  if (code === "bounced") return <AlertOctagon className="h-3.5 w-3.5" />;
  if (code === "complained") return <Ban className="h-3.5 w-3.5" />;
  if (code === "rejected") return <AlertOctagon className="h-3.5 w-3.5" />;
  if (code === "failed") return <AlertOctagon className="h-3.5 w-3.5" />;
  return <Info className="h-3.5 w-3.5" />;
}

export function StatusInterpretation({
  copy,
}: {
  copy: StatusInterpretationCopy;
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
        <p className="mt-1 max-w-3xl text-sm text-gray-300">{copy.subheading}</p>
      </header>

      {/* Matrix title */}
      <div className="mb-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.matrixTitle}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">{copy.matrixSubtitle}</p>
      </div>

      {/* Per-row cards (mobile + tablet + desktop) */}
      <div className="space-y-2">
        {copy.rows.map((r, i) => (
          <motion.div
            key={r.code}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.03 }}
            className={`rounded-xl border p-3 ${TONE_CLASS[r.tone]}`}
          >
            {/* Row header: status code + label + icon */}
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/5 bg-black/20">
                <RowIcon code={r.code} />
              </span>
              <span className="text-sm font-semibold">{r.label}</span>
              <span className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[10px] ${TONE_BADGE_CLASS[r.tone]}`}>
                <Ltr>{r.code}</Ltr>
              </span>
            </div>
            {/* 3-column grid: trigger / side effect / action */}
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400">
                  {copy.colTrigger}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-300">{r.trigger}</p>
              </div>
              <div>
                <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400">
                  {copy.colSideEffect}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-300">{r.sideEffect}</p>
              </div>
              <div>
                <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400">
                  {copy.colAction}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-300">{r.action}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* SMTP-delivered note */}
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p className="text-xs text-gray-300">{copy.smtpDeliveredNote}</p>
      </div>

      {/* Unknown recovery note */}
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-purple-500/30 bg-purple-500/5 p-3">
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
        <p className="text-xs text-gray-300">{copy.unknownRecoveryNote}</p>
      </div>

      {/* Never-regress note */}
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs text-gray-300">{copy.neverRegressNote}</p>
      </div>
    </article>
  );
}
