#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Raven Oracle deployment"
echo "==> Root: $ROOT_DIR"

echo "==> Syncing main branch"
git checkout main
git pull --ff-only origin main

echo "==> Installing dependencies and generating Prisma Client"
npm install

echo "==> Building API + web"
npm run build

echo "==> Restarting PM2 services"
pm2 restart raven-api --update-env
pm2 restart raven-frontend --update-env
pm2 save

echo "==> Deployment complete"
pm2 status
