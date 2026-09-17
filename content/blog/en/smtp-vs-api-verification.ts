import type { BlogArticle } from "@/lib/blog/types";

const article: BlogArticle = {
  slug: "smtp-vs-api-verification",
  locale: "en",
  title: "SMTP vs API-based Email Verification",
  description: "Understanding the tradeoffs between SMTP-based OTP delivery and API-based verification services.",
  publishedAt: "2026-09-05",
  category: "Engineering",
  author: "Nixify Team",
  body: `# SMTP vs API-based Email Verification

When building an email verification system, you have two main options: SMTP-based delivery or API-based services.

## SMTP-based delivery

SMTP delivery sends the email directly from your server. This gives you full control over the transport layer.

**Pros:**
- Full control over the email pipeline
- No third-party API dependency
- SMTP transport is operator-configurable (Postfix, relay, or managed service)
- Lower cost at scale

**Cons:**
- Requires managing email deliverability
- IP reputation is your responsibility

## API-based services

Services like SendGrid, Resend, or Postmark handle delivery via their API.

**Pros:**
- Managed deliverability
- Built-in analytics and webhooks
- Less infrastructure to maintain

**Cons:**
- Vendor lock-in
- Per-email pricing
- Less control over the transport

## Nixify's approach

Nixify uses SMTP by default but the transport is pluggable. The operator configures the SMTP transport via environment variables — no code changes needed to switch providers.
`,
};

export default article;
