"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertOctagon, RefreshCw, Ban, ShieldOff, ShieldCheck, HelpCircle,
  AlertTriangle, GitBranch, Info,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  FailedEmailTroubleshootingCopy,
  FailedTroubleshootingPathCopy,
} from "@/lib/guide/content/guides/emails-types";

/**
 * Failed-email troubleshooting — diagnostic decision flowchart.
 *
 * Renders the 6 failure paths as cards (hard_bounce, soft_bounce, complaint,
 * rejected, failed, unknown). Each card shows: symptom / cause / action +
 * two pills: suppressionApplied (rose if true) + retryEligible (emerald if
 * true, slate if false).
 *
 * Then renders the 4-question decision tree as a flowchart-style list.
 * Then renders the suppression footnote + the never-retry-hard-bounce
 * warning.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper.
 *
 * Tokens (status codes like bounced/deferred/complained/rejected/failed/
 * unknown, lastErrorCode strings like smtp_5xx_permanent /
 * smtp_4xx_transient / provider_connection_timeout /
 * db_persistence_failed_post_accept, suppressEmail(reason=...)) stay LTR
 * via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const PATH_TONE_CLASS: Record<FailedTroubleshootingPathCopy["tone"], string> = {
  bad: "border-rose-500/40 bg-rose-500/5",
  warn: "border-amber-500/40 bg-amber-500/5",
  recovery: "border-purple-500/40 bg-purple-500/5",
  neutral: "border-slate-500/40 bg-slate-500/5",
};

const PATH_TONE_BADGE: Record<FailedTroubleshootingPathCopy["tone"], string> = {
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  recovery: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  neutral: "border-slate-500/40 bg-slate-500/10 text-slate-300",
};

/** Path tone → lucide icon. */
function PathIcon({ tone }: { tone: FailedTroubleshootingPathCopy["tone"] }): React.ReactElement {
  if (tone === "bad") return <AlertOctagon className="h-4 w-4" />;
  if (tone === "warn") return <RefreshCw className="h-4 w-4" />;
  if (tone === "recovery") return <HelpCircle className="h-4 w-4" />;
  return <Ban className="h-4 w-4" />;
}

export function FailedEmailTroubleshooting({
  copy,
}: {
  copy: FailedEmailTroubleshootingCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

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

      {/* Paths grid */}
      <div className="mb-6">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.pathsTitle}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {copy.paths.map((p, i) => (
            <motion.div
              key={p.key}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
              className={`rounded-xl border p-3 ${PATH_TONE_CLASS[p.tone]}`}
            >
              {/* Header: icon + title + token */}
              <div className="mb-2 flex items-center gap-2">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${PATH_TONE_BADGE[p.tone]}`}>
                  <PathIcon tone={p.tone} />
                </span>
                <span className="text-sm font-semibold text-gray-200">{p.title}</span>
              </div>
              <p className="mb-2 font-mono text-[10px] text-gray-400">
                <Ltr>{p.token}</Ltr>
              </p>
              {/* Pills: suppression + retry eligibility */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${
                    p.suppressionApplied
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                      : "border-slate-500/40 bg-slate-500/10 text-slate-400"
                  }`}
                  title={p.suppressionApplied ? "Suppression applied" : "No suppression"}
                >
                  {p.suppressionApplied ? <ShieldOff className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />}
                  <Ltr>{p.suppressionApplied ? "suppression: yes" : "suppression: no"}</Ltr>
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${
                    p.retryEligible
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-500/40 bg-slate-500/10 text-slate-400"
                  }`}
                  title={p.retryEligible ? "Retry-eligible" : "Not retry-eligible"}
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  <Ltr>{p.retryEligible ? "retry: yes" : "retry: no"}</Ltr>
                </span>
              </div>
              {/* Three rows: symptom / cause / action */}
              <div className="space-y-1.5">
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400">
                    symptom
                  </p>
                  <p className="text-[11px] text-gray-300">{p.symptom}</p>
                </div>
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400">
                    cause
                  </p>
                  <p className="text-[11px] text-gray-300">{p.cause}</p>
                </div>
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400">
                    action
                  </p>
                  <p className="text-[11px] text-gray-300">{p.action}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Decision tree */}
      <div className="mb-6">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.decisionTreeTitle}
        </p>
        <ol className="relative space-y-3 border-l border-gray-800/60 pl-4">
          {copy.decisionTree.map((d, i) => (
            <motion.li
              key={i}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: dir === "rtl" ? -4 : 4 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.05 }}
              className="relative"
            >
              <span className="absolute -left-[1.4rem] top-1 flex h-3 w-3 items-center justify-center rounded-full border border-emerald-500/40 bg-gray-950">
                <GitBranch className="h-2 w-2 text-emerald-400" />
              </span>
              <p className="text-xs font-semibold text-gray-200">{d.question}</p>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-1.5">
                  <p className="text-[9px] font-medium uppercase tracking-wider text-emerald-300">
                    yes
                  </p>
                  <p className="text-[11px] text-gray-300">{d.yes}</p>
                </div>
                <div className="rounded-md border border-slate-500/30 bg-slate-500/5 p-1.5">
                  <p className="text-[9px] font-medium uppercase tracking-wider text-slate-300">
                    no
                  </p>
                  <p className="text-[11px] text-gray-300">{d.no}</p>
                </div>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>

      {/* Suppression footnote */}
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p className="text-xs text-gray-300">{copy.suppressionFootnote}</p>
      </div>

      {/* Warning */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="mb-1.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <p className="text-sm font-semibold text-amber-200">
            {copy.warningTitle}
          </p>
        </div>
        <p className="text-xs text-gray-300">{copy.warningBody}</p>
      </div>
    </article>
  );
}
