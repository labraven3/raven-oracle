#!/usr/bin/env node

/**
 * Create Initial Admin User - Direct Database Approach
 * 
 * Usage: node scripts/create-admin-direct.js <email> <password>
 */

const { randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../apps/api/.env') });

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
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

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('❌ Usage: npm run create:admin <email> <password>');
    console.error('Example: npm run create:admin admin@example.com "SecurePass123"');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔐 Creating admin user...');
    console.log(`📧 Email: ${email}`);

    // Check if user exists
    const checkQuery = 'SELECT * FROM "User" WHERE email = $1';
    const checkResult = await client.query(checkQuery, [email]);

    if (checkResult.rows.length > 0) {
      const user = checkResult.rows[0];
      console.log('⚠️  User already exists!');
      
      if (user.role === 'ADMIN') {
        console.log('✅ User is already an admin');
        if (user.isAdminApproved) {
          console.log('✅ User is already approved');
        } else {
          console.log('⏳ Approving user...');
          await client.query(
            'UPDATE "User" SET "isAdminApproved" = true, "adminApprovedAt" = NOW() WHERE id = $1',
            [user.id]
          );
          console.log('✅ Admin approved!');
        }
      } else {
        console.log('🔄 Updating user to ADMIN role...');
        await client.query(
          'UPDATE "User" SET role = $1, "isAdminApproved" = true, "adminApprovedAt" = NOW() WHERE id = $2',
          ['ADMIN', user.id]
        );
        console.log('✅ User updated to ADMIN!');
      }
      process.exit(0);
    }

    // Hash password
    console.log('🔒 Hashing password...');
    const passwordHash = await hashPassword(password);

    // Create admin user
    console.log('💾 Creating user in database...');
    const userId = generateUUID();
    const username = email.split('@')[0];
    
    const insertQuery = `
      INSERT INTO "User" (
        id, email, username, "displayName", "passwordHash", 
        role, status, "emailVerifiedAt", "isAdminApproved", 
        "adminApprovedAt", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW(), true, NOW(), NOW(), NOW()
      ) RETURNING *
    `;
    
    const result = await client.query(insertQuery, [
      userId,
      email,
      username,
      'Admin',
      passwordHash,
      'ADMIN',
      'ACTIVE'
    ]);

    const user = result.rows[0];
    
    console.log('\n✅ Admin user created successfully!\n');
    console.log('📋 User Details:');
    console.log(`  Email: ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Status: ${user.status}`);
    console.log('\n🎉 Ready to login at /admin/login');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createAdmin();
