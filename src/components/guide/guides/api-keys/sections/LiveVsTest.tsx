"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  FlaskConical, Rocket, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { LiveVsTestCopy } from "@/lib/guide/content/guides/api-keys-types";

/**
 * Live vs Test — the two key environments, side-by-side.
 *
 * Renders two state cards (test = amber, live = emerald) with a badge +
 * the prefix token + a body + bullets. Below is a comparison matrix with
 * one row per dimension (environment code, prefix, purpose, risk level,
 * storage shape, rotation cadence).
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper.
 *
 * Tokens (mg_test_, mg_live_, development, production, sha256:…) stay LTR
 * via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

export function LiveVsTest({
  copy,
}: {
  copy: LiveVsTestCopy;
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

      {/* Two state cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {/* Test card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
          className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-400" />
            <span className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-300">
              {copy.testCard.badge}
            </span>
            <span className="ml-auto font-mono text-[11px] text-amber-300">
              <Ltr>{copy.testCard.title}</Ltr>
            </span>
          </div>
          <p className="text-[12px] text-gray-300 leading-relaxed">{copy.testCard.body}</p>
          <ul className="mt-3 space-y-1">
            {copy.testCard.bullets.map((bullet, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-[11px] text-gray-400"
              >
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Live card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : 0.05 }}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-emerald-400" />
            <span className="inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-300">
              {copy.liveCard.badge}
            </span>
            <span className="ml-auto font-mono text-[11px] text-emerald-300">
              <Ltr>{copy.liveCard.title}</Ltr>
            </span>
          </div>
          <p className="text-[12px] text-gray-300 leading-relaxed">{copy.liveCard.body}</p>
          <ul className="mt-3 space-y-1">
            {copy.liveCard.bullets.map((bullet, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-[11px] text-gray-400"
              >
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Comparison matrix */}
      <div className="mb-5">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {copy.matrixTitle}
        </p>
        <p className="mb-3 text-xs text-gray-400">{copy.matrixSubtitle}</p>

        {/* Header row — hidden on mobile (cards stack) */}
        <div className="hidden lg:grid grid-cols-12 gap-2 px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
          <div className="col-span-4">{copy.dimensionCol}</div>
          <div className="col-span-4">{copy.testCol}</div>
          <div className="col-span-4">{copy.liveCol}</div>
        </div>

        <div className="space-y-1">
          {copy.rows.map((row, i) => (
            <motion.div
              key={row.key}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, delay: prefersReducedMotion ? 0 : i * 0.04 }}
              className="rounded-xl border border-gray-800/60 bg-gray-950/40 p-3"
            >
              <div className="lg:grid lg:grid-cols-12 lg:gap-2">
                {/* Dimension */}
                <div className="lg:col-span-4 mb-1 lg:mb-0">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 lg:hidden">
                    {copy.dimensionCol}
                  </p>
                  <p className="text-[11px] text-gray-300">{row.dimension}</p>
                </div>
                {/* Test value */}
                <div className="lg:col-span-4 mb-1 lg:mb-0">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 lg:hidden">
                    {copy.testCol}
                  </p>
                  <p className="font-mono text-[11px] text-amber-300">
                    <Ltr>{row.testValue}</Ltr>
                  </p>
                </div>
                {/* Live value */}
                <div className="lg:col-span-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 lg:hidden">
                    {copy.liveCol}
                  </p>
                  <p className="font-mono text-[11px] text-emerald-300">
                    <Ltr>{row.liveValue}</Ltr>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Amber warning — never commit a live key */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-xs font-semibold text-amber-200">{copy.warningTitle}</p>
          <p className="mt-0.5 text-[11px] text-gray-300">{copy.warningBody}</p>
        </div>
      </div>

      {/* Legend (decorative — reinforces ✓ test = low risk, ✗ live = high risk) */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-amber-400" />
          <Ltr>mg_test_</Ltr>
          <span>= low risk if leaked</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <XCircle className="h-3 w-3 text-rose-400" />
          <Ltr>mg_live_</Ltr>
          <span>= high risk if leaked</span>
        </span>
      </div>
    </article>
  );
}
