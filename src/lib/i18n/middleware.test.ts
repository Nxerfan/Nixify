/**
 * Phase 12 audit — real runtime middleware regression tests.
 *
 * Executes the ACTUAL exported `middleware` function with REAL `NextRequest`
 * instances from `next/server`. No hand-built request stubs, no `as any`
 * casts on the request object. Authentication dependencies (verifySession,
 * jwtVerify) remain mocked because we are testing middleware routing/locale
 * behavior, not JWT verification.
 *
 * NextResponse.next({ request: { headers } }) communicates the modified
 * request headers via response headers:
 *   x-middleware-override-headers: comma-separated list of header names
 *   x-middleware-request-<name>: <value>  for each modified header
 *
 * We inspect these to verify the locale header was set/deleted correctly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/jwt", () => ({
  verifySession: vi.fn(),
  SESSION_COOKIE: "mg_session",
}));

vi.mock("jose", () => ({
  jwtVerify: vi.fn().mockResolvedValue({ payload: { role: "user" } }),
}));

import { middleware } from "@/middleware";
import { verifySession } from "@/lib/auth/jwt";
import { jwtVerify } from "jose";

const mockedVerifySession = vi.mocked(verifySession);
const mockedJwtVerify = vi.mocked(jwtVerify);

/**
 * Build a REAL NextRequest with the given path, locale query param, cookies,
 * and optional spoofed locale header. Uses the actual Next.js 16.3.5
 * NextRequest class — no hand-built stubs.
 */
function makeReq(
  pathname: string,
  opts: {
    locale?: string;
    cookies?: Record<string, string>;
    spoofedLocaleHeader?: string;
  } = {},
): NextRequest {
  const url = new URL(`https://test.nixify.app${pathname}`);
  if (opts.locale) url.searchParams.set("locale", opts.locale);

  const headers: Record<string, string> = {};
  const cookies = opts.cookies ?? {};
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  if (cookieHeader) headers["cookie"] = cookieHeader;
  if (opts.spoofedLocaleHeader) headers["x-nixify-url-locale"] = opts.spoofedLocaleHeader;

  return new NextRequest(url, { method: "GET", headers });
}

/**
 * Extract the controlled locale header from a NextResponse.
 *
 * NextResponse.next({ request: { headers } }) stores modified request headers
 * as response headers:
 *   x-middleware-override-headers: "x-nixify-url-locale,..."
 *   x-middleware-request-x-nixify-url-locale: "fa"
 */
function getLocaleHeader(res: Response): string | null {
  const overrideList = res.headers.get("x-middleware-override-headers") ?? "";
  if (!overrideList.includes("x-nixify-url-locale")) return null;
  return res.headers.get("x-middleware-request-x-nixify-url-locale");
}

describe("middleware — anonymous public pages pass through (BLOCKER #1)", () => {
  beforeEach(() => {
    mockedVerifySession.mockResolvedValue(null);
    mockedJwtVerify.mockResolvedValue({ payload: { role: "user" } } as any);
  });

  const publicPaths = [
    "/",
    "/auth",
    "/login",
    "/signup",
    "/forgot-password",
    "/verify-email",
    "/reset-password",
  ];

  for (const p of publicPaths) {
    it(`anonymous GET ${p} → NOT redirected (pass through)`, async () => {
      const req = makeReq(p);
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  }

  it("anonymous /auth does NOT redirect to itself (no self-redirect loop)", async () => {
    const req = makeReq("/auth");
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("middleware — protected routes require user session (BLOCKER #1)", () => {
  beforeEach(() => {
    mockedVerifySession.mockResolvedValue(null);
  });

  it("anonymous GET /dashboard → redirect to /auth with next=/dashboard", async () => {
    const req = makeReq("/dashboard");
    const res = await middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/\/auth/);
    expect(location).toMatch(/next=%2Fdashboard/);
  });

  it("anonymous GET /dashboard/contacts → redirect", async () => {
    const req = makeReq("/dashboard/contacts");
    const res = await middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location") ?? "").toMatch(/\/auth/);
  });

  it("anonymous GET /profile → redirect", async () => {
    const req = makeReq("/profile");
    const res = await middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location") ?? "").toMatch(/\/auth/);
  });
});

describe("middleware — authenticated user passes through protected routes", () => {
  beforeEach(() => {
    mockedVerifySession.mockResolvedValue({ sub: "123" } as any);
  });

  it("authenticated GET /dashboard → pass through (200)", async () => {
    const req = makeReq("/dashboard", { cookies: { mg_session: "valid" } });
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });
});

describe("middleware — locale header injection (BLOCKER #2)", () => {
  beforeEach(() => {
    mockedVerifySession.mockResolvedValue(null);
  });

  it("anonymous /?locale=fa → pass through + locale header fa", async () => {
    const req = makeReq("/", { locale: "fa" });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(getLocaleHeader(res)).toBe("fa");
  });

  it("anonymous /signup?locale=en → pass through + locale header en", async () => {
    const req = makeReq("/signup", { locale: "en" });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(getLocaleHeader(res)).toBe("en");
  });

  it("spoofed x-nixify-url-locale=fa + URL ?locale=en → overwritten to en", async () => {
    const req = makeReq("/", { locale: "en", spoofedLocaleHeader: "fa" });
    const res = await middleware(req);
    expect(getLocaleHeader(res)).toBe("en");
  });

  it("spoofed x-nixify-url-locale=fa + no URL locale → deleted", async () => {
    const req = makeReq("/", { spoofedLocaleHeader: "fa" });
    const res = await middleware(req);
    expect(getLocaleHeader(res)).toBeNull();
  });

  it("unsupported ?locale=de → no locale header (deleted)", async () => {
    const req = makeReq("/", { locale: "de" });
    const res = await middleware(req);
    expect(getLocaleHeader(res)).toBeNull();
  });

  it("no ?locale param → no locale header", async () => {
    const req = makeReq("/");
    const res = await middleware(req);
    expect(getLocaleHeader(res)).toBeNull();
  });
});

describe("middleware — admin isolation regressions", () => {
  beforeEach(() => {
    mockedVerifySession.mockResolvedValue(null);
    mockedJwtVerify.mockResolvedValue({ payload: { role: "user" } } as any);
  });

  it("/admin/login remains public (no redirect)", async () => {
    const req = makeReq("/admin/login");
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("/admin protected path without admin cookie → redirect to /admin/login", async () => {
    const req = makeReq("/admin/analytics");
    const res = await middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location") ?? "").toMatch(/\/admin\/login/);
  });

  it("normal user session alone does NOT grant admin-page access", async () => {
    mockedVerifySession.mockResolvedValue({ sub: "123" } as any);
    mockedJwtVerify.mockResolvedValue({ payload: { role: "user" } } as any);
    const req = makeReq("/admin/analytics", { cookies: { mg_session: "valid" } });
    const res = await middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location") ?? "").toMatch(/\/admin\/login/);
  });
});
