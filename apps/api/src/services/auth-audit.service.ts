import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthAuditEvent } from "@prisma/client";

/**
 * Authentication Audit Logging Service
 * 
 * Logs security-relevant authentication events without exposing sensitive data.
 * 
 * SECURITY RULES:
 * - NEVER log passwords
 * - NEVER log JWT tokens
 * - NEVER log OTP codes
 * - NEVER log OAuth tokens/secrets
 * - Only log IP addresses and user agents for security investigation
 */

interface AuthAuditParams {
  userId?: string | undefined;
  event: AuthAuditEvent;
  success: boolean;
  provider?: string;
  reason?: string;
  metadata?: Record<string, unknown> | undefined;
  req?: Request;
}

/**
 * Extract safe IP address from request
 * Checks X-Forwarded-For header (for proxies) then falls back to socket address
 */
function extractIpAddress(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    // Take first IP if multiple (client, proxy1, proxy2...)
    return forwarded.split(",")[0]?.trim();
  }
  return req.socket.remoteAddress;
}

/**
 * Extract safe user agent from request
 */
function extractUserAgent(req: Request): string | undefined {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua.substring(0, 500) : undefined;
}

/**
 * Log an authentication audit event
 * 
 * Creates a secure audit trail for authentication events.
 * Safe for async fire-and-forget (errors are logged but don't throw).
 */
export async function logAuthEvent(params: AuthAuditParams): Promise<void> {
  try {
    const { userId, event, success, provider, reason, metadata, req } = params;

    const data: Record<string, unknown> = {
      event,
      success,
    };
    
    if (userId !== undefined) data.userId = userId;
    if (provider !== undefined) data.provider = provider;
    if (req) {
      const ip = extractIpAddress(req);
      const ua = extractUserAgent(req);
      if (ip !== undefined) data.ipAddress = ip;
      if (ua !== undefined) data.userAgent = ua;
    }
    if (reason !== undefined) data.reason = reason;
    if (metadata !== undefined) data.metadata = metadata;

    await prisma.authAuditLog.create({
      data: data as any,
    });
  } catch (error) {
    // Don't throw - audit logging should never break auth flow
    // But log the error for investigation
    console.error("Failed to create auth audit log:", error);
  }
}

/**
 * Convenience functions for common auth events
 */

export function logLoginSuccess(userId: string, req: Request): Promise<void> {
  return logAuthEvent({
    userId,
    event: "LOGIN_SUCCESS",
    success: true,
    provider: "EMAIL",
    req,
  });
}

export function logLoginFailed(email: string | undefined, reason: string, req: Request): Promise<void> {
  return logAuthEvent({
    event: "LOGIN_FAILED",
    success: false,
    provider: "EMAIL",
    reason,
    metadata: email ? { email } : undefined,
    req,
  });
}

export function logRegistration(userId: string, req: Request): Promise<void> {
  return logAuthEvent({
    userId,
    event: "REGISTER_SUCCESS",
    success: true,
    provider: "EMAIL",
    req,
  });
}

export function logEmailVerificationSuccess(userId: string, req: Request): Promise<void> {
  return logAuthEvent({
    userId,
    event: "EMAIL_VERIFICATION_SUCCESS",
    success: true,
    req,
  });
}

export function logEmailVerificationFailed(reason: string, req: Request): Promise<void> {
  return logAuthEvent({
    event: "EMAIL_VERIFICATION_FAILED",
    success: false,
    reason,
    req,
  });
}

export function logOtpRequest(userId: string, req: Request): Promise<void> {
  return logAuthEvent({
    userId,
    event: "OTP_REQUEST",
    success: true,
    req,
  });
}

export function logOtpVerificationSuccess(userId: string, req: Request): Promise<void> {
  return logAuthEvent({
    userId,
    event: "OTP_VERIFICATION_SUCCESS",
    success: true,
    req,
  });
}

export function logOtpVerificationFailed(userId: string | undefined, reason: string, req: Request): Promise<void> {
  return logAuthEvent({
    userId,
    event: "OTP_VERIFICATION_FAILED",
    success: false,
    reason,
    req,
  });
}

export function logLogout(userId: string, req: Request): Promise<void> {
  return logAuthEvent({
    userId,
    event: "LOGOUT",
    success: true,
    req,
  });
}

export function logOAuthLoginSuccess(userId: string, provider: string, req: Request): Promise<void> {
  return logAuthEvent({
    userId,
    event: "OAUTH_LOGIN_SUCCESS",
    success: true,
    provider,
    req,
  });
}

export function logOAuthLoginFailed(provider: string, reason: string, req: Request): Promise<void> {
  return logAuthEvent({
    event: "OAUTH_LOGIN_FAILED",
    success: false,
    provider,
    reason,
    req,
  });
}
