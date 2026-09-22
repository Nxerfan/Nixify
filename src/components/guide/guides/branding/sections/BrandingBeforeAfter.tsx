"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { BrandingBeforeAfterCopy } from "@/lib/guide/content/guides/branding-types";

/**
 * Before / After preview comparison — creative section.
 *
 * Side-by-side visual of the default system theme vs a customized PRO+ theme.
 * Both render real HTML via the preview API — only the Branding-tab fields
 * differ. The copy is passed in as a typed `copy` prop (resolved by the view
 * from the canonical content model). This component does NOT read locale
 * directly — `useLocale` is only used for the `dir` wrapper + arrow direction.
 *
 * Tokens (hex colors, app names, otpCard.style values) stay LTR via <Ltr>.
 *
 * NO real API calls — purely visual.
 */
export function BrandingBeforeAfter({
  copy,
}: {
  copy: BrandingBeforeAfterCopy;
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
        <PreviewCard tone="before" data={copy.before} prefersReducedMotion={prefersReducedMotion ?? false} />

        {/* Arrow column */}
        <div className="flex items-center justify-center py-2">
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <Arrow className="h-4 w-4" />
            </span>
            <span className="text-[10px] uppercase tracking-wider">
              {copy.arrowLabel}
            </span>
          </div>
        </div>

        <PreviewCard tone="after" data={copy.after} prefersReducedMotion={prefersReducedMotion ?? false} />
      </div>
    </article>
  );
}

interface PreviewCardProps {
  tone: "before" | "after";
  data: {
    badge: string;
    title: string;
    body: string;
    points: string[];
  };
  prefersReducedMotion: boolean;
}

function PreviewCard({ tone, data, prefersReducedMotion }: PreviewCardProps) {
  const isAfter = tone === "after";
  const accent = isAfter ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/40";
  const badgeCls = isAfter
    ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
    : "border-border text-muted-foreground bg-border/40";
  const headerBg = isAfter ? "#4f46e5" : "#059669";
  const primaryColor = isAfter ? "#4f46e5" : "#059669";

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
          {data.badge}
        </span>
      </div>

      <p className="mb-2 text-sm font-semibold text-foreground">{data.title}</p>
      <p className="mb-3 text-xs text-muted-foreground">{data.body}</p>

      {/* Mini email preview */}
      <div className="mb-3 overflow-hidden rounded-md border border-border/40 bg-white" dir="ltr">
        <div className="px-2 py-1.5 text-center text-[9px] font-bold text-white" style={{ backgroundColor: headerBg }}>
          {isAfter ? "Acme" : "Nixify"}
        </div>
        <div className="p-2" style={{ background: "#f8fafc" }}>
          <p className="text-[9px] font-semibold text-gray-900">Verify your email</p>
          <p className="text-[8px] text-muted-foreground/50">Use the code below to complete verification</p>
          <div
            className="mx-auto mt-1.5 rounded border px-2 py-1 text-center text-[12px] font-bold"
            style={{
              backgroundColor: "#ffffff",
              borderColor: "#e2e8f0",
              color: primaryColor,
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "4px",
            }}
          >
            <Ltr>482915</Ltr>
          </div>
          <p className="mt-1 text-center text-[7px] text-muted-foreground">
            © 2026 {isAfter ? "Acme Inc." : "Nixify"}
          </p>
        </div>
      </div>

      {/* Diff points */}
      <ul className="space-y-1.5">
        {data.points.map((point, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[9px] text-emerald-600 dark:text-emerald-400">
              <Check className="h-2 w-2" />
            </span>
            <span className="flex-1">
              <DiffToken text={point} />
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/**
 * Diff-style point — splits on `: ` and wraps the right-hand value in <Ltr>
 * since it's typically a hex color, font name, or token.
 */
function DiffToken({ text }: { text: string }) {
  const idx = text.indexOf(": ");
  if (idx === -1) return <>{text}</>;
  const left = text.slice(0, idx + 2);
  const right = text.slice(idx + 2);
  return (
    <>
      <Ltr>{left}</Ltr>
      <Ltr>{right}</Ltr>
    </>
  );
}
