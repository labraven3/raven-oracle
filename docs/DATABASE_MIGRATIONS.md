# Raven Oracle Database Migrations Guide

## Overview

This guide covers database schema migrations using Prisma for Raven Oracle.

**Database:** `raven_oracle` (PostgreSQL)

---

## Migration Types

### Development Migrations
- Created during feature development
- Can be reset/modified before production
- Command: `npx prisma migrate dev`

### Production Migrations
- Applied to production database
- Cannot be rolled back automatically
- Command: `npx prisma migrate deploy`

---

## Development Workflow

### 1. Making Schema Changes

Edit `prisma/schema.prisma`:

```prisma
model User {
  id String @id @default(uuid()) @db.Uuid
  email String? @unique
  // ... other fields
  newField String? // ← Your new field
}
```

### 2. Create Migration

```bash
# Create a new migration with descriptive name
npx prisma migrate dev --name add_user_new_field

# This will:
# - Generate migration SQL in prisma/migrations/
# - Apply migration to development database
# - Regenerate Prisma Client
```

### 3. Verify Migration

```bash
# Check migration status
npx prisma migrate status

# View generated SQL
cat prisma/migrations/YYYYMMDDHHMMSS_add_user_new_field/migration.sql
```

### 4. Test Locally

```bash
# Run typecheck
npm run typecheck

# Run build
npm run build

# Test API endpoints that use the new field
# Verify data integrity
```

---

## Testing Migrations on Clean Database

**Before committing migrations**, test that they work on a fresh database:

### 1. Create Test Database

```bash
# Create empty test database
createdb raven_oracle_test
```

### 2. Update .env for Testing

```bash
# Temporarily point to test database
DATABASE_URL="postgresql://user:password@localhost:5432/raven_oracle_test"
```

### 3. Apply All Migrations

```bash
# Apply all migrations from scratch
npx prisma migrate deploy

# Expected output:
# ✔ Applying migration `20260815203310_init`
# ✔ Applying migration `20260816000000_fix_raffle_winner_selection_rank`
# ... (all migrations should succeed)
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Run Seed

```bash
npx prisma db seed
```

### 6. Verify Database

```bash
# Check tables were created
psql raven_oracle_test -c "\dt"

# Check data was seeded
psql raven_oracle_test -c "SELECT COUNT(*) FROM \"ChatChannel\";"
```

### 7. Clean Up

```bash
# Drop test database
dropdb raven_oracle_test

# Restore original DATABASE_URL in .env
```

---

## Production Migration Workflow

### ⚠️ CRITICAL: Always Backup First!

```bash
# 1. Create backup BEFORE migration
pg_dump -Fc raven_oracle -f ~/backups/raven_oracle/pre_migration_$(date +%Y%m%d_%H%M%S).dump

# 2. Verify backup was created
ls -lh ~/backups/raven_oracle/

# 3. Test backup restore (optional but recommended)
createdb raven_oracle_backup_test
pg_restore -d raven_oracle_backup_test ~/backups/raven_oracle/pre_migration_*.dump
dropdb raven_oracle_backup_test
```

### Production Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm ci

# 3. Generate Prisma Client
npx prisma generate

# 4. Check migration status
npx prisma migrate status

# 5. Apply pending migrations
npx prisma migrate deploy

# 6. Verify migration succeeded
npx prisma migrate status

# 7. Rebuild application
npm run build

# 8. Restart services
pm2 restart raven-api
pm2 restart raven-web

# 9. Verify health
curl http://localhost:4000/api/health
```

---

## Migration Best Practices

### ✅ DO:

1. **Create descriptive migration names**
   ```bash
   npx prisma migrate dev --name add_raffle_entry_limit
   ```

2. **Review generated SQL before applying**
   ```bash
   cat prisma/migrations/*/migration.sql
   ```

3. **Test migrations on development database first**

4. **Keep migrations small and focused**
   - One logical change per migration
   - Easier to debug and rollback if needed

5. **Add data migrations when needed**
   - Create custom SQL in migration file for data transformation

6. **Document breaking changes**
   - Add comments in migration file
   - Update CHANGELOG or migration notes

### ❌ DON'T:

1. **Never modify existing migrations that have been deployed**
   - Create a new migration instead

2. **Never run `npx prisma migrate reset` in production**
   - This drops all data!

3. **Never skip the backup step in production**

4. **Never deploy untested migrations**

