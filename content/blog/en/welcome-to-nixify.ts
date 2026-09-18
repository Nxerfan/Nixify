import type { BlogArticle } from "@/lib/blog/types";

const article: BlogArticle = {
  slug: "welcome-to-nixify",
  locale: "en",
  title: "Welcome to Nixify",
  description: "An introduction to Nixify — real OTP email verification over SMTP, free to start, self-hostable.",
  publishedAt: "2026-09-01",
  category: "Announcements",
  author: "Nixify Team",
  body: `# Welcome to Nixify

Nixify is a real email verification platform that sends actual 6-digit OTP codes over SMTP.

## What makes Nixify different

- **Real SMTP delivery** — codes are delivered to a real inbox, not mocked
- **Single-use, rate-limited** — every code is one-time, expiry-bound, brute-force protected
- **SMTP-swappable** — operator-configurable transport via environment variables
- **Serverless-safe** — all state in Postgres/SQLite, no in-memory rate limits

## Getting started

Create an account and verify your email. The Free plan includes 100 OTP emails per month.

\`\`\`bash
curl -X POST https://nixify.vercel.app/api/v1/otp/send \\
  -H "Authorization: Bearer mg_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","purpose":"signup"}'
\`\`\`

## Localization

Nixify supports English and Persian (فارسی). The dashboard and OTP emails render in the user's preferred locale.
`,
};

export default article;
