import { NextResponse, type NextRequest } from "next/server";
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
 */
export const config = {
  matcher: ["/profile/:path*", "/dashboard/:path*", "/admin/:path*"],
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

function setAdminFlowCookie(res: NextResponse): NextResponse {
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

  // ─── Admin pages ────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    // /admin/login is the only public admin route.
    if (pathname === "/admin/login") return NextResponse.next();

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
      if (adminOk || userSession) return NextResponse.next();
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
      return setAdminFlowCookie(NextResponse.next());
    }

    // True admin sub-page (e.g. /admin/analytics). Require the flow cookie.
    const flowCookie = req.cookies.get(ADMIN_FLOW_COOKIE)?.value;
    if (!flowCookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // ─── User pages (/profile/*, /dashboard/*) ─────────────
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

  return NextResponse.next();
}
