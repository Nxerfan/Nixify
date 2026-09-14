/**
 * Transactional Template service layer (Phase 3, sections 7, 19, 23, 24).
 *
 * ALL persistence operations take `userId` explicitly (tenant isolation,
 * section 19). No query ever runs without a userId filter. AdminUser.id is
 * NOT a User.id — this module never accepts admin IDs.
 *
 * Versioning invariant (section 7):
 *   - Template versions are IMMUTABLE. An existing version row is never
 *     updated. Content edits append a new version N+1.
 *   - Version-number allocation is concurrency-safe: inside a single DB
 *     transaction we atomically increment parent.currentVersion, use the
 *     returned number for the new immutable version row, and create it in
 *     the same transaction. If the version insert fails, the whole tx
 *     rolls back (including the increment).
 *   - We do NOT use SELECT MAX(version)+1 outside a transaction.
 *
 * Update semantics (section 23):
 *   - Metadata-only edits (name/description) do NOT create a new version.
 *   - Content edits (subject/html/text) create a new version IF the content
 *     actually changed after normalization. Identical content → no new version.
 */
import { db } from "@/lib/db";
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  type CreateTemplateInput,
  type PatchTemplateInput,
} from "./validation";
import { extractVariables } from "./variables";
import { sanitizeTemplateHtml } from "./sanitize";

// ---- Types ----------------------------------------------------------------

export interface TemplateVersionRow {
  id: number;
  templateId: number;
  version: number;
  subject: string;
  html: string;
  text: string | null;
  variables: string[];
  createdAt: Date;
}

export interface TemplateRow {
  id: number;
  userId: number;
  name: string;
  slug: string;
  description: string | null;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateDetail extends TemplateRow {
  /** Current version content (the version matching currentVersion). */
  current: TemplateVersionRow;
  /** Lightweight version history (version, createdAt, subject, variables). */
  versions: Array<{
    version: number;
    createdAt: Date;
    subject: string;
    variables: string[];
  }>;
}

export interface CreateResult {
  template: TemplateRow;
  version: TemplateVersionRow;
}

export interface UpdateResult {
  template: TemplateRow;
  /** The new version if one was created, else null. */
  newVersion: TemplateVersionRow | null;
  /** The current version content after the update. */
  current: TemplateVersionRow;
  /** True if a new immutable version was created. */
  versionCreated: boolean;
}

// ---- Errors ----------------------------------------------------------------

export class TemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateValidationError";
  }
}

export class TemplateNotFoundError extends Error {
  constructor() {
    super("Template not found.");
    this.name = "TemplateNotFoundError";
  }
}

// ---- Normalization helpers -------------------------------------------------

