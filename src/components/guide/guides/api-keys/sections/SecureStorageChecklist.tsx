"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2, XCircle, RefreshCw, AlertTriangle, Lock,
  KeyRound, Database, Send, Eye,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  SecureStorageChecklistCopy,
  SecureStorageItemCopy,
} from "@/lib/guide/content/guides/api-keys-types";

/**
 * Secure storage checklist — the lifecycle of a stored key.
 *
 * Renders three groups of items: DO (emerald), AVOID (rose), and ROTATE
 * (amber). Each item is a card with a tone-coded icon + title + body +
 * optional LTR token. Footnote points to the dashboard's security-tips
 * Alert; amber warning reinforces "the dashboard cannot recover a lost
 * key".
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call is only
 * for the `dir` wrapper.
 *
 * Tokens (.env, AWS Secrets Manager, Authorization: Bearer mg_live_…, git,
 * Slack, mg_test_ ≠ mg_live_, 90 days, View usage, Revoke) stay LTR via
 * <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const TONE_BORDER: Record<SecureStorageItemCopy["tone"], string> = {
  do: "border-emerald-500/40 bg-emerald-500/5",
  avoid: "border-rose-500/40 bg-rose-500/5",
  rotate: "border-amber-500/40 bg-amber-500/5",
};

const TONE_ACCENT: Record<SecureStorageItemCopy["tone"], string> = {
  do: "text-emerald-400",
  avoid: "text-rose-400",
  rotate: "text-amber-400",
};

/** Decorative per-tone icon. */
function ToneIcon({ tone }: { tone: SecureStorageItemCopy["tone"] }): React.ReactElement {
  if (tone === "do") return <CheckCircle2 className="h-4 w-4" />;
  if (tone === "avoid") return <XCircle className="h-4 w-4" />;
  return <RefreshCw className="h-4 w-4" />;
}

/** Decorative per-key icon — picks a hint based on the item's key. */
function ItemIcon({ itemKey }: { itemKey: string }): React.ReactElement {
  if (itemKey === "secret-manager") return <Database className="h-3.5 w-3.5" />;
  if (itemKey === "bearer-header") return <Send className="h-3.5 w-3.5" />;
  if (itemKey === "least-privilege") return <Lock className="h-3.5 w-3.5" />;
  if (itemKey === "test-first") return <Eye className="h-3.5 w-3.5" />;
  if (itemKey === "git-commit") return <KeyRound className="h-3.5 w-3.5" />;
  if (itemKey === "url-param") return <Send className="h-3.5 w-3.5" />;
  if (itemKey === "chat-paste") return <KeyRound className="h-3.5 w-3.5" />;
  if (itemKey === "shared-env") return <KeyRound className="h-3.5 w-3.5" />;
  if (itemKey === "schedule") return <RefreshCw className="h-3.5 w-3.5" />;
  if (itemKey === "verify-usage") return <Eye className="h-3.5 w-3.5" />;
  if (itemKey === "immediate-revoke") return <Lock className="h-3.5 w-3.5" />;
  return <KeyRound className="h-3.5 w-3.5" />;
}

export function SecureStorageChecklist({
  copy,
}: {
  copy: SecureStorageChecklistCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  return (
    <article
      className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7"
      dir={dir}
    >
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      {/* Three groups: DO / AVOID / ROTATE */}
      <div className="space-y-6">
        {/* DO */}
        <SectionGroup
          title={copy.doTitle}
          items={copy.doItems}
          prefersReducedMotion={!!prefersReducedMotion}
        />
        {/* AVOID */}
        <SectionGroup
          title={copy.avoidTitle}
          items={copy.avoidItems}
          prefersReducedMotion={!!prefersReducedMotion}
        />
        {/* ROTATE */}
        <SectionGroup
          title={copy.rotateTitle}
          items={copy.rotateItems}
          prefersReducedMotion={!!prefersReducedMotion}
        />
      </div>

      {/* Footnote */}
      <p className="mt-5 rounded-xl border border-gray-800/60 bg-gray-950/60 p-3 text-xs text-gray-400">
        {copy.footnote}
      </p>

      {/* Amber warning — dashboard cannot recover a lost key */}
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

/* ─── Section group (DO / AVOID / ROTATE) ──────────────────────────────── */

function SectionGroup({
  title,
  items,
  prefersReducedMotion,
}: {
  title: string;
  items: SecureStorageItemCopy[];
  prefersReducedMotion: boolean;
}): React.ReactNode {
  return (
    <div>
      <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {title}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item, i) => (
          <motion.div
            key={item.key}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.05 }}
            className={`rounded-xl border p-3 ${TONE_BORDER[item.tone]}`}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className={TONE_ACCENT[item.tone]}>
                <ToneIcon tone={item.tone} />
              </span>
              <span className="text-sm font-semibold text-gray-200">{item.title}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-gray-400">{item.body}</p>
            {item.token && (
              <p className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-gray-400">
                <ItemIcon itemKey={item.key} />
                <Ltr>{item.token}</Ltr>
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
