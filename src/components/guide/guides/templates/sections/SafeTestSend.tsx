"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Eye, Send, AlertTriangle } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { SafeTestSendCopy } from "@/lib/guide/content/guides/templates-types";

/**
 * Safe test-send mental model — creative section.
 *
 * A side-by-side comparison of Preview (free, render-only) vs Send test
 * email (real send, quota-consuming). The two share an input shape and
 * the same rendering pipeline, but diverge at the last step — Preview
 * stops before the provider, Send test email hands the rendered message
 * to the provider and writes a sent_emails row.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read
 * locale directly — it renders the resolved copy. The `useLocale` call
 * is only for the `dir` wrapper.
 *
 * Tokens (HTTP method names, endpoint paths, status codes, MESSAGING_EMAILS)
 * stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */
export function SafeTestSend({
  copy,
}: {
  copy: SafeTestSendCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  return (
    <article className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-foreground sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{copy.subheading}</p>
      </header>

      {/* Two cards side by side */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {/* Preview card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              {copy.previewCard.badge}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <Eye className="h-4 w-4" />
            </span>
          </div>
          <p className="mb-2 text-sm font-semibold text-foreground">{copy.previewCard.title}</p>
          <p className="text-xs text-muted-foreground">{copy.previewCard.body}</p>
        </motion.div>

        {/* Test send card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, delay: prefersReducedMotion ? 0 : 0.1 }}
          className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              {copy.testSendCard.badge}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300">
              <Send className="h-4 w-4" />
            </span>
          </div>
          <p className="mb-2 text-sm font-semibold text-foreground">{copy.testSendCard.title}</p>
          <p className="text-xs text-muted-foreground">{copy.testSendCard.body}</p>
        </motion.div>
      </div>

      {/* Comparison table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-medium">
                {""}
              </th>
              <th className="px-3 py-2 font-medium text-emerald-300">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {copy.previewCard.title}
                </span>
              </th>
              <th className="px-3 py-2 font-medium text-amber-300">
                <span className="inline-flex items-center gap-1">
                  <Send className="h-3 w-3" />
                  {copy.testSendCard.title}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {copy.comparison.map((row, i) => (
              <motion.tr
                key={i}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: dir === "rtl" ? 4 : -4 }}
                whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, delay: prefersReducedMotion ? 0 : i * 0.04 }}
                className="border-b border-border last:border-0"
              >
                <td className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {row.dimension}
                </td>
                <td className="px-3 py-2 text-[11px] text-muted-foreground">
                  <Ltr>{row.previewValue}</Ltr>
                </td>
                <td className="px-3 py-2 text-[11px] text-foreground">
                  <Ltr>{row.testSendValue}</Ltr>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Warning footer */}
      <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="mb-1.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <p className="text-sm font-semibold text-amber-200">{copy.warningTitle}</p>
        </div>
        <p className="text-xs text-muted-foreground">{copy.warningBody}</p>
      </div>
    </article>
  );
}
