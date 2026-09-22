import type { Metadata } from "next";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import {
  Code2, Copy, Check, FileCode2, Terminal, Zap, ShieldCheck, Webhook, KeyRound, RefreshCw,
} from "lucide-react";
import { absoluteUrl } from "@/lib/site/site-url";
import { CodeBlock } from "@/components/docs/CodeBlock";

export const metadata: Metadata = {
  title: "Examples",
  description:
    "A real, copy-pasteable Next.js Email OTP integration example using the Nixify v1 API. Includes send, verify, resend, error handling, and webhook signature verification — all based on the actual API.",
  alternates: {
    canonical: "/examples",
  },
  openGraph: {
    title: "Nixify Examples — Next.js Email OTP Integration",
    description:
      "A real, copy-pasteable Next.js Email OTP integration example using the Nixify v1 API. Includes send, verify, resend, error handling, and webhook signature verification.",
    url: absoluteUrl("/examples"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nixify Examples — Next.js Email OTP Integration",
    description:
      "A real, copy-pasteable Next.js Email OTP integration example using the Nixify v1 API.",
  },
};

const SEND_SNIPPET = `// app/api/otp/send/route.ts
import { NextRequest, NextResponse } from "next/server";

const NIXIFY_API = "https://nixify.ir/api/v1";
// Store in an environment variable — never commit your live key.
const NIXIFY_KEY = process.env.NIXIFY_API_KEY!;

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const res = await fetch(\`\${NIXIFY_API}/otp/send\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${NIXIFY_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, purpose: "signup" }),
  });

  const data = await res.json();
  if (!res.ok) {
    // Forward the Nixify error code + request_id to your client for display.
    return NextResponse.json(
      { error: data.error, requestId: data.request_id },
      { status: res.status },
    );
  }

  // data.otp_request_id is the OTP correlation ID (for webhook correlation).
  // data.request_id is the API trace ID (matches the X-Request-Id header).
  return NextResponse.json({
    otpRequestId: data.otp_request_id,
    requestId: data.request_id,
    expiresAt: data.expires_at,
  });
}`;

const VERIFY_SNIPPET = `// app/api/otp/verify/route.ts
import { NextRequest, NextResponse } from "next/server";

const NIXIFY_API = "https://nixify.ir/api/v1";
const NIXIFY_KEY = process.env.NIXIFY_API_KEY!;

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();
  if (!email || !code) {
    return NextResponse.json(
      { error: "email and code are required" },
      { status: 400 },
    );
  }

  const res = await fetch(\`\${NIXIFY_API}/otp/verify\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${NIXIFY_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, code, purpose: "signup" }),
  });

  const data = await res.json();
  if (!res.ok || !data.verified) {
    return NextResponse.json(
      {
        verified: false,
        error: data.error,
        requestId: data.request_id,
      },
      { status: res.status },
    );
  }

  // Email is now verified. Create the user account, set a session, etc.
  return NextResponse.json({
    verified: true,
    otpRequestId: data.otp_request_id,
    requestId: data.request_id,
  });
}`;

const RESEND_SNIPPET = `// app/api/otp/resend/route.ts
import { NextRequest, NextResponse } from "next/server";

const NIXIFY_API = "https://nixify.ir/api/v1";
const NIXIFY_KEY = process.env.NIXIFY_API_KEY!;

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  // /resend shares the same rate-limit and lockout rules as /send.
  // If the email is already rate-limited, Nixify returns rate_limited (429)
  // with Retry-After (IP/email level) or X-RateLimit-Reset (plan-rate level).
  const res = await fetch(\`\${NIXIFY_API}/otp/resend\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${NIXIFY_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, purpose: "signup" }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error, requestId: data.request_id },
      { status: res.status },
    );
  }

  return NextResponse.json({
    otpRequestId: data.otp_request_id,
    requestId: data.request_id,
    expiresAt: data.expires_at,
  });
}`;

const CLIENT_SNIPPET = `"use client";
import { useState } from "react";

export function OtpForm({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "verified" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setStatus("verifying");
    setError(null);

    const res = await fetch("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();

    if (data.verified) {
      setStatus("verified");
      // Redirect to dashboard, set session, etc.
    } else {
      setStatus("error");
      // data.error.code is one of: code_mismatch, expired, already_used,
      // locked, not_found, rate_limited, validation_failed.
      setError(data.error?.message ?? "Verification failed.");
    }
  }

  if (status === "verified") {
    return <p className="text-emerald-600">Email verified successfully.</p>;
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-3">
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\\D/g, ""))}
        placeholder="6-digit code"
        className="border rounded px-3 py-2 text-center text-lg tracking-widest"
        autoFocus
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={status === "verifying" || code.length !== 6}
        className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {status === "verifying" ? "Verifying…" : "Verify code"}
      </button>
    </form>
  );
}`;

const WEBHOOK_SNIPPET = `// app/api/webhooks/nixify/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.NIXIFY_WEBHOOK_SECRET!;

function verifySignature(
  secret: string,
  payload: string,
  signatureHeader: string,
  toleranceMs = 5 * 60 * 1000,
): boolean {
  // The Nixify-Signature header has the format: t=<timestamp>,v1=<hmac>
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=")),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;

  // Reject replay attacks older than the tolerance window.
  if (Math.abs(Date.now() - t) > toleranceMs) return false;

  // Require v1 to be exactly a 64-character hex SHA-256 digest. This guarantees
  // Buffer.from(v1) and Buffer.from(expected) have the same byte length before
  // the constant-time comparison — a multibyte v1 of the same character count
  // would otherwise throw inside timingSafeEqual (RangeError) on byte-length
  // mismatch. Validating the hex format here means malformed signatures always
  // return false, never throw.
  if (typeof v1 !== "string" || !/^[0-9a-f]{64}$/.test(v1)) return false;

  const signedPayload = \`\${t}.\${payload}\`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // Both are 64-char hex strings → both Buffers are 32 bytes. Safe.
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("nixify-signature") ?? "";

  if (!verifySignature(WEBHOOK_SECRET, rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  // event.type: "otp.sent" | "otp.verified" | "otp.failed" | "otp.expired"
  // event.requestId: the OTP correlation ID
  // event.email: masked email (a***@domain.com)
  // event.data: { purpose, reason? }

  switch (event.type) {
    case "otp.verified":
      // Mark the user's email as verified in your database.
      console.log("Verified:", event.requestId);
      break;
    case "otp.failed":
      // Log failed attempts for monitoring.
      console.log("Failed:", event.requestId, event.data.reason);
      break;
    case "otp.expired":
      // Optionally clean up pending signups.
      break;
  }

  return NextResponse.json({ received: true });
}`;

const ENV_SNIPPET = `# .env.local
# Get your API key from https://nixify.ir/dashboard/api-keys
# Use a mg_test_ key for development (sandbox mode — no real email sent,
# the OTP code is returned in the response body for testing).
NIXIFY_API_KEY=mg_test_xxxxxxxxxxxxxxxxxxxxxxxx

# The webhook secret is shown once when you register a webhook endpoint at
# https://nixify.ir/dashboard/webhooks
NIXIFY_WEBHOOK_SECRET=mg_whsec_xxxxxxxxxxxxxxxxxxxxxxxx`;

export default function ExamplesPage() {
  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
          <Code2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" /> Examples
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A real, copy-pasteable Next.js Email OTP integration using the Nixify
          v1 API. Every snippet below is based on the actual API contract —
          the same endpoints, request/response shapes, error codes, and webhook
          signature format documented in the{" "}
          <a href="/docs" className="text-emerald-600 dark:text-emerald-400 hover:underline">API docs</a>.
        </p>

        <div className="mt-6 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-muted-foreground">
          <strong className="text-emerald-700 dark:text-emerald-300">Quick start:</strong> Copy the
          three route handlers + the client component below, set your API key
          in <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">.env.local</code>,
          and you have a complete OTP verification flow. Use a{" "}
          <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">mg_test_</code>{" "}
          key for development — sandbox mode returns the OTP code in the
          response body so you can test without a real inbox.
        </div>

        {/* Architecture overview */}
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Architecture
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your Next.js app calls the Nixify API from server-side route
            handlers (API routes). Your client components talk to your own route
            handlers — never to Nixify directly (your API key must stay
            server-side). Nixify delivers signed webhook events to a separate
            route handler for async updates.
          </p>
          <pre className="mt-3 overflow-auto rounded border border-border bg-card/60 p-3 text-xs text-muted-foreground">
{`Client ──▶ /api/otp/send ──▶ POST nixify.ir/api/v1/otp/send
                               (returns otp_request_id, expires_at)
Client ──▶ /api/otp/verify ─▶ POST nixify.ir/api/v1/otp/verify
                               (returns verified: true|false)

Nixify ──▶ /api/webhooks/nixify  (signed: otp.sent, otp.verified,
                                  otp.failed, otp.expired)`}
          </pre>
        </section>

        {/* Step 1: Environment */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Step 1 — Environment
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Set your API key and webhook secret. Get them from the{" "}
            <a href="/dashboard/api-keys" className="text-emerald-600 dark:text-emerald-400 hover:underline">API Keys</a>{" "}
            and{" "}
            <a href="/dashboard/webhooks" className="text-emerald-600 dark:text-emerald-400 hover:underline">Webhooks</a>{" "}
            dashboards.
          </p>
          <CodeBlock label=".env.local" code={ENV_SNIPPET} />
        </section>

        {/* Step 2: Send */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Terminal className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Step 2 — Send OTP
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a server-side route handler that calls{" "}
            <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">POST /api/v1/otp/send</code>.
            Your client calls this route, not the Nixify API directly.
          </p>
          <CodeBlock label="app/api/otp/send/route.ts" code={SEND_SNIPPET} />
        </section>

        {/* Step 3: Verify */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Step 3 — Verify OTP
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a route handler that calls{" "}
            <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">POST /api/v1/otp/verify</code>{" "}
            with the email + 6-digit code.
          </p>
          <CodeBlock label="app/api/otp/verify/route.ts" code={VERIFY_SNIPPET} />
        </section>

        {/* Step 3b: Resend */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <RefreshCw className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Step 3b — Resend OTP (optional)
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If the user didn&apos;t receive the first code, call{" "}
            <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">POST /api/v1/otp/resend</code>.{" "}
            Shares the same rate-limit and lockout rules as{" "}
            <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">/send</code>.
          </p>
          <CodeBlock label="app/api/otp/resend/route.ts" code={RESEND_SNIPPET} />
        </section>

        {/* Step 4: Client */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <FileCode2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Step 4 — Client component
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A React component that collects the 6-digit code and calls your
            verify route. Handles the error codes the Nixify API returns.
          </p>
          <CodeBlock label="app/components/OtpForm.tsx" code={CLIENT_SNIPPET} />
        </section>

        {/* Step 5: Webhooks */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Webhook className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Step 5 — Webhooks (optional)
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Receive signed delivery notifications for{" "}
            <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">otp.sent</code>,{" "}
            <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">otp.verified</code>,{" "}
            <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">otp.failed</code>, and{" "}
            <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">otp.expired</code>{" "}
            events. The signature uses HMAC-SHA256 — always verify it before
            processing.
          </p>
          <CodeBlock label="app/api/webhooks/nixify/route.ts" code={WEBHOOK_SNIPPET} />
        </section>

        {/* Error handling */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="text-lg font-semibold text-foreground">Error handling</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The Nixify API returns a consistent error envelope. Every error
            includes a <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">code</code>,
            a human-readable{" "}
            <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">message</code>,
            a{" "}
            <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">doc_url</code>{" "}
            pointing to a public docs anchor, and a{" "}
            <code dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-300">request_id</code>{" "}
            for support. See the{" "}
            <a href="/docs#errors" className="text-emerald-600 dark:text-emerald-400 hover:underline">full error catalog</a>.
          </p>
          <pre className="mt-3 overflow-auto rounded border border-border bg-card/60 p-3 text-xs text-muted-foreground">
{`{
  "error": {
    "code": "rate_limited",
    "message": "Too many OTP sends. Retry in 47s.",
    "doc_url": "/docs#error-rate_limited"
  },
  "request_id": "a1b2c3d4-..."
}`}
          </pre>
          <p className="mt-3 text-sm text-muted-foreground">
            Common codes to handle in your UI:{" "}
            <code dir="ltr" className="font-mono">code_mismatch</code> (wrong code),{" "}
            <code dir="ltr" className="font-mono">expired</code> (10-minute TTL),{" "}
            <code dir="ltr" className="font-mono">locked</code> (too many failed attempts),{" "}
            <code dir="ltr" className="font-mono">rate_limited</code> (per-email, per-IP, or plan-rate limit — see{" "}
            <a href="/docs#rate-limits" className="text-emerald-600 dark:text-emerald-400 hover:underline">rate limits</a>{" "}
            for the header each source returns).
          </p>
        </section>

        {/* Next steps */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="text-lg font-semibold text-foreground">Next steps</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>→ Read the full <a href="/docs" className="text-emerald-600 dark:text-emerald-400 hover:underline">API documentation</a></li>
            <li>→ Compare Nixify to <a href="/compare" className="text-emerald-600 dark:text-emerald-400 hover:underline">building Email OTP yourself</a></li>
            <li>→ See the <a href="/security" className="text-emerald-600 dark:text-emerald-400 hover:underline">security controls</a> Nixify implements</li>
            <li>→ Check <a href="/pricing" className="text-emerald-600 dark:text-emerald-400 hover:underline">plans and quotas</a> (Free plan available)</li>
            <li>→ View live <a href="/status" className="text-emerald-600 dark:text-emerald-400 hover:underline">service metrics</a></li>
          </ul>
        </section>
      </div>
    </>
  );
}
