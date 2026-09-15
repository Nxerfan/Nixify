/**
 * Groups service (Phase 8, sections 5, 6, 7).
 *
 * Tenant-owned static groups for organizing contacts. DB-level tenant safety
 * via composite foreign keys on ContactGroupMembership (userId + groupId AND
 * userId + contactId). Cross-tenant membership is structurally impossible.
 *
 * Membership is idempotent: adding the same contact twice is a no-op (unique
 * constraint on (groupId, contactId)). Removing an absent membership is also
 * a safe no-op.
 */
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/contacts";

// ---- Types -----------------------------------------------------------------

export interface GroupRow {
  id: number;
  groupId: string;
  userId: number;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipRow {
  id: number;
  userId: number;
  groupId: number;
  contactId: number;
  source: string;
  createdAt: Date;
  contactEmail: string;
  contactName: string | null;
}

// ---- Constants -------------------------------------------------------------

export const MAX_GROUP_NAME = 120;
export const MAX_GROUP_DESCRIPTION = 500;
export const MAX_BULK_ADD = 100;

// ---- Validation ------------------------------------------------------------

export function normalizeGroupName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

// ---- Group CRUD ------------------------------------------------------------

export async function createGroup(
  userId: number,
  input: { name: string; description?: string },
): Promise<GroupRow> {
  const name = input.name.trim();
  const normalizedName = normalizeGroupName(name);
  const description = input.description?.trim() || null;

  const group = await db.group.create({
    data: { userId, name, normalizedName, description },
  });
  return toGroupRow(group, 0);
}

export async function listGroups(
  userId: number,
  opts: { page?: number; pageSize?: number; search?: string } = {},
): Promise<{ groups: GroupRow[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const search = opts.search?.trim();

  const where = {
    userId,
    ...(search
      ? { OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { normalizedName: { contains: search.toLowerCase() } },
        ] }
      : {}),
  };

  const [groups, total] = await Promise.all([
    db.group.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { memberships: true } } },
    }),
    db.group.count({ where }),
  ]);

  return {
    groups: groups.map((g) => toGroupRow(g, g._count?.memberships ?? 0)),
    total,
  };
}

export async function getGroup(userId: number, groupId: string): Promise<GroupRow | null> {
  const group = await db.group.findFirst({
    where: { groupId, userId },
    include: { _count: { select: { memberships: true } } },
  });
  if (!group) return null;
  return toGroupRow(group, group._count?.memberships ?? 0);
}

export async function updateGroup(
  userId: number,
  groupId: string,
  input: { name?: string; description?: string },
): Promise<GroupRow | null> {
  const existing = await db.group.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    data.name = name;
    data.normalizedName = normalizeGroupName(name);
  }
  if (input.description !== undefined) {
    data.description = input.description.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return getGroup(userId, groupId);
  }

  const updated = await db.group.update({
    where: { id: existing.id },
    data,
    include: { _count: { select: { memberships: true } } },
  });
  return toGroupRow(updated, updated._count?.memberships ?? 0);
}

export async function deleteGroup(userId: number, groupId: string): Promise<boolean> {
  const existing = await db.group.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
  if (!existing) return false;

  await db.group.delete({ where: { id: existing.id } });
  return true;
}

// ---- Membership management -------------------------------------------------

export async function listMembers(
  userId: number,
  groupId: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<{ members: MembershipRow[]; total: number } | null> {
  const group = await db.group.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
  if (!group) return null;

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));

  const [memberships, total] = await Promise.all([
    db.contactGroupMembership.findMany({
      where: { groupId: group.id, userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { contact: { select: { email: true, name: true } } },
    }),
    db.contactGroupMembership.count({ where: { groupId: group.id, userId } }),
  ]);

  return {
    members: memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      groupId: m.groupId,
      contactId: m.contactId,
      source: m.source,
      createdAt: m.createdAt,
      contactEmail: m.contact.email,
      contactName: m.contact.name,
    })),
    total,
  };
}

export async function addContactToGroup(
  userId: number,
  groupId: string,
  contactId: number,
  source: string = "manual",
): Promise<{ added: boolean }> {
  const group = await db.group.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
  if (!group) return { added: false };

  // Verify the contact belongs to the same user (tenant safety).
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });
  if (!contact) return { added: false };

  try {
    await db.contactGroupMembership.create({
      data: { userId, groupId: group.id, contactId, source },
    });
    return { added: true };
  } catch (e: any) {
    if (e?.code === "P2002") return { added: false }; // already a member — idempotent
    throw e;
  }
}

export async function bulkAddContactsToGroup(
  userId: number,
  groupId: string,
  contactIds: number[],
  source: string = "manual",
): Promise<{ added: number; skipped: number }> {
  const ids = contactIds.slice(0, MAX_BULK_ADD);
  const group = await db.group.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
  if (!group) return { added: 0, skipped: ids.length };

  // Verify all contacts belong to the same user.
  const validContacts = await db.contact.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true },
  });
  const validIds = validContacts.map((c) => c.id);

  let added = 0;
  let skipped = 0;

  for (const contactId of validIds) {
    try {
      await db.contactGroupMembership.create({
        data: { userId, groupId: group.id, contactId, source },
      });
      added++;
    } catch (e: any) {
      if (e?.code === "P2002") skipped++; // already a member
      else throw e;
    }
  }

  return { added, skipped: skipped + (ids.length - validIds.length) };
}

export async function removeContactFromGroup(
  userId: number,
  groupId: string,
  contactId: number,
): Promise<{ removed: boolean }> {
  const group = await db.group.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
  if (!group) return { removed: false };

  const result = await db.contactGroupMembership.deleteMany({
    where: { groupId: group.id, contactId, userId },
  });
  return { removed: result.count > 0 };
}

// ---- Helper ----------------------------------------------------------------

function toGroupRow(
  g: {
    id: number; groupId: string; userId: number; name: string;
    description: string | null; createdAt: Date; updatedAt: Date;
  },
  memberCount: number,
): GroupRow {
  return {
    id: g.id,
    groupId: g.groupId,
    userId: g.userId,
    name: g.name,
    description: g.description,
    memberCount,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}
