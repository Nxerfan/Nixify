import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  createTemplate,
  listTemplates,
  createTemplateSchema,
  TemplateValidationError,
} from "@/lib/transactional-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/templates
 *
 * List the authenticated user's transactional templates. Paginated, searchable.
 * Session-authenticated (not API-key). Tenant-scoped via the service layer.
 *
 * Entitlement: MESSAGING_EMAILS used as a NON-CONSUMING access gate (section 20).
 * Listing templates consumes 0 messaging quota.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  // Non-consuming messaging entitlement gate. Templates ride the general
  // messaging capability until packaging is finalized.
  const access = await canAccess(user.id, FEATURE_KEYS.MESSAGING_EMAILS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Transactional templates are not available on your current account." } },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const search = url.searchParams.get("search")?.trim() || undefined;

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "page must be a positive integer." } },
      { status: 400 },
    );
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "pageSize must be a positive integer (max 100)." } },
      { status: 400 },
    );
  }
  if (search && search.length > 200) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "search must be at most 200 characters." } },
      { status: 400 },
    );
  }

  const result = await listTemplates(user.id, { page, pageSize, search });

  return NextResponse.json({
    templates: result.templates.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      current_version: t.currentVersion,
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
    })),
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    },
  });
}

/**
 * POST /api/dashboard/templates
 *
 * Create a new transactional template + version 1 atomically.
 * The service layer sanitizes HTML, extracts variables, and creates both rows
 * in a single transaction.
 *
 * Mass-assignment protection: only name/slug/description/subject/html/text
 * are accepted from the client (via zod). userId comes from the session.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const access = await canAccess(user.id, FEATURE_KEYS.MESSAGING_EMAILS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Transactional templates are not available on your current account." } },
      { status: 403 },
    );
  }

  let body;
  try {
    const json = await req.json();
    const result = createTemplateSchema.safeParse(json);
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
    const result = await createTemplate(user.id, body);

    return NextResponse.json(
      {
        id: result.template.id,
        name: result.template.name,
        slug: result.template.slug,
        description: result.template.description,
        current_version: result.template.currentVersion,
        variables: result.version.variables,
        created_at: result.template.createdAt.toISOString(),
        updated_at: result.template.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof TemplateValidationError) {
      return NextResponse.json(
        { error: { code: "validation_failed", message: e.message } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to create template." } },
      { status: 500 },
    );
  }
}
