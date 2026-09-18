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
            <p className="mt-2">OTP codes become invalid after 10 minutes and are single-use. Stored OTP records are retained according to current operational retention processes. Activity log retention limits are defined per plan (Free, Pro, Max). Automated enforcement of these limits is pending configuration. Contact us for current retention practices.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">4. Your Rights</h2>
            <p className="mt-2">Self-service data management is not currently available. The request/contact process will be published after legal review.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">5. Security</h2>
            <p className="mt-2">All passwords are hashed with bcrypt (cost factor 12). OTP codes are protected with HMAC-SHA256 using a server-side pepper and never stored in plaintext. All traffic is encrypted via HTTPS. Sessions use httpOnly cookies.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">6. Contact</h2>
            <p className="mt-2">Questions about this policy? Contact details are pending legal review and will be published here once finalized.</p>
          </section>
        </div>
      </div>
    </>
  );
}
