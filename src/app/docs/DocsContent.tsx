"use client";

import { useState } from "react";
import Link from "next/link";
import { PRODUCTION_ORIGIN as siteOrigin } from "@/lib/site/site-url";
import { ERRORS_CATALOG } from "@/lib/dx/errors-catalog";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Copy, Rocket, KeyRound, Package, Send,
  Webhook, Gauge, AlertCircle, History, ChevronRight, Sparkles, ExternalLink,
} from "lucide-react";

/**
 * Public API documentation UI — the single source of truth for API consumers.
 *
 * This page is fully public (no login required). The Error Codes section is
 * rendered directly from `ERRORS_CATALOG` so the docs and the API error
 * envelope's `doc_url` field (which points to `/docs#error-<code>`) can
 * never drift apart.
 *
 * Internal dashboard references (API Keys, Webhooks) are rendered as `<Link>`
 * components that are auth-gated — anonymous visitors are redirected to /auth
 * by middleware. These are management UIs, not error documentation, so they
 * remain dashboard-only.
 */

interface Section {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const SECTIONS: Section[] = [
  { id: "quickstart", label: "Quick Start", icon: <Rocket className="h-4 w-4" /> },
  { id: "ai-prompt", label: "AI Prompt Helper", icon: <Sparkles className="h-4 w-4" /> },
  { id: "authentication", label: "Authentication", icon: <KeyRound className="h-4 w-4" /> },
  { id: "api-reference", label: "API Reference", icon: <Send className="h-4 w-4" /> },
  { id: "api-client", label: "API Client", icon: <Package className="h-4 w-4" /> },
  { id: "webhooks", label: "Webhooks", icon: <Webhook className="h-4 w-4" /> },
  { id: "rate-limits", label: "Rate Limits", icon: <Gauge className="h-4 w-4" /> },
  { id: "errors", label: "Error Codes", icon: <AlertCircle className="h-4 w-4" /> },
  { id: "changelog", label: "Changelog", icon: <History className="h-4 w-4" /> },
];

export function PublicDocsContent() {
  const { toast } = useToast();
  const [active, setActive] = useState("quickstart");

  async function copy(text: string, label = "Copied") {
    try { await navigator.clipboard.writeText(text); toast({ title: label }); }
    catch { toast({ title: "Copy failed", variant: "destructive" }); }
  }

  function jump(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="relative min-h-screen px-4 pb-24 pt-28 sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* Header — standalone public page header (no "back to dashboard") */}
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <BookOpen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /> Documentation
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything you need to integrate the Nixify OTP API. Public — no sign-in required.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <nav className="lg:sticky lg:top-24 lg:self-start">
            <Card className="border-border bg-card/60 backdrop-blur-xl">
              <CardContent className="p-2">
                <ul className="space-y-0.5">
                  {SECTIONS.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => jump(s.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${active === s.id
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "text-muted-foreground hover:bg-border/40 hover:text-foreground"}`}
                      >
                        {s.icon}
                        <span className="flex-1">{s.label}</span>
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
              <Card className="border-border bg-card/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground"><Rocket className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Quick Start</CardTitle>
                  <CardDescription className="text-muted-foreground">Make your first OTP request in minutes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Step n={1} title="Create a test API key">
                    <p className="text-sm text-muted-foreground">
                      Go to <Link className="text-emerald-600 dark:text-emerald-400 hover:underline" href="/dashboard/api-keys">API Keys</Link> in the dashboard,
                      click <strong>Create API Key</strong>, choose <code dir="ltr" className="font-mono">development</code> environment,
                      then copy the generated <code dir="ltr" className="font-mono">mg_test_…</code> key.
                      Test keys run in <strong>sandbox mode</strong> automatically — no real email is sent and
                      the OTP code is returned in the response body.
                    </p>
                  </Step>
                  <Step n={2} title="Make your first request">
                    <CodeBlock
                      label="curl"
                      code={`curl -X POST ${siteOrigin}/api/v1/otp/send \\
  -H "Authorization: Bearer mg_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","purpose":"signup"}'`}
                      onCopy={copy}
                    />
                    <p className="text-xs text-muted-foreground/70">
                      Use your <code dir="ltr" className="font-mono">mg_test_</code> key for the Quick Start. The response
                      includes a <code dir="ltr" className="font-mono">code</code> field with the plaintext OTP so you can
                      call <code dir="ltr" className="font-mono">/verify</code> immediately without checking an inbox.
                    </p>
                  </Step>
                  <Step n={3} title="Verify the code">
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
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
                    <strong className="text-emerald-700 dark:text-emerald-300">Test vs live keys:</strong>{" "}
                    <code dir="ltr" className="font-mono">mg_test_</code> keys run in sandbox mode (no real email, code
                    returned in the response, per-email rate limits skipped). <code dir="ltr" className="font-mono">mg_live_</code>{" "}
                    keys send real email via Nixify&apos;s managed delivery and enforce all rate limits.
                    When you&apos;re ready to go live, create a <code dir="ltr" className="font-mono">production</code> environment key
                    and swap <code dir="ltr" className="font-mono">mg_test_xxx</code> for <code dir="ltr" className="font-mono">mg_live_xxx</code> in your code.
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* AI Prompt Helper */}
            <AIPromptSection copyFn={copy} />

            {/* Authentication */}
            <section id="authentication" className="scroll-mt-4">
              <Card className="border-border bg-card/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground"><KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Authentication</CardTitle>
                  <CardDescription className="text-muted-foreground">All API requests require a Bearer token.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="text-muted-foreground">
                    Send your API key in the <code dir="ltr" className="font-mono">Authorization</code> header as a Bearer token:
                  </p>
                  <CodeBlock
                    label="Header"
                    code="Authorization: Bearer mg_test_xxxxxxxxxxxxxxxxxxxxxxxx"
                    onCopy={copy}
                  />
                  <Separator className="bg-border/60" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border p-3">
                      <Badge className="bg-amber-500/15 text-amber-300">test</Badge>
                      <div className="mt-2 font-mono text-xs text-muted-foreground">mg_test_…</div>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        Development &amp; CI. <strong>Sandbox mode is automatic</strong> — OTPs are generated
                        and persisted exactly as in production, but no real email is sent; the plaintext
                        code is returned in the <code dir="ltr" className="font-mono">code</code> field of the
                        <code dir="ltr" className="font-mono">/send</code> and <code dir="ltr" className="font-mono">/resend</code> response.
                        Per-email rate limits are skipped so tests can run fast. Plan API_MESSAGES quota still applies to user-owned test keys.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        Optionally force simulated errors with the{" "}
                        <code dir="ltr" className="font-mono">X-Sandbox-Simulate</code> header (one of{" "}
                        <code dir="ltr" className="font-mono">rate_limited</code>, <code dir="ltr" className="font-mono">locked</code>,
                        <code dir="ltr" className="font-mono">expired</code>, <code dir="ltr" className="font-mono">mismatch</code>,
                        <code dir="ltr" className="font-mono">smtp_error</code>). Live keys cannot use sandbox mode.
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">live</Badge>
                      <div className="mt-2 font-mono text-xs text-muted-foreground">mg_live_…</div>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        Production only. Nixify sends real email through its managed delivery
                        infrastructure (API customers do not provide SMTP credentials). All rate
                        limits and quotas are enforced. Sandbox mode is not available.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* API Reference */}
            <section id="api-reference" className="scroll-mt-4">
              <Card className="border-border bg-card/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground"><Send className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> API Reference</CardTitle>
                  <CardDescription className="text-muted-foreground">Three endpoints, one purpose: verify an email address.</CardDescription>
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
                  <Separator className="bg-border/60" />
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
                  <Separator className="bg-border/60" />
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
                  <p className="text-xs text-muted-foreground/70">
                    <strong className="text-muted-foreground">All endpoints</strong> can also return authentication errors
                    (<code dir="ltr" className="font-mono">unauthorized</code>, <code dir="ltr" className="font-mono">key_revoked</code>,
                    <code dir="ltr" className="font-mono">key_expired</code>, <code dir="ltr" className="font-mono">insufficient_scope</code>)
                    and plan-entitlement errors (<code dir="ltr" className="font-mono">quota_exceeded</code>,
                    <code dir="ltr" className="font-mono">feature_not_available</code>). See the Error Codes section below for the full catalog.
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* API Client */}
            <section id="api-client" className="scroll-mt-4">
              <Card className="border-border bg-card/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground"><Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> API Client</CardTitle>
                  <CardDescription className="text-muted-foreground">Use the REST API from any HTTP client.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <CodeBlock label="JavaScript (fetch)" code={`const res = await fetch('${siteOrigin}/api/v1/otp/send', { method: 'POST', headers: { 'Authorization': 'Bearer mg_test_xxx', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'user@example.com', purpose: 'signup' }) });`} onCopy={copy} />
                  <CodeBlock label="Python (requests)" code={`import requests; res = requests.post('${siteOrigin}/api/v1/otp/send', headers={'Authorization': 'Bearer mg_test_xxx'}, json={'email': 'user@example.com', 'purpose': 'signup'})`} onCopy={copy} />
                </CardContent>
              </Card>
            </section>

