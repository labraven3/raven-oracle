# Raven Oracle

Raven Oracle is an NFT-focused community platform for discovering NFT projects, participating in fair raffles, completing social eligibility tasks, submitting alpha, and claiming rewards.

## Product

- NFT project discovery and project submission/moderation
- Raffle creation, scheduling, publishing, entry limits and lifecycle management
- X and Discord OAuth connections
- X Follow / Like / Repost and Discord Join verification
- Server-authoritative raffle eligibility
- Deterministic/auditable winner selection
- Winner notification, claim and replacement flows
- Participant account and prize-address management
- Creator Studio and admin moderation tools
- Alpha submissions, verification and leaderboard
- Community chat with moderation/rate limiting
- Light and dark UI themes

## Architecture

- `apps/web`: Next.js 16 + React + TypeScript + Tailwind CSS frontend.
- `apps/api`: Express 5 + TypeScript backend.
- `prisma`: PostgreSQL schema and migrations using Prisma 7.
- npm workspaces are configured from the repository root.

## Local development

Install dependencies:

```bash
npm install
```

Prepare the API environment:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

Set real PostgreSQL, JWT, X OAuth, and Discord OAuth values in `apps/api/.env`.

Generate Prisma Client and apply migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

Run the API:

```bash
npm run dev:api
```

Run the web app in another terminal:

```bash
npm run dev:web
```

Open `http://localhost:3000` and the API health endpoint at `http://localhost:4000/api/health`.

## Verification

Before shipping changes:

```bash
npm run typecheck
npm run build
npm run lint
```

CI runs dependency installation, Prisma Client generation, and the full workspace TypeScript check.

## OAuth setup

Register the application callback URLs exactly as configured by `X_REDIRECT_URI` and `DISCORD_REDIRECT_URI`. For local development the defaults are under `http://localhost:4000/api/auth/.../callback`.

X task verification requires the scopes requested by the application. Discord task verification requires the authenticated user's guild access.

## Production Deployment

Raven Oracle is production-ready with comprehensive deployment documentation:

- **[Quick Start Guide](docs/QUICK_START_DEPLOYMENT.md)** - Deploy in ~2.75 hours
- **[Complete Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Detailed step-by-step instructions
- **[Systemd Setup](docs/SYSTEMD_SETUP.md)** - Alternative to PM2 process management

### Deployment Features

- Free-tier compatible (Oracle Cloud, GCP, AWS, DigitalOcean)
- Single-server architecture (Nginx → Next.js + Express → PostgreSQL)
- Automated backups (daily, 7-day retention)
- Health monitoring with auto-restart
- Let's Encrypt SSL/HTTPS
- PM2 or Systemd process management
- Rate limiting and security headers
- One-command deployment updates

### Quick Deploy

```bash
# Follow QUICK_START_DEPLOYMENT.md for full instructions
# Or use automated deployment:
./scripts/deploy.sh
```

See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for complete production deployment instructions.

## Security

Never commit real `.env` files, OAuth secrets, JWT secrets, private keys, or seed phrases. Raven Oracle does not require users to provide wallet private keys or seed phrases.

All security requirements verified - see [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).
