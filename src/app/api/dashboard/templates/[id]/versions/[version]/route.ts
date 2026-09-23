import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { getVersion } from "@/lib/transactional-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/templates/:id/versions/:version
 *
 * Retrieve a specific historical immutable version (for previewing past content).
 * Tenant-scoped: returns 404 if the template is not owned or the version doesn't exist.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
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

  const { id: idStr, version: versionStr } = await params;
  const id = Number(idStr);
  const version = Number(versionStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid template ID." } },
      { status: 400 },
    );
  }
  if (!Number.isInteger(version) || version <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid version number." } },
      { status: 400 },
    );
  }

  const v = await getVersion(user.id, id, version);
  if (!v) {
    return NextResponse.json(
      { error: { code: "version_not_found", message: "Template version not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    version: v.version,
    subject: v.subject,
    html: v.html,
    text: v.text,
    variables: v.variables,
    created_at: v.createdAt.toISOString(),
  });
}
