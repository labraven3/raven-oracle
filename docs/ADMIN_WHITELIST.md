# Admin Whitelist Management Guide

## Overview

The admin whitelist system provides a two-tier access control for admin users:

1. **Role-Based**: User has `ADMIN` or `MODERATOR` role in database
2. **Approval-Based**: User has `isAdminApproved = true` set by super-admin

Both conditions must be met for access to admin panel.

---

## Database Schema

### User Model Fields
```typescript
// Role assignment (from user registration or OAuth)
role: UserRole  // USER, MODERATOR, ADMIN

// Email verification status
emailVerifiedAt: DateTime | null

// Admin whitelist fields
isAdminApproved: Boolean  // Default: false
adminApprovedAt: DateTime | null  // When approved
```

### Indexes
```sql
-- Query pending admins efficiently
CREATE INDEX "User_isAdminApproved_idx" ON "User"("isAdminApproved");

-- Query by status
CREATE INDEX "User_status_idx" ON "User"("status");

-- Query by role
CREATE INDEX "User_role_idx" ON "User"("role");
```

---

## Initial Setup

### Create Super-Admin

1. **Option A: Via Database**
   ```sql
   INSERT INTO "User" (
     id, 
     email, 
     username, 
     displayName,
     passwordHash,
     role,
     status,
     isAdminApproved,
     adminApprovedAt,
     emailVerifiedAt,
     createdAt,
     updatedAt
   ) VALUES (
     gen_random_uuid(),
     'admin@yourdomain.com',
     'admin',
     'Admin User',
     'scrypt$salt$hash',  -- Hash using Node.js crypto
     'ADMIN',
     'ACTIVE',
     true,  -- Pre-approved
     NOW(),
     NOW(),
     NOW(),
     NOW()
   );
   ```

2. **Option B: Via API + Manual Approval**
   - Admin registers via `/register`
   - Backend assigns ADMIN role (if configured)
   - Super-admin approves via `/admin/whitelist/:id/approve`

### Generate Password Hash
```typescript
// Node.js script to generate hash
import { randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

const hash = await hashPassword('YourSecurePassword123');
console.log(hash);
```

---

## Admin Whitelist Endpoints

### GET /api/admin/whitelist
**List users pending or approved for admin access**

Query Parameters:
- `filter` (optional): `pending` (default) or `approved`

Response:
```json
{
  "success": true,
  "users": [
    {
      "id": "user-uuid",
      "email": "moderator@example.com",
      "username": "mod1",
      "displayName": "Moderator One",
      "role": "MODERATOR",
      "status": "ACTIVE",
      "isAdminApproved": false,
      "adminApprovedAt": null,
      "emailVerifiedAt": "2024-08-19T12:00:00Z",
      "createdAt": "2024-08-18T10:00:00Z",
      "_count": {
        "raffleEntries": 5,
        "alphaSubmissions": 2
      }
    }
  ],
  "filter": "pending",
  "count": 1
}
```

Example:
```bash
# Get pending admin approvals
curl -H "Authorization: Bearer {token}" \
  "https://api.yourdomain.com/admin/whitelist?filter=pending"

# Get approved admins
curl -H "Authorization: Bearer {token}" \
  "https://api.yourdomain.com/admin/whitelist?filter=approved"
```

---

### PATCH /api/admin/whitelist/:id/approve
**Approve a user for admin access**

Body: None required

Response:
```json
{
  "success": true,
  "message": "User approved for admin access",
  "user": {
    "id": "user-uuid",
    "email": "moderator@example.com",
    "username": "mod1",
    "displayName": "Moderator One",
    "role": "MODERATOR",
    "isAdminApproved": true,
    "adminApprovedAt": "2024-08-19T15:30:00Z",
    "createdAt": "2024-08-18T10:00:00Z"
  }
}
```

Actions:
1. Verifies user exists and has ADMIN/MODERATOR role
2. Sets `isAdminApproved = true`
3. Records `adminApprovedAt` timestamp
4. Creates audit log entry with action `ADMIN_ACTION`

Example:
```bash
curl -X PATCH \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  "https://api.yourdomain.com/admin/whitelist/{user-id}/approve"
```

---

### PATCH /api/admin/whitelist/:id/reject
**Reject or revoke admin approval**

Body:
```json
{
  "reason": "Does not meet approval criteria"  // Optional
}
```

Response:
```json
{
  "success": true,
  "message": "Admin access revoked",
  "user": {
    "id": "user-uuid",
    "email": "moderator@example.com",
    "username": "mod1",
    "displayName": "Moderator One",
    "role": "MODERATOR",
    "isAdminApproved": false,
    "adminApprovedAt": null
  }
}
```

Actions:
1. If already approved: Revokes access by setting `isAdminApproved = false`
2. If not approved: Logs rejection for audit trail
3. Creates audit log entry with reason (if provided)
4. Sets metadata: `{ action: "whitelist_reject", reason: "..." }`

Example:
```bash
curl -X PATCH \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Insufficient security clearance"}' \
  "https://api.yourdomain.com/admin/whitelist/{user-id}/reject"
```

---

## Admin Access Flow

### Approval Process

```
┌─────────────────────┐
│  User Created       │
│ role=ADMIN          │
│ isAdminApproved=NO  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│ User tries /admin/login          │
│ Can login but cannot access      │
│ dashboard (403 error)            │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Super-admin reviews user in      │
│ /admin/whitelist                 │
│ Checks credentials & permissions │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Super-admin clicks APPROVE       │
│ PATCH /admin/whitelist/:id/...   │
│ isAdminApproved = true           │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ User logs in again               │
│ Gets new token                   │
│ Can access all admin features    │
└─────────────────────────────────┘
```

---

## Access Control Logic

### Backend Middleware (requireAdmin)
```typescript
// In admin.ts routes
async function requireAdmin(req, res, next) {
  // 1. Check authentication
  if (!req.userId) return 403 "Authentication required"
  
  // 2. Fetch user from database
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role, status, isAdminApproved }
  })
  
  // 3. Check role
  if (!["ADMIN", "MODERATOR"].includes(user.role))
    return 403 "Admin access required"
  
  // 4. Check not banned
  if (user.status === "BANNED")
    return 403 "Access denied"
  
  // 5. Check approved
  if (!user.isAdminApproved)
    return 403 "Admin access pending approval"
  
  // Success
  next()
}
```

### Frontend Protection (AdminLayout.tsx)
```typescript
// Verify access on component mount
useEffect(() => {
  const verify = async () => {
    const response = await fetch('/admin/overview', {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (!response.ok) {
      // Backend rejected - show error
      setIsAuthorized(false)
      router.push('/admin/login')
    }
  }
  
  verify()
}, [])
```

---

## Whitelist Management Page

### UI Components (To Build)

**Pending Approvals Tab**
- Table of users with ADMIN/MODERATOR role but `isAdminApproved=false`
- Columns: Email, Username, Role, Status, Created, Actions
- Action buttons: Approve, Reject (with reason modal)
- Search/filter by email or username

**Approved Admins Tab**
- Table of users with `isAdminApproved=true`
- Columns: Email, Username, Role, Status, Approved Date, Actions
- Action buttons: Revoke (with confirmation)
- Shows when each admin was approved

**Approval History**
- Audit log showing all whitelist changes
- Filter by action (approve/reject/revoke)
- Shows actor (who made change) and reason

---

## Audit Logging

### Whitelist Events
```sql
-- View whitelist approval history
SELECT 
  actor.email as approved_by,
  action,
  summary,
  metadata,
  "createdAt"
FROM "AuditLog"
WHERE 
  action = 'ADMIN_ACTION'
  AND metadata->>'action' IN ('whitelist_approve', 'whitelist_reject')
ORDER BY "createdAt" DESC;

-- Example query result:
-- admin@example.com | ADMIN_ACTION | Approved admin whitelist for mod@example.com | {} | 2024-08-19 15:30
-- admin@example.com | ADMIN_ACTION | Rejected admin whitelist for user@example.com | {"reason":"..."}
```

### Stored Metadata
```json
// Approval
{ "action": "whitelist_approve" }

// Rejection
{ "action": "whitelist_reject", "reason": "Optional reason text" }
```

---

## Security Considerations

### Multi-Tier Approval
✓ Role-based access (ADMIN/MODERATOR assigned by system)
✓ Approval-based access (whitelist check by super-admin)
✓ Email verification required
✓ Cannot approve yourself (enforced by audit trail)

### Audit Trail
✓ All approvals logged with timestamp
✓ Actor (who approved) recorded
✓ Reason for rejection recorded
✓ Immutable audit log (append-only)

### Rate Limiting
✓ Admin routes subject to standard rate limits
✓ Prevent brute force token attacks
✓ Prevent bulk user manipulation

### Status Checks
✓ Reject if user status is BANNED
✓ Reject if user status is DELETED
✓ Reject if user status is SUSPENDED
✓ Only ACTIVE users can be admins

---

## Troubleshooting

### Admin Can't Access Dashboard
```
Possible causes:
1. isAdminApproved is false
   → Super-admin needs to approve via /api/admin/whitelist/:id/approve
   
2. role is not ADMIN/MODERATOR
   → Change role in database manually or re-register with admin flag
   
3. status is BANNED or SUSPENDED
   → Unsuspend user via /api/admin/users/:id/status
   
4. Token expired
   → User must login again to get new token (7 day expiration)
   
5. emailVerifiedAt is null
   → User must verify email before accessing any protected feature
```

### Whitelist Endpoint Returns 403
```
Verify:
1. Request has Authorization header with Bearer token
2. Token belongs to authenticated user
3. User making request has ADMIN role
4. User making request has isAdminApproved = true
5. Token hasn't expired (7 day limit)
```

### Audit Log Not Showing Approvals
```
Check:
1. Action is 'ADMIN_ACTION' not 'ADMIN_WHITELIST'
2. metadata contains 'action' key ('whitelist_approve' or 'whitelist_reject')
3. Query includes correct date range
4. User has permission to view audit logs
```

---

## Best Practices

### When Approving Admins
1. ✓ Verify user's identity out-of-band (Slack, Discord, etc.)
2. ✓ Check employment/team status
3. ✓ Confirm email is verified and controlled by user
4. ✓ Record reason for approval in audit log
5. ✓ Notify user they've been approved

### When Revoking Access
1. ✓ Document reason for revocation
2. ✓ Notify user via email
3. ✓ Record in audit log
4. ✓ Verify user has no ongoing admin tasks
5. ✓ Log any special circumstances

### Monitoring Admins
1. ✓ Review admin activity logs monthly
2. ✓ Audit whitelist changes quarterly
3. ✓ Check for dormant admin accounts
4. ✓ Remove approvals for inactive staff
5. ✓ Rotate super-admin passwords regularly

