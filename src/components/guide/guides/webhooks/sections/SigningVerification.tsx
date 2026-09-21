"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  PenLine, ShieldCheck, ShieldAlert, AlertTriangle, Fingerprint,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type {
  SigningVerificationCopy,
  SigningHeaderCopy,
  SigningStepCopy,
} from "@/lib/guide/content/guides/webhooks-types";

/**
 * Signing & verification — the HMAC-SHA256 contract that lets the
 * receiver trust the payload.
 *
 * Renders:
 *   1. Two side-by-side cards: Sign (Nixify side, emerald) + Verify
 *      (Receiver side, sky), each with a body + bullet list.
 *   2. A three-row delivery-headers table (Nixify-Signature,
 *      Nixify-Event, Nixify-Delivery-Id), each with header name + example
 *      value + description + tone-coded chip.
 *   3. A six-step sign+verify timeline that interleaves the two sides +
 *      the two security guards (tolerance window + constant-time compare).
 *   4. Two callout cards for the security guards (5min tolerance +
 *      constant-time compare).
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read
 * locale directly — it renders the resolved copy. The `useLocale` call
 * is only for the `dir` wrapper.
 *
 * Tokens (header names like Nixify-Signature / Nixify-Event /
 * Nixify-Delivery-Id, signature values like t=1700000000,v1=4a2d…,
 * event codes like otp.verified, UUIDs, function names like
 * verifyWebhookSignature / signWebhook, file paths like
 * src/lib/dx/webhooks.ts, HMAC expressions like
 * HMAC-SHA256(secret, `${t}.${payload}`), tolerance constants like
 * 5 * 60 * 1000) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */

const HEADER_TONE_CLASS: Record<SigningHeaderCopy["tone"], string> = {
  sign: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  verify: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  id: "border-amber-500/30 bg-amber-500/5 text-amber-300",
};

const STEP_TONE_CLASS: Record<SigningStepCopy["tone"], {
  border: string;
  bg: string;
  text: string;
  dot: string;
}> = {
  sign: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  verify: {
    border: "border-sky-500/40",
    bg: "bg-sky-500/5",
    text: "text-sky-300",
    dot: "bg-sky-400",
  },
  guard: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
};

export function SigningVerification({
  copy,
}: {
  copy: SigningVerificationCopy;
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

      {/* Two side-by-side cards: Sign + Verify */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <PenLine className="h-4 w-4 text-emerald-400" />
            <span className="inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-300">
              {copy.signCard.badge}
            </span>
            <span className="text-xs text-emerald-300">{copy.signCard.title}</span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">{copy.signCard.body}</p>
          <ul className="mt-2 space-y-1">
            {copy.signCard.bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-300">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                <Ltr>{bullet}</Ltr>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : 0.08 }}
          className="rounded-xl border border-sky-500/40 bg-sky-500/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-sky-400" />
            <span className="inline-flex items-center rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[11px] text-sky-300">
              {copy.verifyCard.badge}
            </span>
            <span className="text-xs text-sky-300">{copy.verifyCard.title}</span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">{copy.verifyCard.body}</p>
          <ul className="mt-2 space-y-1">
            {copy.verifyCard.bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-300">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
                <Ltr>{bullet}</Ltr>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Delivery headers table */}
      <div className="mb-6">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {copy.headersTitle}
        </p>
        <p className="mb-3 text-xs text-gray-400">{copy.headersSubtitle}</p>
        <div className="overflow-hidden rounded-xl border border-gray-800/60">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/60">
              <tr className="border-b text-left text-[10px] uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2 font-medium">{copy.headerCol}</th>
                <th className="px-3 py-2 font-medium">{copy.valueCol}</th>
                <th className="px-3 py-2 font-medium">{copy.descCol}</th>
              </tr>
            </thead>
            <tbody>
              {copy.headers.map((h, i) => (
                <tr key={i} className="border-b border-gray-800/60 last:border-0">
                  <td className="px-3 py-2 align-top">
                    <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] ${HEADER_TONE_CLASS[h.tone]}`}>
                      <Ltr>{h.header}</Ltr>
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code dir="ltr" className="font-mono text-[10px] text-gray-300">
                      <Ltr>{h.value}</Ltr>
                    </code>
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] text-gray-400">{h.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sign + verify side-by-side timeline */}
      <div className="mb-6">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {copy.stepsTitle}
        </p>
        <ol className="relative space-y-3 border-l border-gray-800/60 pl-4">
          {copy.steps.map((step, i) => {
            const tone = STEP_TONE_CLASS[step.tone];
            return (
              <motion.li
                key={i}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
                whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.04 }}
                className="relative"
              >
                <span className="absolute -left-[1.4rem] top-3 flex h-3 w-3 items-center justify-center rounded-full border border-gray-700 bg-gray-950">
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                </span>
                <div className={`rounded-xl border ${tone.border} ${tone.bg} p-3`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-mono text-[10px] text-gray-500">
                      <Ltr>{step.badge}</Ltr>
                    </span>
                    <p className={`text-xs font-semibold ${tone.text}`}>{step.title}</p>
                  </div>
                  <p className="text-[11px] leading-relaxed text-gray-300">{step.body}</p>
                  {step.token && (
                    <p className="mt-2 rounded bg-gray-950/60 px-2 py-1 font-mono text-[10px] text-gray-300">
                      <Ltr>{step.token}</Ltr>
                    </p>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>

      {/* Two security-guard callouts */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
          className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3"
        >
          <div className="mb-1 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-semibold text-amber-300">{copy.toleranceTitle}</p>
          </div>
          <p className="text-[11px] leading-relaxed text-gray-300">{copy.toleranceBody}</p>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : 0.08 }}
          className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3"
        >
          <div className="mb-1 flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-semibold text-amber-300">{copy.constantTimeTitle}</p>
          </div>
          <p className="text-[11px] leading-relaxed text-gray-300">{copy.constantTimeBody}</p>
        </motion.div>
      </div>

      {/* Footnote */}
      <p className="rounded-xl border border-gray-800/60 bg-gray-950/60 p-3 text-xs text-gray-400">
        {copy.footnote}
      </p>

      {/* Amber warning — rotate on suspected compromise */}
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
