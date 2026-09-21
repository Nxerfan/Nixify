"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Lock, CheckCircle2, RefreshCw,
  AlertTriangle, Info, Mail, Server, Inbox, AlertOctagon, Ban, HelpCircle,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  EmailLifecycleCopy,
  EmailDeliveryStatus,
  LifecycleTransitionCopy,
} from "@/lib/guide/content/guides/emails-types";

/**
 * Email lifecycle — the EmailDelivery state machine.
 *
 * Renders the 9 lifecycle states as a color-coded grid (matching the
 * conceptual dashboard's tone classes: queued=slate, provider_accepted=blue,
 * delivered=emerald, deferred=amber, bounced=complained/rejected/failed=rose,
 * unknown=purple), then renders the 9 transitions as a vertical timeline
 * with from → to badges.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper + arrow direction.
 *
 * Tokens (status codes like queued/provider_accepted/delivered/deferred/
 * bounced/complained/rejected/failed/unknown, lastProviderEventAt, etc.)
 * stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const STATE_TONE_CLASS: Record<EmailDeliveryStatus, string> = {
  queued: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  provider_accepted: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  delivered: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  deferred: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  bounced: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  complained: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  rejected: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  failed: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  unknown: "border-purple-500/40 bg-purple-500/10 text-purple-300",
};

const TRANSITION_TONE_CLASS: Record<LifecycleTransitionCopy["tone"], string> = {
  normal: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  recovery: "border-purple-500/40 bg-purple-500/10 text-purple-300",
};

/** A small per-state icon hint (purely decorative). */
function StateIcon({ code }: { code: EmailDeliveryStatus }): React.ReactElement {
  if (code === "queued") return <Mail className="h-3 w-3" />;
  if (code === "provider_accepted") return <Server className="h-3 w-3" />;
  if (code === "delivered") return <Inbox className="h-3 w-3" />;
  if (code === "deferred") return <RefreshCw className="h-3 w-3" />;
  if (code === "bounced") return <AlertOctagon className="h-3 w-3" />;
  if (code === "complained") return <Ban className="h-3 w-3" />;
  if (code === "rejected") return <AlertOctagon className="h-3 w-3" />;
  if (code === "failed") return <AlertOctagon className="h-3 w-3" />;
  return <HelpCircle className="h-3 w-3" />;
}

export function EmailLifecycle({
  copy,
}: {
  copy: EmailLifecycleCopy;
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
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">
          {copy.heading}
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-300">{copy.subheading}</p>
      </header>

      {/* States grid */}
      <div className="mb-6">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.statesTitle}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {copy.states.map((s, i) => (
            <motion.div
              key={s.code}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.03 }}
              className={`rounded-xl border p-3 ${STATE_TONE_CLASS[s.code]}`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <StateIcon code={s.code} />
                  {s.label}
                </span>
                <div className="flex items-center gap-1">
                  {s.canAdvance && !s.terminal && (
                    <span
                      title="non-terminal"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    </span>
                  )}
                  {s.terminal && s.canAdvance && (
                    /* unknown: terminal w.r.t. auto-retry but a later webhook
                     * can still advance it. */
                    <span
                      title="terminal but recovery-aware"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-purple-500/40 bg-purple-500/10 text-purple-300"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                    </span>
                  )}
                  {s.terminal && !s.canAdvance && (
                    <span
                      title="terminal (no further transitions)"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-gray-500/40 bg-gray-500/10 text-gray-300"
                    >
                      <Lock className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-300">{s.desc}</p>
              {s.sideEffect && (
                <p className="mt-1.5 rounded border border-white/5 bg-black/20 px-1.5 py-0.5 text-[10px] text-gray-300">
                  <span className="text-gray-600">side effect:</span>{" "}
                  {s.sideEffect}
                </p>
              )}
              <p className="mt-1 font-mono text-[10px] text-gray-400">
                <Ltr>{s.code}</Ltr>
              </p>
            </motion.div>
          ))}
        </div>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
            non-terminal (more transitions possible)
          </span>
          <span className="inline-flex items-center gap-1">
            <RefreshCw className="h-2.5 w-2.5 text-purple-400" />
            terminal w.r.t. auto-retry but recovery-aware (unknown)
          </span>
          <span className="inline-flex items-center gap-1">
            <Lock className="h-2.5 w-2.5 text-gray-300" />
            terminal (no further transitions)
          </span>
        </div>
      </div>

      {/* Transitions timeline */}
      <div>
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-400">
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
              <span
                className={`absolute -left-[1.4rem] top-1 flex h-3 w-3 items-center justify-center rounded-full border bg-gray-950 ${TRANSITION_TONE_CLASS[t.tone].split(" ").find((c) => c.startsWith("border-"))}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${TRANSITION_TONE_CLASS[t.tone].split(" ").find((c) => c.startsWith("bg-"))?.replace("/10", "/60")}`} />
              </span>
              <p className="text-xs font-semibold text-gray-200">{t.label}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className={`rounded border px-1.5 py-0.5 ${STATE_TONE_CLASS[t.from]}`}>
                  <Ltr>{t.from}</Ltr>
                </span>
                <Arrow className="h-3 w-3 text-gray-400" />
                <span className={`rounded border px-1.5 py-0.5 ${STATE_TONE_CLASS[t.to]}`}>
                  <Ltr>{t.to}</Ltr>
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-300">{t.desc}</p>
              <p className="mt-0.5 text-[10px] text-gray-400">
                <span className="text-gray-600">side effect:</span> {t.sideEffect}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>

      {/* Footnote */}
      <p className="mt-5 rounded-xl border border-gray-800/60 bg-gray-950/60 p-3 text-xs text-gray-300">
        {copy.footnote}
      </p>

      {/* SMTP-vs-webhook side note */}
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p className="text-xs text-gray-300">{copy.smtpNote}</p>
      </div>
    </article>
  );
}
