# Google Winner Export

## Current architecture

Raven Oracle supports two Google credential paths:

1. Creator-owned Google OAuth — primary path for winner exports.
2. Google service account — legacy fallback retained for compatibility, but not the preferred production path for personal Google accounts.

## Creator OAuth flow

Creator opens a raffle winners page and connects Google Drive.

Frontend:
- `GET /api/auth/google/connect?returnTo=...`
- `GET /api/auth/google/status`
- `POST /api/auth/google/disconnect`

Backend:
- OAuth state is signed with `JWT_SECRET` and expires after 10 minutes.
- Refresh tokens are encrypted with AES-256-GCM before storage.
- Connection records live in `GoogleOAuthConnection`.
- Google access tokens are refreshed server-side when needed.

Winner export:
- `POST /api/raffles/:raffleId/winners/export/google-sheets`
- Only the raffle creator can export.
- The sheet is created in the connected creator's Google Drive.
- The export includes winner rank, social handles, wallet, email, verification state, winner status and notification status.

## Required environment

`GOOGLE_OAUTH_CLIENT_ID`
`GOOGLE_OAUTH_CLIENT_SECRET`
`GOOGLE_OAUTH_REDIRECT_URI`

The redirect URI must exactly match the Google Cloud OAuth web application configuration.

## Admin visibility

`GET /api/admin/google-integrations` provides connection counts and non-secret creator connection metadata. Tokens are never exposed through the admin API or UI.

## Safety rules

- Never commit OAuth client secrets, refresh tokens or service-account JSON.
- Do not expose refresh/access tokens to the frontend.
- Approved raffle winner selection logic is unchanged by Google export.
- CSV export remains available independently of Google connection.
