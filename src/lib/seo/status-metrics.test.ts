/**
 * Regression tests for /status page build-safety and metrics caching
 * (Post-Roadmap B).
 *
 * Covers:
 *   - The /status route exports `dynamic = "force-dynamic"` (no Prisma reads
 *     at build time). Reads the source file to avoid importing the page (which
 *     would trigger the DB query).
 *   - The /status route does NOT export `revalidate` (ISR would pre-render at
 *     build time).
 *   - getCachedStatusMetrics caches results for 60 seconds (bounded runtime
 *     DB load).
 *   - getCachedStatusMetrics returns ok:false on DB error (no health
 *     inference from a successful query).
 *   - getCachedStatusMetrics counts only non-revoked + non-expired API keys.
 *   - getCachedStatusMetrics calculates webhook success rate as
 *     delivered / (delivered + failed) for terminal deliveries only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf-8");
}

describe("/status route — build-safety (no Prisma reads during build)", () => {
  const statusSrc = readSrc("app/status/page.tsx");

  it("exports `dynamic = \"force-dynamic\"`", () => {
    expect(statusSrc).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("does NOT export `revalidate` (ISR would pre-render at build time)", () => {
    // Check for the actual export statement, not comments.
    expect(statusSrc).not.toMatch(/^export\s+const\s+revalidate\s*=/m);
  });

  it("does NOT put `revalidate` inside the Metadata object", () => {
    // The Metadata object must not contain a `revalidate:` key. Match only
    // `revalidate:` at the start of a line (inside the object), not in comments.
    const noComments = statusSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(noComments).not.toMatch(/^\s*revalidate:\s*\d+/m);
  });
});

// ─── getCachedStatusMetrics — caching + correctness ────────────────────────

// Mock the PrismaClient shape we use.
function makeDb(overrides: Partial<{
  requestLog: { count: ReturnType<typeof vi.fn>; aggregate: ReturnType<typeof vi.fn> };
  apiKey: { count: ReturnType<typeof vi.fn> };
  webhookDelivery: { count: ReturnType<typeof vi.fn> };
}> = {}) {
  const requestLog = {
    count: overrides.requestLog?.count ?? vi.fn().mockResolvedValue(0),
    aggregate: overrides.requestLog?.aggregate ??
      vi.fn().mockResolvedValue({ _avg: { durationMs: null } }),
  };
  const apiKey = {
    count: overrides.apiKey?.count ?? vi.fn().mockResolvedValue(0),
  };
  const webhookDelivery = {
    count: overrides.webhookDelivery?.count ?? vi.fn().mockResolvedValue(0),
  };
  return { requestLog, apiKey, webhookDelivery } as any;
}

describe("getCachedStatusMetrics — 60s cache + DB error handling", () => {
  beforeEach(() => {
    // Reset the module cache so each test starts fresh.
    vi.resetModules();
  });

  it("returns ok:false on DB error (no health inference)", async () => {
    const db = makeDb({
      requestLog: {
        count: vi.fn().mockRejectedValue(new Error("DB unreachable")),
        aggregate: vi.fn(),
      },
    });
    const { getCachedStatusMetrics } = await import("@/lib/status/metrics");
    const result = await getCachedStatusMetrics(db);
    expect(result.ok).toBe(false);
    expect(result.metrics).toBeNull();
  });

  it("caches results for 60 seconds (bounded DB load)", async () => {
    const countFn = vi.fn().mockResolvedValue(42);
    const db = makeDb({
      requestLog: {
        count: countFn,
        aggregate: vi.fn().mockResolvedValue({ _avg: { durationMs: 100 } }),
      },
    });
    const { getCachedStatusMetrics } = await import("@/lib/status/metrics");

    // First call — hits the DB.
    const r1 = await getCachedStatusMetrics(db);
    expect(r1.ok).toBe(true);
    const firstCalls = countFn.mock.calls.length;

    // Second call within 60s — should use cache (no new DB call).
    const r2 = await getCachedStatusMetrics(db);
    expect(r2.ok).toBe(true);
    expect(countFn.mock.calls.length).toBe(firstCalls);
    // Same metrics object (cached).
    expect(r2.metrics).toBe(r1.metrics);
  });
});

describe("getCachedStatusMetrics — active API keys = non-revoked AND non-expired", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("queries with revokedAt:null AND (expiresAt:null OR expiresAt>now)", async () => {
    const apiKeyCount = vi.fn().mockResolvedValue(7);
    const db = makeDb({
      apiKey: { count: apiKeyCount },
      requestLog: {
        count: vi.fn().mockResolvedValue(100),
        aggregate: vi.fn().mockResolvedValue({ _avg: { durationMs: 50 } }),
      },
      webhookDelivery: { count: vi.fn().mockResolvedValue(10) },
    });
    const { getCachedStatusMetrics } = await import("@/lib/status/metrics");
    const result = await getCachedStatusMetrics(db);
    expect(result.ok).toBe(true);
    expect(result.metrics?.activeApiKeys).toBe(7);

    // Verify the where clause includes revokedAt:null AND an OR on expiresAt.
    const whereArg = apiKeyCount.mock.calls[0][0]?.where;
    expect(whereArg).toBeDefined();
    expect(whereArg.revokedAt).toBeNull();
    // Must have an OR clause for expiry.
    expect(Array.isArray(whereArg.OR)).toBe(true);
    const orStr = JSON.stringify(whereArg.OR);
    expect(orStr).toContain("expiresAt");
    expect(orStr).toContain("null");
  });
});

describe("getCachedStatusMetrics — webhook success rate (terminal only)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("calculates delivered / (delivered + failed), excluding pending/retrying", async () => {
    // 80 delivered, 20 failed, 50 pending → success rate = 80/100 = 80%.
    // The 50 pending MUST be excluded from the denominator.
    const deliveryCount = vi.fn().mockImplementation((args: { where: { status: string } }) => {
      if (args.where.status === "delivered") return Promise.resolve(80);
      if (args.where.status === "failed") return Promise.resolve(20);
      return Promise.resolve(0);
    });
    const db = makeDb({
      webhookDelivery: { count: deliveryCount },
      requestLog: {
        count: vi.fn().mockResolvedValue(100),
        aggregate: vi.fn().mockResolvedValue({ _avg: { durationMs: 50 } }),
      },
      apiKey: { count: vi.fn().mockResolvedValue(5) },
    });
    const { getCachedStatusMetrics } = await import("@/lib/status/metrics");
    const result = await getCachedStatusMetrics(db);
    expect(result.ok).toBe(true);
    expect(result.metrics?.webhookSuccessRate).toBe(80);
    expect(result.metrics?.webhookDeliveries24h).toBe(100); // 80 + 20 terminal
  });

  it("handles zero terminal deliveries (success rate 0, no division by zero)", async () => {
    const db = makeDb({
      webhookDelivery: { count: vi.fn().mockResolvedValue(0) },
      requestLog: {
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockResolvedValue({ _avg: { durationMs: null } }),
      },
      apiKey: { count: vi.fn().mockResolvedValue(0) },
    });
    const { getCachedStatusMetrics } = await import("@/lib/status/metrics");
    const result = await getCachedStatusMetrics(db);
    expect(result.ok).toBe(true);
    expect(result.metrics?.webhookSuccessRate).toBe(0);
    expect(result.metrics?.webhookDeliveries24h).toBe(0);
  });
});
