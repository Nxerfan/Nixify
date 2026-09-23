import type { Metadata } from "next";
import Link from "next/link";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import {
  ShieldCheck, Lock, KeyRound, Gauge, Webhook, Send,
  CheckCircle2, AlertCircle, Server, Clock, Hash, BookOpen, RefreshCw,
} from "lucide-react";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import { LOCALE_HTML_DIR } from "@/lib/i18n/locales";
import { Ltr } from "@/lib/i18n/Ltr";
import { PRODUCTION_ORIGIN, absoluteUrl } from "@/lib/site/site-url";

/**
 * Public /email-otp-api landing page (server component).
 *
 * Documents the three-endpoint Nixify v1 OTP API: send → verify → resend.
 * The page is locale-aware (EN/FA) via the shared server locale resolver.
 * Technical tokens (endpoint paths, header names, JSON keys, code samples)
 * remain LTR even on the RTL Persian page; only natural-language copy is
 * translated through `isFa` conditionals. No drifting FA implementation.
 *
 * What this page is NOT: an SDK announcement, an SLA, a fake-customer count,
 * a review/rating surface, or a latency guarantee. Every claim maps to a real
 * endpoint or library symbol in the codebase.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const isFa = locale === "fa";

  const title = isFa ? "ایمیل OTP API" : "Email OTP API";
  const description = isFa
    ? "APIهای Nixify برای صدور، تأیید و ارسال مجدد کدهای یک‌بارمصرف ایمیل: سه اندپوینت send، verify و resend با هش HMAC-SHA256، محدودسازی نرخ و وب‌هوک‌های امضادار."
    : "Issue, verify, and resend one-time-password codes over email through three HTTP endpoints — send, verify, resend — with HMAC-SHA256 hashing, per-email and per-IP rate limits, brute-force lockout, and signed webhook deliveries.";

  return {
    title,
    description,
    alternates: {
      canonical: "/email-otp-api",
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl("/email-otp-api"),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function EmailOtpApiPage() {
  const locale = await resolveServerLocale();
  const isFa = locale === "fa";
  const dir = LOCALE_HTML_DIR[locale];

  const t = {
    heroTitle: isFa ? "ایمیل OTP API" : "Email OTP API",
    heroSubtitle: isFa
      ? "سه اندپوینت HTTP — send، verify و resend — برای صدور، تأیید و ارسال مجدد کدهای یک‌بارمصرف روی ایمیل. هش HMAC-SHA256، محدودسازی نرخ per-email و per-IP، قفل در برابر حملات brute-force، و وب‌هوک‌های امضادار."
      : "Three HTTP endpoints — send, verify, resend — for issuing, verifying, and re-issuing one-time-password codes over email. HMAC-SHA256 hashing, per-email and per-IP rate limits, brute-force lockout, and signed webhook deliveries.",
    howItWorks: isFa ? "نحوه کار" : "How it works",
    howItWorksText: isFa
      ? "چرخه‌ی کامل: کد را صادر می‌کنید و به ایمیل تحویل می‌دهید، سپس کد ۶ رقمی که کاربر وارد کرده با /verify بررسی می‌شود. اگر کاربر کد را دریافت نکرد، با /resend کد جدیدی صادر می‌شود."
      : "The full lifecycle: you issue a code and deliver it to the user's inbox, then the 6-digit code the user enters is checked with /verify. If the user did not receive the first code, /resend issues a fresh one.",
    endpoints: isFa ? "اندپوینت‌ها" : "Endpoints",
    request: isFa ? "بدنه‌ی درخواست" : "Request body",
    response: isFa ? "بدنه‌ی پاسخ" : "Response body",
    possibleErrors: isFa ? "خطاهای ممکن" : "Possible errors",
    otpProperties: isFa ? "ویژگی‌های کد OTP" : "OTP properties",
    rateLimits: isFa ? "محدودیت‌های نرخ" : "Rate limits",
    rateLimitsNote: isFa
      ? "این مقادیر پیش‌فرض‌های امنیتی برنامه هستند. پیکربندی استقرار می‌تواند این مقادیر را بازنویسی کند، بنابراین تا زمانی که محیط تولید تأیید نشده باشد، نباید آن‌ها را محدودیت‌های تغییرناپذیر در نظر گرفت."
      : "These are the application's default limits. Deployment configuration can override these values, so they should not be treated as immutable production limits unless the production environment is verified.",
    testVsLive: isFa ? "کلیدهای test و live" : "Test vs Live keys",
    sandboxHeader: isFa ? "هدر X-Sandbox-Simulate" : "X-Sandbox-Simulate header",
    webhooks: isFa ? "وب‌هوک‌ها" : "Webhooks",
    codeExamples: isFa ? "نمونه‌های کد" : "Code examples",
    architecture: isFa ? "معماری" : "Architecture",
    requestIds: isFa ? "شناسه‌های درخواست" : "Request IDs",
    latency: isFa ? "Latency و قابلیت اطمینان" : "Latency & reliability",
    crossLinks: isFa ? "پیوندهای مرتبط" : "Related links",
  } as const;

  return (
    <>
      <AmbientBackground />
      <div
        className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6"
        dir={dir}
      >
        {/* Hero */}
        <header>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground sm:text-4xl">
            <Send className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            {t.heroTitle}
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            {t.heroSubtitle}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground/70">
            <span className="rounded-full border border-border bg-card/60 px-3 py-1">
              <Ltr>v1</Ltr>
            </span>
            <span className="rounded-full border border-border bg-card/60 px-3 py-1">
              <Ltr>POST /api/v1/otp/send</Ltr>
            </span>
            <span className="rounded-full border border-border bg-card/60 px-3 py-1">
              <Ltr>POST /api/v1/otp/verify</Ltr>
            </span>
            <span className="rounded-full border border-border bg-card/60 px-3 py-1">
              <Ltr>POST /api/v1/otp/resend</Ltr>
            </span>
          </div>
        </header>

        {/* How it works */}
        <section className="mt-12 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Send className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.howItWorks}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{t.howItWorksText}</p>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-gray-900">1</span>
              <span>
                <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">POST /api/v1/otp/send</Ltr>
                {" — "}
                {isFa
                  ? "کد ۶ رقمی جدیدی صادر شده و از طریق انتقال ایمیل پیکربندی‌شده تحویل داده می‌شود. پاسخ شامل expires_at و otp_request_id است."
                  : "issues a fresh 6-digit code and delivers it via the configured mail transport. The response includes expires_at and otp_request_id."}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-gray-900">2</span>
              <span>
                <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">POST /api/v1/otp/verify</Ltr>
                {" — "}
                {isFa
                  ? "کد واردشده توسط کاربر بررسی می‌شود. در صورت موفقیت، کد atomically به‌عنوان مصرف‌شده علامت‌گذاری می‌شود و otp.verified fire می‌گردد."
                  : "validates the code the user entered. On success, the code is atomically marked as consumed and otp.verified is fired."}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-gray-900">3</span>
              <span>
                <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">POST /api/v1/otp/resend</Ltr>
                {" — "}
                {isFa
                  ? "اگر کاربر کد اول را دریافت نکرد، یک کد جدید صادر می‌کند. همان محدودیت‌های نرخ و قفل /send اعمال می‌شود."
                  : "issues a fresh code if the user did not receive the first one. Shares the same rate limits and lockout rules as /send."}
              </span>
            </li>
          </ol>
        </section>

        {/* Endpoints */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Server className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.endpoints}
          </h2>

          {/* /otp/send */}
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">POST</span>
              <Ltr className="font-mono text-sm text-foreground">/api/v1/otp/send</Ltr>
            </div>
            <p className="text-sm text-muted-foreground">
              {isFa
                ? "صدور و تحویل یک کد OTP جدید برای ایمیل داده‌شده."
                : "Issue + deliver a new OTP code for the given email."}
            </p>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">{t.request}</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "نوع" : "Type"}</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "توضیح" : "Description"}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-3 py-2"><Ltr className="font-mono text-foreground">email</Ltr> <span className="text-rose-400">*</span></td>
                    <td className="px-3 py-2 text-muted-foreground/70"><Ltr>string</Ltr></td>
                    <td className="px-3 py-2 text-muted-foreground/70">{isFa ? "آدرس ایمیل RFC 5322 (نرمال‌سازی می‌شود)" : "RFC 5322 email (lowercased, trimmed)"}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><Ltr className="font-mono text-foreground">purpose</Ltr></td>
                    <td className="px-3 py-2 text-muted-foreground/70"><Ltr>enum</Ltr></td>
                    <td className="px-3 py-2 text-muted-foreground/70"><Ltr>signup | login | reset</Ltr> {isFa ? "(پیش‌فرض: signup)" : "(default: signup)"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">{t.response}</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "توضیح" : "Description"}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">otp_request_id</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "شناسه‌ی همبستگی OTP (برای همبستگی وب‌هوک)" : "OTP correlation ID (webhook correlation)"}</td></tr>
                  <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">request_id</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "شناسه‌ی ردیابی API (همسان با X-Request-Id)" : "API trace ID (matches X-Request-Id header)"}</td></tr>
                  <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">expires_at</Ltr></td><td className="px-3 py-2 text-muted-foreground/70"><Ltr>ISO 8601</Ltr> — {isFa ? "TTL ده دقیقه‌ای" : "10-minute TTL"}</td></tr>
                  <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">message</Ltr></td><td className="px-3 py-2 text-muted-foreground/70"><Ltr>"OTP sent"</Ltr></td></tr>
                  <tr><td className="px-3 py-2"><Ltr className="font-mono text-foreground">code</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "فقط در sandbox (mg_test_): کد ۶ رقمی plaintext. برای mg_live_ هرگز وجود ندارد." : "Sandbox only (mg_test_): the plaintext 6-digit OTP. Never present for mg_live_."}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground/70">{t.possibleErrors}:</span>
              {["validation_failed", "rate_limited", "locked", "ip_blocked", "internal_error"].map((e) => (
                <Ltr key={e} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{e}</Ltr>
              ))}
            </div>
          </div>

          <div className="my-6 border-t border-border" />

          {/* /otp/verify */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">POST</span>
              <Ltr className="font-mono text-sm text-foreground">/api/v1/otp/verify</Ltr>
            </div>
            <p className="text-sm text-muted-foreground">
              {isFa
                ? "کد ۶ رقمی واردشده توسط کاربر را اعتبارسنجی می‌کند. در صورت موفقیت، کد به‌صورت atomic به‌عنوان مصرف‌شده علامت‌گذاری می‌شود."
                : "Validates the 6-digit code the user entered. On success, the code is atomically marked as consumed."}
            </p>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">{t.request}</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "نوع" : "Type"}</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "توضیح" : "Description"}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">email</Ltr> <span className="text-rose-400">*</span></td><td className="px-3 py-2 text-muted-foreground/70"><Ltr>string</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "همان ایمیل به‌کاررفته در /send" : "Same email used in /send"}</td></tr>
                  <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">code</Ltr> <span className="text-rose-400">*</span></td><td className="px-3 py-2 text-muted-foreground/70"><Ltr>string</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "دقیقاً ۶ رقم عددی" : "Exactly 6 numeric digits"}</td></tr>
                  <tr><td className="px-3 py-2"><Ltr className="font-mono text-foreground">purpose</Ltr></td><td className="px-3 py-2 text-muted-foreground/70"><Ltr>enum</Ltr></td><td className="px-3 py-2 text-muted-foreground/70"><Ltr>signup | login | reset</Ltr> {isFa ? "(پیش‌فرض: signup)" : "(default: signup)"}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">{t.response}</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "توضیح" : "Description"}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">verified</Ltr></td><td className="px-3 py-2 text-muted-foreground/70"><Ltr>boolean</Ltr> — {isFa ? "true هنگام موفقیت" : "true on success"}</td></tr>
                  <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">otp_request_id</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "شناسه‌ی همبستگی OTP ردیف مصرف‌شده" : "OTP correlation ID of the consumed attempt"}</td></tr>
                  <tr><td className="px-3 py-2"><Ltr className="font-mono text-foreground">request_id</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "شناسه‌ی ردیابی API" : "API trace ID (matches X-Request-Id)"}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground/70">{t.possibleErrors}:</span>
              {["validation_failed", "code_mismatch", "expired", "already_used", "locked", "not_found", "rate_limited", "ip_blocked", "internal_error"].map((e) => (
                <Ltr key={e} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{e}</Ltr>
              ))}
            </div>
          </div>

          <div className="my-6 border-t border-border" />

          {/* /otp/resend */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">POST</span>
              <Ltr className="font-mono text-sm text-foreground">/api/v1/otp/resend</Ltr>
            </div>
            <p className="text-sm text-muted-foreground">
              {isFa
                ? "کد جدیدی صادر می‌کند اگر کاربر کد اول را دریافت نکرده باشد. همان محدودیت‌های نرخ و قفل /send را به اشتراک می‌گذارد."
                : "Issues a fresh code if the user did not receive the first one. Shares /send rate limits and lockout."}
            </p>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">{t.request}</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "نوع" : "Type"}</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "توضیح" : "Description"}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">email</Ltr> <span className="text-rose-400">*</span></td><td className="px-3 py-2 text-muted-foreground/70"><Ltr>string</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "ایمیل هدف" : "Target email"}</td></tr>
                  <tr><td className="px-3 py-2"><Ltr className="font-mono text-foreground">purpose</Ltr></td><td className="px-3 py-2 text-muted-foreground/70"><Ltr>enum</Ltr></td><td className="px-3 py-2 text-muted-foreground/70"><Ltr>signup | login | reset</Ltr> {isFa ? "(پیش‌فرض: signup)" : "(default: signup)"}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground/70">{t.possibleErrors}:</span>
              {["validation_failed", "rate_limited", "locked", "ip_blocked", "internal_error"].map((e) => (
                <Ltr key={e} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{e}</Ltr>
              ))}
            </div>
          </div>
        </section>

        {/* OTP properties */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.otpProperties}
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><Hash className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><strong className="text-foreground">{isFa ? "۶ رقم ASCII" : "6 ASCII digits"}</strong> {isFa ? "تولیدشده با" : "generated with"} <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">crypto.randomInt</Ltr> {isFa ? "(حافظه‌ی رمزنگاری‌شده)" : "(cryptographic entropy)"}.</span></li>
            <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><strong className="text-foreground">{isFa ? "TTL ده دقیقه‌ای" : "10-minute TTL"}</strong> — {isFa ? "کد پس از ۱۰ دقیقه منقضی می‌شود." : "codes expire after 10 minutes."}</span></li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><strong className="text-foreground">{isFa ? "حداکثر ۵ تلاش" : "Maximum 5 attempts"}</strong> {isFa ? "بر هر کد پیش از قفل شدن." : "per code before lockout."}</span></li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><strong className="text-foreground">{isFa ? "یک‌بارمصرف" : "Single-use"}</strong> — {isFa ? "یک کد تأییدشده نمی‌تواند دوباره استفاده شود." : "a verified code cannot be reused."}</span></li>
            <li className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><strong className="text-foreground">HMAC-SHA256</strong> {isFa ? "هش با pepper سمت سرور (" : "hashed with a server-side pepper ("}<Ltr className="font-mono text-emerald-700 dark:text-emerald-300">OTP_PEPPER</Ltr>{isFa ? ") پیش از ذخیره." : ") before storage."}</span></li>
            <li className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><strong className="text-foreground">{isFa ? "plaintext هرگز ذخیره نمی‌شود" : "Plaintext never persisted"}</strong> — {isFa ? "فقط هش در پایگاه‌داده نگهداری می‌شود. کد plaintext تنها در پاسخ کلیدهای mg_test_ بازمی‌گردد." : "only the hash is stored. The plaintext code is returned only in mg_test_ responses."}</span></li>
          </ul>
        </section>

        {/* Rate limits */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Gauge className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.rateLimits}
          </h2>
          <p className="mt-3 text-xs text-muted-foreground/70">{t.rateLimitsNote}</p>
          <div className="mt-3 max-h-96 overflow-y-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 sticky top-0">
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "دامنه" : "Scope"}</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "محدودیت" : "Limit"}</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "پنجره" : "Window"}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border"><td className="px-3 py-2 text-muted-foreground"><Ltr>Per email — /send</Ltr></td><td className="px-3 py-2 text-muted-foreground">3</td><td className="px-3 py-2 text-muted-foreground">{isFa ? "۱ دقیقه" : "1 minute"}</td></tr>
                <tr className="border-b border-border"><td className="px-3 py-2 text-muted-foreground"><Ltr>Per email — /send</Ltr></td><td className="px-3 py-2 text-muted-foreground">10</td><td className="px-3 py-2 text-muted-foreground">{isFa ? "۱ ساعت" : "1 hour"}</td></tr>
                <tr className="border-b border-border"><td className="px-3 py-2 text-muted-foreground"><Ltr>Per email — /verify</Ltr></td><td className="px-3 py-2 text-muted-foreground">5</td><td className="px-3 py-2 text-muted-foreground">{isFa ? "۱ دقیقه" : "1 minute"}</td></tr>
                <tr className="border-b border-border"><td className="px-3 py-2 text-muted-foreground"><Ltr>Per IP — /send</Ltr></td><td className="px-3 py-2 text-muted-foreground">10 / 60</td><td className="px-3 py-2 text-muted-foreground">{isFa ? "۱ دق / ۱ ساعت" : "1 min / 1 hr"}</td></tr>
                <tr><td className="px-3 py-2 text-muted-foreground"><Ltr>Per IP — /verify</Ltr></td><td className="px-3 py-2 text-muted-foreground">30 / 120</td><td className="px-3 py-2 text-muted-foreground">{isFa ? "۱ دق / ۱ ساعت" : "1 min / 1 hr"}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground/70">
            {isFa
              ? "کلیدهای mg_test_ محدودکننده‌ی per-email برای /send و /resend را دور می‌زنند تا CI سریع اجرا شود. /verify همچنان ۵/min را اعمال می‌کند. محدودیت‌های per-IP برای همه‌ی کلیدها اعمال می‌شوند."
              : "mg_test_ keys skip the per-email limiter for /send and /resend so CI can run fast. /verify still enforces 5/min. Per-IP limits apply to all keys."}
          </p>
        </section>

        {/* Test vs Live keys */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.testVsLive}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300"><Ltr>test</Ltr></span>
              <div className="mt-2 font-mono text-xs text-muted-foreground"><Ltr>mg_test_…</Ltr></div>
              <p className="mt-2 text-xs text-muted-foreground/80">
                {isFa
                  ? "توسعه و CI. حالت sandbox به‌صورت خودکار فعال می‌شود: کد OTP تولید و ذخیره می‌شود اما ایمیل واقعی ارسال نمی‌شود؛ کد plaintext در پاسخ بازمی‌گردد. محدودکننده‌ی per-email برای /send و /resend دور زده می‌شود؛ /verify همچنان ۵/min را اعمال می‌کند."
                  : "Development & CI. Sandbox mode is automatic: the OTP is generated and persisted but no real email is sent; the plaintext code is returned in the response. The per-email limiter is skipped for /send and /resend; /verify still enforces 5/min."}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300"><Ltr>live</Ltr></span>
              <div className="mt-2 font-mono text-xs text-muted-foreground"><Ltr>mg_live_…</Ltr></div>
              <p className="mt-2 text-xs text-muted-foreground/80">
                {isFa
                  ? "فقط تولید. Nixify ایمیل واقعی را از طریق زیرساخت تحویل مدیریت‌شده ارسال می‌کند. تمام محدودیت‌های نرخ و سهمیه اعمال می‌شوند. sandbox در دسترس نیست."
                  : "Production only. Nixify sends real email through its managed delivery infrastructure. All rate limits and quotas are enforced. Sandbox is not available."}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {t.sandboxHeader}
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              {isFa
                ? "فقط برای کلیدهای mg_test_. یک سناریوی خطای شبیه‌سازی‌شده را اجبار می‌کند بدون این که واقعاً کاری انجام شود:"
                : "mg_test_ keys only. Forces a simulated error scenario without performing real work:"}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-muted-foreground/80"><Ltr>/send</Ltr> &amp; <Ltr>/resend</Ltr></div>
                <ul className="mt-1 space-y-1">
                  <li className="text-xs text-muted-foreground/70">• <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">rate_limited</Ltr> → <Ltr>429</Ltr></li>
                  <li className="text-xs text-muted-foreground/70">• <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">locked</Ltr> → <Ltr>423</Ltr></li>
                  <li className="text-xs text-muted-foreground/70">• <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">smtp_error</Ltr> → <Ltr>500</Ltr></li>
                </ul>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground/80"><Ltr>/verify</Ltr></div>
                <ul className="mt-1 space-y-1">
                  <li className="text-xs text-muted-foreground/70">• <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">mismatch</Ltr> → <Ltr>400 code_mismatch</Ltr></li>
                  <li className="text-xs text-muted-foreground/70">• <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">expired</Ltr> → <Ltr>410</Ltr></li>
                  <li className="text-xs text-muted-foreground/70">• <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">locked</Ltr> → <Ltr>423</Ltr></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Webhooks */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Webhook className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.webhooks}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isFa
              ? "هر تحویل با HMAC-SHA256 از طریق هدر Nixify-Signature امضا می‌شود. پنجره‌ی replay ۵ دقیقه‌ای؛ URLها برای SSRF اعتبارسنجی می‌شوند."
              : "Each delivery is signed with HMAC-SHA256 via the Nixify-Signature header. 5-minute replay tolerance; destination URLs are SSRF-validated."}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><Send className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><Ltr className="font-mono text-emerald-700 dark:text-emerald-300">otp.sent</Ltr> — {isFa ? "کد صادر و تحویل داده شد." : "code was generated and delivered."}</span></li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><Ltr className="font-mono text-emerald-700 dark:text-emerald-300">otp.verified</Ltr> — {isFa ? "کاربر با موفقیت تأیید شد." : "user successfully verified."}</span></li>
            <li className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><Ltr className="font-mono text-emerald-700 dark:text-emerald-300">otp.failed</Ltr> — {isFa ? "تأیید ناموفق (کد اشتباه)." : "verification failed (wrong code)."}</span></li>
            <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><Ltr className="font-mono text-emerald-700 dark:text-emerald-300">otp.expired</Ltr> — {isFa ? "TTL ده دقیقه‌ای بدون تأیید سپری شد." : "10-minute TTL elapsed without verification."}</span></li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/docs#webhooks" className="text-emerald-600 dark:text-emerald-400 hover:underline">
              {isFa ? "مستندات وب‌هوک" : "Webhook docs"} →
            </Link>
            <Link href="/guide/webhooks" className="text-emerald-600 dark:text-emerald-400 hover:underline">
              {isFa ? "راهنمای وب‌هوک" : "Webhook guide"} →
            </Link>
          </div>
        </section>

        {/* Architecture + Code examples */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Server className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.architecture}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isFa
              ? "برنامه‌ی شما Nixify را از route handlerهای سمت سرور فراخوانی می‌کند. کلاینت شما هرگز مستقیماً Nixify را صدا نمی‌زند — کلید API هرگز نباید در کد سمت کلاینت افشا شود."
              : "Your app calls Nixify from server-side route handlers. Your client never talks to Nixify directly — your API key must never be exposed in client-side code."}
          </p>
          <pre dir="ltr" className="mt-3 overflow-auto rounded border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
{`Browser / Mobile App  ──▶  Your backend  ──▶  ${PRODUCTION_ORIGIN}/api/v1/otp/send
                              (route handler)    (Authorization: Bearer mg_live_…)
                              ──▶  ${PRODUCTION_ORIGIN}/api/v1/otp/verify`}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground/70">
            {isFa
              ? "کلید API را در یک متغیر محیطی نگه دارید و هرگز آن را به کلاینت بازنگردانید."
              : "Store your API key in an environment variable and never return it to the client."}
          </p>
        </section>

        {/* Code examples — Node.js, Python, PHP */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.codeExamples}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isFa
              ? "هر نمونه send و verify را با پارامتر purpose نشان می‌دهد. این الگو در Node.js، Python و PHP یکسان است."
              : "Each example shows send + verify with the purpose parameter. The pattern is identical in Node.js, Python, and PHP."}
          </p>

          {/* Node.js */}
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-foreground">Node.js <span className="text-muted-foreground/60">(fetch)</span></h3>
            <pre dir="ltr" className="mt-2 overflow-auto rounded border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
{`// Server-side route handler — store the key in an env var.
const NIXIFY_API = "${PRODUCTION_ORIGIN}/api/v1";
const NIXIFY_KEY = process.env.NIXIFY_API_KEY; // mg_live_... in production

// 1. Send a code
const sendRes = await fetch(\`\${NIXIFY_API}/otp/send\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${NIXIFY_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email: "user@example.com", purpose: "signup" }),
});
const sendJson = await sendRes.json();
// sendJson.otp_request_id  -> OTP correlation ID (do NOT send back to /verify)
// sendJson.request_id      -> API trace ID (matches X-Request-Id header)
// sendJson.expires_at      -> ISO 8601, 10-minute TTL

// 2. Verify the code the user entered
const verifyRes = await fetch(\`\${NIXIFY_API}/otp/verify\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${NIXIFY_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "user@example.com",
    code: "123456",
    purpose: "signup",
  }),
});
const verifyJson = await verifyRes.json();
// verifyJson.verified === true  -> email ownership confirmed`}
            </pre>
          </div>

          {/* Python */}
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-foreground">Python <span className="text-muted-foreground/60">(requests)</span></h3>
            <pre dir="ltr" className="mt-2 overflow-auto rounded border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
{`import os
import requests

NIXIFY_API = "${PRODUCTION_ORIGIN}/api/v1"
NIXIFY_KEY = os.environ["NIXIFY_API_KEY"]  # mg_live_... in production
headers = {
    "Authorization": f"Bearer {NIXIFY_KEY}",
    "Content-Type": "application/json",
}

# 1. Send a code
send = requests.post(
    f"{NIXIFY_API}/otp/send",
    headers=headers,
    json={"email": "user@example.com", "purpose": "signup"},
)
send_json = send.json()
# send_json["otp_request_id"]  -> OTP correlation ID (do NOT send back)
# send_json["request_id"]      -> API trace ID
# send_json["expires_at"]      -> ISO 8601, 10-minute TTL

# 2. Verify the code the user entered
verify = requests.post(
    f"{NIXIFY_API}/otp/verify",
    headers=headers,
    json={
        "email": "user@example.com",
        "code": "123456",
        "purpose": "signup",
    },
)
verify_json = verify.json()
# verify_json["verified"] is True  -> email ownership confirmed`}
            </pre>
          </div>

          {/* PHP */}
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-foreground">PHP <span className="text-muted-foreground/60">(cURL)</span></h3>
            <pre dir="ltr" className="mt-2 overflow-auto rounded border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
{`<?php
// Server-side — keep the key in an env var, never expose to the client.
$nixify_api = "${PRODUCTION_ORIGIN}/api/v1";
$nixify_key = getenv("NIXIFY_API_KEY"); // mg_live_... in production

// 1. Send a code
$ch = curl_init("{$nixify_api}/otp/send");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer {$nixify_key}",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "email" => "user@example.com",
        "purpose" => "signup",
    ]),
]);
$send_json = json_decode(curl_exec($ch), true);
curl_close($ch);
// $send_json["otp_request_id"]  -> OTP correlation ID (do NOT send back)
// $send_json["request_id"]      -> API trace ID
// $send_json["expires_at"]      -> ISO 8601, 10-minute TTL

// 2. Verify the code the user entered
$ch = curl_init("{$nixify_api}/otp/verify");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer {$nixify_key}",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "email" => "user@example.com",
        "code" => "123456",
        "purpose" => "signup",
    ]),
]);
$verify_json = json_decode(curl_exec($ch), true);
curl_close($ch);
// $verify_json["verified"] === true  -> email ownership confirmed`}
            </pre>
          </div>
        </section>

        {/* Request IDs */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Hash className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.requestIds}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isFa
              ? "دو شناسه‌ی متفاوت در پاسخ برمی‌گردند:"
              : "Two distinct IDs are returned in the response:"}
          </p>
          <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Ltr className="font-mono text-emerald-700 dark:text-emerald-300 shrink-0">request_id</Ltr>
              <span>
                {isFa
                  ? "— شناسه‌ی ردیابی API. با هدر X-Request-Id همسان است و برای پشتیبانی استفاده می‌شود."
                  : "— the API trace ID. Matches the X-Request-Id header and is used for support."}
              </span>
            </li>
            <li className="flex gap-2">
              <Ltr className="font-mono text-emerald-700 dark:text-emerald-300 shrink-0">otp_request_id</Ltr>
              <span>
                {isFa
                  ? "— شناسه‌ی همبستگی OTP. در رویدادهای وب‌هوک (به‌عنوان requestId) برمی‌گردد تا بتوانید یک تأیید را به کد صادرشده ربط دهید."
                  : "— the OTP correlation ID. Appears in webhook events (as requestId) so you can correlate a verification with the issued code."}
              </span>
            </li>
          </ul>
          <p className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            {isFa
              ? "کلاینت‌ها هیچ‌کدام از این شناسه‌ها را به /verify بازنمی‌گردانند. تأیید با email + code + purpose انجام می‌شود."
              : "Clients do NOT send either ID back to /verify. Verification is performed by email + code + purpose."}
          </p>
        </section>

        {/* Latency & reliability */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Gauge className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.latency}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isFa
              ? "Nixify در حال حاضر SLA تثبیت‌شده‌ای برای latency منتشر نمی‌کند. میانگین اخیر latency درخواست API به‌صورت عمومی در صفحه‌ی Status موجود است و از تله‌متری برنامه استخراج می‌شود."
              : "Nixify does not currently publish a fixed latency SLA. Recent average API request latency is available on the public Status page and is derived from application telemetry."}
          </p>
          <div className="mt-3">
            <Link href="/status" className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
              {isFa ? "مشاهده‌ی صفحه‌ی Status" : "View the Status page"} →
            </Link>
          </div>
        </section>

        {/* Cross-links */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.crossLinks}
          </h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li><Link href="/docs" className="text-emerald-600 dark:text-emerald-400 hover:underline">{isFa ? "مستندات API کامل" : "Full API documentation"} →</Link></li>
            <li><Link href="/email-verification-api" className="text-emerald-600 dark:text-emerald-400 hover:underline">{isFa ? "ایمیل Verification API" : "Email Verification API"} →</Link></li>
            <li><Link href="/pricing" className="text-emerald-600 dark:text-emerald-400 hover:underline">{isFa ? "طرح‌ها و سهمیه‌ها" : "Plans and quotas"} →</Link></li>
            <li><Link href="/security" className="text-emerald-600 dark:text-emerald-400 hover:underline">{isFa ? "کنترل‌های امنیتی" : "Security controls"} →</Link></li>
            <li><Link href="/examples" className="text-emerald-600 dark:text-emerald-400 hover:underline">{isFa ? "نمونه‌های یکپارچه‌سازی Next.js" : "Next.js integration examples"} →</Link></li>
          </ul>
        </section>
      </div>
    </>
  );
}
