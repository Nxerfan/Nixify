"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Hash, Type, Code, FileText, Variable, History,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { TemplateAnatomyCopy } from "@/lib/guide/content/guides/templates-types";

/**
 * Template anatomy — annotated breakdown of a Nixify template.
 *
 * The four parts of every template:
 *   - Slug (immutable identifier)
 *   - Subject (single line, inbox preview)
 *   - HTML body (sanitized, inline-styled)
 *   - Plain text (optional fallback)
 *   - Variables (the {{var}} surface)
 *   - Version (immutable history row)
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper.
 *
 * Technical tokens (slugs, version strings v1/v2/v3, {{var}} placeholders,
 * HTML body strings, HTTP method names) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const ICONS = {
  slug: Hash,
  subject: Type,
  html: Code,
  text: FileText,
  variables: Variable,
  version: History,
} as const;

export function TemplateAnatomy({
  copy,
}: {
  copy: TemplateAnatomyCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();
  const [activeIdx, setActiveIdx] = React.useState<number>(0);
  const active = copy.annotations[activeIdx];
  const ActiveIcon = ICONS[active.icon] ?? Hash;

  return (
    <article className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Annotated template visual */}
        <div className="rounded-xl border border-gray-800/60 bg-gray-950/60 p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
            {copy.annotationsTitle}
          </p>
          <div className="space-y-1">
            {copy.annotations.map((ann, i) => {
              const Icon = ICONS[ann.icon] ?? Hash;
              const isActive = activeIdx === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                    isActive
                      ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                      : "hover:bg-gray-800/40"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${isActive ? "text-emerald-300" : "text-gray-500"}`}
                  />
                  <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-gray-400">
                    <Ltr>{ann.field}</Ltr>
                  </span>
                  <span className="flex-1 truncate text-[10px] text-gray-200">
                    <Ltr>{ann.value}</Ltr>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <motion.div
          key={activeIdx}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <ActiveIcon className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                <Ltr>{active.field}</Ltr>
              </p>
              <p className="text-sm font-semibold text-gray-100">
                <Ltr>{active.label}</Ltr>
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400">{active.desc}</p>
          <p className="mt-3 text-[10px] uppercase tracking-wider text-gray-500">
            value
          </p>
          <p className="font-mono text-[11px] text-gray-200">
            <Ltr>{active.value}</Ltr>
          </p>
        </motion.div>
      </div>
    </article>
  );
}
