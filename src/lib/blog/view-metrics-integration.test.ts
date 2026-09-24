/**
 * Phase 18 — Article view metrics real PostgreSQL integration tests.
 *
 * Runs ONLY in CI with:
 *   TEST_DATABASE_URL=<postgres-url> RUN_BLOG_INTEGRATION=1
 *
 * Coverage:
 *   - article view persistence
 *   - invalid view slug rejected
 *   - view dedup (same IP+slug within window counts once) — RESTORED (Blocker 5)
 *   - Most Viewed uses real rows only (fabricated slugs pre-filtered)
 *   - fabricated ranking rows cannot displace canonical articles
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import {
  recordArticleView,
  getArticleViewCount,
  getMostViewedArticles,
  hashIp,
} from "@/lib/blog/view-metrics";

const RUN_BLOG_TESTS =
  process.env.RUN_BLOG_INTEGRATION === "1" && !!process.env.TEST_DATABASE_URL;

describe.skipIf(!RUN_BLOG_TESTS)("Article View Metrics DB Integration", () => {
  let userId: number;

  beforeEach(async () => {
    // Clean ALL article views + dedup buckets on the real slugs BEFORE each
    // test so counts are isolated. This suite owns ArticleView + blog_view:*
    // rows (Blocker 5 — does NOT touch comment_post_* buckets).
    try { await db.articleView.deleteMany({ where: { slug: { in: ["welcome-to-nixify", "smtp-vs-api-verification", "email-otp-api-for-nextjs", "nixify-vs-building-email-otp-yourself"] } } }); } catch {}
    try { await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "blog_view:" } } }); } catch {}

    const user = await db.user.create({
      data: {
        email: `view-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.nixify.dev`,
        passwordHash: "hash",
        emailVerified: true,
        fullName: "View Test User",
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    try { await db.articleView.deleteMany({ where: { slug: { in: ["welcome-to-nixify", "smtp-vs-api-verification", "email-otp-api-for-nextjs", "nixify-vs-building-email-otp-yourself"] } } }); } catch {}
    try { await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "blog_view:" } } }); } catch {}
    try { await db.user.delete({ where: { id: userId } }); } catch {}
  });

  const REAL_SLUG = "welcome-to-nixify";

  it("article view persists a real row", async () => {
    const before = await getArticleViewCount(REAL_SLUG);
    const result = await recordArticleView({ slug: REAL_SLUG, userId, ip: "1.2.3.4" });
    expect(result.counted).toBe(true);
    const after = await getArticleViewCount(REAL_SLUG);
    expect(after).toBe(before + 1);
    // The row exists with the right slug.
    const rows = await db.articleView.findMany({ where: { slug: REAL_SLUG, userId } });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("invalid view slug is rejected (no fabricated rows)", async () => {
    const before = await db.articleView.count({ where: { slug: "totally-fake-slug-xyz" } });
    const result = await recordArticleView({ slug: "totally-fake-slug-xyz", userId, ip: "5.6.7.8" });
    expect(result.counted).toBe(false);
    expect(result.viewCount).toBe(0);
    const after = await db.articleView.count({ where: { slug: "totally-fake-slug-xyz" } });
    expect(after).toBe(before); // unchanged — no row inserted
  });

  // ─── Blocker 5 — RESTORED real view-dedup integration test ──────────────
  it("view dedup — same IP+slug within the window counts once", async () => {
    // Use a unique IP for this test. The first recordArticleView creates a
    // rate-limit bucket (count=1) and an ArticleView row. The second call
    // finds the bucket with count=1, increments to 2, and since limit=1,
    // returns allowed=false → counted:false.
    const dedupIp = "203.0.113.42";
    const dedupKey = `blog_view:${hashIp(dedupIp)}:${REAL_SLUG}`;

    // First view counts.
    const r1 = await recordArticleView({ slug: REAL_SLUG, userId: null, ip: dedupIp });
    expect(r1.counted).toBe(true);

    // The rate-limit bucket exists (proving the dedup wiring is in place).
    const bucket = await db.rateLimitBucket.findUnique({ where: { key: dedupKey } });
    expect(bucket).not.toBeNull();
    expect(bucket!.count).toBe(1);

    // Exactly one ArticleView row exists for this slug from this IP hash.
    const rows = await db.articleView.findMany({
      where: { slug: REAL_SLUG, ipHash: hashIp(dedupIp) },
    });
    expect(rows.length).toBe(1);

    // Second call from the same IP within the 30-min window is deduped.
    const r2 = await recordArticleView({ slug: REAL_SLUG, userId: null, ip: dedupIp });
    expect(r2.counted).toBe(false);

    // Still exactly one row (no duplicate inserted).
    const rowsAfter = await db.articleView.findMany({
      where: { slug: REAL_SLUG, ipHash: hashIp(dedupIp) },
    });
    expect(rowsAfter.length).toBe(1);
  });

  it("Most Viewed uses real rows only (fabricated slugs pre-filtered)", async () => {
    // Insert a real-slug view.
    await recordArticleView({ slug: REAL_SLUG, userId: null, ip: "10.0.0.1" });
    // Insert a fabricated-slug view directly via Prisma (bypass the slug
    // validation in recordArticleView) to simulate a pre-existing bad row.
    await db.articleView.create({ data: { slug: "fabricated-slug-xyz", ipHash: "x" } });
    const top = await getMostViewedArticles(10);
    // The fabricated slug must NOT appear.
    expect(top.some(t => t.slug === "fabricated-slug-xyz")).toBe(false);
  });

  // ─── Fabricated ranking rows cannot displace canonical articles ──────────
  it("fabricated ranking rows cannot displace canonical articles (pre-filter)", async () => {
    // Insert MANY fabricated-slug views directly via Prisma (bypass validation)
    // so they would dominate the ranking if not pre-filtered.
    for (let i = 0; i < 10; i++) {
      await db.articleView.create({ data: { slug: "fabricated-slug-xyz", ipHash: `fake-${i}` } });
    }
    // Insert ONE real-slug view.
    await db.articleView.create({ data: { slug: REAL_SLUG, ipHash: "real-1" } });

    const top = await getMostViewedArticles(5);
    // The fabricated slug must NOT appear even though it has 10x more rows.
    expect(top.some(t => t.slug === "fabricated-slug-xyz")).toBe(false);
    // The real slug MUST appear (it was pre-filtered into the candidate set).
    expect(top.some(t => t.slug === REAL_SLUG)).toBe(true);
  });

  it("Most Viewed returns real counts derived from the ArticleView table", async () => {
    // Insert 2 views directly via Prisma (bypass dedup) so this test is
    // independent of rate-limit bucket state from prior tests.
    await db.articleView.create({ data: { slug: REAL_SLUG, userId: null, ipHash: "mv-test-1" } });
    await db.articleView.create({ data: { slug: REAL_SLUG, userId: null, ipHash: "mv-test-2" } });
    const top = await getMostViewedArticles(5);
    const entry = top.find(t => t.slug === REAL_SLUG);
    expect(entry).toBeDefined();
    expect(entry!.viewCount).toBeGreaterThanOrEqual(2);
    // The count matches a direct DB count.
    const direct = await db.articleView.count({ where: { slug: REAL_SLUG } });
    expect(entry!.viewCount).toBe(direct);
  });
});
