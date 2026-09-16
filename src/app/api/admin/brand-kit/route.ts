import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { resolveThemesViewer } from "@/lib/themes-auth";
import { z } from "zod";
import { parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const brandKitSchema = z.object({
  appName: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  website: z.string().url().nullable().optional(),
  supportEmail: z.string().email().nullable().optional(),
  defaultFont: z.string().optional(),
});

/** GET /api/admin/brand-kit — get the brand kit for the current user. */
export async function GET() {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  let kit = await db.brandKit.findUnique({
    where: { userId: auth.userId },
  });

  // If no brand kit exists, create a default one.
  if (!kit) {
    kit = await db.brandKit.create({
      data: {
        userId: auth.userId,
        appName: "",
        primaryColor: "#059669",
        secondaryColor: "#0f172a",
        accentColor: "#f59e0b",
        defaultFont: "Inter",
      },
    });
  }

  return apiOk({ brandKit: kit });
}

/** POST /api/admin/brand-kit — update the brand kit for the current user.
 *  Access: any authenticated user. PRO+ entitlement enforced via BRAND_KIT
 *  (the dedicated feature key for the BrandKit resource — equivalent to
 *  CUSTOM_BRANDING / BRANDING_VISUAL but tied to this specific resource). */
export async function POST(req: Request) {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  // Entitlement: Brand Kit is PRO+ only (access-gated). The BRAND_KIT
  // feature key has identical access semantics to CUSTOM_BRANDING and
  // BRANDING_VISUAL (FREE=false, PRO=true, MAX=true) but is the canonical
  // gate for this resource — see src/lib/entitlements/config.ts.
  const { canAccess } = await import("@/lib/entitlements/engine");
  const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");
  const access = await canAccess(auth.userId, FK.BRAND_KIT);
  if (!access.allowed) {
    return apiError(
      ERROR_CODES.FORBIDDEN,
      "Brand Kit is not available on your plan. Upgrade to PRO to customize your branding.",
      403,
    );
  }

  const [data, err] = await parseBody(req as any, brandKitSchema);
  if (err) return err;

  // Upsert: update if exists, create if not.
  const kit = await db.brandKit.upsert({
    where: { userId: auth.userId },
    update: data as any,
    create: {
      userId: auth.userId,
      appName: data.appName ?? "",
      primaryColor: data.primaryColor ?? "#059669",
      secondaryColor: data.secondaryColor ?? "#0f172a",
      accentColor: data.accentColor ?? "#f59e0b",
      defaultFont: data.defaultFont ?? "Inter",
      ...data,
    },
  });

  return apiOk({ brandKit: kit, message: "Brand kit saved" });
}
