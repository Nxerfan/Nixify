"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import { ERRORS_CATALOG } from "@/lib/dx/errors-catalog";
import { getLocalizedError } from "@/lib/dx/errors-catalog-i18n";
import { PRODUCTION_ORIGIN } from "@/lib/site/site-url";
import {
  BookOpen, Rocket, KeyRound, Send, MailCheck, RotateCcw,
  Webhook, Gauge, AlertCircle, History, Code2, FlaskConical, Search,
} from "lucide-react";
import {
  DocCard, CodeBlock, EndpointBlock, ParamTable, GuideBridgeLink,
} from "./DocsShell";

/**
 * DocsContent — the shared documentation body.
 *
 * Renders all sections: Overview, Quick Start, Authentication, API Reference
 * (Send/Verify/Resend), Webhooks, Rate Limits, Error Codes, Sandbox, Request
 * IDs, Examples, Changelog.
 *
 * The Error Codes section renders directly from ERRORS_CATALOG (canonical source)
 * with localized overlays via getLocalizedError().
 *
 * Technical tokens (API paths, HTTP methods, JSON, field names) stay LTR.
 */

const API_BASE = `${PRODUCTION_ORIGIN}/api/v1`;

export function DocsContent() {
  const { locale } = useLocale();
  const isFa = locale === "fa";

  // Localized error entries
  const localizedErrors = React.useMemo(() => {
    return ERRORS_CATALOG.map(e => getLocalizedError(e, locale));
  }, [locale]);

  return (
    <>
      {/* ─── Overview ─── */}
      <DocCard
        id="overview"
        icon={BookOpen}
        title={isFa ? "نمای کلی" : "Overview"}
        description={isFa ? "Nixify یک پلتفرم تأیید OTP ایمیل است." : "Nixify is an email OTP verification platform."}
      >
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            {isFa
              ? "API تأیید OTP ایمیل Nixify به شما اجازه می‌دهد کدهای تأیید یک‌بارمصرف را از طریق ایمیل ارسال و تأیید کنید. این API برای احراز هویت کاربران، تأیید ثبت‌نام، بازیابی رمز عبور و هر جایی که نیاز به تأیید مالکیت ایمیل دارید طراحی شده است."
              : "The Nixify email OTP verification API lets you send and verify one-time passwords via email. It's designed for user authentication, signup verification, password recovery, and anywhere you need to verify email ownership."}
          </p>
          <p>
            {isFa ? "کد OTP:" : "OTP code:"}{" "}
            <Ltr><code className="font-mono text-emerald-300">6 ASCII digits</code></Ltr>
            {isFa ? " — " : " — "}
            <Ltr><code className="font-mono text-emerald-300">10 minute TTL</code></Ltr>
            {isFa ? " — " : " — "}
            <Ltr><code className="font-mono text-emerald-300">max 5 attempts</code></Ltr>
          </p>
          <div className="flex flex-wrap gap-2">
            <GuideBridgeLink href="/guide/contacts" label={isFa ? "راهنمای مخاطبان" : "Contacts Guide"} />
            <GuideBridgeLink href="/guide/api-keys" label={isFa ? "راهنمای کلیدهای API" : "API Keys Guide"} />
          </div>
        </div>
      </DocCard>

      {/* ─── Quick Start ─── */}
      <DocCard
        id="quickstart"
        icon={Rocket}
        title={isFa ? "شروع سریع" : "Quick Start"}
        description={isFa ? "اولین درخواست OTP خود را در چند دقیقه انجام دهید." : "Make your first OTP request in minutes."}
      >
        <div className="space-y-4 text-sm text-gray-300">
          <div>
            <p className="mb-2 font-medium text-gray-200">{isFa ? "۱. یک کلید API تست ایجاد کنید" : "1. Create a test API key"}</p>
            <p>
              {isFa
                ? "به کلیدهای API در داشبورد بروید، روی «ایجاد کلید» کلیک کنید، محیط تست را انتخاب کنید و کلید mg_test_ را کپی کنید."
                : "Go to API Keys in the dashboard, click Create API Key, choose the test environment, and copy the mg_test_ key."}
            </p>
          </div>
          <div>
            <p className="mb-2 font-medium text-gray-200">{isFa ? "۲. یک OTP ارسال کنید" : "2. Send an OTP"}</p>
            <CodeBlock
              lang="curl"
              label="curl"
              code={`curl -X POST ${API_BASE}/otp/send \\
  -H "Authorization: Bearer mg_test_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com"}'`}
            />
          </div>
          <div>
            <p className="mb-2 font-medium text-gray-200">{isFa ? "۳. کد را تأیید کنید" : "3. Verify the code"}</p>
            <CodeBlock
              lang="curl"
              label="curl"
              code={`curl -X POST ${API_BASE}/otp/verify \\
  -H "Authorization: Bearer mg_test_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","code":"123456"}'`}
            />
          </div>
          <p className="text-xs text-gray-300">
            {isFa
              ? "کلیدهای تست در حالت سندباکس کار می‌کنند — هیچ ایمیل واقعی ارسال نمی‌شود و کد OTP در پاسخ بازگردانده می‌شود."
              : "Test keys run in sandbox mode — no real email is sent and the OTP code is returned in the response."}
          </p>
        </div>
      </DocCard>

      {/* ─── Authentication ─── */}
      <DocCard
        id="authentication"
        icon={KeyRound}
        title={isFa ? "احراز هویت" : "Authentication"}
        description={isFa ? "احراز هویت با کلید API در هدر Bearer." : "API key authentication via Bearer header."}
      >
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            {isFa
              ? "همه درخواست‌های API نیاز به کلید API دارند که در هدر Authorization به‌صورت Bearer token ارسال می‌شود:"
              : "All API requests require an API key sent in the Authorization header as a Bearer token:"}
          </p>
          <CodeBlock
            lang="http"
            label="HTTP Header"
            code={`Authorization: Bearer mg_test_your_key_here`}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="mb-1 text-xs font-semibold text-amber-300">
                <Ltr>mg_test_</Ltr> — {isFa ? "کلید تست" : "Test Key"}
              </p>
              <p className="text-xs text-gray-300">
                {isFa
                  ? "محیط تست و CI. حالت سندباکس خودکار است — هیچ ایمیل واقعی ارسال نمی‌شود. کد OTP در پاسخ بازگردانده می‌شود."
                  : "Development & CI. Sandbox mode is automatic — no real email is sent. The OTP code is returned in the response."}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="mb-1 text-xs font-semibold text-emerald-300">
                <Ltr>mg_live_</Ltr> — {isFa ? "کلید تولید" : "Live Key"}
              </p>
              <p className="text-xs text-gray-300">
                {isFa
                  ? "فقط تولید. ایمیل واقعی از طریق زیرساخت تحویل مدیریت‌شده ارسال می‌شود."
                  : "Production only. Real email is sent through managed delivery infrastructure."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <GuideBridgeLink href="/guide/api-keys" label={isFa ? "راهنمای کلیدهای API" : "API Keys Guide"} />
          </div>
        </div>
      </DocCard>

      {/* ─── Send OTP ─── */}
      <DocCard
        id="send-otp"
        icon={Send}
        title={isFa ? "ارسال OTP" : "Send OTP"}
        description={isFa ? "یک کد OTP به ایمیل کاربر ارسال کنید." : "Send an OTP code to a user's email."}
        methodBadge="POST"
      >
        <div className="space-y-4 text-sm text-gray-300">
          <EndpointBlock method="POST" path="/api/v1/otp/send">
            <ParamTable params={[
              { name: "email", type: "string", required: true, description: isFa ? "ایمیل گیرنده" : "Recipient email address" },
              { name: "purpose", type: "string", required: false, description: isFa ? "هدف OTP (signin, signup, reset)" : "OTP purpose (signin, signup, reset)" },
            ]} />
          </EndpointBlock>
          <CodeBlock
            lang="curl"
            label="curl"
            code={`curl -X POST ${API_BASE}/otp/send \\
  -H "Authorization: Bearer mg_test_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","purpose":"signup"}'`}
          />
          <CodeBlock
            lang="json"
            label="Response (sandbox)"
            code={`{
  "otp_id": "otp_abc123",
  "otp_request_id": "otp_req_xyz789",
  "email": "user@example.com",
  "expires_at": "2026-01-01T12:10:00Z",
  "code": "123456"
}`}
          />
          <p className="text-xs text-gray-300">
            {isFa
              ? "در حالت سندباکس، فیلد code با کد OTP بازگردانده می‌شود. در تولید، این فیلد وجود ندارد."
              : "In sandbox mode, the code field is returned with the OTP. In production, this field is absent."}
          </p>
        </div>
      </DocCard>

      {/* ─── Verify OTP ─── */}
      <DocCard
        id="verify-otp"
        icon={MailCheck}
        title={isFa ? "تأیید OTP" : "Verify OTP"}
        description={isFa ? "کد OTP ارسال‌شده را تأیید کنید." : "Verify the OTP code sent to the user."}
        methodBadge="POST"
      >
        <div className="space-y-4 text-sm text-gray-300">
          <EndpointBlock method="POST" path="/api/v1/otp/verify">
            <ParamTable params={[
              { name: "email", type: "string", required: true, description: isFa ? "ایمیل گیرنده" : "Recipient email address" },
              { name: "code", type: "string", required: true, description: isFa ? "کد ۶ رقمی OTP" : "6-digit OTP code" },
            ]} />
          </EndpointBlock>
          <CodeBlock
            lang="curl"
            label="curl"
            code={`curl -X POST ${API_BASE}/otp/verify \\
  -H "Authorization: Bearer mg_test_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","code":"123456"}'`}
          />
          <CodeBlock
            lang="json"
            label="Response (success)"
            code={`{
  "verified": true,
  "email": "user@example.com",
  "otp_request_id": "otp_req_xyz789",
  "verified_at": "2026-01-01T12:05:00Z"
}`}
          />
          <p className="text-xs text-gray-300">
            {isFa
              ? "حداکثر ۵ تلاش مجاز است. پس از ۵ تلاش ناموفق، OTP منقضی می‌شود."
              : "Maximum 5 attempts allowed. After 5 failed attempts, the OTP expires."}
          </p>
        </div>
      </DocCard>

      {/* ─── Resend OTP ─── */}
      <DocCard
        id="resend-otp"
        icon={RotateCcw}
        title={isFa ? "ارسال مجدد OTP" : "Resend OTP"}
        description={isFa ? "یک OTP جدید به ایمیل کاربر ارسال کنید." : "Send a new OTP to the user's email."}
        methodBadge="POST"
      >
        <div className="space-y-4 text-sm text-gray-300">
          <EndpointBlock method="POST" path="/api/v1/otp/resend">
            <ParamTable params={[
              { name: "email", type: "string", required: true, description: isFa ? "ایمیل گیرنده" : "Recipient email address" },
            ]} />
          </EndpointBlock>
          <CodeBlock
            lang="curl"
            label="curl"
            code={`curl -X POST ${API_BASE}/otp/resend \\
  -H "Authorization: Bearer mg_test_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com"}'`}
          />
          <p className="text-xs text-gray-300">
            {isFa
              ? "محدودیت نرخ: ۳ درخواست در دقیقه به ازای هر ایمیل."
              : "Rate limit: 3 requests per minute per email."}
          </p>
        </div>
      </DocCard>

      {/* ─── Webhooks ─── */}
      <DocCard
        id="webhooks"
        icon={Webhook}
        title={isFa ? "وب‌هوک‌ها" : "Webhooks"}
        description={isFa ? "رویدادهای زمان‌واقعی را در نقطهٔ انتهایی خود دریافت کنید." : "Receive real-time events at your endpoint."}
      >
        <div className="space-y-4 text-sm text-gray-300">
          <p>
            {isFa
              ? "هر تحویل وب‌هوک با HMAC-SHA256 با راز اختصاصی نقطهٔ انتهایی امضا می‌شود. راز فقط یک‌بار هنگام ایجاد نمایش داده می‌شود."
              : "Each webhook delivery is signed with HMAC-SHA256 using the endpoint's secret. The secret is shown ONCE at creation."}
          </p>
          <div>
            <p className="mb-2 font-medium text-gray-200">{isFa ? "هدرهای امضا" : "Signature headers"}</p>
            <CodeBlock
              lang="http"
              label="HTTP Headers"
              code={`Nixify-Signature: t=1234567890,v1=hex_hmac_sha256
Nixify-Event: otp.verified
Nixify-Delivery-Id: dlv_abc123`}
            />
          </div>
          <div>
            <p className="mb-2 font-medium text-gray-200">{isFa ? "رویدادها" : "Events"}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { event: "otp.sent", desc: isFa ? "کد تولید و ارسال شد" : "Code generated and sent" },
                { event: "otp.verified", desc: isFa ? "کاربر کد را تأیید کرد" : "User verified the code" },
                { event: "otp.failed", desc: isFa ? "تأیید ناموفق (کد اشتباه)" : "Verification failed (wrong code)" },
                { event: "otp.expired", desc: isFa ? "TTL ۱۰ دقیقه بدون تأیید" : "10-min TTL elapsed without verification" },
              ].map((e, i) => (
                <div key={i} className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-2.5">
                  <Ltr><code className="font-mono text-xs text-emerald-300">{e.event}</code></Ltr>
                  <p className="mt-0.5 text-xs text-gray-300">{e.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-300">
            {isFa
              ? "هر تحویل قدیمی‌تر از ۵ دقیقه را رد کنید تا از حملات replay جلوگیری شود."
              : "Reject any delivery older than 5 minutes to prevent replay attacks."}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <GuideBridgeLink href="/guide/webhooks" label={isFa ? "راهنمای وب‌هوک‌ها" : "Webhooks Guide"} />
          </div>
        </div>
      </DocCard>

      {/* ─── Rate Limits ─── */}
      <DocCard
        id="rate-limits"
        icon={Gauge}
        title={isFa ? "محدودیت‌های نرخ" : "Rate Limits"}
        description={isFa ? "محدودیت‌های نرخ برای جلوگیری از سوءاستفاده." : "Rate limits to prevent abuse."}
      >
        <div className="space-y-3 text-sm text-gray-300">
          <div className="overflow-hidden rounded-xl border border-gray-800/60">
            <table className="w-full text-xs">
              <thead className="bg-gray-900/40">
                <tr className="border-b border-gray-800/60 text-left text-gray-300">
                  <th className="px-3 py-2 font-medium">{isFa ? "محدودیت" : "Limit"}</th>
                  <th className="px-3 py-2 font-medium">{isFa ? "بازه" : "Window"}</th>
                  <th className="px-3 py-2 font-medium">{isFa ? "دامنه" : "Scope"}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/40">
                  <td className="px-3 py-2"><Ltr><code className="font-mono text-emerald-300">3/min</code></Ltr></td>
                  <td className="px-3 py-2">{isFa ? "۱ دقیقه" : "1 minute"}</td>
                  <td className="px-3 py-2">{isFa ? "به ازای هر ایمیل — /send" : "Per email — /send"}</td>
                </tr>
                <tr className="border-b border-gray-800/40">
                  <td className="px-3 py-2"><Ltr><code className="font-mono text-emerald-300">10/60</code></Ltr></td>
                  <td className="px-3 py-2">{isFa ? "۱ دقیقه / ۱ ساعت" : "1 min / 1 hour"}</td>
                  <td className="px-3 py-2">{isFa ? "به ازای هر IP — /send" : "Per IP — /send"}</td>
                </tr>
                <tr className="border-b border-gray-800/40">
                  <td className="px-3 py-2"><Ltr><code className="font-mono text-emerald-300">30/120</code></Ltr></td>
                  <td className="px-3 py-2">{isFa ? "۱ دقیقه / ۱ ساعت" : "1 min / 1 hour"}</td>
                  <td className="px-3 py-2">{isFa ? "به ازای هر IP — /verify" : "Per IP — /verify"}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2"><Ltr><code className="font-mono text-emerald-300">5 max</code></Ltr></td>
                  <td className="px-3 py-2">{isFa ? "در هر OTP" : "Per OTP"}</td>
                  <td className="px-3 py-2">{isFa ? "حداکثر تلاش تأیید" : "Max verify attempts"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-300">
            {isFa
              ? "پاسخ‌های 429 شامل هدر Retry-After هستند. کلیدهای تست محدودیت‌های به ازای ایمیل را رد می‌کنند."
              : "429 responses include a Retry-After header. Test keys skip per-email limits. Rate-limited responses (429) include X-RateLimit-* headers."}
          </p>
        </div>
      </DocCard>

      {/* ─── Error Codes ─── */}
      <DocCard
        id="errors"
        icon={AlertCircle}
        title={isFa ? "کدهای خطا" : "Error Codes"}
        description={isFa ? "فهرست کامل کدهای خطای API." : "Complete API error code catalog."}
      >
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            {isFa
              ? "هر خطا با این ساختار بازگردانده می‌شود:"
              : "Every error returns this structure:"}
          </p>
          <CodeBlock
            lang="json"
            label="Error Response"
            code={`{
  "error": {
    "code": "validation_failed",
    "message": "Email is required.",
    "doc_url": "https://nixify.ir/docs#error-validation_failed",
    "request_id": "req_abc123"
  }
}`}
          />
          <p className="text-xs text-gray-300">
            {isFa
              ? "فیلد doc_url همیشه به یک لنگر عمومی روی صفحهٔ مستندات اشاره دارد."
              : "The doc_url field always points to a public anchor on the docs page."}
          </p>
          <div className="space-y-2">
            {localizedErrors.map((err) => (
              <div
                key={err.code}
                id={`error-${err.code}`}
                className="scroll-mt-24 rounded-lg border border-gray-800/60 bg-gray-950/40 p-3"
              >
                <div className="flex items-center gap-2">
                  <Ltr>
                    <code className="font-mono text-xs text-emerald-300">{err.code}</code>
                  </Ltr>
                  <span className="rounded bg-gray-800/60 px-1.5 py-0.5 text-[9px] font-mono text-gray-300">
                    {err.httpStatus}
                  </span>
                  <span className="text-xs font-medium text-gray-200">{err.title}</span>
                </div>
                <p className="mt-1 text-xs text-gray-300">{err.description}</p>
                {err.causes.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {isFa ? "علل" : "Causes"}
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {err.causes.map((c, i) => (
                        <li key={i} className="text-[11px] text-gray-300">• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {err.fixes.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      {isFa ? "راه‌حل‌ها" : "Fixes"}
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {err.fixes.map((f, i) => (
                        <li key={i} className="text-[11px] text-gray-300">• {f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </DocCard>

      {/* ─── Sandbox & Testing ─── */}
      <DocCard
        id="sandbox"
        icon={FlaskConical}
        title={isFa ? "سندباکس و تست" : "Sandbox & Testing"}
        description={isFa ? "بدون ارسال ایمیل واقعی تست کنید." : "Test without sending real email."}
      >
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            {isFa
              ? "کلیدهای تست (mg_test_) به‌طور خودکار در حالت سندباکس کار می‌کنند:"
              : "Test keys (mg_test_) automatically run in sandbox mode:"}
          </p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-400">✓</span>
              <span>{isFa ? "کد OTP در فیلد code پاسخ بازگردانده می‌شود" : "OTP code is returned in the response code field"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-400">✓</span>
              <span>{isFa ? "هیچ ایمیل واقعی ارسال نمی‌شود" : "No real email is sent"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-400">✓</span>
              <span>{isFa ? "محدودیت‌های به ازای ایمیل رد می‌شوند" : "Per-email rate limits are skipped"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-amber-400">!</span>
              <span>{isFa ? "سهمیه API_MESSAGES پلان همچنان اعمال می‌شود" : "Plan API_MESSAGES quota still applies"}</span>
            </li>
          </ul>
          <p>
            {isFa
              ? "می‌توانید با هدر X-Nixify-Test-Scenario خطاهای شبیه‌سازی‌شده اجباری ایجاد کنید:"
              : "You can force simulated errors with the X-Nixify-Test-Scenario header:"}
          </p>
          <CodeBlock
            lang="http"
            label="HTTP Header"
            code={`X-Nixify-Test-Scenario: hard_bounce`}
          />
        </div>
      </DocCard>

      {/* ─── Request IDs ─── */}
      <DocCard
        id="request-ids"
        icon={Search}
        title={isFa ? "شناسه‌های درخواست" : "Request IDs"}
        description={isFa ? "هر پاسخ شامل یک شناسهٔ درخواست برای دیباگ." : "Every response includes a request ID for debugging."}
      >
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            {isFa
              ? "همه پاسخ‌ها شامل هدر X-Request-ID هستند که می‌توانید برای دیباگ استفاده کنید:"
              : "All responses include an X-Request-ID header you can use for debugging:"}
          </p>
          <CodeBlock
            lang="http"
            label="Response Header"
            code={`X-Request-ID: req_abc123def456`}
          />
          <p className="text-xs text-gray-300">
            {isFa
              ? "هنگام گزارش مشکل به پشتیبانی، این شناسه را ارائه دهید."
              : "When reporting an issue to support, include this ID."}
          </p>
        </div>
      </DocCard>

      {/* ─── Examples ─── */}
      <DocCard
        id="examples"
        icon={Code2}
        title={isFa ? "نمونه‌ها" : "Examples"}
        description={isFa ? "نمونه کد برای curl، JavaScript و Python." : "Code examples for curl, JavaScript, and Python."}
      >
        <div className="space-y-4 text-sm text-gray-300">
          <div>
            <p className="mb-2 font-medium text-gray-200">{isFa ? "JavaScript / fetch" : "JavaScript / fetch"}</p>
            <CodeBlock
              lang="javascript"
              label="JavaScript"
              code={`const res = await fetch("${API_BASE}/otp/send", {
  method: "POST",
  headers: {
    "Authorization": "Bearer mg_test_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email: "user@example.com" }),
});
const data = await res.json();
console.log(data);`}
            />
          </div>
          <div>
            <p className="mb-2 font-medium text-gray-200">{isFa ? "Python / requests" : "Python / requests"}</p>
            <CodeBlock
              lang="python"
              label="Python"
              code={`import requests

res = requests.post(
    "${API_BASE}/otp/send",
    headers={
        "Authorization": "Bearer mg_test_your_key",
        "Content-Type": "application/json",
    },
    json={"email": "user@example.com"},
)
data = res.json()
print(data)`}
            />
          </div>
        </div>
      </DocCard>

      {/* ─── Changelog ─── */}
      <DocCard
        id="changelog"
        icon={History}
        title={isFa ? "تاریخچهٔ تغییرات" : "Changelog"}
        description={isFa ? "تغییرات API و پلتفرم." : "API and platform changes."}
      >
        <div className="space-y-3 text-sm text-gray-300">
          <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-3">
            <div className="flex items-center gap-2">
              <Ltr><code className="font-mono text-xs text-emerald-300">v1.0.0</code></Ltr>
              <span className="text-xs text-gray-400">2026-07-06</span>
            </div>
            <p className="mt-1 text-xs text-gray-300">
              {isFa
                ? "انتشار اولیهٔ عمومی API. شامل ارسال/تأیید/ارسال مجدد OTP، وب‌هوک‌ها، سندباکس، و کاتالوگ خطا."
                : "Initial public API release. Includes OTP send/verify/resend, webhooks, sandbox, and error catalog."}
            </p>
          </div>
          <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-3">
            <div className="flex items-center gap-2">
              <Ltr><code className="font-mono text-xs text-emerald-300">2026.09</code></Ltr>
              <span className="text-xs text-gray-400">2026-09-20</span>
            </div>
            <p className="mt-1 text-xs text-gray-300">
              {isFa
                ? "اعتماد دامنه و شفافیت. صفحه‌های /security و /status، مهاجرت دامنه به nixify.ir."
                : "Domain trust and transparency. /security and /status pages, domain migration to nixify.ir."}
            </p>
          </div>
        </div>
      </DocCard>

      {/* ─── Guides Bridge ─── */}
      <DocCard
        id="guides-bridge"
        icon={BookOpen}
        title={isFa ? "راهنماها" : "Guides"}
        description={isFa ? "یادگیری بصری جریان‌های کاری." : "Visual workflow learning."}
      >
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            {isFa
              ? "مستندات مرجع فنی را پوشش می‌دهد. برای یادگیری نحوهٔ استفاده از ویژگی‌ها، راهنماهای تعاملی را ببینید:"
              : "Docs cover technical reference. For learning how to use features, see the interactive guides:"}
          </p>
          <div className="flex flex-wrap gap-2">
            <GuideBridgeLink href="/guide" label={isFa ? "مرکز یادگیری" : "Learning Hub"} />
            <GuideBridgeLink href="/guide/contacts" label={isFa ? "مخاطبان" : "Contacts"} />
            <GuideBridgeLink href="/guide/api-keys" label={isFa ? "کلیدهای API" : "API Keys"} />
            <GuideBridgeLink href="/guide/webhooks" label={isFa ? "وب‌هوک‌ها" : "Webhooks"} />
          </div>
        </div>
      </DocCard>
    </>
  );
}
