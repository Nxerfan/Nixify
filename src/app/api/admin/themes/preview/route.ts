import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { resolveThemesViewer } from "@/lib/themes-auth";
import { getTemplate, type ThemeConfig, type Language, SUPPORTED_LANGUAGES } from "@/lib/email-themes/templates";
import { renderThemeHtml, renderThemeText } from "@/lib/email-themes/renderer";
import { z } from "zod";
import { parseBody } from "@/lib/http";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const previewSchema = z.object({
  templateId: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  code: z.string().default("123456"),
  email: z.string().default("user@example.com"),
  language: z.enum(SUPPORTED_LANGUAGES).default("en"),
  mode: z.enum(["light", "dark", "auto"]).default("auto"),
});

/**
 * Generate a simplified fallback HTML preview when the full renderer fails.
 * This ensures the user always sees *something* in the preview pane rather
 * than a blank iframe or a raw error. The fallback is intentionally minimal
 * (no template-specific styling) so it can never itself throw.
 */
function fallbackPreviewHtml(
  code: string,
  email: string,
  appName: string,
  bgColor: string,
  codeColor: string,
): string {
  const safeCode = String(code).replace(/</g, "&lt;").slice(0, 12);
  const safeApp = String(appName).replace(/</g, "&lt;").slice(0, 100);
  const safeEmail = String(email).replace(/</g, "&lt;").slice(0, 254);
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr><td align="center">
      <table role="presentation" width="420" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:28px 32px 12px;text-align:center;">
          <span style="font-size:20px;font-weight:700;color:#0f172a;">${safeApp}</span>
        </td></tr>
        <tr><td style="padding:8px 32px 16px;text-align:center;">
          <p style="margin:0;font-size:14px;color:#475569;">Your verification code:</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;text-align:center;">
          <span style="display:inline-block;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:${codeColor};background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 28px;">${safeCode}</span>
        </td></tr>
        <tr><td style="padding:0 32px 28px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">For ${safeEmail}<br/>Expires in 10 minutes</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** POST /api/admin/themes/preview — render a theme to HTML for live preview.
 *  Access: any authenticated user. Multi-language requires PRO+ entitlement.
 *
 *  Resilience: the full renderer (renderThemeHtml) is wrapped in try/catch.
 *  If it throws (e.g. malformed config, unexpected template shape), a
 *  simplified fallback HTML is returned so the preview pane never goes blank.
 *  The `fallback` flag in the response lets the client show a subtle "simplified
 *  preview" indicator. Errors are logged with a generated request_id for
 *  debugging. */
export async function POST(req: Request) {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const [data, err] = await parseBody(req as any, previewSchema);
  if (err) return err;

  // Entitlement: multi-language templates are PRO+ only (access-gated).
  // This check MUST run before any rendering — FREE users cannot preview
  // non-English templates, even if the renderer would succeed.
  if (data.language && data.language !== "en") {
    const { canAccess } = await import("@/lib/entitlements/engine");
    const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");
    const access = await canAccess(auth.userId, FK.MULTI_LANGUAGE);
    if (!access.allowed) {
      return apiError(ERROR_CODES.FORBIDDEN, "Multi-language templates are not available on your plan.", 403);
    }
  }

  // Resolve config: use provided config, or fall back to the template default.
  let config: ThemeConfig;
  if (data.config) {
    config = data.config as ThemeConfig;
  } else if (data.templateId) {
    const template = getTemplate(data.templateId);
    if (!template) return apiError(ERROR_CODES.VALIDATION_FAILED, "Unknown template.", 400);
    config = template.config;
  } else {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Provide either templateId or config.", 400);
  }

  // ---- Render with fallback resilience ----
  const requestId = randomUUID();
  let html: string;
  let text: string;
  let fellBack = false;

  try {
    html = renderThemeHtml(config, {
      code: data.code,
      email: data.email,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      language: data.language as Language,
      mode: data.mode,
    });
    text = renderThemeText(config, {
      code: data.code,
      email: data.email,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      language: data.language as Language,
    });
  } catch (renderErr) {
    // The full renderer failed (malformed config, template bug, etc.).
    // Log with context so the issue can be tracked, then return a simplified
    // fallback preview so the user always sees something useful.
    console.error(`[themes/preview] Renderer failed (request_id=${requestId}):`, renderErr);
    const appName = (config as any)?.footer?.companyName ?? "Nixify";
    const bgColor = (config as any)?.background?.value ?? "#f8fafc";
    const codeColor = (config as any)?.otpCard?.textColor ?? "#059669";
    html = fallbackPreviewHtml(data.code, data.email, appName, bgColor, codeColor);
    text = `Your ${appName} verification code is ${data.code}. It expires in 10 minutes.`;
    fellBack = true;
  }

  return apiOk({ html, text, fallback: fellBack, requestId });
}
