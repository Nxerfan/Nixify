"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { SafeDesignChecklistCopy } from "@/lib/guide/content/guides/automations-types";

/**
 * Safe design checklist — creative section.
 *
 * A practical checklist of safety/compatibility checks the user should run
 * before walking away from the Automations page. Each item is annotated
 * with a hint explaining why it matters. The bottom warning card reminds
 * users that an enabled-but-broken automation is worse than a disabled one
 * (silent failures are dangerous).
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper.
 *
 * Tokens like {{email}} / {{name}} in hint text stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */
export function SafeDesignChecklist({
  copy,
}: {
  copy: SafeDesignChecklistCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();
  const [checked, setChecked] = React.useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const allChecked = checked.size === copy.items.length;

  return (
    <article className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground sm:text-xl">{copy.heading}</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{copy.subheading}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${
            allChecked
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-border text-muted-foreground"
          }`}
        >
          {checked.size} / {copy.items.length}
        </span>
      </header>

      <ul className="space-y-2.5">
        {copy.items.map((item, i) => {
          const isChecked = checked.has(i);
          return (
            <motion.li
              key={i}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
            >
              <button
                type="button"
                onClick={() => toggle(i)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                  isChecked
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border bg-muted/40 hover:border-border hover:bg-card/60"
                }`}
                aria-pressed={isChecked}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    isChecked
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      : "border-border text-transparent"
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                </span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isChecked ? "text-emerald-200" : "text-foreground"}`}>
                    <Tokenized text={item.label} />
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Tokenized text={item.hint} />
                  </p>
                </div>
              </button>
            </motion.li>
          );
        })}
      </ul>

      {/* Warning footer */}
      <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="mb-1.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <p className="text-sm font-semibold text-amber-200">{copy.warningTitle}</p>
        </div>
        <p className="text-xs text-muted-foreground">{copy.warningBody}</p>
      </div>
    </article>
  );
}

/**
 * Tokenized text — wraps {{var}} placeholders in <Ltr> so they render LTR
 * inside RTL Persian copy. Anything outside the placeholder flows with the
 * ambient direction.
 */
function Tokenized({ text }: { text: string }) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\{\{[^}]+\}\}$/.test(part)) {
          return (
            <Ltr key={i} className="font-mono text-emerald-300">
              {part}
            </Ltr>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
