/**
 * Phase 15 — Shared canonical server-side locale resolver.
 *
 * This is the SINGLE server-side locale resolution path for the initial server
 * render. It is used by BOTH:
 *
 *   - the root layout (`src/app/layout.tsx`) — to set `<html lang dir>` and
 *     seed `<LocaleProvider>`,
 *   - the public blog routes (`src/app/blog/page.tsx`,
 *     `src/app/blog/[slug]/page.tsx`, including `generateMetadata`).
 *
 * There is NO blog-specific locale resolver. Blog locale === application
 * locale, resolved through this one shared helper, which delegates to the
 * canonical pure resolver `resolveLocale()` (see `./resolve.ts`).
 *
 * ─── Why a shared helper exists ───────────────────────────────────────────
 *
 * Phase 15's first blog implementation shipped an independent
 * `resolveLocaleFromHeaders()` inside `src/lib/blog/locale.ts` that only
 * consulted `cookie → geo → Accept-Language → en`. That resolver DID NOT
 * consult the authenticated user's `User.preferredLocale` nor the
 * middleware-controlled `x-nixify-url-locale` header (the explicit/current
 * URL locale selection). As a result, an authenticated user with
 * `preferredLocale = "fa"` (and no `mg_locale` cookie, Accept-Language `en`,
 * non-Iran Geo) would see `<html lang="fa" dir="rtl">` from the root layout
 * while `/blog` independently chose English — a real user-facing mismatch.
 *
 * The fix is structural: there is now ONE server-side locale resolver, and
 * every server entry point that needs the locale for the current request
 * calls it. The blog can no longer diverge because it has no separate
 * precedence implementation to diverge with.
 *
 * ─── Precedence (delegated to `resolveLocale`) ────────────────────────────
 *
 *   1. Authenticated user's `User.preferredLocale` (DB lookup).
 *   2. `x-nixify-url-locale` controlled header (middleware-written
 *      `?locale=…` query param — the explicit/current URL locale selection).
 *   3. `mg_locale` first-party cookie.
 *   4. Trusted Vercel `x-vercel-ip-country === "IR"` → `fa` (Geo hint).
 *   5. `Accept-Language` header.
 *   6. `en` fallback.
 *
 * This precedence is NOT reimplemented here — it is the canonical precedence
 * from `resolveLocale()`. This helper only:
 *   (a) reads the request-bound signals (`cookies()` / `headers()`) that
 *       Next.js exposes server-side,
 *   (b) resolves the authenticated user's stored preference (if any),
 *   (c) materializes a synthetic `Request` for `resolveLocale()` so the pure
 *       resolver can read the cookie / Geo / Accept-Language signals.
 *
 * ─── Memoization note ─────────────────────────────────────────────────────
 *
 * `cookies()` and `headers()` from `next/headers` are themselves request-scoped
 * and deduplicated by Next.js — calling them multiple times within one request
 * returns the same store without re-parsing. The only non-deduplicated work
 * here is the single `User.preferredLocale` PK lookup, which is sub-millisecond.
 * Within a single request, every call to this helper reads the same request
 * signals and therefore returns an identical locale — that is the property
 * that guarantees the blog locale cannot diverge from the application locale.
 * Observable locale semantics are identical whether or not an explicit
 * `React.cache()` wrapper is applied, so no additional memoization layer is
 * added (keeping the helper trivially unit-testable without cross-test cache
 * contamination). This mirrors the established Phase 13 pattern for
 * `resolveRequestUserLocale()`.
 */

import { cookies, headers } from "next/headers";
import { resolveLocale } from "./resolve";
import { type Locale } from "./locales";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";

/**
 * Resolve the locale for the current server request using the canonical
 * precedence. Delegates to `resolveLocale()` — does NOT reimplement Geo,
 * cookie, or Accept-Language parsing.
 *
 * @returns `"en" | "fa"` only. Never null, never throws for missing user /
 *          missing session / missing cookie.
 */
export async function resolveServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  // 1. Authenticated user preference (DB lookup — single PK read).
  let userPreference: Locale | null = null;
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySession(sessionToken);
  if (session?.sub) {
    const userId = Number(session.sub);
    if (Number.isFinite(userId) && userId > 0) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { preferredLocale: true },
      });
      if (user?.preferredLocale) {
        if (
          user.preferredLocale === "en" ||
          user.preferredLocale === "fa"
        ) {
          userPreference = user.preferredLocale;
        }
      }
    }
  }

  // 2-6. Build a synthetic Request for `resolveLocale()`.
  //
  // The middleware writes a controlled `x-nixify-url-locale` request header
  // containing the validated `?locale=…` query param value (or omits it if
  // absent / unsupported). We NEVER trust an incoming client-provided copy —
  // the middleware overwrites any client-supplied value. This is a private
  // internal contract between the middleware and this resolver.
  const nixifyLocale = headerStore.get("x-nixify-url-locale");
  const searchParams = nixifyLocale
    ? new URLSearchParams({ locale: nixifyLocale })
    : undefined;

  // Construct a synthetic Request for `resolveLocale()`. The URL is the
  // middleware-visible host + path; the query is derived from the controlled
  // header above.
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "localhost";
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const path = headerStore.get("x-forwarded-path") ?? "/";
  const url = new URL(`${proto}://${host}${path}`);
  if (nixifyLocale) {
    url.searchParams.set("locale", nixifyLocale);
  }

  // Materialize the cookie header from the Next.js cookie store so the pure
  // `resolveLocale()` can read `mg_locale` via the raw `cookie` HTTP header.
  const headerObj: Record<string, string> = {};
  const cookiePairs: string[] = [];
  for (const c of cookieStore.getAll()) {
    cookiePairs.push(`${c.name}=${c.value}`);
  }
  if (cookiePairs.length > 0) {
    headerObj["cookie"] = cookiePairs.join("; ");
  }
  // Copy through the headers needed by `resolveLocale()` (Geo, Accept-Language).
  for (const h of ["x-vercel-ip-country", "accept-language"]) {
    const v = headerStore.get(h);
    if (v) headerObj[h] = v;
  }
  const req = new Request(url, {
    method: "GET",
    headers: headerObj,
  });

  const resolved = resolveLocale({
    userPreference,
    request: req,
    searchParams,
  });
  return resolved.locale;
}
