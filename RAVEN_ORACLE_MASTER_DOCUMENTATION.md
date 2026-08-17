# RAVEN ORACLE — MASTER PROJECT DOCUMENTATION & COMPLETION PLAN

Version: 1.0
Status: Master implementation document
Rule: Do not rebuild the project from scratch. Continue from the existing repository.

Repository:
https://github.com/labraven3/raven-oracle

---

# 1. PROJECT PURPOSE

Raven Oracle is an NFT/Web3 community platform focused on:

- NFT/project discovery
- Project submission and moderation
- Fair raffles
- Social eligibility tasks
- Alpha submissions and leaderboard
- User accounts
- Wallet/prize-address management
- Community chat
- Creator tools
- Admin moderation
- Auditable winner selection

The existing repository already contains a substantial full-stack implementation.

The goal of this document is to define EVERYTHING that remains to be completed, tested, secured, documented and deployed.

AI coding tools such as Claude Code, VS Code/Copilot, Kiro or similar tools must use this document as the source of truth.

---

# 2. NON-NEGOTIABLE DEVELOPMENT RULES

1. DO NOT rebuild the project from scratch.
2. DO NOT replace the existing architecture without a documented reason.
3. Inspect existing code before creating new code.
4. Preserve working features.
5. Every feature must be implemented end-to-end:
   UI -> API -> database -> validation -> error handling -> tests.
6. No paid services may be introduced at this stage.
7. No SMS OTP provider.
8. No WhatsApp OTP provider.
9. No MSG91, Twilio, Vonage, etc.
10. Authentication must use free methods.
11. Never commit real secrets.
12. Never store wallet private keys or seed phrases.
13. Never expose server secrets in frontend code.
14. All production configuration must come from environment variables.
15. Every major change must pass typecheck, lint and build.
16. Test locally before deployment.
17. Do not delete existing functionality unless explicitly required.
18. If a requirement is unclear, inspect existing implementation and this document before changing architecture.
19. Keep database migrations backward-compatible where practical.
20. Update this document whenever a major architectural decision changes.

---

# 3. CURRENT ARCHITECTURE

Existing architecture:

Frontend:
- Next.js
- React
- TypeScript
- Tailwind CSS

Backend:
- Express
- TypeScript
- JWT authentication
- Zod validation

Database:
- PostgreSQL
- Prisma ORM

Repository structure:

apps/
  web/
  api/

prisma/
  schema.prisma
  migrations/

Root:
  package.json
  workspace configuration
  CI configuration

---

# 4. CURRENTLY IMPLEMENTED AREAS

The repository already contains implementation for:

- Home/dashboard
- Account/profile
- Projects
- Project submission
- Project moderation
- Raffles
- Raffle detail
- Raffle winners
- Alpha
- Admin
- Admin alpha moderation
- Community chat
- Wallet/prize addresses
- Discord social connection
- X social connection framework
- Email verification
- Password authentication
- JWT authentication
- PostgreSQL/Prisma schema
- Raffle task verification
- Raffle eligibility
- Winner selection
- Notifications/claim-related database structures
- Rate limiting/moderation structures
- GitHub Actions CI

Do not recreate these systems. Audit and finish them.

---

# 5. FINAL AUTHENTICATION DECISION

At this stage the project MUST NOT depend on paid SMS/WhatsApp OTP services.

## Primary authentication

Use:

1. Email + password
2. Email verification
3. Discord OAuth
4. X OAuth where available/configured
5. Optional Google OAuth can be added later if needed

## Email OTP

Email OTP is allowed because it can be operated using free Gmail/Google Workspace SMTP with an App Password during the free/no-paid-service stage.

Important:
- Keep email OTP rate-limited.
- OTP must expire.
- OTP must be single-use.
- Never log OTP values.
- Never store raw OTPs.
- Store a secure hash/challenge where appropriate.

## SMS

Do NOT implement SMS OTP now.

## WhatsApp

