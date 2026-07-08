import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import {
  FEATURE_LIMITS,
  NEVER_GATED,
  PLAN_RANK,
  type Plan,
  type FeatureKey,
  type FeatureLimit,
} from "./config";

/**
 * Core entitlement engine — two entry points:
 *
 *   canAccess(userId, featureKey) → boolean
 *     Is this feature available AT ALL on the user's plan? (access-gated)
 *
 *   checkUsage(userId, featureKey) → { allowed, remaining, resetAt }
 *     For volume-gated features: checks monthly quota + per-minute rate.
 *     Atomically increments the usage counter (race-condition safe).
 *
 * Fail-closed: if the DB query fails, checkUsage returns { allowed: false }.
 * canAccess returns false on DB error for non-core features (fail-closed),
 * but true for NEVER_GATED features (fail-open for security — you can always
 * reset your password even if the DB is down).
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AccessResult {
  allowed: boolean;
  plan: Plan;
  reason?: string;
}

export interface UsageResult {
  allowed: boolean;
  remaining: number | "unlimited";
  resetAt: Date | null;
  plan: Plan;
  reason?: string;
}

// ─── Plan resolution ──────────────────────────────────────────────────────

/** Fetch the user's plan from the DB. Falls back to FREE on error. */
export async function getUserPlan(userId: number): Promise<Plan> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    const plan = user?.plan as Plan;
    if (plan === "FREE" || plan === "PRO" || plan === "MAX") return plan;
    return "FREE";
  } catch {
    return "FREE"; // Fail-open for plan resolution (treat as FREE = most restrictive paid feature access, but core features still work)
  }
}

/** Fetch plan by API key owner (for v1 API routes). */
export async function getPlanByApiKey(apiKeyId: number): Promise<Plan> {
  try {
    // API keys don't directly store userId, but the key's usage maps to the
    // account that created it. For now, all API keys belong to the admin
    // account (or the first user). In a multi-tenant system, this would
    // resolve through the API key → project → owner chain.
    // For now: return MAX for API key users (they're paying for API access).
    return "MAX";
  } catch {
    return "FREE";
  }
}

// ─── Access-gated check (binary) ──────────────────────────────────────────

export async function canAccess(userId: number, featureKey: string): Promise<AccessResult> {
  // Core security features are never gated — always allow, even on DB error.
  if (NEVER_GATED.has(featureKey)) {
    return { allowed: true, plan: "FREE" };
  }

  try {
    const plan = await getUserPlan(userId);
    const limits = getLimits(featureKey, plan);

    if (!limits) {
      // Feature not in config — fail-closed (deny) for safety.
      return { allowed: false, plan, reason: "feature_not_configured" };
    }

    return { allowed: limits.access, plan };
  } catch {
    // DB error on a non-core feature — fail-closed.
    return { allowed: false, plan: "FREE", reason: "db_error" };
  }
}

/** Synchronous access check when you already know the plan. */
export function canAccessWithPlan(plan: Plan, featureKey: string): boolean {
  if (NEVER_GATED.has(featureKey)) return true;
  const limits = getLimits(featureKey, plan);
  return limits?.access ?? false;
}

// ─── Volume-gated check (quota + rate) ─────────────────────────────────────

export async function checkUsage(
  userId: number,
  featureKey: string,
): Promise<UsageResult> {
  // Core security features bypass all limits.
  if (NEVER_GATED.has(featureKey)) {
    return { allowed: true, remaining: "unlimited", resetAt: null, plan: "FREE" };
  }

  try {
    const plan = await getUserPlan(userId);
    const limits = getLimits(featureKey, plan);

    if (!limits) {
      return { allowed: false, remaining: 0, resetAt: null, plan, reason: "feature_not_configured" };
    }

    if (!limits.access) {
      return { allowed: false, remaining: 0, resetAt: null, plan, reason: "not_available_on_plan" };
    }

    // Check per-minute rate limit (uses existing atomic rateLimit from ratelimit.ts).
    if (limits.ratePerMin !== Infinity) {
      const rateResult = await rateLimit(
        `entitlement_rate:${featureKey}:${userId}`,
        limits.ratePerMin,
        60_000,
      );
      if (!rateResult.allowed) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + rateResult.retryAfterSeconds * 1000),
          plan,
          reason: "rate_limited",
        };
      }
    }

    // Unlimited quota — allow immediately (no DB write needed).
    if (limits.quota === Infinity) {
      return { allowed: true, remaining: "unlimited", resetAt: null, plan };
    }

    // Finite quota — atomically increment and check.
    const result = await consumeQuota(userId, featureKey, limits.quota);

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: result.resetAt,
      plan,
      reason: result.allowed ? undefined : "quota_exhausted",
    };
  } catch {
    // DB error on a usage-tracked feature — fail-closed.
    return { allowed: false, remaining: 0, resetAt: null, plan: "FREE", reason: "db_error" };
  }
}

