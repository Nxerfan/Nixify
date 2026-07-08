import { AmbientBackground } from "@/app/auth/components/AmbientBackground";

/**
 * Terms of Service — static page with placeholder content.
 * Replace with legal-reviewed content before launch.
 */

export default function TermsPage() {
  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-100">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-600">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-gray-400">
          <section>
            <h2 className="text-lg font-semibold text-gray-200">1. Acceptance of Terms</h2>
            <p className="mt-2">By using Nixify, you agree to these Terms of Service. If you do not agree, do not use the service.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">2. Service Description</h2>
            <p className="mt-2">Nixify provides email-based OTP (one-time password) verification for authentication. We send verification codes to email addresses provided by you or your users.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">3. Acceptable Use</h2>
            <p className="mt-2">You agree not to: abuse the service with excessive requests, use it for spam or phishing, attempt to bypass rate limits or security measures, or resell the service without authorization.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">4. Pricing & Billing</h2>
            <p className="mt-2">The Free plan is available at no cost with limits. Paid plans (Pro, Enterprise) are billed monthly or annually. All paid plans include a 30-day money-back guarantee. You can cancel anytime.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">5. Limitation of Liability</h2>
            <p className="mt-2">Nixify is provided "as is" without warranties. We are not liable for indirect, incidental, or consequential damages. Our maximum liability is limited to the amount you paid in the last 12 months.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">6. Account Termination</h2>
            <p className="mt-2">You can delete your account at any time from the dashboard. We may suspend or terminate accounts that violate these terms.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-200">7. Contact</h2>
            <p className="mt-2">Questions? Email <span className="text-emerald-400">legal@nixify.dev</span>.</p>
          </section>
        </div>
      </div>
    </>
  );
}