Do NOT implement WhatsApp OTP now.

---

# 6. FREE SERVICE POLICY

Only free options are allowed.

Allowed:

- PostgreSQL locally
- Free PostgreSQL tiers where available
- Gmail SMTP / Gmail App Password for low-volume email
- Discord OAuth
- X OAuth if the required access is available without a paid dependency
- GitHub
- GitHub Actions within free usage limits
- Free/open-source packages
- Local development machine
- Existing self-hosted infrastructure
- Free-tier hosting where currently available

Not allowed at this stage:

- Paid SMS OTP
- Paid WhatsApp OTP
- MSG91
- Twilio
- Vonage
- Paid email providers
- Paid analytics
- Paid captcha providers
- Paid storage unless explicitly approved later
- Any service that requires a subscription to make the MVP work

If a free service has usage limits, document the limit and provide a fallback instead of silently introducing a paid service.

---

# 7. AUTHENTICATION WORK REMAINING

## A. Audit current auth

Verify:

- Register
- Login
- Password hashing
- Email verification
- Email OTP
- OTP expiration
- OTP retry limits
- Account status checks
- JWT creation
- JWT expiration
- Logout/token invalidation strategy
- Protected API routes
- Admin authorization
- CORS
- CSRF considerations
- Rate limiting
- Brute-force protection

## B. Improve auth security

Implement:

- Strong password policy
- Login rate limiting
- OTP request rate limiting
- OTP verification attempt limit
- Generic authentication error messages
- JWT expiration
- Secure token storage strategy
- Production HTTPS requirement
- Admin route protection
- Audit logging for sensitive actions

## C. OAuth

Verify both:

Discord:
- login/connect
- callback
- account linking
- token handling
- production callback URL
- disconnect/reconnect

X:
- OAuth flow
- callback
- token handling
- scopes
- production callback URL
- task verification behavior

If X verification cannot operate under the currently available free access, the feature must degrade gracefully rather than break the entire raffle.

---

# 8. DATABASE COMPLETION

Audit Prisma schema and every migration.

Required:

- No broken relations
- No unnecessary duplicate fields
- Correct indexes
- Correct unique constraints
- Correct cascading behavior
- Correct nullable fields
- Correct enum usage
- Correct timestamps
- No destructive migration in production without backup

Production migration command:

    npx prisma migrate deploy

Never use:

    npx prisma migrate reset

on production.

Add seed/bootstrap functionality for:

- Admin user
- Basic roles
- Default chat channels if required
- Initial system configuration

Seed must be safe and idempotent.

---

# 9. USER SYSTEM

User must be able to:

- Create account
- Login
- Verify email
- Edit profile
- Connect Discord
- Connect X
- Add wallet address
- Select EVM/Solana
- Remove/archive wallet
- View account status
- Logout

Security:

- Never request private keys
- Never request seed phrases
- Validate wallet addresses
- Normalize addresses
- Prevent duplicate wallet ownership where required

---

# 10. PROJECT DISCOVERY

Complete and verify:

- Project listing
- Search
- Filtering
- Project details
- Category
- Status
- Website
- X
- Discord
- Logo
- Description
- Submission
- Moderation
- Approval
- Rejection
- Archive

Public users should only see approved/active content.

Admin/moderator users must see moderation states.

---

# 11. RAFFLE SYSTEM

This is a core feature and must be production-safe.

Required lifecycle:

DRAFT
-> SCHEDULED
-> ACTIVE
-> CLOSED
-> DRAWING
-> COMPLETED

Also support:

CANCELLED

Raffle creation must support:

- Title
- Description
- Prize
- Quantity
- Start time
- End time
- Winner count
- Entry limits
- Entry rules
- Social tasks
- Project association

---

# 12. RAFFLE ENTRY

Before allowing an entry:

