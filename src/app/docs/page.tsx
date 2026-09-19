import type { Metadata } from "next";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { absoluteUrl } from "@/lib/site/site-url";
import { PublicDocsContent } from "./DocsContent";

/**
 * Public API documentation page.
 *
 * This route is intentionally PUBLIC (no auth required) — anonymous developers
 * evaluating Nixify can read the full API reference, webhooks guide, rate limits,
 * error catalog, and AI prompt helper without creating an account.
 *
 * The same documentation is also available inside the dashboard at
 * `/dashboard/docs` (for logged-in users who navigate from the sidebar). Both
 * pages share the same content; the dashboard version adds a "Back to Dashboard"
 * chrome button. This public version is a standalone marketing/docs page.
 *
 * Internal dashboard links inside this page (e.g. "Create an API key" →
 * `/dashboard/api-keys`) remain auth-gated — anonymous visitors will be
 * redirected to `/auth` by middleware if they click them. That is the intended
 * behavior: the docs are public, but creating resources still requires sign-in.
 */
export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Public API documentation for the Nixify email OTP verification platform. Quick start, endpoints, webhooks, rate limits, error codes, and an AI prompt helper.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    title: "Documentation — Nixify",
    description:
      "Public API documentation for the Nixify email OTP verification platform. Quick start, endpoints, webhooks, rate limits, error codes, and an AI prompt helper.",
    url: absoluteUrl("/docs"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Documentation — Nixify",
    description:
      "Public API documentation for the Nixify email OTP verification platform. Quick start, endpoints, webhooks, rate limits, error codes, and an AI prompt helper.",
  },
};

export default function PublicDocsPage() {
  return (
    <>
      <AmbientBackground />
      <PublicDocsContent />
    </>
  );
}
