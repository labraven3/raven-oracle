# Authentication System Testing Guide

## Overview
Complete secure authentication system with email verification, admin whitelist, and OAuth support.

---

## Test Scenarios

### 1. USER REGISTRATION & EMAIL VERIFICATION

#### Flow: Register → Verify Email → Login
1. **Register User**
   - Go to `/register`
   - Enter email: `test@example.com`
   - Enter username: `testuser`
   - Enter password: `SecurePass123` (12+ chars, uppercase, lowercase, number)
   - Click "Create Account"
   - ✓ Success page shows "Check Your Email"
   - ✓ User status = PENDING, emailVerifiedAt = null in database

2. **Check Email Verification Link**
   - Look for email from GMAIL_USER with subject "Verify your Raven Oracle email"
   - Email contains verification link: `{WEB_ORIGIN}/verify-email?token={token}&email={email}`
   - Link expires in 30 minutes

3. **Verify Email**
   - Click verification link or go to `/verify-email?token=...&email=...`
   - ✓ Page shows "Email Verified!" after 3 seconds
   - ✓ User status changes to ACTIVE
   - ✓ emailVerifiedAt timestamp is set
   - ✓ Redirects to `/login`

4. **Login with Verified Email**
   - Go to `/login`
   - Enter email: `test@example.com`
   - Enter password: `SecurePass123`
   - Click "Login"
   - ✓ Token stored in localStorage
   - ✓ Redirects to `/dashboard` for regular users
   - ✓ Redirects to `/admin` for ADMIN/MODERATOR users

#### Expected Behavior
- ✓ Unverified user cannot login (403 error with emailVerificationRequired flag)
- ✓ Invalid token shows verification error
- ✓ Expired token (30+ min old) shows verification failed
- ✓ User can request new verification link

---

### 2. LOGIN WITHOUT EMAIL VERIFICATION

#### Flow: Try to login before email verification
1. Register new user
2. Go to `/login` immediately (without clicking verification link)
3. Enter credentials
4. ✓ Returns 403 status
5. ✓ Shows message: "Verify your email before signing in."
6. ✓ Shows "Check Your Email" verification reminder
7. ✓ User can click verification link and retry login

---

### 3. ADMIN LOGIN & WHITELIST

#### Flow: Admin Login → Whitelist Check
1. **Admin User with ADMIN Role (Not Approved)**
   - User has `role = ADMIN` but `isAdminApproved = false`
   - Go to `/admin`
   - ✓ Redirects to `/admin/login` (middleware protection)
   
2. **Admin Login**
   - Go to `/admin/login`
   - Enter admin email and password
   - Click "Login"
   - ✓ Token stored in localStorage
   - ✓ AdminLayout attempts to verify via `/api/admin/overview`

3. **Not Approved Admin Attempts Access**
   - Backend returns 403: "Admin access pending approval"
   - ✓ AdminLayout shows error message
   - ✓ Cannot access admin dashboard
   - ✓ Suggest contacting administrator

4. **Super-Admin Approves User**
   - Super-admin goes to `/admin/whitelist`
   - Searches for pending users
   - Clicks "Approve" for the user
   - ✓ API calls `PATCH /api/admin/whitelist/:id/approve`
   - ✓ Sets `isAdminApproved = true` and `adminApprovedAt` timestamp
   - ✓ Creates audit log entry

5. **Approved Admin Logs In**
   - User logs out and logs back in
   - ✓ Gets new token with approved status
   - ✓ `GET /api/admin/overview` returns 200
   - ✓ AdminLayout shows dashboard
   - ✓ Can access all admin pages

#### Database Verification
```sql
-- Check admin user
SELECT id, email, role, status, isAdminApproved, adminApprovedAt 
FROM "User" 
WHERE email = 'admin@example.com';
-- Expected: role=ADMIN, isAdminApproved=true, adminApprovedAt=timestamp
```

---

### 4. OAUTH: DISCORD CONNECTION

#### Flow: Login via Discord → Verify Email → Complete Profile
1. **Unauthenticated User Connects Discord**
   - Go to `/account`
   - Click "Continue with Discord"
   - ✓ Redirects to Discord OAuth authorization URL
   - Grant permissions (identify, email, guilds)
   - ✓ Discord redirects to `/api/auth/discord/callback`

2. **Discord Account Processing**
   - If Discord email is verified:
     - ✓ Creates new user with `emailVerifiedAt = now()`
     - ✓ Status = ACTIVE
   - If Discord email is not verified:
     - ✓ Creates user with `emailVerifiedAt = null`
     - ✓ Status = PENDING
     - Shows "Discord connected. Add your Gmail below"

