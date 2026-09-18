/**
 * Phase 17 — Landing page API code snippets.
 *
 * Extracted from the CodePreviewSection React component so the snippet
 * construction is:
 *   1. Pure (no React, no hooks, no CSS imports) — unit-testable.
 *   2. Deterministic — the displayed URLs are resolved at build time from the
 *      canonical PRODUCTION_ORIGIN, NOT left as an undefined identifier in the
 *      user-facing code.
 *
 * The canonical origin is interpolated into the DISPLAYED string so a user
 * who copies the snippet gets a real, standalone URL — not an internal React
 * variable name like `PRODUCTION_ORIGIN`.
 */
import { PRODUCTION_ORIGIN } from "@/lib/site/site-url";

export interface LandingSnippets {
  js: string;
  curl: string;
  python: string;
}

/**
 * Build the landing-page code example snippets.
 *
 * The returned strings are exactly what a user sees in the code preview.
 * They contain the actual canonical production URL (e.g.
 * `https://nixify.vercel.app/api/v1/otp/send`), NOT the identifier
 * `PRODUCTION_ORIGIN`.
 */
export function buildLandingSnippets(): LandingSnippets {
  const sendUrl = `${PRODUCTION_ORIGIN}/api/v1/otp/send`;
  const verifyUrl = `${PRODUCTION_ORIGIN}/api/v1/otp/verify`;

  return {
    js: `// Send a 6-digit OTP via the REST API
const sendRes = await fetch('${sendUrl}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer mg_live_xxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    purpose: 'signup',
  }),
});
const sendData = await sendRes.json();
console.log(sendData.otp_request_id);

// Verify it (use the same purpose)
const verifyRes = await fetch('${verifyUrl}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer mg_live_xxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    code: '482917',
    purpose: 'signup',
  }),
});
const verifyData = await verifyRes.json();
console.log(verifyData.verified);`,

    curl: `curl -X POST ${sendUrl} \\
  -H 'Authorization: Bearer mg_live_xxx' \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"user@example.com","purpose":"signup"}'`,

    python: `import requests

res = requests.post(
    '${sendUrl}',
    headers={'Authorization': 'Bearer mg_live_xxx'},
    json={'email': 'user@example.com', 'purpose': 'signup'}
)
print(res.json())`,
  };
}
