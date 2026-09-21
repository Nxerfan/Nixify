"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, ListChecks, CheckCircle2, AlertTriangle, Lightbulb, Wrench, ArrowRight } from "lucide-react";
import { useTranslations, useLocale } from "@/lib/i18n/LocaleProvider";
import type { WalkthroughChapter } from "./CinematicWalkthrough";
import { CinematicWalkthrough, type SceneRenderer } from "./CinematicWalkthrough";

/**
 * GuidePageLayout — the full learning experience layout for a /guide/[section] page.
 *
 * Contains sections:
 * A. Hero / Orientation
 * B. Cinematic Product Walkthrough
 * C. Step-by-Step Written Guide
 * D. Why / When to Use This
 * E. Common Mistakes
 * F. Pro Tips / Best Practices
 * G. Troubleshooting
 * H. Quick Checklist
 * I. What Happens Next?
 * J. Related Features / Next Step
 * K. Return to Product
 *
 * Each section is optional — pass only the props that apply.
 * The layout is responsive, RTL-aware, and respects reduced-motion.
 */

interface GuideSection {
  title: string;
  body: string;
}

interface ChecklistItem {
  label: string;
  done?: boolean;
}

interface GuidePageLayoutProps {
  /** Route key for i18n lookups, e.g. "contacts" */
  routeKey: string;
  /** Dashboard route to return to, e.g. "/dashboard/contacts" */
  backHref: string;
  /** Walkthrough chapters */
  chapters: WalkthroughChapter[];
  /** Approximate step count */
  stepCount: number;
  /** Estimated duration in minutes */
  durationMin: number;
  /** Written guide sections */
  writtenSteps?: GuideSection[];
  /** Why/when sections */
  whyWhen?: GuideSection[];
  /** Common mistakes */
  mistakes?: GuideSection[];
  /** Pro tips */
  proTips?: GuideSection[];
  /** Troubleshooting entries */
  troubleshooting?: GuideSection[];
  /** Checklist items */
  checklist?: ChecklistItem[];
  /** "What happens next" text */
  whatNext?: string;
  /** Related features/links */
  related?: { label: string; href: string }[];
  /**
   * Optional route-specific scene renderer for the cinematic walkthrough.
   * When omitted, the walkthrough falls back to its generic placeholder.
   */
  renderScene?: SceneRenderer;
  /**
   * Optional route-specific creative sections rendered between the
   * written guide and the "Why / When" section. This is the slot for the
   * visually-designed, feature-specific teaching modules (lifecycle,
   * comparisons, explainers, annotated anatomy).
   */
  creativeSections?: ReactNode;
}