3. **Email Verification (if needed)**
   - Shows email input field
   - User enters email: `user@gmail.com`
   - Clicks "Send OTP"
   - ✓ Receives 6-digit code via email
   - Enters OTP
   - ✓ User status changes to ACTIVE
   - ✓ Email verified and marked as primary contact

4. **Complete Profile**
   - Click "Edit Profile"
   - Set username: `dcuser`
   - Set display name: `Discord User`
   - Click "Save Changes"
   - ✓ Profile updates saved
   - ✓ Ready to participate in raffles

#### Database Verification
```sql
-- Check Discord social account
SELECT * FROM "SocialAccount" 
WHERE provider = 'DISCORD' AND userId = '{user_id}';
-- Expected: providerUsername set, isActive=true, connectedAt=timestamp
```

---

### 5. OAUTH: X (TWITTER) CONNECTION

#### Flow: Login via X → Add Email → Use Account
1. **Authenticated User Connects X**
   - User logged in (has token)
   - Go to `/account`
   - Click "Connect X"
   - ✓ Redirects to X OAuth authorization URL
   - Grant permissions (users.read, tweet.read, follows.read, like.read, offline.access)
   - ✓ X redirects to `/api/auth/x/callback`

2. **X Account Connected**
   - ✓ Creates SocialAccount record
   - ✓ Sets providerUsername (X handle)
   - ✓ Stores encrypted access token and refresh token
   - Shows "X connected successfully"

3. **Email Requirements**
   - X doesn't provide email, so user must add one
   - User can add/verify email via OTP challenge
   - ✓ Email verification works same as Discord flow

#### Database Verification
```sql
-- Check X social account
SELECT * FROM "SocialAccount" 
WHERE provider = 'X' AND userId = '{user_id}';
-- Expected: providerUsername set, accessTokenEncrypted not null
```

---

### 6. PASSWORD VALIDATION

#### Test Invalid Passwords
1. **Too Short**
   - Password: `Short1`
   - ✓ Error: "Password must be at least 12 characters long"

2. **No Uppercase**
   - Password: `lowercase1234`
   - ✓ Error: "Password must contain at least one uppercase letter"

3. **No Lowercase**
   - Password: `UPPERCASE1234`
   - ✓ Error: "Password must contain at least one lowercase letter"

4. **No Number**
   - Password: `NoNumberHere`
   - ✓ Error: "Password must contain at least one number"

5. **Valid Password**
   - Password: `ValidPass123`
   - ✓ Accepted and hashed with scrypt (16-byte salt)

---

### 7. RATE LIMITING

#### Login Rate Limit (5 attempts per 15 minutes)
1. Attempt invalid login 5 times
2. 6th attempt returns 429
3. ✓ Error: "Too many login attempts. Please try again later."
4. Wait 15 minutes or use different IP
5. ✓ Can login again

#### Registration Rate Limit (3 per hour)
1. Register 3 new accounts
2. 4th registration in same hour returns 429
3. ✓ Error: "Too many registration attempts. Please try again later."

#### OTP Request Rate Limit (3 per 15 minutes per user)
1. Request OTP 3 times
2. 4th request returns 429
3. ✓ Rate limited by authenticated user ID

---

### 8. AUDIT LOGGING

#### Check Audit Logs
```sql
-- View auth events
SELECT * FROM "AuthAuditLog" 
WHERE userId = '{user_id}' 
ORDER BY createdAt DESC 
LIMIT 20;

-- Expected events:
-- - REGISTER_SUCCESS
-- - EMAIL_VERIFICATION_SUCCESS
-- - LOGIN_SUCCESS
-- - OAUTH_LOGIN_SUCCESS
-- - LOGOUT
```

#### Admin Actions
```sql
-- Check admin whitelist changes
SELECT * FROM "AuditLog" 
WHERE action IN ('ADMIN_ACTION')
AND metadata->>'action' IN ('whitelist_approve', 'whitelist_reject')
ORDER BY createdAt DESC;
```

---

### 9. SECURITY CHECKS

#### Token Security
- ✓ JWT tokens signed with HS256
- ✓ 7-day expiration
- ✓ Tokens stored in localStorage (frontend)
- ✓ Can be sent as Bearer header or raven_token cookie
- ✓ Invalid/expired tokens return 401

#### Email Verification Token Security
- ✓ Uses HMAC-SHA256 signatures
- ✓ 30-minute expiration
- ✓ Contains nonce to prevent replay
- ✓ Timing-safe comparison (timingSafeEqual)

