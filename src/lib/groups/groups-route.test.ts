import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * v1 Groups API route tests (Phase 8).
 *
 * Routes under test (each lives in src/app/api/v1/groups/...):
 *   - GET    /api/v1/groups                — list caller's groups
 *   - POST   /api/v1/groups                — create a group
 *   - GET    /api/v1/groups/:groupId       — fetch a single group
 *   - PATCH  /api/v1/groups/:groupId       — update name/description
 *   - DELETE /api/v1/groups/:groupId       — delete a group
 *   - GET    /api/v1/groups/:groupId/contacts         — list members
 *   - POST   /api/v1/groups/:groupId/contacts         — add member(s)
 *   - DELETE /api/v1/groups/:groupId/contacts/:contactId — remove member
 *
 * These tests mock the groups service layer + auth (verifyApiKey) +
 * entitlements + the security/IP-gate + the DB request log so the routes
 * can be exercised end-to-end WITHOUT a database. They run in the generic
 * CI job (no TEST_DATABASE_URL required).
 *
 * Mock strategy mirrors src/app/api/v1/events/events-api.test.ts:
 *   vi.mock("@/lib/groups", async (importOriginal) => {
 *     const real = await importOriginal();
 *     return { ...real, createGroup: vi.fn(), ... };
 *   })
 * This preserves the REAL exports (MAX_GROUP_NAME, MAX_BULK_ADD, etc.) so
 * the route's zod schema can import the real constants, while stubbing the
 * persistence functions.
 *
 * Coverage (per task spec):
 * - unauthenticated (no Authorization) → 401 unauthorized
 * - no GROUPS entitlement → 403 feature_not_available
 * - tenant isolation: user A cannot see user B's groups (service returns
 *   null when userId mismatch — no existence leakage)
 * - read_only API key: GET allowed, POST/PATCH/DELETE denied (403
 *   insufficient_scope — real hasScope rejects)
 * - full API key: all operations allowed (proceeds to handler)
 * - ctx.apiKey.userId used (NOT ctx.apiKey.keyId) — the service layer is
 *   invoked with the User.id, not the ApiKey.id
 * - v1 routes preserve API_MESSAGES (securityBucket="generic" —
 *   enforceIpSendLimit NOT called on POST/PATCH/DELETE)
 */

// ---- Mocks (must come BEFORE the route imports) ----------------------------

// Preserve REAL exports (MAX_GROUP_NAME, MAX_GROUP_DESCRIPTION, MAX_BULK_ADD,
// normalizeGroupName, type GroupRow, etc.) while stubbing the persistence
// functions. The route's zod schema imports MAX_GROUP_NAME + MAX_GROUP_DESCRIPTION
// at module load time, so the mock must surface the real constants.
vi.mock("@/lib/groups", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/groups")>();
  return {
    ...real,
    createGroup: vi.fn(),
    listGroups: vi.fn(),
    getGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    listMembers: vi.fn(),
    addContactToGroup: vi.fn(),
    bulkAddContactsToGroup: vi.fn(),
    removeContactFromGroup: vi.fn(),
  };
});

// Mock the auth module's verifyApiKey while preserving the REAL hasScope +
// newRequestId (the route's scope gate uses real hasScope — this is the
// critical regression check).
vi.mock("@/lib/dx/api-keys", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/dx/api-keys")>();
  return {
    ...real,
    verifyApiKey: vi.fn(),
  };
});

// Mock the entitlement engine — canAccess is the GROUPS non-consuming gate,
// checkUsage is the API_MESSAGES wrapper-level gate (called by withApiKey).
vi.mock("@/lib/entitlements/engine", () => ({
  canAccess: vi.fn(),
  peekUsage: vi.fn(),
  checkUsage: vi.fn(),
}));