            {/* Webhooks */}
            <section id="webhooks" className="scroll-mt-4">
              <Card className="border-border bg-card/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground"><Webhook className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Webhooks</CardTitle>
                  <CardDescription className="text-muted-foreground">Receive signed event deliveries on your own endpoints.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="text-muted-foreground">
                    Register endpoint URLs in the <Link className="text-emerald-600 dark:text-emerald-400 hover:underline" href="/dashboard/webhooks">Webhooks</Link> dashboard.
                    Each delivery is signed with HMAC-SHA256 and includes the <code dir="ltr" className="font-mono">Nixify-Signature</code>{" "}
                    and <code dir="ltr" className="font-mono">Nixify-Event</code> headers:
                  </p>
                  <CodeBlock
                    label="Delivery headers"
                    code={`Nixify-Signature: t=1720000000000,v1=8c2f1e9a7b3d4f5e6a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f
Nixify-Event: otp.sent
Content-Type: application/json`}
                    onCopy={copy}
                  />
                  <p className="text-xs text-muted-foreground/70">
                    The <code dir="ltr" className="font-mono">t</code> component is a millisecond timestamp; <code dir="ltr" className="font-mono">v1</code>{" "}
                    is the HMAC-SHA256 of <code dir="ltr" className="font-mono">{`${'`${t}.${payload}`'}`}</code> using your endpoint secret. Reject any delivery
                    older than 5 minutes to prevent replay attacks.
                  </p>
                  <div>
                    <h4 className="mb-2 font-medium text-foreground">Verify the signature</h4>
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
                    <h4 className="mb-2 font-medium text-foreground">Events</h4>
                    <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                      <li><code dir="ltr" className="font-mono">otp.sent</code> — code was generated + delivered</li>
                      <li><code dir="ltr" className="font-mono">otp.verified</code> — user successfully verified</li>
                      <li><code dir="ltr" className="font-mono">otp.failed</code> — verification failed (wrong code)</li>
                      <li><code dir="ltr" className="font-mono">otp.expired</code> — 10-minute TTL elapsed without verification</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Rate Limits */}
            <section id="rate-limits" className="scroll-mt-4">
              <Card className="border-border bg-card/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground"><Gauge className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Rate Limits</CardTitle>
                  <CardDescription className="text-muted-foreground">Per-email and per-IP throttles to prevent abuse.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="max-h-64 overflow-auto rounded border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr className="border-b border-border text-left">
                          <th className="px-3 py-2 font-medium text-muted-foreground">Scope</th>
                          <th className="px-3 py-2 font-medium text-muted-foreground">Limit</th>
                          <th className="px-3 py-2 font-medium text-muted-foreground">Window</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border"><td className="px-3 py-2 text-muted-foreground">Per email — /send</td><td className="px-3 py-2 text-muted-foreground">3</td><td className="px-3 py-2 text-muted-foreground">1 minute</td></tr>
                        <tr className="border-b border-border"><td className="px-3 py-2 text-muted-foreground">Per email — /send</td><td className="px-3 py-2 text-muted-foreground">10</td><td className="px-3 py-2 text-muted-foreground">1 hour</td></tr>
                        <tr className="border-b border-border"><td className="px-3 py-2 text-muted-foreground">Per IP — /send</td><td className="px-3 py-2 text-muted-foreground">10 / 60</td><td className="px-3 py-2 text-muted-foreground">1 min / 1 hr</td></tr>
                        <tr><td className="px-3 py-2 text-muted-foreground">Per IP — /verify</td><td className="px-3 py-2 text-muted-foreground">30 / 120</td><td className="px-3 py-2 text-muted-foreground">1 min / 1 hr</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    Per-email limits apply to <code dir="ltr" className="font-mono">mg_live_</code> keys only; test keys skip them so
                    CI can run fast. Per-IP limits apply to all keys.
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground">
                      <strong className="text-muted-foreground">Response headers</strong>
                    </p>
                    <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                      <li>All responses include <code dir="ltr" className="font-mono">X-Request-Id</code> (matches the body&apos;s <code dir="ltr" className="font-mono">request_id</code>) and <code dir="ltr" className="font-mono">X-Api-Version: 1</code>.</li>
                      <li>Successful (2xx) responses include <code dir="ltr" className="font-mono">X-Quota-Remaining</code> for plan quota tracking.</li>
                      <li>Rate-limited responses (429): IP-level and email-level 429s include a <code dir="ltr" className="font-mono">Retry-After</code> header (seconds); email-level 429s additionally include <code dir="ltr" className="font-mono">X-RateLimit-Limit</code>, <code dir="ltr" className="font-mono">X-RateLimit-Remaining</code>, and <code dir="ltr" className="font-mono">X-RateLimit-Reset</code>.</li>
                      <li>Plan-rate 429s (the per-minute plan rate limit, returned as <code dir="ltr" className="font-mono">rate_limited</code> from the entitlement engine) include <code dir="ltr" className="font-mono">X-RateLimit-Reset</code> and <code dir="ltr" className="font-mono">X-Quota-Remaining</code> — they do <strong>not</strong> include <code dir="ltr" className="font-mono">Retry-After</code>.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Error Codes */}
            <section id="errors" className="scroll-mt-4">
              <Card className="border-border bg-card/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground"><AlertCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Error Codes</CardTitle>
                  <CardDescription className="text-muted-foreground">The API uses a consistent error envelope with stable codes. The full catalog is below — no dashboard login required.</CardDescription>
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
                  <p className="text-xs text-muted-foreground/70">
                    The <code dir="ltr" className="font-mono">doc_url</code> field always points to a public anchor on this page —
                    every code below has its own <code dir="ltr" className="font-mono">#error-&lt;code&gt;</code> jump link.
                  </p>
                  <Separator className="bg-border/60" />
                  <div className="space-y-2">
                    {ERRORS_CATALOG.map((e) => (
                      <div key={e.code} id={`error-${e.code}`} className="scroll-mt-24 rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <code dir="ltr" className="font-mono text-sm text-emerald-700 dark:text-emerald-300">{e.code}</code>
                          <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">HTTP {e.httpStatus}</Badge>
                          <span className="text-xs text-muted-foreground">{e.title}</span>
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">{e.description}</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div>
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Causes</span>
                            <ul className="ml-3 list-disc text-xs text-muted-foreground/70">
                              {e.causes.map((c) => <li key={c}>{c}</li>)}
                            </ul>
                          </div>
                          <div>
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Fixes</span>
                            <ul className="ml-3 list-disc text-xs text-muted-foreground/70">
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
              <Card className="border-border bg-card/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground"><History className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Changelog</CardTitle>
                  <CardDescription className="text-muted-foreground">Notable changes to the v1 API.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <ChangeItem version="v1.0.0" date="2026-07-06">
                    <li>Initial public release.</li>
                    <li>Endpoints: <code dir="ltr" className="font-mono">/api/v1/otp/send</code>, <code dir="ltr" className="font-mono">/api/v1/otp/verify</code>, <code dir="ltr" className="font-mono">/api/v1/otp/resend</code>.</li>
                    <li>API keys (mg_test_ / mg_live_) with full + read_only scopes.</li>
                    <li>Webhooks with HMAC-SHA256 signed deliveries (<code dir="ltr" className="font-mono">Nixify-Signature</code> + <code dir="ltr" className="font-mono">Nixify-Event</code> headers).</li>
                    <li>Sandbox mode is automatic for <code dir="ltr" className="font-mono">mg_test_</code> keys: OTPs are persisted but not emailed; the plaintext code is returned in the response. The optional <code dir="ltr" className="font-mono">X-Sandbox-Simulate</code> header forces simulated errors (rate_limited, locked, expired, mismatch, smtp_error) for testing.</li>
                  </ChangeItem>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-gray-900">{n}</div>
      <div className="flex-1 space-y-2">
        <h4 className="font-medium text-foreground">{title}</h4>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ label, code, onCopy }: { label: string; code: string; onCopy: (text: string, label?: string) => void }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground/70">{label}</span>
        <Button size="sm" variant="ghost" className="h-6 text-muted-foreground hover:text-foreground hover:bg-border/40" onClick={() => onCopy(code, `${label} copied`)}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <pre dir="ltr" className="overflow-auto p-3 text-xs text-muted-foreground">{code}</pre>
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
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">{method}</span>
        <code dir="ltr" className="font-mono text-sm text-foreground">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{purpose}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Request body</h5>
          <div className="overflow-auto rounded border border-border">
            <table className="w-full text-xs">
              <tbody>
                {requestSchema.map((r) => (
                  <tr key={r.field} className="border-b border-border last:border-0">
                    <td className="px-2 py-1.5 font-mono text-foreground">{r.field}{r.required && <span className="ml-1 text-rose-400">*</span>}</td>
                    <td className="px-2 py-1.5 text-muted-foreground/70">{r.type}</td>
                    <td className="px-2 py-1.5 text-muted-foreground/70">{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Response body</h5>
          <div className="overflow-auto rounded border border-border">
            <table className="w-full text-xs">
              <tbody>
                {responseSchema.map((r) => (
                  <tr key={r.field} className="border-b border-border last:border-0">
                    <td className="px-2 py-1.5 font-mono text-foreground">{r.field}</td>
                    <td className="px-2 py-1.5 text-muted-foreground/70">{r.type}</td>
                    <td className="px-2 py-1.5 text-muted-foreground/70">{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <CodeBlock label="Example request" code={exampleReq} onCopy={onCopy} />
        <CodeBlock label="Example response" code={exampleRes} onCopy={onCopy} />
      </div>
      <div>
        <h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Possible errors</h5>
        <div className="flex flex-wrap gap-1.5">
          {errors.map((e) => <Badge key={e} variant="outline" className="border-border font-mono text-[10px] text-muted-foreground">{e}</Badge>)}
        </div>
      </div>
    </div>
  );
}

function ChangeItem({ version, date, children }: { version: string; date: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">{version}</Badge>
        <span className="text-xs text-muted-foreground/70">{date}</span>
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
  const [showModels, setShowModels] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopyPrompt() {
    copyFn(AI_PROMPT_TEXT, "Prompt copied! Paste it into any AI model.");
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleModelClick(url: string) {
    setShowModels(false);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section id="ai-prompt" className="scroll-mt-4">
      <Card className="overflow-hidden border-border bg-card/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> AI Prompt Helper
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Copy this prompt, paste it into any AI model, and get a step-by-step
            integration guide for <strong>any programming language</strong> — written for beginners.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* What this does */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" /> How this works
            </h4>
            <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
              <li>Click <strong>Copy Prompt</strong> below — the prompt is pre-written and includes all the API details.</li>
              <li>Paste it into any AI model (ChatGPT, Claude, DeepSeek, or Z.ai).</li>
              <li>Replace <code dir="ltr" className="rounded bg-border/60 px-1 font-mono text-xs text-muted-foreground">[MY PROGRAMMING LANGUAGE]</code> with your language (JavaScript, Python, PHP, Go, etc.).</li>
              <li>The AI will generate a complete, beginner-friendly step-by-step guide with full code, error handling, and comments.</li>
            </ol>
          </div>

          {/* The prompt — in a scrollable code block */}
          <div className="rounded-lg border border-border bg-muted/40">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                The Prompt (copy this)
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
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy Prompt
                  </>
                )}
              </Button>
            </div>
            <pre dir="ltr" className="max-h-80 overflow-auto p-3 text-xs leading-relaxed text-muted-foreground">
              <code dir="ltr">{AI_PROMPT_TEXT}</code>
            </pre>
          </div>

          {/* Go to an AI model — hover dropdown */}
          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-1 text-sm font-medium text-foreground">Now paste it into an AI model</h4>
            <p className="mb-3 text-xs text-muted-foreground/70">
              Hover over the button below, then click any AI model to open it in a new tab.
              Paste the prompt, replace the language placeholder, and you&apos;ll get a complete guide.
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
                Go to an AI model
                <ChevronRight className={`ml-1 h-3.5 w-3.5 transition-transform ${showModels ? "rotate-90" : ""}`} />
              </Button>

              {/* Dropdown menu */}
              {showModels && (
                <div className="absolute left-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-[#060907]/95 p-2 shadow-xl backdrop-blur-xl">
                  <div className="border-b border-border/60 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">Choose an AI model</p>
                  </div>
                  <ul className="py-1">
                    {AI_MODELS.map((model) => (
                      <li key={model.name}>
                        <button
                          onClick={() => handleModelClick(model.url)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-emerald-500/10"
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
                              <span className="text-sm font-medium text-foreground">{model.name}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground/70" />
                            </div>
                            <p className="truncate text-xs text-muted-foreground/70">{model.desc}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-border/60 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground/70">
                      Tip: paste the prompt, then replace <code dir="ltr" className="font-mono">[MY PROGRAMMING LANGUAGE]</code> with your language.
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
