"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  UserPlus, Upload, ArrowRight, ArrowLeft, Check,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { ManualVsImportCopy } from "@/lib/guide/content/types";

/**
 * Manual Add vs Import — visual comparison section.
 *
 * Teaches when each path is appropriate, what data each creates, and what
 * the user should expect afterward. Both paths exist in the real product:
 *   - Manual Add: "Add Contact" button on /dashboard/contacts → CreateContactDialog
 *   - Import:     /dashboard/contacts/import → CSV upload + preview + confirm
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — it renders the resolved copy. The `useLocale` call here is only
 * for the `dir` wrapper and arrow direction.
 *
 * Tokens (source codes, marketing_status values) stay LTR via <Ltr>.
 */

export function ManualAddVsImport({ copy }: { copy: ManualVsImportCopy }): React.ReactNode {
  const { dir } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <article className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <PathCard
          tone="manual"
          icon={<UserPlus className="h-4 w-4" />}
          data={copy.manual}
          prefersReducedMotion={prefersReducedMotion ?? false}
          arrow={<Arrow className="h-3.5 w-3.5" />}
          sourceLabel={copy.sourceLabel}
          marketingStatusLabel={copy.marketingStatusLabel}
          sourceCode="dashboard"
        />
        <PathCard
          tone="import"
          icon={<Upload className="h-4 w-4" />}
          data={copy.import}
          prefersReducedMotion={prefersReducedMotion ?? false}
          arrow={<Arrow className="h-3.5 w-3.5" />}
          sourceLabel={copy.sourceLabel}
          marketingStatusLabel={copy.marketingStatusLabel}
          sourceCode="import"
        />
      </div>
    </article>
  );
}

interface PathCardData {
  badge: string;
  title: string;
  whenTitle: string;
  whenBody: string;
  createsTitle: string;
  creates: string[];
  afterTitle: string;
  afterBody: string;
}

function PathCard({
  tone,
  icon,
  data,
  prefersReducedMotion,
  arrow,
  sourceLabel,
  marketingStatusLabel,
  sourceCode,
}: {
  tone: "manual" | "import";
  icon: React.ReactNode;
  data: PathCardData;
  prefersReducedMotion: boolean;
  arrow: React.ReactNode;
  sourceLabel: string;
  marketingStatusLabel: string;
  sourceCode: string;
}) {
  const isImport = tone === "import";
  const accent = isImport
    ? "border-sky-500/20 bg-sky-500/5"
    : "border-emerald-500/20 bg-emerald-500/5";
  const accentText = isImport ? "text-sky-300" : "text-emerald-300";
  const accentIconBg = isImport
    ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
    : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.4 }}
      className={`rounded-xl border ${accent} p-4 sm:p-5`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${accentIconBg}`}>
          {icon}
        </span>
        <div>
          <p className={`text-[10px] font-medium uppercase tracking-wider ${accentText}`}>
            {data.badge}
          </p>
          <p className="text-sm font-semibold text-gray-100">{data.title}</p>
        </div>
      </div>

      <Block title={data.whenTitle} body={data.whenBody} />

      <div className="mt-3">
        <p className="text-xs font-semibold text-gray-200">{data.createsTitle}</p>
        <ul className="mt-1.5 space-y-1.5">
          {data.creates.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
              <span className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[9px] text-emerald-400">
                <Check className="h-2 w-2" />
              </span>
              <span>{renderTokenAware(item)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold text-gray-200">{data.afterTitle}</p>
        <p className="mt-1 text-xs text-gray-400">{data.afterBody}</p>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-500">
        <span>{sourceLabel}</span>
        {arrow}
        <Ltr className="text-gray-300">{sourceCode}</Ltr>
        <span className="mx-1">·</span>
        <span>{marketingStatusLabel}</span>
        {arrow}
        <Ltr className="text-gray-300">unknown</Ltr>
      </div>
    </motion.div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-200">{title}</p>
      <p className="mt-1 text-xs text-gray-400">{body}</p>
    </div>
  );
}

/**
 * List items embed LTR tokens like `source = Dashboard` or
 * `marketing_status = unknown`. Detect those and wrap the right-hand side
 * in <Ltr> so the token renders correctly inside RTL Persian text.
 */
function renderTokenAware(text: string): React.ReactNode {
  const eq = text.indexOf("=");
  if (eq === -1) return text;
  const left = text.slice(0, eq + 1);
  const right = text.slice(eq + 1);
  return (
    <>
      {left}
      <Ltr>{right}</Ltr>
    </>
  );
}
