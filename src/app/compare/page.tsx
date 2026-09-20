import type { Metadata } from "next";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { Check, Zap, Wrench, Code2 } from "lucide-react";
import { absoluteUrl } from "@/lib/site/site-url";

export const metadata: Metadata = {
  title: "Nixify vs Building Email OTP Yourself",
  description:
    "A factual comparison of using Nixify versus building your own email OTP verification system. Covers the code, infrastructure, and security you would implement to reach feature parity.",
  alternates: {
    canonical: "/compare",
  },
  openGraph: {
    title: "Nixify vs Building Email OTP Yourself",
    description:
      "A factual comparison of using Nixify versus building your own email OTP verification system.",
    url: absoluteUrl("/compare"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nixify vs Building Email OTP Yourself",
    description:
      "A factual comparison of using Nixify versus building your own email OTP verification system.",
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
      "Nixify sends the email via its configured SMTP transport. You never touch SMTP config.",
    buildYourself:
      "Configure an SMTP provider (or run your own relay), handle TLS, manage sender reputation, and handle bounces and spam filters. Ongoing operational work.",
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
      "Per-email (3/min, 10/hour) and per-IP (10/min send, 30/min verify) limits enforced automatically. mg_test_ keys skip the per-email OTP send limit; the per-IP limit still applies.",
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
      "Plan-based API request quotas (API_MESSAGES: Free 1,000/month, Pro 50,000/month, Max unlimited) enforced automatically. OTP email sends have a separate OTP_EMAILS quota. X-Quota-Remaining is returned on successful (2xx) responses.",
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
        <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-100">
          <Zap className="h-8 w-8 text-emerald-400" /> Nixify vs Building Email OTP Yourself
        </h1>
        <p className="mt-3 text-sm text-gray-400">
          A factual comparison. Nixify is an email OTP verification API — this
          page covers what Nixify currently implements versus what a self-built
          system would need to implement to reach feature parity. The
          comparison is qualitative, not based on line counts or time
          estimates.
        </p>

        {/* Comparison table */}
        <div className="mt-8 overflow-x-auto rounded-lg border border-gray-800/60">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/60">
              <tr className="border-b border-gray-800/60 text-left">
                <th className="px-4 py-3 font-medium text-gray-300">Area</th>
                <th className="px-4 py-3 font-medium text-emerald-300">With Nixify</th>
                <th className="px-4 py-3 font-medium text-gray-300">Building yourself</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={row.area} className={i % 2 === 0 ? "border-b border-gray-800/40 bg-gray-950/30" : "border-b border-gray-800/40"}>
                  <td className="px-4 py-3 font-medium text-gray-200">{row.area}</td>
                  <td className="px-4 py-3 text-gray-400">
                    <div className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{row.nixify}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
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
        <section className="mt-8 rounded-lg border border-gray-800/60 bg-gray-950/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
            <Code2 className="h-5 w-5 text-emerald-400" /> When building yourself makes sense
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-400">
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>You need full control over the email transport layer (custom SMTP relay, on-prem delivery).</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>You have strict data-residency requirements that prevent using any third-party API.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>Your OTP volume is high enough that the per-message cost of a managed service is a real constraint, and you can afford the engineering and ops time.</span></li>
          </ul>
        </section>

        {/* When Nixify makes sense */}
        <section className="mt-6 rounded-lg border border-gray-800/60 bg-gray-950/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
            <Zap className="h-5 w-5 text-emerald-400" /> When Nixify makes sense
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-400">
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>You want email verification without building and maintaining the infrastructure yourself.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>You don't want to manage SMTP deliverability, IP reputation, or bounce handling.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>You want rate limiting, brute-force protection, and webhooks built in.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>You're on a Free plan (1,000 API requests/month) and want to start at zero cost.</span></li>
          </ul>
        </section>

        {/* Next steps */}
        <section className="mt-8 rounded-lg border border-gray-800/60 bg-gray-950/60 p-6">
          <h2 className="text-lg font-semibold text-gray-100">Next steps</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-400">
            <li>→ <a href="/examples" className="text-emerald-400 hover:underline">See the copy-pasteable Next.js example</a></li>
            <li>→ <a href="/docs" className="text-emerald-400 hover:underline">Read the full API documentation</a></li>
            <li>→ <a href="/pricing" className="text-emerald-400 hover:underline">View plans and quotas</a></li>
            <li>→ <a href="/security" className="text-emerald-400 hover:underline">Review the security controls</a></li>
          </ul>
        </section>
      </div>
    </>
  );
}
