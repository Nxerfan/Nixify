import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { issueOtp } from "@/lib/otp/verifier";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import type { OtpPurpose } from "@/lib/otp/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/account/deletion/verify
 *
 * Initiates the account deletion re-verification flow.
 * Sends an OTP code to the user's verified email with purpose "account_deletion".
 *
 * Uses the canonical locale resolver (resolveServerLocale) for the email
 * language — same precedence as all other first-party OTP flows:
 *   user preference > URL locale > cookie > Geo > Accept-Language > en
 */
export async function POST(_req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

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
    // Use the canonical locale resolver for the email language
    const locale = await resolveServerLocale();

    await issueOtp({
      email: dbUser.email,
      purpose: "account_deletion" as OtpPurpose,
      userId: user.id,
      locale,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
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
