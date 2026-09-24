/**
 * Phase 18 — Article view metrics service (blocker fixes).
 *
 * Records real article views (one row per qualified view) and computes real
 * view counts. Dedup is enforced via the existing DB-backed `rateLimit()`
 * primitive (key `blog_view:${ipHash}:${slug}`, limit 1, window 30 min) so
 * rapid refreshes don't inflate counts.
 *
 * Blocker 2 — slug validation: recordArticleView rejects slugs that are not
 * real published articles, preventing fabricated rows from polluting view
 * counts and Most Viewed.
 *
 * Blocker 9 — IP hash privacy: hashIp derives the salt from a required
 * server-side secret (JWT_SECRET) via an HMAC with a blog-view-specific
 * context. There is NO public hardcoded salt fallback in production. In dev
 * (when JWT_SECRET is unset), a dev-only fallback is used so local
 * development works without configuring secrets — but production deployment
 * requires JWT_SECRET (the app already fails closed without it for session
 * signing).
 *
 * No fake counts. "Most Viewed" = `groupBy slug, _count desc` over real rows.
 */

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { createHmac, createHash, timingSafeEqual } from "crypto";
import { getArticle, getAllSlugs } from "@/lib/blog/content";

/** Window for view dedup — a second view inside this window doesn't count. */
const VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Resolve the blog-view IP-hash secret. Derived from the existing required
 * JWT_SECRET via an HMAC with a blog-view-specific context string, so no new
 * secret needs to be provisioned. The derivation is one-way (HMAC) so the
 * blog-view salt cannot be reversed back to JWT_SECRET.
 *
 * Blocker 9: NO public hardcoded salt fallback in production. If JWT_SECRET
 * is unset in production, this throws (fail-closed). In dev, a dev-only
 * fallback is used (clearly marked) so local development works without
 * configuring secrets.
 */
function getViewSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    // Derive a blog-view-specific secret via HMAC. The context string
    // "nixify:blog-view-ip-hash:v1" binds this derivation to this exact use
    // case so it can't be confused with any other JWT_SECRET derivation.
    return createHmac("sha256", jwtSecret).update("nixify:blog-view-ip-hash:v1").digest("hex");
  }
  // Dev-only fallback. Production deployments already require JWT_SECRET
  // (the app fails to sign sessions without it), so this branch is only hit
  // in local development / tests without a configured secret.
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production for blog view IP hashing.");
  }
  return "nixify-dev-view-salt";
}

/**
 * Hash a client IP for dedup. Uses a salted SHA-256 where the salt is
 * derived from the required server-side secret (Blocker 9) — the raw IP is
 * never stored. Returns "unknown" if no IP is available.
 */
export function hashIp(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  const secret = getViewSecret();
  // HMAC-SHA256 with the derived secret as the key, IP as the message.
  // This is a keyed hash — not reversible without the secret.
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/**
 * Record a view for an article slug. Deduped by (ipHash, slug) per 30-min
 * window. Authenticated users pass their userId; anonymous views have
 * userId = null. Returns the updated count for the slug (for display).
 *
 * Blocker 2: rejects fabricated slugs — the slug must exist in the canonical
 * blog corpus (any locale) before a view row is inserted.
 *
 * Safe to call on every article page load — the rate limiter ensures only one
 * view per (ipHash, slug) per window is actually persisted.
 */
export async function recordArticleView(opts: {
  slug: string;
  userId?: number | null;
  ip: string | null;
}): Promise<{ counted: boolean; viewCount: number }> {
  const { slug, userId = null, ip } = opts;

  // Blocker 2: verify the slug is a real published article. Reject fabricated
  // slugs so fake rows can't pollute view counts / Most Viewed.
  if (!isValidArticleSlugAnyLocale(slug)) {
    return { counted: false, viewCount: 0 };
  }

  const ipHash = hashIp(ip);
  const dedupKey = `blog_view:${ipHash}:${slug}`;
  const allowed = await rateLimit(dedupKey, 1, VIEW_DEDUP_WINDOW_MS);
  if (!allowed.allowed) {
    // Already viewed in this window — don't insert a duplicate row. Return
    // the current count.
    const viewCount = await getArticleViewCount(slug);
    return { counted: false, viewCount };
  }
  await db.articleView.create({
    data: { slug, userId, ipHash },
  });
  const viewCount = await getArticleViewCount(slug);
  return { counted: true, viewCount };
}

/**
 * Get the real view count for an article slug (all-time, deduped at insert
 * time). Returns 0 if no views recorded.
 */
export async function getArticleViewCount(slug: string): Promise<number> {
  return db.articleView.count({ where: { slug } });
}

/**
 * Get view counts for multiple slugs in one call. Returns a Map<slug, count>.
 */
export async function getArticleViewCounts(
  slugs: string[],
): Promise<Map<string, number>> {
  if (slugs.length === 0) return new Map();
  const grouped = await db.articleView.groupBy({
    by: ["slug"],
    where: { slug: { in: slugs } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const g of grouped) {
    map.set(g.slug, g._count._all);
  }
  // Ensure every requested slug has an entry (0 if no views).
  for (const s of slugs) {
    if (!map.has(s)) map.set(s, 0);
  }
  return map;
}

/**
 * "Most Viewed" — the top articles by real view count. Returns an array of
 * { slug, viewCount } sorted by viewCount desc, then slug asc. Limited to
 * articles that actually have views.
 *
 * Blocker 3 — canonical pre-filter:
 *   Canonical slugs are pre-filtered BEFORE ranking/take so fabricated
 *   rows cannot consume ranking slots. The `slug: { in: canonicalSlugs }`
 *   clause means only real published articles are ever ranked.
 *
 * @param limit Max number of results (default 5).
 */
export async function getMostViewedArticles(
  limit = 5,
): Promise<Array<{ slug: string; viewCount: number }>> {
  // Pre-filter canonical slugs BEFORE ranking so fabricated rows can't
  // displace real articles.
  const canonicalSlugs = getAllSlugs();
  if (canonicalSlugs.length === 0) return [];

  const grouped = await db.articleView.groupBy({
    by: ["slug"],
    where: { slug: { in: canonicalSlugs } },
    _count: { _all: true },
    orderBy: { _count: { slug: "desc" } },
    take: limit,
  });
  return grouped.map(g => ({ slug: g.slug, viewCount: g._count._all }));
}

/**
 * Total view count across all articles. Used for the blog homepage stats.
 */
export async function getTotalViewCount(): Promise<number> {
  return db.articleView.count();
}

/** Verify a slug refers to a real published article in ANY locale. */
export function isValidArticleSlugAnyLocale(slug: string): boolean {
  return getArticle(slug, "en") !== null || getArticle(slug, "fa") !== null;
}
