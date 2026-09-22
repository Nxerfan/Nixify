import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { verifyAccountDeletionOtp, deleteUserAccount } from "@/lib/account/deletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const confirmSchema = z.object({
  code: z.string().trim().min(6).max(6),
});

/**
 * POST /api/account/deletion/confirm
 *
 * Confirms account deletion by:
 * 1. Verifying the OTP code (single-use, recent, purpose=account_deletion)
 * 2. If verified: deleting the user and all tenant data in a transaction
 * 3. Returning a response that tells the client to clear session/redirect
 *
 * Security:
 *   - Requires authenticated session (identity proof 1)
 *   - Requires OTP code (identity proof 2 — recent email re-verification)
 *   - OTP is consumed (single-use) before deletion proceeds
 *   - Deletion is transactional — no half-deleted state
 */
export async function POST(req: NextRequest) {
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

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid verification code." } },
      { status: 400 },
    );
  }

  // Fetch the user's email
  const { db } = await import("@/lib/db");
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });

  if (!dbUser) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Account not found." } },
      { status: 404 },
    );
  }

  // Step 1: Verify the OTP code (consumes it — single use)
  const verification = await verifyAccountDeletionOtp(dbUser.email, parsed.data.code);
  if (!verification.verified) {
    return NextResponse.json(
      { error: { code: "verification_failed", message: verification.error ?? "Invalid or expired code." } },
      { status: 400 },
    );
  }

  // Step 2: Delete the account and all tenant data
  const deletion = await deleteUserAccount(user.id);
  if (!deletion.success) {
    return NextResponse.json(
      { error: { code: "deletion_failed", message: deletion.error ?? "Account deletion failed." } },
      { status: 500 },
    );
  }

  // Step 3: Return success — client must clear session cookie and redirect
  return NextResponse.json({ deleted: true });
}
