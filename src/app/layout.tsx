import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_HTML_DIR, type Locale } from "@/lib/i18n/locales";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nixify — Email OTP Verification Platform",
  description:
    "Nixify delivers real OTP email verification over SMTP with a 1-month free trial. Zero-cost. Self-hostable. SMTP-swappable. Plan-based entitlements, webhooks, and email theming.",
  keywords: [
    "Nixify",
    "OTP",
    "email verification",
    "SMTP",
    "free trial",
    "Next.js",
    "TypeScript",
  ],
  authors: [{ name: "Nixify" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Nixify — Email Verification & Free Trial",
    description:
      "Real OTP email verification. Zero-cost. Self-hostable. SMTP-swappable.",
    siteName: "Nixify",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nixify — Email Verification & Free Trial",
    description:
      "Real OTP email verification. Zero-cost. Self-hostable. SMTP-swappable.",
  },
};

/**
 * Resolve the locale for the initial server render.
 *
 * This is the SINGLE point where the locale is decided for the initial HTML
 * response. It reads (in priority order):
 *   1. Authenticated user's `preferredLocale` (DB lookup).
 *   2. `?locale=…` URL query param (locale-switcher links).
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
async function resolveInitialLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  // 1. Authenticated user preference.
  let userPreference: Locale | null = null;
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySession(sessionToken);
  if (session?.sub) {
    const userId = Number(session.sub);
    if (Number.isFinite(userId) && userId > 0) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { preferredLocale: true },
      });
      if (user?.preferredLocale) {
        if (
          user.preferredLocale === "en" ||
          user.preferredLocale === "fa"
        ) {
          userPreference = user.preferredLocale;
        }
      }
    }
  }

  // 2-6. Build a Request-like object for resolveLocale().
  //
  // BLOCKER #3 fix: we NO LONGER depend on undocumented Next.js internal
  // headers (`x-url`, `x-invoke-path`, `x-invoke-query`). Instead, the
  // middleware writes a controlled `x-nixify-url-locale` header containing
  // the validated `?locale=…` query param value (or omits it if absent /
  // unsupported). The root layout reads ONLY this controlled header.
  //
  // We NEVER trust an incoming client-provided copy of `x-nixify-url-locale`
  // — the middleware overwrites any client-supplied value. This is a private
  // internal contract between the middleware and the layout.
  const nixifyLocale = headerStore.get("x-nixify-url-locale");
  const searchParams = nixifyLocale
    ? new URLSearchParams({ locale: nixifyLocale })
    : undefined;

  // Construct a synthetic Request for resolveLocale(). The URL is the
  // middleware-visible host + path; the query is derived from the controlled
  // header above.
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "localhost";
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const path = headerStore.get("x-forwarded-path") ?? "/";
  const url = new URL(`${proto}://${host}${path}`);
  if (nixifyLocale) {
    url.searchParams.set("locale", nixifyLocale);
  }

  // Materialize the cookie header from the Next.js cookie store.
  const headerObj: Record<string, string> = {};
  const cookiePairs: string[] = [];
  for (const c of cookieStore.getAll()) {
    cookiePairs.push(`${c.name}=${c.value}`);
  }
  if (cookiePairs.length > 0) {
    headerObj["cookie"] = cookiePairs.join("; ");
  }
  // Copy through the headers needed by resolveLocale (Geo, Accept-Language).
  for (const h of [
    "x-vercel-ip-country",
    "accept-language",
  ]) {
    const v = headerStore.get(h);
    if (v) headerObj[h] = v;
  }
  const req = new Request(url, {
    method: "GET",
    headers: headerObj,
  });

  const resolved = resolveLocale({
    userPreference,
    request: req,
    searchParams,
  });
  return resolved.locale;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await resolveInitialLocale();
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
