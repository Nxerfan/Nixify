import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { issueOtp } from "@/lib/otp/verifier";
import type { OtpPurpose } from "@/lib/otp/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/account/deletion/verify
 *
 * Initiates the account deletion re-verification flow.
 * Sends an OTP code to the user's verified email with purpose "account_deletion".
 *
 * Requires an authenticated session — but the session alone is NOT sufficient
 * for deletion. The OTP code must be verified separately before deletion proceeds.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  // Fetch the user's email from the DB (session JWT has it, but let's be safe)
  const { db } = await import("@/lib/db");
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { email: true, emailVerified: true },
  });

  if (!dbUser) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Account not found." } },
      { status: 404 },
    );
  }

  if (!dbUser.emailVerified) {
    return NextResponse.json(
      { error: { code: "email_not_verified", message: "Email must be verified before account deletion." } },
      { status: 400 },
    );
  }

  try {
    // Resolve the user's preferred locale for the email
    const userWithLocale = await db.user.findUnique({
      where: { id: user.id },
      select: { preferredLocale: true },
    });
    const locale = (userWithLocale?.preferredLocale === "fa" ? "fa" : "en") as "en" | "fa";

    await issueOtp({
      email: dbUser.email,
      purpose: "account_deletion" as OtpPurpose,
      userId: user.id,
      locale,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    // Check for rate-limit / lock errors (thrown by issueOtp internals)
    if (err instanceof Error) {
      if (err.message.includes("rate")) {
        return NextResponse.json(
          { error: { code: "rate_limited", message: "Too many requests. Please wait before retrying." } },
          { status: 429 },
        );
      }
      if (err.message.includes("lock")) {
        return NextResponse.json(
          { error: { code: "locked", message: "Account temporarily locked." } },
          { status: 423 },
        );
      }
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to send verification code." } },
      { status: 500 },
    );
  }
}
