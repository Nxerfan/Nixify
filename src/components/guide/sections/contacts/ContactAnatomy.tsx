"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Mail, Tag, User, Clock, BellRing, ListTree, Hash,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";

/**
 * Contact Anatomy — annotated visual of a real contact's information.
 *
 * Mirrors the data shown on /dashboard/contacts/[id]:
 *   - name (editable)
 *   - email (immutable, read-only)
 *   - source (read-only: API / Dashboard / OTP Verified / Import)
 *   - attributes (editable key/value pairs)
 *   - created_at / updated_at (read-only)
 *   - marketing_status + suppressed + eligible (consent state, from /consent)
 *   - timeline (recent events)
 *
 * Each annotation points to a real field; the user hovers/taps to read
 * about it. NO real API calls — purely visual.
 */

interface Annotation {
  field: string;
  label: string;
  desc: string;
  icon: "name" | "email" | "source" | "attributes" | "dates" | "consent" | "timeline" | "id";
  value: string;
}

interface Copy {
  heading: string;
  subheading: string;
  annotationsTitle: string;
  annotations: Annotation[];
  selectHint: string;
}

function useCopy(): Copy {
  const { locale } = useLocale();
  if (locale === "fa") {
    return {
      heading: "کالبدشناسی یک مخاطب",
      subheading:
        "هر مخاطب مجموعه‌ای از فیلدهای واقعی است که در صفحهٔ جزئیات دیده می‌شوند. روی هر فیلد نگه دارید تا توضیح آن را ببینید.",
      annotationsTitle: "فیلدها",
      selectHint: "برای جزئیات، روی یک فیلد کلیک کنید",
      annotations: [
        {
          field: "name",
          label: "نام",
          desc: "نمایشی اختیاری. در صفحهٔ جزئیات قابل ویرایش است. اگر خالی باشد، اولین کاراکتر ایمیل به‌عنوان آواتار استفاده می‌شود.",
          icon: "name",
          value: "Sara Ahmadi",
        },
        {
          field: "email",
          label: "ایمیل",
          desc: "نام کاربری اصلی مخاطب. فقط‌خواندنی است — پس از ایجاد قابل تغییر نیست. ایمیل‌های تراکنشی و بازاریابی به این آدرس ارسال می‌شوند.",
          icon: "email",
          value: "sara@example.com",
        },
        {
          field: "source",
          label: "منبع",
          desc: "نشان می‌دهد مخاطب چگونه ایجاد شده: API، Dashboard، OTP Verified یا Import. فقط‌خوانتنی است.",
          icon: "source",
          value: "Dashboard",
        },
        {
          field: "attributes",
          label: "ویژگی‌ها",
          desc: "جفت‌های کلید/مقدار سفارشی. در صفحهٔ جزئیات قابل ویرایش. انواع اصلی هنگام ذخیره preservation می‌شوند.",
          icon: "attributes",
          value: "plan: pro, region: emea",
        },
        {
          field: "created_at / updated_at",
          label: "زمان‌ها",
          desc: "created_at هنگام ایجاد ثبت می‌شود. updated_at با هر ویرایش یا تغییر رضایت به‌روزرسانی می‌شود. فقط‌خوانتنی.",
          icon: "dates",
          value: "2026-08-12 / 2026-09-18",
        },
        {
          field: "consent state",
          label: "وضعیت رضایت",
          desc: "marketing_status، suppressed و eligible. ازطریق کارت «رضایت و بازاریابی» در صفحهٔ جزئیات قابل مدیریت است.",
          icon: "consent",
          value: "subscribed · not suppressed · eligible",
        },
        {
          field: "timeline",
          label: "خط زمانی",
          desc: "رویدادهای اخیر مخاطب — ایجاد، به‌روزرسانی، اشتراک، لغو، عدم‌ارسال و ایمیل‌های ارسال‌شده.",
          icon: "timeline",
          value: "contact.created · contact.updated · contact.subscribed",
        },
        {
          field: "id",
          label: "شناسه",
          desc: "شناسه داخلی مخاطب. در URL صفحهٔ جزئیات ظاهر می‌شود و برای ارجاع API استفاده می‌شود.",
          icon: "id",
          value: "1",
        },
      ],
    };
  }
  return {
    heading: "Contact Anatomy",
    subheading:
      "Every contact is a set of real fields visible on the contact detail page. Hover or tap each field to learn what it means.",
    annotationsTitle: "Fields",
    selectHint: "Click a field for details",
    annotations: [
      {
        field: "name",
        label: "Name",
        desc: "Optional display name. Editable on the detail page. If empty, the first character of the email is used as the avatar.",
        icon: "name",
        value: "Sara Ahmadi",
      },
      {
        field: "email",
        label: "Email",
        desc: "The contact's primary identifier. Read-only — it cannot be changed after creation. Transactional and marketing emails are sent to this address.",
        icon: "email",
        value: "sara@example.com",
      },
      {
        field: "source",
        label: "Source",
        desc: "How the contact was created: API, Dashboard, OTP Verified, or Import. Read-only.",
        icon: "source",
        value: "Dashboard",
      },
      {
        field: "attributes",
        label: "Attributes",
        desc: "Custom key/value pairs. Editable on the detail page. Original non-string types are preserved when unchanged.",
        icon: "attributes",
        value: "plan: pro, region: emea",
      },
      {
        field: "created_at / updated_at",
        label: "Timestamps",
        desc: "created_at is set on creation. updated_at changes with each edit or consent change. Read-only.",
        icon: "dates",
        value: "2026-08-12 / 2026-09-18",
      },
      {
        field: "consent state",
        label: "Consent state",
        desc: "marketing_status, suppressed, and eligible. Managed via the Consent & Marketing card on the detail page.",
        icon: "consent",
        value: "subscribed · not suppressed · eligible",
      },
      {
        field: "timeline",
        label: "Timeline",
        desc: "Recent contact events — created, updated, subscribed, unsubscribed, suppressed, and emails sent.",
        icon: "timeline",
        value: "contact.created · contact.updated · contact.subscribed",
      },
      {
        field: "id",
        label: "ID",
        desc: "The contact's internal ID. Appears in the detail page URL and is used for API references.",
        icon: "id",
        value: "1",
      },
    ],
  };
}

