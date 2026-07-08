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
    console.error("[instrumentation] seed failed:", e instanceof Error ? e.message : "unknown");
  }
}
