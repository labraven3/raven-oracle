#!/usr/bin/env node

/**
 * Create Initial Admin User
 * 
 * Usage: node scripts/create-admin.js <email> <password>
 * Example: node scripts/create-admin.js admin@yourdomain.com "YourPassword123"
 */

const { randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
require('dotenv').config({ path: 'apps/api/.env' });

// Import Prisma from api app
const { PrismaClient } = require('./apps/api/node_modules/@prisma/client');

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  // Validate password
  if (!password || password.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Password must contain at least one number');
  }

  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('❌ Usage: npm run create:admin <email> <password>');
    console.error('Example: npm run create:admin admin@example.com "SecurePass123"');
    process.exit(1);
  }

  try {
    console.log('🔐 Creating admin user...');
    console.log(`📧 Email: ${email}`);

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      console.log('⚠️  User already exists!');
      if (existing.role === 'ADMIN') {
        console.log('✅ User is already an admin');
        if (existing.isAdminApproved) {
          console.log('✅ User is already approved');
        } else {
          console.log('⏳ Approving user...');
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              isAdminApproved: true,
              adminApprovedAt: new Date(),
            },
          });
          console.log('✅ Admin approved!');
        }
      } else {
        console.log('🔄 Updating user to ADMIN role...');
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            role: 'ADMIN',
            isAdminApproved: true,
            adminApprovedAt: new Date(),
          },
        });
        console.log('✅ User updated to ADMIN!');
      }
      process.exit(0);
    }

    // Hash password
    console.log('🔒 Hashing password...');
    const passwordHash = await hashPassword(password);

    // Create admin user
    console.log('💾 Creating user in database...');
    const user = await prisma.user.create({
      data: {
        email,
        username: email.split('@')[0],
        displayName: 'Admin',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        isAdminApproved: true,
        adminApprovedAt: new Date(),
      },
    });

    console.log('\n✅ Admin user created successfully!\n');
    console.log('📋 User Details:');
    console.log(`  Email: ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Status: ${user.status}`);
    console.log('\n🎉 Ready to login at /admin/login');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
