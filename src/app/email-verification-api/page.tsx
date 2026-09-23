import type { Metadata } from "next";
import Link from "next/link";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import {
  ShieldCheck, Lock, KeyRound, Gauge, Webhook, Send,
  CheckCircle2, AlertCircle, Clock, Hash, BookOpen, RefreshCw, UserCheck,
} from "lucide-react";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import { LOCALE_HTML_DIR } from "@/lib/i18n/locales";
import { Ltr } from "@/lib/i18n/Ltr";
import { PRODUCTION_ORIGIN, absoluteUrl } from "@/lib/site/site-url";

/**
 * Public /email-verification-api landing page (server component).
 *
 * DISTINCT from /email-otp-api: this page focuses on email ownership
 * verification (signup, login, password-reset flows). It does NOT duplicate
 * the OTP-API endpoint reference — it instead emphasizes the verification
 * state machine, brute-force lockout semantics (anchored to OTP creation,
 * NOT the 5th attempt), the difference between `expired` and `locked`, the
 * resulting emailVerified=true flag and session establishment, and the
 * verify-specific error catalog.
 *
 * Locale-aware (EN/FA) via the shared server locale resolver. Technical
 * tokens stay LTR even on the RTL Persian page; only natural-language copy
 * is translated through `isFa` conditionals — no drifting FA implementation.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const isFa = locale === "fa";

  const title = isFa ? "ایمیل Verification API" : "Email Verification API";
  const description = isFa
    ? "تأیید مالکیت ایمیل با چرخه‌ی send → verify برای اهداف signup، login و reset. حفاظت در برابر brute-force (۵ تلاش سپس قفل)، قفل ۱۵ دقیقه‌ای متصل به زمان صدور OTP، و رویدادهای وب‌هوک otp.sent و otp.verified و otp.failed و otp.expired."
    : "Verify email ownership through a send → verify lifecycle for signup, login, and reset purposes. Brute-force protection (5 attempts then locked), a 15-minute lockout anchored to OTP creation (not the 5th attempt), and otp.sent / otp.verified / otp.failed / otp.expired webhook events.";

  return {
    title,
    description,
    alternates: {
      canonical: "/email-verification-api",
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl("/email-verification-api"),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function EmailVerificationApiPage() {
  const locale = await resolveServerLocale();
  const isFa = locale === "fa";
  const dir = LOCALE_HTML_DIR[locale];

  const t = {
    heroTitle: isFa ? "ایمیل Verification API" : "Email Verification API",
    heroSubtitle: isFa
      ? "تأیید مالکیت یک آدرس ایمیل با صدور یک کد یک‌بارمصرف و بررسی کد واردشده توسط کاربر. مناسب فرم‌های ثبت‌نام، ورود و بازنشانی گذرواژه — با حفاظت در برابر brute-force، قفل ۱۵ دقیقه‌ای، و رویدادهای وب‌هوک امضادار."
      : "Verify ownership of an email address by issuing a one-time code and checking the code the user enters. Suitable for signup, login, and password-reset forms — with brute-force protection, a 15-minute lockout window, and signed webhook events.",
    flow: isFa ? "جریان تأیید" : "Verification flow",
    securityProperties: isFa ? "ویژگی‌های امنیتی" : "Security properties",
    verificationState: isFa ? "وضعیت تأیید و نشست" : "Verification state & session",
    webhooks: isFa ? "رویدادهای وب‌هوک" : "Webhook events",
    errorHandling: isFa ? "مدیریت خطاها" : "Error handling",
    codeExamples: isFa ? "نمونه‌های کد (verify)" : "Code examples (verify)",
    rateLimits: isFa ? "محدودیت‌های نرخ (تمرکز بر /verify)" : "Rate limits (/verify emphasis)",
    rateLimitsNote: isFa
      ? "این مقادیر پیش‌فرض‌های امنیتی برنامه هستند. پیکربندی استقرار می‌تواند این مقادیر را بازنویسی کند، بنابراین تا زمانی که محیط تولید تأیید نشده باشد، نباید آن‌ها را محدودیت‌های تغییرناپذیر در نظر گرفت."
      : "These are the application's default limits. Deployment configuration can override these values, so they should not be treated as immutable production limits unless the production environment is verified.",
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
            <UserCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            {t.heroTitle}
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            {t.heroSubtitle}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground/70">
            <span className="rounded-full border border-border bg-card/60 px-3 py-1">
              <Ltr>purpose: signup | login | reset</Ltr>
            </span>
            <span className="rounded-full border border-border bg-card/60 px-3 py-1">
              <Ltr>5 attempts → locked</Ltr>
            </span>
            <span className="rounded-full border border-border bg-card/60 px-3 py-1">
              <Ltr>15-min lockout (anchored to OTP creation)</Ltr>
            </span>
          </div>
        </header>

        {/* Verification flow */}
        <section className="mt-12 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Send className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.flow}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isFa
              ? "تأیید مالکیت ایمیل در سه حالت استفاده می‌شود: ثبت‌نام، ورود و بازنشانی گذرواژه. در هر سه حالت، چرخه‌ی زیر یکسان است:"
              : "Email ownership verification is used in three scenarios — signup, login, and password reset. In all three, the lifecycle below is identical:"}
          </p>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-gray-900">1</span>
              <span>
                <strong className="text-foreground">{isFa ? "صدور کد" : "Issue"}</strong> {" — "}
                <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">POST /api/v1/otp/send</Ltr>
                {" "}
                {isFa
                  ? "با ایمیل و purpose کاربر. کد از طریق ایمیل تحویل داده می‌شود و expires_at (TTL ده دقیقه‌ای) را برمی‌گرداند."
                  : "with the user's email and purpose. The code is delivered via email and an expires_at (10-minute TTL) is returned."}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-gray-900">2</span>
              <span>
                <strong className="text-foreground">{isFa ? "تأیید کد" : "Verify"}</strong> {" — "}
                <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">POST /api/v1/otp/verify</Ltr>
                {" "}
                {isFa
                  ? "با ایمیل، کد ۶ رقمی واردشده، و همان purpose. در صورت موفقیت، کد به‌صورت atomic مصرف می‌شود و otp.verified fire می‌گردد."
                  : "with the email, the 6-digit code the user entered, and the same purpose. On success, the code is atomically consumed and otp.verified is fired."}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-gray-900">3</span>
              <span>
                <strong className="text-foreground">{isFa ? "ارسال مجدد (اختیاری)" : "Resend (optional)"}</strong> {" — "}
                <Ltr className="font-mono text-emerald-700 dark:text-emerald-300">POST /api/v1/otp/resend</Ltr>
                {" "}
                {isFa
                  ? "اگر کاربر کد را دریافت نکرد. کد منقضی‌شده قابل تأیید نیست — باید کد جدیدی صادر شود."
                  : "if the user did not receive the code. An expired code cannot be verified — a fresh one must be issued."}
              </span>
            </li>
          </ol>
          <div className="mt-4 rounded border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Clock className="mr-1 inline h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <strong className="text-foreground">{isFa ? "انقضای کد" : "Code expiry"}:</strong>{" "}
            {isFa
              ? "هر کد پس از ۱۰ دقیقه منقضی می‌شود. پس از انقضا، /verify با خطای expired (410) پاسخ می‌دهد و رویداد otp.expired fire می‌شود. کد منقضی‌شده دیگر قابل تأیید نیست — باید /resend یا /send را صدا بزنید."
              : "Each code expires after 10 minutes. After expiry, /verify returns the expired error (410) and the otp.expired event is fired. An expired code cannot be verified — you must call /resend or /send."}
          </div>
        </section>

        {/* Security properties */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.securityProperties}
          </h2>
          <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong className="text-foreground">{isFa ? "حفاظت brute-force: ۵ تلاش سپس قفل" : "Brute-force protection: 5 attempts then locked"}</strong>
                {" — "}
                {isFa
                  ? "هر کد حداکثر ۵ بار قابل تأیید است. تلاش ششم (یا هر تلاش پس از آن) با خطای locked (423) پاسخ می‌دهد."
                  : "each code can be verified at most 5 times. The 6th attempt (or any attempt after) returns the locked error (423)."}
              </span>
            </li>
            <li className="flex gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong className="text-foreground">{isFa ? "قفل ۱۵ دقیقه‌ای متصل به صدور OTP" : "15-minute lockout anchored to OTP creation"}</strong>
                {" — "}
                {isFa
                  ? "پنجره‌ی قفل از زمان صدور OTP آغاز می‌شود، نه از تلاش پنجم. یک کد صادرشده در T با attempts=maxAttempts تا T+15min قفل است. در طول این پنجره، /verify برای همان ایمیل+purpose با locked (423) پاسخ می‌دهد. برای کلیدهای تولید (mg_live_)، /send و /resend نیز ممکن است با locked پاسخ دهند. برای کلیدهای تست (mg_test_)، مسیر sandbox از این قفل استفاده نمی‌کند — می‌توانید با X-Sandbox-Simulate: locked آن را شبیه‌سازی کنید."
                  : "the lockout window starts from when the OTP was issued, NOT from the 5th attempt. A code issued at T with attempts=maxAttempts is locked until T+15min. During this window, /verify for the same email+purpose returns locked (423). For live keys (mg_live_), /send and /resend may also return locked. For test keys (mg_test_), the sandbox send/resend path does not enforce this per-code lockout — use X-Sandbox-Simulate: locked to simulate it."}
              </span>
            </li>
            <li className="flex gap-2">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong className="text-foreground">HMAC-SHA256</strong>
                {" — "}
                {isFa
                  ? "کد با pepper سمت سرور هش می‌شود و فقط هش در پایگاه‌داده ذخیره می‌شود. مقایسه با timingSafeEqual انجام می‌شود."
                  : "the code is hashed with a server-side pepper and only the hash is stored. Comparison uses timingSafeEqual."}
              </span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong className="text-foreground">{isFa ? "یک‌بارمصرف" : "Single-use"}</strong>
                {" — "}
                {isFa
                  ? "یک کد تأییدشده با یک UPDATE atomic به‌عنوان مصرف‌شده علامت‌گذاری می‌شود. تلاش مجدد با همان کد با already_used (409) پاسخ می‌دهد."
                  : "a verified code is marked consumed with an atomic UPDATE. Reusing the same code returns already_used (409)."}
              </span>
            </li>
          </ul>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <Ltr className="font-mono text-sm font-semibold text-foreground">expired</Ltr>
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">HTTP 410</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground/80">
                {isFa
                  ? "TTL ده دقیقه‌ای بدون تأیید موفق سپری شد. کد دیگر قابل استفاده نیست — کد جدیدی صادر کنید. این یک وضعیت طبیعی است که با گذشت زمان رخ می‌دهد."
                  : "The 10-minute TTL elapsed without successful verification. The code is no longer usable — issue a new one. This is a normal time-based state."}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-rose-400" />
                <Ltr className="font-mono text-sm font-semibold text-foreground">locked</Ltr>
                <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">HTTP 423</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground/80">
                {isFa
                  ? "۵ تلاش ناموفق انجام شده است. این یک وضعیت امنیتی است که نشان‌دهنده‌ی تلاش احتمالی brute-force است. درخواست‌های بیشتر تا انقضای پنجره‌ی قفل (۱۵ دقیقه از صدور) رد می‌شوند."
                  : "5 unsuccessful attempts have been made. This is a security state that indicates a possible brute-force attempt. Further requests are rejected until the lockout window elapses (15 minutes from issuance)."}
              </p>
            </div>
          </div>
        </section>

        {/* Verification state & session */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.verificationState}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isFa
              ? "Nixify API فقط کد را تأیید می‌کند و otp.verified را fire می‌کند. علامت‌گذاری ایمیل به‌عنوان تأییدشده و برقراری نشست، در برنامه‌ی شما انجام می‌شود — معماری به این شکل است:"
              : "The Nixify API only verifies the code and fires otp.verified. Marking the email as verified and establishing a session is performed in YOUR application — the architecture is:"}
          </p>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-gray-900">1</span>
              <span>
                {isFa
                  ? "برنامه‌ی شما /otp/send را صدا می‌زند تا کد را به ایمیل کاربر بفرستد."
                  : "Your app calls /otp/send to deliver a code to the user's email."}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-gray-900">2</span>
              <span>
                {isFa
                  ? "کاربر کد را در فرم شما وارد می‌کند. برنامه‌ی شما /otp/verify را با ایمیل+کد+purpose صدا می‌زند."
                  : "The user enters the code in your form. Your app calls /otp/verify with email+code+purpose."}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-gray-900">3</span>
              <span>
                {isFa
                  ? "اگر پاسخ verified: true بود، برنامه‌ی شما در پایگاه‌داده‌ی خود emailVerified=true را تنظیم می‌کند (یا کاربر را ایجاد می‌کند) و یک نشست برقرار می‌کند."
                  : "If the response is verified: true, your app sets emailVerified=true in your own database (or creates the user) and establishes a session."}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-gray-900">4</span>
              <span>
                {isFa
                  ? "(اختیاری) یک وب‌هوک otp.verified به endpoint شما تحویل داده می‌شود — می‌توانید از آن برای idempotency یا log استفاده کنید."
                  : "(Optional) An otp.verified webhook is delivered to your endpoint — use it for idempotency or logging."}
              </span>
            </li>
          </ol>
          <p className="mt-4 rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            {isFa
              ? "Nixify پایگاه‌داده‌ی کاربران شما را نمی‌بیند. ستون emailVerified متعلق به پایگاه‌داده‌ی شماست — Nixify فقط به شما می‌گوید که این کد معتبر بوده است."
              : "Nixify does not see your user database. The emailVerified column belongs to your database — Nixify only tells you that this code was valid."}
          </p>
        </section>

        {/* Webhook events */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Webhook className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.webhooks}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isFa
              ? "چهار رویداد وب‌هوک برای چرخه‌ی تأیید در دسترس هستند. هر تحویل با HMAC-SHA256 از طریق هدر Nixify-Signature امضا می‌شود."
              : "Four webhook events are available for the verification lifecycle. Each delivery is signed with HMAC-SHA256 via the Nixify-Signature header."}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><Send className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><Ltr className="font-mono text-emerald-700 dark:text-emerald-300">otp.sent</Ltr> — {isFa ? "کد تولید و به ایمیل کاربر ارسال شد (شامل ارسال مجدد)." : "a code was generated and sent to the user's email (includes resends)."}</span></li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><Ltr className="font-mono text-emerald-700 dark:text-emerald-300">otp.verified</Ltr> — {isFa ? "کاربر کد صحیح را وارد کرد و کد به‌صورت atomic مصرف شد." : "the user entered the correct code and it was atomically consumed."}</span></li>
            <li className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><Ltr className="font-mono text-emerald-700 dark:text-emerald-300">otp.failed</Ltr> — {isFa ? "کاربر کد اشتباهی وارد کرد. data.reason برابر mismatch است." : "the user entered an incorrect code. data.reason is mismatch."}</span></li>
            <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><Ltr className="font-mono text-emerald-700 dark:text-emerald-300">otp.expired</Ltr> — {isFa ? "TTL ده دقیقه‌ای بدون تأیید موفق سپری شد." : "the 10-minute TTL elapsed without successful verification."}</span></li>
          </ul>
          <div className="mt-4">
            <Link href="/docs#webhooks" className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
              {isFa ? "مستندات وب‌هوک" : "Webhook documentation"} →
            </Link>
          </div>
        </section>

        {/* Error handling */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <AlertCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.errorHandling}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isFa
              ? "/verify یک کاتالوگ خطای پایدار برمی‌گرداند. هر خطا شامل code، message و doc_url است. کدهایی که باید در UI خود مدیریت کنید:"
              : "/verify returns a stable error catalog. Each error includes code, message, and doc_url. The codes you should handle in your UI:"}
          </p>
          <div className="mt-3 max-h-96 overflow-y-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 sticky top-0">
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground"><Ltr>code</Ltr></th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">HTTP</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">{isFa ? "معنی و اقدام" : "Meaning & action"}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">code_mismatch</Ltr></td><td className="px-3 py-2 text-muted-foreground"><Ltr>400</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "کد اشتباه است. کاربر را برای وارد کردن مجدد راهنمایی کنید." : "Wrong code. Prompt the user to re-enter."}</td></tr>
                <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">expired</Ltr></td><td className="px-3 py-2 text-muted-foreground"><Ltr>410</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "کد منقضی شده. /resend یا /send را صدا بزنید." : "Code expired. Call /resend or /send."}</td></tr>
                <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">locked</Ltr></td><td className="px-3 py-2 text-muted-foreground"><Ltr>423</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "۵ تلاش ناموفق. تا انقضای پنجره‌ی قفل (۱۵ دقیقه از صدور) صبر کنید." : "5 failed attempts. Wait until the lockout window elapses (15 min from issuance)."}</td></tr>
                <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">already_used</Ltr></td><td className="px-3 py-2 text-muted-foreground"><Ltr>409</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "این کد قبلاً تأیید شده. یک کد جدید صادر کنید." : "This code was already verified. Issue a new one."}</td></tr>
                <tr className="border-b border-border"><td className="px-3 py-2"><Ltr className="font-mono text-foreground">not_found</Ltr></td><td className="px-3 py-2 text-muted-foreground"><Ltr>404</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "هیچ کد فعالی برای این ایمیل+purpose یافت نشد. /send را صدا بزنید." : "No active code for this email+purpose. Call /send."}</td></tr>
                <tr><td className="px-3 py-2"><Ltr className="font-mono text-foreground">rate_limited</Ltr></td><td className="px-3 py-2 text-muted-foreground"><Ltr>429</Ltr></td><td className="px-3 py-2 text-muted-foreground/70">{isFa ? "محدودیت نرخ per-email یا per-IP. هدر Retry-After را بخوانید." : "Per-email or per-IP rate limit. Read the Retry-After header."}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Rate limits — verify emphasis */}
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
                <tr className="border-b border-border bg-emerald-500/5"><td className="px-3 py-2 text-muted-foreground"><Ltr>Per email — /verify</Ltr></td><td className="px-3 py-2 text-muted-foreground">5</td><td className="px-3 py-2 text-muted-foreground">{isFa ? "۱ دقیقه" : "1 minute"}</td></tr>
                <tr className="border-b border-border bg-emerald-500/5"><td className="px-3 py-2 text-muted-foreground"><Ltr>Per IP — /verify</Ltr></td><td className="px-3 py-2 text-muted-foreground">30 / 120</td><td className="px-3 py-2 text-muted-foreground">{isFa ? "۱ دق / ۱ ساعت" : "1 min / 1 hr"}</td></tr>
                <tr className="border-b border-border"><td className="px-3 py-2 text-muted-foreground"><Ltr>Per email — /send</Ltr></td><td className="px-3 py-2 text-muted-foreground">3</td><td className="px-3 py-2 text-muted-foreground">{isFa ? "۱ دقیقه" : "1 minute"}</td></tr>
                <tr className="border-b border-border"><td className="px-3 py-2 text-muted-foreground"><Ltr>Per email — /send</Ltr></td><td className="px-3 py-2 text-muted-foreground">10</td><td className="px-3 py-2 text-muted-foreground">{isFa ? "۱ ساعت" : "1 hour"}</td></tr>
                <tr><td className="px-3 py-2 text-muted-foreground"><Ltr>Per IP — /send</Ltr></td><td className="px-3 py-2 text-muted-foreground">10 / 60</td><td className="px-3 py-2 text-muted-foreground">{isFa ? "۱ دق / ۱ ساعت" : "1 min / 1 hr"}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground/70">
            {isFa
              ? "صف‌های /verify برجسته شده‌اند — آن‌ها برای محافظت در برابر brute-force حیاتی هستند. کلیدهای mg_test_ همچنان ۵/min را روی /verify اعمال می‌کنند (حتی اگر محدودکننده‌ی /send را دور بزنند)."
              : "The /verify rows are highlighted — they are critical to brute-force protection. mg_test_ keys still enforce 5/min on /verify (even though they skip the /send limiter)."}
          </p>
        </section>

        {/* Code examples — verify-focused */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t.codeExamples}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isFa
              ? "هر نمونه روی /verify متمرکز است و تمام کاتالوگ خطا را مدیریت می‌کند. کلید API هرگز نباید در کد سمت کلاینت افشا شود — این فراخوانی‌ها از backend شما انجام می‌شوند."
              : "Each example focuses on /verify and handles the full error catalog. The API key must never be exposed to the client — these calls happen from your backend."}
          </p>

          {/* Node.js */}
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-foreground">Node.js <span className="text-muted-foreground/60">(fetch)</span></h3>
            <pre dir="ltr" className="mt-2 overflow-auto rounded border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
{`// Server-side route handler — store the key in an env var.
const NIXIFY_API = "${PRODUCTION_ORIGIN}/api/v1";
const NIXIFY_KEY = process.env.NIXIFY_API_KEY; // mg_live_... in production

// Step 1: Send the OTP code to the user's email.
async function sendVerificationCode(email) {
  const res = await fetch(\`\${NIXIFY_API}/otp/send\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${NIXIFY_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, purpose: "signup" }),
  });
  return res.json();
  // { otp_request_id, message, expires_at, request_id }
  // (sandbox mg_test_ keys also return "code")
}

// Step 2: Verify the code the user entered.
async function verifyEmailOwnership(email, code) {
  const res = await fetch(\`\${NIXIFY_API}/otp/verify\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${NIXIFY_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, code, purpose: "signup" }),
  });
  const data = await res.json();

  if (res.ok && data.verified === true) {
    // -> email ownership confirmed.
    // Now YOUR application: set emailVerified=true on the user row,
    // establish a session, redirect to the dashboard, etc.
    return { ok: true, otpRequestId: data.otp_request_id };
  }

  // Map the Nixify error code to a UI message.
  const errorCode = data?.error?.code;
  switch (errorCode) {
    case "code_mismatch": return { ok: false, message: "Wrong code. Try again." };
    case "expired":       return { ok: false, message: "Code expired. Request a new one." };
    case "locked":        return { ok: false, message: "Too many attempts. Try later." };
    case "already_used":  return { ok: false, message: "Code already used. Request a new one." };
    case "not_found":     return { ok: false, message: "No active code. Request a new one." };
    case "rate_limited":  return { ok: false, message: "Too many tries. Slow down." };
    default:              return { ok: false, message: "Verification failed." };
  }
}

// Usage: send → user enters code → verify
// const sent = await sendVerificationCode("user@example.com");
// const result = await verifyEmailOwnership("user@example.com", "123456");
// Use /otp/resend with the same purpose if the user needs a new code.`}
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

