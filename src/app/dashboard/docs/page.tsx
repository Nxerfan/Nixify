"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCTION_ORIGIN as siteOrigin } from "@/lib/site/site-url";
import { ERRORS_CATALOG } from "@/lib/dx/errors-catalog";
import { getLocalizedError } from "@/lib/dx/errors-catalog-i18n";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, BookOpen, Copy, Rocket, KeyRound, Package, Send,
  Webhook, Gauge, AlertCircle, History, ChevronRight, Sparkles, ExternalLink,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

const SECTIONS_DEF: { id: string; labelKey: string; icon: React.ReactNode }[] = [
  { id: "quickstart", labelKey: "dashboard.docs.quickStart", icon: <Rocket className="h-4 w-4" /> },
  { id: "ai-prompt", labelKey: "dashboard.docs.aiPromptHelper", icon: <Sparkles className="h-4 w-4" /> },
  { id: "authentication", labelKey: "dashboard.docs.authentication", icon: <KeyRound className="h-4 w-4" /> },
  { id: "api-reference", labelKey: "dashboard.docs.apiReference", icon: <Send className="h-4 w-4" /> },
  { id: "api-client", labelKey: "dashboard.docs.apiClient", icon: <Package className="h-4 w-4" /> },
  { id: "webhooks", labelKey: "dashboard.docs.webhooksSection", icon: <Webhook className="h-4 w-4" /> },
  { id: "rate-limits", labelKey: "dashboard.docs.rateLimits", icon: <Gauge className="h-4 w-4" /> },
  { id: "errors", labelKey: "dashboard.docs.errorCodes", icon: <AlertCircle className="h-4 w-4" /> },
  { id: "changelog", labelKey: "dashboard.docs.changelog", icon: <History className="h-4 w-4" /> },
];

interface Section {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
}

const SECTIONS: Section[] = SECTIONS_DEF;

