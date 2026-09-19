"use client";

import { useState } from "react";
import Link from "next/link";
import { PRODUCTION_ORIGIN as siteOrigin } from "@/lib/site/site-url";
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
 * Public API documentation UI — mirrors the dashboard docs page content.
 *
 * Differences from `src/app/dashboard/docs/page.tsx`:
 *   - No "Back to Dashboard" chrome button (this is a standalone public page).
 *   - Internal dashboard references (API Keys, Webhooks, Error Explorer) are
 *     rendered as `<Link>` components (auth-gated; anonymous visitors are
 *     redirected to /auth by middleware).
 *   - The error envelope example uses the corrected `/dashboard/errors#<code>`
 *     path (matches the actual API response from `errorResponse()` after the
 *     Post-Roadmap-A fix).
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
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
            <BookOpen className="h-6 w-6 text-emerald-400" /> Documentation
          </h1>
          <p className="text-sm text-gray-400">
            Everything you need to integrate the Nixify OTP API. Public — no sign-in required.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <nav className="lg:sticky lg:top-24 lg:self-start">
            <Card className="border-gray-800/60 bg-gray-950/60 backdrop-blur-xl">
              <CardContent className="p-2">
                <ul className="space-y-0.5">
                  {SECTIONS.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => jump(s.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${active === s.id
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-100"}`}
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
              <Card className="border-gray-800/60 bg-gray-950/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100"><Rocket className="h-5 w-5 text-emerald-400" /> Quick Start</CardTitle>
                  <CardDescription className="text-gray-400">Make your first OTP request in minutes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Step n={1} title="Create an API key">
                    <p className="text-sm text-gray-400">
                      Go to <Link className="text-emerald-400 hover:underline" href="/dashboard/api-keys">API Keys</Link> in the dashboard,
                      click <strong>Create API Key</strong>, choose <code dir="ltr" className="font-mono">development</code> environment,
                      then copy the generated <code dir="ltr" className="font-mono">mg_test_…</code> key.
                    </p>
                  </Step>
                  <Step n={2} title="Make your first request">
                    <CodeBlock
                      label="curl"
                      code={`curl -X POST ${siteOrigin}/api/v1/otp/send \\
  -H "Authorization: Bearer mg_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","purpose":"signup"}'`}
                      onCopy={copy}
                    />
                  </Step>
                  <Step n={3} title="Send your first OTP">
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
console.log(data.otp_request_id);`}
                      onCopy={copy}
                    />
                  </Step>
                </CardContent>
              </Card>
            </section>

            {/* AI Prompt Helper */}
            <AIPromptSection copyFn={copy} />

            {/* Authentication */}
            <section id="authentication" className="scroll-mt-4">
              <Card className="border-gray-800/60 bg-gray-950/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100"><KeyRound className="h-5 w-5 text-emerald-400" /> Authentication</CardTitle>
                  <CardDescription className="text-gray-400">All API requests require a Bearer token.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="text-gray-300">
                    Send your API key in the <code dir="ltr" className="font-mono">Authorization</code> header as a Bearer token:
                  </p>
                  <CodeBlock
                    label="Header"
                    code="Authorization: Bearer mg_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                    onCopy={copy}
                  />
                  <Separator className="bg-gray-800/60" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-gray-800/60 p-3">
                      <Badge className="bg-amber-500/15 text-amber-300">test</Badge>
                      <div className="mt-2 font-mono text-xs text-gray-300">mg_test_…</div>
                      <p className="mt-1 text-xs text-gray-500">
                        For development + CI. Sandbox mode available — OTPs returned in the response, no real email sent.
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-800/60 p-3">
                      <Badge className="bg-emerald-500/15 text-emerald-300">live</Badge>
                      <div className="mt-2 font-mono text-xs text-gray-300">mg_live_…</div>
                      <p className="mt-1 text-xs text-gray-500">
                        Production only. Nixify sends real email through its managed delivery infrastructure. API customers do not provide SMTP credentials.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* API Reference */}
            <section id="api-reference" className="scroll-mt-4">
              <Card className="border-gray-800/60 bg-gray-950/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100"><Send className="h-5 w-5 text-emerald-400" /> API Reference</CardTitle>
                  <CardDescription className="text-gray-400">Three endpoints, one purpose: verify an email address.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <EndpointDoc
                    method="POST"
                    path="/api/v1/otp/send"
                    purpose="Issue + deliver a new OTP code to the given email."
                    requestSchema={[
                      { field: "email", type: "string", required: true, desc: "RFC 5322 email address" },
                      { field: "purpose", type: "string", required: true, desc: "signup | login | reset" },
                    ]}
                    responseSchema={[
                      { field: "otp_request_id", type: "string", desc: "OTP correlation ID (for webhook correlation)" },
                      { field: "request_id", type: "string", desc: "API request trace ID (matches X-Request-Id)" },
                      { field: "expires_at", type: "string (ISO)", desc: "10-minute TTL" },
                    ]}
                    exampleReq={`{
  "email": "user@example.com",
  "purpose": "signup"
}`}
                    exampleRes={`{
  "otp_request_id": "f3a2b1c8-...",
  "request_id": "a1b2c3d4-...",
  "expires_at": "2026-07-06T22:50:00.000Z"
}`}
                    errors={["validation_failed", "rate_limited", "locked", "ip_blocked"]}
                    onCopy={copy}
                  />
                  <Separator className="bg-gray-800/60" />
                  <EndpointDoc
                    method="POST"
                    path="/api/v1/otp/verify"
                    purpose="Verify the 6-digit code entered by the user."
                    requestSchema={[
                      { field: "email", type: "string", required: true, desc: "Same email used in /send" },
                      { field: "code", type: "string", required: true, desc: "Exactly 6 numeric digits" },
                      { field: "purpose", type: "string", required: true, desc: "Must match the /send purpose" },
                    ]}
                    responseSchema={[
                      { field: "verified", type: "boolean", desc: "true on success" },
                      { field: "otp_request_id", type: "string", desc: "OTP correlation ID of the consumed attempt" },
                      { field: "request_id", type: "string", desc: "API request trace ID (matches X-Request-Id)" },
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
                    errors={["code_mismatch", "expired", "already_used", "locked", "not_found", "rate_limited"]}
                    onCopy={copy}
                  />
                  <Separator className="bg-gray-800/60" />
                  <EndpointDoc
                    method="POST"
                    path="/api/v1/otp/resend"
                    purpose="Send a fresh code if the user didn&apos;t receive the first one."
                    requestSchema={[
                      { field: "email", type: "string", required: true, desc: "Target email" },
                      { field: "purpose", type: "string", required: true, desc: "signup | login | reset" },
                    ]}
                    responseSchema={[
                      { field: "otp_request_id", type: "string", desc: "OTP correlation ID for the new attempt" },
                      { field: "request_id", type: "string", desc: "API request trace ID (matches X-Request-Id)" },
                      { field: "expires_at", type: "string (ISO)", desc: "10-minute TTL" },
                    ]}
                    exampleReq={`{
  "email": "user@example.com",
  "purpose": "signup"
}`}
                    exampleRes={`{
  "otp_request_id": "9c1d7e44-...",
  "request_id": "e5f6g7h8-...",
  "expires_at": "2026-07-06T22:55:00.000Z"
}`}
                    errors={["validation_failed", "rate_limited", "locked", "ip_blocked"]}
                    onCopy={copy}
                  />
                </CardContent>
              </Card>
            </section>

            {/* API Client */}
            <section id="api-client" className="scroll-mt-4">
              <Card className="border-gray-800/60 bg-gray-950/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100"><Package className="h-5 w-5 text-emerald-400" /> API Client</CardTitle>
                  <CardDescription className="text-gray-400">Use the REST API from any HTTP client.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <CodeBlock label="JavaScript (fetch)" code={`const res = await fetch('${siteOrigin}/api/v1/otp/send', { method: 'POST', headers: { 'Authorization': 'Bearer mg_live_xxx', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'user@example.com', purpose: 'signup' }) });`} onCopy={copy} />
                  <CodeBlock label="Python (requests)" code={`import requests; res = requests.post('${siteOrigin}/api/v1/otp/send', headers={'Authorization': 'Bearer mg_live_xxx'}, json={'email': 'user@example.com', 'purpose': 'signup'})`} onCopy={copy} />
                </CardContent>
              </Card>
            </section>

            {/* Webhooks */}
            <section id="webhooks" className="scroll-mt-4">
              <Card className="border-gray-800/60 bg-gray-950/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100"><Webhook className="h-5 w-5 text-emerald-400" /> Webhooks</CardTitle>
                  <CardDescription className="text-gray-400">Receive signed event deliveries on your own endpoints.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="text-gray-300">
                    Register endpoint URLs in the <Link className="text-emerald-400 hover:underline" href="/dashboard/webhooks">Webhooks</Link> dashboard.
                    Each delivery is signed with HMAC-SHA256 and includes the <code dir="ltr" className="font-mono">Nixify-Signature</code> header:
                  </p>
                  <CodeBlock
                    label="Signature header"
                    code="Nixify-Signature: t=1720000000000,v1=8c2f1e9a7b3d4f5e6a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f"
                    onCopy={copy}
                  />
                  <div>
                    <h4 className="mb-2 font-medium text-gray-200">Verify the signature</h4>
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
                    <h4 className="mb-2 font-medium text-gray-200">Events</h4>
                    <ul className="ml-4 list-disc space-y-1 text-gray-400">
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
              <Card className="border-gray-800/60 bg-gray-950/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100"><Gauge className="h-5 w-5 text-emerald-400" /> Rate Limits</CardTitle>
                  <CardDescription className="text-gray-400">Per-email and per-IP throttles to prevent abuse.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="max-h-64 overflow-auto rounded border border-gray-800/60">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-900/60 sticky top-0">
                        <tr className="border-b border-gray-800/60 text-left">
                          <th className="px-3 py-2 font-medium text-gray-300">Scope</th>
                          <th className="px-3 py-2 font-medium text-gray-300">Limit</th>
                          <th className="px-3 py-2 font-medium text-gray-300">Window</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-800/60"><td className="px-3 py-2 text-gray-300">Per email — /send</td><td className="px-3 py-2 text-gray-300">3</td><td className="px-3 py-2 text-gray-300">1 minute</td></tr>
                        <tr className="border-b border-gray-800/60"><td className="px-3 py-2 text-gray-300">Per email — /send</td><td className="px-3 py-2 text-gray-300">10</td><td className="px-3 py-2 text-gray-300">1 hour</td></tr>
                        <tr className="border-b border-gray-800/60"><td className="px-3 py-2 text-gray-300">Per IP — /send</td><td className="px-3 py-2 text-gray-300">10 / 60</td><td className="px-3 py-2 text-gray-300">1 min / 1 hr</td></tr>
                        <tr><td className="px-3 py-2 text-gray-300">Per IP — /verify</td><td className="px-3 py-2 text-gray-300">30 / 120</td><td className="px-3 py-2 text-gray-300">1 min / 1 hr</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-gray-400">
                    Rate-limited responses (429) include <code dir="ltr" className="font-mono">X-RateLimit-*</code> headers.
                    All responses include <code dir="ltr" className="font-mono">X-Quota-Remaining</code> for plan quota tracking.
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Error Codes */}
            <section id="errors" className="scroll-mt-4">
              <Card className="border-gray-800/60 bg-gray-950/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100"><AlertCircle className="h-5 w-5 text-emerald-400" /> Error Codes</CardTitle>
                  <CardDescription className="text-gray-400">The API uses a consistent error envelope with stable codes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <CodeBlock
                    label="Error envelope"
                    code={`{
  "error": {
    "code": "rate_limited",
    "message": "Too many OTP sends. Retry in 47s.",
    "doc_url": "/dashboard/errors#rate_limited"
  },
  "request_id": "a1b2c3d4-..."
}`}
                    onCopy={copy}
                  />
                  <p className="text-gray-400">
                    For the full catalog of codes, causes, and recommended fixes, see the{" "}
                    <Link className="text-emerald-400 hover:underline" href="/dashboard/errors">Error Explorer</Link>{" "}
                    in the dashboard.
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Changelog */}
            <section id="changelog" className="scroll-mt-4">
              <Card className="border-gray-800/60 bg-gray-950/60 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100"><History className="h-5 w-5 text-emerald-400" /> Changelog</CardTitle>
                  <CardDescription className="text-gray-400">Notable changes to the v1 API.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <ChangeItem version="v1.0.0" date="2026-07-06">
                    <li>Initial public release.</li>
                    <li>Endpoints: <code dir="ltr" className="font-mono">/api/v1/otp/send</code>, <code dir="ltr" className="font-mono">/api/v1/otp/verify</code>, <code dir="ltr" className="font-mono">/api/v1/otp/resend</code>.</li>
                    <li>API keys (mg_test_ / mg_live_) with full + read_only scopes.</li>
                    <li>Webhooks with HMAC-SHA256 signed deliveries.</li>
                    <li>Sandbox mode for test keys (X-Sandbox-Simulate header).</li>
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
        <h4 className="font-medium text-gray-200">{title}</h4>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ label, code, onCopy }: { label: string; code: string; onCopy: (text: string, label?: string) => void }) {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/40">
      <div className="flex items-center justify-between border-b border-gray-800/60 px-3 py-1.5">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <Button size="sm" variant="ghost" className="h-6 text-gray-400 hover:text-gray-100 hover:bg-gray-800/40" onClick={() => onCopy(code, `${label} copied`)}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <pre dir="ltr" className="overflow-auto p-3 text-xs text-gray-300">{code}</pre>
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
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">{method}</span>
        <code dir="ltr" className="font-mono text-sm text-gray-200">{path}</code>
      </div>
      <p className="text-sm text-gray-400">{purpose}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Request body</h5>
          <div className="overflow-auto rounded border border-gray-800/60">
            <table className="w-full text-xs">
              <tbody>
                {requestSchema.map((r) => (
                  <tr key={r.field} className="border-b border-gray-800/60 last:border-0">
                    <td className="px-2 py-1.5 font-mono text-gray-200">{r.field}{r.required && <span className="ml-1 text-rose-400">*</span>}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.type}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Response body</h5>
          <div className="overflow-auto rounded border border-gray-800/60">
            <table className="w-full text-xs">
              <tbody>
                {responseSchema.map((r) => (
                  <tr key={r.field} className="border-b border-gray-800/60 last:border-0">
                    <td className="px-2 py-1.5 font-mono text-gray-200">{r.field}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.type}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.desc}</td>
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
        <h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Possible errors</h5>
        <div className="flex flex-wrap gap-1.5">
          {errors.map((e) => <Badge key={e} variant="outline" className="border-gray-700/60 font-mono text-[10px] text-gray-400">{e}</Badge>)}
        </div>
      </div>
    </div>
  );
}

function ChangeItem({ version, date, children }: { version: string; date: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-800/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge className="bg-emerald-500/15 text-emerald-300">{version}</Badge>
        <span className="text-xs text-gray-500">{date}</span>
      </div>
      <ul className="ml-4 list-disc space-y-0.5 text-sm text-gray-400">{children}</ul>
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
- Base URL: https://nixify.vercel.app/api/v1

AUTHENTICATION
- Create an API key in the Nixify dashboard (mg_test_ for development, mg_live_ for production).
- Send the key as a Bearer token in the Authorization header:
  Authorization: Bearer mg_test_xxxxxxxxxxxxxxxxxxxxxxxx

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
  "expires_at": "2026-07-06T22:50:00.000Z"
}
The user receives an email with a 6-digit code. The code expires in 10 minutes.

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
- 3 OTP sends per email per minute
- 10 OTP sends per email per hour
- 30 verify attempts per IP per minute
- When rate limited, the API returns 429 with a Retry-After header (seconds)

ERROR HANDLING
The API returns JSON errors with this shape:
{ "error": { "code": "rate_limited", "message": "Too many OTP sends." }, "request_id": "uuid" }
Common error codes: validation_failed, rate_limited, code_mismatch, expired, already_used, locked, ip_blocked.

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
      <Card className="overflow-hidden border-gray-800/60 bg-gray-950/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <Sparkles className="h-5 w-5 text-emerald-400" /> AI Prompt Helper
          </CardTitle>
          <CardDescription className="text-gray-400">
            Copy this prompt, paste it into any AI model, and get a step-by-step
            integration guide for <strong>any programming language</strong> — written for beginners.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* What this does */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-300">
              <Sparkles className="h-4 w-4" /> How this works
            </h4>
            <ol className="ml-4 list-decimal space-y-1.5 text-sm text-gray-400">
              <li>Click <strong>Copy Prompt</strong> below — the prompt is pre-written and includes all the API details.</li>
              <li>Paste it into any AI model (ChatGPT, Claude, DeepSeek, or Z.ai).</li>
              <li>Replace <code dir="ltr" className="rounded bg-gray-800/60 px-1 font-mono text-xs text-gray-300">[MY PROGRAMMING LANGUAGE]</code> with your language (JavaScript, Python, PHP, Go, etc.).</li>
              <li>The AI will generate a complete, beginner-friendly step-by-step guide with full code, error handling, and comments.</li>
            </ol>
          </div>

          {/* The prompt — in a scrollable code block */}
          <div className="rounded-lg border border-gray-800/60 bg-gray-950/40">
            <div className="flex items-center justify-between border-b border-gray-800/60 px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
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
            <pre dir="ltr" className="max-h-80 overflow-auto p-3 text-xs leading-relaxed text-gray-300">
              <code dir="ltr">{AI_PROMPT_TEXT}</code>
            </pre>
          </div>

          {/* Go to an AI model — hover dropdown */}
          <div className="rounded-lg border border-gray-800/60 p-4">
            <h4 className="mb-1 text-sm font-medium text-gray-200">Now paste it into an AI model</h4>
            <p className="mb-3 text-xs text-gray-500">
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
                <div className="absolute left-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-xl border border-gray-800/60 bg-[#060907]/95 p-2 shadow-xl backdrop-blur-xl">
                  <div className="border-b border-gray-800/40 px-3 py-2">
                    <p className="text-xs font-medium text-gray-400">Choose an AI model</p>
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
                              <span className="text-sm font-medium text-gray-200">{model.name}</span>
                              <ExternalLink className="h-3 w-3 text-gray-500" />
                            </div>
                            <p className="truncate text-xs text-gray-500">{model.desc}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-gray-800/40 px-3 py-2">
                    <p className="text-[11px] text-gray-500">
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
