import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/cookie-consent";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ backgroundColor: "#0A0F0D", color: "#e5e7eb" }}
      >
        <ThemeProvider>
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
          <Toaster />
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
