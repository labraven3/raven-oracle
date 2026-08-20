import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

type AuthPortal = "user" | "admin";

/** Creates a signed JWT with an explicit portal scope. */
export async function createAuthToken(userId: string, portal: AuthPortal = "user") {
  return jwt.sign({ sub: userId, portal }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "7d",
  });
}

export async function verifyAuthToken(
  token: string,
  expectedPortal: AuthPortal | "any" = "any"
) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });

    if (
      typeof payload !== "object" ||
      typeof payload.sub !== "string" ||
      (payload.portal !== "user" && payload.portal !== "admin") ||
      (expectedPortal !== "any" && payload.portal !== expectedPortal)
    ) {
      throw new Error("Invalid authentication token");
    }

    return prisma.user.findUnique({ where: { id: payload.sub } });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw new Error("Authentication token expired");
    if (error instanceof jwt.NotBeforeError) throw new Error("Authentication token not yet valid");
    if (error instanceof jwt.JsonWebTokenError) throw new Error("Invalid authentication token");
    throw error;
  }
}
