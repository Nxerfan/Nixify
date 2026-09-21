"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BellRing, BellOff, ShieldAlert, ShieldOff, Check, X, HelpCircle,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";

/**
 * Marketing / Consent Status Explainer.
 *
 * Uses the ACTUAL current consent model from src/lib/consent/service.ts and
 * src/app/dashboard/contacts/[id]/page.tsx:
 *
 *   marketing_status   ∈ { unknown, subscribed, unsubscribed }
 *   suppressed         ∈ { true, false }   (separate from marketing_status)
 *   eligible           = (marketing_status === "subscribed") AND !suppressed
 *
 * Manual operations on the contact detail page:
 *   Subscribe            → POST /api/dashboard/contacts/:id/subscribe
 *   Unsubscribe          → POST /api/dashboard/contacts/:id/unsubscribe
 *                          (also adds to suppression list)
 *   Manually Suppress    → POST /api/dashboard/suppressions
 *                          (also unsubscribes)
 *   Lift Suppression      → POST /api/dashboard/suppressions/:suppressionId
 *                          (does NOT subscribe — explicit follow-up required)
 *
 * The interactive matrix below shows each (marketing_status, suppressed)
 * combination and the resulting `eligible` flag.
 */

interface Copy {
  heading: string;
  subheading: string;
  columns: {
    label: string;
    value: string;
    desc: string;
  }[];
  matrixTitle: string;
  matrixSubtitle: string;
  marketingCol: string;
  suppressedCol: string;
  eligibleCol: string;
  eligibleYes: string;
  eligibleNo: string;
  actionsTitle: string;
  actions: {
    icon: "subscribe" | "unsubscribe" | "suppress" | "lift";
    label: string;
    desc: string;
    also: string;
  }[];
  importNote: string;
}

function useCopy(): Copy {
  const { locale } = useLocale();
  if (locale === "fa") {
    return {
      heading: "وضعیت بازاریابی و رضایت",
      subheading:
        "مدل واقعی رضایت Nixify سه مفهوم جداگانه دارد: marketing_status، suppressed و eligible. ترکیب آن‌ها تعیین می‌کند آیا مخاطب می‌تواند ایمیل بازاریابی دریافت کند یا نه.",
      columns: [
        {
          label: "marketing_status",
          value: "unknown | subscribed | unsubscribed",
          desc: "وضعیت صریح رضایت بازاریابی. وارد کردن یا افزودن مخاطب آن را unknown می‌گذارد.",
        },
        {
          label: "suppressed",
          value: "true | false",
          desc: "اینکه آیا ایمیل در فهرست عدم‌ارسال است. مستقل از marketing_status.",
        },
        {
          label: "eligible",
          value: "marketing_status = subscribed AND NOT suppressed",
          desc: "پرچم محاسبه‌شده — ارسال بازاریابی فقط برای eligible انجام می‌شود.",
        },
      ],
      matrixTitle: "جدول ترکیب‌ها",
      matrixSubtitle: "هر ترکیب از marketing_status و suppressed نتیجهٔ eligible مشخصی دارد.",
      marketingCol: "marketing_status",
      suppressedCol: "suppressed",
      eligibleCol: "eligible",
      eligibleYes: "بله",
      eligibleNo: "خیر",
      actionsTitle: "عملیات صریح رضایت",
      actions: [
        {
          icon: "subscribe",
          label: "Subscribe",
          desc: "marketing_status را به subscribed تنظیم می‌کند و هر عدم‌ارسال فعلی را برمی‌دارد.",
          also: "نتیجه: eligible می‌شود (مگر اینکه دوباره عدم‌ارسال شود).",
        },
        {
          icon: "unsubscribe",
          label: "Unsubscribe",
          desc: "marketing_status را به unsubscribed تنظیم می‌کند و ایمیل را به فهرست عدم‌ارسال اضافه می‌کند.",
          also: "نتیجه: eligible نمی‌شود.",
        },
        {
          icon: "suppress",
          label: "Manually Suppress",
          desc: "ایمیل را با دلیل «manual» به فهرست عدم‌ارسال اضافه می‌کند و مخاطب را لغو اشتراک می‌کند.",
          also: "نتیجه: eligible نمی‌شود.",
        },
        {
          icon: "lift",
          label: "Lift Suppression",
          desc: "فقط ورودی عدم‌ارسال را غیرفعال می‌کند. اشتراک نمی‌زند — باید صریحاً Subscribe کنید.",
          also: "نتیجه: marketing_status بدون تغییر. اگر از قبل unsubscribed بود، هنوز eligible نیست.",
        },
      ],
      importNote:
        "وارد کردن یا افزودن یک مخاطب هرگز او را مشترک نمی‌کند. marketing_status شروع unknown است؛ برای بازاریابی باید صریحاً Subscribe کنید.",
    };
  }
  return {
    heading: "Marketing & Consent Status",
    subheading:
      "Nixify's real consent model has three separate concepts: marketing_status, suppressed, and eligible. Their combination determines whether a contact can receive marketing email.",
    columns: [
      {
        label: "marketing_status",
        value: "unknown | subscribed | unsubscribed",
        desc: "The explicit marketing consent state. Importing or adding a contact leaves this unknown.",
      },
      {
        label: "suppressed",
        value: "true | false",
        desc: "Whether the email is on the suppression list. Separate from marketing_status.",
      },
      {
        label: "eligible",
        value: "marketing_status = subscribed AND NOT suppressed",
        desc: "The computed flag — marketing sends occur only for eligible contacts.",
      },
    ],
    matrixTitle: "Combination matrix",
    matrixSubtitle:
      "Each combination of marketing_status and suppressed yields a specific eligible outcome.",
    marketingCol: "marketing_status",
    suppressedCol: "suppressed",
    eligibleCol: "eligible",
    eligibleYes: "Yes",
    eligibleNo: "No",
    actionsTitle: "Explicit consent actions",
    actions: [
      {
        icon: "subscribe",
        label: "Subscribe",
        desc: "Sets marketing_status to subscribed and lifts any active suppression.",
        also: "Result: becomes eligible (unless suppressed again later).",
      },
      {
        icon: "unsubscribe",
        label: "Unsubscribe",
        desc: "Sets marketing_status to unsubscribed and adds the email to the suppression list.",
        also: "Result: not eligible.",
      },
      {
        icon: "suppress",
        label: "Manually Suppress",
        desc: "Adds the email to the suppression list with reason “manual” and unsubscribes the contact.",
        also: "Result: not eligible.",
      },
      {
        icon: "lift",
        label: "Lift Suppression",
        desc: "Deactivates the suppression entry only. Does NOT subscribe — you must explicitly Subscribe.",
        also: "Result: marketing_status unchanged. If previously unsubscribed, still not eligible.",
      },
    ],
    importNote:
      "Importing or adding a contact never subscribes them. marketing_status starts unknown; to market to them you must explicitly Subscribe.",
  };
}

