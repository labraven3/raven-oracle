# Raven Oracle — Golden Rules

## Non-negotiable

1. Never replace or break a working feature without an explicit migration path.
2. Every new product feature is implemented across frontend, backend/API, and admin panel where applicable.
3. The canonical project catalog is NFT, TOKEN, AIRDROP, OTHER.
4. The existing raffle, eligibility, CAPTCHA, evaluation, draw, winner, and notification engines remain backward-compatible.
5. Security is enforced server-side; UI-only restrictions are never considered sufficient.
6. Approval readiness has one backend source of truth: `project-approval.service.ts`.
7. Admin authentication must use the existing admin session/token contract; never weaken authorization to fix UI access.
8. Main must remain deployable: `npm run typecheck && npm run build` must pass before production restart.
9. Pull/build/restart is done at agreed checkpoints; do not churn the server for every small commit.
10. Update this documentation when architecture or permanent workflow decisions change.

## Production command sequence

```bash
cd ~/raven-oracle && git pull origin main
npm ci
npx prisma generate
npm run typecheck && npm run build
pm2 restart raven-api raven-frontend
```

## Change discipline

- Read the current repository implementation before patching.
- Prefer additive, isolated modules over risky rewrites.
- Reuse existing services and authorization boundaries.
- Do not create duplicate destructive database migrations when an equivalent migration already exists.
