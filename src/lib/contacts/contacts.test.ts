import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  upsertContact,
  getContactById,
  getContactByEmail,
  listContacts,
  updateContact,
  deleteContact,
  addContactEvent,
  getContactTimeline,
  normalizeEmail,
  isValidEmail,
  ContactValidationError,
} from "@/lib/contacts";
import { hashPassword } from "@/lib/auth/password";

/**
 * Contact service integration tests.
 *
 * These tests require:
 *   1. RUN_CONTACT_INTEGRATION=1 — gates the suite so it doesn't run during
 *      generic `bun run test` (which has no test database).
 *   2. TEST_DATABASE_URL — pointing to an isolated PostgreSQL test database.
 *      The `test:contacts` npm script maps TEST_DATABASE_URL → DATABASE_URL
 *      so Prisma connects to the test DB. Do NOT use the production DATABASE_URL.
 *
 * When RUN_CONTACT_INTEGRATION is not set, the suite is silently skipped
 * (for generic test runs). When it IS set but TEST_DATABASE_URL is missing,
 * the `test:contacts` script fails immediately (test -n).
 *
 * Coverage:
 * - create Contact
 * - normalized email
 * - idempotent upsert
 * - update Contact
 * - Contact timeline append
 * - delete Contact
 * - duplicate email under same user does not duplicate
 * - same email under two users creates separate Contacts
 * - tenant isolation
 * - upsert metadata (created/changed)
 * - read_only vs full scope behavior
 */

// Gate: skip silently when RUN_CONTACT_INTEGRATION is not set (generic test runs)
const RUN = process.env.RUN_CONTACT_INTEGRATION === "1";