export default function DocsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations();
  const { locale } = useLocale();
  const [active, setActive] = useState("quickstart");

  async function copy(text: string, label = t("dashboard.playground.copied")) {
    try { await navigator.clipboard.writeText(text); toast({ title: label }); }
    catch { toast({ title: t("dashboard.playground.copyFailed"), variant: "destructive" }); }
  }

  function jump(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}><ArrowLeft className="mr-1 h-4 w-4" /> {t("dashboard.nav.dashboard")}</Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><BookOpen className="h-6 w-6 text-emerald-600" /> {t("dashboard.docs.documentation")}</h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.docs.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <nav className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardContent className="p-2">
              <ul className="space-y-0.5">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => jump(s.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${active === s.id
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                    >
                      {s.icon}
                      <span className="flex-1">{t(s.labelKey)}</span>
                      {active === s.id && <ChevronRight className="h-3 w-3" />}
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </nav>

        {/* Content */}
        <div className="space-y-6">
          {/* Quick Start */}
          <section id="quickstart" className="scroll-mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-emerald-600" /> {t("dashboard.docs.quickStart")}</CardTitle>
                <CardDescription>{t("dashboard.docs.quickStartDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Step n={1} title={t("dashboard.docs.stepCreateTestKey")}>
                  <p className="text-sm text-muted-foreground">{t("dashboard.docs.quickStart").split(" ")[0]} <button className="text-emerald-600 hover:underline" onClick={() => router.push("/dashboard/api-keys")}>{t("dashboard.apiKeys.title")}</button>, <strong>{t("dashboard.apiKeys.createKey")}</strong>, <code dir="ltr" className="font-mono">development</code>, <code dir="ltr" className="font-mono">mg_test_…</code> · {t("dashboard.common.sandboxMode")}.</p>
                </Step>
                <Step n={2} title={t("dashboard.docs.stepMakeFirstRequest")}>
                  <CodeBlock
                    label="curl"
                    code={`curl -X POST ${siteOrigin}/api/v1/otp/send \\
  -H "Authorization: Bearer mg_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","purpose":"signup"}'`}
                    onCopy={copy}
                  />
                  <p className="text-xs text-muted-foreground">{t("dashboard.docs.useYourKey")} <code dir="ltr" className="font-mono">mg_test_</code> {t("dashboard.docs.keyForQuickStart")} <code dir="ltr" className="font-mono">code</code> {t("dashboard.docs.codeFieldWithOtp")} <code dir="ltr" className="font-mono">/verify</code> {t("dashboard.docs.immediatelyWithoutInbox")}</p>
                </Step>
                <Step n={3} title={t("dashboard.docs.verifyTheCode")}>
                  <CodeBlock
                    label="JavaScript"
                    code={`const res = await fetch('${siteOrigin}/api/v1/otp/send', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer mg_test_xxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: 'user@example.com', purpose: 'signup' }),
});
const data = await res.json();
console.log(data.code);        // sandbox: the plaintext OTP (mg_test_ only)
console.log(data.otp_request_id);

// Then verify:
const verify = await fetch('${siteOrigin}/api/v1/otp/verify', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer mg_test_xxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    code: data.code,
    purpose: 'signup',
  }),
});
console.log((await verify.json()).verified); // true`}
                    onCopy={copy}
                  />
                </Step>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-muted-foreground dark:border-emerald-900 dark:bg-emerald-950">
                  <strong className="text-emerald-700 dark:text-emerald-300">{t("dashboard.common.testVsLive")}:</strong>{" "}
                  <code dir="ltr" className="font-mono">mg_test_</code> · {t("dashboard.common.sandboxMode")} · <code dir="ltr" className="font-mono">mg_live_</code>.
                </div>
              </CardContent>
            </Card>
          </section>

          {/* AI Prompt Helper */}
          <AIPromptSection copyFn={copy} />


          {/* Authentication */}
          <section id="authentication" className="scroll-mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-emerald-600" /> {t("dashboard.docs.authentication")}</CardTitle>
                <CardDescription>{t("dashboard.docs.authenticationDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>{t("dashboard.docs.sendKeyInHeader")} <code dir="ltr" className="font-mono">Authorization</code> {t("dashboard.docs.headerAsBearer")}</p>
                <CodeBlock
                  label="Header"
                  code="Authorization: Bearer mg_test_xxxxxxxxxxxxxxxxxxxxxxxx"
                  onCopy={copy}
                />
                <Separator />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">test</Badge>
                    <div className="mt-2 font-mono text-xs">mg_test_…</div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.docs.testKeyDesc")} <code dir="ltr" className="font-mono">code</code> {t("dashboard.docs.testKeyDesc2")} <code dir="ltr" className="font-mono">/send</code> {t("dashboard.docs.testKeyDesc3")} <code dir="ltr" className="font-mono">/resend</code> {t("dashboard.docs.testKeyDesc4")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.docs.optionallyForce")} <code dir="ltr" className="font-mono">X-Sandbox-Simulate</code> {t("dashboard.docs.headerOneOf")} <code dir="ltr" className="font-mono">rate_limited</code>, <code dir="ltr" className="font-mono">locked</code>, <code dir="ltr" className="font-mono">expired</code>, <code dir="ltr" className="font-mono">mismatch</code>, <code dir="ltr" className="font-mono">smtp_error</code> {t("dashboard.docs.liveKeysCannotSandbox")}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">live</Badge>
                    <div className="mt-2 font-mono text-xs">mg_live_…</div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.docs.liveKeyDesc")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* API Reference */}
          <section id="api-reference" className="scroll-mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-emerald-600" /> {t("dashboard.docs.apiReference")}</CardTitle>
                <CardDescription>{t("dashboard.docs.apiReferenceDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <EndpointDoc
                  method="POST"
                  path="/api/v1/otp/send"
                  purpose="Issue + deliver a new OTP code to the given email."
                  requestSchema={[
                    { field: "email", type: "string", required: true, desc: "RFC 5322 email address (lowercased, trimmed)" },
                    { field: "purpose", type: "string", required: false, desc: "signup | login | reset (defaults to signup)" },
                  ]}
                  responseSchema={[
                    { field: "otp_request_id", type: "string", desc: "OTP correlation ID (for webhook correlation)" },
                    { field: "request_id", type: "string", desc: "API request trace ID (matches X-Request-Id header)" },
                    { field: "expires_at", type: "string (ISO)", desc: "10-minute TTL" },
                    { field: "message", type: "string", desc: "\"OTP sent\"" },
                    { field: "code", type: "string", desc: "Sandbox only (mg_test_ keys): the plaintext 6-digit OTP. Never present for mg_live_ keys." },
                  ]}
                  exampleReq={`{
  "email": "user@example.com",
  "purpose": "signup"
}`}
                  exampleRes={`{
  "otp_request_id": "f3a2b1c8-...",
  "request_id": "a1b2c3d4-...",
  "expires_at": "2026-07-06T22:50:00.000Z",
  "message": "OTP sent",
  "code": "123456"
}`}
                  errors={["validation_failed", "rate_limited", "locked", "ip_blocked", "internal_error"]}
                  onCopy={copy}
                />
                <Separator />
                <EndpointDoc
                  method="POST"
                  path="/api/v1/otp/verify"
                  purpose="Verify the 6-digit code entered by the user."
                  requestSchema={[
                    { field: "email", type: "string", required: true, desc: "Same email used in /send" },
                    { field: "code", type: "string", required: true, desc: "Exactly 6 numeric digits" },
                    { field: "purpose", type: "string", required: false, desc: "signup | login | reset (defaults to signup)" },
                  ]}
                  responseSchema={[
                    { field: "verified", type: "boolean", desc: "true on success" },
                    { field: "otp_request_id", type: "string", desc: "OTP correlation ID of the consumed attempt" },
                    { field: "request_id", type: "string", desc: "API request trace ID (matches X-Request-Id header)" },
                  ]}
                  exampleReq={`{
  "email": "user@example.com",
  "code": "123456",
  "purpose": "signup"
}`}
                  exampleRes={`{
  "verified": true,
  "otp_request_id": "f3a2b1c8-...",
  "request_id": "a1b2c3d4-..."
}`}
                  errors={["validation_failed", "code_mismatch", "expired", "already_used", "locked", "not_found", "rate_limited", "ip_blocked", "internal_error"]}
                  onCopy={copy}
                />
                <Separator />
                <EndpointDoc
                  method="POST"
                  path="/api/v1/otp/resend"
                  purpose="Send a fresh code if the user didn&apos;t receive the first one."
                  requestSchema={[
                    { field: "email", type: "string", required: true, desc: "Target email" },
                    { field: "purpose", type: "string", required: false, desc: "signup | login | reset (defaults to signup)" },
                  ]}
                  responseSchema={[
                    { field: "otp_request_id", type: "string", desc: "OTP correlation ID for the new attempt" },
                    { field: "request_id", type: "string", desc: "API request trace ID (matches X-Request-Id header)" },
                    { field: "expires_at", type: "string (ISO)", desc: "10-minute TTL" },
                    { field: "message", type: "string", desc: "\"OTP resent\"" },
                    { field: "code", type: "string", desc: "Sandbox only (mg_test_ keys): the plaintext 6-digit OTP. Never present for mg_live_ keys." },
                  ]}
                  exampleReq={`{
  "email": "user@example.com",
  "purpose": "signup"
}`}
                  exampleRes={`{
  "otp_request_id": "9c1d7e44-...",
  "request_id": "e5f6g7h8-...",
  "expires_at": "2026-07-06T22:55:00.000Z",
  "message": "OTP resent",
  "code": "654321"
}`}
                  errors={["validation_failed", "rate_limited", "locked", "ip_blocked", "internal_error"]}
                  onCopy={copy}
                />
                <p className="text-xs text-muted-foreground"><strong>{t("dashboard.docs.allEndpoints")}</strong> {t("dashboard.docs.authErrorsNote")}</p>
              </CardContent>
            </Card>
          </section>

          {/* API Client */}
          <section id="api-client" className="scroll-mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-emerald-600" /> {t("dashboard.docs.apiClient")}</CardTitle>
                <CardDescription>{t("dashboard.docs.apiClientDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <CodeBlock label="JavaScript (fetch)" code={`const res = await fetch('${siteOrigin}/api/v1/otp/send', { method: 'POST', headers: { 'Authorization': 'Bearer mg_test_xxx', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'user@example.com', purpose: 'signup' }) });`} onCopy={copy} />
                <CodeBlock label="Python (requests)" code={`import requests; res = requests.post('${siteOrigin}/api/v1/otp/send', headers={'Authorization': 'Bearer mg_test_xxx'}, json={'email': 'user@example.com', 'purpose': 'signup'})`} onCopy={copy} />
              </CardContent>
            </Card>
          </section>

          {/* Webhooks */}
          <section id="webhooks" className="scroll-mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5 text-emerald-600" /> {t("dashboard.docs.webhooksSection")}</CardTitle>
                <CardDescription>{t("dashboard.docs.webhooksDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>{t("dashboard.docs.registerEndpoints")} <button className="text-emerald-600 hover:underline" onClick={() => router.push("/dashboard/webhooks")}>{t("dashboard.docs.webhooksDashboard")}</button> {t("dashboard.docs.eachDeliverySigned")} <code dir="ltr" className="font-mono">Nixify-Signature</code> {t("dashboard.docs.andHeaders")} <code dir="ltr" className="font-mono">Nixify-Event</code> {t("dashboard.docs.headersLabel")}</p>
                <CodeBlock
                  label="Delivery headers"
                  code={`Nixify-Signature: t=1720000000000,v1=8c2f1e9a7b3d4f5e6a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f
Nixify-Event: otp.sent
Content-Type: application/json`}
                  onCopy={copy}
                />
                <p className="text-xs text-muted-foreground">{t("dashboard.docs.tComponentIs")} <code dir="ltr" className="font-mono">t</code> {t("dashboard.docs.tComponentDesc")} <code dir="ltr" className="font-mono">v1</code> {t("dashboard.docs.v1ComponentIs")} <code dir="ltr" className="font-mono">{`${'`${t}.${payload}`'}`}</code> {t("dashboard.docs.usingSecret")}</p>
                <div>
                  <h4 className="mb-2 font-medium">{t("dashboard.docs.verifySignature")}</h4>
                  <CodeBlock
                    label="Node.js"
                    code={`import crypto from 'crypto';

function verify(secret, payload, signatureHeader) {
  const { t, v1 } = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('='))
  );
  const signed = \`\${t}.\${payload}\`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signed)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected), Buffer.from(v1)
  );
}`}
                    onCopy={copy}
                  />
                </div>
                <div>
                  <h4 className="mb-2 font-medium">{t("dashboard.docs.events")}</h4>
                  <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                    <li><code dir="ltr" className="font-mono">otp.sent</code> — {t("dashboard.docs.otpSentDesc")}</li>
                    <li><code dir="ltr" className="font-mono">otp.verified</code> — {t("dashboard.docs.otpVerifiedDesc")}</li>
                    <li><code dir="ltr" className="font-mono">otp.failed</code> — {t("dashboard.docs.otpFailedDesc")}</li>
                    <li><code dir="ltr" className="font-mono">otp.expired</code> — {t("dashboard.docs.otpExpiredDesc")}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Rate Limits */}
          <section id="rate-limits" className="scroll-mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-emerald-600" /> {t("dashboard.docs.rateLimits")}</CardTitle>
                <CardDescription>{t("dashboard.docs.rateLimitsDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="max-h-64 overflow-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="border-b text-left">
                        <th className="px-3 py-2 font-medium">{t("dashboard.docs.scope")}</th>
                        <th className="px-3 py-2 font-medium">{t("dashboard.docs.limit")}</th>
                        <th className="px-3 py-2 font-medium">{t("dashboard.docs.window")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b"><td className="px-3 py-2">{t("dashboard.docs.perEmailSend")}</td><td className="px-3 py-2">3</td><td className="px-3 py-2">{t("dashboard.docs.oneMinute")}</td></tr>
                      <tr className="border-b"><td className="px-3 py-2">{t("dashboard.docs.perEmailSend")}</td><td className="px-3 py-2">10</td><td className="px-3 py-2">{t("dashboard.docs.oneHour")}</td></tr>
                      <tr className="border-b"><td className="px-3 py-2">{t("dashboard.docs.perIpSend")}</td><td className="px-3 py-2">10 / 60</td><td className="px-3 py-2">{t("dashboard.docs.oneMinOneHr")}</td></tr>
                      <tr><td className="px-3 py-2">{t("dashboard.docs.perIpVerify")}</td><td className="px-3 py-2">30 / 120</td><td className="px-3 py-2">{t("dashboard.docs.oneMinOneHr")}</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">{t("dashboard.docs.perEmailLimitsApply")} <code dir="ltr" className="font-mono">mg_live_</code> {t("dashboard.docs.keysOnlyTestSkip")}</p>
                <div className="space-y-1.5">
                  <p><strong>{t("dashboard.docs.responseHeaders")}</strong></p>
                  <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                    <li>{t("dashboard.docs.allResponsesInclude")} <code dir="ltr" className="font-mono">X-Request-Id</code> {t("dashboard.docs.matchesBody")} <code dir="ltr" className="font-mono">request_id</code>) {t("dashboard.docs.and")} <code dir="ltr" className="font-mono">X-Api-Version: 1</code>.</li>
                    <li>{t("dashboard.docs.successfulInclude")} <code dir="ltr" className="font-mono">X-Quota-Remaining</code> {t("dashboard.docs.forPlanQuota")}</li>
                    <li>{t("dashboard.docs.rateLimitedInclude")} <code dir="ltr" className="font-mono">Retry-After</code> {t("dashboard.docs.headerSeconds")} <code dir="ltr" className="font-mono">X-RateLimit-Limit</code>, <code dir="ltr" className="font-mono">X-RateLimit-Remaining</code>, {t("dashboard.docs.and")} <code dir="ltr" className="font-mono">X-RateLimit-Reset</code>.</li>
                    <li>{t("dashboard.docs.planRateInclude")} <code dir="ltr" className="font-mono">rate_limited</code> {t("dashboard.docs.fromEntitlement")} <code dir="ltr" className="font-mono">X-RateLimit-Reset</code> {t("dashboard.docs.and")} <code dir="ltr" className="font-mono">X-Quota-Remaining</code> — {t("dashboard.docs.theyDoNot")} <strong>{t("dashboard.docs.notInclude")}</strong> {t("dashboard.docs.includeRetryAfter")} <code dir="ltr" className="font-mono">Retry-After</code>.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Error Codes */}
          <section id="errors" className="scroll-mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-emerald-600" /> {t("dashboard.docs.errorCodes")}</CardTitle>
                <CardDescription>{t("dashboard.docs.errorCodesDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <CodeBlock
                  label="Error envelope (every error response)"
                  code={`{
  "error": {
    "code": "rate_limited",
    "message": "Too many OTP sends. Retry in 47s.",
    "doc_url": "/docs#error-rate_limited"
  },
  "request_id": "a1b2c3d4-..."
}`}
                  onCopy={copy}
                />
                <p className="text-xs text-muted-foreground">{t("dashboard.docs.docUrlPointsTo")} <code dir="ltr" className="font-mono">doc_url</code> {t("dashboard.docs.fieldAlwaysPoints")} <button className="text-emerald-600 hover:underline" onClick={() => router.push("/docs")}>{t("dashboard.docs.publicDocsPage")}</button> {t("dashboard.docs.everyCodeBelow")} <code dir="ltr" className="font-mono">#error-&lt;code&gt;</code> {t("dashboard.docs.jumpLink")} <button className="text-emerald-600 hover:underline" onClick={() => router.push("/dashboard/errors")}>{t("dashboard.docs.errorExplorer")}</button> {t("dashboard.docs.providesSameData")}</p>
                <Separator />
                <div className="space-y-2">
                  {ERRORS_CATALOG.map((e) => (
                    <div key={e.code} id={`error-${e.code}`} className="scroll-mt-24 rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <code dir="ltr" className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{e.code}</code>
                        <Badge variant="outline" className="text-[10px]">HTTP {e.httpStatus}</Badge>
                        <span className="text-xs text-muted-foreground">{e.title}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{e.description}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("dashboard.docs.causes")}</span>
                          <ul className="ml-3 list-disc text-xs text-muted-foreground">
                            {e.causes.map((c) => <li key={c}>{c}</li>)}
                          </ul>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("dashboard.docs.fixes")}</span>
                          <ul className="ml-3 list-disc text-xs text-muted-foreground">
                            {e.fixes.map((f) => <li key={f}>{f}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Changelog */}
          <section id="changelog" className="scroll-mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-emerald-600" /> {t("dashboard.docs.changelog")}</CardTitle>
                <CardDescription>{t("dashboard.docs.changelogDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <ChangeItem version="v1.0.0" date="2026-07-06">
                  <li>{t("dashboard.docs.initialRelease")}</li>
                  <li>{t("dashboard.docs.endpoints")} <code dir="ltr" className="font-mono">/api/v1/otp/send</code>, <code dir="ltr" className="font-mono">/api/v1/otp/verify</code>, <code dir="ltr" className="font-mono">/api/v1/otp/resend</code>.</li>
                  <li>{t("dashboard.docs.apiKeysScopes")}</li>
                  <li>{t("dashboard.docs.webhooksHmac")}(<code dir="ltr" className="font-mono">Nixify-Signature</code> + <code dir="ltr" className="font-mono">Nixify-Event</code> headers).</li>
                  <li>{t("dashboard.docs.sandboxModeHeader")}</li>
                </ChangeItem>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{n}</div>
      <div className="flex-1 space-y-2">
        <h4 className="font-medium">{title}</h4>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ label, code, onCopy }: { label: string; code: string; onCopy: (text: string, label?: string) => void }) {
  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button size="sm" variant="ghost" className="h-6" onClick={() => onCopy(code, `${label} copied`)}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <pre dir="ltr" className="overflow-auto p-3 text-xs">{code}</pre>
    </div>
  );
}

interface SchemaRow {
  field: string;
  type: string;
  required?: boolean;
  desc: string;
}

function EndpointDoc({
  method, path, purpose, requestSchema, responseSchema, exampleReq, exampleRes, errors, onCopy,
}: {
  method: string;
  path: string;
  purpose: string;
  requestSchema: SchemaRow[];
  responseSchema: SchemaRow[];
  exampleReq: string;
  exampleRes: string;
  errors: string[];
  onCopy: (text: string, label?: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{method}</span>
        <code dir="ltr" className="font-mono text-sm">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{purpose}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("dashboard.docs.requestBody")}</h5>
          <div className="overflow-auto rounded border">
            <table className="w-full text-xs">
              <tbody>
                {requestSchema.map((r) => (
                  <tr key={r.field} className="border-b last:border-0">
                    <td className="px-2 py-1.5 font-mono">{r.field}{r.required && <span className="ml-1 text-rose-600">*</span>}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.type}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("dashboard.docs.responseBody")}</h5>
          <div className="overflow-auto rounded border">
            <table className="w-full text-xs">
              <tbody>
                {responseSchema.map((r) => (
                  <tr key={r.field} className="border-b last:border-0">
                    <td className="px-2 py-1.5 font-mono">{r.field}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.type}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <CodeBlock label={t("dashboard.docs.exampleRequest")} code={exampleReq} onCopy={onCopy} />
        <CodeBlock label={t("dashboard.docs.exampleResponse")} code={exampleRes} onCopy={onCopy} />
      </div>
      <div>
        <h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("dashboard.docs.possibleErrors")}</h5>
        <div className="flex flex-wrap gap-1.5">
          {errors.map((e) => <Badge key={e} variant="outline" className="font-mono text-[10px]">{e}</Badge>)}
        </div>
      </div>
    </div>
  );
}

function ChangeItem({ version, date, children }: { version: string; date: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{version}</Badge>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>
      <ul className="ml-4 list-disc space-y-0.5 text-sm text-muted-foreground">{children}</ul>
    </div>
  );
}

// ---- AI Prompt Helper section ----
//
// This section provides a beginner-friendly prompt that users can copy and
// paste into any AI model (ChatGPT, Claude, DeepSeek, Z.ai). The prompt asks
// the AI to generate a step-by-step integration guide for the Nixify OTP
// service in ANY programming language. Below the prompt is a "Go to an AI
// model" dropdown that links to the four supported AI providers.

const AI_PROMPT_TEXT = `You are a helpful coding assistant. I'm a beginner and I want to use the Nixify email OTP verification service in my project.

Please write a complete, step-by-step guide for integrating Nixify into my app using [MY PROGRAMMING LANGUAGE — e.g., JavaScript, Python, PHP, Go, Ruby, Java, C#]. Explain each step simply so a beginner can follow along.

Here's what you need to know about Nixify:

SERVICE OVERVIEW
- Nixify is an email OTP (one-time password) verification API.
- You send a user's email address to Nixify, Nixify emails them a 6-digit code, then you verify the code they entered.
- Three API endpoints: send OTP, verify OTP, resend OTP.
- Base URL: https://nixify.ir/api/v1

AUTHENTICATION
- Create an API key in the Nixify dashboard. Use mg_test_ for development and CI, mg_live_ for production.
- Send the key as a Bearer token in the Authorization header:
  Authorization: Bearer mg_test_xxxxxxxxxxxxxxxxxxxxxxxx

SANDBOX MODE (mg_test_ keys only)
- Test keys run in sandbox mode automatically: OTPs are generated and stored but NO real email is sent. The plaintext 6-digit code is returned in the "code" field of the /send and /resend response so you can call /verify immediately without an inbox.
- Test keys skip the per-email rate limit (3/min, 10/hour) so CI can run fast. The per-IP limit still applies. User-owned test keys still consume the plan API_MESSAGES quota.
- Optionally force a simulated error with the X-Sandbox-Simulate header: rate_limited, locked, expired, mismatch, smtp_error.
- Live keys (mg_live_) CANNOT use sandbox mode — they always send real email.

STEP 1 — SEND OTP
POST /api/v1/otp/send
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

Body:
{
  "email": "user@example.com",
  "purpose": "signup"
}

Response (200):
{
  "otp_request_id": "uuid-here",
  "request_id": "trace-uuid",
  "expires_at": "2026-07-06T22:50:00.000Z",
  "message": "OTP sent",
  "code": "123456"
}
With a mg_live_ key, Nixify emails the user a 6-digit code and the "code" field is NOT present. The code expires in 10 minutes. With a mg_test_ key, no email is sent and "code" contains the plaintext OTP (sandbox mode).

STEP 2 — VERIFY OTP
POST /api/v1/otp/verify
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

Body:
{
  "email": "user@example.com",
  "code": "123456",
  "purpose": "signup"
}

Response (200):
{
  "verified": true,
  "otp_request_id": "uuid-here",
  "request_id": "trace-uuid"
}
If verified is true, the email is confirmed. Each code can only be used once.

STEP 3 — RESEND OTP (optional, if the user didn't get the email)
POST /api/v1/otp/resend
Body: { "email": "user@example.com", "purpose": "signup" }

RATE LIMITS
- Per email — /send: 3 per minute, 10 per hour (mg_live_ keys only; test keys skip these)
- Per IP — /send: 10 per minute, 60 per hour (all keys)
- Per IP — /verify: 30 per minute, 120 per hour (all keys)
- When rate limited, the API returns 429. IP-level and email-level 429s include a Retry-After header (seconds); email-level 429s also include X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset. Plan-rate 429s (rate_limited from the per-minute plan rate) include X-RateLimit-Reset and X-Quota-Remaining instead of Retry-After.
- All responses include X-Request-Id (matches the body request_id) and X-Api-Version: 1. Successful (2xx) responses include X-Quota-Remaining.

ERROR HANDLING
The API returns JSON errors with this shape:
{ "error": { "code": "rate_limited", "message": "Too many OTP sends.", "doc_url": "/docs#error-rate_limited" }, "request_id": "uuid" }
The doc_url field points to a public docs anchor that explains the code.
Common error codes: validation_failed, unauthorized, key_revoked, key_expired, insufficient_scope, rate_limited, code_mismatch, expired, already_used, locked, not_found, ip_blocked, quota_exceeded, feature_not_available, internal_error.

WHAT I NEED FROM YOU
1. Write the complete integration in [MY LANGUAGE] — a single file I can run.
2. Include all three steps: send, verify, resend.
3. Show how to handle errors (try/catch, check response status, display the error message to the user).
4. Note that otp_request_id is for correlation/observability only — verify does NOT require it as input.
5. Add comments explaining each line for a beginner.
6. Show how to test it locally (what to install, how to run it).
7. Keep it simple — no frameworks, just plain [MY LANGUAGE] code using the standard library or a simple HTTP client.`;

const AI_MODELS = [
  { name: "ChatGPT", url: "https://chat.openai.com/", color: "#10a37f", desc: "OpenAI" },
  { name: "Claude", url: "https://claude.ai/new", color: "#d97757", desc: "Anthropic" },
  { name: "DeepSeek", url: "https://chat.deepseek.com/", color: "#4d6bfe", desc: "DeepSeek" },
  { name: "Z.ai", url: "https://chat.z.ai/", color: "#059669", desc: "Z.ai" },
];

function AIPromptSection({ copyFn }: { copyFn: (text: string, label?: string) => void }) {
  const t = useTranslations();
  const [showModels, setShowModels] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopyPrompt() {
    copyFn(AI_PROMPT_TEXT, t("dashboard.docs.promptCopied"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleModelClick(url: string) {
    setShowModels(false);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section id="ai-prompt" className="scroll-mt-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" /> {t("dashboard.docs.aiPromptHelper")}
          </CardTitle>
          <CardDescription>
            {t("dashboard.docs.aiPromptHelper")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* What this does */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" /> {t("dashboard.docs.howThisWorks")}
            </h4>
            <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
              <li>{t("dashboard.docs.copyPrompt")}.</li>
              <li>{t("dashboard.docs.pasteIntoModel")}</li>
              <li>{t("dashboard.docs.replacePlaceholder")} <code dir="ltr" className="rounded bg-muted px-1 font-mono text-xs">[MY PROGRAMMING LANGUAGE]</code> {t("dashboard.docs.withYourLanguage")}</li>
              <li>{t("dashboard.docs.theAiWillGenerate")}</li>
            </ol>
          </div>

          {/* The prompt — in a scrollable code block */}
          <div className="rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                {t("dashboard.docs.thePrompt")}
              </span>
              <Button
                size="sm"
                onClick={handleCopyPrompt}
                className={`h-7 ${copied
                  ? "bg-emerald-600 text-white hover:bg-emerald-600"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"}`}
              >
                {copied ? (
                  <>
                    <svg className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {t("dashboard.docs.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    {t("dashboard.docs.copyPrompt")}
                  </>
                )}
              </Button>
            </div>
            <pre dir="ltr" className="max-h-80 overflow-auto p-3 text-xs leading-relaxed">
              <code dir="ltr">{AI_PROMPT_TEXT}</code>
            </pre>
          </div>

          {/* Go to an AI model — hover dropdown */}
          <div className="rounded-lg border p-4">
            <h4 className="mb-1 text-sm font-medium">{t("dashboard.docs.nowPasteItIntoAiModel")}</h4>
            <p className="mb-3 text-xs text-muted-foreground">
              {t("dashboard.docs.aiModelHoverHint")}
            </p>

            {/* Hover dropdown */}
            <div
              className="relative inline-block"
              onMouseEnter={() => setShowModels(true)}
              onMouseLeave={() => setShowModels(false)}
            >
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                onClick={() => setShowModels((s) => !s)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {t("dashboard.docs.goToAiModel")}
                <ChevronRight className={`ml-1 h-3.5 w-3.5 transition-transform ${showModels ? "rotate-90" : ""}`} />
              </Button>

              {/* Dropdown menu */}
              {showModels && (
                <div className="absolute left-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                  <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
                    <p className="text-xs font-medium text-muted-foreground">{t("dashboard.docs.chooseAiModel")}</p>
                  </div>
                  <ul className="py-1">
                    {AI_MODELS.map((model) => (
                      <li key={model.name}>
                        <button
                          onClick={() => handleModelClick(model.url)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        >
                          {/* Color dot */}
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                            style={{ backgroundColor: model.color }}
                          >
                            {model.name[0]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium">{model.name}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{model.desc}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-800">
                    <p className="text-[11px] text-muted-foreground">
                      {t("dashboard.docs.aiModelTip")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