#### Password Security
- ✓ Never stored in plaintext
- ✓ Hashed with scrypt (CPU-intensive KDF)
- ✓ 16-byte random salt per password
- ✓ Timing-safe comparison during verification

#### OAuth State Security
- ✓ State encrypted with AES-256-GCM
- ✓ Contains timestamp and nonce
- ✓ Validated within 10 minutes
- ✓ Prevents CSRF attacks

#### CORS & Domain Validation
- ✓ WEB_ORIGIN environment variable controls redirect domains
- ✓ OAuth callbacks redirect only to WEB_ORIGIN
- ✓ API validates origin headers

---

## Deployment Testing

### Before Production Deployment

1. **Environment Variables Set**
   ```bash
   # Backend (.env or apps/api/.env)
   GMAIL_USER=your-gmail@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx  # 16-char Google App Password
   DISCORD_CLIENT_ID=your_discord_client_id
   DISCORD_CLIENT_SECRET=your_discord_secret
   DISCORD_REDIRECT_URI=https://yourdomain.com/api/auth/discord/callback
   X_CLIENT_ID=your_x_client_id
   X_CLIENT_SECRET=your_x_secret
   JWT_SECRET=long-random-string-32-chars-min
   WEB_ORIGIN=https://yourdomain.com
   
   # Frontend (.env.local or apps/web/.env.local)
   NEXT_PUBLIC_API_BASE_URL=https://yourdomain.com/api
   ```

2. **Database Migration Applied**
   ```bash
   npm run db:migrate
   # OR
   npx prisma migrate deploy
   ```

3. **Email Service Test**
   - Send test email via `/api/email/verify`
   - Check for email in inbox/spam
   - Verify link format and expiration

4. **OAuth Credentials Verified**
   - Discord: Test with authorized Discord account
   - X: Test with authorized X account
   - Verify redirect URIs match exactly

5. **Admin Whitelist Verified**
   - Create super-admin user with ADMIN role
   - Set `isAdminApproved = true` manually in database
   - Test admin panel access

---

## Troubleshooting

### Email Not Received
- Check GMAIL_USER and GMAIL_APP_PASSWORD are correct
- Verify Google App Password (not regular password)
- Check spam/promotions folder
- Test with `curl` to Gmail SMTP directly
- Check server logs for SMTP errors

### Admin Cannot Access Panel
- Verify user has ADMIN or MODERATOR role
- Check `isAdminApproved = true` in database
- Verify JWT_SECRET matches between server and client
- Check token hasn't expired (7 days)
- Check user.status is not BANNED or DELETED

### OAuth Redirect Loop
- Verify redirect URIs match exactly (including trailing slash)
- Check WEB_ORIGIN is set correctly
- Verify OAuth app credentials are correct
- Check browser cookies are enabled
- Clear cookies and try again

### Email Verification Token Expired
- Link valid for 30 minutes from registration
- User can request new verification from account page
- Or register again with same email

---

## Success Criteria

All tests should pass for secure authentication system to be production-ready:

- [ ] User registration and email verification works
- [ ] Login blocked for unverified email
- [ ] Admin login works with whitelist check
- [ ] OAuth connections work (Discord and X)
- [ ] Profile editing works after OAuth
- [ ] Admin whitelist management works
- [ ] Rate limiting prevents abuse
- [ ] Audit logs track all auth events
- [ ] Tokens expire properly
- [ ] Security headers and validation in place
- [ ] Email delivery confirmed working
- [ ] All environment variables set correctly

---

## Manual Testing Checklist

### User Journey: Email Registration
- [ ] Go to `/register`
- [ ] Create account with valid credentials
- [ ] Receive verification email
- [ ] Click verification link
- [ ] Email verified successfully
- [ ] Login with credentials
- [ ] Access user dashboard

### User Journey: OAuth + Email
- [ ] Go to `/account`
- [ ] Click "Continue with Discord"
- [ ] Authorize Discord
- [ ] Add email and verify via OTP
- [ ] Profile created successfully
- [ ] Can access platform features

### Admin Journey: Approval
- [ ] Create ADMIN role user
- [ ] Try to access `/admin` (should fail)
- [ ] Super-admin approves via `/admin/whitelist`
- [ ] Admin user logs in
- [ ] Can now access admin panel
- [ ] Can manage users, raffles, alpha submissions

### Security: Invalid Attempts
- [ ] Login with wrong password (5x) → rate limited
- [ ] Verify with invalid token → error
- [ ] Try to register 3x within 1 hour → rate limited
- [ ] Inspect JWT token → can't decode secrets
- [ ] Check email tokens → properly encrypted

