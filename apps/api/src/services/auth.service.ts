import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

/**
 * Creates a secure JWT authentication token for a user.
 * Uses HS256 algorithm with a minimum 32-character secret.
 * Token expires after 7 days.
 * Payload contains only the user ID (sub claim) - no sensitive information.
 */
export async function createAuthToken(userId: string) {
  return jwt.sign(
    { sub: userId },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "7d",
    }
  );
}

/**
 * Verifies a JWT authentication token securely.
 * - Explicitly requires HS256 algorithm (prevents algorithm confusion attacks)
 * - Validates token signature
 * - Checks expiration
 * - Validates payload structure
 * - Returns the authenticated user
 * 
 * @throws Error if token is invalid, expired, malformed, or user not found
 */
export async function verifyAuthToken(token: string) {
  try {
    // Explicitly specify allowed algorithms to prevent algorithm confusion attacks
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    // Validate payload structure
    if (typeof payload !== "object" || typeof payload.sub !== "string") {
      throw new Error("Invalid token payload");
    }

    // Fetch and return user
    return prisma.user.findUnique({
      where: { id: payload.sub },
    });
  } catch (error) {
    // Handle specific JWT errors
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid authentication token");
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Authentication token expired");
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new Error("Authentication token not yet valid");
    }
    // Re-throw other errors (including our custom validation error)
    throw error;
  }
}
