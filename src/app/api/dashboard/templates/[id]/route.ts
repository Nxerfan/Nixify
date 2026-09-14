import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
  patchTemplateSchema,
  TemplateValidationError,
  TemplateNotFoundError,
} from "@/lib/transactional-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denyTemplateAccess() {
  return NextResponse.json(
    { error: { code: "feature_not_available", message: "Transactional templates are not available on your current account." } },
    { status: 403 },
  );
}

function requireAuth() {
  return NextResponse.json(
    { error: { code: "unauthorized", message: "Login required." } },
    { status: 401 },
  );
}

async function parseId(params: Promise<{ id: string }>): Promise<number | NextResponse> {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid template ID." } },
      { status: 400 },
    );
  }
  return id;
}

/**
 * GET /api/dashboard/templates/:id
 *
 * Returns template metadata + current version content (sanitized HTML,
 * subject, text, variables) + lightweight version history.
 * Tenant-scoped: 404 if not owned by the authenticated user.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return requireAuth();

  const access = await canAccess(user.id, FEATURE_KEYS.MESSAGING_EMAILS);
  if (!access.allowed) return denyTemplateAccess();

  const idOrErr = await parseId(params);
  if (idOrErr instanceof NextResponse) return idOrErr;
  const id = idOrErr;

  const detail = await getTemplate(user.id, id);
  if (!detail) {
    return NextResponse.json(
      { error: { code: "template_not_found", message: "Template not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: detail.id,
    name: detail.name,
    slug: detail.slug,
    description: detail.description,
    current_version: detail.currentVersion,
    created_at: detail.createdAt.toISOString(),
    updated_at: detail.updatedAt.toISOString(),
    current: {
      version: detail.current.version,
      subject: detail.current.subject,
      html: detail.current.html,
      text: detail.current.text,
      variables: detail.current.variables,
      created_at: detail.current.createdAt.toISOString(),
    },
    versions: detail.versions.map((v) => ({
      version: v.version,
      subject: v.subject,
      variables: v.variables,
      created_at: v.createdAt.toISOString(),
    })),
  });
}

/**
 * PATCH /api/dashboard/templates/:id
 *
 * Update template metadata (name/description) and/or content (subject/html/text).
 * - Metadata-only edits do NOT create a new version.
 * - Content edits create a new immutable version (concurrency-safe allocation).
 * - Identical content (after normalization) does NOT create a new version.
 *
 * Slug is IMMUTABLE after creation — the zod patch schema omits it entirely,
 * so it cannot be mass-assigned. userId is never accepted from the client.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return requireAuth();

  const access = await canAccess(user.id, FEATURE_KEYS.MESSAGING_EMAILS);
  if (!access.allowed) return denyTemplateAccess();

  const idOrErr = await parseId(params);
  if (idOrErr instanceof NextResponse) return idOrErr;
  const id = idOrErr;

  let body;
  try {
    const json = await req.json();
    const result = patchTemplateSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return NextResponse.json(
        { error: { code: "validation_failed", message: msg } },
        { status: 400 },
      );
    }
    body = result.data;
  } catch {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  try {
    const result = await updateTemplate(user.id, id, body);

    return NextResponse.json({
      id: result.template.id,
      name: result.template.name,
      slug: result.template.slug,
      description: result.template.description,
      current_version: result.template.currentVersion,
      version_created: result.versionCreated,
      current: {
        version: result.current.version,
        subject: result.current.subject,
        html: result.current.html,
        text: result.current.text,
        variables: result.current.variables,
        created_at: result.current.createdAt.toISOString(),
      },
      created_at: result.template.createdAt.toISOString(),
      updated_at: result.template.updatedAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof TemplateNotFoundError) {
      return NextResponse.json(
        { error: { code: "template_not_found", message: "Template not found." } },
        { status: 404 },
      );
    }
    if (e instanceof TemplateValidationError) {
      return NextResponse.json(
        { error: { code: "validation_failed", message: e.message } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to update template." } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/dashboard/templates/:id
 *
 * Delete a template. Cascades all version rows (schema-level onDelete: Cascade).
 * Tenant-scoped: 404 if not owned.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return requireAuth();

  const access = await canAccess(user.id, FEATURE_KEYS.MESSAGING_EMAILS);
  if (!access.allowed) return denyTemplateAccess();

  const idOrErr = await parseId(params);
  if (idOrErr instanceof NextResponse) return idOrErr;
  const id = idOrErr;

  const deleted = await deleteTemplate(user.id, id);
  if (!deleted) {
    return NextResponse.json(
      { error: { code: "template_not_found", message: "Template not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
