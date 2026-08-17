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

## Security

Never commit real `.env` files, OAuth secrets, JWT secrets, private keys, or seed phrases. Raven Oracle does not require users to provide wallet private keys or seed phrases.
