#!/bin/bash
# Raven Oracle Database Backup Script
#
# This script creates a backup of the raven_oracle PostgreSQL database.
# It is safe to run multiple times and will not affect other databases.
#
# Usage: ./scripts/backup-db.sh
#
# Environment variables:
#   DATABASE_NAME: Name of database to backup (default: raven_oracle)
#   BACKUP_DIR: Directory to store backups (default: ~/backups/raven_oracle)
#

set -e

# Configuration
DATABASE_NAME="${DATABASE_NAME:-raven_oracle}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/raven_oracle}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.dump"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "========================================="
echo "Raven Oracle Database Backup"
echo "========================================="
echo "Database: $DATABASE_NAME"
echo "Timestamp: $TIMESTAMP"
echo "Backup file: $BACKUP_FILE"
echo "========================================="

# Check if database exists
if ! psql -lqt | cut -d \| -f 1 | grep -qw "$DATABASE_NAME"; then
    echo -e "${RED}❌ Database '$DATABASE_NAME' does not exist!${NC}"
    exit 1
fi

# Create backup
echo "Creating backup..."
if pg_dump -Fc "$DATABASE_NAME" -f "$BACKUP_FILE"; then
    # Verify backup was created
    if [ -f "$BACKUP_FILE" ]; then
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo -e "${GREEN}✅ Backup completed successfully${NC}"
        echo "   File: $BACKUP_FILE"
        echo "   Size: $SIZE"
    else
        echo -e "${RED}❌ Backup file was not created!${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

# Remove backups older than 30 days
echo "Cleaning up old backups (>30 days)..."
DELETED=$(find "$BACKUP_DIR" -name "backup_*.dump" -mtime +30 -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Deleted $DELETED old backup(s)${NC}"
else
    echo "No old backups to delete"
fi

# List recent backups
echo "========================================="
echo "Recent backups:"
ls -lht "$BACKUP_DIR"/backup_*.dump 2>/dev/null | head -n 5 || echo "No backups found"
echo "========================================="

echo -e "${GREEN}Backup completed at $(date)${NC}"
