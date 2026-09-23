"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Compass, ArrowLeft, ArrowRight } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Segment-level not-found for /guide/*.
 *
 * Triggered when a visitor lands on a guide slug that is not registered
 * (for example /guide/broadcasts before that guide ships, or
 * /guide/contacts-import before it ships).
 *
 * The fallback intentionally does NOT silently redirect to a placeholder
 * guide page. Instead it tells the user the guide isn't ready yet and
 * offers two real navigations: back to the dashboard (the product is the
 * source of truth) and back home.
 */
export default function GuideNotFound() {
  const { locale, dir } = useLocale();
  const isFa = locale === "fa";
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const title = isFa ? "این راهنما هنوز منتشر نشده است" : "This guide isn't published yet";
  const subtitle = isFa
    ? "راهنمای این بخش هنوز ساخته نشده. تا آن زمان، می‌توانید خود محصول را در داشبورد کاوش کنید."
    : "We haven't published a guide for this section yet. In the meantime, you can explore the product directly in the dashboard.";
  const backLabel = isFa ? "بازگشت به داشبورد" : "Back to dashboard";
  const homeLabel = isFa ? "بازگشت به خانه" : "Back home";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-5"
        dir={dir}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
          <Compass className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            <BackArrow className="h-4 w-4" />
            {backLabel}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm text-muted-foreground transition hover:bg-border/40"
          >
            {homeLabel}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
