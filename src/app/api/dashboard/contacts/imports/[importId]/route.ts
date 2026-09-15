import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { getImport, cancelImport, type ImportSummary } from "@/lib/imports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/contacts/imports/:importId
 *
 * Fetch a single import summary by its public UUID. Returns 404 if the
 * import doesn't exist or belongs to a different tenant.
 */
export async function GET(
  _req: NextRequest,
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

  const summary = await getImport(user.id, importId);
  if (!summary) {
    return NextResponse.json(
      { error: { code: "import_not_found", message: "Import not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json(serializeSummary(summary));
}

/**
 * DELETE /api/dashboard/contacts/imports/:importId
 *
 * Cancel an import. Only allowed in the `preview_ready` state — once an
 * import has been confirmed (transitioned to `queued`), it cannot be
 * cancelled via this route. The processor handles in-flight runs.
 *
 * Idempotent: returns 200 with `cancelled: false` if the import was
 * not in a cancellable state (already cancelled, queued, processing,
 * completed, or failed).
 */
export async function DELETE(
  _req: NextRequest,
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

  // Verify ownership first so 404 semantics are correct for unknown imports.
  const existing = await getImport(user.id, importId);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "import_not_found", message: "Import not found." } },
      { status: 404 },
    );
  }

  // Only `preview_ready` can be cancelled. Other states are immutable from
  // the user's perspective (queued/processing is owned by the processor;
  // terminal states are already terminal).
  if (existing.status !== "preview_ready") {
    return NextResponse.json(
      { error: { code: "invalid_state", message: `Cannot cancel an import in state '${existing.status}'.` } },
      { status: 409 },
    );
  }

  const cancelled = await cancelImport(user.id, importId);
  return NextResponse.json({ cancelled });
}

function serializeSummary(s: ImportSummary) {
  return {
    import_id: s.importId,
    status: s.status,
    format: s.format,
    total_rows: s.totalRows,
    valid_rows: s.validRows,
    invalid_rows: s.invalidRows,
    duplicate_rows: s.duplicateRows,
    existing_rows: s.existingRows,
    imported_rows: s.importedRows,
    failed_rows: s.failedRows,
    target_group_id: s.targetGroupId,
    created_at: s.createdAt.toISOString(),
    confirmed_at: s.confirmedAt?.toISOString() ?? null,
    completed_at: s.completedAt?.toISOString() ?? null,
  };
}
