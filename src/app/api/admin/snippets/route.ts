import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { generateSnippet, type Language } from "@/lib/dx/code-snippets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGUAGES: Language[] = [
  "javascript",
  "typescript",
  "python",
  "php",
  "go",
  "java",
  "csharp",
  "curl",
];

const querySchema = z.object({
  method: z.string().trim().toUpperCase().default("POST"),
  path: z.string().trim().min(1, "Path is required"),
  language: z.enum(LANGUAGES as [Language, ...Language[]]).default("javascript"),
  apiKey: z.string().trim().optional(),
  baseUrl: z.string().trim().url().optional(),
});

/**
 * GET /api/admin/snippets?method=POST&path=/api/v1/otp/send&language=javascript&apiKey=mg_live_xxx
 *
 * Generates a ready-to-copy code snippet for the supplied endpoint + language,
 * used by the API Playground and docs site. Admin-authenticated because the
 * `apiKey` query param is rendered into the snippet (we don't want to expose
 * that capability to unauthenticated callers).
 *
 * Returns the snippet as a plain-text string inside `{ snippet, language }`.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const url = new URL(req.url);
  const params = querySchema.safeParse({
    method: url.searchParams.get("method") || undefined,
    path: url.searchParams.get("path") || undefined,
    language: url.searchParams.get("language") || undefined,
    apiKey: url.searchParams.get("apiKey") || undefined,
    baseUrl: url.searchParams.get("baseUrl") || undefined,
  });
  if (!params.success) {
    const msg = params.error.issues.map((i) => i.message).join("; ");
    return apiError(ERROR_CODES.VALIDATION_FAILED, msg, 400);
  }

  // Build a small representative body for the common OTP endpoints so the
  // generated snippet shows a realistic request shape.
  let body: Record<string, unknown> | null = null;
  if (params.data.path.endsWith("/otp/send") || params.data.path.endsWith("/otp/resend")) {
    body = { email: "user@example.com", purpose: "signup" };
  } else if (params.data.path.endsWith("/otp/verify")) {
    body = { email: "user@example.com", code: "123456" };
  }

  const snippet = generateSnippet({
    method: params.data.method,
    path: params.data.path,
    language: params.data.language,
    apiKey: params.data.apiKey,
    baseUrl: params.data.baseUrl,
    body,
  });

  return apiOk({ snippet, language: params.data.language, method: params.data.method, path: params.data.path });
}
