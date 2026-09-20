import type { Metadata } from "next";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import {
  ShieldCheck, Lock, KeyRound, Gauge, Webhook, Server, EyeOff, Clock,
} from "lucide-react";
import { absoluteUrl } from "@/lib/site/site-url";

export const metadata: Metadata = {
  title: "Security",
  description:
    "The real security controls implemented in Nixify — OTP hashing, rate limits, brute-force protection, webhook signing, and HTTPS enforcement.",
  alternates: {
    canonical: "/security",
  },
  openGraph: {
    title: "Nixify Security",
    description:
      "The real security controls implemented in Nixify — OTP hashing, rate limits, brute-force protection, webhook signing, and HTTPS enforcement.",
    url: absoluteUrl("/security"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nixify Security",
    description:
      "The real security controls implemented in Nixify — OTP hashing, rate limits, brute-force protection, webhook signing, and HTTPS enforcement.",
  },
};

/**
 * Public /security page.
 *
 * Every control listed here is VERIFIABLY implemented in the source code.
 * No invented certifications, audits, penetration tests, compliance frameworks,
 * or security contacts. If a control is not implemented, it is not listed.
 */
export default function SecurityPage() {
  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-100">
          <ShieldCheck className="h-8 w-8 text-emerald-400" /> Security
        </h1>
        <p className="mt-3 text-sm text-gray-400">
          Every control listed below is implemented in the Nixify source code.
          This page documents what actually exists — not aspirational or
          planned controls. No certifications, audits, or compliance frameworks
          are claimed.
        </p>

        <div className="mt-10 space-y-8">
          <section className="rounded-lg border border-gray-800/60 bg-gray-950/60 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
              <KeyRound className="h-5 w-5 text-emerald-400" /> OTP Code Security
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>Codes are hashed with <strong className="text-gray-200">HMAC-SHA256</strong> using a server-side pepper (<code dir="ltr" className="font-mono text-emerald-300">OTP_PEPPER</code>) before storage. Plaintext codes are never persisted.</span></li>
              <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>Codes expire after <strong className="text-gray-200">10 minutes</strong> and are <strong className="text-gray-200">single-use</strong> — a verified code cannot be reused.</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>Maximum <strong className="text-gray-200">5 verification attempts</strong> per code before per-code lockout.</span></li>
            </ul>
          </section>

          <section className="rounded-lg border border-gray-800/60 bg-gray-950/60 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
              <Gauge className="h-5 w-5 text-emerald-400" /> Rate Limiting &amp; Brute-Force Protection
            </h2>
            <p className="mt-3 text-xs text-gray-500">
              The values below are the application&apos;s default limits. Deployment configuration can override these values, so they should not be treated as immutable production limits unless the production environment is verified.
            </p>
            <div className="mt-3 overflow-x-auto rounded border border-gray-800/60">
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
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>By default, 10 cumulative failed verification attempts within 15 minutes trigger a 30-minute account lock.</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>By default, more than 5 IP rate-limit violations within one hour trigger a 30-minute automatic IP block.</span></li>
            </ul>
          </section>

          <section className="rounded-lg border border-gray-800/60 bg-gray-950/60 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
              <KeyRound className="h-5 w-5 text-emerald-400" /> API Key Security
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li className="flex gap-2"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>Two key environments: <code dir="ltr" className="font-mono text-emerald-300">mg_test_</code> (sandbox, no real email) and <code dir="ltr" className="font-mono text-emerald-300">mg_live_</code> (production).</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>Keys support <strong className="text-gray-200">full</strong> and <strong className="text-gray-200">read_only</strong> scopes, optional expiration dates, and can be revoked.</span></li>
              <li className="flex gap-2"><EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>API keys are stored only as SHA-256 hashes. The full secret is returned once at creation and is not stored in plaintext.</span></li>
            </ul>
          </section>

          <section className="rounded-lg border border-gray-800/60 bg-gray-950/60 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
              <Webhook className="h-5 w-5 text-emerald-400" /> Webhook Security
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>Every delivery is signed with <strong className="text-gray-200">HMAC-SHA256</strong> via the <code dir="ltr" className="font-mono text-emerald-300">Nixify-Signature</code> header.</span></li>
              <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>Signatures include a timestamp with <strong className="text-gray-200">5-minute replay tolerance</strong> — reject deliveries older than 5 minutes.</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span><strong className="text-gray-200">SSRF protection</strong>: webhook destination URLs are validated at creation and before every delivery; redirects are not followed.</span></li>
            </ul>
          </section>

          <section className="rounded-lg border border-gray-800/60 bg-gray-950/60 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
              <Server className="h-5 w-5 text-emerald-400" /> Transport &amp; Session Security
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span><strong className="text-gray-200">HTTPS enforced</strong> for all production traffic (Vercel TLS).</span></li>
              <li className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>Session cookies are <code dir="ltr" className="font-mono text-emerald-300">httpOnly</code>, use <code dir="ltr" className="font-mono text-emerald-300">Secure</code> in production, and use <code dir="ltr" className="font-mono text-emerald-300">SameSite=Lax</code>. These settings reduce exposure to script access and some cross-site request risks.</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>User passwords are hashed with <strong className="text-gray-200">bcrypt (cost factor 12)</strong> — never stored in plaintext.</span></li>
            </ul>
          </section>

          <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-200">
              <EyeOff className="h-5 w-5" /> What We Do Not Claim
            </h2>
            <p className="mt-3 text-sm text-gray-400">
              Nixify does not currently claim SOC 2, ISO 27001, PCI DSS, HIPAA, or any third-party security certification. We do not currently publish a penetration-test report, bug-bounty program, or formal third-party security audit. Security contact details are not yet published; this page will be updated when a reporting channel is finalized.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
