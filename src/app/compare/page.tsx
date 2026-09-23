import type { Metadata } from "next";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { Check, Zap, Wrench, Code2 } from "lucide-react";
import { absoluteUrl } from "@/lib/site/site-url";

export const metadata: Metadata = {
  title: "Nixify vs Building Email OTP Yourself",
  description:
    "A feature-by-feature comparison of using Nixify versus building email OTP yourself, based on the current implemented product.",
  alternates: {
    canonical: "/compare",
  },
  openGraph: {
    title: "Nixify vs Building Email OTP Yourself",
    description:
      "A feature-by-feature comparison of using Nixify versus building email OTP yourself, based on the current implemented product.",
    url: absoluteUrl("/compare"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nixify vs Building Email OTP Yourself",
    description:
      "A feature-by-feature comparison of using Nixify versus building email OTP yourself, based on the current implemented product.",
  },
};

interface Row {
  area: string;
  nixify: string;
  buildYourself: string;
}

const COMPARISON: Row[] = [
  {
    area: "OTP code generation",
    nixify:
      "Handled by the API — POST /api/v1/otp/send issues a code and delivers it via the configured mail transport.",
    buildYourself:
      "Generate a 6-digit code, hash it with a server-side pepper (HMAC-SHA256), store the hash in your DB with an expiry timestamp, and decide on a max-attempts-per-code limit.",
  },
  {
    area: "Email delivery",
    nixify:
      "Nixify sends through its configured SMTP transport; API consumers do not configure that transport.",
    buildYourself:
      "Configure an SMTP provider (or run your own relay), handle TLS, and manage your own transport. Ongoing operational work.",
  },
  {
    area: "Verification logic",
    nixify:
      "POST /api/v1/otp/verify with email + code. Returns verified: true/false and handles single-use, expiry, and attempt counting atomically.",
    buildYourself:
      "Look up the stored hash, compare with timingSafeEqual, enforce single-use (atomic UPDATE ... WHERE consumed = false), check expiry, increment the attempt counter, and lock after a configured number of failures. Requires careful transaction handling to avoid race conditions.",
  },
  {
    area: "Rate limiting",
    nixify:
      "Per-email (3/min, 10/hour) and per-IP (10/min send, 30/min verify) limits enforced automatically. mg_test_ keys skip the per-email OTP send limiter; per-IP limits still apply, and the plan per-minute API request limit still applies.",
    buildYourself:
      "Build a rate limiter (Redis or DB-backed), choose your limits, handle the per-email vs per-IP distinction, and return Retry-After headers on rate-limited responses.",
  },
  {
    area: "Brute-force protection",
    nixify:
      "10 failed verifies in 15 min → 30-min account lock. More than 5 IP rate-limit violations in 1 hour → 30-min IP block. Automatic.",
    buildYourself:
      "Track failed attempts per email and per IP, implement lockout windows, and decide when to auto-block IPs.",
  },
  {
    area: "Webhooks",
    nixify:
      "Signed (HMAC-SHA256) webhook deliveries for otp.sent, otp.verified, otp.failed, otp.expired. SSRF-protected destinations, 5-minute replay tolerance, retry with exponential backoff.",
    buildYourself:
      "Build a webhook queue, sign payloads, handle retries with backoff, validate destination URLs (SSRF protection), and build a delivery dashboard for debugging.",
  },
  {
    area: "Email theming",
    nixify:
      "Customize the OTP email template (colors, branding) in the dashboard. Template and branding availability depends on your plan (Free includes 2 templates, Pro 20, Max unlimited; custom branding on Pro and Max).",
    buildYourself:
      "Build a template system, render HTML and plaintext versions, manage theme variables, and test across email clients.",
  },
  {
    area: "Quotas",
    nixify:
      "Plan-based API request quotas (API_MESSAGES: Free 1,000 authenticated v1 API requests/month, Pro 50,000/month, Max unlimited) enforced automatically. OTP email sends have a separate OTP_EMAILS quota. X-Quota-Remaining is returned on successful (2xx) responses.",
    buildYourself:
      "Build a usage tracker, enforce limits, handle plan upgrades and downgrades, and expose remaining quota to users.",
  },
  {
    area: "Security audit",
    nixify:
      "See the /security page for the full list of implemented controls. No SOC 2, ISO 27001, PCI DSS, or HIPAA claimed.",
    buildYourself:
      "You are responsible for every security decision — hashing, storage, transport, cookie flags, secret management. The audit is on you.",
  },
];

export default function ComparePage() {
  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
          <Zap className="h-8 w-8 text-emerald-600 dark:text-emerald-400" /> Nixify vs Building Email OTP Yourself
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This is a factual, qualitative comparison based on the current
          implemented product. It does not estimate engineering time or code size.
        </p>

        {/* Comparison table */}
        <div className="mt-8 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Area</th>
                <th className="px-4 py-3 font-medium text-emerald-700 dark:text-emerald-300">With Nixify</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Building yourself</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={row.area} className={i % 2 === 0 ? "border-b border-border/60 bg-card/30" : "border-b border-border/60"}>
                  <td className="px-4 py-3 font-medium text-foreground">{row.area}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{row.nixify}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex gap-2">
                      <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <span>{row.buildYourself}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* When to build yourself */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Code2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> When building yourself makes sense
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span>You need full control over the email transport layer (custom SMTP relay, on-prem delivery).</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span>You have strict data-residency requirements that prevent using any third-party API.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span>Your operational, control, or infrastructure requirements justify owning the email-verification stack despite the additional engineering and maintenance responsibility.</span></li>
          </ul>
        </section>

        {/* When Nixify makes sense */}
        <section className="mt-6 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> When Nixify makes sense
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span>You want email verification without building and maintaining the infrastructure yourself.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span>You don't want to operate the SMTP transport yourself.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span>You want rate limiting, brute-force protection, and webhooks built in.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span>You're on a Free plan (1,000 authenticated v1 API requests/month) and want to start at zero cost.</span></li>
          </ul>
        </section>

        {/* Next steps */}
        <section className="mt-8 rounded-lg border border-border bg-card/60 p-6">
          <h2 className="text-lg font-semibold text-foreground">Next steps</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>→ <a href="/examples" className="text-emerald-600 dark:text-emerald-400 hover:underline">See the copy-pasteable Next.js example</a></li>
            <li>→ <a href="/email-otp-api" className="text-emerald-600 dark:text-emerald-400 hover:underline">Email OTP API overview</a></li>
            <li>→ <a href="/email-verification-api" className="text-emerald-600 dark:text-emerald-400 hover:underline">Email Verification API overview</a></li>
            <li>→ <a href="/docs" className="text-emerald-600 dark:text-emerald-400 hover:underline">Read the full API documentation</a></li>
            <li>→ <a href="/pricing" className="text-emerald-600 dark:text-emerald-400 hover:underline">View plans and quotas</a></li>
            <li>→ <a href="/security" className="text-emerald-600 dark:text-emerald-400 hover:underline">Review the security controls</a></li>
          </ul>
        </section>
      </div>
    </>
  );
}
