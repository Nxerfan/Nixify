/**
 * Production logger + redaction + error-safety tests.
 *
 * Tests the REAL logger (src/lib/logger.ts) and sanitizer
 * (src/lib/log-sanitizer.ts) — no mock fixtures of the desired strings.
 *
 * Contract under test (from the production-observability stage):
 *   - production logs are structured JSON emitted IMMEDIATELY (no buffer/timer);
 *   - logs exist with NO third-party token (no LOGTAIL_TOKEN, no remote fetch);
 *   - centralized recursive redaction of sensitive keys (nested + arrays);
 *   - Error objects serialize to a bounded safe rep (no err.message, no stack);
 *   - safe Prisma error codes (P1001) may be emitted;
 *   - the logger NEVER throws (circular refs, BigInt, throwing getters);
 *   - the SAME redaction contract applies in development.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Capture stdout/stderr writes so we can assert on emitted JSON lines.
// Returns a release function: calling it restores the original write and
// returns the captured lines.
function captureStream(stream: NodeJS.WriteStream): () => string[] {
  const lines: string[] = [];
  const original = stream.write.bind(stream) as (chunk: unknown, ...rest: unknown[]) => boolean;
  stream.write = ((chunk: unknown, ...rest: unknown[]) => {
    const s = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
    s.split("\n").forEach((l) => l.trim() && lines.push(l));
    return original(chunk, ...rest);
  }) as typeof stream.write;
  return () => {
    stream.write = original as typeof stream.write;
    return lines;
  };
}

describe("production logger", () => {
  let prevNodeEnv: string | undefined;

  beforeEach(() => {
    prevNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.LOGTAIL_TOKEN;
    vi.resetModules();
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
    vi.restoreAllMocks();
  });

  it("emits structured JSON to stdout/stderr IMMEDIATELY (no buffer, no timer)", async () => {
    const release = captureStream(process.stdout);
    const { logger } = await import("@/lib/logger");
    logger.info("test_event", { requestId: "req_123" });
    const out = release();
    expect(out.length).toBeGreaterThanOrEqual(1);
    const entry = JSON.parse(out[out.length - 1]);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("test_event");
    expect(entry.service).toBe("nixify");
    expect(entry.environment).toBe("production");
    expect(entry.requestId).toBe("req_123");
    expect(entry.timestamp).toBeTruthy();
  });

  it("emits error/warn to stderr; info/debug to stdout", async () => {
    const releaseErr = captureStream(process.stderr);
    const releaseOut = captureStream(process.stdout);
    const { logger } = await import("@/lib/logger");
    logger.error("err_event");
    logger.warn("warn_event");
    logger.info("info_event");
    const errLines = releaseErr();
    const outLines = releaseOut();
    expect(errLines.length).toBeGreaterThanOrEqual(2); // error + warn
    expect(outLines.length).toBeGreaterThanOrEqual(1); // info
  });

  it("still emits when no LOGTAIL_TOKEN exists (no third-party token required)", async () => {
    expect(process.env.LOGTAIL_TOKEN).toBeUndefined();
    const release = captureStream(process.stdout);
    const { logger } = await import("@/lib/logger");
    logger.info("no_token_event", { requestId: "req_456" });
    const out = release();
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(out[out.length - 1]).message).toBe("no_token_event");
  });

  it("does not make a remote fetch as a prerequisite for logging", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const release = captureStream(process.stdout);
    const { logger } = await import("@/lib/logger");
    logger.info("no_fetch_event", { requestId: "req_789" });
    const out = release();
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not require a timer flush (logs appear synchronously, no 5s wait)", async () => {
    const release = captureStream(process.stdout);
    const { logger } = await import("@/lib/logger");
    logger.info("immediate_event");
    const out = release();
    expect(out.some((l) => l.includes("immediate_event"))).toBe(true);
  });

  it("preserves requestId through the log entry", async () => {
    const release = captureStream(process.stdout);
    const { logger } = await import("@/lib/logger");
    logger.info("correlated", { requestId: "req_corr_abc" });
    const out = release();
    const entry = JSON.parse(out[out.length - 1]);
    expect(entry.requestId).toBe("req_corr_abc");
  });
});

// ---- Canonical-field integrity (observability stage follow-up) -----------
//
// Caller metadata MUST NOT be able to overwrite the logger's canonical fields:
// level, message, timestamp, service, environment. This is enforced
// structurally (canonical fields written LAST + stripped from metadata), not
// through caller discipline.

describe("canonical-field integrity (metadata cannot override canonical fields)", () => {
  let prevNodeEnv: string | undefined;

  beforeEach(() => {
    prevNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    vi.resetModules();
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
    vi.restoreAllMocks();
  });

  it("metadata cannot override `level`", async () => {
    const release = captureStream(process.stderr);
    const { logger } = await import("@/lib/logger");
    logger.error("real_error", { level: "info" });
    const out = release();
    const entry = JSON.parse(out[out.length - 1]);
    expect(entry.level).toBe("error");
    expect(entry.level).not.toBe("info");
  });

  it("metadata cannot override `message`", async () => {
    const release = captureStream(process.stderr);
    const { logger } = await import("@/lib/logger");
    logger.error("real_error", { message: "spoofed" });
    const out = release();
    const entry = JSON.parse(out[out.length - 1]);
    expect(entry.message).toBe("real_error");
    expect(entry.message).not.toBe("spoofed");
  });

  it("metadata cannot override `service`", async () => {
    const release = captureStream(process.stderr);
    const { logger } = await import("@/lib/logger");
    logger.error("real_error", { service: "other" });
    const out = release();
    const entry = JSON.parse(out[out.length - 1]);
    expect(entry.service).toBe("nixify");
    expect(entry.service).not.toBe("other");
  });

  it("metadata cannot override `environment`", async () => {
    const release = captureStream(process.stderr);
    const { logger } = await import("@/lib/logger");
    logger.error("real_error", { environment: "development" });
    const out = release();
    const entry = JSON.parse(out[out.length - 1]);
    expect(entry.environment).toBe("production");
    expect(entry.environment).not.toBe("development");
  });

  it("metadata cannot override `timestamp`", async () => {
    const release = captureStream(process.stderr);
    const { logger } = await import("@/lib/logger");
    const before = new Date().toISOString();
    logger.error("real_error", { timestamp: "1970-01-01T00:00:00.000Z" });
    const after = new Date().toISOString();
    const out = release();
    const entry = JSON.parse(out[out.length - 1]);
    expect(entry.timestamp).not.toBe("1970-01-01T00:00:00.000Z");
    // The timestamp must be a valid ISO string within the call window.
    const ts = new Date(entry.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(new Date(before).getTime());
    expect(ts).toBeLessThanOrEqual(new Date(after).getTime() + 1000);
  });

  it("logger.error() remains on stderr even if metadata contains level: 'info'", async () => {
    const releaseErr = captureStream(process.stderr);
    const releaseOut = captureStream(process.stdout);
    const { logger } = await import("@/lib/logger");
    logger.error("real_error", { level: "info" });
    const errLines = releaseErr();
    const outLines = releaseOut();
    // The error line must be on STDERR (not stdout), despite level:"info" in metadata.
    expect(errLines.some((l) => l.includes("real_error"))).toBe(true);
    expect(outLines.some((l) => l.includes("real_error"))).toBe(false);
  });

  it("all five canonical fields preserved together in one spoofing attempt", async () => {
    const release = captureStream(process.stderr);
    const { logger } = await import("@/lib/logger");
    logger.error("real_error", {
      level: "info",
      message: "spoofed",
      service: "other",
      environment: "development",
      timestamp: "1970-01-01T00:00:00.000Z",
    });
    const out = release();
    const entry = JSON.parse(out[out.length - 1]);
    expect(entry.level).toBe("error");
    expect(entry.message).toBe("real_error");
    expect(entry.service).toBe("nixify");
    expect(entry.environment).toBe("production");
    expect(entry.timestamp).not.toBe("1970-01-01T00:00:00.000Z");
  });
});

describe("redaction contract (production + development share the same contract)", () => {
  let prevNodeEnv: string | undefined;

  beforeEach(() => {
    prevNodeEnv = process.env.NODE_ENV;
    vi.resetModules();
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
    vi.restoreAllMocks();
  });

  const SENSITIVE_PAYLOAD = {
    authorization: "Bearer mg_live_secret_key_123",
    apiKey: "mg_live_secret_key_123",
    api_key: "mg_live_secret_key_123",
    password: "hunter2",
    secret: "topsecret",
    token: "tok_abc",
    accessToken: "access_xyz",
    refreshToken: "refresh_xyz",
    jwt: "eyJhbGci.payload.sig",
    otp: "123456",
    code: "123456",
    cookie: "session=abc123; csrf=def456",
    smtpPass: "gmail-app-password",
    databaseUrl: "postgresql://user:pass@host:5432/db",
    DATABASE_URL: "postgresql://user:pass@host:5432/db",
  };

  /** Log the payload in production mode and return the parsed entry. */
  async function logAndCapture(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const lines: string[] = [];
    const release = captureStream(process.stdout);
    const { logger } = await import("@/lib/logger");
    logger.info("redaction_probe", payload);
    const out = release();
    return JSON.parse(out[out.length - 1]);
  }

  it("redacts authorization", async () => {
    const entry = await logAndCapture({ authorization: SENSITIVE_PAYLOAD.authorization });
    expect(entry.authorization).toBe("[REDACTED]");
  });

  it("redacts apiKey and api_key", async () => {
    const entry = await logAndCapture({ apiKey: "x", api_key: "y" });
    expect(entry.apiKey).toBe("[REDACTED]");
    expect(entry.api_key).toBe("[REDACTED]");
  });

  it("redacts password", async () => {
    const entry = await logAndCapture({ password: "hunter2" });
    expect(entry.password).toBe("[REDACTED]");
  });

  it("redacts jwt/token/accessToken/refreshToken", async () => {
    const entry = await logAndCapture({ jwt: "j", token: "t", accessToken: "a", refreshToken: "r" });
    expect(entry.jwt).toBe("[REDACTED]");
    expect(entry.token).toBe("[REDACTED]");
    expect(entry.accessToken).toBe("[REDACTED]");
    expect(entry.refreshToken).toBe("[REDACTED]");
  });

  it("redacts otp and code", async () => {
    const entry = await logAndCapture({ otp: "123456", code: "123456" });
    expect(entry.otp).toBe("[REDACTED]");
    expect(entry.code).toBe("[REDACTED]");
  });

  it("redacts cookie", async () => {
    const entry = await logAndCapture({ cookie: "session=abc" });
    expect(entry.cookie).toBe("[REDACTED]");
  });

  it("redacts databaseUrl and DATABASE_URL (case-insensitive)", async () => {
    const entry = await logAndCapture({ databaseUrl: "pg://x", DATABASE_URL: "pg://y" });
    expect(entry.databaseUrl).toBe("[REDACTED]");
    expect(entry.DATABASE_URL).toBe("[REDACTED]");
  });

  it("redacts smtpPass", async () => {
    const entry = await logAndCapture({ smtpPass: "gmail-app-password" });
    expect(entry.smtpPass).toBe("[REDACTED]");
  });

  it("redacts nested secrets (recursive)", async () => {
    const entry = await logAndCapture({
      outer: { password: "nested_secret", safe: "keep_me" },
      deep: { level: { apiKey: "deep_key", n: 1 } },
    });
    const outer = entry.outer as Record<string, unknown>;
    const deep = entry.deep as Record<string, unknown>;
    const deepLevel = deep.level as Record<string, unknown>;
    expect(outer.password).toBe("[REDACTED]");
    expect(outer.safe).toBe("keep_me");
    expect(deepLevel.apiKey).toBe("[REDACTED]");
    expect(deepLevel.n).toBe(1);
  });

  it("redacts arrays containing sensitive objects", async () => {
    const entry = await logAndCapture({
      items: [
        { id: 1, password: "arr_secret" },
        { id: 2, token: "arr_tok" },
      ],
    });
    const items = entry.items as Array<Record<string, unknown>>;
    expect(items[0].password).toBe("[REDACTED]");
    expect(items[0].id).toBe(1);
    expect(items[1].token).toBe("[REDACTED]");
    expect(items[1].id).toBe(2);
  });

  it("preserves unrelated safe metadata", async () => {
    const entry = await logAndCapture({
      userId: "usr_123",
      requestId: "req_abc",
      otp_request_id: "otp_xyz",
      durationMs: 42,
      method: "POST",
    });
    expect(entry.userId).toBe("usr_123");
    expect(entry.requestId).toBe("req_abc");
    expect(entry.otp_request_id).toBe("otp_xyz");
    expect(entry.durationMs).toBe(42);
    expect(entry.method).toBe("POST");
  });

  it("the SAME redaction contract applies in development", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    const lines: string[] = [];
    const origLog = console.log;
    console.log = ((...args: unknown[]) => { lines.push(args.map(String).join(" ")); }) as typeof console.log;
    try {
      const { logger } = await import("@/lib/logger");
      logger.info("dev_probe", { password: "dev_secret", safe: "ok" });
    } finally {
      console.log = origLog;
    }
    const out = lines.join("\n");
    expect(out).not.toContain("dev_secret");
    expect(out).toContain("[REDACTED]");
    expect(out).toContain("ok");
  });
});

