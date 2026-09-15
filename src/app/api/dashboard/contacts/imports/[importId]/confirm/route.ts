import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { confirmImport, getImport } from "@/lib/imports";
import { getGroup } from "@/lib/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const confirmSchema = z.object({
  targetGroupId: z.string().trim().min(1, "targetGroupId must be non-empty").optional(),
});

/**
 * POST /api/dashboard/contacts/imports/:importId/confirm
 *
 * Atomically transition an import from `preview_ready` → `queued`.
 * The processor (invoked separately via /api/internal/imports/process)
 * claims queued imports and writes the actual Contact rows.
 *
 * Optional body:
 *   { "targetGroupId": "<uuid>" }  — override the target group set at upload
 *
 * Validation:
 *   - Import must exist and belong to the user (404 otherwise).
 *   - Import must be in `preview_ready` state (409 otherwise).
 *   - If targetGroupId is provided (at confirm OR was set at upload),
 *     GROUPS access is also required.
 *
 * Idempotent: returns 409 `invalid_state` if the import was not in
 * preview_ready state (already confirmed, cancelled, etc).
 */
export async function POST(
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

  // ---- Body parse (optional) ----
  let body: z.infer<typeof confirmSchema>;
  try {
    const text = await req.text();
    if (text.trim().length === 0) {
      body = {};
    } else {
      const json = JSON.parse(text);
      const result = confirmSchema.safeParse(json);
      if (!result.success) {
        const msg = result.error.issues.map((i) => i.message).join("; ");
        return NextResponse.json(
          { error: { code: "validation_failed", message: msg } },
          { status: 400 },
        );
      }
      body = result.data;
    }
  } catch {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  // ---- Ownership check ----
  const existing = await getImport(user.id, importId);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "import_not_found", message: "Import not found." } },
      { status: 404 },
    );
  }

  // ---- Target group resolution ----
  // `undefined` → preserve existing value; `null` → clear; `number` → set.
  let targetGroupIdInt: number | null | undefined = undefined;

  if (body.targetGroupId !== undefined) {
    // Explicit override at confirm time — requires GROUPS access + group must exist.
    const groupsAccess = await canAccess(user.id, FEATURE_KEYS.GROUPS);
    if (!groupsAccess.allowed) {
      return NextResponse.json(
        { error: { code: "feature_not_available", message: "Groups is not available on your current account — cannot target a group." } },
        { status: 403 },
      );
    }

    const targetGroup = await getGroup(user.id, body.targetGroupId);
    if (!targetGroup) {
      return NextResponse.json(
        { error: { code: "group_not_found", message: "Target group not found." } },
        { status: 404 },
      );
    }
    targetGroupIdInt = targetGroup.id;
  } else if (existing.targetGroupId) {
    // Inheriting the upload-time group — also requires GROUPS access.
    const groupsAccess = await canAccess(user.id, FEATURE_KEYS.GROUPS);
    if (!groupsAccess.allowed) {
      // User lost GROUPS access between upload and confirm — clear the target.
      targetGroupIdInt = null;
    }
    // Otherwise preserve the existing value (targetGroupIdInt stays undefined).
    // The Group's existence is enforced by the FK; if it was deleted, the
    // ContactImport.targetGroupId column would already be NULL (ON DELETE SET NULL).
  }

  // ---- Atomic conditional state transition (preview_ready → queued) ----
  const result = await confirmImport(user.id, importId, targetGroupIdInt);

  if (!result.confirmed) {
    return NextResponse.json(
      { error: { code: "invalid_state", message: `Cannot confirm an import in state '${existing.status}'.` } },
      { status: 409 },
    );
  }

  return NextResponse.json({ confirmed: true, import_id: result.importId });
}
