import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

/**
 * Raven Oracle Database Seed Script
 * 
 * This script is IDEMPOTENT and safe to run multiple times.
 * It will NOT overwrite existing data.
 * 
 * PRODUCTION MODE:
 * - Creates default system chat channels only
 * - Does NOT create any users
 * - Admin user must be created manually or via admin interface
 * 
 * DEVELOPMENT MODE (NODE_ENV=development):
 * - Also creates a development admin user
 * - Uses SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD from environment
 * - Will skip if admin already exists
 */

async function main() {
  console.log("🌱 Starting Raven Oracle database seed...");

  // Create default chat channels (idempotent)
  await seedChatChannels();

  // Only create dev admin in development mode
  if (process.env.NODE_ENV === "development") {
    await seedDevelopmentAdmin();
  } else {
    console.log("ℹ️  Production mode: Skipping development data");
    console.log("ℹ️  Admin users must be created via admin interface or manual SQL");
  }

  console.log("✅ Database seed completed successfully");
}

async function seedChatChannels() {
  console.log("📢 Seeding chat channels...");

  // General channel
  const generalChannel = await prisma.chatChannel.upsert({
    where: { slug: "general" },
    update: {},
    create: {
      name: "General",
      slug: "general",
      type: "GENERAL",
      isActive: true,
    },
  });
  console.log(`  ✓ General channel: ${generalChannel.id}`);

  // Welcome channel
  const welcomeChannel = await prisma.chatChannel.upsert({
    where: { slug: "welcome" },
    update: {},
    create: {
      name: "Welcome",
      slug: "welcome",
      type: "GENERAL",
      isActive: true,
    },
  });
  console.log(`  ✓ Welcome channel: ${welcomeChannel.id}`);

  // Admin channel
  const adminChannel = await prisma.chatChannel.upsert({
    where: { slug: "admin" },
    update: {},
    create: {
      name: "Admin",
      slug: "admin",
      type: "ADMIN",
      isActive: true,
    },
  });
  console.log(`  ✓ Admin channel: ${adminChannel.id}`);

  console.log("✅ Chat channels seeded");
}

async function seedDevelopmentAdmin() {
  console.log("👤 Seeding development admin user...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log("  ⚠️  SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD not set");
    console.log("  ⚠️  Skipping development admin creation");
    console.log("  ℹ️  To create dev admin, set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(adminEmail)) {
    console.log("  ❌ Invalid email format");
    return;
  }

  // Validate password strength
  if (adminPassword.length < 8) {
    console.log("  ❌ Password must be at least 8 characters");
    return;
  }

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail.toLowerCase() },
        { role: "ADMIN" },
      ],
    },
  });

  if (existingAdmin) {
    console.log("  ℹ️  Admin user already exists, skipping");
    return;
  }

  // Hash password using same algorithm as auth service
  const passwordHash = await hashPassword(adminPassword);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: adminEmail.toLowerCase(),
      passwordHash,
      emailVerifiedAt: new Date(),
      username: "admin",
      displayName: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`  ✅ Development admin created: ${admin.email}`);
  console.log(`  ⚠️  DO NOT USE THIS IN PRODUCTION`);
}

/**
 * Hash password using scrypt (same as auth service)
 * Format: scrypt$salt$hash
 */
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
