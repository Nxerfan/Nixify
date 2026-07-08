"use client";

import { useEffect } from "react";

/**
 * Global error boundary — catches errors that the route-level error.tsx can't
 * (e.g., errors in the root layout itself). Must render its own <html> + <body>.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.message, error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#0A0F0D", color: "#e5e7eb", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ maxWidth: 400, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f5f5f4", marginBottom: 8 }}>
              Application Error
            </h1>
            <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 24 }}>
              A critical error occurred. Please refresh the page or try again later.
            </p>
            {error.digest && (
              <p style={{ fontSize: 12, color: "#4b5563", fontFamily: "monospace", marginBottom: 24 }}>
                ID: {error.digest}
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
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
