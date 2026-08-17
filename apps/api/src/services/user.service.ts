import { prisma } from "../lib/prisma.js";

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
  });
}

export async function createUser(email: string, username?: string) {
  return prisma.user.create({
    data: {
      email,
      username: username ?? null,
    },
  });
}
