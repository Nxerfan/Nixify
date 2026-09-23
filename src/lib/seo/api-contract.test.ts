/**
 * Phase 17 FINAL — API contract tests.
 *
 * These tests prove the v1 OTP API response contract is internally consistent:
 *   - `request_id` = API request trace ID (set by okResponse, matches X-Request-Id)
 *   - `otp_request_id` = OTP correlation ID (OtpCode.requestId, for webhook correlation)
 *
 * The previous contract had a collision: the send route put `request_id: otpRequestId`
 * in the data, then `okResponse(ctx.requestId, data)` OVERWROTE it with the API trace
 * ID — losing the OTP correlation ID entirely. These tests would have caught that.
 */
import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

// ─── Test okResponse directly ─────────────────────────────────────────────

describe("Phase 17 FINAL — okResponse contract", () => {
  it("okResponse sets request_id from the API trace ID (first arg)", async () => {
    const mod = await import("@/lib/dx/request-context");
    const res = mod.okResponse("api-trace-id-123", { message: "OK" });
    const body = await res.json();
    expect(body.request_id).toBe("api-trace-id-123");
  });

  it("okResponse does NOT let handler data override request_id", async () => {
    // This is the collision regression: if a route puts `request_id: otpRequestId`
    // in the data, okResponse MUST overwrite it with the API trace ID.
    const mod = await import("@/lib/dx/request-context");
    const res = mod.okResponse("api-trace-id-123", {
      request_id: "otp-correlation-id-456", // route tried to set it
      message: "OTP sent",
    });
    const body = await res.json();
    // The API trace ID MUST win — handler data cannot redefine request_id.
    expect(body.request_id).toBe("api-trace-id-123");
    expect(body.request_id).not.toBe("otp-correlation-id-456");
  });

  it("okResponse preserves otp_request_id from handler data", async () => {
    const mod = await import("@/lib/dx/request-context");
    const res = mod.okResponse("api-trace-id-123", {
      otp_request_id: "otp-correlation-id-456",
      message: "OTP sent",
    });
    const body = await res.json();
    expect(body.otp_request_id).toBe("otp-correlation-id-456");
    expect(body.request_id).toBe("api-trace-id-123");
  });

  it("okResponse sets X-Request-Id header matching body request_id", async () => {
    const mod = await import("@/lib/dx/request-context");
    const res = mod.okResponse("api-trace-id-123", { message: "OK" });
    expect(res.headers.get("X-Request-Id")).toBe("api-trace-id-123");
    const body = await res.json();
    expect(body.request_id).toBe(res.headers.get("X-Request-Id"));
  });
});

// ─── Test errorResponse contract ──────────────────────────────────────────

describe("Phase 17 FINAL — errorResponse contract", () => {
  it("errorResponse sets request_id from API trace ID", async () => {
    const mod = await import("@/lib/dx/request-context");
    const req = new Request("https://example.com");
    const res = mod.errorResponse("api-trace-id-789", 400, "validation_failed", "bad input", req as any);
    const body = await res.json();
    expect(body.request_id).toBe("api-trace-id-789");
    expect(body.error.code).toBe("validation_failed");
    // Errors do NOT have otp_request_id unless explicitly added
    expect(body.otp_request_id).toBeUndefined();
  });
});

// ─── Landing snippet output tests ─────────────────────────────────────────

import { buildLandingSnippets } from "@/lib/seo/landing-snippets";

