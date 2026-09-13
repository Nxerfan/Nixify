/**
 * Contacts service layer — all tenant-scoped Contact operations.
 *
 * CRITICAL: Every function takes `userId` explicitly. Tenant isolation is
 * enforced at the service level — no query is ever executed without a userId
 * filter. This makes it difficult to accidentally bypass ownership.
 *
 * AdminUser.id is NOT User.id. The `userId` parameter always refers to a
 * real User.id — never pass an AdminUser.id here.
 */
import { db } from "@/lib/db";
import {
  normalizeEmail,
  isValidEmail,
  validateAttributes,
  MAX_NAME_LENGTH,
  MAX_ATTRIBUTES_BYTES,
  CONTACT_SOURCES,
  type ContactSource,
} from "./validation";

// ---- Types ----

export interface CreateContactInput {
  email: string;
  name?: string;
  attributes?: Record<string, unknown>;
  source?: ContactSource;
}

export interface UpdateContactInput {
  name?: string;
  attributes?: Record<string, unknown>;
}

export interface UpsertResult {
  contact: ContactWithEvents;
  created: boolean; // true if a new Contact was created
  changed: boolean; // true if any field was modified (create or update with changes)
}

export interface ContactWithEvents {
  id: number;
  userId: number;
  email: string;
  name: string | null;
  attributes: unknown;
  source: string;
  marketingStatus: string;
  marketingConsentSource: string | null;
  marketingConsentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  events?: ContactEventRow[];
}

export interface ContactEventRow {
  id: number;
  type: string;
  detail: unknown;
  requestId: string | null;
  createdAt: Date;
}

// ---- Service functions ----

/**
 * Create or idempotently upsert a Contact.
 * Identity: (userId, normalized email).
 *
 * Returns explicit mutation metadata:
 *   created: true if a new Contact row was created
 *   changed: true if any field was modified (create counts as changed)
 *
 * If the contact already exists with identical data, no DB mutation occurs
 * and changed=false (no timeline event created).
 */
export async function upsertContact(
  userId: number,
  input: CreateContactInput,
): Promise<UpsertResult> {
  // Service-level email validation (not just HTTP route validation)
  // Normalize first, then validate the normalized form
  if (!input.email || typeof input.email !== "string") {
    throw new ContactValidationError("Enter a valid email address.");
  }

  const email = normalizeEmail(input.email);

  if (!isValidEmail(email)) {
    throw new ContactValidationError("Enter a valid email address.");
  }
  const name = input.name?.trim() || null;
  const source = input.source ?? CONTACT_SOURCES.API;

  const attributesResult = validateAttributes(input.attributes);
  if (!attributesResult.valid) {
    throw new ContactValidationError(attributesResult.error);
  }
  const attributes = attributesResult.value;

  // Check if contact already exists
  const existing = await db.contact.findUnique({
    where: { userId_email: { userId, email } },
  });

  if (existing) {
    // Determine if any field actually changed
    const nameChanged = name !== null && name !== existing.name;
    const attrsChanged = JSON.stringify(attributes) !== JSON.stringify(existing.attributes);

    if (!nameChanged && !attrsChanged) {
      // No-op — return existing contact without mutation or event
      return {
        contact: toContactWithEvents(existing),
        created: false,
        changed: false,
      };
    }

    // Update with only changed fields
    const updates: Record<string, unknown> = {};
    if (nameChanged) updates.name = name;
    if (attrsChanged) updates.attributes = attributes as any;

    const updated = await db.contact.update({
      where: { id: existing.id },
      data: updates,
    });

    await addContactEvent(userId, updated.id, "contact.updated", {
      fields: Object.keys(updates),
    });

    return {
      contact: toContactWithEvents(updated),
      created: false,
      changed: true,
    };
  }

  // Create new contact
  const contact = await db.contact.create({
    data: {
      userId,
      email,
      name,
      attributes: attributes as any,
      source,
    },
  });

  await addContactEvent(userId, contact.id, "contact.created");

  return {
    contact: toContactWithEvents(contact),
    created: true,
    changed: true,
  };
}

/**
 * Get a single Contact by ID. Tenant-scoped — returns null if the contact
 * doesn't belong to `userId`.
 */
export async function getContactById(
  userId: number,
  contactId: number,
): Promise<ContactWithEvents | null> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
  });
  if (!contact) return null;
  return toContactWithEvents(contact);
}

/**
 * Get a single Contact by email. Tenant-scoped — returns null if the contact
 * doesn't belong to `userId`.
 */
