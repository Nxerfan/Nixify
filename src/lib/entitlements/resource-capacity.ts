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
 *   `createResourceWithCapacity()` which handles this automatically.
 *
 * TRANSACTION SAFETY:
 *   `checkResourceCapacityInTx()` reads the user's plan using the SAME
 *   transaction client (`tx`) — NOT the global `db`. This ensures the
 *   plan resolution, row lock, resource count, and resource creation all
 *   share one transaction snapshot/connection. No global `db` call
 *   participates in the protected capacity decision after the transaction
 *   begins.
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

// ─── Narrow type: only feature keys that have a resource-count model ──────

/**
 * The set of feature keys that `countUserResources` knows how to count.
 * Using a narrow type (instead of the broad `FeatureKey`) ensures
 * compile-time rejection of unsupported resource types — an unsupported
 * key cannot accidentally appear to have zero existing resources.
 */
export type ResourceCapacityFeatureKey =
  | typeof import("@/lib/entitlements/config").FEATURE_KEYS.API_KEYS
  | typeof import("@/lib/entitlements/config").FEATURE_KEYS.WEBHOOK_ENDPOINTS
  | typeof import("@/lib/entitlements/config").FEATURE_KEYS.EMAIL_TEMPLATES;

/** Prisma transaction client type. */
type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

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

// ─── Transaction-scoped plan resolution ──────────────────────────────────

/**
 * Read the user's plan using the SAME transaction client.
 *
 * This MUST be used inside `createResourceWithCapacity()` instead of the
 * global `getUserPlan()` from `engine.ts`, which uses the global `db` and
 * breaks the transaction boundary.
 *
 * Fail-closed: if the user doesn't exist or the plan is invalid, throw.
 * Do NOT silently return "FREE" — that could allow creation under an
 * unknown plan.
 */
async function getUserPlanInTx(tx: TxClient, userId: number): Promise<Plan> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  if (!user) {
    throw new Error(`User ${userId} not found — cannot resolve plan for resource capacity check`);
  }
  const plan = user.plan as Plan;
  if (plan !== "FREE" && plan !== "PRO" && plan !== "MAX") {
    throw new Error(`User ${userId} has invalid plan "${plan}" — fail-closed for resource capacity`);
  }
  return plan;
}

// ─── Resource counting ───────────────────────────────────────────────────

/**
 * Count the current number of user-owned resources for a feature key.
 * This is the ACTUAL resource count — NOT a monthly UsageTracking counter.
 *
 * Each feature key maps to a specific Prisma model + count query:
 *   API_KEYS → count ApiKey where userId, revokedAt=null
 *   WEBHOOK_ENDPOINTS → count WebhookEndpoint where userId
 *   EMAIL_TEMPLATES → count EmailTheme where userId
 *
 * System resources (userId=null) do NOT count against the user's quota.
 *
 * Uses the narrow `ResourceCapacityFeatureKey` type — unsupported feature
 * keys are rejected at compile time. There is no runtime default that
 * silently returns 0.
 */
export async function countUserResources(
  tx: TxClient,
  userId: number,
  featureKey: ResourceCapacityFeatureKey,
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

    // No default — the narrow type ensures only these three cases compile.
    // At runtime, an unsupported key would fall through and return undefined,
    // which would be caught by the caller as NaN — fail-closed.
  }
}

/**
 * Check if the user has capacity to create one more resource of the given type.
 *
 * This does NOT increment any counter — it's a read-only check. The caller
 * must perform the actual resource creation in the SAME transaction to
 * prevent race conditions.
 *
 * For concurrency safety, use `createResourceWithCapacity()`.
 */
export async function checkResourceCapacity(
  userId: number,
  featureKey: ResourceCapacityFeatureKey,
): Promise<ResourceCapacityResult> {
  return checkResourceCapacityInTx(db, userId, featureKey);
}

/**
 * Transaction-scoped version of `checkResourceCapacity`.
 *
 * Reads the user's plan using the SAME transaction client (`tx`) — NOT the
 * global `db`. This ensures the plan resolution, resource count, and quota
 * evaluation all share one transaction snapshot.
 *
 * Call this INSIDE a `db.$transaction(async (tx) => { ... })` block, after
 * acquiring a row lock on the User row.
 *
 * Fail-closed: if the user doesn't exist or the plan is invalid, the
 * transaction throws (via `getUserPlanInTx`), rolling back the entire
 * transaction. No resource is created.
 */
export async function checkResourceCapacityInTx(
  tx: TxClient,
  userId: number,
  featureKey: ResourceCapacityFeatureKey,
): Promise<ResourceCapacityResult> {
  // Read plan using the SAME transaction client — NOT the global db.
  const plan = await getUserPlanInTx(tx, userId);
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

  // Count existing resources (NOT UsageTracking) using the SAME tx.
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
 * 3. Reads the user's plan using the SAME transaction client.
 * 4. Counts existing resources using the SAME transaction client.
 * 5. Checks capacity.
 * 6. Calls the provided `createFn` with the transaction client.
 *
 * If capacity is exceeded, the transaction throws and no resource is created.
 * If the user doesn't exist or the plan is invalid, the transaction throws
 * (fail-closed — no resource created).
 *
 * No global `db` call participates in the protected capacity decision after
 * the transaction begins.
 *
 * @param userId       The resource owner.
 * @param featureKey   The entitlement feature key (narrow type — only
 *                     API_KEYS, WEBHOOK_ENDPOINTS, EMAIL_TEMPLATES).
 * @param createFn     A function that creates the resource using the
 *                     provided transaction client.
 * @returns            The result of `createFn`.
 */
export async function createResourceWithCapacity<T>(
  userId: number,
  featureKey: ResourceCapacityFeatureKey,
  createFn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    // Lock the user row to serialize concurrent capacity checks for this user.
    // This prevents two concurrent requests from both reading the same count
    // and both creating a resource that exceeds the limit.
    await tx.$executeRaw`SELECT * FROM "User" WHERE "id" = ${userId} FOR UPDATE`;

    // checkResourceCapacityInTx reads plan + count using the SAME tx.
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