describe("Phase 17 FINAL — landing snippet API field correctness", () => {
  const snippets = buildLandingSnippets();

  it("JS snippet does NOT contain camelCase requestId", () => {
    expect(snippets.js).not.toContain("requestId");
  });

  it("JS snippet does NOT destructure { requestId } from API JSON", () => {
    expect(snippets.js).not.toContain("{ requestId }");
    expect(snippets.js).not.toContain("data.requestId");
  });

  it("JS snippet uses otp_request_id (snake_case) for OTP correlation", () => {
    expect(snippets.js).toContain("otp_request_id");
  });

  it("JS verify example includes purpose: 'signup'", () => {
    // The verify body must include purpose to match the send purpose
    expect(snippets.js).toContain("purpose: 'signup'");
  });

  it("JS send example includes purpose: 'signup'", () => {
    expect(snippets.js).toMatch(/purpose.*signup/);
  });

  it("cURL snippet includes purpose in send body", () => {
    expect(snippets.curl).toContain('"purpose":"signup"');
  });

  it("Python snippet includes purpose in send body", () => {
    expect(snippets.python).toContain("'purpose': 'signup'");
  });
});

// ─── Documentation regression tests ────────────────────────────────────────

import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf-8");
}

describe("Phase 17 FINAL — docs page has no invalid requestId", () => {
  it("docs page does NOT contain data.requestId (camelCase API field)", () => {
    expect(readSrc("components/docs/DocsContent.tsx")).not.toContain("data.requestId");
  });

  it("docs page does NOT contain { requestId } destructuring from API", () => {
    expect(readSrc("components/docs/DocsContent.tsx")).not.toContain("{ requestId }");
  });

  it("docs page does NOT instruct users to store request_id for verify", () => {
    expect(readSrc("components/docs/DocsContent.tsx")).not.toContain("store the request_id");
  });

  it("docs send response schema includes otp_request_id", () => {
    expect(readSrc("components/docs/DocsContent.tsx")).toContain("otp_request_id");
  });

  it("docs verify response schema includes otp_request_id", () => {
    const docs = readSrc("components/docs/DocsContent.tsx");
    // Both send and verify should have otp_request_id now
    expect(docs).toContain("otp_request_id");
  });
});

// ─── Send/verify route contract regression ────────────────────────────────

describe("Phase 17 FINAL — send/verify route contract", () => {
  it("send route uses otp_request_id for OTP correlation in data", () => {
    const send = readSrc("app/api/v1/otp/send/route.ts");
    expect(send).toContain("otp_request_id: requestId");
  });

  it("verify route uses otp_request_id for OTP correlation in response", () => {
    const verify = readSrc("app/api/v1/otp/verify/route.ts");
    expect(verify).toContain("otp_request_id: otpRequestId");
  });

  it("verify request schema does NOT accept request_id or otp_request_id as input", () => {
    const verify = readSrc("app/api/v1/otp/verify/route.ts");
    // The body schema should only accept email, code, purpose
    expect(verify).not.toMatch(/request_id.*z\./);
    expect(verify).not.toMatch(/otp_request_id.*z\./);
  });
});

// ─── UX-B Docs API contract regression (fix/ux-b-docs-api-contract) ──────────

describe("UX-B Docs API contract — active DocsContent has no fabricated fields", () => {
  const docs = readSrc("components/docs/DocsContent.tsx");

  it("does NOT contain otp_id (fabricated field)", () => {
    expect(docs).not.toContain("otp_id");
  });

  it("does NOT contain verified_at (fabricated field)", () => {
    expect(docs).not.toContain("verified_at");
  });

  it("does NOT document OTP purpose 'signin'", () => {
    expect(docs).not.toContain("signin");
  });

  it("documents OTP purpose 'login'", () => {
    expect(docs).toContain("login");
  });

  it("contains otp_request_id (OTP correlation ID)", () => {
    expect(docs).toContain("otp_request_id");
  });

  it("distinguishes request_id from otp_request_id", () => {
    // Both must be present — request_id is the API trace ID, otp_request_id
    // is the OTP correlation ID. The docs must explain the difference.
    expect(docs).toContain("request_id");
    expect(docs).toContain("otp_request_id");
    // The docs must mention "trace" or "correlation" to distinguish them
    expect(docs).toMatch(/trace|correlation/i);
  });

  it("does NOT instruct clients to send request_id or otp_request_id to /verify", () => {
    // The verify curl example must NOT include request_id or otp_request_id in the body
    const verifySection = docs.split("/otp/verify")[1]?.split("}")[0] ?? "";
    expect(verifySection).not.toContain("request_id");
    expect(verifySection).not.toContain("otp_request_id");
  });
});

