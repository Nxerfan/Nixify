import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site/site-url";

/**
 * Route-level metadata for /pricing.
 *
 * The pricing page itself is a client component ("use client"), so it cannot
 * export `generateMetadata` or a static `metadata` export. This server
 * layout provides the route-specific metadata that the pricing page needs.
 *
 * Truth: FREE / PRO / MAX plans with transparent pricing and quotas.
 */
export const metadata: Metadata = {
  title: "Pricing — Nixify",
  description:
    "Simple, transparent pricing for Nixify's email OTP verification API. FREE, PRO, and MAX plans with clear quotas for API messages, OTP emails, messaging, and broadcast sends. No hidden fees.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Nixify Pricing — Email OTP API Plans",
    description:
      "FREE, PRO, and MAX plans with transparent quotas. Email OTP verification, messaging, broadcast, webhooks, and branding.",
    url: absoluteUrl("/pricing"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nixify Pricing — Email OTP API Plans",
    description:
      "FREE, PRO, and MAX plans with transparent quotas for email OTP verification, messaging, and broadcast.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
