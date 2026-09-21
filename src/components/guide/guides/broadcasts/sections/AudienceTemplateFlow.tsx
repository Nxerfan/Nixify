"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Users, FileText, ArrowRight, ArrowLeft } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { AudienceTemplateFlowCopy } from "@/lib/guide/content/guides/broadcasts-types";

/**
 * Audience + Template flow — creative section.
 *
 * Visualizes how the audience (who) and content (what) combine at launch
 * into a snapshot. Renders the 7-step flow as a vertical timeline, then
 * shows a side-by-side comparison of the audience card and the content
 * card. Footnote reinforces that consent is NOT snapshotted — it's
 * re-checked at send time.
 *
 * Tone color coding (legend header):
 *   ui          = a user action (sky)
 *   state       = a server-side state transition (emerald)
 *   downstream  = a downstream side effect (amber)
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read
 * locale directly — it renders the resolved copy. The `useLocale` call
 * is only for the `dir` wrapper + arrow direction.
 *
 * Tokens (audienceType = all_contacts | group, INSERT...SELECT,
 * {{contact.name}}, getMarketingEligibility(), POST /preview,
 * sent + skipped + failed = totalRecipients) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const TONE_DOT: Record<"ui" | "state" | "downstream", string> = {
  ui: "border-sky-500/40 bg-sky-500/20 text-sky-300",
  state: "border-emerald-500/40 bg-emerald-500/20 text-emerald-300",
  downstream: "border-amber-500/40 bg-amber-500/20 text-amber-300",
};

const TONE_BAR: Record<"ui" | "state" | "downstream", string> = {
  ui: "border-sky-500/30",
  state: "border-emerald-500/30",
  downstream: "border-amber-500/30",
};

export function AudienceTemplateFlow({
  copy,
}: {
  copy: AudienceTemplateFlowCopy;
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

      {/* Legend */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-gray-800/60 bg-gray-950/40 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.legendTitle}:
        </p>
        {copy.legendItems.map((li, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-[10px] text-gray-300"
          >
            <span
              className={`inline-block h-2 w-2 rounded-full border ${TONE_DOT[li.tone]}`}
            />
            {li.label}
          </span>
        ))}
      </div>

      {/* 7-step timeline */}
      <ol className="relative space-y-3 border-l border-gray-800/60 pl-4">
        {copy.steps.map((step, i) => (
          <motion.li
            key={i}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: isRTL ? -4 : 4 }}
            whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
            className="relative"
          >
            <span
              className={`absolute -left-[1.4rem] top-1 flex h-3 w-3 items-center justify-center rounded-full border ${TONE_DOT[step.tone]}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            </span>
            <div
              className={`rounded-xl border p-3 ${TONE_BAR[step.tone]} bg-gray-950/40`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 text-[10px] font-mono font-bold ${TONE_DOT[step.tone]}`}
                >
                  <Ltr>{step.badge}</Ltr>
                </span>
                <p className="text-sm font-semibold text-gray-100">{step.title}</p>
              </div>
              <p className="text-[11px] text-gray-300">{step.body}</p>
              {step.token && (
                <p className="mt-1 inline-flex items-center gap-1 rounded border border-gray-800/60 bg-gray-900/40 px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
                  <Ltr>{step.token}</Ltr>
                </p>
              )}
            </div>
          </motion.li>
        ))}
      </ol>

      {/* Two-card comparison */}
      <div className="mt-6 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr]">
        {/* Audience card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
          className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300">
              {copy.audienceCard.badge}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <p className="mb-2 text-sm font-semibold text-gray-100">
            {copy.audienceCard.title}
          </p>
          <p className="text-xs text-gray-300">{copy.audienceCard.body}</p>
          <ul className="mt-3 space-y-1">
            {copy.audienceCard.items.map((item, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1 rounded border border-gray-800/60 bg-gray-900/40 px-1.5 py-0.5 font-mono text-[10px] text-gray-300"
                style={{ marginRight: 4 }}
              >
                <Ltr>{item}</Ltr>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Arrow column */}
        <div className="flex items-center justify-center py-2">
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <motion.span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              animate={prefersReducedMotion ? {} : { x: isRTL ? [-3, 3, -3] : [3, -3, 3] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Arrow className="h-4 w-4" />
            </motion.span>
          </div>
        </div>

        {/* Content card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, delay: prefersReducedMotion ? 0 : 0.1 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              {copy.contentCard.badge}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <FileText className="h-4 w-4" />
            </span>
          </div>
          <p className="mb-2 text-sm font-semibold text-gray-100">
            {copy.contentCard.title}
          </p>
          <p className="text-xs text-gray-300">{copy.contentCard.body}</p>
          <ul className="mt-3 space-y-1">
            {copy.contentCard.items.map((item, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1 rounded border border-gray-800/60 bg-gray-900/40 px-1.5 py-0.5 font-mono text-[10px] text-gray-300"
                style={{ marginRight: 4 }}
              >
                <Ltr>{item}</Ltr>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Footnote */}
      <p className="mt-5 rounded-xl border border-gray-800/60 bg-gray-950/60 p-3 text-xs text-gray-300">
        {copy.footnote}
      </p>
    </article>
  );
}
