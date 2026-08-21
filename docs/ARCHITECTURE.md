# Raven Oracle — Architecture

## Product areas

- Public project discovery and project detail
- Creator project onboarding, metadata, approval readiness, resubmission, and raffle management
- Admin moderation, approval readiness, project-chain audit, raffle operations, integrity checks, and audit logs
- Raffle entry verification, CAPTCHA, eligibility evaluation, draw, winners, notification, and CSV operations

## Project catalog

The active product taxonomy is:

- NFT
- TOKEN
- AIRDROP
- OTHER

Legacy catalog values are blocked at the API/database boundary and are normalized to OTHER when required by migration history.

## Approval lifecycle

`DRAFT/created -> SUBMITTED -> REJECTED -> fix -> readiness check -> SUBMITTED -> APPROVED`

Approval readiness is centralized in:

`apps/api/src/services/project-approval.service.ts`

Creator and Admin consume the same readiness rules.

## Audit history

Project history uses the existing `AuditLog` model. Structured project-change events use `ADMIN_ACTION` with metadata `eventType`, including:

- PROJECT_METADATA_UPDATED
- PROJECT_RESUBMITTED
- existing PROJECT_APPROVED / PROJECT_REJECTED actions

Creator history is exposed through the project approval endpoint. Admin history is exposed through the admin version of the same endpoint and the admin approval workspace.

## Raffle lifecycle

`DRAFT -> SCHEDULED -> ACTIVE -> CLOSED -> EVALUATE -> DRAW -> COMPLETED`

Existing winner/notification and eligibility services are reused rather than replaced.

## Authentication

- User-facing routes use the normal user auth/session.
- Admin routes use the admin auth/session and may use the stored `raven_admin_token` Bearer contract used by the frontend.
- Backend authorization remains authoritative.
