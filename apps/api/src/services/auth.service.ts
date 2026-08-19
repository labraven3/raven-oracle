import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

type AuthPortal = "user" | "admin";

/**
 * Creates a secure JWT authentication token for a user.
 * The portal claim prevents an admin session from being reused as a user
 * session and prevents a user session from being used against admin routes.
 */
export async function createAuthToken(userId: string, portal: AuthPortal = "user") {
  return jwt.sign(
    { sub: userId, portal },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "7d",
    }
  );
}

/**
 * Verifies a JWT authentication token securely and enforces the expected portal.
 */
export async function verifyAuthToken(token: string, expectedPortal: AuthPortal = "user") {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload !== "object" ||
      typeof payload.sub !== "string" ||
      (payload.portal !== "user" && payload.portal !== "admin") ||
      payload.portal !== expectedPortal
    ) {
      throw new Error("Invalid authentication token");
    }

    return prisma.user.findUnique({
      where: { id: payload.sub },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid authentication token");
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Authentication token expired");
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new Error("Authentication token not yet valid");
    }
    throw error;
  }
}
