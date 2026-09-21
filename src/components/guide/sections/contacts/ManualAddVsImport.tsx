"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  UserPlus, Upload, ArrowRight, ArrowLeft, Check,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";

/**
 * Manual Add vs Import — visual comparison section.
 *
 * Teaches when each path is appropriate, what data each creates, and what
 * the user should expect afterward. Both paths exist in the real product:
 *   - Manual Add: "Add Contact" button on /dashboard/contacts → CreateContactDialog
 *   - Import:     /dashboard/contacts/import → CSV upload + preview + confirm
 *
 * Localized strings are looked up via useLocale() so the same component works
 * for EN and FA without inline conditionals. Persian copy embeds LTR tokens
 * via the <Ltr> wrapper where appropriate.
 */

interface Copy {
  heading: string;
  subheading: string;
  manual: {
    badge: string;
    title: string;
    whenTitle: string;
    whenBody: string;
    createsTitle: string;
    creates: string[];
    afterTitle: string;
    afterBody: string;
  };
  import: {
    badge: string;
    title: string;
    whenTitle: string;
    whenBody: string;
    createsTitle: string;
    creates: string[];
    afterTitle: string;
    afterBody: string;
  };
}

function useCopy(): Copy {
  const { locale } = useLocale();
  if (locale === "fa") {
    return {
      heading: "افزودن دستی یا وارد کردن",
      subheading:
        "هر مسیر یک مخاطب واقعی در Nixify می‌سازد، اما موارد کاربرد، داده‌های تولیدشده و آنچه بعداً انتظار دارید متفاوت است.",
      manual: {
        badge: "دستی",
        title: "افزودن ازطریق دکمهٔ «افزودن مخاطب»",
        whenTitle: "چه زمانی مناسب است",
        whenBody:
          "هنگام افزودن یک یا چند مخاطب به‌صورت تعاملی — مثلاً تست دستی، تکمیل ثبت‌نام کاربر خاص، یا آزمایش اتوماسیون. ایمیل الزامی است، نام و ویژگی‌ها اختیاری.",
        createsTitle: "چه داده‌ای تولید می‌کند",
        creates: [
          "یک ردیف Contact با ایمیل و نام (اختیاری) و ویژگی‌ها",
          "source = Dashboard",
          "marketing_status = unknown (مشترک نیست)",
          "رویداد خط زمانی contact.created",
        ],
        afterTitle: "بعداً چه انتظاری داشته باشید",
        afterBody:
          "مخاطب بلافاصله در لیست ظاهر می‌شود. برای ارسال بازاریابی، باید در صفحهٔ جزئیات مخاطب صریحاً اشتراک بزنید — افزودن دستی اشتراک نمی‌زند.",
      },
      import: {
        badge: "وارد کردن",
        title: "افزودن ازطریق واردکنندهٔ CSV",
        whenTitle: "چه زمانی مناسب است",
        whenBody:
          "هنگام افزودن تعداد زیادی مخاطب به‌صورت یکجا از یک فایل CSV. پیش‌نمایش و اعتبارسنجی قبل از تأیید نهایی انجام می‌شود.",
        createsTitle: "چه داده‌ای تولید می‌کند",
        creates: [
          "تعدادی ردیف Contact (یکی به ازای هر ردیف معتبر CSV)",
          "source = Import",
          "marketing_status = unknown برای هر کدام",
          "رویداد خط زمانی contact.imported",
        ],
        afterTitle: "بعداً چه انتظاری داشته باشید",
        afterBody:
          "مخاطبان با همان منبع Import در لیست ظاهر می‌شوند. همانند افزودن دستی، وارد کردن مشترک نمی‌کند — اگر قصد بازاریابی دارید، باید هر یک را صریحاً اشتراک بزنید.",
      },
    };
  }
  return {
    heading: "Manual Add vs Import",
    subheading:
      "Both paths create real contacts in Nixify, but the use cases, the data they create, and what to expect afterward differ.",
    manual: {
      badge: "Manual",
      title: "Add via the \"Add Contact\" button",
      whenTitle: "When it's appropriate",
      whenBody:
        "When you're interactively adding one or a handful of contacts — for example, manual testing, completing a specific user's onboarding, or exercising an automation. Email is required; name and attributes are optional.",
      createsTitle: "What data it creates",
      creates: [
        "One Contact row with email, optional name, and attributes",
        "source = Dashboard",
        "marketing_status = unknown (not subscribed)",
        "A contact.created timeline event",
      ],
      afterTitle: "What to expect afterward",
      afterBody:
        "The contact appears in the list immediately. To send marketing, you must explicitly Subscribe them on the contact detail page — manual add does not subscribe.",
    },
    import: {
      badge: "Import",
      title: "Add via the CSV importer",
      whenTitle: "When it's appropriate",
      whenBody:
        "When you're adding many contacts at once from a CSV file. Preview and validation happen before final confirmation.",
      createsTitle: "What data it creates",
      creates: [
        "Multiple Contact rows (one per valid CSV row)",
        "source = Import",
        "marketing_status = unknown for each",
        "A contact.imported timeline event",
      ],
      afterTitle: "What to expect afterward",
      afterBody:
        "Contacts appear in the list with source = Import. As with manual add, importing does not subscribe — if you intend to market to them, you must explicitly Subscribe each one.",
    },
  };
}

