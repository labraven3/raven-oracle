#!/bin/bash

################################################################################
# Raven Oracle Deployment Script
################################################################################

set -e
PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG_FILE="${HOME}/logs/deploy.log"
BACKUP_BEFORE_DEPLOY=true
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
mkdir -p "$(dirname "$LOG_FILE")"
log(){ echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"; }
log_error(){ echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"; }
log_warning(){ echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"; }
command_exists(){ command -v "$1" >/dev/null 2>&1; }

log "============================================"
log "Starting Raven Oracle Deployment"
log "============================================"
cd "$PROJECT_DIR" || { log_error "Failed to navigate to project directory"; exit 1; }
[ -d ".git" ] || { log_error "Not a git repository"; exit 1; }
CURRENT_BRANCH=$(git branch --show-current)
CURRENT_COMMIT=$(git rev-parse --short HEAD)
log "Current branch: $CURRENT_BRANCH"
log "Current commit: $CURRENT_COMMIT"

if [ "$BACKUP_BEFORE_DEPLOY" = true ] && [ -f "$PROJECT_DIR/scripts/backup.sh" ]; then
  log "Creating backup before deployment..."
  bash "$PROJECT_DIR/scripts/backup.sh" || log_warning "Backup failed, but continuing deployment"
fi

log "Pulling latest code from Git..."
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$CURRENT_BRANCH")
if [ "$LOCAL" != "$REMOTE" ]; then
  git pull --ff-only origin "$CURRENT_BRANCH"
  log "Updated to commit: $(git rev-parse --short HEAD)"
else
  log "Already up to date"
fi

log "Installing dependencies..."
npm ci --production=false

log "Generating Prisma Client..."
npx prisma generate

log "Running database migrations..."
npx prisma migrate deploy

log "Running TypeScript type check..."
npm run typecheck

log "Building API and Web..."
npm run build

if command_exists pm2; then
  log "Cleaning stale Raven frontend process if present..."
  pm2 delete raven-frontend >/dev/null 2>&1 || true

  log "Restarting Raven Oracle services from ecosystem.config.js..."
  pm2 delete raven-api >/dev/null 2>&1 || true
  pm2 delete raven-web >/dev/null 2>&1 || true
  pm2 start ecosystem.config.js

  log "Waiting for services to start..."
  sleep 5
  pm2 status | tee -a "$LOG_FILE"
  pm2 save
else
  log_warning "PM2 not found, skipping service restart"
fi

log "Testing local health endpoint..."
sleep 3
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/api/health}"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$HEALTH_URL" || true)
if [ "$HEALTH_RESPONSE" = "200" ]; then
  log "✓ Health check passed (HTTP 200)"
else
  log_error "✗ Health check failed (HTTP ${HEALTH_RESPONSE:-no-response})"
  pm2 status || true
  pm2 logs raven-api --lines 40 --nostream || true
  pm2 logs raven-web --lines 40 --nostream || true
  exit 1
fi

log "============================================"
log "Deployment completed successfully"
log "Commit: $(git rev-parse --short HEAD)"
log "============================================"
exit 0
