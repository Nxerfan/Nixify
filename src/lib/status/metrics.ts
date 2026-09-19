/**
 * Status metrics — server-side cached application telemetry.
 *
 * DESIGN GOALS (Post-Roadmap B):
 *
 * 1. BOUNDED DB LOAD: metrics are cached in a module-level variable for
 *    ~60 seconds. Anonymous /status page hits do NOT each trigger a fresh
 *    DB aggregate. The /status route uses `revalidate: 60` (ISR) so the
 *    page HTML itself is also cached for 60s.
 *
 * 2. BUILD-SAFE: at build time, Next.js may try to statically render this
 *    page. `getCachedStatusMetrics` is only called from the server component
 *    (runtime, not build), and it catches all DB errors so a missing
 *    DATABASE_URL at build time produces a null result (failure banner),
 *    NOT a build failure.
 *
 * 3. NO HEALTH INFERENCE: a successful DB query does NOT imply the service
 *    is healthy — the page explicitly states these are telemetry, not an
 *    uptime monitor or SLA. A failed query returns `ok: false` and the page
 *    shows a failure banner that explicitly says "This page cannot determine
 *    overall service availability from this failure alone."
 *
 * 4. ACCURATE METRICS:
 *    - Active API keys = non-revoked AND non-expired (checked at query time).
 *    - Webhook success rate = delivered / (delivered + failed) for TERMINAL
 *      deliveries only. Pending/retrying deliveries are excluded from the
 *      denominator (they are not terminal outcomes).
 */

import type { PrismaClient } from "@prisma/client";

export interface StatusMetrics {
  totalRequests24h: number;
  errorRate24h: number;
  avgLatencyMs24h: number;
  totalRequests7d: number;
  activeApiKeys: number;
  webhookDeliveries24h: number;
  webhookSuccessRate: number;
  generatedAt: string;
}

interface CachedResult {
  metrics: StatusMetrics | null;
  ok: boolean;
  expiresAt: number; // epoch ms
}

const CACHE_TTL_MS = 60_000; // 60 seconds

let cache: CachedResult | null = null;

/**
 * Compute fresh metrics from the database.
 *
 * All queries are bounded time windows (createdAt indexes) and run in
 * parallel. On ANY error, returns `ok: false` (the caller renders the
 * failure banner — no health inference).
 */
async function computeMetrics(db: PrismaClient): Promise<StatusMetrics> {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    total24h,
    errors24h,
    latencyAgg,
    total7d,
    activeKeys,
    webhookDelivered,
    webhookFailed,
  ] = await Promise.all([
    db.requestLog.count({ where: { createdAt: { gte: h24 } } }),
    db.requestLog.count({ where: { createdAt: { gte: h24 }, status: { gte: 400 } } }),
    db.requestLog.aggregate({
      _avg: { durationMs: true },
      where: { createdAt: { gte: h24 } },
    }),
    db.requestLog.count({ where: { createdAt: { gte: d7 } } }),
    // Active = not revoked AND (no expiry OR expiry in the future).
    db.apiKey.count({
      where: {
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    // Terminal webhook deliveries in 24h: delivered.
    db.webhookDelivery.count({
      where: { createdAt: { gte: h24 }, status: "delivered" },
    }),
    // Terminal webhook deliveries in 24h: failed.
    db.webhookDelivery.count({
      where: { createdAt: { gte: h24 }, status: "failed" },
    }),
  ]);

  const errorRate = total24h > 0 ? (errors24h / total24h) * 100 : 0;
  const terminalDeliveries = webhookDelivered + webhookFailed;
  const webhookSuccessRate =
    terminalDeliveries > 0 ? (webhookDelivered / terminalDeliveries) * 100 : 0;

  return {
    totalRequests24h: total24h,
    errorRate24h: Math.round(errorRate * 100) / 100,
    avgLatencyMs24h: Math.round(latencyAgg._avg.durationMs ?? 0),
    totalRequests7d: total7d,
    activeApiKeys: activeKeys,
    webhookDeliveries24h: terminalDeliveries,
    webhookSuccessRate: Math.round(webhookSuccessRate * 100) / 100,
    generatedAt: now.toISOString(),
  };
}

/**
 * Get cached status metrics, refreshing if older than 60 seconds.
 *
 * Returns `{ metrics: null, ok: false }` on any DB error — the caller must
 * NOT infer service health from a successful query (see the page banner).
 */
export async function getCachedStatusMetrics(
  db: PrismaClient,
): Promise<{ metrics: StatusMetrics | null; ok: boolean }> {
  const now = Date.now();

  // Serve from cache if fresh.
  if (cache && cache.expiresAt > now) {
    return { metrics: cache.metrics, ok: cache.ok };
  }

  // Refresh. On error, cache the failure briefly so we don't hammer the DB
  // on every request during an outage.
  try {
    const metrics = await computeMetrics(db);
    cache = {
      metrics,
      ok: true,
      expiresAt: now + CACHE_TTL_MS,
    };
    return { metrics, ok: true };
  } catch {
    cache = {
      metrics: null,
      ok: false,
      expiresAt: now + CACHE_TTL_MS, // cache the failure too
    };
    return { metrics: null, ok: false };
  }
}
