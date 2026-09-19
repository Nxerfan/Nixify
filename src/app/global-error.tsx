"use client";

import { useEffect, useState } from "react";

/**
 * Global error boundary — catches errors that the route-level error.tsx can't
 * (e.g., errors in the root layout itself). Must render its own <html> + <body>.
 *
 * Since LocaleProvider lives in the root layout, this component can't use
 * useTranslations(). We do a best-effort client-side locale detection from
 * navigator.language so Persian users see the html lang/dir attributes
 * set correctly. The visible copy stays English-only as a safe fallback
 * (this surface is rarely seen — only on root-layout crashes).
 */

function detectLocale(): "en" | "fa" {
  if (typeof navigator === "undefined") return "en";
  const langs = [navigator.language, ...(navigator.languages ?? [])];
  for (const l of langs) {
    if (!l) continue;
    if (l.toLowerCase().startsWith("fa")) return "fa";
  }
  return "en";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<"en" | "fa">("en");

  useEffect(() => {
    console.error("[global-error]", error.message, error.digest);
    // Detect locale client-side once on mount (navigator is undefined on the
    // server). This setState is intentional — we sync the navigator.language
    // signal into React state so the rendered copy + html lang/dir are correct.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(detectLocale());
  }, [error]);

  const title = locale === "fa" ? "خطای برنامه" : "Application Error";
  const subtitle =
    locale === "fa"
      ? "خطای بحرانی رخ داد. لطفاً صفحه را بازخوانی یا بعداً دوباره تلاش کنید."
      : "A critical error occurred. Please refresh the page or try again later.";
  const errorIdLabel = locale === "fa" ? "شناسه:" : "ID:";
  const tryAgain = locale === "fa" ? "تلاش مجدد" : "Try again";

  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}>
      <body style={{ margin: 0, padding: 0, backgroundColor: "#0A0F0D", color: "#e5e7eb", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ maxWidth: 400, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f5f5f4", marginBottom: 8 }}>
              {title}
            </h1>
            <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 24 }}>
              {subtitle}
            </p>
            {error.digest && (
              <p style={{ fontSize: 12, color: "#4b5563", fontFamily: "monospace", marginBottom: 24 }} dir="ltr">
                {errorIdLabel} {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                backgroundColor: "#059669",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {tryAgain}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