5. **Never hardcode production data in migrations**

---

## Handling Migration Failures

### If Migration Fails in Development

```bash
# 1. Fix the issue in schema.prisma

# 2. Reset migration state
npx prisma migrate reset

# 3. Recreate migration
npx prisma migrate dev --name fixed_migration

# 4. Test again
```

### If Migration Fails in Production

```bash
# 1. DO NOT PANIC

# 2. Check migration status
npx prisma migrate status

# 3. Check database state
psql raven_oracle -c "\dt"

# 4. If migration is partially applied:
#    - Fix forward: Create a new migration to fix the issue
#    - Roll back: Restore from backup

# 5. If restoring from backup:
dropdb raven_oracle
createdb raven_oracle
pg_restore -d raven_oracle ~/backups/raven_oracle/pre_migration_*.dump

# 6. Document what happened
# 7. Fix migration locally
# 8. Test extensively
# 9. Try again
```

---

## Common Migration Patterns

### Adding a New Table

```prisma
model NewFeature {
  id String @id @default(uuid()) @db.Uuid
  name String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Adding a Column

```prisma
model User {
  // existing fields
  newColumn String? // nullable for backward compatibility
}
```

### Adding a Required Column with Default

```prisma
model User {
  // existing fields
  status UserStatus @default(ACTIVE)
}
```

### Adding a Relation

```prisma
model Post {
  id String @id @default(uuid()) @db.Uuid
  authorId String @db.Uuid
  author User @relation(fields: [authorId], references: [id])
  
  @@index([authorId])
}

model User {
  // existing fields
  posts Post[]
}
```

### Adding an Index

```prisma
model User {
  id String @id @default(uuid()) @db.Uuid
  email String?
  createdAt DateTime @default(now())
  
  @@index([createdAt]) // ← New index
}
```

### Data Migration Example

Sometimes you need to transform existing data. Create migration, then edit SQL:

```sql
-- Migration: 20260818000000_normalize_emails/migration.sql

-- Add column
ALTER TABLE "User" ADD COLUMN "emailNormalized" TEXT;

-- Populate with normalized data
UPDATE "User" SET "emailNormalized" = LOWER(TRIM("email")) WHERE "email" IS NOT NULL;

-- Make it unique after data is populated
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");
```

---

## Migration Status Commands

```bash
# View migration status
npx prisma migrate status

# View migrations history
ls -la prisma/migrations/

# Check database schema
npx prisma db pull

# Validate schema against database
npx prisma validate
```

---

## Rollback Strategy

Prisma doesn't support automatic rollback. Options:

### Option 1: Restore from Backup (Safest)

```bash
# Stop services
pm2 stop all

# Restore backup
dropdb raven_oracle
createdb raven_oracle
pg_restore -d raven_oracle ~/backups/raven_oracle/backup.dump

# Restart services
pm2 start all
```

### Option 2: Create Reverse Migration (Advanced)

```bash
# Create migration to undo changes
npx prisma migrate dev --name revert_problematic_change

# Manually edit migration SQL to reverse changes
# Test thoroughly
```

---

## Checking Migration Consistency

```bash
# Verify schema matches database
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma

# If output is empty, schema and DB are in sync
```

---

## Emergency Procedures

### Database is Corrupted

1. Stop all services
2. Restore latest backup
3. Apply any missing migrations
4. Verify data integrity
5. Restart services

### Migrations are Out of Sync

```bash
# Mark migration as applied without running it
npx prisma migrate resolve --applied MIGRATION_NAME

# Mark migration as rolled back
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

**Use with extreme caution!**

---

## Questions Before Migration

Before applying any migration to production, ask:

- [ ] Do I have a recent backup?
- [ ] Have I tested this migration on development database?
- [ ] Have I tested this migration on a clean database?
- [ ] Do I understand what each SQL statement does?
- [ ] Is this migration reversible or do I have a rollback plan?
- [ ] Have I coordinated with team about downtime (if needed)?
- [ ] Am I applying this during low-traffic hours?
- [ ] Do I have SSH access to the server?
- [ ] Do I have database credentials ready?

If you answered "No" to any of these, **reconsider timing**.

---

## Additional Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/ddl.html)
- Raven Oracle Backup Guide: `docs/DATABASE_BACKUP.md`

---

**Remember: Migrations change the foundation of your application. Take your time and be thorough.**
