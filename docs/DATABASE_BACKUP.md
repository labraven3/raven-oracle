# Raven Oracle Database Backup Guide

## ⚠️ CRITICAL: This guide is for `raven_oracle` database ONLY

**DO NOT run these commands on any other database (e.g., Meetvia)**

---

## Overview

This document describes how to backup and restore the Raven Oracle PostgreSQL database.

**Database Name:** `raven_oracle`

**Backup Frequency:** Daily minimum (recommended)

**Retention:** Keep at least 7 daily backups and 4 weekly backups

---

## Prerequisites

- PostgreSQL client tools installed (`pg_dump`, `pg_restore`)
- Database connection credentials
- Sufficient disk space for backups (estimate: 2-3x current database size)
- Write access to backup directory

---

## Backup Commands

### 1. Full Database Backup (SQL Format)

```bash
# Create backup directory if it doesn't exist
mkdir -p ~/backups/raven_oracle

# Backup with timestamp
pg_dump raven_oracle > ~/backups/raven_oracle/backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip ~/backups/raven_oracle/backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Full Database Backup (Custom Format - Recommended)

```bash
# Custom format allows parallel restore and selective restore
pg_dump -Fc raven_oracle -f ~/backups/raven_oracle/backup_$(date +%Y%m%d_%H%M%S).dump
```

### 3. Database Backup with Connection String

```bash
# If DATABASE_URL environment variable is set
pg_dump $DATABASE_URL -Fc -f ~/backups/raven_oracle/backup_$(date +%Y%m%d_%H%M%S).dump

# Or with explicit connection parameters
pg_dump -h localhost -U raven_user -d raven_oracle -Fc -f ~/backups/raven_oracle/backup_$(date +%Y%m%d_%H%M%S).dump
```

---

## Automated Backup Script

Create a backup script at `scripts/backup-db.sh`:

```bash
#!/bin/bash
# Raven Oracle Database Backup Script

set -e

BACKUP_DIR="$HOME/backups/raven_oracle"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.dump"
DATABASE_NAME="raven_oracle"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Starting backup of $DATABASE_NAME at $TIMESTAMP"

# Create backup
pg_dump -Fc "$DATABASE_NAME" -f "$BACKUP_FILE"

# Verify backup was created
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup completed successfully: $BACKUP_FILE ($SIZE)"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "backup_*.dump" -mtime +30 -delete
echo "Cleaned up old backups (>30 days)"

echo "Backup completed at $(date)"
```

Make it executable:
```bash
chmod +x scripts/backup-db.sh
```

---

## Schedule Automatic Backups (Cron)

Add to crontab (`crontab -e`):

```cron
# Daily backup at 2 AM
0 2 * * * /path/to/raven-oracle/scripts/backup-db.sh >> /path/to/raven-oracle/logs/backup.log 2>&1

# Weekly backup at 3 AM on Sunday
0 3 * * 0 /path/to/raven-oracle/scripts/backup-db.sh >> /path/to/raven-oracle/logs/backup.log 2>&1
```

---

## Restore Procedures

### ⚠️ WARNING: Restoration is DESTRUCTIVE

**ALWAYS verify:**
1. You are restoring to the correct database (`raven_oracle`)
2. You have a recent backup of the current state
3. All applications are stopped
4. You understand this will REPLACE all data

### 1. Restore from SQL Backup

```bash
# Stop API server first
pm2 stop raven-api

# Drop existing database (BE CAREFUL!)
dropdb raven_oracle

# Create fresh database
createdb raven_oracle

# Restore from backup
psql raven_oracle < ~/backups/raven_oracle/backup_20260818_020000.sql

# Restart API server
pm2 start raven-api
```

### 2. Restore from Custom Format Backup

```bash
# Stop API server first
pm2 stop raven-api

# Drop and recreate database
dropdb raven_oracle
createdb raven_oracle

# Restore with parallel jobs (faster)
pg_restore -d raven_oracle -j 4 ~/backups/raven_oracle/backup_20260818_020000.dump

# Restart API server
pm2 start raven-api
```

### 3. Restore Specific Tables Only

```bash
# List tables in backup
pg_restore -l ~/backups/raven_oracle/backup_20260818_020000.dump

# Restore specific table
pg_restore -d raven_oracle -t User ~/backups/raven_oracle/backup_20260818_020000.dump
```

---

## Verify Backup Integrity

### Test restore to a temporary database:

```bash
# Create temporary database
createdb raven_oracle_test

# Restore backup to test database
pg_restore -d raven_oracle_test ~/backups/raven_oracle/backup_20260818_020000.dump

# Verify data
psql raven_oracle_test -c "SELECT COUNT(*) FROM \"User\";"
psql raven_oracle_test -c "SELECT COUNT(*) FROM \"Raffle\";"

# Drop test database
dropdb raven_oracle_test
```

---

## Before Production Migration

**ALWAYS backup before running Prisma migrations:**

```bash
# 1. Create backup
pg_dump -Fc raven_oracle -f ~/backups/raven_oracle/pre_migration_$(date +%Y%m%d_%H%M%S).dump

# 2. Verify backup was created
ls -lh ~/backups/raven_oracle/

# 3. Run migration
npx prisma migrate deploy

# 4. Verify migration succeeded
npx prisma migrate status
```

---

## Backup Storage Best Practices

### ❌ DO NOT:
- Store backups only on the same disk as the database
- Store backups only on the same server
- Delete all old backups immediately

### ✅ DO:
- Copy backups to a different physical location
- Use object storage (S3, Backblaze B2, etc.) for off-site backups
- Keep multiple backup generations
- Test restore procedures regularly
- Document restore procedures

### Example: Copy to remote storage

```bash
# Using rsync to remote server
rsync -avz ~/backups/raven_oracle/ backup-server:/backups/raven_oracle/

# Using AWS S3 (if available)
aws s3 sync ~/backups/raven_oracle/ s3://your-bucket/raven-oracle-backups/
```

---

## Monitoring Backup Success

Check latest backup:
```bash
ls -lht ~/backups/raven_oracle/ | head -n 5
```

Verify backup size (should not be 0 or too small):
```bash
du -sh ~/backups/raven_oracle/backup_*.dump
```

---

## Emergency Recovery Checklist

If database is corrupted or lost:

- [ ] Stop all API servers immediately
- [ ] Identify most recent valid backup
- [ ] Create emergency backup of current state (if possible)
- [ ] Verify backup file integrity
- [ ] Prepare fresh database
- [ ] Restore from backup
- [ ] Run `npx prisma migrate deploy` if needed
- [ ] Verify critical data is present
- [ ] Restart API servers
- [ ] Monitor application logs
- [ ] Notify users if data loss occurred

---

## Questions?

If you're unsure about any backup or restore procedure:

1. **DO NOT proceed** with destructive operations
2. Test on a development/staging database first
3. Document any issues or unexpected behavior
4. Create additional backups before attempting fixes

---

**Remember: Backups are only useful if you can restore them successfully. Test your restore procedures regularly!**
