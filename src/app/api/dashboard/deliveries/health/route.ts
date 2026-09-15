import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { getDeliveryHealth } from "@/lib/deliverability/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/deliveries/health
 *
 * Bounded operational health summary for the recent past. Used by the
 * dashboard to show "today's deliveries" without scanning the full table.
 *
 * Query params:
 *   - windowHours (default 24, max 168 = 7 days)
 *
 * Returns counts by status + provider + source for the window.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Deliverability dashboard not available." } },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const windowHours = Number(url.searchParams.get("windowHours") ?? "24");

  const summary = await getDeliveryHealth(user.id, {
    windowHours: Number.isFinite(windowHours) ? windowHours : 24,
  });

  return NextResponse.json(summary);
}
