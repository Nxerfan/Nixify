import { createHash } from "crypto";
import { db } from "@/lib/db";

/**
 * Seed a known dev-environment API key so the SDK + CLI examples "just work"
 * against the local dev server. Idempotent: only inserts if no dev key exists.
 *
 * The seeded key is: mg_test_devkey_0000000000000000000000  (well-known, dev-only)
 * — never use in production. It is documented in the SDK + CLI examples and is
 * the default key the test suites use for happy-path assertions.
 *
 * This module is dynamically imported by instrumentation.ts only in the Node.js
 * runtime (not the Edge runtime) so the `crypto` import doesn't trigger an
 * Edge-runtime warning.
 */
export async function seedDevApiKey(): Promise<void> {
  const fullKey = "mg_test_devkey_0000000000000000000000";
  const keyHash = createHash("sha256").update(fullKey).digest("hex");
  const existing = await db.apiKey.findUnique({ where: { keyHash } });
  if (existing) return;
  await db.apiKey.create({
    data: {
      keyHash,
      prefix: fullKey.slice(0, 12),
      name: "Dev SDK key (seeded)",
      environment: "development",
      scopes: "full",
      createdBy: "instrumentation",
    },
  });
  console.log("[instrumentation] Seeded dev API key: mg_test_devkey_0000000000000000000000");
}