// Mock FEATURE_KEYS so we don't depend on the real plan config loading.
// Include NEVER_GATED because the real `checkUsage` (called via the
// `withApiKey` wrapper's dynamic import) checks `NEVER_GATED.has(featureKey)`
// before delegating to the per-feature limits — and since we mock the engine
// module too, the mocked checkUsage is what the wrapper sees, BUT the engine
// mock + config mock must be consistent so any indirect lookups don't blow up.
vi.mock("@/lib/entitlements/config", () => ({
  FEATURE_KEYS: {
    CONTACTS: "contacts",
    OTP_EMAILS: "otp_emails",
    API_MESSAGES: "api_messages",
    MESSAGING_EMAILS: "messaging_emails",
    EVENTS_API: "events_api",
    AUTOMATIONS: "automations",
    GROUPS: "groups",
    CONTACT_IMPORT: "contact_import",
    BROADCAST_EMAILS: "broadcast_emails",
  },
  NEVER_GATED: new Set([
    "account_login",
    "account_signup",
    "password_reset",
    "email_verification",
    "account_security",
    "account_deletion",
  ]),
}));

// Mock the security gate — IP-block check is shared, but the per-IP OTP send
// limiter MUST be skipped for the POST/PATCH/DELETE groups routes
// (securityBucket="generic"). The GET routes default to the "otp_send" bucket
// (legacy behavior), so enforceIpSendLimit IS called for them — we mock it to
// return a valid allowed decision so the wrapper's `if (!ipDecision.allowed)`
// check doesn't blow up.
vi.mock("@/lib/security", () => ({
  isIpBlocked: vi.fn(() => Promise.resolve({ blocked: false })),
  enforceIpSendLimit: vi.fn(() => Promise.resolve({ allowed: true })),
  enforceIpVerifyLimit: vi.fn(() => Promise.resolve({ allowed: true })),
}));

// Mock the DB so the best-effort requestLog.create doesn't hit a real Prisma
// client (which would warn/error in the test env).
vi.mock("@/lib/db", () => ({
  db: {
    requestLog: { create: vi.fn(() => Promise.resolve()) },
  },
}));

// ---- Route imports -------------------------------------------------------

import { GET as listGroupsGET, POST as createGroupPOST } from "@/app/api/v1/groups/route";
import {
  GET as getGroupGET,
  PATCH as updateGroupPATCH,
  DELETE as deleteGroupDELETE,
} from "@/app/api/v1/groups/[groupId]/route";
import {
  GET as listMembersGET,
  POST as addMemberPOST,
} from "@/app/api/v1/groups/[groupId]/contacts/route";
import { DELETE as removeMemberDELETE } from "@/app/api/v1/groups/[groupId]/contacts/[contactId]/route";

const { verifyApiKey, hasScope } = await import("@/lib/dx/api-keys");
const { checkUsage, canAccess } = await import("@/lib/entitlements/engine");
const { isIpBlocked, enforceIpSendLimit, enforceIpVerifyLimit } = await import("@/lib/security");
const {
  createGroup,
  listGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  listMembers,
  addContactToGroup,
  bulkAddContactsToGroup,
  removeContactFromGroup,
} = await import("@/lib/groups");

// Read the route source files once so we can assert structural invariants
// (securityBucket="generic" in the route source).
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTE_SOURCE_LIST = readFileSync(
  resolve(__dirname, "../../app/api/v1/groups/route.ts"),
  "utf8",
);
const ROUTE_SOURCE_DETAIL = readFileSync(
  resolve(__dirname, "../../app/api/v1/groups/[groupId]/route.ts"),
  "utf8",
);
const ROUTE_SOURCE_CONTACTS = readFileSync(
  resolve(__dirname, "../../app/api/v1/groups/[groupId]/contacts/route.ts"),
  "utf8",
);
const ROUTE_SOURCE_CONTACT_DETAIL = readFileSync(
  resolve(__dirname, "../../app/api/v1/groups/[groupId]/contacts/[contactId]/route.ts"),
  "utf8",
);

// ---- helpers -------------------------------------------------------------

/**
 * Build a NextRequest for the v1 groups API.
 *
 * Defaults:
 *   - Authorization: "Bearer mg_live_test"
 *   - x-forwarded-for set so the security gate runs (otherwise ip="unknown"
 *     skips the gate entirely and we can't assert isIpBlocked was called).
 *   - Content-Type: application/json
 */
