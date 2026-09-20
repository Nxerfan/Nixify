import type { Metadata } from "next";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { Check, X, Zap, ShieldCheck, Clock, Code2, Wrench } from "lucide-react";
import { absoluteUrl } from "@/lib/site/site-url";

export const metadata: Metadata = {
  title: "Nixify vs Building Email OTP Yourself",
  description:
    "A factual comparison of using Nixify versus building your own email OTP verification system. Covers code you'd write, infrastructure you'd manage, security you'd implement, and the time you'd spend.",
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
    nixify: "Handled by the API — POST /api/v1/otp/send returns immediately.",
    buildYourself:
      "Generate a 6-digit code, hash it with a server-side pepper (HMAC-SHA256), store the hash in your DB with an expiry timestamp. ~50 lines.",
  },
  {
    area: "Email delivery",
    nixify:
      "Nixify sends the email via its managed SMTP infrastructure. You never touch SMTP config.",
    buildYourself:
      "Configure an SMTP provider (or run your own relay), handle TLS, manage sender reputation, deal with bounces and spam filters. Ongoing operational work.",
  },
  {
    area: "Verification logic",
    nixify:
      "POST /api/v1/otp/verify with email + code. Returns verified: true/false and handles single-use, expiry, and attempt counting atomically.",
    buildYourself:
      "Look up the stored hash, compare with timingSafeEqual, enforce single-use (atomic UPDATE ... WHERE consumed = false), check expiry, increment attempt counter, lock after 5 failures. ~80 lines + careful transaction handling.",
  },
  {
    area: "Rate limiting",
    nixify:
      "Per-email (3/min, 10/hour) and per-IP (10/min send, 30/min verify) limits enforced automatically. Test keys skip per-email limits for fast CI.",
    buildYourself:
      "Build a rate limiter (Redis or DB-backed), choose your limits, handle the per-email vs per-IP distinction, return Retry-After headers. ~100 lines + a sliding-window store.",
  },
  {
    area: "Brute-force protection",
    nixify:
      "10 failed verifies in 15 min → 30-min account lock. 5 IP rate-limit violations → 30-min IP block. Automatic.",
    buildYourself:
      "Track failed attempts per email + per IP, implement lockout windows, decide when to auto-block IPs. ~60 lines + a violation tracker.",
  },
  {
    area: "Webhooks",
    nixify:
      "Signed (HMAC-SHA256) webhook deliveries for otp.sent, otp.verified, otp.failed, otp.expired. SSRF-protected destinations, retry with backoff.",
    buildYourself:
      "Build a webhook queue, sign payloads, handle retries + backoff, validate destination URLs (SSRF protection), build a delivery dashboard. ~300+ lines.",
  },
  {
    area: "Email theming",
    nixify:
      "Customize the OTP email template (colors, branding) in the dashboard. No code changes needed.",
    buildYourself:
      "Build a template system, render HTML + plaintext versions, manage theme variables, test across email clients. ~200+ lines.",
  },
  {
    area: "Quotas & plans",
    nixify:
      "Plan-based quotas (Free: 1,000 API messages/month, Pro: 50,000, Max: unlimited) enforced automatically. X-Quota-Remaining header on every response.",
    buildYourself:
      "Build a usage tracker, enforce limits, handle plan upgrades/downgrades, expose remaining quota to users. ~150+ lines.",
  },
  {
    area: "Security audit",
    nixify:
      "See the /security page for the full list of implemented controls. No SOC 2/ISO 27001 claimed.",
    buildYourself:
      "You are responsible for every security decision — hashing, storage, transport, cookie flags, secret management. Audit is on you.",
  },
  {
    area: "Time to production",
    nixify:
      "Copy the /examples integration, set your API key, deploy. Minutes to a working OTP flow.",
    buildYourself:
      "Days to weeks: design, implement, test, secure, deploy, monitor, and maintain. Ongoing operational burden.",
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
          page covers what you'd build, configure, and maintain to reach feature
          parity on your own. No invented numbers — the line counts are
          approximate and based on the real Nixify implementation.
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
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>Your OTP volume is high enough that the per-message cost of a managed service is a real constraint, and you can afford the engineering + ops time.</span></li>
          </ul>
        </section>

        {/* When Nixify makes sense */}
        <section className="mt-6 rounded-lg border border-gray-800/60 bg-gray-950/60 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
            <Zap className="h-5 w-5 text-emerald-400" /> When Nixify makes sense
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-400">
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>You want to ship email verification in minutes, not days.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>You don't want to manage SMTP deliverability, IP reputation, or bounce handling.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>You want rate limiting, brute-force protection, and webhooks built in.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>You're on a Free plan (1,000 API messages/month) and want to start at zero cost.</span></li>
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
