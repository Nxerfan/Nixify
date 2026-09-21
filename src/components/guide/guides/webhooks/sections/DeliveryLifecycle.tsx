"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Clock, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, RotateCw, Ban,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  DeliveryLifecycleCopy,
  DeliveryStateCopy,
  DeliveryTransitionCopy,
} from "@/lib/guide/content/guides/webhooks-types";

/**
 * Delivery lifecycle — the five-state machine that drives every webhook
 * delivery.
 *
 * Renders:
 *   1. A 5-card state grid (pending / processing / delivered / failed /
 *      recovered) with tone color coding + per-state icon.
 *   2. An 8-transition vertical timeline showing every from→to arrow
 *      with the trigger + token, tone-coded by transition type
 *      (claim / success / failure / recover / exhaust).
 *   3. Two explainer cards: exponential backoff + stale-lock recovery.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read
 * locale directly — it renders the resolved copy. The `useLocale` call
 * is only for the `dir` wrapper + arrow direction.
 *
 * Tokens (status codes like pending / processing / delivered / failed,
 * error class codes like network_error / timeout / http_4xx / http_5xx /
 * ssrf_blocked / endpoint_missing / configuration_error /
 * max_attempts_exceeded, function names like processWebhookQueue /
 * claimPendingJobs / recoverStaleLocks / classifyFetchError,
 * backoff expressions like 10s → 30s → 90s, SQL fragments like
 * updateMany WHERE status='pending' AND nextRetryAt <= NOW(),
 * file paths like src/lib/dx/webhooks.ts) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const STATE_TONE_CLASS: Record<DeliveryStateCopy["tone"], {
  border: string;
  bg: string;
  text: string;
  dot: string;
}> = {
  pending: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
  active: {
    border: "border-sky-500/40",
    bg: "bg-sky-500/5",
    text: "text-sky-300",
    dot: "bg-sky-400",
  },
  good: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  bad: {
    border: "border-rose-500/40",
    bg: "bg-rose-500/5",
    text: "text-rose-300",
    dot: "bg-rose-400",
  },
  warn: {
    border: "border-slate-500/40",
    bg: "bg-slate-500/5",
    text: "text-slate-300",
    dot: "bg-slate-400",
  },
};

const TRANSITION_TONE_CLASS: Record<DeliveryTransitionCopy["tone"], string> = {
  claim: "border-sky-500/40 bg-sky-500/5 text-sky-300",
  success: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
  failure: "border-amber-500/40 bg-amber-500/5 text-amber-300",
  recover: "border-amber-500/40 bg-amber-500/5 text-amber-300",
  exhaust: "border-rose-500/40 bg-rose-500/5 text-rose-300",
};

/** Decorative per-state icon. */
function StateIcon({ tone }: { tone: DeliveryStateCopy["tone"] }): React.ReactElement {
  if (tone === "pending") return <Clock className="h-3.5 w-3.5" />;
  if (tone === "active") return <Loader2 className="h-3.5 w-3.5" />;
  if (tone === "good") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (tone === "bad") return <XCircle className="h-3.5 w-3.5" />;
  return <AlertTriangle className="h-3.5 w-3.5" />;
}

export function DeliveryLifecycle({
  copy,
}: {
  copy: DeliveryLifecycleCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const Arrow = isRTL ? ArrowRight : ArrowRight; // → reads naturally in both dirs

  return (
    <article
      className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7"
      dir={dir}
    >
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-300">{copy.subheading}</p>
      </header>

      {/* State grid */}
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.statesTitle}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {copy.states.map((state, i) => {
            const tone = STATE_TONE_CLASS[state.tone];
            return (
              <motion.div
                key={state.key}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
                className={`rounded-xl border p-3 ${tone.border} ${tone.bg}`}
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <StateIcon tone={state.tone} />
                  <span className={`text-xs font-semibold ${tone.text}`}>{state.label}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-300">{state.desc}</p>
                <p className="mt-2 font-mono text-[10px] text-gray-300">
                  <Ltr>{`status: ${state.key}`}</Ltr>
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Transitions timeline */}
      <div className="mb-6">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.transitionsTitle}
        </p>
        <ol className="relative space-y-3 border-l border-gray-800/60 pl-4">
          {copy.transitions.map((t, i) => {
            const tone = TRANSITION_TONE_CLASS[t.tone];
            return (
              <motion.li
                key={i}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
                whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.03 }}
                className="relative"
              >
                <span className="absolute -left-[1.4rem] top-3 flex h-3 w-3 items-center justify-center rounded-full border border-gray-700 bg-gray-950">
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.split(" ").find((c) => c.startsWith("text-"))?.replace("text-", "bg-")}`} />
                </span>
                <div className={`rounded-xl border p-3 ${tone}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] ${tone}`}>
                      <Ltr>{t.from}</Ltr>
                    </span>
                    <Arrow className="h-3 w-3 shrink-0 text-gray-400" />
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] ${tone}`}>
                      <Ltr>{t.to}</Ltr>
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300">{t.trigger}</p>
                  {t.token && (
                    <p className="mt-1.5 rounded bg-gray-950/60 px-2 py-1 font-mono text-[10px] text-gray-300">
                      <Ltr>{t.token}</Ltr>
                    </p>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>

      {/* Two explainer cards: backoff + stale-lock */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
          className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3"
        >
          <div className="mb-1 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-semibold text-amber-300">{copy.retryTitle}</p>
          </div>
          <p className="text-[11px] leading-relaxed text-gray-300">{copy.retryBody}</p>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : 0.08 }}
          className="rounded-xl border border-slate-500/40 bg-slate-500/5 p-3"
        >
          <div className="mb-1 flex items-center gap-2">
            <Ban className="h-4 w-4 text-slate-400" />
            <p className="text-xs font-semibold text-slate-300">{copy.staleLockTitle}</p>
          </div>
          <p className="text-[11px] leading-relaxed text-gray-300">{copy.staleLockBody}</p>
        </motion.div>
      </div>

      {/* Footnote */}
      <p className="rounded-xl border border-gray-800/60 bg-gray-950/60 p-3 text-xs text-gray-300">
        {copy.footnote}
      </p>

      {/* Amber warning — replay creates a NEW delivery */}
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
        <RotateCw className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-xs font-semibold text-amber-300">{copy.warningTitle}</p>
          <p className="mt-0.5 text-[11px] text-gray-300">{copy.warningBody}</p>
        </div>
      </div>
    </article>
  );
}
