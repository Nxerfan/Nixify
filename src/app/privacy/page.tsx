import { AmbientBackground } from "@/app/auth/components/AmbientBackground";

import type { Metadata } from "next";

/**
 * Page-level metadata — placeholder legal content must NOT be indexed or
 * promoted to search/AI discovery until it receives real legal review.
 * The route remains reachable to humans; only indexing is disabled.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Privacy Policy — static page with placeholder content structured for production.
 * Replace with legal-reviewed content before launch.
 */

export default function PrivacyPage() {
  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-100">Privacy Policy</h1>
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <strong>Draft — pending legal review.</strong> This page is placeholder content and has not been reviewed by legal counsel. It is not indexed by search engines.
        </div>
        <p className="mt-2 text-sm text-gray-600">Last updated: September 20, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-gray-400">
          <section>
            <h2 className="text-lg font-semibold text-gray-200">1. Information We Collect</h2>
            <p className="mt-2">We collect your email address when you sign up for Nixify. We also collect usage data (OTP requests, verification attempts) and technical data (IP address, user agent) for security and abuse prevention.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">2. How We Use Your Data</h2>
            <p className="mt-2">Your email is used to deliver OTP codes and communicate account-related information. Usage data is used to monitor for abuse, rate-limit requests, and improve our service. We never sell your data.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">3. Data Retention</h2>
            <p className="mt-2">OTP codes expire after 10 minutes and cannot be used after expiry, but database records are not automatically deleted at the moment of expiry. A manual admin cleanup process can remove consumed OTP records and certain tenant-owned activity and webhook-delivery records according to plan-specific retention windows. That cleanup is not scheduled automatically today. SecurityEvent and DeviceRequest records are not covered by the plan-based cleanup process. Retention behavior will be updated here when automated enforcement is deployed.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">4. Infrastructure &amp; Subprocessors</h2>
            <p className="mt-2">Nixify currently relies on Vercel for application hosting, TLS, Vercel Analytics, and Speed Insights; Neon for managed PostgreSQL database hosting; and an SMTP provider configured in the production environment for outbound email. The SMTP vendor is not named here until the production configuration is independently confirmed. Nixify does not sell personal data or share it with advertising networks.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">5. Your Rights</h2>
            <p className="mt-2">Self-service data access, correction, and deletion are not currently available. The formal process and contact details for privacy requests are pending legal review and will be published here once finalized.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">6. Security</h2>
            <p className="mt-2">All passwords are hashed with bcrypt (cost factor 12). OTP codes are protected with HMAC-SHA256 using a server-side pepper and never stored in plaintext. All traffic is encrypted via HTTPS. Sessions use <code dir="ltr" className="font-mono text-emerald-300">httpOnly</code>, <code dir="ltr" className="font-mono text-emerald-300">secure</code>, <code dir="ltr" className="font-mono text-emerald-300">sameSite: lax</code> cookies. See the <a href="/security" className="text-emerald-400 hover:underline">Security page</a> for the full list of implemented controls.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">7. Contact</h2>
            <p className="mt-2">Privacy contact details are pending legal review and are not yet published. This section will be updated when the contact process is finalized.</p>
          </section>
        </div>
      </div>
    </>
  );
}
