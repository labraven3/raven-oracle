# Raven Oracle

Raven Oracle is an open crypto and NFT community platform designed to help ordinary people discover opportunities, contribute useful alpha, build reputation, and compete for fair rewards without paid alpha-group access.

This repository is an MVP foundation under development. It currently contains a static Next.js homepage prototype and a small Express API foundation with a health endpoint. Product features such as authentication, raffles, wallet verification, chat, admin tooling, Prisma, Redis, and database migrations are intentionally not implemented yet.

## Architecture

- `apps/web`: Next.js frontend using TypeScript and Tailwind CSS.
- `apps/api`: Express backend using TypeScript.
- npm workspaces are configured from the repository root.
- PostgreSQL is planned for the API, but no schema or migrations exist yet.

## Local Development

Install dependencies from the repository root:

```bash
npm install
```

Run the frontend:

```bash
npm run dev:web
```

Run the backend:

```bash
npm run dev:api
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Environment

Copy the example environment files before local development:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

Do not commit real `.env` files. Secrets, API keys, wallet private keys, and seed phrases must never be stored in this repository. Raven Oracle users should never be asked for private keys or seed phrases.

`DATABASE_URL` is documented as a placeholder for the existing local `raven_oracle` PostgreSQL database. Database access is not wired into the application yet.
