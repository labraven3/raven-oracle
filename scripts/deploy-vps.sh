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

echo "==> Recreating PM2 services with clean process environments"
pm2 delete raven-api >/dev/null 2>&1 || true
pm2 delete raven-frontend >/dev/null 2>&1 || true
pm2 start npm --name raven-api -- run start:api
pm2 start npm --name raven-frontend -- run start:web
pm2 save

echo "==> Verifying PM2 services"
pm2 status
