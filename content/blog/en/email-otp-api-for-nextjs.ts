import type { BlogArticle } from "@/lib/blog/types";

const article: BlogArticle = {
  slug: "email-otp-api-for-nextjs",
  locale: "en",
  title: "Email OTP API for Next.js — A Complete Integration Guide",
  description:
    "How to add email OTP verification to a Next.js app using the Nixify v1 API. Includes send, verify, webhook signature verification, and error handling — all based on the real API.",
  publishedAt: "2026-09-20",
  category: "Engineering",
  author: "Nixify Team",
  tags: ["nextjs", "email-otp", "verification", "integration"],
  body: `# Email OTP API for Next.js

If you're building a Next.js app and need email verification — signup confirmation, password reset, login — you can add a complete OTP flow using the [Nixify v1 API](https://nixify.ir/docs) without building the infrastructure yourself. This guide walks through the full integration.

## Why an API over building it yourself

Building OTP verification yourself means: generating codes, hashing them with a pepper, storing them with an expiry, sending the email over SMTP, verifying with timing-safe comparison, enforcing single-use, rate limiting per email and per IP, and handling brute-force lockout. That's before you touch webhooks or email theming.

Nixify handles all of this. Your Next.js app calls the core send and verify endpoints from server-side route handlers (a resend endpoint is also available), and optionally receives signed webhooks. See [Nixify vs building it yourself](/compare) for a detailed breakdown.

## The architecture

Your Next.js app calls Nixify from **server-side route handlers** (API routes). Your client components call your own route handlers — never the Nixify API directly (your API key stays server-side). Nixify delivers signed webhook events to a separate route handler for async updates.

\`\`\`
Client ──▶ /api/otp/send ──▶ POST nixify.ir/api/v1/otp/send
                               (returns otp_request_id, expires_at)
Client ──▶ /api/otp/verify ─▶ POST nixify.ir/api/v1/otp/verify
                               (returns verified: true|false)

Nixify ──▶ /api/webhooks/nixify  (signed: otp.sent, otp.verified,
                                  otp.failed, otp.expired)
\`\`\`

## Step 1 — Get an API key

Sign up at [nixify.ir](https://nixify.ir) and create an API key in the [API Keys dashboard](https://nixify.ir/dashboard/api-keys). Use a \`mg_test_\` key for development — sandbox mode generates and persists the OTP but doesn't send a real email. The plaintext code is returned in the response body so you can call \`/verify\` immediately without checking an inbox.

## Step 2 — Send the OTP

Create \`app/api/otp/send/route.ts\`:

\`\`\`typescript
import { NextRequest, NextResponse } from "next/server";

const NIXIFY_API = "https://nixify.ir/api/v1";
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
}
\`\`\`

## Step 3 — Verify the OTP

Create \`app/api/otp/verify/route.ts\`:

\`\`\`typescript
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
      { verified: false, error: data.error, requestId: data.request_id },
      { status: res.status },
    );
  }

  // Email is now verified. Create the user account, set a session, etc.
  return NextResponse.json({ verified: true });
}
\`\`\`

## Step 4 — Client component

\`\`\`tsx
"use client";
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
    } else {
      setStatus("error");
      setError(data.error?.message ?? "Verification failed.");
    }
  }

  if (status === "verified") {
    return <p className="text-emerald-600">Email verified successfully.</p>;
  }

  return (
    <form onSubmit={handleVerify}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\\D/g, ""))}
        placeholder="6-digit code"
      />
      {error && <p>{error}</p>}
      <button type="submit" disabled={status === "verifying" || code.length !== 6}>
        {status === "verifying" ? "Verifying…" : "Verify code"}
      </button>
    </form>
  );
}
\`\`\`

## Error handling

The Nixify API returns a consistent error envelope:

\`\`\`json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many OTP sends. Retry in 47s.",
    "doc_url": "/docs#error-rate_limited"
  },
  "request_id": "a1b2c3d4-..."
}
\`\`\`

Common codes to handle in your UI:

- \`code_mismatch\` — wrong code entered
- \`expired\` — 10-minute TTL elapsed
- \`locked\` — too many failed attempts (10 in 15 min → 30-min lock)
- \`rate_limited\` — per-email, per-IP, or plan-rate limit hit (see /docs#rate-limits for the header each source returns)
- \`validation_failed\` — malformed email or code

See the [full error catalog](/docs#errors) for every code, its HTTP status, causes, and fixes.

## Webhooks (optional)

Register a webhook endpoint in the [Webhooks dashboard](https://nixify.ir/dashboard/webhooks) to receive signed deliveries for \`otp.sent\`, \`otp.verified\`, \`otp.failed\`, and \`otp.expired\` events. The \`Nixify-Signature\` header uses HMAC-SHA256 — always verify it before processing:

\`\`\`typescript
import crypto from "crypto";

function verifySignature(
  secret,
  payload,
  signatureHeader,
  toleranceMs = 5 * 60 * 1000,
) {
  // The Nixify-Signature header has the format: t=<timestamp>,v1=<hmac>
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=")),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;

  // Reject missing or malformed t/v1 — never let a malformed signature throw.
  if (!t || !v1 || typeof v1 !== "string") return false;

  // Reject replay attacks older than the tolerance window.
  if (Math.abs(Date.now() - t) > toleranceMs) return false;

  const signedPayload = \`\${t}.\${payload}\`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // Check lengths before constant-time comparison to avoid RangeError.
  if (expected.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
\`\`\`

See the [examples page](/examples) for the complete webhook route handler.

## What's next

- [Full API documentation](/docs)
- [Copy-pasteable Next.js example](/examples)
- [Nixify vs building it yourself](/compare)
- [Pricing and quotas](/pricing) (Free plan: 1,000 API requests/month)
- [Security controls](/security)
`,
};

export default article;
