/**
 * UX-C: Profile Settings API — behavioral validation tests.
 *
 * Tests the zod schema directly (no DB needed) to verify:
 * - Empty fullName → null (clearing allowed)
 * - Empty phoneNumber → null (clearing allowed)
 * - Valid canonical phone → accepted
 * - Letters in phone → rejected
 * - Fewer than 7 digits → rejected
 * - More than 15 digits → rejected
 * - fullName >100 → rejected
 * - email/plan/userId NOT in schema
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * The exact schema used by the PATCH /api/profile/settings endpoint.
 * Duplicated here so the test can run without importing the route
 * (which pulls in Prisma). The route file is regression-tested
 * separately for schema sync via source-string assertions.
 */
const updateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .max(100, { message: "Full name must be 100 characters or fewer" })
    .optional()
    .nullable()
    .transform((v) => (v === null || v === "" ? null : v)),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, {
      message: "Enter a valid phone number (optional +, 7–15 digits)",
    })
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null))
    .transform((v) => (v === null || v === "" ? null : v)),
});

describe("UX-C — Profile Settings validation", () => {
  // ── fullName ──────────────────────────────────────────────────

  it("accepts a valid non-empty fullName", () => {
    const result = updateSchema.safeParse({ fullName: "Alice Smith" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Alice Smith");
    }
  });

  it("trims whitespace from fullName", () => {
    const result = updateSchema.safeParse({ fullName: "  Alice  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Alice");
    }
  });

  it("normalizes empty fullName to null (clearing)", () => {
    const result = updateSchema.safeParse({ fullName: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBeNull();
    }
  });

  it("normalizes whitespace-only fullName to null", () => {
    const result = updateSchema.safeParse({ fullName: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBeNull();
    }
  });

  it("accepts null fullName (explicit clear)", () => {
    const result = updateSchema.safeParse({ fullName: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBeNull();
    }
  });

  it("rejects fullName > 100 characters", () => {
    const longName = "a".repeat(101);
    const result = updateSchema.safeParse({ fullName: longName });
    expect(result.success).toBe(false);
  });

  it("accepts fullName of exactly 100 characters", () => {
    const name100 = "a".repeat(100);
    const result = updateSchema.safeParse({ fullName: name100 });
    expect(result.success).toBe(true);
  });

  // ── phoneNumber ──────────────────────────────────────────────

  it("accepts a valid phone with + prefix", () => {
    const result = updateSchema.safeParse({ phoneNumber: "+1234567890" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phoneNumber).toBe("+1234567890");
    }
  });

  it("accepts a valid phone without + prefix", () => {
    const result = updateSchema.safeParse({ phoneNumber: "1234567" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phoneNumber).toBe("1234567");
    }
  });

  it("accepts a 15-digit phone", () => {
    const result = updateSchema.safeParse({ phoneNumber: "123456789012345" });
    expect(result.success).toBe(true);
  });

  it("normalizes empty phoneNumber to null (clearing)", () => {
    const result = updateSchema.safeParse({ phoneNumber: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phoneNumber).toBeNull();
    }
  });

  it("accepts null phoneNumber (explicit clear)", () => {
    const result = updateSchema.safeParse({ phoneNumber: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phoneNumber).toBeNull();
    }
  });

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

  // ── email/plan/userId NOT in schema ──────────────────────────

  it("schema does NOT accept email as a field", () => {
    const schemaStr = JSON.stringify(updateSchema.shape);
    expect(schemaStr).not.toContain("email");
  });

  it("schema does NOT accept plan as a field", () => {
    const schemaStr = JSON.stringify(updateSchema.shape);
    expect(schemaStr).not.toContain("plan");
  });

  it("schema does NOT accept userId as a field", () => {
    const schemaStr = JSON.stringify(updateSchema.shape);
    expect(schemaStr).not.toContain("userId");
  });

  // ── combined updates ────────────────────────────────────────

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
    const result = updateSchema.safeParse({
      fullName: "",
      phoneNumber: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBeNull();
      expect(result.data.phoneNumber).toBeNull();
    }
  });

  it("accepts updating only fullName (phoneNumber undefined)", () => {
    const result = updateSchema.safeParse({ fullName: "Bob" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Bob");
      expect(result.data.phoneNumber).toBeUndefined();
    }
  });

  it("accepts updating only phoneNumber (fullName undefined)", () => {
    const result = updateSchema.safeParse({ phoneNumber: "+1234567890" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phoneNumber).toBe("+1234567890");
      expect(result.data.fullName).toBeUndefined();
    }
  });
});
