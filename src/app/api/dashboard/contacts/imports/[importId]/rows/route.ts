import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { getImport, getImportRows, PREVIEW_SAMPLE_SIZE } from "@/lib/imports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/contacts/imports/:importId/rows
 *
 * Preview rows for a staged import. Bounded to PREVIEW_SAMPLE_SIZE per
 * page (default 100) — this is a preview, not a bulk export. The caller
 * can filter by status (staged|imported|existing|invalid|failed|duplicate_file)
 * using the `?status=` query param.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ importId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const access = await canAccess(user.id, FEATURE_KEYS.CONTACT_IMPORT);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Contact Import is not available on your current account." } },
      { status: 403 },
    );
  }

  const { importId } = await params;
  if (!importId) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "importId is required." } },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const pageStr = url.searchParams.get("page") ?? "1";
  const pageSizeStr = url.searchParams.get("pageSize") ?? String(PREVIEW_SAMPLE_SIZE);
  const statusFilter = url.searchParams.get("status")?.trim() || undefined;

  const page = Number(pageStr);
  const pageSize = Number(pageSizeStr);

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "page must be a positive integer." } },
      { status: 400 },
    );
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > PREVIEW_SAMPLE_SIZE) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: `pageSize must be a positive integer (max ${PREVIEW_SAMPLE_SIZE}).` } },
      { status: 400 },
    );
  }

  const result = await getImportRows(user.id, importId, {
    page,
    pageSize,
    status: statusFilter,
  });

  if (!result) {
    return NextResponse.json(
      { error: { code: "import_not_found", message: "Import not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    rows: result.rows.map((r) => ({
      row_number: r.rowNumber,
      email: r.email,
      name: r.name,
      status: r.status,
      error_code: r.errorCode,
    })),
    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / pageSize),
    },
  });
}
