#!/usr/bin/env node

/**
 * Reset an existing ADMIN account password.
 * Usage: npm run reset:password -- <email> <new-password>
 */

const { randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../apps/api/.env') });

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  if (!password || password.length < 12) throw new Error('Password must be at least 12 characters');
  if (!/[A-Z]/.test(password)) throw new Error('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) throw new Error('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) throw new Error('Password must contain at least one number');

  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function resetPassword() {
  const email = process.argv[2]?.trim().toLowerCase();
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('Usage: npm run reset:password -- <email> <new-password>');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    const checkResult = await client.query(
      'SELECT id, email, username, role, status, "isAdminApproved" FROM "User" WHERE email = $1 AND "deletedAt" IS NULL',
      [email]
    );

    if (checkResult.rows.length === 0) throw new Error('Admin user not found');

    const user = checkResult.rows[0];
    if (user.role !== 'ADMIN') throw new Error('Refusing to reset password: account is not an ADMIN');
    if (user.status !== 'ACTIVE') throw new Error(`Refusing to reset password: account status is ${user.status}`);
    if (!user.isAdminApproved) throw new Error('Refusing to reset password: admin is not approved');

    const passwordHash = await hashPassword(newPassword);

    await client.query(
      'UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2',
      [passwordHash, user.id]
    );

    console.log('ADMIN PASSWORD RESET SUCCESSFULLY');
    console.log(`Email: ${user.email}`);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetPassword();