describe("UX-B Docs API contract — sandbox header", () => {
  const docs = readSrc("components/docs/DocsContent.tsx");

  it("uses X-Sandbox-Simulate (not the stale X-Nixify-Test-Scenario)", () => {
    expect(docs).toContain("X-Sandbox-Simulate");
    expect(docs).not.toContain("X-Nixify-Test-Scenario");
  });

  it("does NOT contain hard_bounce as an OTP sandbox scenario", () => {
    expect(docs).not.toContain("hard_bounce");
  });

  it("documents only real sandbox scenarios", () => {
    const scenarios = ["rate_limited", "locked", "expired", "mismatch", "smtp_error"];
    for (const s of scenarios) {
      expect(docs).toContain(s);
    }
  });
<<<<<<< Updated upstream
=======

  it("scopes the per-email bypass to /send and /resend (not /verify)", () => {
    // The docs must NOT say "Per-email rate limits are skipped" as a blanket statement.
    expect(docs).not.toContain("Per-email rate limits are skipped");
    // Must scope the bypass to /send and /resend specifically.
    expect(docs).toContain("/send and /resend");
  });

  it("documents that /verify still enforces the per-email verification limit", () => {
    expect(docs).toContain("/verify");
    expect(docs).toContain("5/min");
    // Must say /verify still enforces the per-email limit
    expect(docs).toMatch(/\/verify.*enforce.*per-email|per-email.*verification/i);
  });

  it("does NOT claim test keys bypass all per-email rate limits", () => {
    // The docs must not contain the broad misleading claim
    expect(docs).not.toContain("skip per-email limits");
    expect(docs).not.toContain("per-email limits are skipped");
    expect(docs).not.toContain("bypasses rate limits");
  });
>>>>>>> Stashed changes
});

describe("UX-B Docs API contract — error response shape", () => {
  const docs = readSrc("components/docs/DocsContent.tsx");

  it("shows request_id at TOP LEVEL (not inside error object)", () => {
    // The error JSON must have request_id as a sibling of error, not nested inside it.
    // Check that the docs contain the pattern: },\n  "request_id":
    expect(docs).toMatch(/"error"\s*:\s*\{[\s\S]*?\}\s*,\s*"request_id"/);
  });

  it("uses relative doc_url (/docs#error-<code>) not absolute URL", () => {
    expect(docs).toContain('"/docs#error-');
    expect(docs).not.toContain("nixify.ir/docs#error");
  });
});

