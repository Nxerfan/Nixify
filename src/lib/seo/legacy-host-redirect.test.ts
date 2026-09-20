/**
 * Regression tests for the legacy-host redirect (Post-Roadmap B).
 *
 * The canonical production origin is https://nixify.ir. Requests that arrive
 * on the EXACT legacy host `nixify.vercel.app` must permanently redirect (308)
 * to https://nixify.ir, preserving pathname and query string. Other *.vercel.app
 * hosts (preview deployments) must NOT redirect.
 *
 * Covers ALL route types including /api/*, /robots.txt, /sitemap.xml, and
 * /unsubscribe/* (the matcher was expanded to cover these).
 *
 * Uses the REAL middleware function + REAL NextRequest instances.
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

const mockedVerifySession = vi.mocked(verifySession);

beforeEach(() => {
  mockedVerifySession.mockResolvedValue(null);
});

/**
 * Build a REAL NextRequest with an explicit Host header.
 *
 * NextRequest doesn't expose a direct way to set the Host header via the URL,
 * so we pass it via the `headers` option. The middleware reads
 * `req.headers.get("host")`.
 */
function makeReq(
  host: string,
  pathname: string,
  search = "",
  method: "GET" | "POST" = "GET",
): NextRequest {
  const url = new URL(`https://${host}${pathname}${search}`);
  return new NextRequest(url, { method, headers: { host } });
}

describe("legacy-host redirect — nixify.vercel.app → nixify.ir", () => {
  it("redirects the legacy host on a public page (GET)", async () => {
    const req = makeReq("nixify.vercel.app", "/docs");
    const res = await middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://nixify.ir/docs");
  });

  it("preserves pathname and query string", async () => {
    const req = makeReq(
      "nixify.vercel.app",
      "/docs",
      "?foo=bar&baz=qux",
    );
    const res = await middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(
      "https://nixify.ir/docs?foo=bar&baz=qux",
    );
  });

  it("redirects POST requests (308 preserves method)", async () => {
    const req = makeReq("nixify.vercel.app", "/api/v1/otp/send", "", "POST");
    const res = await middleware(req);
    expect(res.status).toBe(308);
    // 308 is the correct status for preserving POST → POST.
    expect(res.headers.get("location")).toBe(
      "https://nixify.ir/api/v1/otp/send",
    );
  });

  it("redirects /api/* routes on the legacy host", async () => {
    const req = makeReq("nixify.vercel.app", "/api/v1/otp/verify", "", "POST");
    const res = await middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(
      "https://nixify.ir/api/v1/otp/verify",
    );
  });

  it("redirects /robots.txt on the legacy host", async () => {
    const req = makeReq("nixify.vercel.app", "/robots.txt");
    const res = await middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://nixify.ir/robots.txt");
  });

  it("redirects /sitemap.xml on the legacy host", async () => {
    const req = makeReq("nixify.vercel.app", "/sitemap.xml");
    const res = await middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://nixify.ir/sitemap.xml");
  });

  it("redirects /unsubscribe/* routes on the legacy host", async () => {
    const req = makeReq(
      "nixify.vercel.app",
      "/unsubscribe/abc123",
      "",
      "POST",
    );
    const res = await middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(
      "https://nixify.ir/unsubscribe/abc123",
    );
  });

  it("redirects the root path on the legacy host", async () => {
    const req = makeReq("nixify.vercel.app", "/");
    const res = await middleware(req);
    expect(res.status).toBe(308);
    // NextResponse.redirect normalizes the root to "https://nixify.ir/" (with
    // trailing slash) — this is equivalent to the bare origin per RFC 3986.
    expect(res.headers.get("location")).toBe("https://nixify.ir/");
  });
});

describe("legacy-host redirect — preview hosts are NOT redirected", () => {
  const previewHosts = [
    "nixify-git-pr42.vercel.app",
    "nixify-git-main.vercel.app",
    "nixify-git-post-roadmap-b-trust-domain-transparency-nxerfan.vercel.app",
    "nixify.vercel.app.evil.com", // suffix attack — different host
  ];

  for (const host of previewHosts) {
    it(`does NOT redirect ${host}`, async () => {
      const req = makeReq(host, "/docs");
      const res = await middleware(req);
      // Should NOT be a redirect to nixify.ir. It may be a pass-through (200)
      // or an auth redirect (307 to /auth for protected routes) — both are fine.
      // The key assertion: no redirect TO nixify.ir.
      const location = res.headers.get("location") ?? "";
      expect(location).not.toContain("https://nixify.ir");
    });
  }
});

describe("legacy-host redirect — canonical host is NOT redirected", () => {
  it("does NOT redirect nixify.ir requests", async () => {
    const req = makeReq("nixify.ir", "/docs");
    const res = await middleware(req);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("https://nixify.ir/");
  });
});
