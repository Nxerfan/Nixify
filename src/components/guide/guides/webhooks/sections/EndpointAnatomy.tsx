"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Tag, KeyRound, Hash,
  AlertTriangle, Plus, Eye, ShieldCheck, Send, RotateCw,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  EndpointAnatomyCopy,
  EndpointFieldCopy,
} from "@/lib/guide/content/guides/webhooks-types";

/**
 * Endpoint anatomy — the six persisted fields + the list-view vs.
 * detail-view masking matrix + the create→reveal→sign→deliver→audit cycle.
 *
 * Renders the six fields as color-coded cards (ui=sky, secret=amber,
 * storage=emerald), then renders a 6-row matrix showing what the list
 * view sees vs. what the detail view sees (the secret is "—" in BOTH —
 * it's never returned via GET), then renders the five-stage cycle as a
 * vertical timeline with tone color coding. Footnote points to
 * src/lib/dx/webhooks.ts.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read
 * locale directly — it renders the resolved copy. The `useLocale` call
 * is only for the `dir` wrapper.
 *
 * Tokens (URLs like https://api.acme.com/hooks/nixify, masked URLs like
 * https://api.acme.com/***, event codes like otp.sent, signing secrets
 * like mg_whsec_…, HMAC tokens like HMAC-SHA256(secret, `${t}.${payload}`),
 * file paths, HTTP method names) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const FIELD_TONE_CLASS: Record<EndpointFieldCopy["tone"], string> = {
  ui: "border-sky-500/40 bg-sky-500/5 text-sky-300",
  secret: "border-amber-500/40 bg-amber-500/5 text-amber-300",
  storage: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
};

const MATRIX_TONE_CLASS: Record<EndpointFieldCopy["tone"], string> = {
  ui: "border-sky-500/30 text-sky-300 bg-sky-500/5",
  secret: "border-amber-500/30 text-amber-300 bg-amber-500/5",
  storage: "border-emerald-500/30 text-emerald-300 bg-emerald-500/5",
};

const CYCLE_TONE_CLASS: Record<string, string> = {
  ui: "border-sky-500/40 bg-sky-500/5 text-sky-300",
  secret: "border-amber-500/40 bg-amber-500/5 text-amber-300",
  storage: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
  deliver: "border-violet-500/40 bg-violet-500/5 text-violet-300",
};

/** Decorative per-field icon. */
function FieldIcon({ tone }: { tone: EndpointFieldCopy["tone"] }): React.ReactElement {
  if (tone === "ui") return <Tag className="h-3 w-3" />;
  if (tone === "secret") return <KeyRound className="h-3 w-3" />;
  return <Hash className="h-3 w-3" />;
}

/** Decorative per-cycle-stage icon. */
function CycleIcon({ tone }: { tone: string }): React.ReactElement {
  if (tone === "ui") return <Plus className="h-3 w-3" />;
  if (tone === "secret") return <Eye className="h-3 w-3" />;
  if (tone === "storage") return <ShieldCheck className="h-3 w-3" />;
  if (tone === "deliver") return <Send className="h-3 w-3" />;
  return <RotateCw className="h-3 w-3" />;
}

export function EndpointAnatomy({
  copy,
}: {
  copy: EndpointAnatomyCopy;
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
        <p className="mt-1 max-w-3xl text-sm text-gray-300">{copy.subheading}</p>
      </header>

      {/* The six persisted fields */}
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.fieldsTitle}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {copy.fields.map((field, i) => (
            <motion.div
              key={field.key}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
              className={`rounded-xl border p-3 ${FIELD_TONE_CLASS[field.tone]}`}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <FieldIcon tone={field.tone} />
                <span className="text-sm font-semibold">{field.label}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-300">{field.desc}</p>
              <p className="mt-2 font-mono text-[10px] text-gray-300">
                <Ltr>{field.token}</Ltr>
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* List view vs. detail view matrix */}
      <div className="mb-6">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.matrixTitle}
        </p>
        <p className="mb-3 text-xs text-gray-300">{copy.matrixSubtitle}</p>
        <div className="overflow-hidden rounded-xl border border-gray-800/60">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/60">
              <tr className="border-b text-left text-[10px] uppercase tracking-wider text-gray-400">
                <th className="px-3 py-2 font-medium">{copy.matrixColDimension}</th>
                <th className="px-3 py-2 font-medium">{copy.matrixColListView}</th>
                <th className="px-3 py-2 font-medium">{copy.matrixColDetailView}</th>
              </tr>
            </thead>
            <tbody>
              {copy.matrixRows.map((row, i) => (
                <tr key={i} className="border-b last:border-0 border-gray-800/60">
                  <td className="px-3 py-2 text-xs text-gray-300">{row.dimension}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] ${MATRIX_TONE_CLASS[row.tone]}`}>
                      <Ltr>{row.listView}</Ltr>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] ${MATRIX_TONE_CLASS[row.tone]}`}>
                      <Ltr>{row.detailView}</Ltr>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* The create → reveal → sign → deliver → audit cycle */}
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {copy.cycleTitle}
        </p>
        <p className="mb-3 text-xs text-gray-300">{copy.cycleSubtitle}</p>
        <ol className="relative space-y-3 border-l border-gray-800/60 pl-4">
          {copy.cycle.map((step, i) => (
            <motion.li
              key={i}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
              className="relative"
            >
              {/* Node marker */}
              <span
                className={`absolute -left-[1.4rem] top-1 flex h-3 w-3 items-center justify-center rounded-full border bg-gray-950 ${
                  (CYCLE_TONE_CLASS[step.tone] ?? "").split(" ").find((c) => c.startsWith("border-"))
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    (CYCLE_TONE_CLASS[step.tone] ?? "").split(" ").find((c) => c.startsWith("bg-"))?.replace("/5", "/60")
                  }`}
                />
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-gray-400">
                  <Ltr>{step.badge}</Ltr>
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${
                    CYCLE_TONE_CLASS[step.tone] ?? "border-gray-700 bg-gray-800/40 text-gray-300"
                  }`}
                >
                  <CycleIcon tone={step.tone} />
                  {step.title}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-300">{step.body}</p>
              {step.token && (
                <p className="mt-1 rounded bg-gray-950/60 px-2 py-1 font-mono text-[10px] text-gray-300">
                  <Ltr>{step.token}</Ltr>
                </p>
              )}
            </motion.li>
          ))}
        </ol>
      </div>

      {/* Footnote */}
      <p className="mt-5 rounded-xl border border-gray-800/60 bg-gray-950/60 p-3 text-xs text-gray-300">
        {copy.footnote}
      </p>

      {/* Amber warning — the secret is shown ONCE */}
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-xs font-semibold text-amber-300">{copy.warningTitle}</p>
          <p className="mt-0.5 text-[11px] text-gray-300">{copy.warningBody}</p>
        </div>
      </div>
    </article>
  );
}
