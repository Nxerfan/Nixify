/**
 * Automation configuration service (Phase 5, sections 9, 17, 18).
 *
 * Tenant-owned settings for built-in automations. Phase 5 has exactly one
 * automation type: "otp_verified_welcome" — sends a welcome email after
 * successful OTP verification.
 *
 * Non-consuming entitlement gate: canAccess(userId, FEATURE_KEYS.AUTOMATIONS).
 * Does NOT consume API_MESSAGES or any quota. The welcome email itself
 * consumes MESSAGING_EMAILS through the Phase 4 messaging service.
 */
import { db } from "@/lib/db";
import { getTemplate } from "@/lib/transactional-templates";

// ---- Constants -------------------------------------------------------------

/** The only automation type in Phase 5. */
export const AUTOMATION_TYPE_OTP_VERIFIED_WELCOME = "otp_verified_welcome";

/** Built-in variables the automation can always provide. */
export const BUILT_IN_VARIABLES = ["email", "name"] as const;

// ---- Types -----------------------------------------------------------------

export interface AutomationConfigRow {
  id: number;
  userId: number;
  type: string;
  enabled: boolean;
  templateId: number | null;
  templateVariables: string[] | null; // variables required by the selected template
  compatible: boolean | null; // whether built-in vars satisfy the template
  createdAt: Date;
  updatedAt: Date;
}

// ---- Service functions -----------------------------------------------------

/** Get the user's automation setting for the welcome email. */
export async function getAutomationSetting(
  userId: number,
  type: string = AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
): Promise<AutomationConfigRow | null> {
  const setting = await db.automationSetting.findUnique({
    where: { userId_type: { userId, type } },
  });
  if (!setting) return null;
  return resolveConfig(setting);
}

/**
 * Upsert the automation setting. Tenant-scoped — the templateId (if provided)
 * must belong to the same user, otherwise it's rejected.
 */
export async function upsertAutomationSetting(
  userId: number,
  input: { enabled: boolean; templateId?: number | null },
  type: string = AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
): Promise<AutomationConfigRow> {
  // Validate template ownership if a templateId is provided.
  if (input.templateId != null) {
    const tmpl = await db.transactionalTemplate.findFirst({
      where: { id: input.templateId, userId },
      select: { id: true },
    });
    if (!tmpl) {
      throw new AutomationConfigError(
        "template_not_found",
        "Template not found or not owned by your account.",
      );
    }
  }

  const upserted = await db.automationSetting.upsert({
    where: { userId_type: { userId, type } },
    create: {
      userId,
      type,
      enabled: input.enabled,
      templateId: input.templateId ?? null,
    },
    update: {
      enabled: input.enabled,
      templateId: input.templateId ?? null,
    },
  });
  return resolveConfig(upserted);
}

// ---- Helpers ---------------------------------------------------------------

/** Resolve the full config row including template variables + compatibility. */
async function resolveConfig(setting: {
  id: number; userId: number; type: string; enabled: boolean;
  templateId: number | null; createdAt: Date; updatedAt: Date;
}): Promise<AutomationConfigRow> {
  let templateVariables: string[] | null = null;
  let compatible: boolean | null = null;

  if (setting.templateId != null) {
    const detail = await getTemplate(setting.userId, setting.templateId);
    if (detail) {
      templateVariables = detail.current.variables;
      // Compatible if every required variable is in the built-in set.
      compatible = detail.current.variables.every((v) =>
        (BUILT_IN_VARIABLES as readonly string[]).includes(v),
      );
    } else {
      // Template was deleted — not compatible.
      templateVariables = null;
      compatible = false;
    }
  }

  return {
    id: setting.id,
    userId: setting.userId,
    type: setting.type,
    enabled: setting.enabled,
    templateId: setting.templateId,
    templateVariables,
    compatible,
    createdAt: setting.createdAt,
    updatedAt: setting.updatedAt,
  };
}

// ---- Errors ----------------------------------------------------------------

export class AutomationConfigError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "AutomationConfigError";
  }
}
