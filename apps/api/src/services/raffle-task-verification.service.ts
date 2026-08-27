import { prisma } from "../lib/prisma.js";
import { decrypt as decryptXToken } from "./x-oauth.service.js";

type VerificationResult = {
  verified: boolean;
  reason?: string;
  evidence?: Record<string, unknown>;
  manual?: boolean;
};

async function xRequest(accessToken: string, path: string) {
  return fetch(`https://api.x.com/2${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
}

async function getXAccount(userId: string) {
  return prisma.socialAccount.findFirst({ where: { userId, provider: "X", isActive: true } });
}

async function getXAccessToken(userId: string): Promise<{ account: { providerAccountId: string }; accessToken: string } | { error: string }> {
  const account = await getXAccount(userId);
  if (!account) return { error: "Connect your X account first" };
  if (!account.accessTokenEncrypted) return { error: "X account has no usable access token" };
  try {
    return { account, accessToken: decryptXToken(account.accessTokenEncrypted) };
  } catch {
    return { error: "Unable to decrypt X access token" };
  }
}

function extractXUsername(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return raw;
  const at = raw.match(/@([A-Za-z0-9_]{1,15})/);
  if (at?.[1]) return at[1];
  try {
    const url = new URL(raw);
    if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname.toLowerCase())) return null;
    const first = url.pathname.split("/").filter(Boolean)[0];
    return first && /^[A-Za-z0-9_]{1,15}$/.test(first) ? first : null;
  } catch {
    return /^[A-Za-z0-9_]{1,15}$/.test(raw) ? raw : null;
  }
}

async function resolveXUserId(accessToken: string, target: string): Promise<string | null> {
  const usernameOrId = extractXUsername(target);
  if (!usernameOrId) return null;
  if (/^\d+$/.test(usernameOrId)) return usernameOrId;
  const response = await xRequest(accessToken, `/users/by/username/${encodeURIComponent(usernameOrId)}`);
  const data = await response.json().catch(() => null) as { data?: { id: string } } | null;
  return response.ok ? data?.data?.id ?? null : null;
}

async function verifyXFollow(userId: string, target: string, projectXUrl?: string | null): Promise<VerificationResult> {
  const tokenData = await getXAccessToken(userId);
  if ("error" in tokenData) return { verified: false, reason: tokenData.error };

  const targetValue = [target, projectXUrl ?? ""].find((value) => extractXUsername(value)) ?? target;
  const targetUserId = await resolveXUserId(tokenData.accessToken, targetValue);
  if (!targetUserId) return { verified: false, reason: "Unable to resolve the required X account" };

  let paginationToken: string | undefined;
  let checkedPages = 0;
  do {
    const qs = new URLSearchParams({ max_results: "1000", "user.fields": "username" });
    if (paginationToken) qs.set("pagination_token", paginationToken);
    const response = await xRequest(tokenData.accessToken, `/users/${encodeURIComponent(tokenData.account.providerAccountId)}/following?${qs.toString()}`);
    const data = await response.json().catch(() => null) as { data?: Array<{ id: string; username?: string }>; meta?: { next_token?: string }; title?: string; detail?: string } | null;
    if (!response.ok || !data?.data) {
      return { verified: false, reason: data?.detail || data?.title || "X follow verification failed. Check your X API access." };
    }
    if (data.data.some((user) => user.id === targetUserId)) {
      return { verified: true, evidence: { targetUserId, providerAccountId: tokenData.account.providerAccountId } };
    }
    paginationToken = data.meta?.next_token;
    checkedPages += 1;
  } while (paginationToken && checkedPages < 20);

  return { verified: false, reason: "The connected X account does not follow the required account" };
}

async function confirmManually(taskType: string): Promise<VerificationResult> {
  return {
    verified: true,
    manual: true,
    evidence: { mode: "participant_confirmation", taskType },
  };
}

export async function verifyRaffleTask(taskId: string, entryId: string, userId: string): Promise<VerificationResult> {
  const task = await prisma.raffleTask.findUnique({
    where: { id: taskId },
    include: { raffle: { select: { project: { select: { xUrl: true } } } } },
  });
  if (!task) throw new Error("Raffle task not found");

  const entry = await prisma.raffleEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Raffle entry not found");
  if (entry.userId !== userId) throw new Error("This raffle entry does not belong to you");

  const result = task.type === "X_FOLLOW"
    ? await verifyXFollow(userId, task.targetUrl || task.target, task.raffle.project?.xUrl)
    : await confirmManually(task.type);

  const verificationData = {
    status: result.verified ? "VERIFIED" : "FAILED",
    verifiedAt: result.verified ? new Date() : null,
    failureReason: result.verified ? null : result.reason ?? null,
    evidence: result.evidence ? JSON.parse(JSON.stringify(result.evidence)) : null,
  } as const;

  await prisma.raffleTaskVerification.upsert({
    where: { raffleTaskId_entryId: { raffleTaskId: task.id, entryId } },
    create: { raffleTaskId: task.id, entryId, userId, ...verificationData },
    update: verificationData,
  });

  return result;
}