const ICONS = {
  name: User,
  email: Mail,
  source: Tag,
  attributes: Hash,
  dates: Clock,
  consent: BellRing,
  timeline: ListTree,
  id: Hash,
} as const;

export function ContactAnatomy() {
  const copy = useCopy();
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();
  const [activeIdx, setActiveIdx] = React.useState<number | null>(1); // email by default

  const active = activeIdx !== null ? copy.annotations[activeIdx] : null;

  return (
    <article className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-5 sm:p-7" dir={dir}>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-gray-100 sm:text-xl">{copy.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">{copy.subheading}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Annotated visual */}
        <div className="rounded-xl border border-gray-800/60 bg-gray-950/60 p-4">
          <div className="flex items-center gap-2 border-b border-gray-800/60 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-sm font-bold text-emerald-400">
              S
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-100">
                <FieldTag active={activeIdx === 0} onClick={() => setActiveIdx(0)}>
                  {copy.annotations[0].value}
                </FieldTag>
              </p>
              <p className="text-[10px] text-gray-500">
                <Ltr>
                  <FieldTag active={activeIdx === 1} onClick={() => setActiveIdx(1)}>
                    {copy.annotations[1].value}
                  </FieldTag>
                </Ltr>
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <Row label="Source" icon="source" idx={2} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[2].value}</Ltr>
            </Row>
            <Row label="Attributes" icon="attributes" idx={3} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[3].value}</Ltr>
            </Row>
            <Row label="Timestamps" icon="dates" idx={4} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[4].value}</Ltr>
            </Row>
            <Row label="Consent" icon="consent" idx={5} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[5].value}</Ltr>
            </Row>
            <Row label="Timeline" icon="timeline" idx={6} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[6].value}</Ltr>
            </Row>
            <Row label="ID" icon="id" idx={7} activeIdx={activeIdx} onSelect={setActiveIdx}>
              <Ltr>{copy.annotations[7].value}</Ltr>
            </Row>
          </div>
        </div>

        {/* Detail panel */}
        <motion.div
          key={activeIdx ?? "empty"}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
          aria-live="polite"
        >
          {active ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                {(() => {
                  const Icon = ICONS[active.icon];
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
              <p className="text-xs text-gray-400">{active.desc}</p>
              <p className="mt-3 text-[10px] uppercase tracking-wider text-gray-500">
                {copy.annotationsTitle}
              </p>
              <p className="text-xs text-gray-200">
                <Ltr>{active.value}</Ltr>
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">{copy.selectHint}</p>
          )}
        </motion.div>
      </div>
    </article>
  );
}

function FieldTag({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded px-1 py-0.5 text-left transition ${
        active
          ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40"
          : "hover:bg-gray-800/40"
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  icon,
  idx,
  activeIdx,
  onSelect,
  children,
}: {
  label: string;
  icon: keyof typeof ICONS;
  idx: number;
  activeIdx: number | null;
  onSelect: (idx: number) => void;
  children: React.ReactNode;
}) {
  const Icon = ICONS[icon];
  const isActive = activeIdx === idx;
  return (
    <button
      type="button"
      onClick={() => onSelect(idx)}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
        isActive
          ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
          : "hover:bg-gray-800/40"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${isActive ? "text-emerald-300" : "text-gray-500"}`} />
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <span className="flex-1 truncate text-gray-300">{children}</span>
    </button>
  );
}
