"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Monitor, RefreshCw, Send, Mail, MailCheck } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { EventJourneyCopy } from "@/lib/guide/content/guides/automations-types";

/**
 * Example automation event journey — creative section.
 *
 * A horizontal/vertical journey visualization following one real welcome-
 * email event from contact submit to delivered inbox. Each step is
 * annotated with the system that owns it (UI step / state transition /
 * downstream effect) and an optional token (API method, status code,
 * variable name).
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — `useLocale` is only for the `dir` wrapper.
 *
 * Tokens stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const TONE_CLS: Record<"ui" | "state" | "downstream", { dot: string; ring: string; icon: typeof Monitor }> = {
  ui: { dot: "bg-sky-500/20 border-sky-500/40 text-sky-300", ring: "border-sky-500/20 bg-sky-500/5", icon: Monitor },
  state: { dot: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300", ring: "border-emerald-500/20 bg-emerald-500/5", icon: RefreshCw },
  downstream: { dot: "bg-amber-500/20 border-amber-500/40 text-amber-300", ring: "border-amber-500/20 bg-amber-500/5", icon: Send },
};

const LEGEND_DOT_CLS: Record<"ui" | "state" | "downstream", string> = {
  ui: "bg-sky-500/30",
  state: "bg-emerald-500/30",
  downstream: "bg-amber-500/30",
};

export function EventJourney({
  copy,
}: {
  copy: EventJourneyCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  return (
    <article className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      {/* Legend */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-gray-800/60 bg-gray-950/60 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {copy.legendTitle}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {copy.legendItems.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${LEGEND_DOT_CLS[item.tone]}`} />
              <span className="text-[11px] text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Journey steps */}
      <ol className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {copy.steps.map((step, i) => {
          const tone = TONE_CLS[step.tone];
          const Icon = tone.icon;
          const isLast = i === copy.steps.length - 1;
          return (
            <motion.li
              key={i}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, delay: prefersReducedMotion ? 0 : i * 0.05 }}
              className={`relative rounded-xl border ${tone.ring} p-3 ${isLast ? "sm:col-span-2 lg:col-span-1" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${tone.dot}`}>
                  <Icon className="h-3 w-3" />
                </span>
                <span className="inline-flex items-center rounded border border-gray-700/60 bg-gray-900/60 px-1.5 py-0.5 text-[9px] text-gray-300">
                  <Ltr>{step.badge}</Ltr>
                </span>
              </div>
              <p className="mb-1 text-sm font-semibold text-gray-100">{step.title}</p>
              <p className="mb-2 text-xs text-gray-400">{step.body}</p>
              {step.token && (
                <p className="inline-flex items-center gap-1.5 text-[10px] text-gray-300">
                  {step.tone === "downstream" ? <Mail className="h-3 w-3" /> : step.tone === "state" ? <RefreshCw className="h-3 w-3" /> : <MailCheck className="h-3 w-3" />}
                  <Ltr className="font-mono">{step.token}</Ltr>
                </p>
              )}
            </motion.li>
          );
        })}
      </ol>
    </article>
  );
}
