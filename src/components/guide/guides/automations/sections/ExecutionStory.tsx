"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { ExecutionStoryCopy } from "@/lib/guide/content/guides/automations-types";

/**
 * "What happens when this fires?" — execution story section.
 *
 * A vertical step-by-step timeline of the moment a contact verifies their
 * OTP. Each step shows a badge (01, 02, ...), a title, a body, and an
 * optional technical token (API endpoint, variable name, status code).
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — `useLocale` is only for the `dir` wrapper.
 *
 * Tokens (HTTP method names, endpoint paths, variable placeholders, status
 * strings) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */
export function ExecutionStory({
  copy,
}: {
  copy: ExecutionStoryCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  return (
    <article className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      <ol className="relative space-y-4 before:absolute before:bottom-2 before:top-2 before:w-px before:bg-gradient-to-b before:from-emerald-500/40 before:via-gray-700/60 before:to-transparent ltr:before:left-[7px] rtl:before:right-[7px]">
        {copy.steps.map((step, i) => (
          <motion.li
            key={i}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: dir === "rtl" ? -8 : 8 }}
            whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, delay: prefersReducedMotion ? 0 : i * 0.05 }}
            className="relative flex gap-3 ltr:pl-6 rtl:pr-6"
          >
            {/* Numbered badge */}
            <span className="absolute top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-500/40 bg-gray-950 text-[8px] font-bold text-emerald-300 ltr:left-0 rtl:right-0">
              <Ltr>{step.badge}</Ltr>
            </span>

            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-100">{step.title}</p>
                {step.token && (
                  <span className="inline-flex shrink-0 items-center rounded-md border border-gray-700/60 bg-gray-900/60 px-1.5 py-0.5 text-[9px] text-gray-300">
                    <Ltr className="font-mono">{step.token}</Ltr>
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">{step.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>

      <p className="mt-5 border-t border-gray-800/60 pt-3 text-xs text-gray-500">
        {copy.footnote}
      </p>
    </article>
  );
}
