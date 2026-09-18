import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { ShieldCheck, Zap, Globe, Lock } from "lucide-react";

export const metadata = { title: "About Nixify" };

export default function AboutPage() {
  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="text-4xl font-bold text-gray-100">About Nixify</h1>
        <p className="mt-4 text-lg text-gray-400">
          We build developer tools that make email verification effortless.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-800/40 bg-gray-950/40 p-6 backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-100">Our Mission</h3>
            <p className="mt-2 text-sm text-gray-500">
              Eliminate the friction of email verification for developers worldwide.
              No more wrestling with SMTP configs, deliverability issues, or overpriced
              ESP subscriptions just to send a 6-digit code.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800/40 bg-gray-950/40 p-6 backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <Zap className="h-5 w-5 text-emerald-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-100">What We Build</h3>
            <p className="mt-2 text-sm text-gray-500">
              Nixify is a production-grade OTP email verification platform with real SMTP
              delivery, plan-based entitlements, webhook integrations, and a beautiful
              email theme system. A Free plan is available.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800/40 bg-gray-950/40 p-6 backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <Globe className="h-5 w-5 text-emerald-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-100">Our Stack</h3>
            <p className="mt-2 text-sm text-gray-500">
              Next.js 16, TypeScript, Prisma, Tailwind CSS, framer-motion, and Nodemailer.
              Deployed on Vercel. Database on Neon Postgres. Email delivery via managed SMTP infrastructure.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800/40 bg-gray-950/40 p-6 backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <Lock className="h-5 w-5 text-emerald-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-100">Security First</h3>
            <p className="mt-2 text-sm text-gray-500">
              HMAC-SHA256 OTP hashing with server-side pepper, constant-time comparison, atomic single-use enforcement, and DB-backed rate limiting with brute-force lockout.
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-600">
            &copy; 2026 Nixify. All rights reserved.
          </p>
        </div>
      </div>
    </>
  );
}
