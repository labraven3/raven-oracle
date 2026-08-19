#!/usr/bin/env node

/**
 * Reset Admin Password
 */

const { randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../apps/api/.env') });

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('❌ Usage: node scripts/reset-admin-password.js <email> <new-password>');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔐 Resetting password...');
    console.log(`📧 Email: ${email}`);

    // Check if user exists
    const checkQuery = 'SELECT * FROM "User" WHERE email = $1';
    const checkResult = await client.query(checkQuery, [email]);

    if (checkResult.rows.length === 0) {
      console.error('❌ User not found!');
      process.exit(1);
    }

    const user = checkResult.rows[0];
    console.log(`✅ Found user: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Admin Approved: ${user.isAdminApproved}`);

    // Hash new password
    console.log('🔒 Hashing new password...');
    const passwordHash = await hashPassword(newPassword);

    // Update password
    console.log('💾 Updating password in database...');
    await client.query(
      'UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE email = $2',
      [passwordHash, email]
    );

    console.log('\n✅ Password updated successfully!');
    console.log('🎉 You can now login with the new password');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetPassword();
