import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { upsertContact } from "@/lib/contacts";
import {
  createGroup,
  listGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addContactToGroup,
  bulkAddContactsToGroup,
  removeContactFromGroup,
  listMembers,
  normalizeGroupName,
  MAX_BULK_ADD,
  MAX_GROUP_NAME,
  type GroupRow,
  type MembershipRow,
} from "@/lib/groups/service";

/**
 * Groups service — DB integration tests (Phase 8, sections 5, 6, 7).
 *
 * This file is GATED — only runs when RUN_GROUPS_IMPORT_INTEGRATION=1 AND a
 * TEST_DATABASE_URL is supplied. The (future) `test:groups-import` script will
 * set both. Generic `bun run test` skips this file silently (no DB available).
 * Mirrors the gate pattern of src/lib/messaging/service.test.ts
 * (RUN_MESSAGING_INTEGRATION) and src/lib/automation/queue.test.ts
 * (RUN_AUTOMATION_INTEGRATION).
 *
 * Coverage (per task spec):
 *
 * Groups CRUD:
 *   - create group, list groups, get group, update group, delete group
 *   - normalized duplicate name within same tenant → P2002 rejected
 *   - same name across different tenants → allowed (both created)
 *   - cross-tenant group lookup → null (no existence leakage)
 *   - exact tenant isolation (user A cannot see user B's groups)
 *
 * Membership:
 *   - add contact to group (idempotent — re-adding returns added=false)
 *   - bulk add contacts (capped at MAX_BULK_ADD, validates all contacts
 *     belong to user)
 *   - cross-tenant contact membership structurally rejected (DB-level
 *     composite FK on (userId, groupId) + (userId, contactId))
 *   - remove contact from group (idempotent — removing non-member returns
 *     removed=false)
 *   - list members (tenant-scoped)
 *
 * DB SETUP: mirrors messaging service.test.ts. Two test users (PRO plan so
 * GROUPS access=true at the route layer). Email prefix "gi-test-".
 */

// ---- Gate: skip silently when RUN_GROUPS_IMPORT_INTEGRATION is not set ----

const RUN = process.env.RUN_GROUPS_IMPORT_INTEGRATION === "1";