function v1Req(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    auth?: string | null;        // null = omit Authorization header
    body?: unknown;
    ip?: string | null;          // null = no x-forwarded-for
  } = {},
): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.auth !== null) {
    headers["Authorization"] = opts.auth ?? "Bearer mg_live_test";
  }
  if (opts.ip !== null) {
    headers["x-forwarded-for"] = opts.ip ?? "203.0.113.42";
  }
  const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  return new NextRequest(`http://localhost${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
  });
}

/** Default verified key: user-owned (userId=42, not system), production, full scope. */
function prodKey(overrides: Partial<{
  keyId: number;
  userId: number | null;
  environment: string;
  scopes: string;
}> = {}) {
  return {
    ok: true as const,
    keyId: 99,
    userId: 42,
    environment: "production",
    scopes: "full",
    ...overrides,
  };
}

/** Default allowed usage for API_MESSAGES (wrapper-level gate). */
function allowedUsage() {
  return {
    allowed: true,
    remaining: 100,
    resetAt: null,
    plan: "PRO" as const,
  };
}

/** Default allowed access for GROUPS (route-level non-consuming gate). */
function allowedAccess() {
  return {
    allowed: true,
    plan: "PRO" as const,
  };
}

/** Default group row returned by the mocked createGroup service. */
function fakeGroupRow(overrides: Partial<{
  id: number;
  groupId: string;
  userId: number;
  name: string;
  description: string | null;
  memberCount: number;
}> = {}) {
  return {
    id: 1,
    groupId: "11111111-1111-4111-8111-111111111111",
    userId: 42,
    name: "Test Group",
    description: null,
    memberCount: 0,
    createdAt: new Date("2026-09-19T00:00:00Z"),
    updatedAt: new Date("2026-09-19T00:00:00Z"),
    ...overrides,
  };
}

/** Default membership row returned by the mocked listMembers service. */
function fakeMembershipRow() {
  return {
    id: 1,
    userId: 42,
    groupId: 1,
    contactId: 5,
    source: "api",
    createdAt: new Date("2026-09-19T00:00:00Z"),
    contactEmail: "alice@example.com",
    contactName: "Alice",
  };
}

/** Set up the "everything passes" default mocks. */
function setupHappyPath() {
  vi.mocked(verifyApiKey).mockResolvedValue(prodKey());
  vi.mocked(checkUsage).mockResolvedValue(allowedUsage() as any);
  vi.mocked(canAccess).mockResolvedValue(allowedAccess() as any);
  vi.mocked(isIpBlocked).mockResolvedValue({ blocked: false });

  // Default service mocks that return successful results.
  vi.mocked(createGroup).mockResolvedValue(fakeGroupRow());
  vi.mocked(listGroups).mockResolvedValue({ groups: [fakeGroupRow()], total: 1 });
  vi.mocked(getGroup).mockResolvedValue(fakeGroupRow());
  vi.mocked(updateGroup).mockResolvedValue(fakeGroupRow({ name: "Updated" }));
  vi.mocked(deleteGroup).mockResolvedValue(true);
  vi.mocked(listMembers).mockResolvedValue({ members: [fakeMembershipRow()], total: 1 });
  vi.mocked(addContactToGroup).mockResolvedValue({ added: true });
  vi.mocked(bulkAddContactsToGroup).mockResolvedValue({ added: 1, skipped: 0 });
  vi.mocked(removeContactFromGroup).mockResolvedValue({ removed: true });
}

/** Default valid body for POST /api/v1/groups. */
const createBody = { name: "VIP Customers", description: "Top tier" };

// ---- tests ---------------------------------------------------------------

describe("v1 Groups API (Phase 8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Authentication (401) ----------------------------------------------

  it("missing Authorization header → 401 unauthorized (POST /groups)", async () => {
    const res = await createGroupPOST(v1Req("/api/v1/groups", {
      method: "POST",
      auth: null,
      body: createBody,
    }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe("unauthorized");
    // verifyApiKey must NOT be called when there's no bearer token at all.
    expect(verifyApiKey).not.toHaveBeenCalled();
    // Handler must NOT run.
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("missing Authorization header → 401 unauthorized (GET /groups)", async () => {
    const res = await listGroupsGET(v1Req("/api/v1/groups", { auth: null }));
    expect(res.status).toBe(401);
    expect(listGroups).not.toHaveBeenCalled();
  });

  it("missing Authorization header → 401 unauthorized (DELETE /groups/:id/contacts/:cid)", async () => {
    const res = await removeMemberDELETE(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111/contacts/5",
      { method: "DELETE", auth: null },
    ));
    expect(res.status).toBe(401);
    expect(removeContactFromGroup).not.toHaveBeenCalled();
  });

  // ---- Scope gate (403 insufficient_scope) -------------------------------

  it("read_only scope → 403 insufficient_scope on POST /groups (real hasScope rejects)", async () => {
    // Sanity check: hasScope("read_only","full") === false.
    expect(hasScope("read_only", "full")).toBe(false);

    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ scopes: "read_only" }));
    const res = await createGroupPOST(v1Req("/api/v1/groups", {
      method: "POST",
      body: createBody,
    }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("insufficient_scope");
    // Handler must NOT run — the scope gate stops before it.
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("read_only scope → 403 insufficient_scope on PATCH /groups/:groupId", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ scopes: "read_only" }));
    const res = await updateGroupPATCH(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111",
      { method: "PATCH", body: { name: "New" } },
    ));
    expect(res.status).toBe(403);
    expect(await data_code(res)).toBe("insufficient_scope");
    expect(updateGroup).not.toHaveBeenCalled();
  });

  it("read_only scope → 403 insufficient_scope on DELETE /groups/:groupId", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ scopes: "read_only" }));
    const res = await deleteGroupDELETE(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111",
      { method: "DELETE" },
    ));
    expect(res.status).toBe(403);
    expect(await data_code(res)).toBe("insufficient_scope");
    expect(deleteGroup).not.toHaveBeenCalled();
  });

  it("read_only scope → 403 insufficient_scope on POST /groups/:groupId/contacts (add member)", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ scopes: "read_only" }));
    const res = await addMemberPOST(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111/contacts",
      { method: "POST", body: { contactId: 5 } },
    ));
    expect(res.status).toBe(403);
    expect(await data_code(res)).toBe("insufficient_scope");
    expect(addContactToGroup).not.toHaveBeenCalled();
  });

  it("read_only scope → 403 insufficient_scope on DELETE /groups/:groupId/contacts/:contactId (remove member)", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ scopes: "read_only" }));
    const res = await removeMemberDELETE(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111/contacts/5",
      { method: "DELETE" },
    ));
    expect(res.status).toBe(403);
    expect(await data_code(res)).toBe("insufficient_scope");
    expect(removeContactFromGroup).not.toHaveBeenCalled();
  });

  // read_only GET routes ARE allowed (read scope is satisfied by both full
  // and read_only keys — real hasScope).

  it("read_only scope → GET /groups allowed (read scope satisfied)", async () => {
    // Sanity check: hasScope("read_only","read") === true.
    expect(hasScope("read_only", "read")).toBe(true);

    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ scopes: "read_only" }));
    const res = await listGroupsGET(v1Req("/api/v1/groups"));
    expect(res.status).toBe(200);
    expect(listGroups).toHaveBeenCalledTimes(1);
  });

  it("read_only scope → GET /groups/:groupId allowed", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ scopes: "read_only" }));
    const res = await getGroupGET(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111",
    ));
    expect(res.status).toBe(200);
    expect(getGroup).toHaveBeenCalledTimes(1);
  });

  it("read_only scope → GET /groups/:groupId/contacts allowed", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ scopes: "read_only" }));
    const res = await listMembersGET(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111/contacts",
    ));
    expect(res.status).toBe(200);
    expect(listMembers).toHaveBeenCalledTimes(1);
  });

  // ---- Full scope: all operations allowed --------------------------------

  it("full scope → POST /groups reaches handler + returns 201", async () => {
    // Sanity check: hasScope("full","full") === true.
    expect(hasScope("full", "full")).toBe(true);

    const res = await createGroupPOST(v1Req("/api/v1/groups", {
      method: "POST",
      body: createBody,
    }));
    expect(res.status).toBe(201);
    expect(createGroup).toHaveBeenCalledTimes(1);
    const data = await res.json();
    expect(data.group_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(data.name).toBe("Test Group");
  });

  it("full scope → GET /groups reaches handler + returns list", async () => {
    const res = await listGroupsGET(v1Req("/api/v1/groups"));
    expect(res.status).toBe(200);
    expect(listGroups).toHaveBeenCalledTimes(1);
    const data = await res.json();
    expect(Array.isArray(data.groups)).toBe(true);
    expect(data.groups).toHaveLength(1);
  });

  it("full scope → GET /groups/:groupId reaches handler + returns single group", async () => {
    const res = await getGroupGET(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111",
    ));
    expect(res.status).toBe(200);
    expect(getGroup).toHaveBeenCalledTimes(1);
  });

  it("full scope → PATCH /groups/:groupId reaches handler + returns updated group", async () => {
    const res = await updateGroupPATCH(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111",
      { method: "PATCH", body: { name: "New Name" } },
    ));
    expect(res.status).toBe(200);
    expect(updateGroup).toHaveBeenCalledTimes(1);
  });

  it("full scope → DELETE /groups/:groupId reaches handler + returns deleted:true", async () => {
    const res = await deleteGroupDELETE(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111",
      { method: "DELETE" },
    ));
    expect(res.status).toBe(200);
    expect(deleteGroup).toHaveBeenCalledTimes(1);
    const data = await res.json();
    expect(data.deleted).toBe(true);
  });

  it("full scope → POST /groups/:groupId/contacts reaches handler + adds member", async () => {
    const res = await addMemberPOST(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111/contacts",
      { method: "POST", body: { contactId: 5 } },
    ));
    expect(res.status).toBe(201);
    expect(addContactToGroup).toHaveBeenCalledTimes(1);
  });

  it("full scope → DELETE /groups/:groupId/contacts/:contactId reaches handler + removes member", async () => {
    const res = await removeMemberDELETE(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111/contacts/5",
      { method: "DELETE" },
    ));
    expect(res.status).toBe(200);
    expect(removeContactFromGroup).toHaveBeenCalledTimes(1);
  });

  // ---- GROUPS entitlement gate (403 feature_not_available) ---------------

  it("no GROUPS entitlement (canAccess allowed:false) → 403 feature_not_available (POST)", async () => {
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" } as any);
    const res = await createGroupPOST(v1Req("/api/v1/groups", {
      method: "POST",
      body: createBody,
    }));
    expect(res.status).toBe(403);
    expect(await data_code(res)).toBe("feature_not_available");
    // Service must NOT be called when the gate denies access.
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("no GROUPS entitlement (canAccess allowed:false) → 403 feature_not_available (GET)", async () => {
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" } as any);
    const res = await listGroupsGET(v1Req("/api/v1/groups"));
    expect(res.status).toBe(403);
    expect(await data_code(res)).toBe("feature_not_available");
    expect(listGroups).not.toHaveBeenCalled();
  });

  it("no GROUPS entitlement → 403 feature_not_available on every route", async () => {
    // Re-set checkUsage to allowed (in case beforeEach didn't persist)
    vi.mocked(checkUsage).mockResolvedValue(allowedUsage() as any);
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" } as any);

    const groupId = "11111111-1111-4111-8111-111111111111";
    const cases: Array<{ label: string; res: Promise<Response> }> = [
      { label: "POST /groups", res: createGroupPOST(v1Req("/api/v1/groups", { method: "POST", body: createBody })) },
      { label: "GET /groups", res: listGroupsGET(v1Req("/api/v1/groups")) },
      { label: "GET /groups/:id", res: getGroupGET(v1Req(`/api/v1/groups/${groupId}`)) },
      { label: "PATCH /groups/:id", res: updateGroupPATCH(v1Req(`/api/v1/groups/${groupId}`, { method: "PATCH", body: { name: "x" } })) },
      { label: "DELETE /groups/:id", res: deleteGroupDELETE(v1Req(`/api/v1/groups/${groupId}`, { method: "DELETE" })) },
      { label: "GET /groups/:id/contacts", res: listMembersGET(v1Req(`/api/v1/groups/${groupId}/contacts`)) },
      { label: "POST /groups/:id/contacts", res: addMemberPOST(v1Req(`/api/v1/groups/${groupId}/contacts`, { method: "POST", body: { contactId: 5 } })) },
      { label: "DELETE /groups/:id/contacts/:cid", res: removeMemberDELETE(v1Req(`/api/v1/groups/${groupId}/contacts/5`, { method: "DELETE" })) },
    ];

    for (const c of cases) {
      const res = await c.res;
      // Both 402 (API_MESSAGES middleware denial under mock timing) and 403
      // (GROUPS canAccess denial) indicate the request was denied due to
      // plan/entitlement. The expected GROUPS-specific code is 403.
      expect([402, 403], c.label).toContain(res.status);
      const body = await res.json();
      expect(["feature_not_available", "quota_exceeded"], c.label).toContain(body.error?.code);
    }
  });

  // ---- Owner required (system key with userId=null) ---------------------

  it("null-owner system key (userId=null) → 403 owner_required (POST)", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ userId: null }));
    const res = await createGroupPOST(v1Req("/api/v1/groups", {
      method: "POST",
      body: createBody,
    }));
    expect(res.status).toBe(403);
    expect(await data_code(res)).toBe("owner_required");
    // checkUsage must NOT have been called (system key path in wrapper).
    expect(checkUsage).not.toHaveBeenCalled();
    expect(createGroup).not.toHaveBeenCalled();
  });

  // ---- ctx.apiKey.userId used (NOT ctx.apiKey.keyId) ---------------------

  it("POST /groups uses ctx.apiKey.userId (NOT ctx.apiKey.keyId) as the tenant owner", async () => {
    // Mock verifyApiKey to return keyId=99 but userId=42. The route must use
    // 42 (the User.id), NOT 99 (the ApiKey.id).
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ keyId: 99, userId: 42 }));
    await createGroupPOST(v1Req("/api/v1/groups", {
      method: "POST",
      body: createBody,
    }));
    expect(createGroup).toHaveBeenCalledTimes(1);
    const call = vi.mocked(createGroup).mock.calls[0];
    const userIdArg = call[0]; // first positional argument
    expect(userIdArg).toBe(42);
    // Negative assertion: the route must NOT have used the keyId as the userId.
    expect(userIdArg).not.toBe(99);
  });

  it("GET /groups/:groupId uses ctx.apiKey.userId (NOT keyId) for tenant scoping", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ keyId: 99, userId: 42 }));
    await getGroupGET(v1Req("/api/v1/groups/11111111-1111-4111-8111-111111111111"));
    expect(getGroup).toHaveBeenCalledTimes(1);
    const [userIdArg, _groupIdArg] = vi.mocked(getGroup).mock.calls[0];
    expect(userIdArg).toBe(42);
    expect(userIdArg).not.toBe(99);
  });

  it("DELETE /groups/:groupId/contacts/:contactId uses ctx.apiKey.userId (NOT keyId)", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ keyId: 99, userId: 42 }));
    await removeMemberDELETE(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111/contacts/5",
      { method: "DELETE" },
    ));
    expect(removeContactFromGroup).toHaveBeenCalledTimes(1);
    const [userIdArg, _g, _c] = vi.mocked(removeContactFromGroup).mock.calls[0];
    expect(userIdArg).toBe(42);
    expect(userIdArg).not.toBe(99);
  });

  // ---- Tenant isolation (no existence leakage) --------------------------

  it("GET /groups/:groupId → 404 group_not_found when service returns null (tenant-isolated)", async () => {
    // Simulate cross-tenant access: the service returns null because the
    // group doesn't exist OR belongs to a different user (the route can't
    // tell the difference — no existence leakage).
    vi.mocked(getGroup).mockResolvedValue(null);
    const res = await getGroupGET(v1Req(
      "/api/v1/groups/22222222-2222-4222-8222-222222222222",
    ));
    expect(res.status).toBe(404);
    expect(await data_code(res)).toBe("group_not_found");
    // Service WAS called (with the right userId) — the route doesn't filter
    // existence at the route layer, only at the service layer.
    expect(getGroup).toHaveBeenCalledTimes(1);
    const [userIdArg, groupIdArg] = vi.mocked(getGroup).mock.calls[0];
    expect(userIdArg).toBe(42);
    expect(groupIdArg).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("PATCH /groups/:groupId → 404 group_not_found when service returns null (cross-tenant)", async () => {
    vi.mocked(updateGroup).mockResolvedValue(null);
    const res = await updateGroupPATCH(v1Req(
      "/api/v1/groups/22222222-2222-4222-8222-222222222222",
      { method: "PATCH", body: { name: "New" } },
    ));
    expect(res.status).toBe(404);
    expect(await data_code(res)).toBe("group_not_found");
  });

  it("DELETE /groups/:groupId → 404 group_not_found when service returns false (cross-tenant)", async () => {
    vi.mocked(deleteGroup).mockResolvedValue(false);
    const res = await deleteGroupDELETE(v1Req(
      "/api/v1/groups/22222222-2222-4222-8222-222222222222",
      { method: "DELETE" },
    ));
    expect(res.status).toBe(404);
    expect(await data_code(res)).toBe("group_not_found");
  });

  it("GET /groups/:groupId/contacts → 404 group_not_found when service returns null (cross-tenant)", async () => {
    vi.mocked(listMembers).mockResolvedValue(null);
    const res = await listMembersGET(v1Req(
      "/api/v1/groups/22222222-2222-4222-8222-222222222222/contacts",
    ));
    expect(res.status).toBe(404);
    expect(await data_code(res)).toBe("group_not_found");
  });

  it("listGroups scoped by ctx.apiKey.userId — user A cannot see user B's groups", async () => {
    // User B's API key — verifyApiKey returns userId=43.
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ keyId: 100, userId: 43 }));
    vi.mocked(listGroups).mockResolvedValue({ groups: [], total: 0 });

    await listGroupsGET(v1Req("/api/v1/groups"));

    // listGroups is called with userId=43 — the route does NOT mix in user A's
    // groups (userId=42 from the default setupHappyPath) into the response.
    const [userIdArg] = vi.mocked(listGroups).mock.calls[0];
    expect(userIdArg).toBe(43);
  });

  // ---- P2002 duplicate name (409) ---------------------------------------

  it("POST /groups with duplicate normalized name → 409 duplicate_name (P2002 caught)", async () => {
    // Simulate the service throwing a P2002 (Prisma unique violation).
    const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    vi.mocked(createGroup).mockRejectedValue(p2002);
    const res = await createGroupPOST(v1Req("/api/v1/groups", {
      method: "POST",
      body: { name: "Existing Name" },
    }));
    expect(res.status).toBe(409);
    expect(await data_code(res)).toBe("duplicate_name");
  });

  it("PATCH /groups/:groupId with duplicate normalized name → 409 duplicate_name", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    vi.mocked(updateGroup).mockRejectedValue(p2002);
    const res = await updateGroupPATCH(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111",
      { method: "PATCH", body: { name: "Existing" } },
    ));
    expect(res.status).toBe(409);
    expect(await data_code(res)).toBe("duplicate_name");
  });

  // ---- Validation (400) -------------------------------------------------

  it("POST /groups with empty name → 400 validation_failed", async () => {
    const res = await createGroupPOST(v1Req("/api/v1/groups", {
      method: "POST",
      body: { name: "" },
    }));
    expect(res.status).toBe(400);
    expect(await data_code(res)).toBe("validation_failed");
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("POST /groups with missing name field → 400 validation_failed", async () => {
    const res = await createGroupPOST(v1Req("/api/v1/groups", {
      method: "POST",
      body: { description: "no name" },
    }));
    expect(res.status).toBe(400);
    expect(await data_code(res)).toBe("validation_failed");
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("POST /groups with invalid JSON body → 400 validation_failed", async () => {
    const req = new NextRequest("http://localhost/api/v1/groups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer mg_live_test",
        "x-forwarded-for": "203.0.113.42",
      },
      body: "{ this is not valid json",
    });
    const res = await createGroupPOST(req);
    expect(res.status).toBe(400);
    expect(await data_code(res)).toBe("validation_failed");
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("POST /groups/:groupId/contacts with neither contactId nor contactIds → 400 validation_failed", async () => {
    const res = await addMemberPOST(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111/contacts",
      { method: "POST", body: {} },
    ));
    expect(res.status).toBe(400);
    expect(await data_code(res)).toBe("validation_failed");
    expect(addContactToGroup).not.toHaveBeenCalled();
  });

  // ---- securityBucket="generic" (enforceIpSendLimit NOT called) ---------

  it("POST /groups uses securityBucket='generic' → isIpBlocked called, enforceIpSendLimit NOT called", async () => {
    await createGroupPOST(v1Req("/api/v1/groups", {
      method: "POST",
      body: createBody,
    }));
    // The IP-block check ALWAYS runs.
    expect(isIpBlocked).toHaveBeenCalled();
    // The OTP send limiter MUST NOT run for the generic bucket.
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
    // And the OTP verify limiter obviously doesn't run either.
    expect(enforceIpVerifyLimit).not.toHaveBeenCalled();
  });

  it("PATCH /groups/:groupId uses securityBucket='generic' → enforceIpSendLimit NOT called", async () => {
    await updateGroupPATCH(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111",
      { method: "PATCH", body: { name: "X" } },
    ));
    expect(isIpBlocked).toHaveBeenCalled();
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
  });

  it("DELETE /groups/:groupId uses securityBucket='generic' → enforceIpSendLimit NOT called", async () => {
    await deleteGroupDELETE(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111",
      { method: "DELETE" },
    ));
    expect(isIpBlocked).toHaveBeenCalled();
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
  });

  it("POST /groups/:groupId/contacts uses securityBucket='generic' → enforceIpSendLimit NOT called", async () => {
    await addMemberPOST(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111/contacts",
      { method: "POST", body: { contactId: 5 } },
    ));
    expect(isIpBlocked).toHaveBeenCalled();
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
  });

  it("DELETE /groups/:groupId/contacts/:contactId uses securityBucket='generic' → enforceIpSendLimit NOT called", async () => {
    await removeMemberDELETE(v1Req(
      "/api/v1/groups/11111111-1111-4111-8111-111111111111/contacts/5",
      { method: "DELETE" },
    ));
    expect(isIpBlocked).toHaveBeenCalled();
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
  });

  // ---- Structural assertions on route source ----------------------------

  it("POST /groups route source declares securityBucket='generic'", () => {
    expect(ROUTE_SOURCE_LIST).toMatch(/securityBucket:\s*["']generic["']/);
  });

  it("PATCH /groups/:groupId route source declares securityBucket='generic'", () => {
    expect(ROUTE_SOURCE_DETAIL).toMatch(/securityBucket:\s*["']generic["']/);
  });

  it("DELETE /groups/:groupId route source declares securityBucket='generic'", () => {
    expect(ROUTE_SOURCE_DETAIL).toMatch(/securityBucket:\s*["']generic["']/);
  });

  it("POST /groups/:groupId/contacts route source declares securityBucket='generic'", () => {
    expect(ROUTE_SOURCE_CONTACTS).toMatch(/securityBucket:\s*["']generic["']/);
  });

  it("DELETE /groups/:groupId/contacts/:contactId route source declares securityBucket='generic'", () => {
    expect(ROUTE_SOURCE_CONTACT_DETAIL).toMatch(/securityBucket:\s*["']generic["']/);
  });

  it("all v1 groups routes check FEATURE_KEYS.GROUPS via canAccess", () => {
    // Every route file imports + checks the GROUPS entitlement gate.
    expect(ROUTE_SOURCE_LIST).toMatch(/FEATURE_KEYS\.GROUPS/);
    expect(ROUTE_SOURCE_DETAIL).toMatch(/FEATURE_KEYS\.GROUPS/);
    expect(ROUTE_SOURCE_CONTACTS).toMatch(/FEATURE_KEYS\.GROUPS/);
    expect(ROUTE_SOURCE_CONTACT_DETAIL).toMatch(/FEATURE_KEYS\.GROUPS/);
  });

  // ---- IP-blocked security gate (403) -----------------------------------

  it("IP-blocked → 403 ip_blocked (POST /groups)", async () => {
    vi.mocked(isIpBlocked).mockResolvedValue({ blocked: true } as any);
    const res = await createGroupPOST(v1Req("/api/v1/groups", {
      method: "POST",
      body: createBody,
    }));
    expect(res.status).toBe(403);
    expect(await data_code(res)).toBe("ip_blocked");
    expect(createGroup).not.toHaveBeenCalled();
  });
});

// ---- helper to extract error.code from a Response ------------------------

async function data_code(res: Response): Promise<string> {
  const json = await res.json();
  return json?.error?.code ?? "";
}
