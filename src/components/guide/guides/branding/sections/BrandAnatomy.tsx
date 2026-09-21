"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Palette, Type, AlignLeft, Square,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import type { BrandAnatomyCopy } from "@/lib/guide/content/guides/branding-types";

/**
 * Brand Anatomy — annotated visual of a real saved theme's ThemeConfig.
 *
 * Mirrors the data shown on /dashboard/branding — the ThemeConfig object has:
 *   - top-level color tokens: primaryColor, secondaryColor, accentColor
 *   - typography { fontFamily, fontWeight, fontSize, lineHeight }
 *   - header { title, subtitle, logoPosition, alignment, backgroundColor, textColor }
 *   - footer { companyName, copyright, supportEmail, website, socialLinks, textColor }
 *   - otpCard { ... }
 *   - background { type, value, darkValue }
 *
 * The copy is passed in as a typed `copy` prop (resolved by the view from
 * the canonical content model). This component does NOT read locale directly
 * — it renders the resolved copy. The `useLocale` call is only for the `dir`
 * wrapper.
 *
 * Each annotation points to a real field; the user hovers/taps to read
 * about it. NO real API calls — purely visual.
 */

const ICONS = {
  primary: Palette,
  secondary: Palette,
  accent: Palette,
  fontFamily: Type,
  fontWeight: Type,
  fontSize: Type,
  lineHeight: Type,
  header: AlignLeft,
  footer: AlignLeft,
  logo: Square,
  bg: Square,
} as const;

export function BrandAnatomy({ copy }: { copy: BrandAnatomyCopy }): React.ReactNode {
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  // Flatten all fields across sections so we can index by global position.
  const allFields = copy.sections.flatMap((s) => s.fields);
  const [activeIdx, setActiveIdx] = React.useState<number>(0);
  const active = allFields[activeIdx];

  return (
    <article className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-300">{copy.subheading}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Annotated ThemeConfig visual */}
        <div className="rounded-xl border border-gray-800/60 bg-gray-950/60 p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
            <Ltr>{copy.annotationsTitle}</Ltr>
          </p>
          <div className="space-y-3">
            {copy.sections.map((section, si) => {
              const sectionStartIdx = copy.sections.slice(0, si).reduce((acc, s) => acc + s.fields.length, 0);
              return (
                <div key={si}>
                  <p className="mb-1.5 text-[11px] font-semibold text-gray-200">{section.title}</p>
                  <div className="space-y-1">
                    {section.fields.map((field, fi) => {
                      const globalIdx = sectionStartIdx + fi;
                      const isActive = activeIdx === globalIdx;
                      const Icon = ICONS[field.icon] ?? Palette;
                      return (
                        <button
                          key={globalIdx}
                          type="button"
                          onClick={() => setActiveIdx(globalIdx)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                            isActive
                              ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                              : "hover:bg-gray-800/40"
                          }`}
                        >
                          <Icon
                            className={`h-3.5 w-3.5 ${isActive ? "text-emerald-300" : "text-gray-400"}`}
                          />
                          <span className="w-32 shrink-0 text-[10px] text-gray-300">
                            <Ltr>{field.field}</Ltr>
                          </span>
                          <span className="flex-1 truncate text-[10px] text-gray-200">
                            <Ltr>{field.value}</Ltr>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <motion.div
          key={activeIdx}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center gap-2">
            {(() => {
              const Icon = ICONS[active.icon] ?? Palette;
              return (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              );
            })()}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                <Ltr>{active.field}</Ltr>
              </p>
              <p className="text-sm font-semibold text-gray-100">{active.label}</p>
            </div>
          </div>
          <p className="text-xs text-gray-300">{active.desc}</p>
          <p className="mt-3 text-[10px] uppercase tracking-wider text-gray-400">
            {copy.annotationsTitle}
          </p>
          <p className="text-xs text-gray-200">
            <Ltr>{active.value}</Ltr>
          </p>
        </motion.div>
      </div>
    </article>
  );
}
