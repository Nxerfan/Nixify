/**
 * Next.js instrumentation hook — runs once on server startup. Used to seed the
 * admin user + disposable blocklist so the security dashboard works out of the
 * box with ADMIN_EMAIL/ADMIN_PASSWORD env vars. Also seeds a well-known dev
 * API key so the SDK + CLI examples "just work" against the local dev server.
 */
export async function register() {
  // Only run on the server (not the Edge runtime).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { seedAdmin } = await import("@/lib/auth/admin");
    const { seedDisposableBlocklist } = await import("@/lib/security");
    const { seedDevApiKey } = await import("@/lib/dx/seed-dev-key");
    await seedAdmin();
    await seedDisposableBlocklist();
    await seedDevApiKey();
    console.log("[instrumentation] Seeded admin + disposable blocklist + dev API key");
  } catch (e) {
    // Swallow the error — instrumentation MUST NOT crash the server process.
    // The seed functions are best-effort: if the DB is unreachable (e.g. a
    // preview deploy without DATABASE_URL, or a schema mismatch), the server
    // should still start and serve requests. The seed will retry on the next
    // successful startup.
    console.error("[instrumentation] seed failed (non-fatal):", e instanceof Error ? e.message : "unknown");
  }
}