1. User authenticated
2. User account active
3. Wallet valid
4. Wallet not duplicated
5. Raffle active
6. Entry limit checked
7. Required tasks checked
8. Captcha/risk system checked if implemented
9. User eligibility calculated server-side
10. Entry saved atomically

Never trust frontend eligibility.

---

# 13. SOCIAL TASK VERIFICATION

Supported task types currently include:

- X follow
- X like
- X repost
- Discord join

Requirements:

- Server-side verification
- Clear verification status
- Retry behavior
- API failure handling
- Rate limiting
- Graceful degradation
- No false positive eligibility

If an external social API is unavailable, the user must receive a clear message.

---

# 14. WINNER SELECTION

Winner selection must be:

- Server-authoritative
- Deterministic/auditable
- Reproducible
- Protected from admin manipulation
- Based only on eligible entries

Store:

- Eligibility snapshot
- Eligible entry count
- Hash/reference of eligible IDs
- Randomness source
- Algorithm version
- Winner indexes/results
- Timestamp

Never select winners from the browser.

Never use Math.random() as the fairness mechanism.

---

# 15. CLAIM/REWARD FLOW

Audit the current claim-related implementation carefully because the database has historical claim/replacement migrations.

Final behavior must be explicitly defined before coding.

If the current product does not require actual on-chain NFT distribution yet:

- Do not pretend a prize was transferred.
- Keep reward status transparent.
- Store claim/reference information only when a real action occurred.

Future blockchain distribution should be a separate module.

---

# 16. ALPHA SYSTEM

Complete:

- Submit alpha
- Evidence links
- Opportunity type
- Project association
- Review queue
- Admin/moderator review
- Approve
- Reject
- Duplicate detection
- Points
- Leaderboard
- Audit log

Prevent users from awarding themselves points.

---

# 17. COMMUNITY CHAT

Complete:

- Channels
- Messages
- Authentication
- Rate limiting
- Moderation
- Hide/remove/flag
- Admin/moderator controls
- Spam protection
- Message length limits
- Basic abuse protection

Do not add expensive real-time infrastructure.

Use a simple polling or lightweight approach if real-time infrastructure is not already required.

---

# 18. ADMIN PANEL

Admin must be able to:

- View users
- Suspend user
- Ban user
- Review projects
- Approve/reject projects
- Review alpha
- Award/deduct points
- Manage raffles
- Cancel raffles
- Review winners
- Moderate chat
- View audit logs

Authorization MUST be server-side.

Hiding an admin button in frontend is not security.

---

# 19. SECURITY AUDIT

Before production:

- Helmet
- CORS restricted to production origin
- HTTPS
- Secure cookies if cookies are used
- JWT security
- Password hashing
- Input validation
- SQL/ORM safety
- XSS protection
- Rate limiting
- Brute-force protection
- Admin authorization
- Secret management
- Error sanitization
- No stack traces in production responses
- No sensitive logging
- No wallet private keys
- No seed phrases
- No secrets in Git

Run dependency audit and remove unnecessary packages.

---

# 20. ENVIRONMENT MANAGEMENT

The repository MUST NOT contain real production `.env`.

Use:

apps/api/.env.example

and document variables.

Production values are created directly on the server.

Expected categories:

NODE_ENV
PORT
WEB_ORIGIN
DATABASE_URL
JWT_SECRET

Discord:
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_REDIRECT_URI

X:
X_CLIENT_ID
X_CLIENT_SECRET
X_REDIRECT_URI

Email:
GMAIL_USER
GMAIL_APP_PASSWORD
EMAIL_FROM_NAME

Frontend:

NEXT_PUBLIC_API_URL

Never expose private secrets through NEXT_PUBLIC_* variables.

---

# 21. CURRENT .ENV ISSUE

A local-style `.env` was committed to the repository.

It currently points to a local PostgreSQL database.

This MUST be corrected:

1. Remove `.env` from Git tracking.
2. Add `.env` to .gitignore.
3. Keep only `.env.example`.
4. If a real secret is ever committed, rotate it immediately.
5. Production `.env` must exist only on the server/deployment environment.

---

# 22. TESTING PLAN

Before production, test:

AUTH:
- register
- login
- wrong password
- email verification
- OTP wrong
- OTP expired
- OTP retry limit
- banned user
- suspended user
- logout

PROJECT:
- submit
- approve
- reject
- public visibility

RAFFLE:
- create
- schedule
- activate
- entry
- duplicate entry
- task failure
- close
- draw
- winner selection
- cancellation

SOCIAL:
- Discord connect
- Discord disconnect
- X connect
- failed OAuth
- expired OAuth

WALLET:
- valid EVM
- invalid EVM
- valid Solana
- invalid Solana
- duplicate wallet

ADMIN:
- user suspension
- ban
- project moderation
- alpha moderation
- raffle management
- chat moderation

SECURITY:
- unauthorized API call
- unauthorized admin API call
- invalid input
- rate limit
- malformed JWT

---

# 23. BUILD VERIFICATION

Every major change must pass:

    npm install
    npx prisma generate
    npm run typecheck
    npm run build
    npm run lint

Also verify:

    GET /api/health

Frontend:

    npm run dev:web

Backend:

    npm run dev:api

---

# 24. PRODUCTION DEPLOYMENT

Preferred architecture for the free stage:

Internet
   |
HTTPS
   |
Nginx
   |
   +---- Next.js web :3000
   |
   +---- Express API :4000
             |
             PostgreSQL

Use a single VPS/server if available.

No Docker is required for the first deployment.

Use PM2 or systemd to keep services alive.

Example process structure:

raven-web
raven-api

Nginx handles:

- HTTPS
- domain
- reverse proxy
- security headers where appropriate

---

# 25. DATABASE HOSTING

Preferred free-stage options:

Option A:
PostgreSQL installed on the same server.

Option B:
A currently available free PostgreSQL provider.

Before selecting an external provider, verify current free-tier limits.

Never design the application so that it depends on a paid database.

---

# 26. BACKUPS

Minimum:

- Daily PostgreSQL backup
- Keep multiple backup copies
- Test restoration
- Backup before production migrations

Example:

pg_dump raven_oracle > backup.sql

Do not store the only backup on the same disk as the live database.

---

# 27. MONITORING

Free-only monitoring:

- Server logs
- PM2 logs or systemd journal
- Nginx logs
- Health endpoint
- Simple uptime check
- GitHub Actions CI

No paid monitoring service required.

Add:

GET /api/health

Response should indicate API availability and optionally database connectivity.

Do not expose secrets or detailed internal errors through health endpoints.

---

# 28. DEPLOYMENT FROM GITHUB

The final workflow should be:

Developer
  |
  v
Local testing
  |
  v
Git commit
  |
  v
GitHub main
  |
  v
Server git pull
  |
  v
npm ci
  |
  v
Prisma generate
  |
  v
Prisma migrate deploy
  |
  v
Build
  |
  v
Restart web/API
  |
  v
Health check

Do not deploy untested changes directly to production.

---

# 29. AI CODING WORKFLOW

Claude/Kiro/VS Code AI MUST follow this order:

STEP 1:
Read this document completely.

STEP 2:
Inspect repository.

STEP 3:
Identify already implemented functionality.

STEP 4:
Do not recreate existing code.

STEP 5:
Create an implementation plan.

STEP 6:
Implement one logical feature at a time.

STEP 7:
Run tests/typecheck/build.

STEP 8:
Fix errors.

STEP 9:
Update documentation/status.

STEP 10:
Commit a clean change.

AI MUST NOT:

- rewrite the entire project
- replace Next.js
- replace Express
- replace Prisma
- replace PostgreSQL
- add paid services
- introduce SMS providers
- expose secrets
- delete migrations
- reset production database
- fabricate completed features

---

# 30. IMPLEMENTATION ORDER FROM CURRENT STATE

This is the exact recommended order.

PHASE 1 — REPOSITORY CLEANUP
- Remove tracked .env
- Fix .gitignore
- Verify .env.example
- Verify package scripts
- Verify README

PHASE 2 — DATABASE
- Audit schema
- Audit migrations
- Verify migration from clean database
- Add safe seed/bootstrap
- Add DB health check

PHASE 3 — AUTH
- Finish email/password
- Finish email verification
- Finish email OTP
- Rate-limit OTP
- Secure JWT
- Finish Discord OAuth
- Audit X OAuth
- Add Google OAuth only if useful

PHASE 4 — USER/ACCOUNT
- Profile
- Social connections
- Wallet validation
- Wallet management
- Account states

PHASE 5 — PROJECTS
- Discovery
- Search/filter
- Submission
- Moderation
- Public visibility

PHASE 6 — RAFFLES
- Creation
- Scheduling
- Entry
- Eligibility
- Tasks
- Closing
- Winner selection
- Auditability

PHASE 7 — ALPHA
- Submission
- Review
- Points
- Leaderboard

PHASE 8 — CHAT
- Channels
- Messaging
- Moderation
- Rate limiting

PHASE 9 — ADMIN
- Complete all moderation tools
- Server-side authorization
- Audit logs

PHASE 10 — SECURITY
- Full security audit
- Dependency audit
- Rate limiting
- Production CORS
- HTTPS
- Secret handling

PHASE 11 — TESTING
- Unit tests
- API tests
- Critical workflow tests
- Security tests
- Production build test

PHASE 12 — DEPLOYMENT
- Server
- PostgreSQL
- Nginx
- SSL
- PM2/systemd
- Environment
- Migration
- Backup
- Health checks

PHASE 13 — FINAL QA
- User flow
- Admin flow
- Raffle flow
- Social flow
- Mobile responsive UI
- Desktop UI
- Error states
- Security
- Performance

PHASE 14 — PRODUCTION
- Final backup
- Deploy
- Smoke test
- Monitor logs
- Verify database
- Verify auth
- Verify raffle lifecycle

---

# 31. DEFINITION OF DONE

Raven Oracle is NOT considered complete merely because:

- npm build passes
- website opens
- API responds

It is complete only when:

[ ] Authentication works
[ ] Email verification works
[ ] OAuth works
[ ] User management works
[ ] Wallet validation works
[ ] Project submission works
[ ] Moderation works
[ ] Raffle lifecycle works
[ ] Eligibility is server-authoritative
[ ] Social tasks work or fail gracefully
[ ] Winner selection is auditable
[ ] Alpha system works
[ ] Chat moderation works
[ ] Admin authorization is secure
[ ] Database migrations work on a clean DB
[ ] Backups work
[ ] Restore has been tested
[ ] Production environment works
[ ] HTTPS works
[ ] Web + API stay online after restart
[ ] No production secrets are in Git
[ ] No paid service is required
[ ] Build/typecheck/lint pass
[ ] Critical user workflows are manually tested

---

# 32. FINAL PRODUCT PRINCIPLE

Raven Oracle should remain:

- lean
- free-first
- self-hostable
- auditable
- secure
- maintainable
- modular
- AI-agent friendly

Paid infrastructure may be introduced only later if the product has real usage and the free architecture is no longer sufficient.

Until then, every feature must have a free/open-source implementation or remain optional.

END OF MASTER DOCUMENTATION


# 33. FUTURE MOBILE APP REQUIREMENT

Raven Oracle MUST be designed so that the current web platform can later be converted into native mobile applications WITHOUT rebuilding the backend.

Future targets:

- Android app
- iOS app

The mobile applications will use the SAME production backend and SAME PostgreSQL database as the web application.

Architecture:

                    ┌──────────────────┐
                    │   Next.js Web     │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   Express API    │
                    │  Single Source   │
                    │    of Truth      │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   PostgreSQL     │
                    └──────────────────┘
                             ▲
                             │
                    ┌────────┴─────────┐
                    │                  │
             Android App          iOS App

The mobile apps MUST NOT connect directly to PostgreSQL.

They MUST communicate through the existing API.

---

# 34. API-FIRST RULE

All important business logic MUST live in the backend.

The frontend and future mobile apps are clients.

Business rules MUST NOT exist only in Next.js.

Examples:

- authentication
- user permissions
- raffle eligibility
- entry limits
- winner selection
- wallet validation
- project moderation
- alpha points
- chat moderation
- admin permissions

These must be enforced by the Express API.

This guarantees that the future mobile app can reuse the exact same functionality.

---

# 35. API CONTRACT REQUIREMENT

Every API endpoint must have:

- HTTP method
- route
- authentication requirement
- request schema
- response schema
- error responses
- authorization rules

Example:

POST /api/raffles/:id/enter

Authentication:
Required

Request:
{
  walletId: string
}

Success:
{
  success: true,
  entryId: string
}

Errors:
401 Unauthorized
403 Not eligible
409 Already entered
422 Invalid wallet

Future mobile apps must consume the same contract.

---

# 36. MOBILE-READY AUTHENTICATION

Authentication must work for:

- Web
- Android
- iOS

Do not create a web-only authentication architecture.

Recommended future architecture:

- Access token
- Refresh token
- Token expiration
- Secure token rotation
- Device/session tracking
- Logout current device
- Logout all devices

Web can use secure HTTP-only cookies where appropriate.

Mobile apps can use secure OS storage:

Android:
- Android Keystore / encrypted secure storage

iOS:
- Keychain

Never store authentication secrets in plain local storage on mobile.

---

# 37. SESSION / DEVICE MANAGEMENT

Future mobile support requires sessions to be represented server-side.

A user may have:

- Web session
- Android session
- iOS session
- Multiple devices

The backend should eventually support:

- List active sessions
- Device name
- Platform
- Last active
- Created date
- Revoke session
- Revoke all sessions

Do not tie a user account permanently to one device.

---

# 38. NOTIFICATION-READY ARCHITECTURE

Do NOT add a paid notification provider now.

But the backend should be structured so notifications can later support:

- Email
- Android push
- iOS push
- In-app notifications

Create a notification abstraction rather than directly embedding one provider throughout business logic.

Example:

NotificationService
  ├── EmailNotificationProvider
  ├── InAppNotificationProvider
  ├── AndroidPushProvider (future)
  └── IOSPushProvider (future)

The MVP may implement only email/in-app notifications.

---

# 39. FILE / MEDIA STORAGE

Do not tightly couple media handling to the web server filesystem.

Future app requirements may include:

- project logos
- project banners
- alpha evidence
- user avatars
- raffle images

Create a storage abstraction:

StorageService
  ├── LocalStorageProvider (development)
  └── S3CompatibleProvider (future)

The application should store file metadata and URLs, not depend on hardcoded local paths.

AWS S3 can be introduced later if required.

---

# 40. DEEP LINK / UNIVERSAL LINK READINESS

Future mobile apps should support links such as:

https://ravenoracle.com/raffles/123

When the app is installed:

- open the raffle in the mobile app

When the app is not installed:

- open the web page

Design URLs so the same resource IDs/routes work across web and mobile.

Do not create mobile-only resource IDs unless required.

---

# 41. MOBILE UI RULE

The current web UI must be responsive.

But responsive web design is NOT considered the mobile app.

When the native app is created:

- reuse API
- reuse business rules
- reuse authentication backend
- reuse database
- reuse image/media URLs
- reuse resource IDs

The mobile UI may be redesigned specifically for touch interaction.

---

# 42. FUTURE MOBILE TECHNOLOGY

No mobile framework is permanently locked at this stage.

Preferred future options:

Option A:
React Native / Expo

Option B:
Flutter

Selection should be made when mobile development begins.

The choice MUST NOT require backend changes.

---

# 43. REAL-TIME FEATURES

Current platform should not depend on expensive real-time infrastructure.

Future mobile support may add:

- chat updates
- notifications
- raffle status changes

Possible future implementation:

- WebSocket
- Server-Sent Events
- lightweight polling

The backend must expose normal REST APIs first.

Real-time functionality is an enhancement, not the foundation of the system.

---

# 44. OFFLINE / MOBILE RESILIENCE

Future mobile apps must handle:

- no internet
- slow internet
- request timeout
- API unavailable
- expired token
- retry
- duplicate request

Critical operations such as raffle entry must be idempotent.

A mobile retry must NOT create duplicate raffle entries.

---

# 45. API VERSIONING

If breaking API changes become necessary after mobile launch, use versioning.

Example:

/api/v1/...

Later:

/api/v2/...

Do not break an existing mobile app by silently changing response formats.

Before mobile launch, versioning may remain optional if the API is still evolving.

---

# 46. MOBILE DEVELOPMENT CHECKLIST

When mobile development starts:

[ ] API contract finalized
[ ] Authentication finalized
[ ] Refresh-token/session system finalized
[ ] User profile API stable
[ ] Project API stable
[ ] Raffle API stable
[ ] Entry API idempotent
[ ] Eligibility API stable
[ ] Winner/claim APIs stable
[ ] Wallet API stable
[ ] Alpha API stable
[ ] Chat API stable
[ ] Notification abstraction ready
[ ] Media URLs stable
[ ] Deep links planned
[ ] Error format standardized
[ ] API versioning strategy decided
[ ] Android app
[ ] iOS app
[ ] App-specific QA
[ ] Production release

---

# 47. FINAL LONG-TERM ARCHITECTURE

The final product should evolve like this:

PHASE 1:
Web MVP
+
Express API
+
PostgreSQL

PHASE 2:
Production hardening
+
AWS deployment
+
Backups
+
Security

PHASE 3:
Stable public API
+
Better authentication/session management
+
Notifications

PHASE 4:
Android App
+
Same API
+
Same database

PHASE 5:
iOS App
+
Same API
+
Same database

PHASE 6:
Optional advanced services
+
Push notifications
+
Real-time features
+
AWS S3/media
+
Blockchain integrations

The mobile applications MUST be clients of the platform, not separate products with separate databases.

---

# 48. AWS + FUTURE APP DEPLOYMENT PRINCIPLE

Production target:

Internet
   |
   +--------------------+
   |                    |
 Web                Mobile Apps
   |                    |
   +---------+----------+
             |
        AWS API
             |
      Express Backend
             |
        PostgreSQL

AWS remains the central backend.

Web, Android and iOS all consume the same APIs.

This prevents:

- duplicate business logic
- duplicate databases
- inconsistent raffle rules
- inconsistent user accounts
- separate wallet systems
- separate admin systems

---

# 49. MASTER RULE FOR FUTURE AI CODING

Any AI coding agent working on Raven Oracle MUST ask:

"Will this implementation still work when Raven Oracle has Android and iOS apps?"

If the answer is NO, redesign the implementation before merging it.

Examples:

BAD:
- Put raffle eligibility only in frontend.
- Store important state only in browser localStorage.
- Make mobile-specific database tables unnecessarily.
- Put business rules only in Next.js.

GOOD:
- API validates eligibility.
- Database is authoritative.
- Frontend and mobile call the same API.
- Authentication is backend-controlled.
- Shared resource IDs.
- Stable API contracts.

---

# 50. FINAL ARCHITECTURAL GUARANTEE

Raven Oracle must be:

WEB-FIRST but NOT WEB-LOCKED.

The current website is the first client.

The API is the platform.

PostgreSQL is the source of persistent data.

Future Android and iOS apps are additional clients.

No future mobile app should require a complete backend rewrite.

END OF FUTURE MOBILE APP SPECIFICATION
