"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  UserPlus, Mail, BellRing, Send,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { JourneyCopy } from "@/lib/guide/content/types";

/**
 * Contact's Journey — visual lifecycle / timeline.
 *
 * Shows a realistic path a contact takes through the product, faithful to
 * the actual Nixify implementation:
 *
 *   1. created/imported  → Contact row appears in /dashboard/contacts
 *   2. inspected         → user opens the contact detail page
 *   3. consent state     → user manages marketing_status / suppression
 *   4. used downstream    → broadcasts / automations / transactional mail
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call here is only
 * for the `dir` wrapper.
 *
 * Each step is annotated with what UI surface is involved and what
 * downstream behavior changes. NO real API calls.
 */

const STEP_ICONS = [UserPlus, Mail, BellRing, Send];

export function ContactJourney({ copy }: { copy: JourneyCopy }): React.ReactNode {
  const { dir } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();

  return (
    <article className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-foreground sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{copy.subheading}</p>
      </header>

      <ol className="relative space-y-5">
        {/* Vertical connector */}
        <span
          aria-hidden
          className={`absolute top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500/40 via-gray-700/40 to-emerald-500/40 ${
            isRTL ? "right-4" : "left-4"
          }`}
        />
        {copy.steps.map((step, i) => {
          const Icon = STEP_ICONS[i] ?? Mail;
          return (
            <motion.li
              key={i}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.35, delay: prefersReducedMotion ? 0 : i * 0.05 }}
              className={`relative flex gap-3 pl-12 sm:pl-14 ${isRTL ? "pl-0 pr-12 sm:pr-14" : ""}`}
            >
              <span
                className={`absolute top-0 flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ${
                  isRTL ? "right-0" : "left-0"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 rounded-xl border border-border bg-muted/40 p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                    {step.badge}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{step.body}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Annotation tone="ui" label={copy.legendItems[0].label} value={step.surface} />
                  <Annotation tone="state" label={copy.legendItems[1].label} value={step.sideEffect} />
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {copy.legendTitle}:
        </p>
        {copy.legendItems.map((item, i) => (
          <LegendChip key={i} tone={item.tone} label={item.label} />
        ))}
      </div>
    </article>
  );
}

function Annotation({
  tone,
  label,
  value,
}: {
  tone: "ui" | "state" | "downstream";
  label: string;
  value: string;
}) {
  const cls =
    tone === "ui"
      ? "border-sky-500/20 bg-sky-500/5"
      : tone === "state"
        ? "border-amber-500/20 bg-amber-500/5"
        : "border-emerald-500/20 bg-emerald-500/5";
  const dotCls =
    tone === "ui"
      ? "bg-sky-400"
      : tone === "state"
        ? "bg-amber-400"
        : "bg-emerald-400";
  return (
    <div className={`rounded-lg border ${cls} p-2.5`}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        <Ltr>{value}</Ltr>
      </p>
    </div>
  );
}

function LegendChip({ tone, label }: { tone: "ui" | "state" | "downstream"; label: string }) {
  const cls =
    tone === "ui"
      ? "border-sky-500/30 text-sky-300"
      : tone === "state"
        ? "border-amber-500/30 text-amber-300"
        : "border-emerald-500/30 text-emerald-700 dark:text-emerald-300";
  const dotCls =
    tone === "ui" ? "bg-sky-400" : tone === "state" ? "bg-amber-400" : "bg-emerald-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border ${cls} px-2 py-0.5 text-[10px]`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {label}
    </span>
  );
}
