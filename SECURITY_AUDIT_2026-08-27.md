# Raven Oracle — Production Bug & Security Audit

Date: 2026-08-27

## Scope

Reviewed the production API architecture, authentication middleware, raffle lifecycle, raffle entry flow, task verification, winner selection/export, OAuth handling, CORS/security headers, and rate-limiting code.

## Confirmed fixes applied

### 1. Raffle mutations now require active accounts
Raffle writes and verification actions are gated behind authenticated, active accounts. Pending, suspended, banned, and deleted accounts cannot use raffle mutation endpoints.

### 2. API write rate limiting
The API now applies a write limiter to mutation endpoints. Authentication/OAuth endpoints receive an additional tighter limiter to reduce brute-force and abuse attempts.

### 3. Production security headers
Helmet remains enabled, production HSTS is explicit, and the API referrer policy is tightened.

### 4. CORS error handling
Rejected CORS origins now receive a generic error message instead of reflecting the supplied origin in the error text.

### 5. Existing authorization checks retained
Raffle creator ownership checks, winner-export ownership checks, wallet ownership checks, and raffle/task ownership checks remain in place. The new security layer does not replace these checks.

### 6. FCFS draw lifecycle consistency
The creator draw endpoint now uses the same server-side FCFS finalization path as automatic eligibility handling. FCFS raffles can finalize once the required eligible spots are filled, while normal random raffles still require the raffle to be closed and past its end time.

FCFS automatic finalization also refuses to close a raffle while any entry remains pending eligibility evaluation. This prevents a partial evaluation state from being moved into `DRAWING` and failing mid-flow.

### 7. Winner export UX
Winner export remains creator-only and completion-only. The Winner Center now clearly describes a direct XLSX download containing X username, Discord username, and the full payout wallet address. No Google account connection is required.

## Important product/security observations

### Raffle randomness
The current raffle draw uses Node.js cryptographic randomness and stores a hash/snapshot for auditability. This is **not the same as on-chain or oracle-verifiable randomness**. The UI/documentation must not claim Chainlink VRF, on-chain randomness, or decentralized verification until that functionality is actually implemented.

### Task verification
X follow is verified through the X API. Other currently supported task types intentionally use participant confirmation. They must continue to be described as confirmation-based rather than API-verified.

### Wallet integrity
The database has uniqueness constraints for one user per raffle and one wallet per raffle. The wallet-submission endpoint also prevents changing a wallet after submission. These controls should remain server-side and must never depend only on the disabled state of a frontend button.

### Winner export
Winner export is restricted to the raffle creator and only available after completion. It exports X username, Discord username, and payout wallet as text-friendly spreadsheet data.

## Final manual QA checklist before launch

- Create a raffle as creator.
- Add every supported task type.
- Enter as a second account.
- Verify X follow with a real connected X account.
- Confirm non-X tasks.
- Submit a payout wallet.
- Refresh/reopen the entry page and confirm the wallet cannot be replaced.
- Attempt duplicate entry from the same account.
- Attempt duplicate entry using the same wallet.
- Attempt entry after the raffle ends.
- Attempt task verification after the raffle ends.
- Close the raffle and evaluate entries.
- Draw winners twice and confirm the second draw is rejected.
- Test FCFS with fewer eligible spots, exactly the winner count, and extra pending entries.
- Export winners and verify spreadsheet columns and full wallet addresses.
- Try winner export from a non-host account.
- Try creator-only endpoints from another authenticated account.
- Test suspended/banned/pending accounts.
- Test mobile navigation and disconnected OAuth states.
- Verify production domain, HTTPS, OAuth callback URLs, and CORS origins.

## Launch rule

Do not advertise the platform as audited, decentralized, fully on-chain, or oracle-randomized unless the corresponding implementation exists and has been independently validated.
