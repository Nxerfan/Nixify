/**
 * HOTFIX(restore-otp-delivery) — regression tests for the production OTP outage.
 *
 * Root cause: PR #33 added `firstName`/`lastName` to the Prisma User schema +
 * migration `20260924000000_add_user_names_and_ondelete_rules`, but the Vercel
 * deploy pipeline runs only `prisma generate` (postinstall) + `next build` —
 * never `prisma migrate deploy`. The deployed Prisma client therefore lists
 * `firstName`/`lastName` as User scalar fields, but production Neon's User
 * table does not have those columns. Every DEFAULT-select User query
 * (findUnique/create/update without an explicit `select`) throws a Prisma
 * error (P2021/P2009) and surfaces as HTTP 500 internal_error on signup,
 * login, resend-otp, forgot-password, verify-email, and reset-password.
 *
 * These tests verify the auth routes use EXPLICIT `select` on every User
 * query so they are resilient to pending additive column migrations. They
 * would have caught the production outage.
 *
 * If a future change removes the explicit `select` (reverting to default
 * select), these tests fail — preventing recurrence.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  // __dirname = src/lib/auth. We need to go up 3 levels to reach the project root.
  return readFileSync(resolve(__dirname, "../../..", relPath), "utf-8");
}

// ─── Auth routes must use explicit `select` on every User query ───────────

describe("HOTFIX(restore-otp-delivery) — auth routes use explicit select on User queries", () => {
  const authRoutes = [
    "src/app/api/auth/signup/route.ts",
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/resend-otp/route.ts",
    "src/app/api/auth/forgot-password/route.ts",
    "src/app/api/auth/verify-email/route.ts",
    "src/app/api/auth/reset-password/route.ts",
  ];

  for (const route of authRoutes) {
    it(`${route} — no default-select db.user.findUnique({ where: ... })`, () => {
      const src = readSrc(route);
      // A default-select findUnique looks like: db.user.findUnique({ where: { ... } })
      // with NO `select` key. We check that every findUnique on db.user includes
      // a `select:` key. This regex matches `db.user.findUnique({` followed by
      // (possibly whitespace + `where:`) but NOT `select:` as the first key.
      //
      // We assert the route does NOT contain a bare `db.user.findUnique({ where:`
      // without a `select`. The simplest check: every `db.user.findUnique` call
      // must be immediately followed (within the call) by a `select:` key.
      const findUniqueCalls = src.match(/db\.user\.findUnique\(\{/g) ?? [];
      expect(findUniqueCalls.length).toBeGreaterThan(0);
      // Every findUnique must have a `select:` somewhere in its arguments.
      // We check that the source contains `select:` for each findUnique by
      // verifying the overall select count >= findUnique count.
      const selectCount = (src.match(/\bselect:\s*\{/g) ?? []).length;
      expect(selectCount).toBeGreaterThanOrEqual(findUniqueCalls.length);
    });

    it(`${route} — no default-select db.user.update (must include select:)`, () => {
      const src = readSrc(route);
      // Find all `db.user.update` calls. Each must have a `select:` key.
      const updateCalls = src.match(/db\.user\.update\(\{/g) ?? [];
      if (updateCalls.length === 0) return; // route may not have updates
      // Count `select:` occurrences — must cover every update + findUnique.
      const selectCount = (src.match(/\bselect:\s*\{/g) ?? []).length;
      const findUniqueCount = (src.match(/db\.user\.findUnique\(\{/g) ?? []).length;
      expect(selectCount).toBeGreaterThanOrEqual(updateCalls.length + findUniqueCount);
    });

    it(`${route} — no default-select db.user.create (must include select:)`, () => {
      const src = readSrc(route);
      const createCalls = src.match(/db\.user\.create\(\{/g) ?? [];
      if (createCalls.length === 0) return; // route may not have creates
      const selectCount = (src.match(/\bselect:\s*\{/g) ?? []).length;
      const findUniqueCount = (src.match(/db\.user\.findUnique\(\{/g) ?? []).length;
      const updateCount = (src.match(/db\.user\.update\(\{/g) ?? []).length;
      expect(selectCount).toBeGreaterThanOrEqual(createCalls.length + findUniqueCount + updateCount);
    });
  }

  it("getAuthenticatedUser uses explicit select (no default select)", () => {
    const src = readSrc("src/lib/auth/session.ts");
    const findUniqueCalls = src.match(/db\.user\.findUnique\(\{/g) ?? [];
    expect(findUniqueCalls.length).toBe(1); // exactly one findUnique in getAuthenticatedUser
    const selectCount = (src.match(/\bselect:\s*\{/g) ?? []).length;
    expect(selectCount).toBeGreaterThanOrEqual(findUniqueCalls.length);
  });

  it("getAuthenticatedUser does NOT select firstName or lastName", () => {
    // firstName/lastName are the pending-migration columns. They must NOT be
    // in the getAuthenticatedUser select — they're loaded separately by
    // /api/profile/me with a graceful fallback.
    const src = readSrc("src/lib/auth/session.ts");
    // The select block must not contain `firstName: true` or `lastName: true`.
    const selectBlock = src.match(/select:\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(selectBlock).not.toContain("firstName: true");
    expect(selectBlock).not.toContain("lastName: true");
  });

  it("profile/me loads firstName/lastName with try/catch fallback", () => {
    // /api/profile/me must use a separate guarded query for firstName/lastName
    // so it degrades gracefully (returns null) when the columns don't exist.
    const src = readSrc("src/app/api/profile/me/route.ts");
    expect(src).toContain("select: { firstName: true, lastName: true }");
    // The query must be wrapped in try/catch — this is the graceful fallback.
    expect(src).toMatch(/try\s*\{[\s\S]*select:\s*\{\s*firstName:\s*true,\s*lastName:\s*true\s*\}/);
    expect(src).toContain("catch");
    // The catch block must set both to null (graceful degradation).
    expect(src).toMatch(/catch[\s\S]*firstName\s*=\s*null/);
    expect(src).toMatch(/catch[\s\S]*lastName\s*=\s*null/);
  });

  it("security checkAccountLock auto-unlock uses explicit select", () => {
    // checkAccountLock's auto-unlock `db.user.update` must use explicit select
    // so it doesn't break when firstName/lastName are pending.
    const src = readSrc("src/lib/security/index.ts");
    // Find the checkAccountLock function body. It's the function that contains
    // the auto-unlock update. We look for the `db.user.update({` that appears
    // after `checkAccountLock` and verify it has a `select:` key.
    const checkAccountLockIdx = src.indexOf("export async function checkAccountLock");
    expect(checkAccountLockIdx).toBeGreaterThan(-1);
    // Extract a reasonable window of the function body (next 1000 chars).
    const section = src.slice(checkAccountLockIdx, checkAccountLockIdx + 1000);
    expect(section).toContain("db.user.update");
    expect(section).toContain("select:");
  });

  it("profile/complete uses explicit select on update", () => {
    const src = readSrc("src/app/api/profile/complete/route.ts");
    const updateCalls = src.match(/db\.user\.update\(\{/g) ?? [];
    expect(updateCalls.length).toBe(1);
    const selectCount = (src.match(/\bselect:\s*\{/g) ?? []).length;
    expect(selectCount).toBeGreaterThanOrEqual(updateCalls.length);
  });
});

// ─── Migration file exists and is additive (no destructive ops) ──────────

describe("HOTFIX(restore-otp-delivery) — PR #33 migration is additive and pending-safe", () => {
  it("migration 20260924000000 adds firstName/lastName as nullable (additive)", () => {
    const migration = readSrc(
      "prisma/migrations/20260924000000_add_user_names_and_ondelete_rules/migration.sql"
    );
    // The migration must ADD the columns (not drop them) and they must be
    // nullable (TEXT without NOT NULL) so existing rows get NULL.
    expect(migration).toMatch(/ALTER TABLE "User" ADD COLUMN "firstName" TEXT/);
    expect(migration).toMatch(/ALTER TABLE "User" ADD COLUMN "lastName" TEXT/);
    // Must NOT drop any columns — this is additive only.
    expect(migration).not.toMatch(/DROP COLUMN/);
  });

  it("Prisma schema declares firstName/lastName as nullable on User", () => {
    const schema = readSrc("prisma/schema.prisma");
    const userSection = schema.split("model User")[1]?.split("model ")[0] ?? "";
    expect(userSection).toContain("firstName        String?");
    expect(userSection).toContain("lastName         String?");
  });
});

// ─── Vercel deploy pipeline gap (documentation of the root cause) ─────────

describe("HOTFIX(restore-otp-delivery) — deploy pipeline does NOT run migrate deploy", () => {
  it("package.json postinstall runs only prisma generate (not migrate deploy)", () => {
    const pkg = readSrc("package.json");
    const postinstallMatch = pkg.match(/"postinstall":\s*"([^"]*)"/);
    expect(postinstallMatch).not.toBeNull();
    expect(postinstallMatch![1]).toContain("prisma generate");
    expect(postinstallMatch![1]).not.toContain("migrate deploy");
  });

  it("package.json build runs only next build (not migrate deploy)", () => {
    const pkg = readSrc("package.json");
    const buildMatch = pkg.match(/"build":\s*"([^"]*)"/);
    expect(buildMatch).not.toBeNull();
    expect(buildMatch![1]).toContain("next build");
    expect(buildMatch![1]).not.toContain("migrate deploy");
  });

  it("vercel.json does not override build command to run migrations", () => {
    // An empty vercel.json means Vercel uses the package.json scripts as-is.
    // If a future change adds a build command here that runs migrations, this
    // test would need updating — but for now it documents the gap.
    const vercelJson = readSrc("vercel.json");
    // vercel.json is `{}` — no buildCommand, no migrations.
    expect(vercelJson.trim()).toBe("{}");
  });
});
