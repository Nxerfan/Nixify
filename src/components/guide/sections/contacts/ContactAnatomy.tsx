"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Mail, Tag, User, Clock, BellRing, ListTree, Hash,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { ContactAnatomyCopy } from "@/lib/guide/content/types";

/**
 * Contact Anatomy — annotated visual of a real contact's information.
 *
 * Mirrors the data shown on /dashboard/contacts/[id]:
 *   - name (editable)
 *   - email (immutable, read-only)
 *   - source (read-only: API / Dashboard / OTP Verified / Import)
 *   - attributes (editable key/value pairs)
 *   - created_at / updated_at (read-only)
 *   - marketing_status + suppressed + eligible (consent state, from /consent)
 *   - timeline (recent events)
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call here is only
 * for the `dir` wrapper.
 *
 * Each annotation points to a real field; the user hovers/taps to read
 * about it. NO real API calls — purely visual.
 */

const ICONS = {
  name: User,
  email: Mail,
  source: Tag,
  attributes: Hash,
  dates: Clock,
  consent: BellRing,
  timeline: ListTree,
  id: Hash,
} as const;

export function ContactAnatomy({ copy }: { copy: ContactAnatomyCopy }): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();
  const [activeIdx, setActiveIdx] = React.useState<number | null>(1); // email by default

  const active = activeIdx !== null ? copy.annotations[activeIdx] : null;

  return (
    <article className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-foreground sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{copy.subheading}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Annotated visual */}
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              S
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                <FieldTag active={activeIdx === 0} onClick={() => setActiveIdx(0)}>
                  {copy.annotations[0].value}
                </FieldTag>
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                <Ltr>
                  <FieldTag active={activeIdx === 1} onClick={() => setActiveIdx(1)}>
                    {copy.annotations[1].value}
                  </FieldTag>
                </Ltr>
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <Row label={copy.annotations[2].label} icon="source" idx={2} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[2].value}</Ltr>
            </Row>
            <Row label={copy.annotations[3].label} icon="attributes" idx={3} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[3].value}</Ltr>
            </Row>
            <Row label={copy.annotations[4].label} icon="dates" idx={4} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[4].value}</Ltr>
            </Row>
            <Row label={copy.annotations[5].label} icon="consent" idx={5} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[5].value}</Ltr>
            </Row>
            <Row label={copy.annotations[6].label} icon="timeline" idx={6} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[6].value}</Ltr>
            </Row>
            <Row label={copy.annotations[7].label} icon="id" idx={7} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[7].value}</Ltr>
            </Row>
          </div>
        </div>

        {/* Detail panel */}
        <motion.div
          key={activeIdx ?? "empty"}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
          aria-live="polite"
        >
          {active ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                {(() => {
                  const Icon = ICONS[active.icon];
                  return (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  );
                })()}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    <Ltr>{active.field}</Ltr>
                  </p>
                  <p className="text-sm font-semibold text-foreground">{active.label}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{active.desc}</p>
              <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {copy.annotationsTitle}
              </p>
              <p className="text-xs text-foreground">
                <Ltr>{active.value}</Ltr>
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{copy.selectHint}</p>
          )}
        </motion.div>
      </div>
    </article>
  );
}

function FieldTag({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded px-1 py-0.5 text-left transition ${
        active
          ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40"
          : "hover:bg-border/40"
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  icon,
  idx,
  activeIdx,
  onSelect,
  children,
}: {
  label: string;
  icon: keyof typeof ICONS;
  idx: number;
  activeIdx: number | null;
  onSelect: (idx: number) => void;
  children: React.ReactNode;
}) {
  const Icon = ICONS[icon];
  const isActive = activeIdx === idx;
  return (
    <button
      type="button"
      onClick={() => onSelect(idx)}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
        isActive
          ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
          : "hover:bg-border/40"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${isActive ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground/70"}`} />
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <span className="flex-1 truncate text-muted-foreground">{children}</span>
    </button>
  );
}
