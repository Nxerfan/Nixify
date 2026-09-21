import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  fullName: z.string().trim().max(200).optional().nullable(),
  phoneNumber: z.string().trim().max(30).optional().nullable(),
});

/**
 * PATCH /api/profile/settings
 *
 * Update mutable profile fields (fullName, phoneNumber) for the
 * authenticated user. Email is NOT editable here — it requires a
 * dedicated verification flow. Plan is NOT editable here.
 *
 * The user identity is derived from the session JWT only —
 * userId is never accepted from the client.
 */
export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_failed",
          message: parsed.error.issues[0]?.message ?? "Invalid input.",
        },
      },
      { status: 400 },
    );
  }

  const { fullName, phoneNumber } = parsed.data;

  // Build the update object — only include fields that were actually provided
  const update: Record<string, unknown> = {};
  if (fullName !== undefined) update.fullName = fullName || null;
  if (phoneNumber !== undefined) update.phoneNumber = phoneNumber || null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "No fields to update." } },
      { status: 400 },
    );
  }

  try {
    const updated = await db.user.update({
      where: { id: user.id },
      data: update,
      select: {
        id: true,
        email: true,
        emailVerified: true,
        fullName: true,
        phoneNumber: true,
        plan: true,
      },
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        emailVerified: updated.emailVerified,
        fullName: updated.fullName,
        phoneNumber: updated.phoneNumber,
        plan: updated.plan,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to update profile." } },
      { status: 500 },
    );
  }
}
