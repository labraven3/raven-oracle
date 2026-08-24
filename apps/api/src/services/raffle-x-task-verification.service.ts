import { prisma } from "../lib/prisma.js";
import { decrypt as decryptXToken } from "./x-oauth.service.js";

type VerificationResult = {
  verified: boolean;
  reason?: string;
  evidence?: Record<string, unknown>;
};

async function xRequest(accessToken: string, path: string) {
  return fetch(`https://api.x.com/2${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
}

function extractXUsername(value: string) {
  const raw = value.trim();
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

function extractTweetId(value: string) {
  const raw = value.trim();
  if (/^\d+$/.test(raw)) return raw;
  const match = raw.match(/(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i);
  return match?.[1] ?? null;
}

async function getToken(userId: string) {
  const account = await prisma.socialAccount.findFirst({ where: { userId, provider: "X", isActive: true } });
  if (!account) return { error: "Connect your X account first" } as const;
  if (!account.accessTokenEncrypted) return { error: "X account has no usable access token. Reconnect X from Profile." } as const;
  try {
    return { account, accessToken: decryptXToken(account.accessTokenEncrypted) } as const;
  } catch {
    return { error: "Unable to decrypt X access token. Reconnect X from Profile." } as const;
  }
}

async function parseXError(response: Response) {
  const data = await response.json().catch(() => null) as { title?: string; detail?: string; errors?: Array<{ detail?: string; message?: string }> } | null;
  return data?.detail || data?.title || data?.errors?.[0]?.detail || data?.errors?.[0]?.message || `X API request failed (${response.status})`;
}

async function verifyFollow(userId: string, target: string, fallback?: string | null): Promise<VerificationResult> {
  const token = await getToken(userId);
  if ("error" in token) return { verified: false, reason: token.error };

  const targetValue = [target, fallback ?? ""].find((value) => extractXUsername(value));
  const username = targetValue ? extractXUsername(targetValue) : null;
  if (!username) return { verified: false, reason: "This Follow task has no valid X profile URL or handle" };

  let targetUserId = username;
  if (!/^\d+$/.test(username)) {
    const response = await xRequest(token.accessToken, `/users/by/username/${encodeURIComponent(username)}`);
    if (!response.ok) return { verified: false, reason: await parseXError(response), evidence: { target: targetValue } };
    const data = await response.json().catch(() => null) as { data?: { id?: string; username?: string } } | null;
    if (!data?.data?.id) return { verified: false, reason: "The required X account could not be found", evidence: { target: targetValue } };
    targetUserId = data.data.id;
  }

  let page = 0;
  let paginationToken: string | undefined;
  do {
    const qs = new URLSearchParams({ max_results: "1000", "user.fields": "username" });
    if (paginationToken) qs.set("pagination_token", paginationToken);
    const response = await xRequest(token.accessToken, `/users/${encodeURIComponent(token.account.providerAccountId)}/following?${qs.toString()}`);
    if (!response.ok) return { verified: false, reason: await parseXError(response), evidence: { targetUserId, providerAccountId: token.account.providerAccountId } };
    const data = await response.json().catch(() => null) as { data?: Array<{ id: string; username?: string }>; meta?: { next_token?: string } } | null;
    if (data?.data?.some((item) => item.id === targetUserId)) {
      return { verified: true, evidence: { targetUserId, providerAccountId: token.account.providerAccountId } };
    }
    paginationToken = data?.meta?.next_token;
    page += 1;
  } while (paginationToken && page < 20);

  return { verified: false, reason: "The connected X account does not follow the required account", evidence: { targetUserId, providerAccountId: token.account.providerAccountId } };
}

async function verifyLike(userId: string, target: string): Promise<VerificationResult> {
  const token = await getToken(userId);
  if ("error" in token) return { verified: false, reason: token.error };
  const tweetId = extractTweetId(target);
  if (!tweetId) return { verified: false, reason: "This Like task has no valid X post URL" };

  let page = 0;
  let paginationToken: string | undefined;
  do {
    const qs = new URLSearchParams({ max_results: "100", "tweet.fields": "id" });
    if (paginationToken) qs.set("pagination_token", paginationToken);
    const response = await xRequest(token.accessToken, `/users/${encodeURIComponent(token.account.providerAccountId)}/liked_tweets?${qs.toString()}`);
    if (!response.ok) return { verified: false, reason: await parseXError(response), evidence: { tweetId, providerAccountId: token.account.providerAccountId } };
    const data = await response.json().catch(() => null) as { data?: Array<{ id: string }>; meta?: { next_token?: string } } | null;
    if (data?.data?.some((item) => item.id === tweetId)) {
      return { verified: true, evidence: { tweetId, providerAccountId: token.account.providerAccountId } };
    }
    paginationToken = data?.meta?.next_token;
    page += 1;
  } while (paginationToken && page < 50);

  return { verified: false, reason: "The connected X account has not liked the required post", evidence: { tweetId, providerAccountId: token.account.providerAccountId } };
}

async function verifyRepost(userId: string, target: string): Promise<VerificationResult> {
  const token = await getToken(userId);
  if ("error" in token) return { verified: false, reason: token.error };
  const tweetId = extractTweetId(target);
  if (!tweetId) return { verified: false, reason: "This Repost task has no valid X post URL" };

  let page = 0;
  let paginationToken: string | undefined;
  do {
    const qs = new URLSearchParams({ max_results: "100", "user.fields": "username" });
    if (paginationToken) qs.set("pagination_token", paginationToken);
    const response = await xRequest(token.accessToken, `/tweets/${encodeURIComponent(tweetId)}/retweeted_by?${qs.toString()}`);
    if (!response.ok) return { verified: false, reason: await parseXError(response), evidence: { tweetId, providerAccountId: token.account.providerAccountId } };
    const data = await response.json().catch(() => null) as { data?: Array<{ id: string }>; meta?: { next_token?: string } } | null;
    if (data?.data?.some((item) => item.id === token.account.providerAccountId)) {
      return { verified: true, evidence: { tweetId, providerAccountId: token.account.providerAccountId } };
    }
    paginationToken = data?.meta?.next_token;
    page += 1;
  } while (paginationToken && page < 20);

  return { verified: false, reason: "The connected X account has not reposted the required post", evidence: { tweetId, providerAccountId: token.account.providerAccountId } };
}

export async function verifyXTask(taskId: string, entryId: string, userId: string): Promise<VerificationResult> {
  const task = await prisma.raffleTask.findUnique({
    where: { id: taskId },
    include: { raffle: { select: { project: { select: { xUrl: true } } } } },
  });
  if (!task) throw new Error("Raffle task not found");

  const entry = await prisma.raffleEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new Error("This raffle entry does not belong to you");

  const result = task.type === "X_FOLLOW"
    ? await verifyFollow(userId, task.targetUrl || task.target, task.raffle.project?.xUrl ?? null)
    : task.type === "X_LIKE"
      ? await verifyLike(userId, task.targetUrl || task.target)
      : await verifyRepost(userId, task.targetUrl || task.target);

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
