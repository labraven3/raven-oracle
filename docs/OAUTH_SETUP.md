# OAuth Setup Guide

## Discord OAuth

### Setup Steps

1. **Create Discord Application**
   - Go to https://discord.com/developers/applications
   - Click "New Application"
   - Name it "Raven Oracle"
   - Go to OAuth2 → General
   - Copy Client ID and Client Secret

2. **Configure Redirect URI**
   - In OAuth2 → Redirects
   - Add: `https://yourdomain.com/api/auth/discord/callback`
   - Save changes

3. **Set Environment Variables**
   ```bash
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_CLIENT_SECRET=your_client_secret_here
   DISCORD_REDIRECT_URI=https://yourdomain.com/api/auth/discord/callback
   ```

4. **Scopes Requested**
   - `identify` - Read user profile
   - `email` - Read user email
   - `guilds` - Read joined servers

### Discord User Data Retrieved
```typescript
{
  id: "discord_user_id",
  username: "discord_username",
  global_name: "Display Name",
  email: "user@example.com",    // Only if verified
  verified: true,               // Email verification status
  avatar: "avatar_hash"         // Avatar image hash
}
```

### Flow
1. User clicks "Continue with Discord"
2. Redirected to Discord authorization URL
3. User grants permissions
4. Discord redirects to callback with code
5. Backend exchanges code for access token
6. Backend fetches user profile
7. Creates or updates Raven Oracle user
8. If Discord email is verified, auto-marks email as verified
9. Token returned in Set-Cookie header
10. Redirect to `/account` with status

### Endpoints
- **Start**: `GET /api/auth/discord/start`
  - Returns Discord OAuth authorization URL
  - Can be called by authenticated or unauthenticated users

- **Callback**: `GET /api/auth/discord/callback?code=...&state=...`
  - Handles Discord redirect
  - Returns redirect to `{WEB_ORIGIN}/account#token=...&status=...`

---

## X (Twitter) OAuth

### Setup Steps

1. **Create X App**
   - Go to https://developer.twitter.com/en/portal/dashboard
   - Create new project and app
   - Name: "Raven Oracle"
   - App type: Web App (public)

2. **Configure Redirect URI**
   - In App Settings → Authentication Settings
   - Enable "OAuth 2.0 authorization code with PKCE"
   - Add Callback URL: `https://yourdomain.com/api/auth/x/callback`
   - Configure Website URL (your main domain)
   - Accept terms

3. **Get Credentials**
   - Go to Keys and tokens
   - Copy Client ID and Client Secret

4. **Set Environment Variables**
   ```bash
   X_CLIENT_ID=your_client_id_here
   X_CLIENT_SECRET=your_client_secret_here
   ```

5. **Configure Scopes**
   - Ensure these are enabled in app settings:
     - `users.read` - Read user profile
     - `tweet.read` - Read tweets
     - `follows.read` - Read follows
     - `like.read` - Read likes
     - `offline.access` - Offline access

### X User Data Retrieved
```typescript
{
  id: "x_user_id",
  username: "x_username",      // Twitter handle without @
  name: "Display Name",
  verified: true,              // Blue checkmark status
  profile_image_url: "https://...", // Profile picture
  // Note: X OAuth2 does NOT provide email
}
```

### Flow
1. User must be authenticated (have login token)
2. User clicks "Connect X"
3. Redirected to X authorization URL (PKCE flow)
4. User grants permissions
5. X redirects to callback with code
6. Backend exchanges code for access token
7. Backend fetches user profile
8. Creates SocialAccount record
9. Stores encrypted access and refresh tokens
10. User must add email separately via OTP
11. Redirect to `/` with status

### Endpoints
- **Start**: `GET /api/auth/x/start`
  - Requires authentication (requireAuth middleware)
  - Returns X OAuth authorization URL
  - Only authenticated users can connect X

- **Callback**: `GET /api/auth/x/callback?code=...&state=...`
  - Handles X redirect
  - Returns redirect to `{WEB_ORIGIN}/?status=connected`

---

## Email Configuration (Gmail SMTP)

### Setup Steps

1. **Create Gmail App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select Mail and Windows PC (or Custom App)
   - Generate 16-character password
   - Copy the password (with spaces)

2. **Set Environment Variables**
   ```bash
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   EMAIL_FROM_NAME="Raven Oracle"
   ```

3. **Enable Less Secure App Access (if needed)**
   - Go to https://myaccount.google.com/lesssecureapps
   - Enable "Less secure app access" if App Passwords option isn't available

