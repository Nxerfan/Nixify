"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Users, Palette, Zap, Mail, Megaphone, ShieldOff, MailCheck,
  KeyRound, Webhook, ArrowRight, ArrowLeft, Clock, ListChecks,
  BookOpen, Compass, Sparkles, FileText,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { pickLocalized } from "@/lib/guide/content";
import type { GuideMetadata, GuideCategoryMeta } from "@/lib/guide/content/types";

/**
 * GuideLanding — the premium /guide learning hub.
 *
 * Reads the active locale from LocaleProvider and renders the page in EN or FA.
 * The guide list is passed from the server (from the registry metadata), so
 * there's a single source of truth — no diverging manual list.
 *
 * Layout:
 *   A. Hero — title, description, stats badges
 *   B. Featured guide — Contacts (the reference implementation)
 *   C. Guide library — cards for every published guide, organized by category
 *   D. Learning path — recommended sequence
 *   E. Task-oriented entry points — "What do you want to do?"
 *   F. Docs bridge — Guides vs Docs distinction
 *
 * COOKIE BANNER AVOIDANCE:
 *   The page uses pb-40 (160px bottom padding) to ensure the fixed cookie
 *   consent banner (bottom-4, z-50) never overlaps the last section's content.
 *   This is a layout-level fix — the cookie banner itself is unchanged.
 */

interface GuideLandingProps {
  guides: GuideMetadata[];
  categories: GuideCategoryMeta[];
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  audience: Users,
  messaging: Mail,
  automation: Zap,
  developer: KeyRound,
  delivery: ShieldOff,
  customization: Palette,
};

const GUIDE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  contacts: Users,
  branding: Palette,
  automations: Zap,
  templates: Mail,
  broadcasts: Megaphone,
  suppressions: ShieldOff,
  emails: MailCheck,
  "api-keys": KeyRound,
  webhooks: Webhook,
};

