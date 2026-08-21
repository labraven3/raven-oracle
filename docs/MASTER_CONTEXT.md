# Raven Oracle — Master Context

This file is the compact source of truth for continuing development.

## Current rules

Read `docs/GOLDEN_RULES.md` before making architectural changes.

## Current architecture

Read `docs/ARCHITECTURE.md` for the current verified product and workflow structure.

## Development contract

- Preserve working code.
- Implement every feature as a coherent frontend + backend + admin slice where the feature has those surfaces.
- Use existing authentication and authorization boundaries.
- Keep production-safe validation server-side.
- Reuse existing database models/services whenever they already cover the requirement.
- Prefer additive modules and isolated routes over full rewrites.
- Keep main deployable.

## Current high-value workflows

### Project

Creator creates/edits project -> metadata/type/chain validation -> approval readiness -> Admin approval or rejection -> rejected creator fixes -> readiness -> resubmission -> Admin approval.

### Raffle

Creator draft -> scheduled/active/closed lifecycle -> eligibility evaluation -> draw -> winners -> notifications/CSV.

### Audit

Project moderation, metadata changes, resubmission, and other system actions are recorded in the existing `AuditLog` model. Project-facing history is exposed through the approval workflow.

## Deployment checkpoint

The production verification sequence is:

```bash
cd ~/raven-oracle && git pull origin main
npm ci
npx prisma generate
npm run typecheck && npm run build
pm2 restart raven-api raven-frontend
```
