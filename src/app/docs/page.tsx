import type { Metadata } from "next";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { absoluteUrl } from "@/lib/site/site-url";
import { PublicDocsView } from "./PublicDocsView";

/**
 * Public API documentation page.
 *
 * This route is intentionally PUBLIC (no auth required) — anonymous developers
 * evaluating Nixify can read the full API reference, webhooks guide, rate limits,
 * error catalog, and code examples without creating an account.
 *
 * The same documentation is also available inside the dashboard at
 * /dashboard/docs (for logged-in users). Both pages share the same
 * DocsShell + DocsContent components — no drifting copies.
 *
 * Internal dashboard links (e.g. /dashboard/api-keys) are auth-gated;
 * anonymous visitors will be redirected to /auth by middleware.
 */

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Public API documentation for the Nixify email OTP verification platform. Quick start, endpoints, webhooks, rate limits, error codes, and code examples.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    title: "Documentation — Nixify",
    description:
      "Public API documentation for the Nixify email OTP verification platform. Quick start, endpoints, webhooks, rate limits, error codes, and code examples.",
    url: absoluteUrl("/docs"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Documentation — Nixify",
    description:
      "Public API documentation for the Nixify email OTP verification platform.",
  },
};

export default function PublicDocsPage() {
  return (
    <>
      <AmbientBackground />
      <PublicDocsView />
    </>
  );
}
