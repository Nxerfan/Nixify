"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Tag, KeyRound, Hash, AlertTriangle, ArrowRight, ArrowLeft,
  Plus, Eye, ShieldCheck, Trash2,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  KeyAnatomyCopy,
  KeyAnatomyFieldCopy,
} from "@/lib/guide/content/guides/api-keys-types";

/**
 * Key anatomy — the three parts of an API key + the create→store→verify→
 * revoke cycle.
 *
 * Renders the three key parts (prefix, secret, SHA-256 hash) as color-coded
 * cards (ui=slate, secret=amber, storage=emerald), then renders the four
 * stages of the lifecycle as a vertical timeline. Footnote points to
 * src/lib/dx/api-keys.ts.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper + arrow direction.
 *
 * Tokens (key prefixes like mg_test_ / mg_live_, full keys like
 * mg_live_abC12..., hash tokens like sha256:7c3b9f1e..., HTTP method
 * names like POST /api/admin/api-keys, file paths) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const PART_TONE_CLASS: Record<KeyAnatomyFieldCopy["tone"], string> = {
  ui: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  secret: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  storage: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

const CYCLE_TONE_CLASS: Record<string, string> = {
  ui: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  secret: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  storage: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  revoke: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

/** Decorative per-stage icon. */
function CycleIcon({ tone }: { tone: string }): React.ReactElement {
  if (tone === "ui") return <Plus className="h-3 w-3" />;
  if (tone === "secret") return <Eye className="h-3 w-3" />;
  if (tone === "storage") return <ShieldCheck className="h-3 w-3" />;
  if (tone === "revoke") return <Trash2 className="h-3 w-3" />;
  return <KeyRound className="h-3 w-3" />;
}

/** Decorative per-part icon. */
function PartIcon({ tone }: { tone: KeyAnatomyFieldCopy["tone"] }): React.ReactElement {
  if (tone === "ui") return <Tag className="h-3 w-3" />;
  if (tone === "secret") return <KeyRound className="h-3 w-3" />;
  return <Hash className="h-3 w-3" />;
}

export function KeyAnatomy({
  copy,
}: {
  copy: KeyAnatomyCopy;
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
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-300">{copy.subheading}</p>
      </header>

      {/* The full key, decomposed */}
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.partsTitle}
        </p>
        <div className="mb-3 rounded-lg border border-gray-800/60 bg-gray-950/60 p-3">
          <code dir="ltr" className="block font-mono text-sm text-gray-200">
            <Ltr>{copy.fullKey}</Ltr>
          </code>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {copy.parts.map((part, i) => (
            <motion.div
              key={part.key}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.05 }}
              className={`rounded-xl border p-3 ${PART_TONE_CLASS[part.tone]}`}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <PartIcon tone={part.tone} />
                <span className="text-sm font-semibold">{part.label}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-300">{part.desc}</p>
              <p className="mt-2 font-mono text-[10px] text-gray-300">
                <Ltr>{part.token}</Ltr>
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* The create → store → verify → revoke cycle */}
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.cycleTitle}
        </p>
        <p className="mb-3 text-xs text-gray-300">{copy.cycleSubtitle}</p>
        <ol className="relative space-y-3 border-l border-gray-800/60 pl-4">
          {copy.cycle.map((step, i) => (
            <motion.li
              key={i}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: isRTL ? -4 : 4 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
              className="relative"
            >
              {/* Node marker */}
              <span
                className={`absolute -left-[1.4rem] top-1 flex h-3 w-3 items-center justify-center rounded-full border bg-gray-950 ${
                  (CYCLE_TONE_CLASS[step.tone] ?? "").split(" ").find((c) => c.startsWith("border-"))
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    (CYCLE_TONE_CLASS[step.tone] ?? "").split(" ").find((c) => c.startsWith("bg-"))?.replace("/10", "/60")
                  }`}
                />
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-gray-400">
                  <Ltr>{step.badge}</Ltr>
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${
                    CYCLE_TONE_CLASS[step.tone] ?? "border-gray-700 bg-gray-800/40 text-gray-300"
                  }`}
                >
                  <CycleIcon tone={step.tone} />
                  {step.title}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-300">{step.body}</p>
              {step.token && (
                <p className="mt-1 font-mono text-[10px] text-gray-300">
                  <Ltr>{step.token}</Ltr>
                </p>
              )}
            </motion.li>
          ))}
        </ol>
      </div>

      {/* Footnote */}
      <p className="mt-5 rounded-xl border border-gray-800/60 bg-gray-950/60 p-3 text-xs text-gray-300">
        {copy.footnote}
      </p>

      {/* Amber warning — shown once, never retrievable */}
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-xs font-semibold text-amber-200">{copy.warningTitle}</p>
          <p className="mt-0.5 text-[11px] text-gray-300">{copy.warningBody}</p>
        </div>
      </div>
    </article>
  );
}
