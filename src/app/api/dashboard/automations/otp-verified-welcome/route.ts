import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  getAutomationSetting,
  upsertAutomationSetting,
  AutomationConfigError,
  AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
} from "@/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  enabled: z.boolean(),
  templateId: z.number().int().positive().nullable().optional(),
});

/**
 * GET /api/dashboard/automations/otp-verified-welcome
 *
 * Returns the tenant's automation setting for the OTP Verified → Welcome Email
 * automation. Includes template variables + compatibility info.
 *
 * Entitlement: canAccess(AUTOMATIONS) — non-consuming. No API_MESSAGES.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const access = await canAccess(user.id, FEATURE_KEYS.AUTOMATIONS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Automations are not available on your current account." } },
      { status: 403 },
    );
  }

  const setting = await getAutomationSetting(user.id, AUTOMATION_TYPE_OTP_VERIFIED_WELCOME);

  return NextResponse.json({
    type: AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
    enabled: setting?.enabled ?? false,
    template_id: setting?.templateId ?? null,
    template_variables: setting?.templateVariables ?? null,
    compatible: setting?.compatible ?? null,
    built_in_variables: ["email", "name"],
    updated_at: setting?.updatedAt?.toISOString() ?? null,
  });
}

/**
 * PUT /api/dashboard/automations/otp-verified-welcome
 *
 * Enable/disable the automation and select a tenant-owned template.
 * Cross-tenant template IDs are rejected. Template compatibility is checked.
 */
export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const access = await canAccess(user.id, FEATURE_KEYS.AUTOMATIONS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Automations are not available on your current account." } },
      { status: 403 },
    );
  }

  let body: z.infer<typeof upsertSchema>;
  try {
    const json = await req.json();
    const result = upsertSchema.safeParse(json);
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
    const setting = await upsertAutomationSetting(user.id, {
      enabled: body.enabled,
      templateId: body.templateId ?? null,
    }, AUTOMATION_TYPE_OTP_VERIFIED_WELCOME);

    return NextResponse.json({
      type: setting.type,
      enabled: setting.enabled,
      template_id: setting.templateId,
      template_variables: setting.templateVariables,
      compatible: setting.compatible,
      built_in_variables: ["email", "name"],
      updated_at: setting.updatedAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof AutomationConfigError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to save automation setting." } },
      { status: 500 },
    );
  }
}
