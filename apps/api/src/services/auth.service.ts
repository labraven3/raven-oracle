import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export async function createAuthToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

export async function verifyAuthToken(token: string) {
  const payload = jwt.verify(token, env.JWT_SECRET);

  if (typeof payload !== "object" || typeof payload.sub !== "string") {
    throw new Error("Invalid authentication token");
  }

  return prisma.user.findUnique({
    where: { id: payload.sub },
  });
}