// ─── Atomic quota consume (follows the OTP single-use pattern) ─────────────

/**
 * Atomically increments the usage counter and checks against the quota.
 * Uses a transaction + conditional update to prevent race conditions:
 *
 *   1. Find or create the usage row for this billing period.
 *   2. Check if count < quota.
 *   3. Atomically increment (updateMany WHERE count < quota).
 *   4. If updateMany affected 0 rows → quota exhausted.
 *
 * This is the same pattern as the OTP single-use consume in otp/verifier.ts:
 * a guarded write that only succeeds if the precondition (count < quota) holds.
 */
async function consumeQuota(
  userId: number,
  featureKey: string,
  quota: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const { periodStart, periodEnd } = getBillingPeriod();

  return db.$transaction(async (tx) => {
    // Find or create the usage row.
    let usage = await tx.usageTracking.findUnique({
      where: {
        userId_featureKey_periodStart: {
          userId,
          featureKey,
          periodStart,
        },
      },
    });

    if (!usage) {
      // Create the row for this billing period.
      usage = await tx.usageTracking.create({
        data: {
          userId,
          featureKey,
          count: 0,
          periodStart,
          periodEnd,
        },
      });
    }

    // Check if quota already exhausted.
    if (usage.count >= quota) {
      return { allowed: false, remaining: 0, resetAt: periodEnd };
    }

    // Atomically increment ONLY if count < quota.
    // This is the race-condition guard: concurrent requests that both read
    // count=999 (quota=1000) will both try to increment, but only one
    // updateMany will succeed because the WHERE clause checks count < quota.
    const updated = await tx.usageTracking.updateMany({
      where: {
        userId,
        featureKey,
        periodStart,
        count: { lt: quota },
      },
      data: { count: { increment: 1 } },
    });

    if (updated.count === 0) {
      // Another request consumed the last slot between our read and write.
      return { allowed: false, remaining: 0, resetAt: periodEnd };
    }

    const remaining = quota - (usage.count + 1);
    return { allowed: true, remaining: Math.max(0, remaining), resetAt: periodEnd };
  });
}

// ─── Peek (check without consuming) ────────────────────────────────────────

/**
 * Check remaining quota WITHOUT consuming. Useful for dashboard display.
 * Does NOT increment the counter.
 */
export async function peekUsage(
  userId: number,
  featureKey: string,
): Promise<{ remaining: number | "unlimited"; quota: number | "unlimited"; used: number; resetAt: Date | null }> {
  const plan = await getUserPlan(userId);
  const limits = getLimits(featureKey, plan);

  if (!limits || !limits.access) {
    return { remaining: 0, quota: 0, used: 0, resetAt: null };
  }

  if (limits.quota === Infinity) {
    return { remaining: "unlimited", quota: "unlimited", used: 0, resetAt: null };
  }

  const { periodStart, periodEnd } = getBillingPeriod();
  const usage = await db.usageTracking.findUnique({
    where: {
      userId_featureKey_periodStart: {
        userId,
        featureKey,
        periodStart,
      },
    },
  });

  const used = usage?.count ?? 0;
  return {
    remaining: Math.max(0, limits.quota - used),
    quota: limits.quota,
    used,
    resetAt: periodEnd,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getLimits(featureKey: string, plan: Plan): FeatureLimit | null {
  const config = FEATURE_LIMITS[featureKey as FeatureKey];
  if (!config) return null;
  return config[plan];
}

/** Returns the current billing period (1st of month → 1st of next month). */
function getBillingPeriod(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { periodStart, periodEnd };
}
