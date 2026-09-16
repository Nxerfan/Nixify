import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";
import { jwtVerify } from "jose";

/**
 * Page-level auth + role guard.
 *
 * ACCESS MODEL (revised):
 *
 * 1. User pages (/profile/*, /dashboard/*): require a user
 *    session cookie. Admins browsing the main app use the SAME user UI — they
 *    must sign in via /auth (user login) just like regular users. The admin
 *    cookie alone does NOT grant access to user pages.
 *
 * 2. Admin pages (/admin/*, except /admin/login): require the admin cookie.
 *    User sessions are NOT accepted. Admin pages are isolated from the public
 *    application.
 *
 * 3. Admin flow origin check: deep-links to /admin/* sub-pages are blocked
 *    unless the visitor has an `mg_admin_flow` cookie, which is set ONLY when
 *    the admin lands on /admin (the Admin Dashboard home). This enforces the
 *    "admin pages are only reachable through the Admin Dashboard" rule. Direct
 *    URL typing of /admin/analytics etc. redirects to /admin first.
 *
 * 4. /admin/login is public (the admin sign-in page).
 *
 * 5. Redirect stubs (/admin/email-themes, /admin/api-keys, etc.) accept either
 *    admin OR user session — they just forward to the new /dashboard/* user
 *    routes so old bookmarks don't break.
 *
 * NOTE: This is a UX guard. Every API route independently verifies auth
 * server-side (defense-in-depth). Runs on the Edge runtime — only imports
 * `jose` (edge-compatible).
 *
 * ─── LOCALE (Phase 12 — Persian Localization) ─────────────────────────────
 *
 * Locale is NOT resolved or redirected by this middleware. We chose a
 * centralized mechanism: locale is resolved SERVER-SIDE PER-REQUEST in
 * `src/app/layout.tsx` via `headers()` / `cookies()`, and passed to
 * `<html lang dir>` + `<LocaleProvider>` so the initial server-rendered
 * markup already has the correct `lang`/`dir`. The client provider receives
 * the same resolved locale as a prop (no client-side re-detection on first
 * paint — no hydration mismatch).
 *
 * The locale resolution precedence (see `src/lib/i18n/resolve.ts`):
 *   1. Authenticated user's `preferredLocale` (DB row).
 *   2. `?locale=fa` URL query param.
 *   3. `mg_locale` first-party cookie.
 *   4. Trusted Vercel `x-vercel-ip-country === "IR"` → `fa` (Geo hint).
 *   5. `Accept-Language` header.
 *   6. `en` fallback.
 *
 * We DO NOT use URL prefixing (`/en/...`, `/fa/...`) or locale redirects:
 *   - URL prefixing would require a full route-tree rewrite and risk breaking
 *     existing bookmarks, webhooks, and API contracts.
 *   - Locale redirects in middleware would cause redirect loops (the redirect
 *     target would itself trigger another redirect) and hydration mismatches
 *     (server and client would disagree about the locale until the redirect
 *     settled).
 *
 * The matcher EXCLUDES /api, /_next, static assets, favicon, robots/sitemap,
 * provider webhook routes, cron, unsubscribe machine endpoints. The current
 * matcher below is already safe (no API matching) — keep it. Do NOT add locale
 * redirects here.
 */
export const config = {
  // Match ALL page routes EXCEPT machine/internal routes.
  // This ensures the `x-nixify-url-locale` header is available on every
  // user-facing page (root layout reads it). Excluded:
  //   - /api/*            (machine-to-machine, no locale)
  //   - /_next/*          (static assets, build output)
  //   - /favicon.ico, /robots.txt, /sitemap.xml (static files)
  //   - /api/v1/otp/*     (provider/webhook machine routes)
  //   - /unsubscribe/*    (machine unsubscribe endpoints — token-based, no locale)
  matcher: [
    "/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|unsubscribe).*)",
    "/profile/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
  ],
};

const ADMIN_COOKIE = "mg_admin";
const ADMIN_FLOW_COOKIE = "mg_admin_flow";
const ADMIN_FLOW_TTL = 4 * 60 * 60; // 4 hours — refreshes each time admin visits /admin

async function isAdminAuthed(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const secret = `${process.env.JWT_SECRET ?? "insecure"}:admin`;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      {
        algorithms: ["HS256"],
      },
    );
    return payload.role === "admin";
  } catch {
    return false;
  }
}

