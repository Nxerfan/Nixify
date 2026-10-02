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
