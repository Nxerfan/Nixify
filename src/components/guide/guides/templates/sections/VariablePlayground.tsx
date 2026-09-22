"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowLeft, Variable, Mail } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { VariableSubstitutionPlaygroundCopy } from "@/lib/guide/content/guides/templates-types";

/**
 * Variable substitution playground — before/after the {{variable}} replace.
 *
 * Visually demonstrates that variable substitution is a simple string
 * replace — the raw template (left) has {{var}} placeholders, the
 * rendered output (right) has those placeholders replaced with the
 * caller-provided values. If the caller leaves one empty, the backend
 * returns 400 with code = "missing_template_variables".
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read
 * locale directly — it renders the resolved copy. The `useLocale` call
 * is only for the `dir` wrapper + arrow direction.
 *
 * Tokens ({{var}} placeholders, subject/html body strings, email
 * addresses) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual. The rendering happens locally via
 * the same simple string-replace the backend performs.
 */
export function VariablePlayground({
  copy,
}: {
  copy: VariableSubstitutionPlaygroundCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <article className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-foreground sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{copy.subheading}</p>
      </header>

      <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr]">
        {/* Before: raw template */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
          className="rounded-xl border border-border bg-card/60 p-4"
        >
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {copy.beforeTitle}
          </p>
          <p className="mb-1 text-[10px] text-muted-foreground">{copy.beforeLabel}</p>

          {/* Raw subject */}
          <div className="mb-3">
            <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              subject
            </p>
            <code className="block rounded border border-border bg-muted/60 p-2 font-mono text-[11px] text-muted-foreground">
              <Ltr>{copy.rawSubject}</Ltr>
            </code>
          </div>

          {/* Raw HTML */}
          <div>
            <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              html
            </p>
            <pre className="overflow-x-auto rounded border border-border bg-muted/60 p-2 font-mono text-[10px] text-muted-foreground">
<Ltr>{copy.rawHtml}</Ltr>
            </pre>
          </div>
        </motion.div>

        {/* Arrow column */}
        <div className="flex items-center justify-center py-2">
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <motion.span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              animate={prefersReducedMotion ? {} : { x: isRTL ? [-3, 3, -3] : [3, -3, 3] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Arrow className="h-4 w-4" />
            </motion.span>
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider">
              <Variable className="h-2.5 w-2.5" />
              {copy.variablesTitle}
            </span>
          </div>
        </div>

        {/* After: rendered output */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, delay: prefersReducedMotion ? 0 : 0.1 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
        >
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
            {copy.afterTitle}
          </p>
          <p className="mb-1 text-[10px] text-muted-foreground">{copy.afterLabel}</p>

          {/* Rendered subject */}
          <div className="mb-3">
            <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              subject
            </p>
            <p className="rounded border border-border bg-muted/60 p-2 text-[11px] text-foreground">
              <Ltr>{copy.renderedSubject}</Ltr>
            </p>
          </div>

          {/* Rendered HTML */}
          <div>
            <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              html
            </p>
            <iframe
              title="rendered-template"
              sandbox="allow-same-origin"
              srcDoc={copy.renderedHtml}
              className="h-28 w-full rounded border border-emerald-500/30 bg-white"
            />
          </div>
        </motion.div>
      </div>

      {/* Variables used */}
      <div className="mt-5 rounded-xl border border-border bg-card/60 p-3">
        <p className="mb-2 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <Variable className="h-3 w-3" />
          {copy.variablesTitle}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {copy.variables.map((v, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded border border-border bg-muted/40 px-3 py-1.5"
            >
              <span className="inline-flex items-center gap-2">
                <code className="font-mono text-[11px] text-emerald-300">
                  <Ltr>{`{{${v.variable}}}`}</Ltr>
                </code>
                <span className="text-[10px] text-muted-foreground">→</span>
                <code className="font-mono text-[11px] text-foreground">
                  <Ltr>{v.value}</Ltr>
                </code>
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] ${
                  v.source === "builtin"
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border border-amber-500/40 bg-amber-500/10 text-amber-400"
                }`}
              >
                {v.source === "builtin" ? "built-in" : "per-send"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Caption */}
      <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Mail className="h-3 w-3" />
        {copy.caption}
      </p>
    </article>
  );
}
