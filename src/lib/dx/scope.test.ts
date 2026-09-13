import { describe, it, expect } from "vitest";
import { hasScope } from "@/lib/dx/api-keys";

/**
 * Pure unit tests for the API key scope system.
 * No database required — these run in the generic test suite.
 *
 * Verifies:
 * - full → all actions allowed (read, write, otp:send, otp:verify)
 * - read_only → read allowed, all writes denied, OTP denied
 * - Comma-separated custom scopes → exact match
 * - OTP routes unaffected by read_only change
 */

describe("API Key Scope System", () => {
  it("full scope allows all actions", () => {
    expect(hasScope("full", "read")).toBe(true);
    expect(hasScope("full", "full")).toBe(true);
    expect(hasScope("full", "otp:send")).toBe(true);
    expect(hasScope("full", "otp:verify")).toBe(true);
    expect(hasScope("full", "anything")).toBe(true);
  });

  it("read_only allows read but denies writes", () => {
    expect(hasScope("read_only", "read")).toBe(true);
    expect(hasScope("read_only", "full")).toBe(false);
    expect(hasScope("read_only", "otp:send")).toBe(false);
    expect(hasScope("read_only", "otp:verify")).toBe(false);
    expect(hasScope("read_only", "anything")).toBe(false);
  });

  it("OTP routes unaffected — read_only still denied for otp:send/verify", () => {
    // This is the existing OTP behavior — must NOT regress
    expect(hasScope("read_only", "otp:send")).toBe(false);
    expect(hasScope("read_only", "otp:verify")).toBe(false);
    expect(hasScope("full", "otp:send")).toBe(true);
    expect(hasScope("full", "otp:verify")).toBe(true);
  });

  it("comma-separated custom scopes work by exact match", () => {
    expect(hasScope("otp:send,otp:verify", "otp:send")).toBe(true);
    expect(hasScope("otp:send,otp:verify", "otp:verify")).toBe(true);
    expect(hasScope("otp:send,otp:verify", "read")).toBe(false);
    expect(hasScope("otp:send,otp:verify", "full")).toBe(false);
  });

  it("read_only denies unknown custom scopes", () => {
    expect(hasScope("read_only", "contacts:write")).toBe(false);
    expect(hasScope("read_only", "custom:action")).toBe(false);
  });
});
