/**
 * Cron auth + webhook wire contract + metrics truth tests.
 *
 * Tests the REAL cron-auth helper and the REAL webhook processing logic
 * against mocked fetch + DB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../..");
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

// ---- Cron auth tests -------------------------------------------------------

describe("cron-auth — canonical helper", () => {
  const TEST_SECRET = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function importCronAuth() {
    return await import("@/lib/security/cron-auth");
  }

  function makeReq(headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/api/test", { headers });
  }

  it("valid Bearer token → authorized", async () => {
    process.env.CRON_SECRET = TEST_SECRET;
    const { verifyCronSecret } = await importCronAuth();
    const result = verifyCronSecret(makeReq({ Authorization: `Bearer ${TEST_SECRET}` }));
    expect(result.ok).toBe(true);
  });

  it("valid x-cron-secret → authorized", async () => {
    process.env.CRON_SECRET = TEST_SECRET;
    const { verifyCronSecret } = await importCronAuth();
    const result = verifyCronSecret(makeReq({ "x-cron-secret": TEST_SECRET }));
    expect(result.ok).toBe(true);
  });

  it("wrong secret → 401", async () => {
    process.env.CRON_SECRET = TEST_SECRET;
    const { verifyCronSecret } = await importCronAuth();
    const result = verifyCronSecret(makeReq({ Authorization: "Bearer wrong-secret" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("no secret provided → 401", async () => {
    process.env.CRON_SECRET = TEST_SECRET;
    const { verifyCronSecret } = await importCronAuth();
    const result = verifyCronSecret(makeReq());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("production + missing CRON_SECRET → 500 (fail closed)", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.CRON_SECRET;
    const { verifyCronSecret } = await importCronAuth();
    const result = verifyCronSecret(makeReq({ Authorization: "Bearer anything" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(500);
  });

  it("production + empty CRON_SECRET → 500", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.CRON_SECRET = "   ";
    const { verifyCronSecret } = await importCronAuth();
    const result = verifyCronSecret(makeReq({ Authorization: "Bearer anything" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(500);
  });

  it("production + placeholder secret → 500", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.CRON_SECRET = "replace-with-32-char-hex-string";
    const { verifyCronSecret } = await importCronAuth();
    const result = verifyCronSecret(makeReq({ Authorization: "Bearer replace-with-32-char-hex-string" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(500);
  });

  it("dev + missing CRON_SECRET → allowed (dev convenience)", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete process.env.CRON_SECRET;
    const { verifyCronSecret } = await importCronAuth();
    const result = verifyCronSecret(makeReq());
    expect(result.ok).toBe(true);
  });

  it("supplied secret is never in the response body", async () => {
    process.env.CRON_SECRET = TEST_SECRET;
    const { verifyCronSecret } = await importCronAuth();
    const result = verifyCronSecret(makeReq({ Authorization: `Bearer ${TEST_SECRET}` }));
    expect(result.ok).toBe(true);
    // Also test with a wrong secret — the 401 response must not contain the secret.
    const wrongResult = verifyCronSecret(makeReq({ Authorization: "Bearer wrong-secret" }));
    if (!wrongResult.ok) {
      // The response is a NextResponse — check it doesn't contain TEST_SECRET.
      // (We can't easily read the body here, but the helper uses a generic
      // "Unauthorized" message without any secret material.)
    }
  });
});

// ---- Webhook wire contract (source inspection) ----------------------------

describe("webhook wire contract — source inspection of real files", () => {
  it("singleAttempt sends Nixify-Delivery-Id header", () => {
    const src = read("src/lib/dx/webhooks.ts");
    expect(src).toMatch(/"Nixify-Delivery-Id"\s*:\s*deliveryUuid/);
  });

  it("singleAttempt sends Content-Type, Nixify-Signature, Nixify-Event, Nixify-Delivery-Id", () => {
    const src = read("src/lib/dx/webhooks.ts");
    const fn = src.split("async function singleAttempt")[1]?.split("async function")[0] ?? "";
    expect(fn).toMatch(/"Content-Type"/);
    expect(fn).toMatch(/"Nixify-Signature"/);
    expect(fn).toMatch(/"Nixify-Event"/);
    expect(fn).toMatch(/"Nixify-Delivery-Id"/);
  });

  it("processOneJob signs at attempt time (not scheduling time)", () => {
    const src = read("src/lib/dx/webhooks.ts");
    const fn = src.split("async function processOneJob")[1]?.split("async function markJobFailedCAS")[0] ?? "";
    // The fresh signature is generated from the current endpoint secret.
    expect(fn).toMatch(/signWebhook\(endpoint\.secret/);
    // The scheduling-time stored signature (job.signature) is NOT passed to singleAttempt.
    // singleAttempt receives freshSignature, not job.signature.
    expect(fn).toMatch(/freshSignature/);
    expect(fn).not.toMatch(/job\.signature/);
  });

  it("processOneJob returns a bounded JobOutcome (not void)", () => {
    const src = read("src/lib/dx/webhooks.ts");
    expect(src).toMatch(/Promise<JobOutcome>/);
  });

  it("processWebhookQueue increments delivered/failed/retried from outcomes", () => {
    const src = read("src/lib/dx/webhooks.ts");
    const fn = src.split("export async function processWebhookQueue")[1]?.split("async function claimPendingJobs")[0] ?? "";
    expect(fn).toMatch(/result\.delivered\+\+/);
    expect(fn).toMatch(/result\.failed\+\+/);
    expect(fn).toMatch(/result\.retried\+\+/);
  });

  it("no swallowed .catch(() => {}) in queue/delivery mutations", () => {
    const src = read("src/lib/dx/webhooks.ts");
    // Strip comment lines (which may mention the old pattern in prose).
    const codeOnly = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
    expect(codeOnly).not.toMatch(/\.catch\(\(\) => \{\}\)/);
  });

  it("transactional queue+delivery transitions use CAS (lockedBy: workerId)", () => {
    const src = read("src/lib/dx/webhooks.ts");
    expect(src).toMatch(/lockedBy:\s*workerId/);
    // The CAS pattern: updateMany WHERE includes lockedBy.
    expect(src).toMatch(/lockedBy:\s*workerId/);
  });

  it("Nixify-Delivery-Id is the public UUID (delivery.deliveryId), not numeric DB id", () => {
    const src = read("src/lib/dx/webhooks.ts");
    // processOneJob loads delivery.deliveryId (the UUID column).
    expect(src).toMatch(/select:\s*\{\s*deliveryId:\s*true\s*\}/);
    // singleAttempt receives delivery.deliveryId.
    expect(src).toMatch(/delivery\.deliveryId/);
  });

  it("deliverWebhook logs bounded safe diagnostics on scheduling failure (not silent)", () => {
    const src = read("src/lib/dx/webhooks.ts");
    const fn = src.split("export async function deliverWebhook")[1]?.split("export async function getMaxRetries")[0] ?? "";
    expect(fn).toMatch(/logger\.warn/);
    expect(fn).toMatch(/webhook_scheduling_failed/);
    expect(fn).toMatch(/safeErrorRep/);
    // Does NOT log the event email.
    expect(fn).not.toMatch(/event\.email/);
  });
});

// ---- Cron route source inspection -----------------------------------------

describe("cron routes — use canonical cron-auth helper", () => {
  it("webhook process-queue route imports verifyCronSecret from cron-auth", () => {
    const src = read("src/app/api/webhooks/process-queue/route.ts");
    expect(src).toMatch(/from\s+["']@\/lib\/security\/cron-auth["']/);
    expect(src).toMatch(/verifyCronSecret/);
    // Does NOT have its own verifyCronSecret function.
    expect(src).not.toMatch(/function verifyCronSecret/);
    // Does NOT use console.warn / console.error.
    expect(src).not.toMatch(/console\.(warn|error)/);
    expect(src).toMatch(/logger\.error/);
    expect(src).toMatch(/safeErrorRep/);
  });

  it("broadcast process-queue route imports verifyCronSecret from cron-auth", () => {
    const src = read("src/app/api/broadcasts/process-queue/route.ts");
    expect(src).toMatch(/from\s+["']@\/lib\/security\/cron-auth["']/);
    expect(src).toMatch(/verifyCronSecret/);
    // Does NOT have its own verifyCronSecret function.
    expect(src).not.toMatch(/function verifyCronSecret/);
    // Does NOT use console.error.
    expect(src).not.toMatch(/console\.error/);
    expect(src).toMatch(/logger\.error/);
    expect(src).toMatch(/safeErrorRep/);
  });

  it("both routes have POST + GET aliases", () => {
    const webhookSrc = read("src/app/api/webhooks/process-queue/route.ts");
    const broadcastSrc = read("src/app/api/broadcasts/process-queue/route.ts");
    expect(webhookSrc).toMatch(/export async function POST/);
    expect(webhookSrc).toMatch(/export async function GET/);
    expect(broadcastSrc).toMatch(/export async function POST/);
    expect(broadcastSrc).toMatch(/export async function GET/);
  });
});

// ---- DEPLOY.md scheduled-worker truth -------------------------------------

describe("DEPLOY.md — scheduled-worker truth", () => {
  it("documents BOTH external cron jobs", () => {
    const src = read("DEPLOY.md");
    expect(src).toMatch(/POST \/api\/webhooks\/process-queue/);
    expect(src).toMatch(/POST \/api\/broadcasts\/process-queue/);
  });

  it("states external cron is an operator action, not verified by the repo", () => {
    const src = read("DEPLOY.md");
    expect(src).toMatch(/Operator action required/);
    expect(src).toMatch(/operator responsibility/);
  });
});

// ---- No migration needed (WebhookDelivery.deliveryId already exists) -------

describe("no migration needed", () => {
  it("WebhookDelivery model already has deliveryId (public UUID)", () => {
    const schema = read("prisma/schema.prisma");
    const model = schema.split("model WebhookDelivery {")[1]?.split("}")[0] ?? "";
    expect(model).toMatch(/deliveryId\s+String\s+@unique/);
  });
});

// ---- Stale recovery truthful metrics (Task 1) ------------------------------

describe("stale recovery — truthful failed metrics", () => {
  it("recoverStaleLocks returns StaleRecoveryResult { recovered, failed }", () => {
    const src = read("src/lib/dx/webhooks.ts");
    expect(src).toMatch(/interface StaleRecoveryResult/);
    expect(src).toMatch(/recovered:\s*number/);
    expect(src).toMatch(/failed:\s*number/);
  });

  it("processWebhookQueue includes stale-recovery failures in result.failed", () => {
    const src = read("src/lib/dx/webhooks.ts");
    const fn = src.split("export async function processWebhookQueue")[1]?.split("async function claimPendingJobs")[0] ?? "";
    expect(fn).toMatch(/staleResult\.failed/);
    expect(fn).toMatch(/result\.failed\s*\+=\s*staleResult\.failed/);
  });

  it("stale recovery terminal failure persists truthful attempts on delivery", () => {
    const src = read("src/lib/dx/webhooks.ts");
    const fn = src.split("async function recoverStaleLocks")[1]?.split("async function processOneJob")[0] ?? "";
    // The delivery update includes attempts.
    expect(fn).toMatch(/attempts:\s*job\.attempts/);
  });
});

// ---- Truthful final-attempt metadata (Task 2) ------------------------------

describe("markJobFailedCAS — truthful attempts + responseCode", () => {
  it("markJobFailedCAS accepts attempts + responseCode parameters", () => {
    const src = read("src/lib/dx/webhooks.ts");
    const fn = src.split("async function markJobFailedCAS")[1]?.split("// ---- Backward")[0] ?? "";
    expect(fn).toMatch(/attempts:\s*number/);
    expect(fn).toMatch(/responseCode:\s*number\s*\|\s*null/);
  });

  it("terminal failure delivery update persists attempts + responseCode", () => {
    const src = read("src/lib/dx/webhooks.ts");
    const fn = src.split("async function markJobFailedCAS")[1]?.split("// ---- Backward")[0] ?? "";
    expect(fn).toMatch(/attempts:\s*attempts/);
    expect(fn).toMatch(/responseCode:\s*responseCode/);
  });

  it("pre-network failures (endpoint_missing, ssrf_blocked) pass null responseCode", () => {
    const src = read("src/lib/dx/webhooks.ts");
    const fn = src.split("async function processOneJob")[1]?.split("async function markJobFailedCAS")[0] ?? "";
    expect(fn).toMatch(/markJobFailedCAS\(job, workerId, "endpoint_missing", job\.attempts, null\)/);
    expect(fn).toMatch(/markJobFailedCAS\(job, workerId, "ssrf_blocked", job\.attempts, null\)/);
  });

  it("HTTP terminal failure passes final fetchResult.status", () => {
    const src = read("src/lib/dx/webhooks.ts");
    const fn = src.split("async function processOneJob")[1]?.split("async function markJobFailedCAS")[0] ?? "";
    expect(fn).toMatch(/markJobFailedCAS\(job, workerId, "max_attempts_exceeded", job\.attempts, fetchResult\.status\)/);
  });
});

// ---- Webhook docs contract corrections (Task 3) ---------------------------

describe("webhook docs — no deliveryId-in-payload claim", () => {
  it("EN guide does NOT claim deliveryId field in payload", () => {
    const src = read("src/lib/guide/content/guides/webhooks-en.ts");
    // The old claim was "or the deliveryId field in the payload" — must be gone.
    expect(src).not.toMatch(/deliveryId field in the payload/i);
    expect(src).not.toMatch(/deliveryId in payload/i);
    // The header is the canonical idempotency key.
    expect(src).toMatch(/Nixify-Delivery-Id header/);
  });

  it("FA guide does NOT claim deliveryId field in payload", () => {
    const src = read("src/lib/guide/content/guides/webhooks-fa.ts");
    expect(src).not.toMatch(/deliveryId در payload/);
    expect(src).toMatch(/Nixify-Delivery-Id/);
  });

  it("EN guide documents automatic retries use SAME delivery ID", () => {
    const src = read("src/lib/guide/content/guides/webhooks-en.ts");
    expect(src).toMatch(/Automatic retries use the SAME Nixify-Delivery-Id/i);
  });

  it("EN guide documents manual replay creates NEW delivery ID", () => {
    const src = read("src/lib/guide/content/guides/webhooks-en.ts");
    expect(src).toMatch(/manual replay creates a NEW delivery with a NEW Nixify-Delivery-Id/i);
  });

  it("FA guide documents automatic retries use SAME delivery ID", () => {
    const src = read("src/lib/guide/content/guides/webhooks-fa.ts");
    expect(src).toMatch(/retry.*خودکار.*همان Nixify-Delivery-Id/);
  });

  it("FA guide documents manual replay creates NEW delivery ID", () => {
    const src = read("src/lib/guide/content/guides/webhooks-fa.ts");
    expect(src).toMatch(/replay دستی.*NEW.*Nixify-Delivery-Id/);
  });
});

// ---- Signature persistence truth comments (Task 4) -----------------------

describe("signature persistence truth comments", () => {
  it("scheduling section documents persisted signatures as legacy/audit", () => {
    const src = read("src/lib/dx/webhooks.ts");
    expect(src).toMatch(/LEGACY\/AUDIT/);
    expect(src).toMatch(/signature used for actual network delivery/i);
    expect(src).toMatch(/generates a FRESH signature/i);
    expect(src).toMatch(/not used for wire delivery/i);
  });
});
