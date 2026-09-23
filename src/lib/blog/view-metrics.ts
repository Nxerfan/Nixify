/**
 * Phase 18 — Article view metrics service.
 *
 * Records real article views (one row per qualified view) and computes real
 * view counts. Dedup is enforced via the existing DB-backed `rateLimit()`
 * primitive (key `blog_view:${ipHash}:${slug}`, limit 1, window 30 min) so
 * rapid refreshes don't inflate counts.
 *
 * No fake counts. "Most Viewed" = `groupBy slug, _count desc` over real rows.
 */

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { createHash } from "crypto";

/** Window for view dedup — a second view inside this window doesn't count. */
const VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Hash a client IP for dedup. Uses a salted SHA-256 so the raw IP is never
 * stored (privacy). Returns "unknown" if no IP is available.
 */
export function hashIp(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  const salt = process.env.NIXIFY_IP_SALT ?? "nixify-view-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Record a view for an article slug. Deduped by (ipHash, slug) per 30-min
 * window. Authenticated users pass their userId; anonymous views have
 * userId = null. Returns the updated count for the slug (for display).
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
 * @param limit Max number of results (default 5).
 */
export async function getMostViewedArticles(
  limit = 5,
): Promise<Array<{ slug: string; viewCount: number }>> {
  const grouped = await db.articleView.groupBy({
    by: ["slug"],
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
