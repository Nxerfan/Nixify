"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  UserPlus, Mail, BellRing, Send,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";

/**
 * Contact's Journey — visual lifecycle / timeline.
 *
 * Shows a realistic path a contact takes through the product, faithful to
 * the actual Nixify implementation:
 *
 *   1. created/imported  → Contact row appears in /dashboard/contacts
 *   2. inspected         → user opens the contact detail page
 *   3. consent state     → user manages marketing_status / suppression
 *   4. used downstream    → broadcasts / automations / transactional mail
 *
 * Each step is annotated with what UI surface is involved and what
 * downstream behavior changes. NO real API calls.
 */

interface StepCopy {
  badge: string;
  title: string;
  body: string;
  surface: string;
  sideEffect: string;
}

interface Copy {
  heading: string;
  subheading: string;
  steps: StepCopy[];
  legendTitle: string;
  legendItems: { label: string; tone: "ui" | "state" | "downstream" }[];
}

function useCopy(): Copy {
  const { locale } = useLocale();
  if (locale === "fa") {
    return {
      heading: "سفر یک مخاطب",
      subheading:
        "یک مسیر واقع‌گرایانه از لحظهٔ ایجاد تا استفاده در جریان‌های کاری مرتبط. هر گام به یک سطح واقعی در محصول اشاره می‌کند.",
      legendTitle: "راهنمای رنگ",
      legendItems: [
        { label: "سطح رابط کاربری", tone: "ui" },
        { label: "تغییر وضعیت", tone: "state" },
        { label: "اثر پایین‌دستی", tone: "downstream" },
      ],
      steps: [
        {
          badge: "۱. ایجاد / وارد کردن",
          title: "یک مخاطب جدید ساخته می‌شود",
          body:
            "ازطریق افزودن دستی، وارد کردن CSV، فراخوانی API یا تأیید OTP کاربر، یک ردیف Contact با marketing_status = unknown ایجاد می‌شود.",
          surface: "/dashboard/contacts",
          sideEffect: "ردیف در لیست ظاهر می‌شود و source ثبت می‌گردد.",
        },
        {
          badge: "۲. بازرسی / به‌روزرسانی",
          title: "کاربر ردیف را باز می‌کند",
          body:
            "با کلیک روی ردیف یا انتخاب «مشاهده/ویرایش» از منوی اقدامات، صفحهٔ جزئیات مخاطب باز می‌شود. نام و ویژگی‌ها قابل ویرایش هستند.",
          surface: "/dashboard/contacts/[id]",
          sideEffect: "ویژگی‌ها ذخیره می‌شوند؛ خط زمانی به‌روزرسانی می‌شود.",
        },
        {
          badge: "۳. وضعیت رضایت",
          title: "کاربر رضایت بازاریابی را مدیریت می‌کند",
          body:
            "اشتراک، لغو اشتراک، عدم ارسال دستی یا رفع عدم ارسال. هر اقدام در تاریخچهٔ ممیزی ثبت می‌شود. وارد کردن یا افزودن هرگز مشترک نمی‌زند.",
          surface: "کارت «رضایت و بازاریابی»",
          sideEffect:
            "marketing_status و suppressed تغییر می‌کند؛ eligible مجدداً محاسبه می‌شود.",
        },
        {
          badge: "۴. استفاده در جریان‌های پایین‌دستی",
          title: "مخاطب توسط سایر بخش‌های محصول خوانده می‌شود",
          body:
            "ارسال انبواه مخاطبان مشترک و غیرِ عدم‌ارسال‌شده را هدف‌گیری می‌کند. اتوماسیون‌ها بر اساس رویدادهای تماس فعال می‌شوند. ایمیل‌های تراکنشی به وضعیت بازاریابی اهمیت نمی‌دهند.",
          surface: "Broadcasts · Automations · Transactional",
          sideEffect: "ارسال بازاریابی فقط برای مخاطب eligible انجام می‌شود.",
        },
      ],
    };
  }
  return {
    heading: "A Contact's Journey",
    subheading:
      "A realistic path from creation to use in related product workflows. Each step maps to a real surface in the product.",
    legendTitle: "Legend",
    legendItems: [
      { label: "UI surface", tone: "ui" },
      { label: "State change", tone: "state" },
      { label: "Downstream effect", tone: "downstream" },
    ],
    steps: [
      {
        badge: "1. Created / Imported",
        title: "A new contact is created",
        body:
          "Via manual add, CSV import, an API call, or a user completing OTP verification, a Contact row is created with marketing_status = unknown.",
        surface: "/dashboard/contacts",
        sideEffect: "Row appears in the list; source is recorded.",
      },
      {
        badge: "2. Inspected / Updated",
        title: "User opens the contact",
        body:
          "Clicking the row (or choosing \"View/Edit\" from the actions menu) opens the contact detail page. Name and attributes are editable.",
        surface: "/dashboard/contacts/[id]",
        sideEffect: "Attributes are saved; timeline is updated.",
      },
      {
        badge: "3. Consent state",
        title: "User manages marketing consent",
        body:
          "Subscribe, Unsubscribe, Manually Suppress, or Lift Suppression. Each action is recorded in the audit history. Importing or adding never subscribes.",
        surface: "Consent & Marketing card",
        sideEffect:
          "marketing_status and suppressed change; eligible is recomputed.",
      },
      {
        badge: "4. Used by downstream workflows",
        title: "Contact is read by other product surfaces",
        body:
          "Broadcasts target subscribed, non-suppressed contacts. Automations fire on contact events. Transactional emails are not affected by marketing status.",
        surface: "Broadcasts · Automations · Transactional",
        sideEffect: "Marketing send occurs only for an eligible contact.",
      },
    ],
  };
}

