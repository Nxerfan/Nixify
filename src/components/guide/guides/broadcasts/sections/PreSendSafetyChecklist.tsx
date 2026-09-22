"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { PreSendSafetyChecklistCopy } from "@/lib/guide/content/guides/broadcasts-types";

/**
 * Pre-send safety checklist — interactive creative section.
 *
 * The launch is irreversible. This checklist captures the seven checks
 * that should pass before clicking Launch. Click a row to toggle its
 * state — the live banner at the bottom switches between "Ready to
 * launch" (all checked) and "Not ready yet" (one or more unchecked).
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read
 * locale directly — it renders the resolved copy. The `useLocale` call
 * is only for the `dir` wrapper.
 *
 * Tokens (POST /preview, {{unsubscribe_url}}, BROADCAST_REVIEW_THRESHOLD,
 * status === draft, subject ≤ 200, html ≤ 500KB, skipped / total < 10%)
 * stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual. The toggle is local state only.
 */
export function PreSendSafetyChecklist({
  copy,
}: {
  copy: PreSendSafetyChecklistCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();
  const [checked, setChecked] = React.useState<Set<string>>(
    () => new Set(),
  );

  const allChecked = checked.size === copy.items.length;

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <article
      className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-7"
      dir={dir}
    >
      <header className="mb-5">
        <h3 className="text-lg font-bold text-foreground sm:text-xl">
          {copy.heading}
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.subheading}</p>
      </header>

      <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {copy.checklistTitle}
      </p>

      <ul className="space-y-2">
        {copy.items.map((item, i) => {
          const isChecked = checked.has(item.key);
          return (
            <motion.li
              key={item.key}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, delay: prefersReducedMotion ? 0 : i * 0.04 }}
            >
              <button
                type="button"
                onClick={() => toggle(item.key)}
                aria-pressed={isChecked}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  isChecked
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-border bg-muted/40 hover:border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      isChecked
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        : "border-border text-transparent"
                    }`}
                  >
                    {isChecked ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3 w-3 text-gray-700" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        isChecked ? "text-emerald-200" : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {item.desc}
                    </p>
                    {item.token && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        <Ltr>{item.token}</Ltr>
                      </p>
                    )}
                  </div>
                </div>
              </button>
            </motion.li>
          );
        })}
      </ul>

      {/* Live result banner */}
      <AnimatePresence mode="wait">
        {allChecked ? (
          <motion.div
            key="all-checked"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
            className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-200">
                {copy.allCheckedTitle}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">{copy.allCheckedBody}</p>
          </motion.div>
        ) : (
          <motion.div
            key="not-checked"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
            className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <p className="text-sm font-semibold text-amber-200">
                {copy.notAllCheckedTitle}
              </p>
              <span className="ml-auto rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                <Ltr>{`${checked.size}/${copy.items.length}`}</Ltr>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{copy.notAllCheckedBody}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