describe.skipIf(!RUN)("Contacts Service", () => {
  let userA: number;
  let userB: number;
  let setupComplete: boolean = false;

  beforeAll(async () => {
    // Verify DB connectivity
    await db.$queryRaw`SELECT 1`;

    // Clean up any leftover test data from previous runs
    await db.contactEvent.deleteMany({
      where: { contact: { user: { email: { contains: "contacts-test-" } } } },
    });
    await db.contact.deleteMany({
      where: { user: { email: { contains: "contacts-test-" } } },
    });
    await db.user.deleteMany({
      where: { email: { contains: "contacts-test-" } },
    });

    // Create two test users for tenant isolation tests
    const a = await db.user.create({
      data: {
        email: "contacts-test-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userA = a.id;

    const b = await db.user.create({
      data: {
        email: "contacts-test-b@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userB = b.id;
    setupComplete = true;
  });

  afterAll(async () => {
    // Only clean up if setup completed successfully — avoids undefined IDs
    if (!setupComplete) {
      await db.$disconnect();
      return;
    }
    // Clean up all test data
    await db.contactEvent.deleteMany({
      where: { contact: { userId: { in: [userA, userB] } } },
    });
    await db.contact.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.$disconnect();
  });

  // ---- Email normalization ----

  it("normalizeEmail trims and lowercases", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
    expect(normalizeEmail("alice@example.com")).toBe("alice@example.com");
  });

  it("isValidEmail accepts valid emails and rejects invalid", () => {
    expect(isValidEmail("alice@example.com")).toBe(true);
    expect(isValidEmail("Alice@Example.COM")).toBe(true);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });

  // ---- Create + upsert ----

  it("creates a contact with normalized email", async () => {
    const result = await upsertContact(userA, {
      email: "  Alice@Example.COM ",
      name: "Alice",
      attributes: { plan: "pro" },
    });

    expect(result.contact.id).toBeDefined();
    expect(result.contact.email).toBe("alice@example.com");
    expect(result.contact.name).toBe("Alice");
    expect(result.contact.attributes).toEqual({ plan: "pro" });
    expect(result.contact.source).toBe("api");
    expect(result.contact.marketingStatus).toBe("unknown");
    expect(result.contact.marketingConsentSource).toBeNull();
    expect(result.contact.marketingConsentAt).toBeNull();
    expect(result.created).toBe(true);
    expect(result.changed).toBe(true);
  });

  it("idempotent upsert — same user + same email does not duplicate", async () => {
    const r1 = await upsertContact(userA, {
      email: "bob@example.com",
      name: "Bob",
    });
    expect(r1.created).toBe(true);

    const r2 = await upsertContact(userA, {
      email: "BOB@example.com", // different case
      name: "Bob Updated",
    });

    expect(r1.contact.id).toBe(r2.contact.id);
    expect(r2.created).toBe(false);
    expect(r2.changed).toBe(true);
    expect(r2.contact.name).toBe("Bob Updated");
    expect(r2.contact.email).toBe("bob@example.com");
  });

  it("repeated identical upsert — no DB mutation, no timeline event", async () => {
    const r1 = await upsertContact(userA, {
      email: "identical@example.com",
      name: "Identical",
      attributes: { key: "value" },
    });
    expect(r1.created).toBe(true);
    expect(r1.changed).toBe(true);

    // Count events after create
    const { total: eventsAfterCreate } = await getContactTimeline(userA, r1.contact.id);
    expect(eventsAfterCreate).toBe(1); // "contact.created"

    // Same exact data
    const r2 = await upsertContact(userA, {
      email: "identical@example.com",
      name: "Identical",
      attributes: { key: "value" },
    });

    expect(r2.created).toBe(false);
    expect(r2.changed).toBe(false); // No changes detected

    // No new event
    const { total: eventsAfterRepeat } = await getContactTimeline(userA, r1.contact.id);
    expect(eventsAfterRepeat).toBe(1); // Still just "contact.created"
  });

  it("same email under two different users creates separate contacts", async () => {
    const cA = await upsertContact(userA, {
      email: "shared@example.com",
      name: "Shared A",
    });
    const cB = await upsertContact(userB, {
      email: "shared@example.com",
      name: "Shared B",
    });

    expect(cA.contact.id).not.toBe(cB.contact.id);
    expect(cA.contact.userId).toBe(userA);
    expect(cB.contact.userId).toBe(userB);
    expect(cA.contact.email).toBe("shared@example.com");
    expect(cB.contact.email).toBe("shared@example.com");
  });

  // ---- Read ----

  it("getContactById returns the contact for the correct owner", async () => {
    const created = await upsertContact(userA, {
      email: "carol@example.com",
      name: "Carol",
    });
    const fetched = await getContactById(userA, created.contact.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.email).toBe("carol@example.com");
  });

  it("getContactById returns null for cross-tenant access", async () => {
    const created = await upsertContact(userA, {
      email: "dave@example.com",
      name: "Dave",
    });
    const fetched = await getContactById(userB, created.contact.id);

    expect(fetched).toBeNull();
  });

  it("getContactByEmail returns the contact for the correct owner", async () => {
    const fetched = await getContactByEmail(userA, "alice@example.com");
    expect(fetched).not.toBeNull();
    expect(fetched!.email).toBe("alice@example.com");
  });

  // ---- List ----

  it("listContacts returns only the user's contacts", async () => {
    const result = await listContacts(userA, { page: 1, pageSize: 100 });
    expect(result.contacts.length).toBeGreaterThan(0);
    expect(result.contacts.every((c) => c.userId === userA)).toBe(true);
  });

  it("listContacts supports search by email", async () => {
    const result = await listContacts(userA, { search: "alice" });
    expect(result.contacts.length).toBe(1);
    expect(result.contacts[0].email).toBe("alice@example.com");
  });

  // ---- Update ----

  it("updateContact updates name and attributes", async () => {
    const created = await upsertContact(userA, {
      email: "eve@example.com",
      name: "Eve",
      attributes: { plan: "free" },
    });

    const updated = await updateContact(userA, created.contact.id, {
      name: "Eve Updated",
      attributes: { plan: "pro", country: "UK" },
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Eve Updated");
    expect(updated!.attributes).toEqual({ plan: "pro", country: "UK" });
  });

  it("updateContact returns null for cross-tenant access", async () => {
    const created = await upsertContact(userA, {
      email: "frank@example.com",
      name: "Frank",
    });

    const updated = await updateContact(userB, created.contact.id, {
      name: "Hacked",
    });

    expect(updated).toBeNull();
  });

  it("updateContact is a no-op for unchanged data", async () => {
    const created = await upsertContact(userA, {
      email: "noop@example.com",
      name: "Noop",
    });

    const { total: beforeTotal } = await getContactTimeline(userA, created.contact.id);
    await updateContact(userA, created.contact.id, { name: "Noop" });
    const { total: afterTotal } = await getContactTimeline(userA, created.contact.id);
    expect(afterTotal).toBe(beforeTotal);
  });

  // ---- Timeline ----

  it("addContactEvent appends to timeline", async () => {
    const created = await upsertContact(userA, {
      email: "timeline@example.com",
      name: "Timeline",
    });

    await addContactEvent(userA, created.contact.id, "contact.updated", { field: "name" });

    const { events, total } = await getContactTimeline(userA, created.contact.id);
    expect(total).toBeGreaterThanOrEqual(2);
    expect(events[0].type).toBe("contact.updated");
  });

  it("addContactEvent rejects cross-tenant event creation", async () => {
    const created = await upsertContact(userA, {
      email: "cross-event@example.com",
      name: "Cross Event",
    });

    // User B tries to add an event to User A's contact
    await expect(
      addContactEvent(userB, created.contact.id, "contact.updated"),
    ).rejects.toThrow();
  });

  // ---- Delete ----

  it("deleteContact deletes the contact", async () => {
    const created = await upsertContact(userA, {
      email: "deleteme@example.com",
      name: "Delete Me",
    });

    const result = await deleteContact(userA, created.contact.id);
    expect(result).toBe(true);

    const fetched = await getContactById(userA, created.contact.id);
    expect(fetched).toBeNull();
  });

  it("deleteContact returns false for cross-tenant", async () => {
    const created = await upsertContact(userA, {
      email: "cross-delete@example.com",
      name: "Cross",
    });

    const result = await deleteContact(userB, created.contact.id);
    expect(result).toBe(false);

    const fetched = await getContactById(userA, created.contact.id);
    expect(fetched).not.toBeNull();
  });

  // ---- Service-level email validation ----

  it("service-level upsertContact rejects invalid email", async () => {
    await expect(
      upsertContact(userA, { email: "not-an-email" }),
    ).rejects.toThrow(ContactValidationError);
  });

  // ---- Validation ----

  it("rejects oversized attributes (UTF-8 bytes)", async () => {
    const bigAttrs: Record<string, string> = {};
    for (let i = 0; i < 1000; i++) {
      bigAttrs[`key_${i}`] = "x".repeat(100);
    }

    await expect(
      upsertContact(userA, { email: "big@example.com", attributes: bigAttrs }),
    ).rejects.toThrow(ContactValidationError);
  });

  it("rejects oversized multibyte attributes (UTF-8 bytes > char count)", async () => {
    // Each of these characters is 3 bytes in UTF-8
    const bigAttrs: Record<string, string> = { data: "🎉".repeat(5000) };

    await expect(
      upsertContact(userA, { email: "multibyte@example.com", attributes: bigAttrs }),
    ).rejects.toThrow(ContactValidationError);
  });

  it("rejects non-object attributes (array)", async () => {
    await expect(
      upsertContact(userA, {
        email: "array@example.com",
        attributes: ["not", "an", "object"] as unknown as Record<string, unknown>,
      }),
    ).rejects.toThrow(ContactValidationError);
  });

  it("rejects non-object attributes (primitive)", async () => {
    await expect(
      upsertContact(userA, {
        email: "primitive@example.com",
        attributes: "not-an-object" as unknown as Record<string, unknown>,
      }),
    ).rejects.toThrow(ContactValidationError);
  });

  // Scope regression tests moved to src/lib/dx/scope.test.ts (no DB required)
});