describe("UX-B Docs API contract — rate limits", () => {
  const docs = readSrc("components/docs/DocsContent.tsx");

  it("documents 10/hour per-email OTP send limit", () => {
    expect(docs).toContain("10/hour");
  });

  it("documents 3/min per-email OTP send limit", () => {
    expect(docs).toContain("3/min");
  });

  it("documents per-IP limits (10/min, 60/hour for send; 30/min, 120/hour for verify)", () => {
    expect(docs).toContain("10/min, 60/hour");
    expect(docs).toContain("30/min, 120/hour");
  });

  it("documents 5/min per-email OTP verify limit", () => {
    expect(docs).toContain("5/min");
  });

  it("does NOT claim successful responses always have X-RateLimit-*", () => {
    // The docs must explicitly state that successful responses do NOT include
    // X-RateLimit-* headers.
    expect(docs).toMatch(/do NOT.*X-RateLimit|do not.*X-RateLimit/i);
  });

<<<<<<< Updated upstream
  it("documents 15-minute lockout (not just expiry) after 5 failed attempts", () => {
    expect(docs).toContain("15-min");
    expect(docs).toContain("LOCKED");
=======
  it("documents max 5 attempts + locked vs expired distinction", () => {
    expect(docs).toContain("5");
    expect(docs).toContain("locked");
    expect(docs).toContain("expired");
    expect(docs).toContain("distinct");
  });

  it("does NOT promise a fresh 15-minute timer starting from the 5th failed attempt", () => {
    // The docs must NOT say "15 minutes after 5 failed attempts" or equivalent.
    // The lock window is anchored to OTP creation, not to the 5th attempt.
    expect(docs).not.toMatch(/15.{0,20}after.{0,20}(5|five).{0,20}(fail|attempt)/i);
    expect(docs).not.toMatch(/(5|five).{0,20}(fail|attempt).{0,20}15/i);
  });

  it("documents the lock window is anchored to OTP creation time", () => {
    // The docs must mention "creation" when describing the lock window.
    expect(docs).toMatch(/creation/i);
>>>>>>> Stashed changes
  });
});

describe("UX-B Docs API contract — send/verify/resend purpose contract", () => {
  const docs = readSrc("components/docs/DocsContent.tsx");

  it("documents purpose values signup | login | reset with default signup", () => {
    expect(docs).toContain("signup");
    expect(docs).toContain("login");
    expect(docs).toContain("reset");
    expect(docs).toContain("default");
  });

  it("documents purpose on /otp/send", () => {
    const sendSection = docs.split("id=\"send-otp\"")[1]?.split("DocsChapter")[0] ?? "";
    expect(sendSection).toContain("purpose");
  });

  it("documents purpose on /otp/verify", () => {
    const verifySection = docs.split("id=\"verify-otp\"")[1]?.split("DocsChapter")[0] ?? "";
    expect(verifySection).toContain("purpose");
  });

  it("documents purpose on /otp/resend", () => {
    const resendSection = docs.split("id=\"resend-otp\"")[1]?.split("DocsChapter")[0] ?? "";
    expect(resendSection).toContain("purpose");
  });
});

describe("UX-B Docs API contract — Broadcasts GuideBanner", () => {
  it("EN banner does NOT claim template picker or scheduling on dashboard", () => {
    const en = readSrc("i18n/en.ts");
    // Find the broadcasts banner line specifically (it contains both eyebrow and headline)
    const bannerLine = en.split("\n").find(l => l.includes("broadcasts:") && l.includes("eyebrow") && l.includes("headline")) ?? "";
    expect(bannerLine).not.toContain("template");
    expect(bannerLine).not.toContain("schedule");
    // Must mention the real dashboard workflow
    expect(bannerLine).toContain("draft");
    expect(bannerLine).toContain("audience");
    expect(bannerLine).toContain("launch");
  });

  it("FA banner does NOT claim template picker or scheduling on dashboard", () => {
    const fa = readSrc("i18n/fa.ts");
    // Find the broadcasts banner line specifically
    const bannerLine = fa.split("\n").find(l => l.includes("broadcasts:") && l.includes("eyebrow") && l.includes("headline")) ?? "";
    expect(bannerLine).not.toContain("قالب");
    expect(bannerLine).not.toContain("زمان‌بندی");
    // Must mention the real dashboard workflow
    expect(bannerLine).toContain("پیش‌نویس");
    expect(bannerLine).toContain("مخاطب");
    expect(bannerLine).toContain("ارسال");
  });
});

describe("UX-B Docs API contract — shared docs source", () => {
  it("public /docs uses the shared DocsContent component", () => {
    const publicView = readSrc("app/docs/PublicDocsView.tsx");
    expect(publicView).toContain("DocsContent");
  });

  it("dashboard /docs uses the SAME shared DocsContent component", () => {
    const dashDocs = readSrc("app/dashboard/docs/page.tsx");
    expect(dashDocs).toContain("DocsContent");
  });
});
