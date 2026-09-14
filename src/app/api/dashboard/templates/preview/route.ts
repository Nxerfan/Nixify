import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  previewSchema,
  validateVariableValues,
  renderTransactionalTemplate,
  sanitizeTemplateHtml,
  extractVariables,
  getVersion,
  getTemplate,
} from "@/lib/transactional-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/templates/preview
 *
 * PREVIEW ONLY (section 29). Renders a template with supplied variables and
 * returns the sanitized output. Does NOT send email, does NOT call any mail
 * transport, does NOT consume MESSAGING_EMAILS quota.
 *
 * Two modes:
 *   1. { templateId, version?, variables } — render a stored version.
 *   2. { subject, html, text?, variables } — render ad-hoc content.
 *
 * Returns:
 *   200 { subject, html, text, variables } — rendered output
 *   400 { error: { code: "missing_template_variables", missing: [...] } }
 *   400 { error: { code: "validation_failed", ... } }
 */
export async function POST(req: NextRequest) {
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

  let body;
  try {
    const json = await req.json();
    const result = previewSchema.safeParse(json);
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

  // Resolve the content to render: stored version OR inline ad-hoc content.
  let subject: string;
  let html: string;
  let text: string | null;
  let variables: string[];

  if (body.templateId !== undefined) {
    // If a specific version is requested, fetch it; otherwise fetch the
    // template detail to resolve the current version's content.
    if (body.version !== undefined) {
      const v = await getVersion(user.id, body.templateId, body.version);
      if (!v) {
        return NextResponse.json(
          { error: { code: "version_not_found", message: "Template or version not found." } },
          { status: 404 },
        );
      }
      subject = v.subject;
      html = v.html;
      text = v.text;
      variables = v.variables;
    } else {
      const detail = await getTemplate(user.id, body.templateId);
      if (!detail) {
        return NextResponse.json(
          { error: { code: "template_not_found", message: "Template not found." } },
          { status: 404 },
        );
      }
      subject = detail.current.subject;
      html = detail.current.html;
      text = detail.current.text;
      variables = detail.current.variables;
    }
  } else {
    // Inline content — sanitize the HTML before extracting variables + rendering.
    subject = body.subject!;
    html = sanitizeTemplateHtml(body.html!);
    text = body.text ?? null;
    variables = extractVariables(subject, html, text);
  }

  // Validate that all variable values are safe scalars (section 13).
  const valuesResult = validateVariableValues(body.variables);
  if (!valuesResult.valid) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: valuesResult.error } },
      { status: 400 },
    );
  }

  // Render — this fails loudly on missing variables (section 12).
  const rendered = renderTransactionalTemplate({
    subject,
    html,
    text,
    variables,
    values: valuesResult.value,
  });

  if (!rendered.ok) {
    return NextResponse.json(
      { error: { code: "missing_template_variables", missing: rendered.missing } },
      { status: 400 },
    );
  }

  return NextResponse.json({
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    variables,
  });
}
