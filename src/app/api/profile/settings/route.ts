import { NextRequest, NextResponse } from "next/server";
import { settingsProfileUpdateSchema as updateSchema } from "@/lib/settings-validation";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Settings profile update schema.
 *
 * Uses the CANONICAL validation rules from src/lib/validation.ts:
 *   fullName: trim, max 100 chars, empty → null (clearing allowed)
 *   phoneNumber: /^\+?[0-9]{7,15}$/, empty → null (clearing allowed)
 *
 * Empty/whitespace-only strings are normalized to null so the user
 * can clear optional fields. Non-empty values must pass canonical
 * validation — no weaker contract than the signup/profile-complete flow.
 */
// Uses the shared canonical Settings validation schema.
  // See src/lib/settings-validation.ts for the full contract.
  // .strict() rejects unknown fields (email, plan, userId, etc.).

/**
 * PATCH /api/profile/settings
 *
 * Update mutable profile fields (fullName, phoneNumber) for the
 * authenticated user. Email is NOT editable here — it requires a
 * dedicated verification flow. Plan is NOT editable here.
 *
 * The user identity is derived from the session JWT only —
 * userId is never accepted from the client.
 *
 * Validation contract:
 *   - fullName: empty → null (clears the field), non-empty → trim + max 100
 *   - phoneNumber: empty → null (clears the field), non-empty → /^\+?[0-9]{7,15}$/
 *   - email: NOT accepted as input (read-only)
 *   - plan: NOT accepted as input (read-only)
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

  const { fullName, firstName, lastName, phoneNumber } = parsed.data;

  // Build the update object — only include fields that were actually provided
  // (undefined = not sent, null = explicitly cleared, string = new value)
  const update: Record<string, unknown> = {};
  if (fullName !== undefined) update.fullName = fullName;
  if (firstName !== undefined) update.firstName = firstName;
  if (lastName !== undefined) update.lastName = lastName;
  if (phoneNumber !== undefined) update.phoneNumber = phoneNumber;

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
        firstName: true,
        lastName: true,
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
        firstName: updated.firstName,
        lastName: updated.lastName,
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
