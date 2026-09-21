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
  Webhook, Gauge, AlertCircle, History, Code2, FlaskConical,
  Search, Sparkles, Terminal, ShieldCheck, CheckCircle2, Copy,
} from "lucide-react";
import {
  DocsChapter, DocsSubsection, CodeBlock, EndpointBlock, ParamTable, Step, Note, GuideLink,
} from "./DocsShell";
import { BuildWithAI } from "./BuildWithAI";

const API_BASE = `${PRODUCTION_ORIGIN}/api/v1`;

export function DocsContent() {
  const { locale } = useLocale();
  const isFa = locale === "fa";

  const localizedErrors = React.useMemo(() => {
    return ERRORS_CATALOG.map(e => getLocalizedError(e, locale));
  }, [locale]);

  return (
    <>
      {/* ─── Overview ─── */}
      <DocsChapter
        id="overview"
        icon={BookOpen}
        title={isFa ? "نمای کلی" : "Overview"}
        description={isFa ? "Nixify یک پلتفرم تأیید OTP ایمیل است." : "Nixify is an email OTP verification platform."}
      >
        <p>
          {isFa
            ? "API تأیید OTP ایمیل Nixify به شما اجازه می‌دهد کدهای تأیید یک‌بارمصرف را از طریق ایمیل ارسال و تأیید کنید. این API برای احراز هویت کاربران، تأیید ثبت‌نام، بازیابی رمز عبور و هر جایی که نیاز به تأیید مالکیت ایمیل دارید طراحی شده است."
            : "The Nixify email OTP verification API lets you send and verify one-time passwords via email. It's designed for user authentication, signup verification, password recovery, and anywhere you need to verify email ownership."}
        </p>
        <p>
          <Ltr><code className="font-mono text-emerald-300">6 ASCII digits</code></Ltr>
          {isFa ? " — کد OTP" : " — OTP code"}{" "}
          <Ltr><code className="font-mono text-emerald-300">10 min TTL</code></Ltr>
          {isFa ? " — مدت اعتبار" : " — validity"}{" "}
          <Ltr><code className="font-mono text-emerald-300">max 5 attempts</code></Ltr>
          {isFa ? " — حداکثر تلاش" : " — max attempts"}
        </p>
        <div className="flex flex-wrap gap-2">
          <GuideLink href="/guide/contacts" label={isFa ? "راهنمای مخاطبان" : "Contacts Guide"} />
          <GuideLink href="/guide/api-keys" label={isFa ? "راهنمای کلیدهای API" : "API Keys Guide"} />
        </div>
      </DocsChapter>

      {/* ─── Quick Start ─── */}
      <DocsChapter
        id="quickstart"
        icon={Rocket}
        title={isFa ? "شروع سریع" : "Quick Start"}
        description={isFa ? "اولین درخواست OTP خود را در چند دقیقه انجام دهید." : "Make your first OTP request in minutes."}
      >
        <Step n={1} title={isFa ? "یک کلید API تست ایجاد کنید" : "Create a test API key"}>
          <p>
            {isFa
              ? "به کلیدهای API در داشبورد بروید، روی «ایجاد کلید» کلیک کنید، محیط تست را انتخاب کنید و کلید mg_test_ را کپی کنید. کلیدهای تست در حالت سندباکس کار می‌کنند — هیچ ایمیل واقعی ارسال نمی‌شود و کد OTP در پاسخ بازگردانده می‌شود."
              : "Go to API Keys in the dashboard, click Create API Key, choose the test environment, and copy the mg_test_ key. Test keys run in sandbox mode — no real email is sent and the OTP code is returned in the response."}
          </p>
          <GuideLink href="/dashboard/api-keys" label={isFa ? "کلیدهای API" : "API Keys"} />
        </Step>
        <Step n={2} title={isFa ? "کلید را در محیط سرور قرار دهید" : "Put the key in your server environment"}>
          <p>
            {isFa ? "هرگز کلید API را در کد کلاینت قرار ندهید. آن را به‌صورت متغیر محیطی سرور استفاده کنید:" : "Never put your API key in client-side code. Use it as a server-side environment variable:"}
          </p>
          <CodeBlock lang="bash" label=".env" code={`NIXIFY_API_KEY=mg_test_your_key_here`} />
        </Step>
        <Step n={3} title={isFa ? "اولین درخواست OTP را ارسال کنید" : "Make your first OTP request"}>
          <CodeBlock
            lang="curl"
            label="curl"
            code={`curl -X POST ${API_BASE}/otp/send \\
  -H "Authorization: Bearer $NIXIFY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com"}'`}
          />
        </Step>
        <Step n={4} title={isFa ? "پاسخ را درک کنید" : "Understand the response"}>
          <CodeBlock
            lang="json"
            label={isFa ? "پاسخ (سندباکس)" : "Response (sandbox)"}
            code={`{
  "otp_id": "otp_abc123",
  "otp_request_id": "otp_req_xyz789",
  "email": "user@example.com",
  "expires_at": "2026-01-01T12:10:00Z",
  "code": "123456"
}`}
          />
          <Note type="info">
            {isFa
              ? "در حالت سندباکس، فیلد code با کد OTP بازگردانده می‌شود. در تولید، این فیلد وجود ندارد — کد فقط از طریق ایمیل ارسال می‌شود."
              : "In sandbox mode, the code field is returned with the OTP. In production, this field is absent — the code is only sent via email."}
          </Note>
        </Step>
        <Step n={5} title={isFa ? "کد را تأیید کنید" : "Verify the code"}>
          <CodeBlock
            lang="curl"
            label="curl"
            code={`curl -X POST ${API_BASE}/otp/verify \\
  -H "Authorization: Bearer $NIXIFY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","code":"123456"}'`}
          />
        </Step>
        <Step n={6} title={isFa ? "خطاها را مدیریت کنید" : "Handle errors"}>
          <p>
            {isFa ? "همه خطاها با این ساختار بازگردانده می‌شوند:" : "All errors return this structure:"}
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
          <p>
            {isFa ? "فیلد doc_url به لنگر عمومی مستندات اشاره دارد. فیلد request_id برای دیباگ استفاده می‌شود." : "The doc_url field points to a public docs anchor. The request_id field is for debugging."}
          </p>
        </Step>
      </DocsChapter>

      {/* ─── Build with AI ─── */}
      <BuildWithAI />

      {/* ─── Authentication ─── */}
      <DocsChapter
        id="authentication"
        icon={KeyRound}
        title={isFa ? "احراز هویت" : "Authentication"}
        description={isFa ? "احراز هویت با کلید API در هدر Bearer." : "API key authentication via Bearer header."}
      >
        <p>
          {isFa
            ? "همه درخواست‌های API نیاز به کلید API دارند که در هدر Authorization به‌صورت Bearer token ارسال می‌شود:"
            : "All API requests require an API key sent in the Authorization header as a Bearer token:"}
        </p>
        <CodeBlock lang="http" label="HTTP Header" code={`Authorization: Bearer mg_test_your_key_here`} />
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
        <GuideLink href="/guide/api-keys" label={isFa ? "راهنمای کلیدهای API" : "API Keys Guide"} />
      </DocsChapter>

      {/* ─── Send OTP ─── */}
      <DocsChapter
        id="send-otp"
        icon={Send}
        title={isFa ? "ارسال OTP" : "Send OTP"}
        description={isFa ? "یک کد OTP به ایمیل کاربر ارسال کنید." : "Send an OTP code to a user's email."}
        badge="POST"
      >
        <EndpointBlock method="POST" path="/api/v1/otp/send" />
        <ParamTable params={[
          { name: "email", type: "string", required: true, description: isFa ? "ایمیل گیرنده" : "Recipient email address" },
          { name: "purpose", type: "string", required: false, description: isFa ? "هدف OTP (signin, signup, reset)" : "OTP purpose (signin, signup, reset)" },
        ]} />
        <CodeBlock
          lang="curl"
          label="curl"
          code={`curl -X POST ${API_BASE}/otp/send \\
  -H "Authorization: Bearer $NIXIFY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","purpose":"signup"}'`}
        />
        <CodeBlock
          lang="json"
          label={isFa ? "پاسخ (سندباکس)" : "Response (sandbox)"}
          code={`{
  "otp_id": "otp_abc123",
  "otp_request_id": "otp_req_xyz789",
  "email": "user@example.com",
  "expires_at": "2026-01-01T12:10:00Z",
  "code": "123456"
}`}
        />
        <Note type="info">
          {isFa
            ? "در حالت سندباکس، فیلد code با کد OTP بازگردانده می‌شود. در تولید، این فیلد وجود ندارد."
            : "In sandbox mode, the code field is returned with the OTP. In production, this field is absent."}
        </Note>
      </DocsChapter>

      {/* ─── Verify OTP ─── */}
      <DocsChapter
        id="verify-otp"
        icon={MailCheck}
        title={isFa ? "تأیید OTP" : "Verify OTP"}
        description={isFa ? "کد OTP ارسال‌شده را تأیید کنید." : "Verify the OTP code sent to the user."}
        badge="POST"
      >
        <EndpointBlock method="POST" path="/api/v1/otp/verify" />
        <ParamTable params={[
          { name: "email", type: "string", required: true, description: isFa ? "ایمیل گیرنده" : "Recipient email address" },
          { name: "code", type: "string", required: true, description: isFa ? "کد ۶ رقمی OTP" : "6-digit OTP code" },
        ]} />
        <CodeBlock
          lang="curl"
          label="curl"
          code={`curl -X POST ${API_BASE}/otp/verify \\
  -H "Authorization: Bearer $NIXIFY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","code":"123456"}'`}
        />
        <CodeBlock
          lang="json"
          label={isFa ? "پاسخ (موفق)" : "Response (success)"}
          code={`{
  "verified": true,
  "email": "user@example.com",
  "otp_request_id": "otp_req_xyz789",
  "verified_at": "2026-01-01T12:05:00Z"
}`}
        />
        <Note type="warning">
          {isFa
            ? "حداکثر ۵ تلاش مجاز است. پس از ۵ تلاش ناموفق، OTP منقضی می‌شود."
            : "Maximum 5 attempts allowed. After 5 failed attempts, the OTP expires."}
        </Note>
      </DocsChapter>

      {/* ─── Resend OTP ─── */}
      <DocsChapter
        id="resend-otp"
        icon={RotateCcw}
        title={isFa ? "ارسال مجدد OTP" : "Resend OTP"}
        description={isFa ? "یک OTP جدید به ایمیل کاربر ارسال کنید." : "Send a new OTP to the user's email."}
        badge="POST"
      >
        <EndpointBlock method="POST" path="/api/v1/otp/resend" />
        <ParamTable params={[
          { name: "email", type: "string", required: true, description: isFa ? "ایمیل گیرنده" : "Recipient email address" },
        ]} />
        <CodeBlock
          lang="curl"
          label="curl"
          code={`curl -X POST ${API_BASE}/otp/resend \\
  -H "Authorization: Bearer $NIXIFY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com"}'`}
        />
        <Note type="info">
          {isFa ? "محدودیت نرخ: ۳ درخواست در دقیقه به ازای هر ایمیل." : "Rate limit: 3 requests per minute per email."}
        </Note>
      </DocsChapter>

      {/* ─── Webhooks ─── */}
      <DocsChapter
        id="webhooks"
        icon={Webhook}
        title={isFa ? "وب‌هوک‌ها" : "Webhooks"}
        description={isFa ? "رویدادهای زمان‌واقعی را در نقطهٔ انتهایی خود دریافت کنید." : "Receive real-time events at your endpoint."}
      >
        <p>
          {isFa
            ? "هر تحویل وب‌هوک با HMAC-SHA256 با راز اختصاصی نقطهٔ انتهایی امضا می‌شود. راز فقط یک‌بار هنگام ایجاد نمایش داده می‌شود."
            : "Each webhook delivery is signed with HMAC-SHA256 using the endpoint's secret. The secret is shown ONCE at creation."}
        </p>
        <p className="font-medium text-gray-200">{isFa ? "هدرهای امضا" : "Signature headers"}</p>
        <CodeBlock
          lang="http"
          label="HTTP Headers"
          code={`Nixify-Signature: t=1234567890,v1=hex_hmac_sha256
Nixify-Event: otp.verified
Nixify-Delivery-Id: dlv_abc123`}
        />
        <p className="font-medium text-gray-200">{isFa ? "رویدادها" : "Events"}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { event: "otp.sent", desc: isFa ? "کد تولید و ارسال شد" : "Code generated and sent" },
            { event: "otp.verified", desc: isFa ? "کاربر کد را تأیید کرد" : "User verified the code" },
            { event: "otp.failed", desc: isFa ? "تأیید ناموفق (کد اشتباه)" : "Verification failed (wrong code)" },
            { event: "otp.expired", desc: isFa ? "TTL ۱۰ دقیقه بدون تأیید" : "10-min TTL elapsed without verification" },
          ].map((e, i) => (
            <div key={i} className="rounded-lg border border-gray-800/40 bg-gray-950/40 p-2.5">
              <Ltr><code className="font-mono text-xs text-emerald-300">{e.event}</code></Ltr>
              <p className="mt-0.5 text-xs text-gray-300">{e.desc}</p>
            </div>
          ))}
        </div>
        <Note type="warning">
          {isFa
            ? "هر تحویل قدیمی‌تر از ۵ دقیقه را رد کنید تا از حملات replay جلوگیری شود."
            : "Reject any delivery older than 5 minutes to prevent replay attacks."}
        </Note>
        <GuideLink href="/guide/webhooks" label={isFa ? "راهنمای وب‌هوک‌ها" : "Webhooks Guide"} />
      </DocsChapter>

      {/* ─── Rate Limits ─── */}
      <DocsChapter
        id="rate-limits"
        icon={Gauge}
        title={isFa ? "محدودیت‌های نرخ" : "Rate Limits"}
        description={isFa ? "محدودیت‌های نرخ برای جلوگیری از سوءاستفاده." : "Rate limits to prevent abuse."}
      >
        <div className="overflow-hidden rounded-lg border border-gray-800/40">
          <table className="w-full text-xs">
            <thead className="bg-gray-900/30">
              <tr className="border-b border-gray-800/40 text-left text-gray-500">
                <th className="px-3 py-2 font-medium">{isFa ? "محدودیت" : "Limit"}</th>
                <th className="px-3 py-2 font-medium">{isFa ? "بازه" : "Window"}</th>
                <th className="px-3 py-2 font-medium">{isFa ? "دامنه" : "Scope"}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800/30">
                <td className="px-3 py-2"><Ltr><code className="font-mono text-emerald-300">3/min</code></Ltr></td>
                <td className="px-3 py-2">{isFa ? "۱ دقیقه" : "1 minute"}</td>
                <td className="px-3 py-2">{isFa ? "به ازای هر ایمیل — /send" : "Per email — /send"}</td>
              </tr>
              <tr className="border-b border-gray-800/30">
                <td className="px-3 py-2"><Ltr><code className="font-mono text-emerald-300">10/60</code></Ltr></td>
                <td className="px-3 py-2">{isFa ? "۱ دقیقه / ۱ ساعت" : "1 min / 1 hour"}</td>
                <td className="px-3 py-2">{isFa ? "به ازای هر IP — /send" : "Per IP — /send"}</td>
              </tr>
              <tr className="border-b border-gray-800/30">
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
        <p className="text-xs text-gray-400">
          {isFa
            ? "پاسخ‌های 429 شامل هدر Retry-After هستند. کلیدهای تست محدودیت‌های به ازای ایمیل را رد می‌کنند. پاسخ‌های محدودشده (429) شامل هدرهای X-RateLimit-* هستند."
            : "429 responses include a Retry-After header. Test keys skip per-email limits. Rate-limited responses (429) include X-RateLimit-* headers."}
        </p>
      </DocsChapter>

      {/* ─── Error Codes ─── */}
      <DocsChapter
        id="errors"
        icon={AlertCircle}
        title={isFa ? "کدهای خطا" : "Error Codes"}
        description={isFa ? "فهرست کامل کدهای خطای API از کاتالوگ کانونیک." : "Complete API error code catalog from canonical source."}
      >
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
        <div className="space-y-2">
          {localizedErrors.map((err) => (
            <div
              key={err.code}
              id={`error-${err.code}`}
              className="scroll-mt-20 rounded-lg border border-gray-800/40 bg-gray-950/40 p-3"
            >
              <div className="flex items-center gap-2">
                <Ltr><code className="font-mono text-xs text-emerald-300">{err.code}</code></Ltr>
                <span className="rounded bg-gray-800/60 px-1.5 py-0.5 text-[9px] font-mono text-gray-400">{err.httpStatus}</span>
                <span className="text-xs font-medium text-gray-200">{err.title}</span>
              </div>
              <p className="mt-1 text-xs text-gray-300">{err.description}</p>
              {err.causes.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{isFa ? "علل" : "Causes"}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {err.causes.map((c, i) => <li key={i} className="text-[11px] text-gray-300">• {c}</li>)}
                  </ul>
                </div>
              )}
              {err.fixes.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">{isFa ? "راه‌حل‌ها" : "Fixes"}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {err.fixes.map((f, i) => <li key={i} className="text-[11px] text-gray-300">• {f}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </DocsChapter>

      {/* ─── Sandbox & Testing ─── */}
      <DocsChapter
        id="sandbox"
        icon={FlaskConical}
        title={isFa ? "سندباکس و تست" : "Sandbox & Testing"}
        description={isFa ? "بدون ارسال ایمیل واقعی تست کنید." : "Test without sending real email."}
      >
        <p>
          {isFa
            ? "کلیدهای تست (mg_test_) به‌طور خودکار در حالت سندباکس کار می‌کنند:"
            : "Test keys (mg_test_) automatically run in sandbox mode:"}
        </p>
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-400">✓</span><span>{isFa ? "کد OTP در فیلد code پاسخ بازگردانده می‌شود" : "OTP code is returned in the response code field"}</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-400">✓</span><span>{isFa ? "هیچ ایمیل واقعی ارسال نمی‌شود" : "No real email is sent"}</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-400">✓</span><span>{isFa ? "محدودیت‌های به ازای ایمیل رد می‌شوند" : "Per-email rate limits are skipped"}</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-amber-400">!</span><span>{isFa ? "سهمیه API_MESSAGES پلان همچنان اعمال می‌شود" : "Plan API_MESSAGES quota still applies"}</span></li>
        </ul>
        <p>
          {isFa
            ? "می‌توانید با هدر X-Nixify-Test-Scenario خطاهای شبیه‌سازی‌شده اجباری ایجاد کنید:"
            : "You can force simulated errors with the X-Nixify-Test-Scenario header:"}
        </p>
        <CodeBlock lang="http" label="HTTP Header" code={`X-Nixify-Test-Scenario: hard_bounce`} />
      </DocsChapter>

      {/* ─── Request IDs ─── */}
      <DocsChapter
        id="request-ids"
        icon={Search}
        title={isFa ? "شناسه‌های درخواست" : "Request IDs"}
        description={isFa ? "هر پاسخ شامل یک شناسهٔ درخواست برای دیباگ." : "Every response includes a request ID for debugging."}
      >
        <p>
          {isFa
            ? "همه پاسخ‌ها شامل هدر X-Request-ID هستند که می‌توانید برای دیباگ استفاده کنید:"
            : "All responses include an X-Request-ID header you can use for debugging:"}
        </p>
        <CodeBlock lang="http" label="Response Header" code={`X-Request-ID: req_abc123def456`} />
        <Note type="info">
          {isFa ? "هنگام گزارش مشکل به پشتیبانی، این شناسه را ارائه دهید." : "When reporting an issue to support, include this ID."}
        </Note>
      </DocsChapter>

      {/* ─── Examples ─── */}
      <DocsChapter
        id="examples"
        icon={Code2}
        title={isFa ? "نمونه‌ها" : "Examples"}
        description={isFa ? "نمونه کد برای curl، JavaScript و Python." : "Code examples for curl, JavaScript, and Python."}
      >
        <p className="font-medium text-gray-200">JavaScript / fetch</p>
        <CodeBlock
          lang="javascript"
          label="JavaScript"
          code={`const res = await fetch("${API_BASE}/otp/send", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.NIXIFY_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email: "user@example.com" }),
});
const data = await res.json();
console.log(data);`}
        />
        <p className="font-medium text-gray-200">Python / requests</p>
        <CodeBlock
          lang="python"
          label="Python"
          code={`import os
import requests

res = requests.post(
    "${API_BASE}/otp/send",
    headers={
        "Authorization": f"Bearer {os.environ['NIXIFY_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={"email": "user@example.com"},
)
data = res.json()
print(data)`}
        />
      </DocsChapter>

      {/* ─── Changelog ─── */}
      <DocsChapter
        id="changelog"
        icon={History}
        title={isFa ? "تاریخچهٔ تغییرات" : "Changelog"}
        description={isFa ? "تغییرات API و پلتفرم." : "API and platform changes."}
      >
        <div className="space-y-2">
          <div className="rounded-lg border border-gray-800/40 bg-gray-950/40 p-3">
            <div className="flex items-center gap-2">
              <Ltr><code className="font-mono text-xs text-emerald-300">v1.0.0</code></Ltr>
              <span className="text-xs text-gray-500">2026-07-06</span>
            </div>
            <p className="mt-1 text-xs text-gray-300">
              {isFa
                ? "انتشار اولیهٔ عمومی API. شامل ارسال/تأیید/ارسال مجدد OTP، وب‌هوک‌ها، سندباکس، و کاتالوگ خطا."
                : "Initial public API release. Includes OTP send/verify/resend, webhooks, sandbox, and error catalog."}
            </p>
          </div>
          <div className="rounded-lg border border-gray-800/40 bg-gray-950/40 p-3">
            <div className="flex items-center gap-2">
              <Ltr><code className="font-mono text-xs text-emerald-300">2026.09</code></Ltr>
              <span className="text-xs text-gray-500">2026-09-20</span>
            </div>
            <p className="mt-1 text-xs text-gray-300">
              {isFa
                ? "اعتماد دامنه و شفافیت. صفحه‌های /security و /status، مهاجرت دامنه به nixify.ir."
                : "Domain trust and transparency. /security and /status pages, domain migration to nixify.ir."}
            </p>
          </div>
        </div>
      </DocsChapter>

      {/* ─── Guides Bridge ─── */}
      <DocsChapter
        id="guides-bridge"
        icon={BookOpen}
        title={isFa ? "راهنماها" : "Guides"}
        description={isFa ? "یادگیری بصری جریان‌های کاری." : "Visual workflow learning."}
      >
        <p>
          {isFa
            ? "مستندات مرجع فنی را پوشش می‌دهد. برای یادگیری نحوهٔ استفاده از ویژگی‌ها، راهنماهای تعاملی را ببینید:"
            : "Docs cover technical reference. For learning how to use features, see the interactive guides:"}
        </p>
        <div className="flex flex-wrap gap-3">
          <GuideLink href="/guide" label={isFa ? "مرکز یادگیری" : "Learning Hub"} />
          <GuideLink href="/guide/contacts" label={isFa ? "مخاطبان" : "Contacts"} />
          <GuideLink href="/guide/api-keys" label={isFa ? "کلیدهای API" : "API Keys"} />
          <GuideLink href="/guide/webhooks" label={isFa ? "وب‌هوک‌ها" : "Webhooks"} />
        </div>
      </DocsChapter>
    </>
  );
}
