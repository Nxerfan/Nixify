import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { resolveThemesViewer } from "@/lib/themes-auth";
import { getTemplate } from "@/lib/email-themes/templates";
import { z } from "zod";
import { parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1).max(100),
  templateId: z.string().min(1),
  purpose: z
    .enum(["signup", "login", "reset", "verification", "2fa", "all"])
    .default("all"),
  config: z.record(z.string(), z.unknown()),
});

/** POST /api/admin/themes/save — create or update a theme.
 *  Access: any authenticated user. Ownership enforced on updates. Plan-gated. */
export async function POST(req: Request) {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const [data, err] = await parseBody(req as any, saveSchema);
  if (err) return err;

  const template = getTemplate(data.templateId);
  if (!template) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Unknown template.", 400);
  }

  // Entitlement: separate checks for text content vs. visual branding.
  // All plans can edit text content (title, subtitle, etc.);
  // Visual branding (colors, logo, company name) is PRO+ only.
  const { canAccess, checkUsage } = await import("@/lib/entitlements/engine");
  const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");

  // ---- Helper: detect what type of fields changed in the config ----
  function detectChanges(
    newConfig: Record<string, unknown>,
    oldConfig: Record<string, unknown> | null,
  ): { content: boolean; branding: boolean } {
    const result = { content: false, branding: false };

    // Content fields (text copy) — editable by all plans
    const contentFields = ["title", "subtitle", "footerText", "ignoreText"];
    // Branding fields (visual) — PRO+ only
    const brandingFields = [
      "appName",
      "logoUrl",
      "primaryColor",
      "secondaryColor",
      "accentColor",
      "website",
      "supportEmail",
      "defaultFont",
    ];

    if (!oldConfig) {
      // New theme: check the incoming config for content/branding fields.
      // Content fields live under config.content.*
      const incomingContent = newConfig.content as
        Record<string, unknown> | undefined;
      if (incomingContent) {
        for (const field of contentFields) {
          if (
            incomingContent[field] !== undefined &&
            incomingContent[field] !== ""
          ) {
            result.content = true;
            break;
          }
        }
      }
      // Branding fields live under config.branding.* (or at root for legacy compat)
      const incomingBranding = newConfig.branding as
        Record<string, unknown> | undefined;
      if (incomingBranding) {
        for (const field of brandingFields) {
          if (
            incomingBranding[field] !== undefined &&
            incomingBranding[field] !== ""
          ) {
            result.branding = true;
            break;
          }
        }
      }
      // Also check root-level legacy branding fields
      for (const field of brandingFields) {
        if (
          (newConfig as any)[field] !== undefined &&
          (newConfig as any)[field] !== "" &&
          field !== "appName" // appName at root level is debatable — treat as content if not explicitly branded
        ) {
          result.branding = true;
          break;
        }
      }
      return result;
    }

    // UPDATE path — compare old vs new for changed fields.
    const oldContent = (oldConfig.content as Record<string, unknown>) ?? {};
    const newContent = (newConfig.content as Record<string, unknown>) ?? {};
    for (const field of contentFields) {
      if (
        newContent[field] !== undefined &&
        newContent[field] !== oldContent[field]
      ) {
        result.content = true;
        break;
      }
    }

    const oldBranding = (oldConfig.branding as Record<string, unknown>) ?? {};
    const newBranding = (newConfig.branding as Record<string, unknown>) ?? {};
    for (const field of brandingFields) {
      if (
        newBranding[field] !== undefined &&
        newBranding[field] !== oldBranding[field]
      ) {
        result.branding = true;
        break;
      }
    }

    return result;
  }

  // ---- Fetch existing config (for update path) ----
  let existingConfig: Record<string, unknown> | null = null;
  if (data.id) {
    const existing = await db.emailTheme.findUnique({
      where: { id: data.id },
      select: { config: true },
    });
    if (existing) {
      try {
        existingConfig = JSON.parse(existing.config);
      } catch {
        existingConfig = null;
      }
    }
  }

  // ---- Detect what changed ----
  const changes = detectChanges(
    data.config as Record<string, unknown>,
    existingConfig,
  );

  // ---- Check content access (if user changed text content) ----
  if (changes.content) {
    const contentAccess = await canAccess(auth.userId, FK.EMAIL_CONTENT);
    if (!contentAccess.allowed) {
      return apiError(
        ERROR_CODES.FORBIDDEN,
        "Editing email content is not available on your plan.",
        403,
      );
    }
  }

  // ---- Check branding access (if user changed visual branding) ----
  if (changes.branding) {
    const brandingAccess = await canAccess(auth.userId, FK.BRANDING_VISUAL);
    if (!brandingAccess.allowed) {
      return apiError(
        ERROR_CODES.FORBIDDEN,
        "Custom branding is not available on your plan.",
        403,
      );
    }
  }

  // UPDATE path — enforce ownership.
  if (data.id) {
    const existing = await db.emailTheme.findUnique({ where: { id: data.id } });
    if (!existing) {
      return apiError(ERROR_CODES.NOT_FOUND, "Theme not found.", 404);
    }
    if (!auth.canModify(existing.userId)) {
      return apiError(ERROR_CODES.FORBIDDEN, "You do not own this theme.", 403);
    }
    const updated = await db.emailTheme.update({
      where: { id: data.id },
      data: {
        name: data.name,
        templateId: data.templateId,
        isPro: template.isPro,
        purpose: data.purpose,
        config: JSON.stringify(data.config),
      },
    });
    return apiOk({
      theme: { id: updated.id, name: updated.name },
      message: "Theme updated",
    });
  }

  // CREATE path — enforce quota + rate limit.
  const usage = await checkUsage(auth.userId, FK.EMAIL_TEMPLATES);
  if (!usage.allowed) {
    return apiError(
      ERROR_CODES.FORBIDDEN,
      usage.reason === "rate_limited"
        ? "Too many templates created. Please wait a minute."
        : `Template limit reached (${usage.plan} plan). Delete an existing template or upgrade.`,
      usage.reason === "rate_limited" ? 429 : 402,
    );
  }

  const created = await db.emailTheme.create({
    data: {
      userId: auth.userId, // scope ownership to the acting user (admin or regular user)
      name: data.name,
      templateId: data.templateId,
      isPro: template.isPro,
      purpose: data.purpose,
      config: JSON.stringify(data.config),
    },
  });
  return apiOk(
    { theme: { id: created.id, name: created.name }, message: "Theme created" },
    201,
  );
}

/** DELETE /api/admin/themes/save?id=X — delete a theme.
 *  Access: any authenticated user. Ownership enforced. */
export async function DELETE(req: Request) {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing ?id=", 400);

  const existing = await db.emailTheme.findUnique({ where: { id } });
  if (!existing) {
    return apiError(ERROR_CODES.NOT_FOUND, "Theme not found.", 404);
  }
  if (!auth.canModify(existing.userId)) {
    return apiError(ERROR_CODES.FORBIDDEN, "You do not own this theme.", 403);
  }

  await db.emailTheme.delete({ where: { id } });
  return apiOk({ message: "Theme deleted" });
}
