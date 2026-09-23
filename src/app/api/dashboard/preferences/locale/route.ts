import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiError, apiOk, ERROR_CODES } from "@/lib/api-response";
import { isSupportedLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/locales";
import { LOCALE_COOKIE_OPTIONS } from "@/lib/i18n/cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  locale: z.string().min(1).max(8),
});

/**
 * PATCH /api/dashboard/preferences/locale
 *
 * Authenticated endpoint. Updates the authenticated user's `preferredLocale`
 * column. Also sets the `mg_locale` cookie on the response so unauthenticated
 * pages reflect the choice immediately (e.g. the login page after a session
 * expires).
 *
 * Body: `{ "locale": "en" | "fa" }`. Reject 400 on invalid (the schema parses,
 * then `isSupportedLocale` validates against the canonical list).
 *
 * Returns: `{ "locale": "fa" }` on success.
 *
 * Tenant-safe: uses the session's userId — does NOT accept a userId from the
 * request body.
 *
 * Does NOT consume `API_MESSAGES`. Uses safe validation errors.
 */
export async function PATCH(req: Request) {
  // 1. Auth — must be an authenticated user session.
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Authentication required.", 401);
  }

  // 2. Parse + validate body.
  let body: unknown;
  try {
    body = await (req as Request).json();
  } catch {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Invalid JSON body.", 400);
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      ERROR_CODES.VALIDATION_FAILED,
      "Locale is required.",
      400,
    );
  }

  // 3. Validate against the canonical supported-locale list. The Zod schema
  //    only checks string length — the real validation is here.
  const candidate = parsed.data.locale;
  if (!isSupportedLocale(candidate)) {
    return apiError(
      ERROR_CODES.VALIDATION_FAILED,
      "Unsupported locale.",
      400,
    );
  }

  const locale: Locale = candidate;

  // 4. Persist to the user's row. The CHECK constraint on `preferredLocale`
  //    (enforced in migration 20260923000000_add_user_locale_preference) is a
  //    defense-in-depth guard — we already validated above. If a future
  //    supported-locale list expansion forgets to update the migration, the
  //    DB will reject the write rather than persist an unsupported value.
  await db.user.update({
    where: { id: user.id },
    data: { preferredLocale: locale },
    select: { id: true, preferredLocale: true },
  });

  // 5. Set the `mg_locale` cookie on the response. The cookie is bounded,
  //    HttpOnly, SameSite=Lax, 1-year Max-Age. Contains ONLY the locale
  //    identifier string.
  const res = apiOk({ locale });
  res.cookies.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);
  return res;
}

/**
 * GET /api/dashboard/preferences/locale
 *
 * Returns the authenticated user's current preferred locale (or `{ locale: null }`
 * if they have not set one). Used by the settings page to render the current
 * selection in the LocaleSwitcher.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Authentication required.", 401);
  }
  // Re-read the persisted value (the session user row may be stale if the
  // user updated their preference in another tab).
  const fresh = await db.user.findUnique({
    where: { id: user.id },
    select: { preferredLocale: true },
  });
  const locale = fresh?.preferredLocale ?? null;
  return NextResponse.json({
    locale: locale && isSupportedLocale(locale) ? locale : null,
  });
}
