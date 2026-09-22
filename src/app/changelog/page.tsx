import type { Metadata } from "next";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { History, Tag } from "lucide-react";
import { absoluteUrl } from "@/lib/site/site-url";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Public changelog for the Nixify v1 API and platform. Documents the current API contract, endpoints, error codes, and platform capabilities — sourced from the actual implementation.",
  alternates: {
    canonical: "/changelog",
  },
  openGraph: {
    title: "Nixify Changelog",
    description:
      "Public changelog for the Nixify v1 API and platform. Documents the current API contract, endpoints, error codes, and platform capabilities.",
    url: absoluteUrl("/changelog"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nixify Changelog",
    description:
      "Public changelog for the Nixify v1 API and platform.",
  },
};

interface ChangeEntry {
  label: string;
  date: string;
  summary: string;
  items: string[];
}

/**
 * Public changelog entries.
 *
 * These reflect the current v1 API contract and the platform changes that have
 * actually landed in merged work. No inferred semantic versions or invented
 * release dates — the dates reflect when the documented platform changes were
 * shipped to production.
 */
const ENTRIES: ChangeEntry[] = [
  {
    label: "Current API contract",
    date: "2026-09-20",
    summary:
      "The current v1 API contract as documented in the API reference and implemented in the codebase.",
    items: [
      "Endpoints: POST /api/v1/otp/send, POST /api/v1/otp/verify, POST /api/v1/otp/resend.",
      "API keys: mg_test_ (development/sandbox) and mg_live_ (production) with full and read_only scopes.",
      "Sandbox mode: automatic for mg_test_ keys — OTPs are generated and persisted but not emailed; the plaintext code is returned in the response body. The optional X-Sandbox-Simulate header forces simulated errors (rate_limited, locked, expired, mismatch, smtp_error).",
      "Rate limits: per-email (3/min, 10/hour), per-IP send (10/min, 60/hour), per-IP verify (30/min, 120/hour).",
      "Brute-force protection: 10 failed verifies in 15 min → 30-min account lock; more than 5 IP rate-limit violations in 1 hour → 30-min IP block.",
      "Webhooks: HMAC-SHA256 signed deliveries for otp.sent, otp.verified, otp.failed, otp.expired events. SSRF-protected destinations, 5-minute replay tolerance, retry with exponential backoff.",
      "Error envelope: { error: { code, message, doc_url }, request_id }. The full error catalog is rendered on the public /docs page — see /docs#errors for the current set of codes.",
      "Response headers: X-Request-Id (matches body request_id) and X-Api-Version: 1 on all responses. Successful (2xx) responses include X-Quota-Remaining. Rate-limited responses vary by limiter — see /docs#rate-limits for the exact header behavior.",
      "Plan quotas: API_MESSAGES (authenticated v1 API requests) — Free: 1,000 authenticated v1 API requests/month, Pro: 50,000/month, Max: unlimited. OTP email sends have a separate OTP_EMAILS quota.",
    ],
  },
  {
    label: "Platform — trust, domain & operational transparency",
    date: "2026-09-20",
    summary:
      "Public trust, domain migration, and operational transparency update (merged).",
    items: [
      "Production domain migrated to https://nixify.ir. The legacy nixify.vercel.app host permanently redirects (308) to the canonical origin.",
      "Public /security page documenting the real implemented controls.",
      "Public /status page with live metrics derived from RequestLog and WebhookDelivery tables. 60-second server-side cache. Explicitly not an uptime monitor or SLA.",
      "Consent-gated Vercel Analytics and Speed Insights (decline disables both; accept enables both).",
      "Public /docs page with the full error catalog rendered inline (single source of truth shared with the API's doc_url field).",
      "Privacy policy updated with accurate infrastructure/subprocessor wording.",
    ],
  },
  {
    label: "Platform — ecosystem & discoverability",
    date: "2026-09-20",
    summary:
      "Public ecosystem and discoverability update (merged).",
    items: [
      "Public /examples page with a copy-pasteable Next.js Email OTP integration (send, verify, webhook signature verification).",
      "Public /compare page: Nixify vs building Email OTP yourself — a factual comparison.",
      "Public /changelog page (this page).",
      "Discoverability content: blog articles for Email OTP API integration and Nixify vs building Email OTP.",
      "Internal linking across homepage, docs, pricing, security, status, examples, compare, and changelog.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
          <History className="h-8 w-8 text-emerald-600 dark:text-emerald-400" /> Changelog
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Public changelog for the Nixify v1 API and platform. These entries
          reflect the current implemented API contract and platform changes
          that have landed in merged work. For the full API reference, see the{" "}
          <a href="/docs" className="text-emerald-600 dark:text-emerald-400 hover:underline">API documentation</a>.
        </p>

        <div className="mt-10 space-y-8">
          {ENTRIES.map((entry) => (
            <section key={entry.label} className="rounded-lg border border-border bg-card/60 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 rounded bg-emerald-500/15 px-2.5 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  <Tag className="h-3.5 w-3.5" /> {entry.label}
                </span>
                <span className="text-xs text-muted-foreground/70">{entry.date}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{entry.summary}</p>
              <ul className="mt-3 ml-4 list-disc space-y-1.5 text-sm text-muted-foreground">
                {entry.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Next steps */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="text-lg font-semibold text-foreground">Next steps</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>→ <a href="/docs" className="text-emerald-600 dark:text-emerald-400 hover:underline">API documentation</a></li>
            <li>→ <a href="/examples" className="text-emerald-600 dark:text-emerald-400 hover:underline">Integration examples</a></li>
            <li>→ <a href="/compare" className="text-emerald-600 dark:text-emerald-400 hover:underline">Nixify vs building yourself</a></li>
            <li>→ <a href="/status" className="text-emerald-600 dark:text-emerald-400 hover:underline">Live service metrics</a></li>
          </ul>
        </section>
      </div>
    </>
  );
}