function setAdminFlowCookie(res: NextResponse, requestHeaders: Headers): NextResponse {
  res.cookies.set(ADMIN_FLOW_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_FLOW_TTL,
  });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ─── Phase 12 — Locale header (BLOCKER #3) ────────────────────────────
  // Read the `?locale=…` query param, validate it, and write a controlled
  // `x-nixify-url-locale` request header that the root layout reads. This
  // replaces the previous dependence on undocumented Next.js internal
  // headers (`x-url`, `x-invoke-path`, `x-invoke-query`).
  //
  // We ALWAYS overwrite any client-supplied `x-nixify-url-locale` header —
  // never trust an incoming copy. Only supported locales (`en`, `fa`) are
  // forwarded; unsupported values are dropped (the layout falls through to
  // cookie/Geo/Accept-Language/default).
  const rawLocale = req.nextUrl.searchParams.get("locale");
  const supportedLocale =
    rawLocale === "en" || rawLocale === "fa" ? rawLocale : null;

  // Build modified request headers containing the controlled locale value.
  // This is the standard Next.js pattern for passing data from middleware to
  // the page/layout: `NextResponse.next({ request: { headers } })` merges
  // these headers into the incoming request that the layout sees via
  // `headers()`. We NEVER trust an incoming client-supplied copy — the
  // middleware always overwrites or deletes it.
  const requestHeaders = new Headers(req.headers);
  if (supportedLocale) {
    requestHeaders.set("x-nixify-url-locale", supportedLocale);
  } else {
    requestHeaders.delete("x-nixify-url-locale");
  }

  // ─── Admin pages ────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    // /admin/login is the only public admin route.
    if (pathname === "/admin/login") return NextResponse.next({ request: { headers: requestHeaders } });

    // Redirect stubs: these old paths now redirect to /dashboard/* user
    // pages. They accept EITHER an admin cookie OR a user session, so old
    // bookmarks work for everyone. They are NOT subject to the admin flow
    // check (they just forward to the user UI).
    const REDIRECT_STUBS = [
      "/admin/email-themes",
      "/admin/api-keys",
      "/admin/webhooks",
      "/admin/playground",
      "/admin/logs",
      "/admin/errors",
      "/admin/docs",
    ];
    if (REDIRECT_STUBS.includes(pathname)) {
      const adminOk = await isAdminAuthed(req);
      const userToken = req.cookies.get(SESSION_COOKIE)?.value;
      const userSession = await verifySession(userToken);
      if (adminOk || userSession) return NextResponse.next({ request: { headers: requestHeaders } });
      // Not authed at all — send to user login.
      const url = req.nextUrl.clone();
      url.pathname = "/auth";
      return NextResponse.redirect(url);
    }

    // All other /admin/* routes require the admin cookie.
    if (!(await isAdminAuthed(req))) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }

    // Admin is authed. Enforce the flow-origin check for true admin sub-pages:
    // /admin itself (the dashboard home) is the entry point — visiting it
    // sets the flow cookie. Sub-pages require the flow cookie; without it,
    // the admin is redirected to /admin to "enter" the dashboard first.
    if (pathname === "/admin") {
      // Landing on the dashboard home — set/refresh the flow cookie.
      return setAdminFlowCookie(NextResponse.next({ request: { headers: requestHeaders } }), requestHeaders);
    }

    // True admin sub-page (e.g. /admin/analytics). Require the flow cookie.
    const flowCookie = req.cookies.get(ADMIN_FLOW_COOKIE)?.value;
    if (!flowCookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ─── Phase 12 audit: auth scope MUST be path-scoped ──────────────────
  //
  // BLOCKER #1 fix: the catch-all matcher now matches ALL page routes (so we
  // can inject `x-nixify-url-locale` on every user-facing page). The auth
  // guard must therefore be EXPLICITLY scoped to protected user paths only —
  // /profile/* and /dashboard/*. Public pages (/, /auth, /login, /signup,
  // /forgot-password, /verify-email, /reset-password) must pass through with
  // the locale header but WITHOUT a login requirement.
  //
  // If we did NOT scope the auth check, anonymous visitors to /login would be
  // redirected to /auth, which itself matches the catch-all and would redirect
  // again — a self-redirect lockout of all public pages.
  if (!isProtectedUserPath(pathname)) {
    // Public page — inject the locale header and pass through. NO auth check.
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ─── Protected user pages (/profile/*, /dashboard/*) ──────────────────
  // Require a user session cookie. The admin cookie alone is NOT sufficient —
  // admins browsing the main app must sign in via /auth (user login) too.
  // This enforces "admins use the standard user experience by default."
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth";
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Phase 12 audit — path-scoped auth guard.
 *
 * Returns true ONLY for actual protected user paths: /profile and /dashboard
 * (and their sub-paths). All other routes — including public pages (/, /auth,
 * /login, /signup, /forgot-password, /verify-email, /reset-password) — return
 * false and are handled as pass-through with locale header injection only.
 *
 * This prevents the catch-all matcher from accidentally requiring a session
 * on public pages.
 */
function isProtectedUserPath(pathname: string): boolean {
  return (
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/")
  );
}
