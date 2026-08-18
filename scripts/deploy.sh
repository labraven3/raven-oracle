#!/bin/bash

################################################################################
# Raven Oracle Deployment Script
# 
# This script automates the deployment process for Raven Oracle including:
# - Pulling latest code from Git
# - Installing dependencies
# - Running database migrations
# - Building applications
# - Restarting services
#
# Usage: ./deploy.sh
################################################################################

set -e  # Exit on error

# Configuration
PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG_FILE="${HOME}/logs/deploy.log"
BACKUP_BEFORE_DEPLOY=true

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create logs directory
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log messages
log() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Function to check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Start deployment
log "============================================"
log "Starting Raven Oracle Deployment"
log "============================================"

# Navigate to project directory
log "Navigating to project directory: $PROJECT_DIR"
cd "$PROJECT_DIR" || {
  log_error "Failed to navigate to project directory"
  exit 1
}

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  log_error "Not a git repository"
  exit 1
fi

# Show current branch and commit
CURRENT_BRANCH=$(git branch --show-current)
CURRENT_COMMIT=$(git rev-parse --short HEAD)
log "Current branch: $CURRENT_BRANCH"
log "Current commit: $CURRENT_COMMIT"

# Backup database before deployment
if [ "$BACKUP_BEFORE_DEPLOY" = true ]; then
  log "Creating backup before deployment..."
  
  if [ -f "$PROJECT_DIR/scripts/backup.sh" ]; then
    bash "$PROJECT_DIR/scripts/backup.sh" || {
      log_warning "Backup failed, but continuing deployment"
    }
  else
    log_warning "Backup script not found, skipping backup"
  fi
fi

# Pull latest code
log "Pulling latest code from Git..."
git fetch origin || {
  log_error "Failed to fetch from origin"
  exit 1
}

# Check if there are updates
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$CURRENT_BRANCH)

if [ "$LOCAL" = "$REMOTE" ]; then
  log "Already up to date"
else
  log "Updates available, pulling changes..."
  git pull origin "$CURRENT_BRANCH" || {
    log_error "Failed to pull changes"
    exit 1
  }
  
  NEW_COMMIT=$(git rev-parse --short HEAD)
  log "Updated to commit: $NEW_COMMIT"
fi

# Install root dependencies
log "Installing root dependencies..."
npm ci --production=false || {
  log_error "Failed to install root dependencies"
  exit 1
}

# Install API dependencies
log "Installing API dependencies..."
cd apps/api
npm ci --production=false || {
  log_error "Failed to install API dependencies"
  exit 1
}
cd ../..

# Install Web dependencies
log "Installing Web dependencies..."
cd apps/web
npm ci --production=false || {
  log_error "Failed to install Web dependencies"
  exit 1
}
cd ../..

# Generate Prisma Client
log "Generating Prisma Client..."
npx prisma generate || {
  log_error "Failed to generate Prisma Client"
  exit 1
}

# Run database migrations
log "Running database migrations..."
npx prisma migrate deploy || {
  log_error "Database migration failed"
  log_error "Deployment aborted - database may be in inconsistent state"
  exit 1
}

# Run TypeScript type checking
log "Running TypeScript type check..."
npm run typecheck || {
  log_error "TypeScript type check failed"
  exit 1
}

# Build API
log "Building API..."
cd apps/api
npm run build || {
  log_error "Failed to build API"
  exit 1
}
cd ../..

# Build Web
log "Building Web application..."
cd apps/web
npm run build || {
  log_error "Failed to build Web application"
  exit 1
}
cd ../..

# Restart services with PM2
log "Restarting services..."

if command_exists pm2; then
  pm2 restart ecosystem.config.js || {
    log_error "Failed to restart services with PM2"
    exit 1
  }
  
  # Wait for services to start
  log "Waiting for services to start..."
  sleep 5
  
  # Show PM2 status
  log "PM2 Status:"
  pm2 status | tee -a "$LOG_FILE"
  
  # Save PM2 configuration
  pm2 save || {
    log_warning "Failed to save PM2 configuration"
  }
else
  log_warning "PM2 not found, skipping service restart"
  log "Please restart services manually"
fi

# Test health endpoint
log "Testing health endpoint..."
sleep 3

HEALTH_URL="${HEALTH_URL:-http://localhost:4000/api/health}"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$HEALTH_URL")

if [ "$HEALTH_RESPONSE" -eq 200 ]; then
  log "✓ Health check passed (HTTP $HEALTH_RESPONSE)"
else
  log_error "✗ Health check failed (HTTP $HEALTH_RESPONSE)"
  log_error "Deployment may have issues"
fi

# Show deployment summary
log "============================================"
log "Deployment Summary"
log "============================================"
log "Branch: $CURRENT_BRANCH"
log "Previous commit: $CURRENT_COMMIT"
log "Current commit: $(git rev-parse --short HEAD)"
log "Deployed at: $(date '+%Y-%m-%d %H:%M:%S')"
log "============================================"
log "✓ Deployment completed successfully"
log "============================================"

# Show recent logs
log ""
log "Recent application logs:"
if command_exists pm2; then
  pm2 logs --lines 10 --nostream | tee -a "$LOG_FILE"
fi

exit 0
