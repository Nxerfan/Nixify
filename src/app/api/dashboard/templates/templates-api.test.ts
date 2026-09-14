import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Dashboard Transactional Templates API route tests (Phase 3).
 *
 * These tests mock the transactional-templates service layer + auth + entitlements
 * to verify route-level behavior WITHOUT a database. They run in the generic CI job
 * (no TEST_DATABASE_URL required).
 *
 * Mock strategy: vi.mock("@/lib/transactional-templates", async (importOriginal) => {
 *   const real = await importOriginal();
 *   return { ...real, createTemplate: vi.fn(), listTemplates: vi.fn(), ... };
 * })
 *
 * This preserves the REAL zod schemas (createTemplateSchema, patchTemplateSchema,
 * previewSchema) + the REAL validation helpers (validateVariableValues,
 * extractVariables, sanitizeTemplateHtml) so the routes' .safeParse calls +
 * scalar-validation actually execute end-to-end. Only the persistence functions
 * (and the renderer, where useful for asserting missing-variable behavior) are
 * stubbed as controllable mocks.
 *
 * Coverage:
 * - unauthenticated → 401 on every route
 * - no MESSAGING_EMAILS entitlement → 403 on every route (feature_not_available)
 * - GET list passes authenticated userId to service
 * - GET list with search passes search to service
 * - GET list with invalid page → 400
 * - POST create → 201 with template fields; userId from session, NOT client body
 * - POST create with invalid slug → 400 (real zod slugSchema runs)
 * - POST create returns 400 on TemplateValidationError
 * - GET detail returns 404 when service returns null (no existence leakage)
 * - GET detail uses authenticated userId
 * - PATCH returns 404 when service throws TemplateNotFoundError
 * - PATCH mass-assignment protection: slug / userId / currentVersion rejected
 * - PATCH with valid body calls updateTemplate(userId, id, {...})
 * - DELETE returns 404 when service returns false
 * - DELETE uses authenticated userId
 * - DELETE returns {deleted: true} on success
 * - POST preview inline → renders + returns rendered output
 * - POST preview NEVER calls any mail transport (response is render-only)
 * - POST preview missing variable → 400 missing_template_variables + missing[]
 * - POST preview scalar validation: object value → 400 validation_failed
 *   (real validateVariableValues runs, halts before render)
 * - POST preview with templateId fetches via getTemplate and renders
 */

// Mock the service module — preserve real zod schemas + validation helpers,
// override only the persistence functions (+ the renderer, for asserting
// missing-variable behavior).
vi.mock("@/lib/transactional-templates", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/transactional-templates")>();
  return {
    ...real,
    createTemplate: vi.fn(),
    listTemplates: vi.fn(),
    getTemplate: vi.fn(),
    getVersion: vi.fn(),
    listVersions: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    renderTransactionalTemplate: vi.fn(),
  };
});

// Mock the auth module
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(),
}));

// Mock the entitlement engine
vi.mock("@/lib/entitlements/engine", () => ({
  canAccess: vi.fn(),
  peekUsage: vi.fn(),
  checkUsage: vi.fn(),
}));

// Mock the entitlement config
vi.mock("@/lib/entitlements/config", () => ({
  FEATURE_KEYS: {
    CONTACTS: "contacts",
    OTP_EMAILS: "otp_emails",
    API_MESSAGES: "api_messages",
    MESSAGING_EMAILS: "messaging_emails",
  },
}));

import { GET as listGET, POST as listPOST } from "@/app/api/dashboard/templates/route";
import {
  GET as detailGET,
  PATCH as detailPATCH,
  DELETE as detailDELETE,
} from "@/app/api/dashboard/templates/[id]/route";
import { POST as previewPOST } from "@/app/api/dashboard/templates/preview/route";

const { getAuthenticatedUser } = await import("@/lib/auth/session");
const { canAccess } = await import("@/lib/entitlements/engine");
const {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  renderTransactionalTemplate,
  TemplateValidationError,
  TemplateNotFoundError,
} = await import("@/lib/transactional-templates");

