"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldOff, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { ActiveVsLiftedCopy } from "@/lib/guide/content/guides/suppressions-types";

/**
 * Active vs Lifted — the two suppression states, side-by-side.
 *
 * Renders two state cards (active = rose, lifted = slate), each with a
 * badge, a state title showing the underlying record shape
 * (e.g. "active: true"), a body sentence, and a bullet list of effects.
 * Below is a comparison table across both states with one row per
 * dimension (eligible, state badge, row action, audit history,
 * re-suppression path, subscribe call behavior).
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper.
 *
 * Tokens (active: true/false, liftedAt: set, marketing_status, eligible,
 * POST /api/dashboard/suppressions/{id}, ResubscribeBlockedError) stay
 * LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

export function ActiveVsLifted({
  copy,
}: {
  copy: ActiveVsLiftedCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  return (
    <article
      className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-7"
      dir={dir}
    >
      <header className="mb-5">
        <h3 className="text-lg font-bold text-foreground sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.subheading}</p>
      </header>

      {/* Two state cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {/* Active card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
          className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-rose-400" />
            <span className="inline-flex items-center rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[11px] text-rose-300">
              {copy.activeCard.badge}
            </span>
            <span className="ml-auto font-mono text-[11px] text-rose-300">
              <Ltr>{copy.activeCard.title}</Ltr>
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{copy.activeCard.body}</p>
          <ul className="mt-3 space-y-1">
            {copy.activeCard.effects.map((effect, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
              >
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                <span>{effect}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Lifted card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : 0.08 }}
          className="rounded-xl border border-slate-500/40 bg-slate-500/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-300" />
            <span className="inline-flex items-center rounded border border-slate-500/40 bg-slate-500/10 px-1.5 py-0.5 text-[11px] text-slate-200">
              {copy.liftedCard.badge}
            </span>
            <span className="ml-auto font-mono text-[11px] text-slate-300">
              <Ltr>{copy.liftedCard.title}</Ltr>
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{copy.liftedCard.body}</p>
          <ul className="mt-3 space-y-1">
            {copy.liftedCard.effects.map((effect, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
              >
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                <span>{effect}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Comparison table */}
      <div className="mb-5 overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-3 gap-px bg-border/60 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="bg-card/60 px-3 py-2">{copy.comparison[0]?.dimension ? "Dimension" : ""}</div>
          <div className="bg-card/60 px-3 py-2 text-rose-300">{copy.activeCard.badge}</div>
          <div className="bg-card/60 px-3 py-2 text-slate-300">{copy.liftedCard.badge}</div>
        </div>
        <div className="divide-y divide-gray-800/60">
          {copy.comparison.map((row, i) => (
            <motion.div
              key={i}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, delay: prefersReducedMotion ? 0 : i * 0.03 }}
              className="grid grid-cols-3 gap-2 bg-muted/40 px-3 py-2 text-[11px]"
            >
              <div className="text-muted-foreground">{row.dimension}</div>
              <div className="text-rose-300 font-medium">
                <Ltr>{row.activeValue}</Ltr>
              </div>
              <div className="text-slate-300 font-medium">
                <Ltr>{row.liftedValue}</Ltr>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Warning callout — lift ≠ delete */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
        <div className="mb-1 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-semibold text-amber-300">{copy.warningTitle}</p>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{copy.warningBody}</p>
      </div>
    </article>
  );
}
