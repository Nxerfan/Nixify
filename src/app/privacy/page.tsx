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
        <p className="mt-2 text-sm text-gray-600">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

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
            <p className="mt-2">OTP codes are deleted immediately after verification or after 10 minutes (whichever comes first). Account data is retained until you request deletion. Activity logs are retained for 90 days for security audit purposes.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">4. Your Rights (GDPR/CCPA)</h2>
            <p className="mt-2">You have the right to: access your data, request deletion ("right to be forgotten"), export your data, and object to processing. To exercise these rights, contact <span className="text-emerald-400">privacy@nixify.dev</span>.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">5. Security</h2>
            <p className="mt-2">All passwords are hashed with bcrypt (cost factor 12). OTP codes are hashed with SHA-256 and never stored in plaintext. All traffic is encrypted via HTTPS. Sessions use httpOnly cookies.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">6. Contact</h2>
            <p className="mt-2">Questions about this policy? Email <span className="text-emerald-400">privacy@nixify.dev</span>.</p>
          </section>
        </div>
      </div>
    </>
  );
}
