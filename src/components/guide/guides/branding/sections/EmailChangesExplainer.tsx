"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { EmailChangesCopy } from "@/lib/guide/content/guides/branding-types";

/**
 * "What changes in the actual email?" — explainer section.
 *
 * A field-by-field mapping table showing how each Branding-tab field in the
 * ThemeConfig object affects a specific element in the rendered OTP email.
 * Each row shows before (default) and after (customized) plus a short note
 * explaining the effect.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale directly
 * — it renders the resolved copy. The `useLocale` call is only for the `dir`
 * wrapper + arrow direction.
 *
 * Tokens (field names, CSS property values, hex colors) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */
export function EmailChangesExplainer({
  copy,
}: {
  copy: EmailChangesCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <article className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-300">{copy.subheading}</p>
      </header>

      {/* Mapping table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-950/60 text-[10px] uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-3 py-2 font-medium">{copy.tableHeaders.field}</th>
              <th className="px-3 py-2 font-medium">{copy.tableHeaders.affects}</th>
              <th className="px-3 py-2 font-medium">{copy.tableHeaders.before}</th>
              <th className="px-3 py-2 font-medium">{copy.tableHeaders.after}</th>
            </tr>
          </thead>
          <tbody>
            {copy.mappings.map((m, i) => (
              <motion.tr
                key={i}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
                className="border-t border-gray-800/60 align-top"
              >
                <td className="px-3 py-2.5">
                  <Ltr className="font-mono text-[11px] text-emerald-300">{m.field}</Ltr>
                </td>
                <td className="px-3 py-2.5 text-gray-300">{m.affects}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-700/60 bg-gray-900/60 px-1.5 py-0.5 text-[10px] text-gray-300">
                    <Ltr>{m.before}</Ltr>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                    <Arrow className="h-2.5 w-2.5" />
                    <Ltr>{m.after}</Ltr>
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-row notes */}
      <div className="mt-4 space-y-2">
        {copy.mappings.map((m, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
            <span className="mt-0.5 inline-flex shrink-0 rounded bg-emerald-500/10 px-1.5 py-px text-[9px] text-emerald-300">
              <Ltr>{m.field}</Ltr>
            </span>
            <span className="flex-1">{m.note}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-gray-800/60 pt-3 text-xs text-gray-400">{copy.footnote}</p>
    </article>
  );
}
