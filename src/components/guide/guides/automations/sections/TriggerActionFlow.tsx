"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowLeft, Zap, Mail, MailCheck } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { TriggerActionFlowCopy } from "@/lib/guide/content/guides/automations-types";

/**
 * Trigger → Action flow — creative section.
 *
 * A visual diagram of the Welcome Email automation's single trigger wired
 * to a single action. There's no rule builder — the trigger is fixed (OTP
 * verified) and the action is fixed (send welcome email). The user only
 * controls on/off + which template.
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale
 * directly — `useLocale` is only for the `dir` wrapper + arrow direction.
 *
 * Tokens (event names like otp.verified, action keys like
 * send.welcome_email, API endpoints) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */
export function TriggerActionFlow({
  copy,
}: {
  copy: TriggerActionFlowCopy;
}): React.ReactNode {
  const { dir } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <article className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-300">{copy.subheading}</p>
      </header>

      <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr]">
        {/* Trigger card */}
        <FlowCard
          tone="trigger"
          badge={copy.trigger.badge}
          title={copy.trigger.title}
          body={copy.trigger.body}
          icon={Zap}
          token={copy.trigger.event}
          prefersReducedMotion={prefersReducedMotion ?? false}
        />

        {/* Arrow column */}
        <div className="flex items-center justify-center py-2">
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <motion.span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              animate={
                prefersReducedMotion
                  ? {}
                  : { x: isRTL ? [-3, 3, -3] : [3, -3, 3] }
              }
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Arrow className="h-4 w-4" />
            </motion.span>
            <span className="text-[10px] uppercase tracking-wider">
              {copy.arrowLabel}
            </span>
          </div>
        </div>

        {/* Action card */}
        <FlowCard
          tone="action"
          badge={copy.action.badge}
          title={copy.action.title}
          body={copy.action.body}
          icon={MailCheck}
          token={copy.action.action}
          prefersReducedMotion={prefersReducedMotion ?? false}
        />
      </div>

      {/* Caption + endpoint */}
      <div className="mt-5 flex flex-col items-start gap-2 border-t border-gray-800/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-300">{copy.caption}</p>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-300">
          <Mail className="h-3 w-3" />
          <Ltr>{copy.endpointHint}</Ltr>
        </span>
      </div>
    </article>
  );
}

interface FlowCardProps {
  tone: "trigger" | "action";
  badge: string;
  title: string;
  body: string;
  icon: typeof Zap;
  token: string;
  prefersReducedMotion: boolean;
}

function FlowCard({ tone, badge, title, body, icon: Icon, token, prefersReducedMotion }: FlowCardProps) {
  const isTrigger = tone === "trigger";
  const accent = isTrigger
    ? "border-amber-500/30 bg-amber-500/5"
    : "border-emerald-500/30 bg-emerald-500/5";
  const badgeCls = isTrigger
    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  const iconCls = isTrigger
    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.4 }}
      className={`rounded-xl border ${accent} p-4`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium ${badgeCls}`}>
          {badge}
        </span>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${iconCls}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <p className="mb-2 text-sm font-semibold text-gray-100">{title}</p>
      <p className="mb-3 text-xs text-gray-300">{body}</p>

      <p className="text-[10px] uppercase tracking-wider text-gray-400">
        {isTrigger ? "event" : "action"}
      </p>
      <p className="mt-0.5 inline-flex items-center gap-1.5 rounded-md border border-gray-700/60 bg-gray-900/60 px-2 py-0.5 text-[11px] text-gray-200">
        <Ltr className="font-mono">{token}</Ltr>
      </p>
    </motion.div>
  );
}
