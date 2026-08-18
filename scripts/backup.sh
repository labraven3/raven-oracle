#!/bin/bash

################################################################################
# Raven Oracle Database Backup Script
# 
# This script performs automated backups of the PostgreSQL database and
# optionally the application files.
#
# Usage: ./backup.sh
# Schedule: Add to crontab for daily execution
################################################################################

# Configuration
BACKUP_DIR="${HOME}/backups"
DB_NAME="${DB_NAME:-raven_oracle}"
DB_USER="${DB_USER:-raven_user}"
DB_HOST="${DB_HOST:-localhost}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Start backup
echo "============================================"
echo "Starting backup at $(date)"
echo "============================================"

# Database backup
echo "Backing up database: $DB_NAME"
PGPASSWORD="${DB_PASSWORD}" pg_dump -U "$DB_USER" -h "$DB_HOST" "$DB_NAME" | gzip > "$BACKUP_DIR/db_${DATE}.sql.gz"

if [ $? -eq 0 ]; then
  echo "✓ Database backup completed: db_${DATE}.sql.gz"
  
  # Get backup size
  BACKUP_SIZE=$(du -h "$BACKUP_DIR/db_${DATE}.sql.gz" | cut -f1)
  echo "  Size: $BACKUP_SIZE"
else
  echo "✗ Database backup failed!"
  exit 1
fi

# Application backup (optional - uncomment to enable)
# echo "Backing up application files"
# cd "$(dirname "$0")/.." || exit 1
# tar -czf "$BACKUP_DIR/app_${DATE}.tar.gz" \
#   --exclude='node_modules' \
#   --exclude='.next' \
#   --exclude='dist' \
#   --exclude='.env' \
#   --exclude='.env.local' \
#   --exclude='.git' \
#   .
# 
# if [ $? -eq 0 ]; then
#   echo "✓ Application backup completed: app_${DATE}.tar.gz"
#   APP_SIZE=$(du -h "$BACKUP_DIR/app_${DATE}.tar.gz" | cut -f1)
#   echo "  Size: $APP_SIZE"
# else
#   echo "✗ Application backup failed!"
# fi

# Remove old backups
echo "Removing backups older than $RETENTION_DAYS days"
DELETED_DB=$(find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
DELETED_APP=$(find "$BACKUP_DIR" -name "app_*.tar.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
echo "  Deleted: $DELETED_DB database backups, $DELETED_APP application backups"

# List current backups
echo ""
echo "Current backups:"
ls -lh "$BACKUP_DIR" | tail -n +2

# Calculate total backup size
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo ""
echo "Total backup size: $TOTAL_SIZE"

echo "============================================"
echo "Backup completed at $(date)"
echo "============================================"
