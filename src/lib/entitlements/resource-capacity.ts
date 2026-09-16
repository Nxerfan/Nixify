/**
 * Resource cardinality primitive — separate from consumable usage.
 *
 * `checkUsage()` is for CONSUMABLE monthly quotas (API_MESSAGES, OTP_EMAILS,
 * etc.) — it increments UsageTracking on each call.
 *
 * `checkResourceCapacity()` is for RESOURCE-COUNT limits (API_KEYS,
 * WEBHOOK_ENDPOINTS, EMAIL_TEMPLATES) — it counts the current number of
 * existing resources and compares to the plan's quota. It does NOT touch
 * UsageTracking. Deleting/revoking a resource frees its slot.
 *
 * CONCURRENCY SAFETY:
 *   For finite quotas, the caller MUST wrap the capacity check + resource
 *   creation in a single database transaction with a row lock. Use
 *   `checkResourceCapacityInTx()` which accepts a transaction client.
 *
 * See docs/engineering/agent-lessons.md:
 *   "Resource cardinality and consumable usage are different entitlement dimensions"
 */

import { db } from "@/lib/db";
import {
  FEATURE_LIMITS,
  type Plan,
  type FeatureKey,
} from "@/lib/entitlements/config";
import { getUserPlan } from "@/lib/entitlements/engine";

export interface ResourceCapacityResult {
  allowed: boolean;
  /** Current count of existing resources. */
  currentCount: number;
  /** The plan's quota for this feature. `Infinity` for unlimited. */
  quota: number;
  /** Remaining slots. `Infinity` for unlimited. */
  remaining: number | "unlimited";
  plan: Plan;
  reason?: string;
}

/**
 * Count the current number of user-owned resources for a feature key.
 * This is the ACTUAL resource count — NOT a monthly UsageTracking counter.
 *
 * Each feature key maps to a specific Prisma model + count query:
 *   API_KEYS → count ApiKey where userId, revokedAt=null
 *   WEBHOOK_ENDPOINTS → count WebhookEndpoint where userId (not null)
 *   EMAIL_TEMPLATES → count EmailTheme where userId (not null, not system)
 *
 * System resources (userId=null) do NOT count against the user's quota.
 */
export async function countUserResources(
  tx: typeof db | Parameters<Parameters<typeof db.$transaction>[0]>[0],
  userId: number,
  featureKey: FeatureKey,
): Promise<number> {
  switch (featureKey) {
    case "api_keys":
      return tx.apiKey.count({
        where: { userId, revokedAt: null },
      });

    case "webhook_endpoints":
      return tx.webhookEndpoint.count({
        where: { userId },
      });

    case "email_templates":
      return tx.emailTheme.count({
        where: { userId },
      });

    default:
      // For features without a resource-count model, return 0.
      return 0;
  }
}

/**
 * Check if the user has capacity to create one more resource of the given type.
 *
 * This does NOT increment any counter — it's a read-only check. The caller
 * must perform the actual resource creation in the SAME transaction to
 * prevent race conditions.
 *
 * For concurrency safety, use `checkResourceCapacityInTx()` inside a
 * `db.$transaction()` with a `SELECT ... FOR UPDATE` lock on the User row.
 */
export async function checkResourceCapacity(
  userId: number,
  featureKey: FeatureKey,
): Promise<ResourceCapacityResult> {
  return checkResourceCapacityInTx(db, userId, featureKey);
}

/**
 * Transaction-scoped version of `checkResourceCapacity`.
 *
 * Call this INSIDE a `db.$transaction(async (tx) => { ... })` block, after
 * acquiring a row lock on the User row:
 *
 * ```ts
 * await db.$transaction(async (tx) => {
 *   // Lock the user row to serialize concurrent capacity checks.
 *   await tx.$executeRaw`SELECT * FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
 *
 *   const capacity = await checkResourceCapacityInTx(tx, userId, FK.API_KEYS);
 *   if (!capacity.allowed) {
 *     throw new Error("API key limit reached");
 *   }
 *
 *   // Create the resource using the SAME transaction client.
 *   await tx.apiKey.create({ ... });
 * });
 * ```
 */
export async function checkResourceCapacityInTx(
  tx: typeof db | Parameters<Parameters<typeof db.$transaction>[0]>[0],
  userId: number,
  featureKey: FeatureKey,
): Promise<ResourceCapacityResult> {
  const plan = await getUserPlan(userId);
  const limits = FEATURE_LIMITS[featureKey]?.[plan];

  if (!limits) {
    return { allowed: false, currentCount: 0, quota: 0, remaining: 0, plan, reason: "feature_not_configured" };
  }

  if (!limits.access) {
    return { allowed: false, currentCount: 0, quota: 0, remaining: 0, plan, reason: "not_available_on_plan" };
  }

  // Unlimited quota — always allowed.
  if (limits.quota === Infinity) {
    return { allowed: true, currentCount: 0, quota: Infinity, remaining: "unlimited", plan };
  }

  // Count existing resources (NOT UsageTracking).
  const currentCount = await countUserResources(tx, userId, featureKey);

  if (currentCount >= limits.quota) {
    return { allowed: false, currentCount, quota: limits.quota, remaining: 0, plan, reason: "quota_exhausted" };
  }

  return {
    allowed: true,
    currentCount,
    quota: limits.quota,
    remaining: limits.quota - currentCount,
    plan,
  };
}

/**
 * Execute a resource creation with concurrency-safe cardinality enforcement.
 *
 * This is the canonical way to create a count-limited resource:
 *
 * 1. Opens a database transaction.
 * 2. Locks the User row (SELECT FOR UPDATE) to serialize concurrent creates.
 * 3. Counts existing resources.
 * 4. Checks capacity.
 * 5. Calls the provided `createFn` with the transaction client.
 *
 * If capacity is exceeded, the transaction throws and no resource is created.
 *
 * @param userId       The resource owner.
 * @param featureKey   The entitlement feature key (e.g. FK.API_KEYS).
 * @param createFn     A function that creates the resource using the
 *                     provided transaction client.
 * @returns            The result of `createFn`.
 */
export async function createResourceWithCapacity<T>(
  userId: number,
  featureKey: FeatureKey,
  createFn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    // Lock the user row to serialize concurrent capacity checks for this user.
    // This prevents two concurrent requests from both reading the same count
    // and both creating a resource that exceeds the limit.
    await tx.$executeRaw`SELECT * FROM "User" WHERE "id" = ${userId} FOR UPDATE`;

    const capacity = await checkResourceCapacityInTx(tx, userId, featureKey);
    if (!capacity.allowed) {
      const err = new Error(
        capacity.reason === "not_available_on_plan"
          ? "Feature not available on your plan"
          : "Resource limit reached",
      );
      (err as any).reason = capacity.reason;
      (err as any).remaining = capacity.remaining;
      throw err;
    }

    // Create the resource using the SAME transaction client.
    return createFn(tx);
  });
}