export function ManualAddVsImport() {
  const copy = useCopy();
  const { dir } = useLocale();
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <article className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <PathCard
          tone="manual"
          icon={<UserPlus className="h-4 w-4" />}
          data={copy.manual}
          prefersReducedMotion={prefersReducedMotion ?? false}
          arrow={<Arrow className="h-3.5 w-3.5" />}
        />
        <PathCard
          tone="import"
          icon={<Upload className="h-4 w-4" />}
          data={copy.import}
          prefersReducedMotion={prefersReducedMotion ?? false}
          arrow={<Arrow className="h-3.5 w-3.5" />}
        />
      </div>
    </article>
  );
}

interface PathCardData {
  badge: string;
  title: string;
  whenTitle: string;
  whenBody: string;
  createsTitle: string;
  creates: string[];
  afterTitle: string;
  afterBody: string;
}

function PathCard({
  tone,
  icon,
  data,
  prefersReducedMotion,
  arrow,
}: {
  tone: "manual" | "import";
  icon: React.ReactNode;
  data: PathCardData;
  prefersReducedMotion: boolean;
  arrow: React.ReactNode;
}) {
  const isImport = tone === "import";
  const accent = isImport
    ? "border-sky-500/20 bg-sky-500/5"
    : "border-emerald-500/20 bg-emerald-500/5";
  const accentText = isImport ? "text-sky-300" : "text-emerald-300";
  const accentIconBg = isImport
    ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
    : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.4 }}
      className={`rounded-xl border ${accent} p-4 sm:p-5`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${accentIconBg}`}>
          {icon}
        </span>
        <div>
          <p className={`text-[10px] font-medium uppercase tracking-wider ${accentText}`}>
            {data.badge}
          </p>
          <p className="text-sm font-semibold text-gray-100">{data.title}</p>
        </div>
      </div>

      <Block title={data.whenTitle} body={data.whenBody} />

      <div className="mt-3">
        <p className="text-xs font-semibold text-gray-200">{data.createsTitle}</p>
        <ul className="mt-1.5 space-y-1.5">
          {data.creates.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
              <span className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[9px] text-emerald-400">
                <Check className="h-2 w-2" />
              </span>
              <span>{renderTokenAware(item)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold text-gray-200">{data.afterTitle}</p>
        <p className="mt-1 text-xs text-gray-400">{data.afterBody}</p>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-500">
        <span>source</span>
        {arrow}
        <Ltr className="text-gray-300">
          {isImport ? "import" : "dashboard"}
        </Ltr>
        <span className="mx-1">·</span>
        <span>marketing_status</span>
        {arrow}
        <Ltr className="text-gray-300">unknown</Ltr>
      </div>
    </motion.div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-200">{title}</p>
      <p className="mt-1 text-xs text-gray-400">{body}</p>
    </div>
  );
}

/**
 * A few list items embed LTR tokens like `source = Dashboard` or
 * `marketing_status = unknown`. Detect those and wrap them in <Ltr> so the
 * token renders correctly inside RTL Persian text. We're intentionally
 * conservative: only the right-hand side of an `=` is wrapped.
 */
function renderTokenAware(text: string): React.ReactNode {
  const eq = text.indexOf("=");
  if (eq === -1) return text;
  const left = text.slice(0, eq + 1);
  const right = text.slice(eq + 1);
  return (
    <>
      {left}
      <Ltr>{right}</Ltr>
    </>
  );
}