/** Normalize a content field for change-detection: trim trailing whitespace. */
function normalizeContent(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/** Convert a DB version row (variables is Json) to a typed row. */
function toVersionRow(v: {
  id: number;
  templateId: number;
  version: number;
  subject: string;
  html: string;
  text: string | null;
  variables: unknown;
  createdAt: Date;
}): TemplateVersionRow {
  let vars: string[];
  if (Array.isArray(v.variables)) {
    vars = v.variables.filter((x): x is string => typeof x === "string");
  } else {
    vars = [];
  }
  return {
    id: v.id,
    templateId: v.templateId,
    version: v.version,
    subject: v.subject,
    html: v.html,
    text: v.text,
    variables: vars,
    createdAt: v.createdAt,
  };
}

// ---- Create (section 22) ---------------------------------------------------

/**
 * Create a template + version 1 atomically.
 * Sanitizes the HTML before storage, extracts variables from subject+html+text.
 */
export async function createTemplate(
  userId: number,
  input: CreateTemplateInput,
): Promise<CreateResult> {
  // Slug uniqueness is enforced at the DB level (@@unique([userId, slug])).
  // We catch P2002 and throw a friendly validation error.

  const sanitizedHtml = sanitizeTemplateHtml(input.html);
  const variables = extractVariables(input.subject, sanitizedHtml, input.text);

  try {
    const result = await db.$transaction(async (tx) => {
      const template = await tx.transactionalTemplate.create({
        data: {
          userId,
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          currentVersion: 1,
        },
      });

      const version = await tx.transactionalTemplateVersion.create({
        data: {
          templateId: template.id,
          version: 1,
          subject: input.subject,
          html: sanitizedHtml,
          text: input.text ?? null,
          variables: variables,
        },
      });

      return { template, version };
    });

    return {
      template: toTemplateRow(result.template),
      version: toVersionRow(result.version),
    };
  } catch (e: any) {
    if (e?.code === "P2002") {
      throw new TemplateValidationError(
        "A template with this slug already exists. Choose a different slug.",
      );
    }
    throw e;
  }
}

// ---- List (section 19) -----------------------------------------------------

export async function listTemplates(
  userId: number,
  opts: { page?: number; pageSize?: number; search?: string } = {},
): Promise<{ templates: TemplateRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const search = opts.search?.trim();

  const where = {
    userId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [templates, total] = await Promise.all([
    db.transactionalTemplate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.transactionalTemplate.count({ where }),
  ]);

  return {
    templates: templates.map(toTemplateRow),
    total,
    page,
    pageSize,
  };
}

// ---- Get detail (section 24) -----------------------------------------------

export async function getTemplate(userId: number, templateId: number): Promise<TemplateDetail | null> {
  const template = await db.transactionalTemplate.findFirst({
    where: { id: templateId, userId },
  });
  if (!template) return null;

  const versions = await db.transactionalTemplateVersion.findMany({
    where: { templateId },
    orderBy: { version: "asc" },
  });

  const currentRow = versions.find((v) => v.version === template.currentVersion) ?? versions[versions.length - 1];
  if (!currentRow) return null;

  return {
    ...toTemplateRow(template),
    current: toVersionRow(currentRow),
    versions: versions.map((v) => ({
      version: v.version,
      createdAt: v.createdAt,
      subject: v.subject,
      variables: Array.isArray(v.variables) ? (v.variables as unknown[]).filter((x): x is string => typeof x === "string") : [],
    })),
  };
}

// ---- Get specific version (section 24) ------------------------------------

export async function getVersion(
  userId: number,
  templateId: number,
  version: number,
): Promise<TemplateVersionRow | null> {
  // Verify ownership first (tenant-safe — no existence leakage).
  const owned = await db.transactionalTemplate.findFirst({
    where: { id: templateId, userId },
    select: { id: true },
  });
  if (!owned) return null;

  const v = await db.transactionalTemplateVersion.findUnique({
    where: { templateId_version: { templateId, version } },
  });
  if (!v) return null;
  return toVersionRow(v);
}

// ---- List versions (section 24) -------------------------------------------

export async function listVersions(
  userId: number,
  templateId: number,
): Promise<TemplateVersionRow[] | null> {
  const owned = await db.transactionalTemplate.findFirst({
    where: { id: templateId, userId },
    select: { id: true },
  });
  if (!owned) return null;

  const versions = await db.transactionalTemplateVersion.findMany({
    where: { templateId },
    orderBy: { version: "desc" },
  });
  return versions.map(toVersionRow);
}

// ---- Update (section 23) ---------------------------------------------------

/**
 * Update a template. Metadata-only edits don't create a version.
 * Content edits create a new immutable version IF content changed.
 *
 * Slug is IMMUTABLE after creation (section 8) — this function never
 * accepts a slug field. The PATCH route's zod schema omits slug entirely.
 */
export async function updateTemplate(
  userId: number,
  templateId: number,
  input: PatchTemplateInput,
): Promise<UpdateResult> {
  const template = await db.transactionalTemplate.findFirst({
    where: { id: templateId, userId },
  });
  if (!template) throw new TemplateNotFoundError();

  // Detect content changes (subject/html/text). Normalize before comparing.
  const currentVersion = await db.transactionalTemplateVersion.findUnique({
    where: { templateId_version: { templateId, version: template.currentVersion } },
  });
  if (!currentVersion) throw new Error("Current version row missing — data integrity error.");

  const newSubject = input.subject !== undefined ? input.subject.trim() : currentVersion.subject;
  const newHtmlRaw = input.html !== undefined ? input.html : currentVersion.html;
  const newHtml = input.html !== undefined ? sanitizeTemplateHtml(input.html) : currentVersion.html;
  const newText = input.text !== undefined ? (input.text.trim() || null) : currentVersion.text;

  const subjectChanged = normalizeContent(newSubject) !== normalizeContent(currentVersion.subject);
  const htmlChanged = normalizeContent(newHtml) !== normalizeContent(currentVersion.html);
  const textChanged = normalizeContent(newText) !== normalizeContent(currentVersion.text);
  const contentChanged = subjectChanged || htmlChanged || textChanged;

  // Metadata-only updates (name/description) never create a version.
  const metadataUpdates: Record<string, unknown> = {};
  if (input.name !== undefined && input.name.trim() !== template.name) {
    metadataUpdates.name = input.name.trim();
  }
  if (input.description !== undefined) {
    const desc = input.description?.trim() || null;
    if (desc !== template.description) {
      metadataUpdates.description = desc;
    }
  }

  // If no metadata AND no content changed → return current, no writes.
  if (!contentChanged && Object.keys(metadataUpdates).length === 0) {
    return {
      template: toTemplateRow(template),
      newVersion: null,
      current: toVersionRow(currentVersion),
      versionCreated: false,
    };
  }

  // Execute inside a transaction: metadata update + (optional) new version.
  const result = await db.$transaction(async (tx) => {
    // Apply metadata update (if any).
    let updatedTemplate = template;
    if (Object.keys(metadataUpdates).length > 0) {
      updatedTemplate = await tx.transactionalTemplate.update({
        where: { id: templateId },
        data: metadataUpdates,
      });
    }

    if (!contentChanged) {
      // Metadata-only — no new version. Touch updatedAt.
      updatedTemplate = await tx.transactionalTemplate.update({
        where: { id: templateId },
        data: {},
      });
      return { template: updatedTemplate, newVersion: null as TemplateVersionRow | null };
    }

    // Concurrency-safe version allocation (section 7):
    // Atomically increment currentVersion, use the returned value for the new
    // immutable version row. If the insert fails, the tx rolls back the increment.
    const incremented = await tx.transactionalTemplate.update({
      where: { id: templateId },
      data: { currentVersion: { increment: 1 } },
      select: { currentVersion: true },
    });
    const nextVersion = incremented.currentVersion;

    const variables = extractVariables(newSubject, newHtml, newText);

    const newVersionRow = await tx.transactionalTemplateVersion.create({
      data: {
        templateId,
        version: nextVersion,
        subject: newSubject,
        html: newHtml,
        text: newText,
        variables,
      },
    });

    return { template: incremented, newVersion: newVersionRow };
  });

  // Re-fetch the full template row (the increment select only returned currentVersion).
  const finalTemplate = await db.transactionalTemplate.findUnique({
    where: { id: templateId },
  });
  if (!finalTemplate) throw new Error("Template vanished mid-transaction.");

  return {
    template: toTemplateRow(finalTemplate),
    newVersion: result.newVersion ? toVersionRow(result.newVersion) : null,
    current: result.newVersion
      ? toVersionRow(result.newVersion)
      : toVersionRow(currentVersion),
    versionCreated: result.newVersion !== null,
  };
}

// ---- Delete (section 24) ---------------------------------------------------

/**
 * Delete a template. Tenant-scoped — returns false if not owned.
 * Versions cascade-delete (schema-level onDelete: Cascade).
 */
export async function deleteTemplate(userId: number, templateId: number): Promise<boolean> {
  const owned = await db.transactionalTemplate.findFirst({
    where: { id: templateId, userId },
    select: { id: true },
  });
  if (!owned) return false;

  await db.transactionalTemplate.delete({ where: { id: templateId } });
  return true;
}

// ---- Helpers ---------------------------------------------------------------

function toTemplateRow(t: {
  id: number;
  userId: number;
  name: string;
  slug: string;
  description: string | null;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): TemplateRow {
  return {
    id: t.id,
    userId: t.userId,
    name: t.name,
    slug: t.slug,
    description: t.description,
    currentVersion: t.currentVersion,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// Re-export the limits + validation helpers for route consumers.
export { MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH };
