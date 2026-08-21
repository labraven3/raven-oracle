# Raven Oracle — Engineering Changelog

## 2026-08-22

### Project approval hardening
- Centralized project approval readiness validation.
- Added Creator readiness view and Admin approval-readiness workspace.
- Added rejection reason + creator resubmission lifecycle.
- Added project audit history using the existing AuditLog model.
- Added metadata-change and resubmission audit events.

### Product catalog
- Formalized NFT / TOKEN / AIRDROP / OTHER catalog.
- Added project discovery filtering and type-specific metadata.
- Added chain validation and project-chain audit visibility.

### Raffle hardening
- Added draft lifecycle management.
- Added creator/admin raffle operations and integrity audits.
- Added CAPTCHA/Turnstile verification path and centralized eligibility enforcement.

### Documentation
- Added `docs/GOLDEN_RULES.md` as permanent development constraints.
- Added `docs/ARCHITECTURE.md` as the current architecture reference.
