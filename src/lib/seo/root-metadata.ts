/**
 * Phase 16 — Root metadata (extracted for testability).
 *
 * The root layout's `Metadata` object lives here so it can be unit-tested
 * WITHOUT importing `src/app/layout.tsx` (which imports `./globals.css` and
 * triggers PostCSS/Tailwind processing that vitest cannot load). The layout
 * imports and re-exports this object.
 *
 * Audited to remove stale unsupported commercial/search claims ("1-month free
 * trial", "Zero-cost", "Free Trial"). The product has Free / Pro / Max plans;
 * the metadata does not imply the entire commercial product is free, and makes
 * no unsupported trial guarantees, refund guarantees, SLA claims, or fictional
 * testimonials.
 *
 * `metadataBase` resolves all relative metadata URLs (canonical, OG, Twitter)
 * against the canonical production origin — never localhost or a Vercel
 * preview URL (see `src/lib/site/site-url.ts`).
 *
 * Title template: page-specific titles get ` — Nixify` appended automatically.
 */
import type { Metadata } from "next";
import { getSiteOrigin } from "@/lib/site/site-url";

const siteOrigin = getSiteOrigin();

export const rootMetadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: "Nixify — Email OTP Verification Platform",
    template: "%s — Nixify",
  },
  description:
    "Nixify delivers real OTP email verification over SMTP. Self-hostable, SMTP-swappable, with plan-based entitlements, webhooks, and email theming.",
  applicationName: "Nixify",
  authors: [{ name: "Nixify" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Nixify — Email OTP Verification Platform",
    description:
      "Real OTP email verification over SMTP. Self-hostable, SMTP-swappable, with webhooks and email theming.",
    siteName: "Nixify",
    type: "website",
    url: siteOrigin,
  },
  twitter: {
    card: "summary_large_image",
    title: "Nixify — Email OTP Verification Platform",
    description:
      "Real OTP email verification over SMTP. Self-hostable, SMTP-swappable, with webhooks and email theming.",
  },
};