# Step 1: Send the OTP code to the user's email.
def send_verification_code(email):
    res = requests.post(
        f"{NIXIFY_API}/otp/send",
        headers=headers,
        json={"email": email, "purpose": "signup"},
    )
    return res.json()
    # { otp_request_id, message, expires_at, request_id }
    # (sandbox mg_test_ keys also return "code")

# Step 2: Verify the code the user entered.
def verify_email_ownership(email, code):
    res = requests.post(
        f"{NIXIFY_API}/otp/verify",
        headers=headers,
        json={"email": email, "code": code, "purpose": "signup"},
    )
    data = res.json()

    if res.ok and data.get("verified") is True:
        # -> email ownership confirmed.
        return {"ok": True, "otp_request_id": data["otp_request_id"]}

    messages = {
        "code_mismatch": "Wrong code. Try again.",
        "expired":       "Code expired. Request a new one.",
        "locked":        "Too many attempts. Try later.",
        "already_used":  "Code already used. Request a new one.",
        "not_found":     "No active code. Request a new one.",
        "rate_limited":  "Too many tries. Slow down.",
    }
    code_err = data.get("error", {}).get("code")
    return {"ok": False, "message": messages.get(code_err, "Verification failed.")}

# Usage: send → user enters code → verify
# sent = send_verification_code("user@example.com")
# result = verify_email_ownership("user@example.com", "123456")
# Use /otp/resend with the same purpose if the user needs a new code.`}
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