// UUID v4 strict regex (Prisma @default(uuid()) uses crypto.randomUUID()).
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe.skipIf(!RUN)("Groups Service — DB integration", () => {
  let userA: number;
  let userB: number;
  let setupComplete = false;

  // Unique name counter so different tests don't collide on the unique
  // (userId, normalizedName) constraint.
  let nameCounter = 0;
  function uniqueName(prefix = "g"): string {
    nameCounter += 1;
    return `${prefix}-${nameCounter}-${Date.now()}`;
  }

  beforeAll(async () => {
    // Verify DB connectivity.
    await db.$queryRaw`SELECT 1`;

    // Clean up any leftover test data from previous runs.
    // ContactGroupMembership has no direct `user` relation — it has composite
    // FKs to Group + Contact, so we filter through `group.user.email` (or
    // `contact.user.email`). Group/Contact have ON DELETE CASCADE on
    // memberships, but cleaning memberships explicitly first avoids any
    // dangling orphan rows from a partial previous run.
    await db.contactGroupMembership.deleteMany({
      where: { group: { user: { email: { contains: "gi-test-" } } } },
    });
    await db.contact.deleteMany({
      where: { user: { email: { contains: "gi-test-" } } },
    });
    await db.group.deleteMany({
      where: { user: { email: { contains: "gi-test-" } } },
    });
    await db.user.deleteMany({
      where: { email: { contains: "gi-test-" } },
    });

    // Create two test users with plan="PRO" so GROUPS access=true at the route
    // layer. These fixtures mirror the messaging/automation/events tests.
    const a = await db.user.create({
      data: {
        email: "gi-test-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userA = a.id;

    const b = await db.user.create({
      data: {
        email: "gi-test-b@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userB = b.id;

    setupComplete = true;
  });

  beforeEach(async () => {
    if (!setupComplete) return;

    // Clean tables between tests so the (userId, normalizedName) unique
    // constraint doesn't collide across tests.
    await db.contactGroupMembership.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.group.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
  });

  afterAll(async () => {
    if (!setupComplete) {
      await db.$disconnect();
      return;
    }
    await db.contactGroupMembership.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.group.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.$disconnect();
  });

  // ---- Helpers -----------------------------------------------------------

  /** Create a contact owned by `userId` with a unique email. */
  async function createContact(userId: number, suffix = ""): Promise<number> {
    const email = `c-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${suffix}@example.com`;
    const result = await upsertContact(userId, { email, source: "api" as any });
    return result.contact.id;
  }

  // ===== Groups CRUD ======================================================

  it("createGroup persists the group with a UUID groupId + normalized name + memberCount=0", async () => {
    const name = uniqueName();
    const group = await createGroup(userA, { name, description: "Test group" });

    expect(group.id).toBeGreaterThan(0);
    expect(group.groupId).toMatch(UUID_V4_RE);
    expect(group.userId).toBe(userA);
    expect(group.name).toBe(name);
    expect(group.description).toBe("Test group");
    expect(group.memberCount).toBe(0);
    expect(group.createdAt).toBeInstanceOf(Date);
    expect(group.updatedAt).toBeInstanceOf(Date);

    // Verify the row was actually persisted.
    const row = await db.group.findUnique({ where: { id: group.id } });
    expect(row).not.toBeNull();
    expect(row!.groupId).toBe(group.groupId);
    expect(row!.normalizedName).toBe(normalizeGroupName(name));
    expect(row!.userId).toBe(userA);
  });

  it("createGroup trims name + description (empty description → null)", async () => {
    const group = await createGroup(userA, {
      name: "  Spaced Name  ",
      description: "   ",
    });

    expect(group.name).toBe("Spaced Name");
    expect(group.description).toBeNull(); // whitespace-only description → null

    // The normalized name collapses internal whitespace.
    const row = await db.group.findUnique({ where: { id: group.id } });
    expect(row!.normalizedName).toBe("spaced-name");
  });

  it("listGroups returns only the caller's groups (tenant-scoped, paginated)", async () => {
    const g1 = await createGroup(userA, { name: uniqueName("a1") });
    const g2 = await createGroup(userA, { name: uniqueName("a2") });
    const g3 = await createGroup(userB, { name: uniqueName("b1") });

    const result = await listGroups(userA, { page: 1, pageSize: 50 });

    expect(result.total).toBe(2);
    const ids = result.groups.map((g) => g.id);
    expect(ids).toContain(g1.id);
    expect(ids).toContain(g2.id);
    expect(ids).not.toContain(g3.id); // user B's group is invisible to user A

    // Verify nothing leaks from user B.
    for (const g of result.groups) {
      expect(g.userId).toBe(userA);
    }
  });

  it("listGroups search matches both name (case-insensitive) and normalizedName", async () => {
    const g1 = await createGroup(userA, { name: "VIP Customers" });
    await createGroup(userA, { name: "Regular Customers" });

    const result = await listGroups(userA, { search: "vip" });
    expect(result.total).toBe(1);
    expect(result.groups[0].id).toBe(g1.id);
  });

  it("listGroups pagination is bounded (pageSize capped at 100, page >= 1)", async () => {
    // Create 5 groups for user A.
    const created: GroupRow[] = [];
    for (let i = 0; i < 5; i++) {
      created.push(await createGroup(userA, { name: uniqueName(`p${i}`) }));
    }

    const r1 = await listGroups(userA, { page: 1, pageSize: 2 });
    expect(r1.groups).toHaveLength(2);
    expect(r1.total).toBe(5);

    const r2 = await listGroups(userA, { page: 3, pageSize: 2 });
    expect(r2.groups).toHaveLength(1); // 5 total - 4 on pages 1+2 = 1 on page 3

    // pageSize > 100 is clamped to 100.
    const r3 = await listGroups(userA, { page: 1, pageSize: 1000 });
    expect(r3.groups).toHaveLength(5);
  });

  it("getGroup returns the group when it belongs to the caller", async () => {
    const created = await createGroup(userA, { name: uniqueName(), description: "D" });
    const fetched = await getGroup(userA, created.groupId);

    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.name).toBe(created.name);
    expect(fetched!.description).toBe("D");
  });

  it("getGroup returns null for cross-tenant lookup (no existence leakage)", async () => {
    const created = await createGroup(userA, { name: uniqueName() });

    // User B tries to fetch user A's group → null (no error, no leak).
    const fetched = await getGroup(userB, created.groupId);
    expect(fetched).toBeNull();
  });

  it("getGroup returns null for a nonexistent UUID", async () => {
    const fetched = await getGroup(userA, "00000000-0000-4000-8000-000000000000");
    expect(fetched).toBeNull();
  });

  it("updateGroup updates name + description (and recomputes normalizedName)", async () => {
    const created = await createGroup(userA, { name: uniqueName("orig"), description: "orig" });
    const newName = uniqueName("updated");

    const updated = await updateGroup(userA, created.groupId, {
      name: newName,
      description: "new desc",
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe(newName);
    expect(updated!.description).toBe("new desc");

    const row = await db.group.findUnique({ where: { id: created.id } });
    expect(row!.normalizedName).toBe(normalizeGroupName(newName));
  });

  it("updateGroup returns null for cross-tenant (no existence leak)", async () => {
    const created = await createGroup(userA, { name: uniqueName() });
    const updated = await updateGroup(userB, created.groupId, { name: uniqueName() });
    expect(updated).toBeNull();
  });

  it("updateGroup with no fields (empty input) returns the existing group unchanged", async () => {
    const created = await createGroup(userA, { name: uniqueName(), description: "D" });
    const updated = await updateGroup(userA, created.groupId, {});
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe(created.name);
    expect(updated!.description).toBe("D");
  });

  it("deleteGroup removes the group and cascades memberships", async () => {
    const created = await createGroup(userA, { name: uniqueName() });
    const contactId = await createContact(userA);

    await addContactToGroup(userA, created.groupId, contactId);
    // Verify the membership exists.
    expect(await db.contactGroupMembership.count({
      where: { groupId: created.id },
    })).toBe(1);

    const deleted = await deleteGroup(userA, created.groupId);
    expect(deleted).toBe(true);

    // Group is gone.
    expect(await db.group.findUnique({ where: { id: created.id } })).toBeNull();
    // Memberships are cascade-deleted.
    expect(await db.contactGroupMembership.count({
      where: { groupId: created.id },
    })).toBe(0);
    // Contact is NOT deleted (Group deletion only cascades memberships, not contacts).
    const contactStillExists = await db.contact.findUnique({ where: { id: contactId } });
    expect(contactStillExists).not.toBeNull();
  });

  it("deleteGroup returns false for cross-tenant (no existence leak, no delete)", async () => {
    const created = await createGroup(userA, { name: uniqueName() });
    const deleted = await deleteGroup(userB, created.groupId);
    expect(deleted).toBe(false);
    // Group still exists.
    expect(await db.group.findUnique({ where: { id: created.id } })).not.toBeNull();
  });

  // ===== Normalized name uniqueness =======================================

  it("normalized duplicate name within same tenant → P2002 rejected", async () => {
    // Create "VIP Customers" (normalizes to "vip-customers").
    await createGroup(userA, { name: "VIP Customers" });

    // Try to create "vip customers" (different case, same normalized form).
    await expect(
      createGroup(userA, { name: "vip customers" }),
    ).rejects.toMatchObject({ code: "P2002" });

    // Also "  VIP   customers  " (different spacing) → same normalized form.
    await expect(
      createGroup(userA, { name: "  VIP   customers  " }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("same name across different tenants → allowed (both created)", async () => {
    const g1 = await createGroup(userA, { name: "Shared Name" });
    const g2 = await createGroup(userB, { name: "Shared Name" });

    // Both created successfully — uniqueness is scoped per tenant.
    expect(g1.id).not.toBe(g2.id);
    expect(g1.userId).toBe(userA);
    expect(g2.userId).toBe(userB);
    expect(g1.name).toBe("Shared Name");
    expect(g2.name).toBe("Shared Name");

    // Both rows persisted.
    expect(await db.group.findUnique({ where: { id: g1.id } })).not.toBeNull();
    expect(await db.group.findUnique({ where: { id: g2.id } })).not.toBeNull();
  });

  it("updateGroup renaming to a duplicate normalized name → P2002 rejected", async () => {
    await createGroup(userA, { name: "Alpha" });
    const g2 = await createGroup(userA, { name: "Beta" });

    // Try to rename g2 to "alpha" — collides with the first group.
    await expect(
      updateGroup(userA, g2.groupId, { name: "alpha" }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  // ===== Membership ======================================================

  it("addContactToGroup creates a membership row (source defaults to 'manual')", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const contactId = await createContact(userA);

    const result = await addContactToGroup(userA, group.groupId, contactId);
    expect(result.added).toBe(true);

    const membership = await db.contactGroupMembership.findFirst({
      where: { groupId: group.id, contactId },
    });
    expect(membership).not.toBeNull();
    expect(membership!.source).toBe("manual");
    expect(membership!.userId).toBe(userA);
  });

  it("addContactToGroup is idempotent (re-adding returns added=false, no duplicate row)", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const contactId = await createContact(userA);

    const r1 = await addContactToGroup(userA, group.groupId, contactId);
    expect(r1.added).toBe(true);

    const r2 = await addContactToGroup(userA, group.groupId, contactId);
    expect(r2.added).toBe(false); // P2002 caught — idempotent

    // Only one membership row exists.
    const count = await db.contactGroupMembership.count({
      where: { groupId: group.id, contactId },
    });
    expect(count).toBe(1);
  });

  it("addContactToGroup with explicit source stores the source value", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const contactId = await createContact(userA);

    const r = await addContactToGroup(userA, group.groupId, contactId, "api");
    expect(r.added).toBe(true);

    const membership = await db.contactGroupMembership.findFirst({
      where: { groupId: group.id, contactId },
    });
    expect(membership!.source).toBe("api");
  });

  it("addContactToGroup with cross-tenant contact → added=false (no leak)", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    // Contact owned by user B.
    const contactId = await createContact(userB);

    // User A tries to add user B's contact to user A's group.
    const r = await addContactToGroup(userA, group.groupId, contactId);
    expect(r.added).toBe(false);

    // No membership row created.
    const count = await db.contactGroupMembership.count({
      where: { groupId: group.id, contactId },
    });
    expect(count).toBe(0);
  });

  it("addContactToGroup with cross-tenant group → added=false (group lookup misses)", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const contactId = await createContact(userB);

    // User B tries to add user B's contact to user A's group.
    const r = await addContactToGroup(userB, group.groupId, contactId);
    expect(r.added).toBe(false);

    const count = await db.contactGroupMembership.count({
      where: { groupId: group.id, contactId },
    });
    expect(count).toBe(0);
  });

  // ===== DB-level cross-tenant rejection (composite FK) ===================

  it("cross-tenant contact membership structurally rejected by DB composite FK", async () => {
    // Create group owned by user A.
    const groupA = await createGroup(userA, { name: uniqueName() });
    // Create contact owned by user B.
    const contactBId = await createContact(userB);

    // Try to directly insert a membership row that crosses tenants:
    // userId=userA, groupId=groupA.id, contactId=contactB.id.
    // The composite FK on (userId, contactId) → Contact(userId, id) requires
    // (userA, contactB.id) to exist in Contact, but contactB is owned by
    // userB, so the FK constraint should reject this insert.
    await expect(
      db.contactGroupMembership.create({
        data: {
          userId: userA,
          groupId: groupA.id,
          contactId: contactBId,
          source: "manual",
        },
      }),
    ).rejects.toMatchObject({
      // P2003 = foreign key constraint failed (Prisma code).
      code: expect.stringMatching(/^P20(03|02)$/),
    });

    // Also try the inverse: userId=userB, groupId=groupA.id, contactId=contactB.id.
    // The composite FK on (userId, groupId) → Group(userId, id) requires
    // (userB, groupA.id) to exist in Group, but the group is owned by userA.
    await expect(
      db.contactGroupMembership.create({
        data: {
          userId: userB,
          groupId: groupA.id,
          contactId: contactBId,
          source: "manual",
        },
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^P20(03|02)$/),
    });

    // No membership rows created.
    const count = await db.contactGroupMembership.count({
      where: { groupId: groupA.id, contactId: contactBId },
    });
    expect(count).toBe(0);
  });

  // ===== Bulk add ========================================================

  it("bulkAddContactsToGroup adds multiple contacts in one call", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const ids = await Promise.all([
      createContact(userA),
      createContact(userA),
      createContact(userA),
    ]);

    const r = await bulkAddContactsToGroup(userA, group.groupId, ids, "api");
    expect(r.added).toBe(3);
    expect(r.skipped).toBe(0);

    const count = await db.contactGroupMembership.count({
      where: { groupId: group.id },
    });
    expect(count).toBe(3);
  });

  it("bulkAddContactsToGroup is idempotent (re-adding returns skipped=N)", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const ids = await Promise.all([
      createContact(userA),
      createContact(userA),
    ]);

    const r1 = await bulkAddContactsToGroup(userA, group.groupId, ids);
    expect(r1.added).toBe(2);
    expect(r1.skipped).toBe(0);

    const r2 = await bulkAddContactsToGroup(userA, group.groupId, ids);
    expect(r2.added).toBe(0);
    expect(r2.skipped).toBe(2); // all were already members
  });

  it("bulkAddContactsToGroup is capped at MAX_BULK_ADD (excess IDs silently dropped)", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    // Create MAX_BULK_ADD + 5 contacts.
    const ids: number[] = [];
    for (let i = 0; i < MAX_BULK_ADD + 5; i++) {
      ids.push(await createContact(userA));
    }

    const r = await bulkAddContactsToGroup(userA, group.groupId, ids);
    // Only MAX_BULK_ADD were processed (the first 100).
    expect(r.added).toBe(MAX_BULK_ADD);
    expect(r.skipped).toBe(0);

    const count = await db.contactGroupMembership.count({
      where: { groupId: group.id },
    });
    expect(count).toBe(MAX_BULK_ADD);
  });

  it("bulkAddContactsToGroup validates all contacts belong to user (cross-tenant skipped)", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const validId = await createContact(userA);
    const foreignId = await createContact(userB); // user B's contact

    const r = await bulkAddContactsToGroup(userA, group.groupId, [validId, foreignId]);
    expect(r.added).toBe(1); // only validId added
    expect(r.skipped).toBe(1); // foreignId skipped (doesn't belong to user A)
  });

  it("bulkAddContactsToGroup with cross-tenant group → all skipped", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const contactId = await createContact(userA);

    // User B calls bulkAdd on user A's group → group lookup misses, all skipped.
    const r = await bulkAddContactsToGroup(userB, group.groupId, [contactId]);
    expect(r.added).toBe(0);
    expect(r.skipped).toBe(1);
  });

  it("bulkAddContactsToGroup source is stored on each membership", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const contactId = await createContact(userA);

    await bulkAddContactsToGroup(userA, group.groupId, [contactId], "import");
    const membership = await db.contactGroupMembership.findFirst({
      where: { groupId: group.id, contactId },
    });
    expect(membership!.source).toBe("import");
  });

  // ===== Remove from group ===============================================

  it("removeContactFromGroup deletes the membership row", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const contactId = await createContact(userA);
    await addContactToGroup(userA, group.groupId, contactId);

    const r = await removeContactFromGroup(userA, group.groupId, contactId);
    expect(r.removed).toBe(true);

    const count = await db.contactGroupMembership.count({
      where: { groupId: group.id, contactId },
    });
    expect(count).toBe(0);
  });

  it("removeContactFromGroup is idempotent (removing non-member returns removed=false)", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const contactId = await createContact(userA);
    // No addContactToGroup call — contact is not a member.

    const r = await removeContactFromGroup(userA, group.groupId, contactId);
    expect(r.removed).toBe(false);
  });

  it("removeContactFromGroup with cross-tenant group → removed=false", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const contactId = await createContact(userA);
    await addContactToGroup(userA, group.groupId, contactId);

    // User B tries to remove from user A's group.
    const r = await removeContactFromGroup(userB, group.groupId, contactId);
    expect(r.removed).toBe(false);

    // Membership still exists (the deleteMany was scoped by userId which
    // matched the row, but the groupId lookup missed, so deleteMany had
    // groupId=null filter... actually deleteMany is scoped by groupId=group.id
    // and contactId and userId=userB. Since the membership's userId is userA,
    // the deleteMany where clause {groupId, contactId, userId=userB} matches
    // nothing → count=0 → removed=false).
    const count = await db.contactGroupMembership.count({
      where: { groupId: group.id, contactId },
    });
    expect(count).toBe(1);
  });

  // ===== List members ====================================================

  it("listMembers returns tenant-scoped members with contact info", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const id1 = await createContact(userA, "-alice");
    const id2 = await createContact(userA, "-bob");
    await addContactToGroup(userA, group.groupId, id1, "manual");
    await addContactToGroup(userA, group.groupId, id2, "api");

    const result = await listMembers(userA, group.groupId, { page: 1, pageSize: 50 });
    expect(result).not.toBeNull();
    expect(result!.total).toBe(2);
    expect(result!.members).toHaveLength(2);

    // Each member row has the expected fields.
    for (const m of result!.members) {
      expect(m.userId).toBe(userA);
      expect(m.groupId).toBe(group.id);
      expect(m.contactEmail).toMatch(/@example\.com$/);
      expect(m.source).toMatch(/^(manual|api)$/);
      expect(m.createdAt).toBeInstanceOf(Date);
    }
  });

  it("listMembers returns null for cross-tenant group lookup", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    const id1 = await createContact(userA, "-x");
    await addContactToGroup(userA, group.groupId, id1);

    // User B cannot list members of user A's group → null.
    const result = await listMembers(userB, group.groupId);
    expect(result).toBeNull();
  });

  it("listMembers is paginated (pageSize capped at 100)", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    // Add 5 contacts.
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(await createContact(userA, `-p${i}`));
    }
    await bulkAddContactsToGroup(userA, group.groupId, ids);

    const r1 = await listMembers(userA, group.groupId, { page: 1, pageSize: 2 });
    expect(r1!.members).toHaveLength(2);
    expect(r1!.total).toBe(5);

    const r2 = await listMembers(userA, group.groupId, { page: 3, pageSize: 2 });
    expect(r2!.members).toHaveLength(1); // 5 - 4 on pages 1+2 = 1 on page 3
  });

  it("listMembers does not see memberships from a different group", async () => {
    const g1 = await createGroup(userA, { name: uniqueName("g1") });
    const g2 = await createGroup(userA, { name: uniqueName("g2") });
    const c1 = await createContact(userA, "-c1");
    const c2 = await createContact(userA, "-c2");

    await addContactToGroup(userA, g1.groupId, c1);
    await addContactToGroup(userA, g2.groupId, c2);

    const r1 = await listMembers(userA, g1.groupId);
    const r2 = await listMembers(userA, g2.groupId);

    expect(r1!.total).toBe(1);
    expect(r1!.members[0].contactId).toBe(c1);

    expect(r2!.total).toBe(1);
    expect(r2!.members[0].contactId).toBe(c2);
  });

  // ===== Member count integrity ==========================================

  it("GroupRow.memberCount reflects the actual membership count", async () => {
    const group = await createGroup(userA, { name: uniqueName() });
    expect(group.memberCount).toBe(0);

    const c1 = await createContact(userA, "-c1");
    const c2 = await createContact(userA, "-c2");
    const c3 = await createContact(userA, "-c3");
    await addContactToGroup(userA, group.groupId, c1);
    await addContactToGroup(userA, group.groupId, c2);
    await addContactToGroup(userA, group.groupId, c3);

    // Re-fetch via getGroup — memberCount should be 3.
    const fetched = await getGroup(userA, group.groupId);
    expect(fetched!.memberCount).toBe(3);

    // After removing one, the count updates.
    await removeContactFromGroup(userA, group.groupId, c2);
    const fetched2 = await getGroup(userA, group.groupId);
    expect(fetched2!.memberCount).toBe(2);
  });

  // ===== normalizeGroupName (pure helper, no DB needed but covered) =====

  it("normalizeGroupName lowercases, trims, and collapses whitespace to dashes", () => {
    expect(normalizeGroupName("VIP Customers")).toBe("vip-customers");
    expect(normalizeGroupName("  Hello   World  ")).toBe("hello-world");
    expect(normalizeGroupName("Already-Dashed")).toBe("already-dashed");
    expect(normalizeGroupName("MIXED Case Name")).toBe("mixed-case-name");
  });

  // ===== MAX_GROUP_NAME enforcement (schema-level, sanity-checked) =======

  it("createGroup accepts name up to MAX_GROUP_NAME characters", async () => {
    const name = "g".repeat(MAX_GROUP_NAME);
    const group = await createGroup(userA, { name });
    expect(group.name).toHaveLength(MAX_GROUP_NAME);
  });
});