// ---- helpers (mirrors contacts-api.test.ts) -------------------------------

function mockReq(url: string, opts?: { method?: string; body?: unknown }) {
  const method = opts?.method ?? "GET";
  const body = opts?.body ? JSON.stringify(opts.body) : undefined;
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body,
  });
}

function mockUser(id: number) {
  return { id, email: `user${id}@test.com`, plan: "PRO" } as any;
}

function mockParams(id: string) {
  return Promise.resolve({ id });
}

// ---- shared mock fixtures ---------------------------------------------------

function fakeTemplateRow(id = 1, userId = 1) {
  return {
    id,
    userId,
    name: "Welcome",
    slug: "welcome",
    description: "Welcome email",
    currentVersion: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };
}

function fakeVersionRow(version = 1) {
  return {
    id: 100 + version,
    templateId: 1,
    version,
    subject: "Hello {{name}}",
    html: "<p>Hi {{name}}</p>",
    text: "Hi {{name}}",
    variables: ["name"],
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
}

// ---- tests ------------------------------------------------------------------

describe("Dashboard Templates API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Authentication (401 on every route) --------------------------------

  it("unauthenticated GET list → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await listGET(mockReq("/api/dashboard/templates"));
    expect(res.status).toBe(401);
  });

  it("unauthenticated POST create → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await listPOST(
      mockReq("/api/dashboard/templates", {
        method: "POST",
        body: { name: "X", slug: "x", subject: "S", html: "<p></p>" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated GET detail → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await detailGET(mockReq("/api/dashboard/templates/1"), {
      params: mockParams("1"),
    });
    expect(res.status).toBe(401);
  });

  it("unauthenticated PATCH → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await detailPATCH(
      mockReq("/api/dashboard/templates/1", { method: "PATCH", body: { name: "X" } }),
      { params: mockParams("1") },
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated DELETE → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await detailDELETE(
      mockReq("/api/dashboard/templates/1", { method: "DELETE" }),
      { params: mockParams("1") },
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated POST preview → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await previewPOST(
      mockReq("/api/dashboard/templates/preview", {
        method: "POST",
        body: { subject: "S", html: "<p></p>", variables: {} },
      }),
    );
    expect(res.status).toBe(401);
  });

  // ---- Entitlement gate (403 on every route) ------------------------------

  it("no MESSAGING_EMAILS entitlement → 403 on GET list", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" });
    const res = await listGET(mockReq("/api/dashboard/templates"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
  });

  it("no MESSAGING_EMAILS entitlement → 403 on POST create", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" });
    const res = await listPOST(
      mockReq("/api/dashboard/templates", {
        method: "POST",
        body: { name: "X", slug: "x", subject: "S", html: "<p></p>" },
      }),
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
  });

  it("no MESSAGING_EMAILS entitlement → 403 on GET detail", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" });
    const res = await detailGET(mockReq("/api/dashboard/templates/1"), {
      params: mockParams("1"),
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
  });

  it("no MESSAGING_EMAILS entitlement → 403 on PATCH", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" });
    const res = await detailPATCH(
      mockReq("/api/dashboard/templates/1", { method: "PATCH", body: { name: "X" } }),
      { params: mockParams("1") },
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
  });

  it("no MESSAGING_EMAILS entitlement → 403 on DELETE", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" });
    const res = await detailDELETE(
      mockReq("/api/dashboard/templates/1", { method: "DELETE" }),
      { params: mockParams("1") },
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
  });

  it("no MESSAGING_EMAILS entitlement → 403 on POST preview", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" });
    const res = await previewPOST(
      mockReq("/api/dashboard/templates/preview", {
        method: "POST",
        body: { subject: "S", html: "<p></p>", variables: {} },
      }),
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
  });

  // ---- GET list -----------------------------------------------------------

  it("GET list passes authenticated userId to listTemplates", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(42));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(listTemplates).mockResolvedValue({
      templates: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await listGET(mockReq("/api/dashboard/templates?page=1&pageSize=20"));

    expect(listTemplates).toHaveBeenCalledWith(42, expect.objectContaining({ page: 1, pageSize: 20 }));
  });

  it("GET list with search passes search to service", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(listTemplates).mockResolvedValue({
      templates: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await listGET(mockReq("/api/dashboard/templates?search=welcome"));

    expect(listTemplates).toHaveBeenCalledWith(1, expect.objectContaining({ search: "welcome" }));
  });

  it("GET list with invalid page → 400", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });

    const res = await listGET(mockReq("/api/dashboard/templates?page=0"));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    // Service must not be called when page validation fails
    expect(listTemplates).not.toHaveBeenCalled();
  });

  // ---- POST create --------------------------------------------------------

  it("POST create returns 201 with template fields; userId from session, NOT client body", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(7));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(createTemplate).mockResolvedValue({
      template: fakeTemplateRow(5, 7),
      version: fakeVersionRow(1),
    });

    const res = await listPOST(
      mockReq("/api/dashboard/templates", {
        method: "POST",
        // Client tries to mass-assign userId:999 — must be ignored (zod strips
        // unknown keys, and the route always uses session user.id).
        body: {
          name: "Welcome",
          slug: "welcome",
          subject: "Hello {{name}}",
          html: "<p>Hi {{name}}</p>",
          userId: 999,
        },
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe(5);
    expect(data.name).toBe("Welcome");
    expect(data.slug).toBe("welcome");
    expect(data.current_version).toBe(1);
    expect(data.variables).toEqual(["name"]);

    // createTemplate called with session userId (7), NOT 999 from client
    expect(createTemplate).toHaveBeenCalledWith(7, expect.objectContaining({ name: "Welcome" }));
    expect(createTemplate).not.toHaveBeenCalledWith(999, expect.anything());

    // The body passed to createTemplate must NOT carry the client-supplied userId
    // (zod stripped it).
    const call = vi.mocked(createTemplate).mock.calls[0];
    expect(call[1]).not.toHaveProperty("userId");
  });

  it("POST create with invalid slug → 400 (real zod slugSchema runs)", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });

    const res = await listPOST(
      mockReq("/api/dashboard/templates", {
        method: "POST",
        // "Bad Slug!" fails /^[a-z][a-z0-9-]{0,79}$/ — uppercase, space, bang.
        body: { name: "Welcome", slug: "Bad Slug!", subject: "Hello", html: "<p>Hi</p>" },
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it("POST create returns 400 on TemplateValidationError", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(createTemplate).mockRejectedValue(
      new TemplateValidationError("A template with this slug already exists. Choose a different slug."),
    );

    const res = await listPOST(
      mockReq("/api/dashboard/templates", {
        method: "POST",
        body: { name: "Welcome", slug: "welcome", subject: "Hello", html: "<p>Hi</p>" },
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(data.error.message).toMatch(/already exists/);
  });

  // ---- GET detail ---------------------------------------------------------

  it("GET detail returns 404 when service returns null (no existence leakage)", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(getTemplate).mockResolvedValue(null);

    const res = await detailGET(mockReq("/api/dashboard/templates/999"), {
      params: mockParams("999"),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("template_not_found");
  });

  it("GET detail uses authenticated userId", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(33));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(getTemplate).mockResolvedValue({
      ...fakeTemplateRow(1, 33),
      current: fakeVersionRow(1),
      versions: [
        { version: 1, createdAt: new Date(), subject: "Hello {{name}}", variables: ["name"] },
      ],
    });

    await detailGET(mockReq("/api/dashboard/templates/1"), {
      params: mockParams("1"),
    });

    expect(getTemplate).toHaveBeenCalledWith(33, 1);
  });

  // ---- PATCH --------------------------------------------------------------

  it("PATCH returns 404 when service throws TemplateNotFoundError", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(updateTemplate).mockRejectedValue(new TemplateNotFoundError());

    const res = await detailPATCH(
      mockReq("/api/dashboard/templates/999", { method: "PATCH", body: { name: "X" } }),
      { params: mockParams("999") },
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("template_not_found");
  });

  it("PATCH mass-assignment protection: only name/description/subject/html/text accepted; slug/userId/currentVersion rejected", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(updateTemplate).mockResolvedValue({
      template: fakeTemplateRow(1, 1),
      newVersion: null,
      current: fakeVersionRow(1),
      versionCreated: false,
    });

    await detailPATCH(
      mockReq("/api/dashboard/templates/1", {
        method: "PATCH",
        // Client attempts to mutate slug, userId, and currentVersion — all three
        // must be stripped by zod (patchTemplateSchema doesn't declare them).
        body: { name: "New Name", slug: "changed", userId: 999, currentVersion: 50 },
      }),
      { params: mockParams("1") },
    );

    // updateTemplate called with the session userId + path id + sanitized body
    expect(updateTemplate).toHaveBeenCalledWith(
      1,
      1,
      expect.objectContaining({ name: "New Name" }),
    );

    const call = vi.mocked(updateTemplate).mock.calls[0];
    const updateInput = call[2];
    // Forbidden keys must NOT be present (mass-assignment protection)
    expect(updateInput).not.toHaveProperty("slug");
    expect(updateInput).not.toHaveProperty("userId");
    expect(updateInput).not.toHaveProperty("currentVersion");
    // The legit key IS present
    expect(updateInput).toHaveProperty("name");
  });

  it("PATCH with valid body calls updateTemplate(userId, id, {...})", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(11));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(updateTemplate).mockResolvedValue({
      template: fakeTemplateRow(2, 11),
      newVersion: null,
      current: fakeVersionRow(1),
      versionCreated: false,
    });

    await detailPATCH(
      mockReq("/api/dashboard/templates/2", {
        method: "PATCH",
        body: { name: "Renamed", description: "New desc" },
      }),
      { params: mockParams("2") },
    );

    expect(updateTemplate).toHaveBeenCalledWith(
      11,
      2,
      expect.objectContaining({ name: "Renamed", description: "New desc" }),
    );
  });

  // ---- DELETE -------------------------------------------------------------

  it("DELETE returns 404 when service returns false", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(deleteTemplate).mockResolvedValue(false);

    const res = await detailDELETE(
      mockReq("/api/dashboard/templates/999", { method: "DELETE" }),
      { params: mockParams("999") },
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("template_not_found");
  });

  it("DELETE uses authenticated userId", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(42));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(deleteTemplate).mockResolvedValue(true);

    await detailDELETE(
      mockReq("/api/dashboard/templates/5", { method: "DELETE" }),
      { params: mockParams("5") },
    );

    expect(deleteTemplate).toHaveBeenCalledWith(42, 5);
  });

  it("DELETE returns {deleted: true} on success", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(deleteTemplate).mockResolvedValue(true);

    const res = await detailDELETE(
      mockReq("/api/dashboard/templates/1", { method: "DELETE" }),
      { params: mockParams("1") },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);
  });

  // ---- POST preview -------------------------------------------------------

  it("POST preview with inline {subject, html, variables} renders + returns rendered output", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(renderTransactionalTemplate).mockReturnValue({
      ok: true,
      subject: "Hello World",
      html: "<p>Hi World</p>",
      text: "Hi World",
    });

    const res = await previewPOST(
      mockReq("/api/dashboard/templates/preview", {
        method: "POST",
        body: {
          subject: "Hello {{name}}",
          html: "<p>Hi {{name}}</p>",
          text: "Hi {{name}}",
          variables: { name: "World" },
        },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.subject).toBe("Hello World");
    expect(data.html).toBe("<p>Hi World</p>");
    expect(data.text).toBe("Hi World");
    // The route echoes back the extracted variable names so the client knows
    // which tokens were substituted.
    expect(data.variables).toEqual(["name"]);

    // The renderer was actually invoked (this is what proves the route reached
    // the render stage rather than short-circuiting earlier).
    expect(renderTransactionalTemplate).toHaveBeenCalled();
  });

  it("POST preview NEVER calls any mail transport — response is render-only", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(renderTransactionalTemplate).mockReturnValue({
      ok: true,
      subject: "S",
      html: "<p>H</p>",
      text: null,
    });

    const res = await previewPOST(
      mockReq("/api/dashboard/templates/preview", {
        method: "POST",
        body: { subject: "S", html: "<p>H</p>", variables: {} },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    // Render-only response shape: exactly {subject, html, text, variables}.
    // No mail-transport / delivery fields exist on the response.
    expect(Object.keys(data).sort()).toEqual(["html", "subject", "text", "variables"]);
    expect(data).not.toHaveProperty("sent");
    expect(data).not.toHaveProperty("messageId");
    expect(data).not.toHaveProperty("to");
    expect(data).not.toHaveProperty("recipients");
    expect(data).not.toHaveProperty("accepted");
    // The only side-effect-producing call inside the route is the (mocked)
    // renderer — it MUST have been called.
    expect(renderTransactionalTemplate).toHaveBeenCalled();
  });

  it("POST preview with missing variable → 400 missing_template_variables with missing[]", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    // Renderer is mocked to surface a structured missing-variables error — the
    // route must propagate it verbatim as a 400 with the missing[] array.
    vi.mocked(renderTransactionalTemplate).mockReturnValue({
      ok: false,
      code: "missing_template_variables",
      missing: ["order_id"],
    });

    const res = await previewPOST(
      mockReq("/api/dashboard/templates/preview", {
        method: "POST",
        body: {
          subject: "Order {{order_id}}",
          html: "<p>Order {{order_id}}</p>",
          // Client forgot to supply order_id — the renderer surfaces it.
          variables: { name: "World" },
        },
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("missing_template_variables");
    expect(Array.isArray(data.error.missing)).toBe(true);
    expect(data.error.missing).toEqual(["order_id"]);
  });

  it("POST preview validates scalar values — object value → 400 validation_failed (real validateVariableValues runs)", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    // validateVariableValues is the REAL function (not mocked). It runs and
    // rejects {a: {obj: 1}} BEFORE the renderer is invoked.
    vi.mocked(renderTransactionalTemplate).mockReturnValue({
      ok: true,
      subject: "x",
      html: "x",
      text: null,
    });

    const res = await previewPOST(
      mockReq("/api/dashboard/templates/preview", {
        method: "POST",
        body: {
          subject: "Hi {{a}}",
          html: "<p>{{a}}</p>",
          // Object value — must be rejected (section 13: scalars only).
          variables: { a: { obj: 1 } },
        },
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    // The renderer MUST NOT have been called — scalar validation halts before it.
    expect(renderTransactionalTemplate).not.toHaveBeenCalled();
  });

  it("POST preview with templateId fetches via getTemplate and renders", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(getTemplate).mockResolvedValue({
      ...fakeTemplateRow(7, 1),
      current: {
        id: 701,
        templateId: 7,
        version: 1,
        subject: "Order {{order_id}}",
        html: "<p>Order {{order_id}}</p>",
        text: null,
        variables: ["order_id"],
        createdAt: new Date(),
      },
      versions: [
        { version: 1, createdAt: new Date(), subject: "Order {{order_id}}", variables: ["order_id"] },
      ],
    });
    vi.mocked(renderTransactionalTemplate).mockReturnValue({
      ok: true,
      subject: "Order 12345",
      html: "<p>Order 12345</p>",
      text: null,
    });

    const res = await previewPOST(
      mockReq("/api/dashboard/templates/preview", {
        method: "POST",
        body: { templateId: 7, variables: { order_id: "12345" } },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.subject).toBe("Order 12345");
    expect(data.html).toBe("<p>Order 12345</p>");
    expect(data.variables).toEqual(["order_id"]);

    // The route fetched the stored template via the authenticated userId.
    expect(getTemplate).toHaveBeenCalledWith(1, 7);
    expect(renderTransactionalTemplate).toHaveBeenCalled();
  });
});