export function GuideLanding({ guides, categories }: GuideLandingProps): React.ReactElement {
  const { locale, dir } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const copy = useLandingCopy(locale);
  const publishedGuides = guides.filter((g) => g.published);
  const totalSteps = publishedGuides.reduce((sum, g) => sum + g.stepCount, 0);
  const totalMinutes = publishedGuides.reduce((sum, g) => sum + g.durationMin, 0);
  const featured = publishedGuides.find((g) => g.slug === "contacts") ?? publishedGuides[0];

  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-48 pt-28 sm:px-6" dir={dir}>
      {/* Background decorative orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-40 -top-20 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -right-40 top-40 h-96 w-96 rounded-full bg-sky-500/3 blur-3xl" />
      </div>
      {/* A. Hero */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.5 }}
        className="mb-12 space-y-5"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Compass className="h-3 w-3" />
            {copy.eyebrow}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-gray-100 sm:text-4xl lg:text-5xl">
          {copy.headline}
        </h1>
        <p className="max-w-2xl text-base text-gray-300 sm:text-lg">{copy.description}</p>
        {/* Stats badges */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800/60 bg-gray-950/40 px-3 py-1.5 text-sm text-gray-300">
            <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
            {publishedGuides.length} {copy.guidesLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800/60 bg-gray-950/40 px-3 py-1.5 text-sm text-gray-300">
            <ListChecks className="h-3.5 w-3.5 text-emerald-400" />
            {totalSteps} {copy.stepsLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800/60 bg-gray-950/40 px-3 py-1.5 text-sm text-gray-300">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            ~{totalMinutes} {copy.minutesLabel}
          </span>
        </div>
      </motion.div>

      {/* B. Featured guide */}
      {featured && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.5, delay: prefersReducedMotion ? 0 : 0.1 }}
          className="mb-10"
        >
          <Link
            href={`/guide/${featured.slug}`}
            className="group relative block overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-gray-950/40 to-gray-950/60 p-6 transition-all hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5 sm:p-8"
          >
            {/* Decorative gradient orb */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl transition-opacity group-hover:opacity-75" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-medium uppercase tracking-wider text-emerald-300">
                    {copy.startHere}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-100 sm:text-3xl">{localizeTitle(featured, locale)}</h2>
                <p className="max-w-xl text-sm text-gray-400 sm:text-base">{localizeDescription(featured, locale)}</p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <ListChecks className="h-3 w-3" />
                    {featured.stepCount} {copy.stepsLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {featured.durationMin} {copy.minutesLabel}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-all group-hover:bg-emerald-500 group-hover:shadow-lg group-hover:shadow-emerald-500/20">
                  {copy.viewGuide}
                  <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* C. Guide library by category */}
      <section className="mb-10">
        <h2 className="mb-6 text-xl font-bold text-gray-100 sm:text-2xl">{copy.libraryTitle}</h2>
        <div className="space-y-6">
          {categories.map((cat) => {
            const catGuides = publishedGuides.filter((g) => g.category === cat.id);
            if (catGuides.length === 0) return null;
            const CatIcon = CATEGORY_ICONS[cat.id] ?? BookOpen;
            return (
              <div key={cat.id}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <CatIcon className="h-4 w-4" />
                  </span>
                  <h3 className="text-lg font-semibold text-gray-100">{localizeCategoryLabel(cat, locale)}</h3>
                  <span className="text-xs text-gray-400">({catGuides.length})</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {catGuides.map((guide, i) => (
                    <GuideCard
                      key={guide.slug}
                      guide={guide}
                      locale={locale}
                      copy={copy}
                      prefersReducedMotion={prefersReducedMotion ?? false}
                      delay={i * 0.05}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* D. Learning path */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-gray-100 sm:text-2xl">{copy.learningPathTitle}</h2>
        <div className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            {copy.learningPath.map((step, i) => {
              const guide = publishedGuides.find((g) => g.slug === step.slug);
              if (!guide) return null;
              const Icon = GUIDE_ICONS[guide.slug] ?? BookOpen;
              return (
                <React.Fragment key={step.slug}>
                  <Link
                    href={`/guide/${guide.slug}`}
                    className="group flex items-center gap-3 rounded-xl border border-gray-700/60 bg-gray-950/60 px-4 py-3 transition hover:border-emerald-500/30 hover:bg-gray-900/40"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{localizeTitle(guide, locale)}</p>
                      <p className="text-[10px] text-gray-400">{step.reason}</p>
                    </div>
                  </Link>
                  {i < copy.learningPath.length - 1 && (
                    <Arrow className="h-4 w-4 shrink-0 text-gray-600" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </section>

      {/* E. Task-oriented entry points */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-gray-100 sm:text-2xl">{copy.taskTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {copy.tasks.map((task, i) => (
            <Link
              key={i}
              href={`/guide/${task.slug}`}
              className="group flex items-center gap-3 rounded-xl border border-gray-800/60 bg-gray-950/40 p-4 transition hover:border-emerald-500/30 hover:bg-gray-950/60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                {(() => {
                  const Icon = GUIDE_ICONS[task.slug] ?? BookOpen;
                  return <Icon className="h-4 w-4" />;
                })()}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200">{task.label}</p>
                <p className="text-[10px] text-gray-400">{localizeTitle(publishedGuides.find((g) => g.slug === task.slug)!, locale)}</p>
              </div>
              <Arrow className="h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>

      {/* F. Docs bridge */}
      <section className="mb-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <BookOpen className="mb-2 h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-gray-100">{copy.guidesBridgeTitle}</h3>
            <p className="mt-1 text-xs text-gray-400">{copy.guidesBridgeDesc}</p>
          </div>
          <Link
            href="/docs"
            className="group rounded-xl border border-gray-800/60 bg-gray-950/40 p-5 transition hover:border-emerald-500/30 hover:bg-gray-950/60"
          >
            <FileText className="mb-2 h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-100">{copy.docsBridgeTitle}</h3>
            <p className="mt-1 text-xs text-gray-400">{copy.docsBridgeDesc}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400">
              {copy.openDocs}
              <Arrow className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ─── Guide card ─────────────────────────────────────────────────────────── */

function GuideCard({
  guide,
  locale,
  copy,
  prefersReducedMotion,
  delay,
}: {
  guide: GuideMetadata;
  locale: "en" | "fa";
  copy: LandingCopy;
  prefersReducedMotion: boolean;
  delay: number;
}) {
  const Icon = GUIDE_ICONS[guide.slug] ?? BookOpen;
  const isRTL = locale === "fa";
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, delay: prefersReducedMotion ? 0 : delay }}
    >
      <Link
        href={`/guide/${guide.slug}`}
        className="group flex h-full flex-col rounded-xl border border-gray-800/60 bg-gray-950/40 p-5 transition-all hover:border-emerald-500/30 hover:bg-gray-950/60 hover:shadow-lg hover:shadow-black/20"
      >
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 transition-colors group-hover:bg-emerald-500/20">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-gray-100">{localizeTitle(guide, locale)}</h3>
        </div>
        <p className="mb-4 flex-1 text-xs leading-relaxed text-gray-400">{localizeDescription(guide, locale)}</p>
        <div className="flex items-center gap-3 border-t border-gray-800/40 pt-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            {guide.stepCount} {copy.stepsLabel}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {guide.durationMin} {copy.minutesLabel}
          </span>
          <span className="ml-auto flex items-center gap-0.5 text-emerald-400/0 transition-colors group-hover:text-emerald-400">
            <Arrow className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Localization helpers ──────────────────────────────────────────────── */

function localizeTitle(guide: GuideMetadata, locale: "en" | "fa"): string {
  return pickLocalized(guide.title, locale);
}

function localizeDescription(guide: GuideMetadata, locale: "en" | "fa"): string {
  return pickLocalized(guide.description, locale);
}

function localizeCategoryLabel(cat: GuideCategoryMeta, locale: "en" | "fa"): string {
  return pickLocalized(cat.label, locale);
}

/* ─── Landing copy ───────────────────────────────────────────────────────── */

interface LandingCopy {
  eyebrow: string;
  headline: string;
  description: string;
  guidesLabel: string;
  stepsLabel: string;
  minutesLabel: string;
  startHere: string;
  viewGuide: string;
  libraryTitle: string;
  learningPathTitle: string;
  learningPath: { slug: string; reason: string }[];
  taskTitle: string;
  tasks: { slug: string; label: string }[];
  guidesBridgeTitle: string;
  guidesBridgeDesc: string;
  docsBridgeTitle: string;
  docsBridgeDesc: string;
  openDocs: string;
}

function useLandingCopy(locale: "en" | "fa"): LandingCopy {
  if (locale === "fa") {
    return {
      eyebrow: "مرکز یادگیری",
      headline: "Nixify را بصری یاد بگیرید",
      description:
        "راهنماهای گام‌به‌گام و تعاملی برای هر بخش از Nixify. رابط کاربری واقعی را ببینید، مفاهیم را درک کنید، و با اعتماد به نفس کار کنید.",
      guidesLabel: "راهنما",
      stepsLabel: "گام",
      minutesLabel: "دقیقه",
      startHere: "از اینجا شروع کنید",
      viewGuide: "مشاهده راهنما",
      libraryTitle: "کتابخانه راهنما",
      learningPathTitle: "مسیر یادگیری پیشنهادی",
      learningPath: [
        { slug: "contacts", reason: "مخاطبان را بشناسید" },
        { slug: "templates", reason: "قالب ایمیل بسازید" },
        { slug: "broadcasts", reason: "ارسال انبوه کنید" },
      ],
      taskTitle: "می‌خواهید چه کاری انجام دهید؟",
      tasks: [
        { slug: "broadcasts", label: "به افراد زیادی ایمیل بزنم" },
        { slug: "contacts", label: "مخاطبان را مدیریت کنم" },
        { slug: "templates", label: "طرح ایمیل قابل‌استفاده مجدد بسازم" },
        { slug: "api-keys", label: "Nixify را به اپم وصل کنم" },
        { slug: "suppressions", label: "گیرندگان مسدودشده را درک کنم" },
        { slug: "webhooks", label: "رویدادها را در زمان واقعی دریافت کنم" },
      ],
      guidesBridgeTitle: "راهنماها",
      guidesBridgeDesc: "یادگیری جریان‌های کاری — رابط کاربری را ببینید، مفاهیم را درک کنید، قدم‌به‌قدم تمرین کنید.",
      docsBridgeTitle: "مستندات",
      docsBridgeDesc: "مرجع فنی عمیق — نقاط انتهایی API، احراز هویت، وب‌هوک‌ها، محدودوده‌های نرخ، و کدهای خطا.",
      openDocs: "باز کردن مستندات",
    };
  }
  return {
    eyebrow: "Learning Hub",
    headline: "Learn Nixify visually",
    description:
      "Step-by-step interactive guides for every part of Nixify. See the real UI, understand the concepts, and work with confidence.",
    guidesLabel: "guides",
    stepsLabel: "steps",
    minutesLabel: "min",
    startHere: "Start here",
    viewGuide: "View guide",
    libraryTitle: "Guide library",
    learningPathTitle: "Recommended learning path",
    learningPath: [
      { slug: "contacts", reason: "Understand your contacts" },
      { slug: "templates", reason: "Build email templates" },
      { slug: "broadcasts", reason: "Send a campaign" },
    ],
    taskTitle: "What do you want to do?",
    tasks: [
      { slug: "broadcasts", label: "Send to many people" },
      { slug: "contacts", label: "Manage contacts" },
      { slug: "templates", label: "Create reusable email designs" },
      { slug: "api-keys", label: "Connect Nixify to my app" },
      { slug: "suppressions", label: "Understand blocked recipients" },
      { slug: "webhooks", label: "Receive real-time events" },
    ],
    guidesBridgeTitle: "Guides",
    guidesBridgeDesc: "Learn workflows — see the UI, understand concepts, practice step by step.",
    docsBridgeTitle: "Docs",
    docsBridgeDesc: "Deep technical reference — API endpoints, authentication, webhooks, rate limits, and error codes.",
    openDocs: "Open docs",
  };
}