const STEP_ICONS = [UserPlus, Mail, BellRing, Send];

export function ContactJourney() {
  const copy = useCopy();
  const { dir } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();

  return (
    <article className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      <ol className="relative space-y-5">
        {/* Vertical connector */}
        <span
          aria-hidden
          className={`absolute top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500/40 via-gray-700/40 to-emerald-500/40 ${
            isRTL ? "right-4" : "left-4"
          }`}
        />
        {copy.steps.map((step, i) => {
          const Icon = STEP_ICONS[i] ?? Mail;
          return (
            <motion.li
              key={i}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.35, delay: prefersReducedMotion ? 0 : i * 0.05 }}
              className={`relative flex gap-3 pl-12 sm:pl-14 ${isRTL ? "pl-0 pr-12 sm:pr-14" : ""}`}
            >
              <span
                className={`absolute top-0 flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 ${
                  isRTL ? "right-0" : "left-0"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 rounded-xl border border-gray-800/60 bg-gray-950/40 p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    {step.badge}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-gray-100">{step.title}</h4>
                <p className="mt-1 text-xs text-gray-400">{step.body}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Annotation tone="ui" label={copy.legendItems[0].label} value={step.surface} />
                  <Annotation tone="state" label={copy.legendItems[1].label} value={step.sideEffect} />
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-800/60 pt-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {copy.legendTitle}:
        </p>
        {copy.legendItems.map((item, i) => (
          <LegendChip key={i} tone={item.tone} label={item.label} />
        ))}
      </div>
    </article>
  );
}

function Annotation({
  tone,
  label,
  value,
}: {
  tone: "ui" | "state" | "downstream";
  label: string;
  value: string;
}) {
  const cls =
    tone === "ui"
      ? "border-sky-500/20 bg-sky-500/5"
      : tone === "state"
        ? "border-amber-500/20 bg-amber-500/5"
        : "border-emerald-500/20 bg-emerald-500/5";
  const dotCls =
    tone === "ui"
      ? "bg-sky-400"
      : tone === "state"
        ? "bg-amber-400"
        : "bg-emerald-400";
  return (
    <div className={`rounded-lg border ${cls} p-2.5`}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
        <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      </div>
      <p className="text-[11px] text-gray-300">
        <Ltr>{value}</Ltr>
      </p>
    </div>
  );
}

function LegendChip({ tone, label }: { tone: "ui" | "state" | "downstream"; label: string }) {
  const cls =
    tone === "ui"
      ? "border-sky-500/30 text-sky-300"
      : tone === "state"
        ? "border-amber-500/30 text-amber-300"
        : "border-emerald-500/30 text-emerald-300";
  const dotCls =
    tone === "ui" ? "bg-sky-400" : tone === "state" ? "bg-amber-400" : "bg-emerald-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border ${cls} px-2 py-0.5 text-[10px]`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {label}
    </span>
  );
}
