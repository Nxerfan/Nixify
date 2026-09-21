"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles, Clock, ListChecks } from "lucide-react";
import Link from "next/link";
import { useTranslations, useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * GuideBanner — premium contextual banner placed at the END of each
 * dashboard page, inviting the user to view the full guide experience.
 *
 * NOT a floating button, pill, or badge. It's a large, elegant,
 * integrated card that feels like a natural part of the page.
 *
 * The banner is route-specific: each route has its own eyebrow,
 * headline, description, and CTA text via i18n keys.
 *
 * Usage:
 *   <GuideBanner
 *     guidePath="/guide/contacts"
 *     eyebrow="contacts"
 *     steps={5}
 *     duration={3}
 *   />
 *
 * The banner reads the headline, description, and CTA from i18n:
 *   guide.banner.{routeKey}.eyebrow
 *   guide.banner.{routeKey}.headline
 *   guide.banner.{routeKey}.description
 *   guide.banner.{routeKey}.cta
 */

interface GuideBannerProps {
  /** The guide page route, e.g. "/guide/contacts" */
  guidePath: string;
  /** Route key for i18n lookups, e.g. "contacts" */
  routeKey: string;
  /** Number of steps in the guide */
  steps?: number;
  /** Estimated duration in minutes */
  duration?: number;
}

export function GuideBanner({ guidePath, routeKey, steps, duration }: GuideBannerProps) {
  const t = useTranslations();
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  const eyebrow = t(`guide.banner.${routeKey}.eyebrow`);
  const headline = t(`guide.banner.${routeKey}.headline`);
  const description = t(`guide.banner.${routeKey}.description`);
  const cta = t(`guide.banner.${routeKey}.cta`);

  const isRTL = dir === "rtl";
  const Arrow = isRTL ? ArrowRight : ArrowRight; // ArrowLeft doesn't exist in lucide; ArrowRight is used

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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                <Sparkles className="h-3 w-3" />
                {eyebrow}
              </span>
              {steps && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <ListChecks className="h-3 w-3" />
                  {steps} {t("guide.banner.steps")}
                </span>
              )}
              {duration && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {duration} {t("guide.banner.minutes")}
                </span>
              )}
            </div>

            {/* Headline */}
            <h3 className="text-lg font-bold text-gray-100 sm:text-xl">
              {headline}
            </h3>

            {/* Description */}
            <p className="max-w-lg text-sm text-gray-400">
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
