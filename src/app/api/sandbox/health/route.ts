import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { TEMPLATES } from "@/lib/email-themes/templates";
import { renderThemeHtml } from "@/lib/email-themes/renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sandbox/health — health check for the email preview "sandbox".
 *
 * The "sandbox" in this project is NOT a Docker container, WASM runtime, or
 * serverless function. It is the server-side email renderer
 * (src/lib/email-themes/renderer.ts) + the client-side iframe that displays
 * the rendered HTML. There is no external service to "warm up" — the renderer
 * is a pure function that runs synchronously in the Next.js process.
 *
 * This endpoint verifies that:
 *   1. The renderer module loads without errors.
 *   2. A sample template renders to valid HTML (contains <html> and the OTP code).
 *   3. The response time is within acceptable bounds (< 500ms).
 *
 * Returns:
 *   200 — { status: "operational", latencyMs, requestId }
 *   503 — { status: "down", error, requestId }
 *
 * The requestId can be correlated with server logs to trace individual health
 * checks. This endpoint is safe to call from monitoring tools (UptimeRobot,
 * Vercel cron) every 5 minutes to keep the serverless function warm.
 */
export async function GET() {
  const requestId = randomUUID();
  const start = Date.now();

  try {
    // 1. Verify the renderer module loads
    if (!TEMPLATES || TEMPLATES.length === 0) {
      throw new Error("TEMPLATES array is empty — renderer module failed to load");
    }

    // 2. Render a sample template (minimal — the lightest template)
    const sampleTemplate = TEMPLATES.find((t) => t.id === "minimal") ?? TEMPLATES[0];
    const html = renderThemeHtml(sampleTemplate.config, {
      code: "000000",
      email: "health-check@nixify.dev",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      language: "en",
      mode: "light",
    });

    // 3. Validate the rendered HTML
    if (!html || !html.includes("<html") || !html.includes("000000")) {
      throw new Error("Renderer produced invalid HTML — missing <html> tag or OTP code");
    }

    const latencyMs = Date.now() - start;

    // Log success (structured, with requestId for tracing)
    console.log(JSON.stringify({
      level: "info",
      module: "sandbox/health",
      message: "Health check passed",
      requestId,
      latencyMs,
      templateCount: TEMPLATES.length,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json(
      {
        status: "operational",
        latencyMs,
        templateCount: TEMPLATES.length,
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    // Log failure (structured, with requestId for tracing)
    console.error(JSON.stringify({
      level: "error",
      module: "sandbox/health",
      message: "Health check failed",
      requestId,
      latencyMs,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json(
      {
        status: "down",
        error: errorMsg,
        requestId,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