export function GuidePageLayout({
  routeKey,
  backHref,
  chapters,
  stepCount,
  durationMin,
  writtenSteps = [],
  whyWhen = [],
  mistakes = [],
  proTips = [],
  troubleshooting = [],
  checklist = [],
  whatNext,
  related = [],
  renderScene,
  creativeSections,
}: GuidePageLayoutProps) {
  const t = useTranslations();
  const { dir } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const eyebrow = t(`guide.banner.${routeKey}.eyebrow`);
  const headline = t(`guide.banner.${routeKey}.headline`);
  const description = t(`guide.banner.${routeKey}.description`);
  const backLabel = t(`guide.banner.${routeKey}.backToProduct`);

  // Hero entrance respects reduced motion: instant state (opacity only, no Y).
  const heroInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 20 };
  const heroAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0 };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6" dir={dir}>
      {/* A. Hero / Orientation */}
      <motion.div
        initial={heroInitial}
        animate={heroAnimate}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.5 }}
        className="mb-12 space-y-4"
      >
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-300"
        >
          <BackArrow className="h-4 w-4" />
          {backLabel}
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            {eyebrow}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <ListChecks className="h-3 w-3" />
            {stepCount} {t("guide.banner.steps")}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            {durationMin} {t("guide.banner.minutes")}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-gray-100 sm:text-4xl">{headline}</h1>
        <p className="max-w-2xl text-base text-gray-400">{description}</p>
      </motion.div>

      {/* B. Cinematic Product Walkthrough */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-bold text-gray-100">{t("guide.section.walkthrough")}</h2>
        <CinematicWalkthrough
          chapters={chapters}
          routeKey={routeKey}
          backHref={backHref}
          backLabel={backLabel}
          renderScene={renderScene}
        />
      </section>

      {/* C. Step-by-Step Written Guide */}
      {writtenSteps.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-gray-100">{t("guide.section.writtenGuide")}</h2>
          <div className="space-y-4">
            {writtenSteps.map((step, i) => (
              <div key={i} className="rounded-xl border border-gray-800/60 bg-gray-950/40 p-5">
                <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-100">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-400">
                    {i + 1}
                  </span>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-400">{step.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* C2. Route-specific creative sections (lifecycle, comparisons, explainers, anatomy) */}
      {creativeSections ? (
        <section className="mb-12 space-y-10">{creativeSections}</section>
      ) : null}

      {/* D. Why / When to Use This */}
      {whyWhen.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-gray-100">{t("guide.section.whyWhen")}</h2>
          <div className="space-y-3">
            {whyWhen.map((item, i) => (
              <div key={i} className="rounded-xl border border-gray-800/60 bg-gray-950/40 p-5">
                <h3 className="mb-2 font-semibold text-gray-200">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* E. Common Mistakes */}
      {mistakes.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-100">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            {t("guide.section.mistakes")}
          </h2>
          <div className="space-y-3">
            {mistakes.map((item, i) => (
              <div key={i} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                <h3 className="mb-2 font-semibold text-amber-200">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* F. Pro Tips */}
      {proTips.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-100">
            <Lightbulb className="h-5 w-5 text-emerald-400" />
            {t("guide.section.proTips")}
          </h2>
          <div className="space-y-3">
            {proTips.map((item, i) => (
              <div key={i} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <h3 className="mb-2 font-semibold text-emerald-200">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* G. Troubleshooting */}
      {troubleshooting.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-100">
            <Wrench className="h-5 w-5 text-gray-400" />
            {t("guide.section.troubleshooting")}
          </h2>
          <div className="space-y-3">
            {troubleshooting.map((item, i) => (
              <div key={i} className="rounded-xl border border-gray-800/60 bg-gray-950/40 p-5">
                <h3 className="mb-2 font-semibold text-gray-200">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* H. Quick Checklist */}
      {checklist.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            {t("guide.section.checklist")}
          </h2>
          <div className="rounded-xl border border-gray-800/60 bg-gray-950/40 p-5">
            <ul className="space-y-2">
              {checklist.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${item.done ? "border-emerald-500/30 bg-emerald-500/10" : "border-gray-700"}`}>
                    {item.done && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* I. What Happens Next? */}
      {whatNext && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-gray-100">{t("guide.section.whatNext")}</h2>
          <div className="rounded-xl border border-gray-800/60 bg-gray-950/40 p-5">
            <p className="text-sm leading-relaxed text-gray-400">{whatNext}</p>
          </div>
        </section>
      )}

      {/* J. Related Features */}
      {related.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-gray-100">{t("guide.section.related")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="flex items-center justify-between rounded-xl border border-gray-800/60 bg-gray-950/40 p-4 transition hover:border-emerald-500/30 hover:bg-gray-950/60"
              >
                <span className="text-sm text-gray-300">{item.label}</span>
                <ArrowRight className={`h-4 w-4 text-gray-500 ${isRTL ? "rotate-180" : ""}`} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* K. Return to Product */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <p className="mb-4 text-sm text-gray-400">{t("guide.section.readyToTry")}</p>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          {backLabel}
          <ArrowRight className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>
    </div>
  );
}
