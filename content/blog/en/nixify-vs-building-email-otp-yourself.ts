import type { BlogArticle } from "@/lib/blog/types";

const article: BlogArticle = {
  slug: "nixify-vs-building-email-otp-yourself",
  locale: "en",
  title: "Nixify vs Building Email OTP Yourself — A Factual Comparison",
  description:
    "What it takes to build email OTP verification yourself versus using Nixify. A line-by-line, feature-by-feature comparison based on the real Nixify implementation — no invented numbers.",
  publishedAt: "2026-09-20",
  category: "Engineering",
  author: "Nixify Team",
  tags: ["comparison", "email-otp", "build-vs-buy", "security"],
  body: `# Nixify vs Building Email OTP Yourself

Email OTP verification looks simple on the surface: generate a 6-digit code, email it, compare it on verify. But "simple" hides a surprising amount of infrastructure. This is a factual comparison of what Nixify gives you versus what you'd build to reach feature parity. No invented numbers — the line counts are approximate and based on the real Nixify implementation.

## OTP code generation

**Nixify:** Handled by the API. \`POST /api/v1/otp/send\` issues a code and delivers it via the configured mail transport, returning an \`otp_request_id\` and an \`expires_at\` (10-minute TTL).

**Building yourself:** Generate a 6-digit code, hash it with a server-side pepper (HMAC-SHA256 so a DB leak doesn't expose usable codes), store the hash with an expiry timestamp, and decide on a max-attempts-per-code limit. 

## Email delivery

**Nixify:** Sends the email via its managed SMTP infrastructure. You never touch SMTP config, TLS, or sender reputation.

**Building yourself:** Configure an SMTP provider (or run your own relay), handle TLS, manage sender reputation, deal with bounces and spam filters. This is ongoing operational work — not a one-time setup.

## Verification logic

**Nixify:** \`POST /api/v1/otp/verify\` with email + code. Returns \`verified: true/false\`. Handles single-use, expiry, and attempt counting atomically.

**Building yourself:** Look up the stored hash, compare with \`timingSafeEqual\` (never \`===\`), enforce single-use (atomic \`UPDATE ... WHERE consumed = false\`), check expiry, increment the attempt counter, lock after 5 failures. Requires careful transaction handling to avoid race conditions.

## Rate limiting

**Nixify:** Per-email (3/min, 10/hour) and per-IP (10/min send, 30/min verify) limits enforced automatically. \`mg_test_\` keys skip the per-email OTP send limit; the per-IP limit still applies. Rate-limited responses include \`Retry-After\` on IP/email-level 429s and \`X-RateLimit-Reset\` + \`X-Quota-Remaining\` on plan-rate 429s — see the [rate limits docs](/docs#rate-limits) for the exact header behavior.

**Building yourself:** Build a rate limiter (Redis or DB-backed), choose your limits, handle the per-email vs per-IP distinction, return \`Retry-After\` headers. 

## Brute-force protection

**Nixify:** 10 failed verifies in 15 minutes triggers a 30-minute account lock. More than 5 IP rate-limit violations in 1 hour triggers a 30-minute IP block. Both automatic.

**Building yourself:** Track failed attempts per email and per IP, implement lockout windows, decide when to auto-block IPs. 

## Webhooks

**Nixify:** Signed (HMAC-SHA256) webhook deliveries for \`otp.sent\`, \`otp.verified\`, \`otp.failed\`, and \`otp.expired\` events. SSRF-protected destinations, 5-minute replay tolerance, retry with exponential backoff.

**Building yourself:** Build a webhook queue, sign payloads, handle retries with backoff, validate destination URLs (SSRF protection), build a delivery dashboard for debugging. 

## Email theming

**Nixify:** Customize the OTP email template (colors, branding) in the dashboard. Template and branding availability depends on your plan (Free includes 2 templates, Pro 20, Max unlimited; custom branding on Pro and Max).

**Building yourself:** Build a template system, render HTML + plaintext versions, manage theme variables, test across email clients. 

## Quotas and plans

**Nixify:** Plan-based API request quotas (API_MESSAGES: Free 1,000/month, Pro 50,000/month, Max unlimited) enforced automatically. OTP email sends have a separate OTP_EMAILS quota. \`X-Quota-Remaining\` is returned on successful (2xx) responses.

**Building yourself:** Build a usage tracker, enforce limits, handle plan upgrades/downgrades, expose remaining quota to users. 

## Security responsibility

**Nixify:** See the [Security page](/security) for the full list of implemented controls. No SOC 2/ISO 27001/PCI DSS claimed — just the real controls.

**Building yourself:** You are responsible for every security decision — hashing algorithm, storage, transport encryption, cookie flags, secret management, audit logging. The audit is on you.

## Time to production

**Nixify:** Copy the [integration example](/examples), set your API key, deploy. You get a working OTP flow without building the infrastructure yourself.

**Building yourself:** Design, implement, test, secure, deploy, monitor, and maintain. Ongoing operational burden.

## When building yourself makes sense

- You need full control over the email transport layer (custom SMTP relay, on-prem delivery).
- You have strict data-residency requirements that prevent using any third-party API.
- Your OTP volume is high enough that the per-message cost of a managed service is a real constraint, and you can afford the engineering and ops time.

## When Nixify makes sense

- You want email verification without building and maintaining the infrastructure yourself.
- You don't want to manage SMTP deliverability, IP reputation, or bounce handling.
- You want rate limiting, brute-force protection, and webhooks built in.
- You're on a Free plan (1,000 API messages/month) and want to start at zero cost.

## What's next

- [Full API documentation](/docs)
- [Copy-pasteable Next.js example](/examples)
- [Pricing and quotas](/pricing)
- [Security controls](/security)
`,
};

export default article;
