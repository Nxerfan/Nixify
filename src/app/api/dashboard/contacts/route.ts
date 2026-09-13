import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  upsertContact,
  listContacts,
  ContactValidationError,
  CONTACT_SOURCES,
} from "@/lib/contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  email: z.string().trim().min(1, "Email is required").max(254),
  name: z.string().trim().max(200).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/dashboard/contacts
 *
 * List the authenticated user's contacts. Paginated, searchable.
 * Session-authenticated (not API-key). Uses the Contacts service layer.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  // Entitlement check — access-gated, NOT plan-name check
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Contacts is not available on your current account." } },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const pageStr = url.searchParams.get("page") ?? "1";
  const pageSizeStr = url.searchParams.get("pageSize") ?? "20";
  const search = url.searchParams.get("search")?.trim() || undefined;

  const page = Number(pageStr);
  const pageSize = Number(pageSizeStr);

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

  const result = await listContacts(user.id, { page, pageSize, search });

  return NextResponse.json({
    contacts: result.contacts.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      source: c.source,
      marketing_status: c.marketingStatus,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
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
 * POST /api/dashboard/contacts
 *
 * Create or upsert a contact for the authenticated user.
 * Dashboard-created contacts use source="dashboard" (not "api").
 * The source is set internally — never accepted from the client.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Contacts is not available on your current account." } },
      { status: 403 },
    );
  }

  let body: z.infer<typeof createSchema>;
  try {
    const json = await req.json();
    const result = createSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i: any) => i.message).join("; ");
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
    const result = await upsertContact(user.id, {
      email: body.email,
      name: body.name,
      attributes: body.attributes as Record<string, unknown> | undefined,
      source: CONTACT_SOURCES.DASHBOARD, // Always "dashboard" from the UI
    });

    return NextResponse.json(
      {
        id: result.contact.id,
        email: result.contact.email,
        name: result.contact.name,
        source: result.contact.source,
        marketing_status: result.contact.marketingStatus,
        created: result.created,
        changed: result.changed,
        created_at: result.contact.createdAt.toISOString(),
        updated_at: result.contact.updatedAt.toISOString(),
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (e) {
    if (e instanceof ContactValidationError) {
      return NextResponse.json(
        { error: { code: "validation_failed", message: e.message } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to create contact." } },
      { status: 500 },
    );
  }
}