const ICONS = {
  subscribe: BellRing,
  unsubscribe: BellOff,
  suppress: ShieldAlert,
  lift: ShieldOff,
} as const;

type IconKey = keyof typeof ICONS;

const MATRIX: { status: string; suppressed: boolean; eligible: boolean }[] = [
  { status: "subscribed", suppressed: false, eligible: true },
  { status: "subscribed", suppressed: true, eligible: false },
  { status: "unsubscribed", suppressed: false, eligible: false },
  { status: "unsubscribed", suppressed: true, eligible: false },
  { status: "unknown", suppressed: false, eligible: false },
  { status: "unknown", suppressed: true, eligible: false },
];

export function ConsentExplainer() {
  const copy = useCopy();
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();

  return (
    <article className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      {/* Three concept cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {copy.columns.map((col, i) => (
          <motion.div
            key={i}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, delay: prefersReducedMotion ? 0 : i * 0.05 }}
            className="rounded-xl border border-gray-800/60 bg-gray-950/40 p-4"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300">
              <Ltr>{col.label}</Ltr>
            </p>
            <p className="mt-1 text-xs font-medium text-gray-100">
              <Ltr>{col.value}</Ltr>
            </p>
            <p className="mt-1.5 text-xs text-gray-400">{col.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Combination matrix */}
      <div className="mb-6 overflow-hidden rounded-xl border border-gray-800/60">
        <div className="border-b border-gray-800/60 bg-gray-900/40 px-4 py-2">
          <p className="text-xs font-semibold text-gray-200">{copy.matrixTitle}</p>
          <p className="text-[10px] text-gray-500">{copy.matrixSubtitle}</p>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-gray-900/30">
            <tr className="border-b border-gray-800/60 text-left text-gray-400">
              <th className="px-3 py-2 font-medium">{copy.marketingCol}</th>
              <th className="px-3 py-2 font-medium">{copy.suppressedCol}</th>
              <th className="px-3 py-2 font-medium text-right">{copy.eligibleCol}</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row, i) => (
              <tr key={i} className="border-b border-gray-800/40 last:border-0">
                <td className="px-3 py-2 text-gray-200">
                  <Ltr>{row.status}</Ltr>
                </td>
                <td className="px-3 py-2 text-gray-300">
                  <Ltr>{String(row.suppressed)}</Ltr>
                </td>
                <td className="px-3 py-2 text-right">
                  {row.eligible ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      <Check className="h-3 w-3" />
                      {copy.eligibleYes}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                      <X className="h-3 w-3" />
                      {copy.eligibleNo}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Explicit actions */}
      <div>
        <p className="mb-2 text-xs font-semibold text-gray-200">{copy.actionsTitle}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {copy.actions.map((action, i) => {
            const Icon = ICONS[action.icon as IconKey];
            const toneCls =
              action.icon === "subscribe"
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                : action.icon === "lift"
                  ? "border-sky-500/20 bg-sky-500/5 text-sky-300"
                  : "border-rose-500/20 bg-rose-500/5 text-rose-300";
            return (
              <motion.div
                key={i}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, delay: prefersReducedMotion ? 0 : i * 0.04 }}
                className={`rounded-xl border ${toneCls} p-3`}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <p className="text-xs font-semibold text-gray-100">
                    <Ltr>{action.label}</Ltr>
                  </p>
                </div>
                <p className="text-xs text-gray-400">{action.desc}</p>
                <p className="mt-1 text-[10px] text-gray-500">{action.also}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Import note */}
      <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-200/80">{copy.importNote}</p>
      </div>
    </article>
  );
}
