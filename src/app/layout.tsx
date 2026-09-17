import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import { LOCALE_HTML_DIR } from "@/lib/i18n/locales";
import { getSiteOrigin } from "@/lib/site/site-url";
import { buildWebSiteJsonLd, buildOrganizationJsonLd } from "@/lib/seo/json-ld";
import { JsonLd } from "@/components/seo/JsonLd";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Phase 16 — Global metadata.
 *
 * Audited to remove stale unsupported commercial/search claims ("1-month free
 * trial", "Zero-cost", "Free Trial"). The product has Free / Pro / Max plans;
 * the metadata does not imply the entire commercial product is free, and does
 * not make unsupported trial guarantees, refund guarantees, SLA claims, or
 * fictional testimonials.
 *
 * `metadataBase` resolves all relative metadata URLs (canonical, OG, Twitter)
 * against the canonical production origin — never localhost or a Vercel
 * preview URL (see `src/lib/site/site-url.ts`).
 *
 * Title template: page-specific titles get ` — Nixify` appended automatically.
 */
const siteOrigin = getSiteOrigin();

export const metadata: Metadata = {
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

/**
 * Resolve the locale for the initial server render.
 *
 * This delegates to the SHARED canonical server locale resolver
 * (`resolveServerLocale`) — the SAME helper used by `/blog` and
 * `/blog/[slug]`. There is no layout-specific or blog-specific locale
 * precedence implementation; every server entry point that needs the locale
 * for the current request goes through this one helper, which in turn
 * delegates to the canonical pure `resolveLocale()`.
 *
 * Precedence (documented in `src/lib/i18n/server-locale.ts` and
 * `src/lib/i18n/resolve.ts`):
 *   1. Authenticated user's `preferredLocale` (DB lookup).
 *   2. `x-nixify-url-locale` controlled header (middleware-written `?locale=…`).
 *   3. `mg_locale` first-party cookie.
 *   4. Trusted Vercel `x-vercel-ip-country` header (Iran → fa).
 *   5. `Accept-Language` header.
 *   6. `en` fallback.
 *
 * The resolved locale is passed to BOTH `<html lang dir>` AND `<LocaleProvider>`
 * so the initial server-rendered markup matches what the client provider will
 * use on hydration — no mismatch.
 *
 * Per spec §9, locale is NOT done via URL prefixing or middleware redirects
 * (those would cause redirect loops + hydration mismatches). The cookie +
 * provider + server-side resolution model preserves the current public URLs.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await resolveServerLocale();
  const dir = LOCALE_HTML_DIR[locale];

  return (
    <html
      lang={locale}
      dir={dir}
      data-locale={locale}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ backgroundColor: "#0A0F0D", color: "#e5e7eb" }}
      >
        {/* Structured data: WebSite + Organization (factual, no fake ratings) */}
        <JsonLd data={buildWebSiteJsonLd()} />
        <JsonLd data={buildOrganizationJsonLd()} />
        <ThemeProvider>
          <LocaleProvider locale={locale}>
            <div className="relative flex min-h-screen flex-col">
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
            <Toaster />
            <CookieConsent />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
