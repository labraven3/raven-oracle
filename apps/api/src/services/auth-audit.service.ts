import type { Request } from "express";

/**
 * Authentication audit hooks.
 *
 * Kept intentionally independent from Prisma so authentication remains
 * compatible with the current database schema/client. These hooks are
 * fire-and-forget and never affect the authentication flow.
 */

interface AuthAuditParams {
  userId?: string;
  event: string;
  success: boolean;
  provider?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function logAuthEvent(_params: AuthAuditParams): Promise<void> {
  // Audit persistence can be added once the production audit table is part
  // of the canonical Prisma schema. Never block authentication on logging.
}

export function logLoginSuccess(userId: string, req: Request): Promise<void> {
  return logAuthEvent({ userId, event: "LOGIN_SUCCESS", success: true, provider: "EMAIL", req });
}

export function logLoginFailed(email: string | undefined, reason: string, req: Request): Promise<void> {
  return logAuthEvent({ event: "LOGIN_FAILED", success: false, provider: "EMAIL", reason, metadata: email ? { email } : undefined, req });
}

export function logRegistration(userId: string, req: Request): Promise<void> {
  return logAuthEvent({ userId, event: "REGISTER_SUCCESS", success: true, provider: "EMAIL", req });
}

export function logEmailVerificationSuccess(userId: string, req: Request): Promise<void> {
  return logAuthEvent({ userId, event: "EMAIL_VERIFICATION_SUCCESS", success: true, req });
}

export function logEmailVerificationFailed(reason: string, req: Request): Promise<void> {
  return logAuthEvent({ event: "EMAIL_VERIFICATION_FAILED", success: false, reason, req });
}

export function logOtpRequest(userId: string, req: Request): Promise<void> {
  return logAuthEvent({ userId, event: "OTP_REQUEST", success: true, req });
}

export function logOtpVerificationSuccess(userId: string, req: Request): Promise<void> {
  return logAuthEvent({ userId, event: "OTP_VERIFICATION_SUCCESS", success: true, req });
}

export function logOtpVerificationFailed(userId: string | undefined, reason: string, req: Request): Promise<void> {
  return logAuthEvent({ userId, event: "OTP_VERIFICATION_FAILED", success: false, reason, req });
}

export function logLogout(userId: string, req: Request): Promise<void> {
  return logAuthEvent({ userId, event: "LOGOUT", success: true, req });
}

export function logOAuthLoginSuccess(userId: string, provider: string, req: Request): Promise<void> {
  return logAuthEvent({ userId, event: "OAUTH_LOGIN_SUCCESS", success: true, provider, req });
}

export function logOAuthLoginFailed(provider: string, reason: string, req: Request): Promise<void> {
  return logAuthEvent({ event: "OAUTH_LOGIN_FAILED", success: false, provider, reason, req });
}
