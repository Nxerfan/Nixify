import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { listVersions } from "@/lib/transactional-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/templates/:id/versions
 *
 * List all immutable versions of a template (newest first).
 * Tenant-scoped: returns 404 if the template is not owned.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid template ID." } },
      { status: 400 },
    );
  }

  const versions = await listVersions(user.id, id);
  if (versions === null) {
    return NextResponse.json(
      { error: { code: "template_not_found", message: "Template not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    versions: versions.map((v) => ({
      version: v.version,
      subject: v.subject,
      variables: v.variables,
      created_at: v.createdAt.toISOString(),
    })),
  });
}
