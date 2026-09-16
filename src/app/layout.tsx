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
        // Validate against supported list — invalid DB value falls through.
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
  // We construct a synthetic Request because next/headers gives us a readonly
  // snapshot, not a Request object. The resolver reads cookies, query, and
  // headers from it.
  const url = new URL(
    headerStore.get("x-url") ?? "http://localhost" + (headerStore.get("x-invoke-path") ?? "/"),
  );
  // Copy relevant headers into a Request so resolveLocale can use its own
  // cookie / header readers.
  const req = new Request(url, {
    method: "GET",
    headers: headerStore,
  });
  // Copy cookies from the cookieStore into the synthetic request. Next.js's
  // `cookies()` and `headers()` are async snapshots, not the live Request,
  // so we need to materialize the cookie header ourselves.
  const cookiePairs: string[] = [];
  for (const c of cookieStore.getAll()) {
    cookiePairs.push(`${c.name}=${c.value}`);
  }
  if (cookiePairs.length > 0) {
    req.headers.set("cookie", cookiePairs.join("; "));
  }
  // resolveLocale reads the URL query param from `request.url` — but we built
  // the URL from x-invoke-path which is the path WITHOUT query. Re-attach
  // the query string if present.
  const invokeQuery = headerStore.get("x-invoke-query");
  if (invokeQuery) {
    try {
      const q = JSON.parse(invokeQuery);
      if (q && typeof q === "object") {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(q)) {
          if (typeof v === "string") sp.set(k, v);
        }
        url.search = sp.toString();
        // Rebuild the request with the correct URL.
        const req2 = new Request(url, { method: "GET", headers: headerStore });
        if (cookiePairs.length > 0) {
          req2.headers.set("cookie", cookiePairs.join("; "));
        }
        const resolved = resolveLocale({
          userPreference,
          request: req2,
          searchParams: sp,
        });
        return resolved.locale;
      }
    } catch {
      // Fall through to the no-query resolution below.
    }
  }

  const resolved = resolveLocale({
    userPreference,
    request: req,
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
