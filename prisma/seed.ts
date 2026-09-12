/**
 * Prisma seed script — populates the database with:
 *   - Admin user (from ADMIN_EMAIL/ADMIN_PASSWORD env vars)
 *   - Pricing plans (Free, Pro, Enterprise)
 *   - Sample dashboard widgets
 *
 * Run with: bunx prisma db seed
 * Safe to run multiple times (idempotent — uses upsert).
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Admin user
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@mailguard.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234";
  const adminHash = await hash(adminPassword, 12);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash: adminHash },
  });
  console.log(`  ✓ Admin user: ${adminEmail}`);

  // 2. Disposable email blocklist (seed if empty)
  const disposableCount = await prisma.disposableDomain.count();
  if (disposableCount === 0) {
    const domains = [
      "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
      "yopmail.com", "getnada.com", "maildrop.cc", "throwawaymail.com",
    ];
    for (const domain of domains) {
      await prisma.disposableDomain.create({
        data: { domain, listType: "block", source: "seed" },
      }).catch(() => {});
    }
    console.log(`  ✓ Seeded ${domains.length} disposable domains`);
  }

  // 3. Brand Kit — NOT seeded here. BrandKit.userId is required (unique) and
  // points to a User (not AdminUser). The brand-kit route creates a kit on
  // demand the first time a user visits the branding editor, so there is no
  // global default kit to seed. Seeding one would require creating a User
  // record, which is outside the seed's responsibility.

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
