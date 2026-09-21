"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Ban, CheckCircle2, CircleSlash, Lock,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  BroadcastLifecycleCopy,
  BroadcastStatusTone,
} from "@/lib/guide/content/guides/broadcasts-types";

/**
 * Broadcast lifecycle — the status state machine.
 *
 * Renders the 9 lifecycle states as a color-coded grid (matching the real
 * page's STATUS_COLORS), then renders the 8 transitions as a vertical
 * timeline with from → to badges. Footnote reinforces the counts-derived
 * invariant: sent + skipped + failed = totalRecipients at terminal.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper + arrow direction.
 *
 * Tokens (status strings like draft/queued/sending, INSERT...SELECT,
 * provider_error, quota_error, BROADCAST_REVIEW_THRESHOLD = 1000) stay
 * LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const STATE_TONE_CLASS: Record<BroadcastStatusTone, string> = {
  draft: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  review_pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  queued: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  sending: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  paused_quota: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  cancelled: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  rejected: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  failed: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

export function BroadcastLifecycle({
  copy,
}: {
  copy: BroadcastLifecycleCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <article
      className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7"
      dir={dir}
    >
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      {/* States grid */}
      <div className="mb-6">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {copy.statesTitle}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {copy.states.map((s, i) => (
            <motion.div
              key={s.tone}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.03 }}
              className={`rounded-xl border p-3 ${STATE_TONE_CLASS[s.tone]}`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  {s.label}
                </span>
                <div className="flex items-center gap-1">
                  {s.cancellable && (
                    <span
                      title="cancellable"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-amber-500/40 bg-amber-500/10 text-amber-300"
                    >
                      <Ban className="h-2.5 w-2.5" />
                    </span>
                  )}
                  {s.terminal ? (
                    <span
                      title="terminal"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-gray-500/40 bg-gray-500/10 text-gray-300"
                    >
                      <Lock className="h-2.5 w-2.5" />
                    </span>
                  ) : (
                    <span
                      title="non-terminal"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-400">{s.desc}</p>
            </motion.div>
          ))}
        </div>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Ban className="h-2.5 w-2.5 text-amber-400" />
            cancellable
          </span>
          <span className="inline-flex items-center gap-1">
            <Lock className="h-2.5 w-2.5 text-gray-400" />
            terminal (no further transitions)
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
            non-terminal (more transitions possible)
          </span>
        </div>
      </div>

      {/* Transitions timeline */}
      <div>
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {copy.transitionsTitle}
        </p>
        <ol className="relative space-y-3 border-l border-gray-800/60 pl-4">
          {copy.transitions.map((t, i) => (
            <motion.li
              key={i}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: isRTL ? -4 : 4 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
              className="relative"
            >
              {/* Node */}
              <span className="absolute -left-[1.4rem] top-1 flex h-3 w-3 items-center justify-center rounded-full border border-emerald-500/40 bg-gray-950">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <p className="text-xs font-semibold text-gray-200">{t.label}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className={`rounded border px-1.5 py-0.5 ${STATE_TONE_CLASS[t.from]}`}>
                  <Ltr>{t.from}</Ltr>
                </span>
                <Arrow className="h-3 w-3 text-gray-500" />
                <span className={`rounded border px-1.5 py-0.5 ${STATE_TONE_CLASS[t.to]}`}>
                  <Ltr>{t.to}</Ltr>
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">{t.desc}</p>
              <p className="mt-0.5 text-[10px] text-gray-500">
                <span className="text-gray-600">side effect:</span> {t.sideEffect}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>

      {/* Footnote */}
      <p className="mt-5 rounded-xl border border-gray-800/60 bg-gray-950/60 p-3 text-xs text-gray-400">
        {copy.footnote}
      </p>
    </article>
  );
}
