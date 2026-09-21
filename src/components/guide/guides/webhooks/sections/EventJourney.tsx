"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  EventJourneyCopy,
  EventJourneyStepCopy,
} from "@/lib/guide/content/guides/webhooks-types";

/**
 * Event journey — the seven-stage event lifecycle creative section.
 *
 * Renders the seven stages as a vertical timeline with tone color coding
 * (ui = sky, state = emerald, downstream = amber). Each step has a
 * numeric badge + title + body + optional LTR token. A legend at the
 * top explains the color key. A footnote points to src/lib/dx/webhooks.ts.
 * An amber warning reinforces the durable-only-dispatch invariant.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read
 * locale directly — it renders the resolved copy. The `useLocale` call
 * is only for the `dir` wrapper + arrow direction.
 *
 * Tokens (event codes like otp.sent / nixify.webhook.test,
 * delivery IDs (UUIDs), function names like scheduleUserWebhookDeliveries
 * / signWebhook / claimPendingJobs / classifyFetchError /
 * scheduleReplayDelivery, file paths like src/lib/dx/webhooks.ts,
 * HTTP method names, fetch option strings) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const TONE_CLASS: Record<EventJourneyStepCopy["tone"], {
  border: string;
  bg: string;
  text: string;
  dot: string;
}> = {
  ui: {
    border: "border-sky-500/40",
    bg: "bg-sky-500/5",
    text: "text-sky-300",
    dot: "bg-sky-400",
  },
  state: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  downstream: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
};

const LEGEND_TONE: Record<EventJourneyStepCopy["tone"], string> = {
  ui: "bg-sky-400",
  state: "bg-emerald-400",
  downstream: "bg-amber-400",
};

export function EventJourney({
  copy,
}: {
  copy: EventJourneyCopy;
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
        <p className="mt-1 max-w-3xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      {/* Legend */}
      <div className="mb-5 rounded-xl border border-gray-800/60 bg-gray-950/60 p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {copy.legendTitle}
        </p>
        <div className="flex flex-wrap gap-3">
          {copy.legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${LEGEND_TONE[item.tone]}`} />
              <span className="text-[11px] text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Seven-stage vertical timeline */}
      <ol className="relative space-y-3 border-l border-gray-800/60 pl-4">
        {copy.steps.map((step, i) => {
          const tone = TONE_CLASS[step.tone];
          return (
            <motion.li
              key={i}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
              className="relative"
            >
              {/* Node marker */}
              <span className="absolute -left-[1.4rem] top-3 flex h-3 w-3 items-center justify-center rounded-full border border-gray-700 bg-gray-950">
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              </span>
              <div className={`rounded-xl border ${tone.border} ${tone.bg} p-3`}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-gray-500">
                    <Ltr>{step.badge}</Ltr>
                  </span>
                  <p className={`text-xs font-semibold ${tone.text}`}>{step.title}</p>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-300">{step.body}</p>
                {step.token && (
                  <p className="mt-2 rounded bg-gray-950/60 px-2 py-1 font-mono text-[10px] text-gray-300">
                    <Ltr>{step.token}</Ltr>
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>

      {/* Footnote */}
      <p className="mt-5 rounded-xl border border-gray-800/60 bg-gray-950/60 p-3 text-xs text-gray-400">
        {copy.footnote}
      </p>

      {/* Amber warning — durable-only dispatch */}
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-xs font-semibold text-amber-300">{copy.warningTitle}</p>
          <p className="mt-0.5 text-[11px] text-gray-300">{copy.warningBody}</p>
        </div>
      </div>
    </article>
  );
}
