# Raven Oracle — Brother Handoff

## Important current state

This repository contains the current Raven Oracle NFT raffle platform work. Continue from the existing implementation; do not rebuild the product from scratch.

The latest local validation revealed a Prisma schema/client problem. The repository should be treated as **not typecheck-clean right now** until the schema/client is repaired. Do not assume the latest commits are production-ready just because the UI/features exist.

## Product direction

Raven Oracle is an NFT raffle + whitelist platform.

Keep the homepage simple and platform-like, inspired by the density/structure of Atlas3, but do not clone Atlas3's UI, assets, branding, wording, or code.

Use Raven Oracle's own futuristic purple/black visual identity with dark/light mode.

Do not bring back:
- Community
- Chat
- Token/Game sections
- NFT wallet connection as an initial requirement
- Winner claim/expiry/replacement workflow

## Working integrations / flows

The user reports these are currently working and should not be unnecessarily changed:
- X connection
- Discord connection
- Verified-email link flow

The user explicitly decided to leave OTP aside for now. Do not expand or redesign OTP.

## Existing raffle/project work

The codebase already contains infrastructure/UI for:
- NFT projects
- Project detail pages
- Raffle creation
- Draft raffle management
- Raffle publishing
- Start/end date controls
- Raffle lifecycle/status management
- Raffle tasks
- Creator dashboard
- Winner management
- King of Alpha
- Dark/light theme
- X/Discord identities
- Wallet addresses
- Eligibility/security infrastructure
- Admin tooling

## Winner workflow

Raven Oracle is a whitelist platform, not a prize-claim platform.

Correct model:

Raffle closes
-> eligibility finalized
-> random draw
-> winner selected permanently
-> creator receives wallet list
-> winner receives email notification
-> NFT project whitelists winner wallet
-> finished

Do NOT implement:
- claim deadline
- claim button
- expiry because email was not opened
- automatic winner replacement
- replacement because the winner did not respond

## Winner email — remaining work

Finish and verify the real winner email workflow:
- Winner selected -> verified email notification
- Send/retry/resend controls where already present
- Real SMTP delivery verification
- Clear success/failure status

The email is notification only. It is not a claim workflow.

## Whitelist export — required result

Creator export must be a CSV/Excel-compatible sheet containing the actual connected identities and wallet data for winners.

Required columns:
- Rank
- X username
- Discord username
- Wallet address
- Email
- Email verified
- Winner status
- Notification status
- Selected time
- Notified time

Use the stored SocialAccount records for X/Discord and the stored wallet snapshot/address. Do not invent frontend-only values.

## Raffle joining — unfinished

The user previously said raffle joining is not working and should be left aside while winner email/export and UI are handled first.

It remains a major unfinished core feature:
- Join button
- Eligibility evaluation
- Required task verification
- Entry creation
- Duplicate-entry protection
- Correct error/success states

After the UI, winner/export, and schema stabilization are complete, return to this.

## Homepage visual direction

### NFT/PFP animation

Homepage should have a continuously changing OG NFT/PFP showcase.

Concept:
- BAYC
- CryptoPunks
- Azuki
- other established OG collections
- automatic cycling
- smooth transitions
- subtle 3D/floating motion
- premium futuristic feel
- no noisy slideshow effect

Use assets that are legally usable/licensed/owned where required; do not blindly scrape copyrighted artwork.

### Blockchain animation

This is a separate visual from the NFT showcase.

Only the actual blockchain/ecosystem logo/image should appear — **no blockchain names as text**.

Concept:
- 3D/floating/spinning logo
- automatically changes between supported ecosystems
- smooth morph/fade transitions
- continuous loop
- subtle glow/depth
- examples discussed: Ethereum, Solana, Robinhood

Do not add textual labels such as "Ethereum" or "Solana" underneath.

## UI order after stabilization

1. Repair Prisma/schema/client state and get typecheck/build clean.
2. Finish/polish futuristic homepage.
3. Fix remaining UI/legacy route bugs.
4. Finish real winner email.
5. Finish/verify whitelist export.
6. Fix raffle joining end-to-end.
7. Add/finalize security and anti-abuse controls.
8. Full end-to-end testing.
9. Production deployment verification.

## Critical development rule

Do not stack speculative patches on top of broken Prisma types.

First inspect:
- prisma/schema.prisma
- prisma migrations
- prisma.config.ts
- generated Prisma client
- package-lock/package dependencies

Then make one coherent fix and regenerate Prisma.

Do not change working X, Discord, verified-email, or existing raffle lifecycle behavior unless required by the schema fix.

## Current known blocker

The latest user validation reported a Prisma schema validation failure beginning around:
`authAuditLogs AuthAuditLog[]`
with many schema validation errors.

That means the immediate next task is **Prisma schema repair and regeneration**, not another UI patch.

Once the schema is valid, run:

```bash
npm install
npm run prisma:generate
npm run typecheck
```

Then continue product work.