### Emails Sent
1. **Email Verification**
   - Subject: "Verify your Raven Oracle email"
   - Contains verification link with 30-min expiration
   - Sent on registration or email change

2. **OTP Code**
   - Subject: "Your Raven Oracle verification code"
   - Contains 6-digit code with 10-min expiration
   - Sent when user adds email after OAuth

3. **Winner Notification**
   - Subject: "You won: {raffle_title}"
   - Contains winner claim link
   - Sent when user is selected in raffle

### SMTP Configuration
```typescript
// Using Gmail SMTP on port 465 (TLS)
host: "smtp.gmail.com"
port: 465
secure: true (TLS)
auth:
  user: GMAIL_USER
  pass: GMAIL_APP_PASSWORD (16-char App Password)
```

---

## JWT Token Configuration

### Token Structure
```typescript
// Header
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload
{
  "userId": "uuid",
  "iat": 1693459200,
  "exp": 1694064000  // 7 days later
}

// Signature
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  JWT_SECRET
)
```

### Environment Variable
```bash
JWT_SECRET=your-long-random-secret-32-chars-minimum
```

### Token Usage
- **Frontend**: Store in localStorage
- **Requests**: Send in `Authorization: Bearer {token}` header
- **Cookies**: Automatically sent as HTTP-only cookie from OAuth callbacks
- **Expiration**: 7 days, then user must login again

---

## Environment Variables Checklist

### Required for Full Authentication
```bash
# Email
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_FROM_NAME="Raven Oracle"

# Discord OAuth
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=https://yourdomain.com/api/auth/discord/callback

# X OAuth
X_CLIENT_ID=...
X_CLIENT_SECRET=...

# JWT & Security
JWT_SECRET=long-random-string-min-32-chars

# Domain Configuration
WEB_ORIGIN=https://yourdomain.com
NEXT_PUBLIC_API_BASE_URL=https://yourdomain.com/api

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Node Environment
NODE_ENV=production
```

### Optional
```bash
# Admin email for initial setup
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=initial-secure-password

# CORS Origins (if needed)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

---

## Testing OAuth Locally

### Discord Testing
1. Create Discord server for testing
2. Create Discord app with `http://localhost:3001/api/auth/discord/callback` as redirect
3. Use test Discord account
4. Verify redirect works to `http://localhost:3000/account`

### X Testing
1. Create X Developer Account
2. Create OAuth app with `http://localhost:3001/api/auth/x/callback` as redirect
3. Use test X account with sufficient permissions
4. Verify token exchange works

### Email Testing (Gmail)
1. Use test Gmail account or service like Mailtrap
2. Verify SMTP connection with telnet:
   ```bash
   openssl s_client -connect smtp.gmail.com:465
   ```
3. Test email send via `/api/auth/register` endpoint

---

## Troubleshooting OAuth

### Discord Redirect Loop
**Issue**: OAuth keeps redirecting back to authorization URL
- Check DISCORD_REDIRECT_URI matches exactly in Discord Developer Portal
- Verify callback URL matches: `https://yourdomain.com/api/auth/discord/callback`
- Clear browser cookies
- Try incognito/private window

### X "Invalid Request"
**Issue**: X returns error during authorization
- Verify X_CLIENT_ID and X_CLIENT_SECRET are correct
- Check callback URL matches in X Developer Portal
- Verify scopes are enabled in app settings
- Ensure app is in Development environment (not restricted)

### Email Not Arriving
**Issue**: Verification emails not received
- Check GMAIL_USER and GMAIL_APP_PASSWORD
- Verify Google App Password (16 chars with spaces)
- Check Gmail account hasn't been locked
- Look in spam/promotions folder
- Check server logs for SMTP errors

### Token Not Being Set
**Issue**: After OAuth callback, no token in localStorage
- Check callback URL includes `token=...` parameter
- Verify frontend correctly extracts token from URL hash
- Check localStorage isn't disabled in browser
- Verify WEB_ORIGIN matches redirect domain

---

## Security Best Practices

✓ **Do**
- Store GMAIL_APP_PASSWORD securely (use environment variables)
- Use strong JWT_SECRET (32+ random characters)
- Rotate secrets quarterly
- Use HTTPS for all OAuth redirects
- Enable email verification for OAuth users
- Log all OAuth login attempts
- Use rate limiting on auth endpoints

✗ **Don't**
- Don't commit secrets to git
- Don't use weak JWT secrets
- Don't allow HTTP callbacks
- Don't skip email verification
- Don't store plain text passwords
- Don't log sensitive data (passwords, tokens)
- Don't use same JWT_SECRET across environments