describe("error serialization contract", () => {
  let prevNodeEnv: string | undefined;

  beforeEach(() => {
    prevNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    vi.resetModules();
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
    vi.restoreAllMocks();
  });

  /** Log an error and capture stderr (errors emit to stderr in production). */
  async function logErrAndCapture(message: string, meta: Record<string, unknown>): Promise<{ lines: string[]; entry: Record<string, unknown> }> {
    const release = captureStream(process.stderr);
    const { logger } = await import("@/lib/logger");
    logger.error(message, meta);
    const lines = release();
    const entry = JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
    return { lines, entry };
  }

  /** Cast the `error` field of a log entry to the SafeErrorRep shape. */
  function errOf(entry: Record<string, unknown>): Record<string, unknown> {
    return (entry.error as Record<string, unknown>) ?? {};
  }

  it("does NOT automatically emit raw err.message", async () => {
    const sensitiveErr = new Error("Can't reach database server at `ep-cool-dawn-12345.us-east-2.aws.neon.tech:5432`: password='hunter2'");
    const { lines, entry } = await logErrAndCapture("db_error_event", { error: sensitiveErr });
    const serialized = lines.join("\n");
    expect(serialized).not.toContain("ep-cool-dawn-12345");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("Can't reach database server");
    const e = errOf(entry);
    expect(e.name).toBe("Error");
    expect(e.diagnostic).toBeTruthy();
    expect(e.message).toBeUndefined();
    expect(e.stack).toBeUndefined();
  });

  it("does NOT emit a stack trace", async () => {
    const err = new Error("boom");
    err.stack = "Error: boom\n    at foo (/path/file.ts:1:1)\n    at bar (/path/other.ts:2:2)";
    const { lines } = await logErrAndCapture("stack_probe", { error: err });
    const serialized = lines.join("\n");
    expect(serialized).not.toContain("at foo");
    expect(serialized).not.toContain("/path/file.ts");
    expect(serialized).not.toContain("/path/other.ts");
  });

  it("may emit a known-safe Prisma error code (P1001)", async () => {
    const prismaErr = Object.assign(new Error("hidden details P1001"), { code: "P1001" });
    const { lines, entry } = await logErrAndCapture("prisma_probe", { error: prismaErr });
    const e = errOf(entry);
    expect(e.prismaCode).toBe("P1001");
    expect(e.message).toBeUndefined();
    expect(lines.join("\n")).not.toContain("hidden details");
  });

  it("does NOT emit raw DB hostname/username/password via a Prisma error", async () => {
    const prismaErr = Object.assign(
      new Error("Can't reach database server at `ep-secret-host.neon.tech:5432` (user='admin', password='p4ss')"),
      { code: "P1001" },
    );
    const { lines, entry } = await logErrAndCapture("prisma_leak_probe", { error: prismaErr });
    const serialized = lines.join("\n");
    expect(serialized).not.toContain("ep-secret-host");
    expect(serialized).not.toContain("p4ss");
    expect(serialized).not.toContain("admin");
    const e = errOf(entry);
    expect(e.prismaCode).toBe("P1001");
    expect(e.diagnostic).toBe("database_unreachable");
  });

  it("logger never throws on circular metadata", async () => {
    const release = captureStream(process.stderr);
    const { logger } = await import("@/lib/logger");
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(() => logger.error("circular_probe", { data: circular })).not.toThrow();
    const out = release();
    const entry = JSON.parse(out[out.length - 1]);
    expect(entry.data.self).toBe("[circular]");
    expect(entry.data.a).toBe(1);
  });

  it("logger never throws on BigInt", async () => {
    const release = captureStream(process.stderr);
    const { logger } = await import("@/lib/logger");
    // Use a BigInt constructed from a string to avoid number-literal precision loss.
    const bigPayload = { count: BigInt("9007199254740993"), safe: "ok" };
    expect(() => logger.error("bigint_probe", bigPayload)).not.toThrow();
    const out = release();
    const entry = JSON.parse(out[out.length - 1]);
    expect(entry.count).toBe("9007199254740993n");
    expect(entry.safe).toBe("ok");
  });

  it("logger never throws on throwing getters", async () => {
    const release = captureStream(process.stderr);
    const { logger } = await import("@/lib/logger");
    const evil: Record<string, unknown> = {};
    Object.defineProperty(evil, "boom", {
      get() { throw new Error("getter explosion"); },
      enumerable: true,
    });
    expect(() => logger.error("getter_probe", { obj: evil })).not.toThrow();
    const out = release();
    const entry = JSON.parse(out[out.length - 1]);
    expect(entry.obj.boom).toBe("[throwing_getter]");
  });

  it("logging never breaks caller execution", async () => {
    const { logger } = await import("@/lib/logger");
    let reached = false;
    // Even if the caller constructs unsafe metadata, the logger must not throw.
    try {
      logger.error("caller_safety", { weird: Symbol("hidden") });
    } catch {
      // must not reach here
    }
    try {
      logger.error("safe_after_unsafe");
      reached = true;
    } catch {
      reached = false;
    }
    expect(reached).toBe(true);
  });
});