export async function getContactByEmail(
  userId: number,
  email: string,
): Promise<ContactWithEvents | null> {
  const normalized = normalizeEmail(email);
  const contact = await db.contact.findFirst({
    where: { userId, email: normalized },
  });
  if (!contact) return null;
  return toContactWithEvents(contact);
}

/**
 * List contacts with pagination and search. Tenant-scoped.
 * Uses offset pagination (consistent with existing Nixify patterns).
 */
export async function listContacts(
  userId: number,
  opts: {
    page?: number;
    pageSize?: number;
    search?: string;
  } = {},
): Promise<{ contacts: ContactWithEvents[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const search = opts.search?.trim();

  const where = {
    userId,
    ...(search
      ? {
          OR: [
            { email: { contains: search.toLowerCase() } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.contact.count({ where }),
  ]);

  return {
    contacts: contacts.map(toContactWithEvents),
    total,
    page,
    pageSize,
  };
}

/**
 * Update a Contact. Tenant-scoped — returns null if the contact doesn't belong
 * to `userId`. Only updates `name` and `attributes` (mass-assignment safe).
 * Creates a "contact.updated" event only if meaningful data changed.
 */
export async function updateContact(
  userId: number,
  contactId: number,
  input: UpdateContactInput,
): Promise<ContactWithEvents | null> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
  });
  if (!contact) return null;

  const updates: Record<string, unknown> = {};
  let hasChanges = false;

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name !== contact.name) {
      updates.name = name || null;
      hasChanges = true;
    }
  }

  if (input.attributes !== undefined) {
    const attrsResult = validateAttributes(input.attributes);
    if (!attrsResult.valid) {
      throw new ContactValidationError(attrsResult.error);
    }
    if (JSON.stringify(attrsResult.value) !== JSON.stringify(contact.attributes)) {
      updates.attributes = attrsResult.value as any;
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    return toContactWithEvents(contact);
  }

  const updated = await db.contact.update({
    where: { id: contactId },
    data: updates,
  });

  await addContactEvent(userId, contactId, "contact.updated", {
    fields: Object.keys(updates),
  });

  return toContactWithEvents(updated);
}

/**
 * Delete a Contact. Tenant-scoped — returns false if the contact doesn't
 * belong to `userId`. ContactEvent rows cascade-delete (schema-level).
 */
export async function deleteContact(
  userId: number,
  contactId: number,
): Promise<boolean> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });
  if (!contact) return false;

  await db.contact.delete({ where: { id: contactId } });
  return true;
}

/**
 * Add a timeline event to a Contact. Tenant-scoped — verifies ownership before
 * creating the event. Throws if the contact doesn't belong to `userId`.
 */
export async function addContactEvent(
  userId: number,
  contactId: number,
  type: string,
  detail?: Record<string, unknown>,
  requestId?: string,
): Promise<void> {
  // Verify ownership before creating the event
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });
  if (!contact) {
    throw new Error(`Contact ${contactId} not found for user ${userId}.`);
  }

  await db.contactEvent.create({
    data: {
      contactId,
      type,
      detail: (detail ?? undefined) as any,
      requestId: requestId ?? undefined,
    },
  });
}

/**
 * Get the Contact's timeline (paginated). Tenant-scoped.
 */
export async function getContactTimeline(
  userId: number,
  contactId: number,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ events: ContactEventRow[]; total: number }> {
  // First verify ownership
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });
  if (!contact) return { events: [], total: 0 };

  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const offset = Math.max(0, opts.offset ?? 0);

  const [events, total] = await Promise.all([
    db.contactEvent.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.contactEvent.count({ where: { contactId } }),
  ]);

  return {
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      detail: e.detail,
      requestId: e.requestId,
      createdAt: e.createdAt,
    })),
    total,
  };
}

// ---- Helpers ----

function toContactWithEvents(contact: {
  id: number;
  userId: number;
  email: string;
  name: string | null;
  attributes: unknown;
  source: string;
  marketingStatus: string;
  marketingConsentSource: string | null;
  marketingConsentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ContactWithEvents {
  return {
    id: contact.id,
    userId: contact.userId,
    email: contact.email,
    name: contact.name,
    attributes: contact.attributes,
    source: contact.source,
    marketingStatus: contact.marketingStatus,
    marketingConsentSource: contact.marketingConsentSource,
    marketingConsentAt: contact.marketingConsentAt,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

// ---- Error class ----

export class ContactValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactValidationError";
  }
}

// Re-export validation utilities for convenience
export { normalizeEmail, isValidEmail, validateAttributes, MAX_NAME_LENGTH, MAX_ATTRIBUTES_BYTES, CONTACT_SOURCES, CONTACT_SOURCES as SOURCES };
export type { ContactSource };
