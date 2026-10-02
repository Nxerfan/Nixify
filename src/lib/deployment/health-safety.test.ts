/**
 * Health endpoint safety tests.
 *
 * Verifies the public health responses use bounded, safe diagnostics and never
 * leak raw internal exception text (hostnames, connection-string fragments,
 * Prisma internals, credential-adjacent text).
 *
 * Also verifies the distinct semantics of each endpoint:
 *   - /api/healthz   → process liveness (no DB)
 *   - /api/readyz   → DB readiness (SELECT 1)
 *   - /api/health   → application/service health (DB + SMTP config + Redis)
 *
 * These tests mock the Prisma client `db.$queryRaw` so they run without a real
 * database. They exercise the REAL route handlers (not a duplicate).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the db module so $queryRaw can be made to throw a realistic Prisma-like
// error without needing a real database.
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}));

// Mock the logger so tests can assert it received the full error server-side
// (without the response containing it).
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

import { GET as healthGET } from "@/app/api/health/route";
import { GET as healthzGET } from "@/app/api/healthz/route";
import { GET as readyzGET } from "@/app/api/readyz/route";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/** A realistic Prisma connection error carrying sensitive context. */
const SENSITIVE_DB_ERROR = Object.assign(
  new Error(
    "Can't reach database server at `ep-cool-dawn-12345.us-east-2.aws.neon.tech:5432`: " +
      "connection refused (password='hunter2', user='nixify_owner')",
  ),
  { code: "P1001" },
);

describe("health endpoint semantics", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ─── /api/healthz — process liveness (no DB) ───────────────────────────

  describe("GET /api/healthz", () => {
    it("returns 200 with status ok (process liveness, no DB contact)", async () => {
      const res = await healthzGET();
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.status ?? body.data?.status).toBe("ok");
      // It must NOT have queried the database.
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // ─── /api/readyz — DB readiness ─────────────────────────────────────────

  describe("GET /api/readyz", () => {
    it("returns 200 with database: ok when SELECT 1 succeeds", async () => {
      (db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ "?column?": 1 }]);
      const res = await readyzGET();
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.data?.database ?? body.database).toBe("ok");
    });

    it("returns 503 when the DB is unreachable, WITHOUT leaking the raw error (response OR log)", async () => {
      // Spy on console.error so we can assert the readyz LOG output is also
      // bounded — no raw hostname/username/password.
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      (db.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValueOnce(SENSITIVE_DB_ERROR);
      const res = await readyzGET();
      expect(res.status).toBe(503);
      const body = await res.json();
      const serialized = JSON.stringify(body);
      // The raw error message (which contains host + credential fragments)
      // must NOT appear in the public response.
      expect(serialized).not.toContain("ep-cool-dawn-12345");
      expect(serialized).not.toContain("hunter2");
      expect(serialized).not.toContain("nixify_owner");
      expect(serialized).not.toContain("connection refused");

      // The readyz LOG output must also be bounded — no raw exception data.
      const logOutput = errSpy.mock.calls.map((c) => JSON.stringify(c)).join("\n");
      expect(logOutput, "host must not be logged by readyz").not.toContain("ep-cool-dawn-12345");
      expect(logOutput, "password must not be logged by readyz").not.toContain("hunter2");
      expect(logOutput, "username must not be logged by readyz").not.toContain("nixify_owner");
      expect(logOutput, "raw 'connection refused' must not be logged by readyz").not.toContain("connection refused");
      expect(logOutput, "raw err.message must not be logged by readyz").not.toContain("Can't reach database server");
      // The bounded diagnostic category MUST be logged.
      expect(logOutput).toMatch(/database_auth_failed|database_unreachable|database_connection_failed|database_error/);
      errSpy.mockRestore();
    });
  });

  // ─── /api/health — application/service health (security: no leak) ──────

  describe("GET /api/health", () => {
    it("does NOT leak raw DB exception text in the public response", async () => {
      (db.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValueOnce(SENSITIVE_DB_ERROR);
      process.env.SMTP_USER = "set";
      process.env.SMTP_PASS = "set";

      const res = await healthGET();
      expect(res.status).toBe(503); // DB down → 503
      const body = await res.json();

      // The public response must use a bounded diagnostic category, NOT the
      // raw exception message.
      const serialized = JSON.stringify(body);
      expect(serialized, "host must not leak").not.toContain("ep-cool-dawn-12345");
      expect(serialized, "password must not leak").not.toContain("hunter2");
      expect(serialized, "username must not leak").not.toContain("nixify_owner");
      expect(serialized, "raw 'connection refused' must not leak").not.toContain("connection refused");

      // The DB service status must be "down" with a bounded detail.
      const dbStatus = body.data?.services?.database;
      expect(dbStatus?.status).toBe("down");
      // The detail must be one of the safe bounded categories — never the raw
      // error string.
      expect(["database_unreachable", "database_connection_failed", "database_auth_failed", "database_error"]).toContain(dbStatus?.detail);
    });

    it("does NOT ship raw DB exception data through the application logger", async () => {
      // The production logger forwards metadata to a remote logging provider,
      // so raw DB exception text (hostname, username, password, connection
      // fragments) MUST NOT appear in logger metadata either — only bounded
      // operational metadata (diagnostic category, optional safe Prisma code,
      // component/route identifiers).
      (db.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValueOnce(SENSITIVE_DB_ERROR);
      process.env.SMTP_USER = "set";
      process.env.SMTP_PASS = "set";

      await healthGET();
      expect(logger.error).toHaveBeenCalledTimes(1);
      const [message, meta] = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(message).toBe("Health: DB down");
      const metaStr = JSON.stringify(meta);

      // Sensitive fragments from the raw exception MUST NOT be in the logger
      // metadata. This test FAILS if someone later restores raw err.message
      // logging.
      expect(metaStr, "host must not be logged").not.toContain("ep-cool-dawn-12345");
      expect(metaStr, "password must not be logged").not.toContain("hunter2");
      expect(metaStr, "username must not be logged").not.toContain("nixify_owner");
      expect(metaStr, "raw 'connection refused' must not be logged").not.toContain("connection refused");
      expect(metaStr, "raw err.message must not be logged").not.toContain("Can't reach database server");

      // The safe diagnostic category MUST be present in the logger metadata.
      const metaObj = meta as Record<string, unknown>;
      expect(metaObj.diagnostic).toBeDefined();
      expect([
        "database_unreachable",
        "database_connection_failed",
        "database_auth_failed",
        "database_error",
      ]).toContain(metaObj.diagnostic);

      // The logger metadata MUST NOT carry a generic `error` field containing
      // the raw message (the old contract shipped err.message under `error`).
      expect(metaObj.error, "raw `error` field must be absent from logger metadata").toBeUndefined();
      expect(metaObj.stack, "stack trace must be absent from logger metadata").toBeUndefined();

      // Component/route identifiers are safe to log.
      expect(metaObj.component).toBe("health");
      expect(metaObj.route).toBe("/api/health");
    });

    it("SMTP check is config-presence only (no SMTP transaction)", async () => {
      (db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ "?column?": 1 }]);
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const res = await healthGET();
      const body = await res.json();
      const smtpStatus = body.data?.services?.smtp;
      expect(smtpStatus?.status).toBe("degraded");
      // Config-presence check only — there is no smtp "transaction" field.
      expect(JSON.stringify(body)).not.toMatch(/smtp.*transaction|transaction.*smtp/i);
    });
  });
});
