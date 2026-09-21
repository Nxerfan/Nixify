"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, Ban, ShieldOff, ShieldCheck,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  SafeLiftingDecisionTreeCopy,
  DecisionTreeBranchCopy,
} from "@/lib/guide/content/guides/suppressions-types";

/**
 * Safe-lifting decision tree — interactive creative section.
 *
 * Renders the root question + four decision branches as a vertical
 * decision tree. Each branch is color-coded by tone (safe = emerald,
 * caution = amber, blocked = rose). Below the branches are two side-by-
 * side API path cards (lift-only vs lift+subscribe) showing the exact
 * request body shape and POST endpoint.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read
 * locale directly — it renders the resolved copy. The `useLocale` call
 * is only for the `dir` wrapper + arrow direction.
 *
 * Tokens (reason codes like manual/unsubscribe/hard_bounce/complaint,
 * also_subscribe: true/false, NON_LIFTABLE_BY_RESUBSCRIBE,
 * POST /api/dashboard/suppressions/{id}) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const TONE_CLASS: Record<DecisionTreeBranchCopy["tone"], {
  border: string;
  bg: string;
  text: string;
  dot: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  safe: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    Icon: CheckCircle2,
  },
  caution: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    text: "text-amber-300",
    dot: "bg-amber-400",
    Icon: AlertTriangle,
  },
  blocked: {
    border: "border-rose-500/40",
    bg: "bg-rose-500/5",
    text: "text-rose-300",
    dot: "bg-rose-400",
    Icon: Ban,
  },
};

export function SafeLiftingDecisionTree({
  copy,
}: {
  copy: SafeLiftingDecisionTreeCopy;
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

      {/* Root question */}
      <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-center">
        <p className="text-sm font-semibold text-emerald-300">
          <span className="text-[10px] uppercase tracking-wider text-emerald-500/70 mr-2">
            ▣ root
          </span>
          {copy.rootQuestion}
        </p>
      </div>

      {/* Decision branches */}
      <ol className="relative space-y-3 border-l border-gray-800/60 pl-4 mb-6">
        {copy.branches.map((branch, i) => {
          const tone = TONE_CLASS[branch.tone];
          const Icon = tone.Icon;
          return (
            <motion.li
              key={branch.key}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.05 }}
              className="relative"
            >
              {/* Node */}
              <span className="absolute -left-[1.4rem] top-3 flex h-3 w-3 items-center justify-center rounded-full border border-gray-700 bg-gray-950">
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              </span>
              <div className={`rounded-xl border ${tone.border} ${tone.bg} p-3`}>
                <div className="mb-1 flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${tone.text}`} />
                  <p className={`text-xs font-semibold ${tone.text}`}>{branch.question}</p>
                  {branch.token && (
                    <span className="ml-auto inline-flex items-center rounded border border-gray-700 bg-gray-950/60 px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
                      <Ltr>{branch.token}</Ltr>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">{branch.outcome}</p>
                <p className="mt-1.5 text-[11px] text-gray-300">
                  <span className={`mr-1.5 text-[10px] uppercase tracking-wider ${tone.text}`}>
                    →
                  </span>
                  {branch.recommendation}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {/* API paths — side by side */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {/* Lift only */}
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
              {copy.liftOnlyPath.badge}
            </span>
          </div>
          <p className="font-mono text-[11px] text-rose-300 mb-1">
            <Ltr>{copy.liftOnlyPath.title}</Ltr>
          </p>
          <p className="text-[11px] text-gray-400 leading-relaxed">{copy.liftOnlyPath.body}</p>
          <p className="mt-2 rounded bg-gray-950/60 px-2 py-1 font-mono text-[10px] text-gray-300">
            <Ltr>{copy.liftOnlyPath.apiCall}</Ltr>
          </p>
        </motion.div>

        {/* Lift + subscribe */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : 0.08 }}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-300">
              {copy.liftAndSubscribePath.badge}
            </span>
          </div>
          <p className="font-mono text-[11px] text-emerald-300 mb-1">
            <Ltr>{copy.liftAndSubscribePath.title}</Ltr>
          </p>
          <p className="text-[11px] text-gray-400 leading-relaxed">{copy.liftAndSubscribePath.body}</p>
          <p className="mt-2 rounded bg-gray-950/60 px-2 py-1 font-mono text-[10px] text-gray-300">
            <Ltr>{copy.liftAndSubscribePath.apiCall}</Ltr>
          </p>
        </motion.div>
      </div>

      {/* Warning callout */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
        <div className="mb-1 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-semibold text-amber-300">{copy.warningTitle}</p>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">{copy.warningBody}</p>
      </div>
    </article>
  );
}