// ---- Corrected error classification (observability stage follow-up) -------
//
// Generic application errors MUST NOT be mislabeled as database_error merely
// because they are Error instances. DB classification applies only when there
// is DB evidence (P1001, ECONNREFUSED, etc.) OR the call site explicitly
// passes a DB-context fallback (e.g. /api/health, RequestLog persistence).

describe("error classification matrix", () => {
  it("P1001 → database_unreachable", async () => {
    const { safeErrorRep } = await import("@/lib/log-sanitizer");
    const err = Object.assign(new Error("hidden P1001 details"), { code: "P1001" });
    const rep = safeErrorRep(err);
    expect(rep.diagnostic).toBe("database_unreachable");
    expect(rep.prismaCode).toBe("P1001");
  });

  it("AbortError / timeout → timeout", async () => {
    const { safeErrorRep } = await import("@/lib/log-sanitizer");
    const err = new Error("aborted");
    err.name = "AbortError";
    const rep = safeErrorRep(err);
    expect(rep.diagnostic).toBe("timeout");
  });

  it("TypeError is NOT database_error (bounded non-database category)", async () => {
    const { safeErrorRep } = await import("@/lib/log-sanitizer");
    const err = new TypeError("cannot read properties of undefined");
    const rep = safeErrorRep(err);
    expect(rep.diagnostic).not.toBe("database_error");
    expect(rep.diagnostic).not.toBe("database_unreachable");
    expect(rep.diagnostic).not.toBe("database_connection_failed");
    expect(rep.diagnostic).not.toBe("database_auth_failed");
    // TypeError should classify as a bounded typeerror category.
    expect(rep.diagnostic).toMatch(/type/i);
  });

  it("ordinary new Error('boom') → generic 'error', NOT database_error", async () => {
    const { safeErrorRep } = await import("@/lib/log-sanitizer");
    const err = new Error("boom");
    const rep = safeErrorRep(err);
    expect(rep.diagnostic).toBe("error");
    expect(rep.diagnostic).not.toBe("database_error");
  });

  it("network-style error → network_error where deterministically identifiable", async () => {
    const { safeErrorRep } = await import("@/lib/log-sanitizer");
    // A TypeError-like with a fetch/connection name pattern. classifyError
    // checks the constructor name; a custom NetworkError class name triggers it.
    class NetworkError extends Error {
      constructor(msg: string) { super(msg); this.name = "NetworkError"; }
    }
    const err = new NetworkError("fetch failed");
    const rep = safeErrorRep(err);
    expect(rep.diagnostic).toBe("network_error");
  });

  it("generic application errors are NOT mislabeled as database_error (no DB evidence, no DB fallback)", async () => {
    const { safeErrorRep } = await import("@/lib/log-sanitizer");
    // A plain Error with no .code, no DB-related message text.
    const rep = safeErrorRep(new Error("something went wrong in the app layer"));
    expect(rep.diagnostic).not.toBe("database_error");
    expect(rep.diagnostic).not.toBe("database_unreachable");
    expect(rep.diagnostic).not.toBe("database_connection_failed");
    expect(rep.diagnostic).not.toBe("database_auth_failed");
  });

  it("DB call site fallback: unclassified DB-context error → database_error", async () => {
    const { safeErrorRep } = await import("@/lib/log-sanitizer");
    // A plain Error (no P1001, no ECONNREFUSED) — but the call site KNOWS it's
    // a DB operation (e.g. /api/health's SELECT 1 failed with a weird error).
    // The explicit "database_error" fallback applies.
    const rep = safeErrorRep(new Error("weird db failure"), "database_error");
    expect(rep.diagnostic).toBe("database_error");
  });

  it("DB evidence (P1001) wins over a DB call site fallback", async () => {
    const { safeErrorRep } = await import("@/lib/log-sanitizer");
    // P1001 evidence must classify as database_unreachable, NOT the fallback.
    const err = Object.assign(new Error("hidden P1001"), { code: "P1001" });
    const rep = safeErrorRep(err, "database_error");
    expect(rep.diagnostic).toBe("database_unreachable");
    expect(rep.prismaCode).toBe("P1001");
  });

  it("raw err.message is never present in the SafeErrorRep", async () => {
    const { safeErrorRep } = await import("@/lib/log-sanitizer");
    const sensitiveErr = new Error("host=ep-secret.neon.tech password=hunter2");
    const rep = safeErrorRep(sensitiveErr) as unknown as Record<string, unknown>;
    const serialized = JSON.stringify(rep);
    expect(serialized).not.toContain("ep-secret.neon.tech");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("host=ep-secret");
    expect(rep.message).toBeUndefined();
    expect(rep.stack).toBeUndefined();
  });
});

