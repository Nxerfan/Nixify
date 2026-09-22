/**
 * UX-C: Profile Settings API — behavioral validation tests.
 *
 * Imports the EXACT shared production schema from src/lib/settings-validation.ts.
 * Proves canonical schemas are composed (not duplicated), non-strings are
 * rejected, and blank values normalize to null.
 */
import { describe, it, expect } from "vitest";
import { settingsProfileUpdateSchema as updateSchema } from "@/lib/settings-validation";

describe("UX-C — Profile Settings validation (shared production schema)", () => {
  // ── fullName: valid strings ──────────────────────────────────

  it("accepts a valid non-empty fullName", () => {
    const result = updateSchema.safeParse({ fullName: "Alice Smith" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBe("Alice Smith");
  });

  it("trims whitespace from fullName via canonical schema", () => {
    const result = updateSchema.safeParse({ fullName: "  Alice  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBe("Alice");
  });

  it("accepts fullName of exactly 100 characters", () => {
    const result = updateSchema.safeParse({ fullName: "a".repeat(100) });
    expect(result.success).toBe(true);
  });

  // ── fullName: clearing ────────────────────────────────────────

  it("normalizes empty fullName to null (clearing)", () => {
    const result = updateSchema.safeParse({ fullName: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBeNull();
  });

  it("normalizes whitespace-only fullName to null", () => {
    const result = updateSchema.safeParse({ fullName: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBeNull();
  });

  it("accepts null fullName (explicit clear)", () => {
    const result = updateSchema.safeParse({ fullName: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBeNull();
  });

  it("accepts undefined fullName (field omitted)", () => {
    const result = updateSchema.safeParse({ phoneNumber: "+1234567" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBeUndefined();
  });

  // ── fullName: rejection ──────────────────────────────────────

  it("rejects fullName > 100 characters", () => {
    const result = updateSchema.safeParse({ fullName: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("REJECTS fullName as number (not coerced)", () => {
    const result = updateSchema.safeParse({ fullName: 123 });
    expect(result.success).toBe(false);
  });

  it("REJECTS fullName as object (not coerced)", () => {
    const result = updateSchema.safeParse({ fullName: { name: "Alice" } });
    expect(result.success).toBe(false);
  });

  it("REJECTS fullName as array (not coerced)", () => {
    const result = updateSchema.safeParse({ fullName: ["Alice"] });
    expect(result.success).toBe(false);
  });

  it("REJECTS fullName as boolean (not coerced)", () => {
    const result = updateSchema.safeParse({ fullName: true });
    expect(result.success).toBe(false);
  });

  // ── phoneNumber: valid strings ────────────────────────────────

  it("accepts a valid phone with + prefix", () => {
    const result = updateSchema.safeParse({ phoneNumber: "+1234567890" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phoneNumber).toBe("+1234567890");
  });

  it("accepts a valid phone without + prefix", () => {
    const result = updateSchema.safeParse({ phoneNumber: "1234567" });
    expect(result.success).toBe(true);
  });

  it("accepts a 15-digit phone (max)", () => {
    const result = updateSchema.safeParse({ phoneNumber: "123456789012345" });
    expect(result.success).toBe(true);
  });

  // ── phoneNumber: clearing ────────────────────────────────────

  it("normalizes empty phoneNumber to null (clearing)", () => {
    const result = updateSchema.safeParse({ phoneNumber: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phoneNumber).toBeNull();
  });

  it("normalizes whitespace-only phoneNumber to null", () => {
    const result = updateSchema.safeParse({ phoneNumber: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phoneNumber).toBeNull();
  });

  it("accepts null phoneNumber (explicit clear)", () => {
    const result = updateSchema.safeParse({ phoneNumber: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phoneNumber).toBeNull();
  });

  it("accepts undefined phoneNumber (field omitted)", () => {
    const result = updateSchema.safeParse({ fullName: "Alice" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phoneNumber).toBeUndefined();
  });

  // ── phoneNumber: rejection ───────────────────────────────────

  it("rejects letters in phone number", () => {
    const result = updateSchema.safeParse({ phoneNumber: "123456a" });
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 7 digits", () => {
    const result = updateSchema.safeParse({ phoneNumber: "123456" });
    expect(result.success).toBe(false);
  });

  it("rejects more than 15 digits", () => {
    const result = updateSchema.safeParse({ phoneNumber: "1234567890123456" });
    expect(result.success).toBe(false);
  });

  it("rejects phone with spaces or dashes", () => {
    expect(updateSchema.safeParse({ phoneNumber: "123-4567" }).success).toBe(false);
    expect(updateSchema.safeParse({ phoneNumber: "123 4567" }).success).toBe(false);
  });

  it("REJECTS phoneNumber as number (not coerced)", () => {
    const result = updateSchema.safeParse({ phoneNumber: 1234567 });
    expect(result.success).toBe(false);
  });

  it("REJECTS phoneNumber as object (not coerced)", () => {
    const result = updateSchema.safeParse({ phoneNumber: { num: "123" } });
    expect(result.success).toBe(false);
  });

  it("REJECTS phoneNumber as array (not coerced)", () => {
    const result = updateSchema.safeParse({ phoneNumber: ["1234567"] });
    expect(result.success).toBe(false);
  });

  it("REJECTS phoneNumber as boolean (not coerced)", () => {
    const result = updateSchema.safeParse({ phoneNumber: true });
    expect(result.success).toBe(false);
  });

  // ── Unknown-field rejection (.strict()) ───────────────────────

  it("REJECTS email as an unknown field (.strict())", () => {
    const result = updateSchema.safeParse({ email: "new@example.com" });
    expect(result.success).toBe(false);
  });

  it("REJECTS plan as an unknown field (.strict())", () => {
    const result = updateSchema.safeParse({ plan: "PRO" });
    expect(result.success).toBe(false);
  });

  it("REJECTS userId as an unknown field (.strict())", () => {
    const result = updateSchema.safeParse({ userId: 123 });
    expect(result.success).toBe(false);
  });

  it("REJECTS email even when sent alongside valid fullName", () => {
    const result = updateSchema.safeParse({
      fullName: "Alice",
      email: "hack@example.com",
    });
    expect(result.success).toBe(false);
  });

  // ── Combined updates ────────────────────────────────────────

  it("accepts both fullName and phoneNumber in one request", () => {
    const result = updateSchema.safeParse({
      fullName: "Alice Smith",
      phoneNumber: "+989121234567",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Alice Smith");
      expect(result.data.phoneNumber).toBe("+989121234567");
    }
  });

  it("accepts clearing both fullName and phoneNumber in one request", () => {
    const result = updateSchema.safeParse({ fullName: "", phoneNumber: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBeNull();
      expect(result.data.phoneNumber).toBeNull();
    }
  });
});
