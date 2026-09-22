"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles, Clock, ListChecks } from "lucide-react";
import Link from "next/link";
import { useTranslations, useLocale } from "@/lib/i18n/LocaleProvider";
import { getGuideMetadata, pickLocalized } from "@/lib/guide/content";

/**
 * GuideBanner — premium contextual banner placed at the END of each
 * dashboard page, inviting the user to view the full guide experience.
 *
 * NOT a floating button, pill, or badge. It's a large, elegant,
 * integrated card that feels like a natural part of the page.
 *
 * CANONICAL METADATA SOURCE:
 *   The banner accepts ONLY `guideSlug`. It resolves the guide path,
 *   step count, duration, and localized title/description from the
 *   canonical guide registry. Dashboard pages do NOT pass steps/duration
 *   props — there is no duplicate hardcoded metadata.
 *
 * The banner still reads the eyebrow/headline/CTA from the shared i18n
 * dictionary (guide.banner.{routeKey}.*), but the step count, duration,
 * and the localized title/description shown on the landing page come from
 * the registry metadata.
 *
 * Usage:
 *   <GuideBanner guideSlug="contacts" />
 *
 * The banner reads the headline, description, and CTA from i18n:
 *   guide.banner.{routeKey}.eyebrow
 *   guide.banner.{routeKey}.headline
 *   guide.banner.{routeKey}.description
 *   guide.banner.{routeKey}.cta
 */

interface GuideBannerProps {
  /** The guide slug, e.g. "contacts". Used to resolve all metadata. */
  guideSlug: string;
}

export function GuideBanner({ guideSlug }: GuideBannerProps) {
  const t = useTranslations();
  const { dir, locale } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  // Resolve canonical metadata from the registry.
  const metadata = getGuideMetadata(guideSlug);

  // Derive the guide path, route key, steps, and duration from the metadata.
  const guidePath = metadata ? `/guide/${metadata.slug}` : `/guide/${guideSlug}`;
  const routeKey = metadata?.routeKey ?? guideSlug;
  const steps = metadata?.stepCount;
  const duration = metadata?.durationMin;

  // The eyebrow/headline/description/CTA come from the shared i18n dictionary
  // so they stay in sync with the existing translation workflow.
  const eyebrow = t(`guide.banner.${routeKey}.eyebrow`);
  const headline = t(`guide.banner.${routeKey}.headline`);
  const description = t(`guide.banner.${routeKey}.description`);
  const cta = t(`guide.banner.${routeKey}.cta`);

  const isRTL = dir === "rtl";
  const Arrow = ArrowRight;

  // Respect prefers-reduced-motion: skip the entrance Y movement; use an
  // instant fade (no transform). This matches the CinematicWalkthrough's
  // reduced-motion contract.
  const bannerInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 20 };
  const bannerAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0 };

  return (
    <motion.div
      initial={bannerInitial}
      whileInView={bannerAnimate}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mt-12"
    >
      <Link
        href={guidePath}
        className="group block overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-gray-950/40 to-gray-950/60 p-6 transition-all hover:border-emerald-500/30 hover:from-emerald-500/10 sm:p-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: text content */}
          <div className="flex-1 space-y-2" dir={dir}>
            {/* Eyebrow */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <Sparkles className="h-3 w-3" />
                {eyebrow}
              </span>
              {steps && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                  <ListChecks className="h-3 w-3" />
                  {steps} {t("guide.banner.steps")}
                </span>
              )}
              {duration && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                  <Clock className="h-3 w-3" />
                  {duration} {t("guide.banner.minutes")}
                </span>
              )}
            </div>

            {/* Headline */}
            <h3 className="text-lg font-bold text-foreground sm:text-xl">
              {headline}
            </h3>

            {/* Description */}
            <p className="max-w-lg text-sm text-muted-foreground">
              {description}
            </p>
          </div>

          {/* Right: CTA */}
          <div className="flex shrink-0 items-center">
            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-all group-hover:bg-emerald-500 group-hover:shadow-lg group-hover:shadow-emerald-500/20">
              {cta}
              <Arrow className={`h-4 w-4 transition-transform ${isRTL ? "rotate-180" : ""} group-hover:translate-x-0.5`} />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