// ---- Health-route DB-context classification regression --------------------
//
// /api/health and /api/readyz are known DB operations. An unclassified failure
// there MUST still safely become database_error (the PR #43 contract is
// preserved). This is tested via the shared sanitizer's behavior at those call
// sites (they pass "database_error" as the explicit fallback).

describe("health-route DB-context classification (preserved)", () => {
  it("unknown DB failure at /api/health still becomes database_error", async () => {
    const { safeErrorRep, safeDbDiagnostic } = await import("@/lib/log-sanitizer");
    // An unclassified DB error (no P1001, no ECONNREFUSED) — safeDbDiagnostic
    // returns undefined, but the health route's `?? "database_error"` fallback
    // applies, mirroring the real /api/health code path.
    const weird = new Error("some unclassified DB failure");
    const dbDiag = safeDbDiagnostic(weird);
    expect(dbDiag).toBeUndefined();
    const fallback = dbDiag ?? "database_error";
    const rep = safeErrorRep(weird, fallback);
    expect(rep.diagnostic).toBe("database_error");
  });

  it("P1001 at /api/health remains database_unreachable (DB evidence wins)", async () => {
    const { safeErrorRep, safeDbDiagnostic } = await import("@/lib/log-sanitizer");
    const err = Object.assign(new Error("hidden P1001"), { code: "P1001" });
    const dbDiag = safeDbDiagnostic(err);
    expect(dbDiag).toBe("database_unreachable");
    const fallback = dbDiag ?? "database_error";
    const rep = safeErrorRep(err, fallback);
    expect(rep.diagnostic).toBe("database_unreachable");
    expect(rep.prismaCode).toBe("P1001");
  });
});

describe("logger has no bespoke Logtail/Axiom shipper", () => {
  it("does not reference the vendor endpoint, token env var, or shipper function in the real source", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(resolve(process.cwd(), "src/lib/logger.ts"), "utf-8");
    // No vendor endpoint URL, no vendor token env var, no shipper function.
    expect(src).not.toMatch(/in\.logtail\.com/);
    expect(src).not.toMatch(/LOGTAIL_TOKEN/);
    expect(src).not.toMatch(/shipToLogtail/);
    // No active fetch() to a remote logging endpoint (the runtime captures
    // stdout/stderr instead). A `fetch` import for OTHER purposes is fine,
    // but there must be no fetch() call inside the logger module.
    expect(src).not.toMatch(/await fetch\(/);
    expect(src).not.toMatch(/\bfetch\(.*in\.logtail/);
  });
});