// Step 1: Send the OTP code to the user's email.
$send_verification_code = function ($email) use ($nixify_api, $nixify_key) {
    $ch = curl_init("{$nixify_api}/otp/send");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$nixify_key}",
            "Content-Type: application/json",
        ],
        CURLOPT_POSTFIELDS => json_encode([
            "email" => $email,
            "purpose" => "signup",
        ]),
    ]);
    $raw = curl_exec($ch);
    curl_close($ch);
    return json_decode($raw, true);
    // { otp_request_id, message, expires_at, request_id }
    // (sandbox mg_test_ keys also return "code")
};

// Step 2: Verify the code the user entered.
$verify_email_ownership = function ($email, $code) use ($nixify_api, $nixify_key) {
    $ch = curl_init("{$nixify_api}/otp/verify");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$nixify_key}",
            "Content-Type: application/json",
        ],
        CURLOPT_POSTFIELDS => json_encode([
            "email" => $email,
            "code" => $code,
            "purpose" => "signup",
        ]),
    ]);
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($raw, true);

    if ($status >= 200 && $status < 300 && ($data["verified"] ?? false) === true) {
        // -> email ownership confirmed.
        return ["ok" => true, "otp_request_id" => $data["otp_request_id"]];
    }

    $err_code = $data["error"]["code"] ?? "";
    $messages = [
        "code_mismatch" => "Wrong code. Try again.",
        "expired"       => "Code expired. Request a new one.",
        "locked"        => "Too many attempts. Try later.",
        "already_used"  => "Code already used. Request a new one.",
        "not_found"     => "No active code. Request a new one.",
        "rate_limited"  => "Too many tries. Slow down.",
    ];
    return [
        "ok" => false,
        "message" => $messages[$err_code] ?? "Verification failed.",
    ];
};

// Usage: send → user enters code → verify
// $sent = $send_verification_code("user@example.com");
// $result = $verify_email_ownership("user@example.com", "123456");
// Use /otp/resend with the same purpose if the user needs a new code.`}
            </pre>
          </div>
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
            <li><Link href="/email-otp-api" className="text-emerald-600 dark:text-emerald-400 hover:underline">{isFa ? "ایمیل OTP API" : "Email OTP API"} →</Link></li>
            <li><Link href="/pricing" className="text-emerald-600 dark:text-emerald-400 hover:underline">{isFa ? "طرح‌ها و سهمیه‌ها" : "Plans and quotas"} →</Link></li>
            <li><Link href="/security" className="text-emerald-600 dark:text-emerald-400 hover:underline">{isFa ? "کنترل‌های امنیتی" : "Security controls"} →</Link></li>
          </ul>
        </section>
      </div>
    </>
  );
}
