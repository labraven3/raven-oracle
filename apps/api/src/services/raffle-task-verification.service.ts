import { prisma } from "../lib/prisma.js";
import { decrypt as decryptDiscordToken } from "./discord-oauth.service.js";
import { decrypt as decryptXToken } from "./x-oauth.service.js";

type VerificationResult = {
  verified: boolean;
  reason?: string;
  evidence?: Record<string, unknown>;
};

async function discordRequest(accessToken: string, path: string) {
  return fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
}

function extractDiscordInviteCode(value: string): string | null {
  const raw = value.trim();
  const match = raw.match(/(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite)\/([A-Za-z0-9-]+)/i);
  return match?.[1] ?? null;
}

async function resolveDiscordGuildId(target: string): Promise<string | null> {
  const raw = target.trim();
  if (/^\d{15,25}$/.test(raw)) return raw;

  const inviteCode = extractDiscordInviteCode(raw);
  if (!inviteCode) return null;

  try {
    const response = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true`);
    const data = await response.json().catch(() => null) as { guild?: { id?: string } } | null;
    return data?.guild?.id ?? null;
  } catch {
    return null;
  }
}

async function verifyDiscordJoin(userId: string, target: string): Promise<VerificationResult> {
  const account = await prisma.socialAccount.findFirst({
    where: { userId, provider: "DISCORD", isActive: true },
  });

  if (!account) return { verified: false, reason: "Connect your Discord account first" };
  if (!account.accessTokenEncrypted) return { verified: false, reason: "Discord account has no usable access token" };

  const guildId = await resolveDiscordGuildId(target);
  if (!guildId) {
    return {
      verified: false,
      reason: "Invalid Discord server ID or invite configured for this task",
    };
  }

  let accessToken: string;
  try {
    accessToken = decryptDiscordToken(account.accessTokenEncrypted);
  } catch {
    return { verified: false, reason: "Unable to decrypt Discord access token" };
  }

  const response = await discordRequest(accessToken, "/users/@me/guilds");
  const data = await response.json().catch(() => null) as Array<{ id: string; name?: string }> | { message?: string } | null;

  if (!response.ok || !Array.isArray(data)) {
    return {
      verified: false,
      reason: !Array.isArray(data) && data?.message ? data.message : "Discord membership verification failed",
      evidence: { guildId },
    };
  }

  const guild = data.find((item) => item.id === guildId);
  if (!guild) {
    return {
      verified: false,
      reason: "Your Discord account is not a member of the required server",
      evidence: { guildId, providerAccountId: account.providerAccountId },
    };
  }

  return {
    verified: true,
    evidence: { guildId, guildName: guild.name ?? null, providerAccountId: account.providerAccountId },
  };
}

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

function extractXTweetId(value: string): string | null {
  const raw = value.trim();
  if (/^\d+$/.test(raw)) return raw;
  const match = raw.match(/(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i);
  return match?.[1] ?? null;
}

async function resolveXUserId(accessToken: string, target: string): Promise<string | null> {
  const usernameOrId = extractXUsername(target);
  if (!usernameOrId) return null;
  if (/^\d+$/.test(usernameOrId)) return usernameOrId;

  const response = await xRequest(accessToken, `/users/by/username/${encodeURIComponent(usernameOrId)}`);
  const data = await response.json().catch(() => null) as { data?: { id: string }; detail?: string } | null;
  return response.ok ? data?.data?.id ?? null : null;
}

function pickXFollowTarget(targetUrl: string | null | undefined, target: string, projectXUrl: string | null | undefined) {
  for (const value of [targetUrl ?? "", target, projectXUrl ?? ""]) {
    if (extractXUsername(value)) return value;
  }
  return targetUrl || target || projectXUrl || "";
}

async function verifyXFollow(userId: string, target: string, projectXUrl?: string | null): Promise<VerificationResult> {
  const tokenData = await getXAccessToken(userId);
  if ("error" in tokenData) return { verified: false, reason: tokenData.error };

  const targetValue = pickXFollowTarget(undefined, target, projectXUrl);
  const targetUserId = await resolveXUserId(tokenData.accessToken, targetValue);
  if (!targetUserId) return { verified: false, reason: "Unable to resolve the required X account", evidence: { target: targetValue } };

  let paginationToken: string | undefined;
  let checkedPages = 0;

  do {
    const qs = new URLSearchParams({ max_results: "1000", "user.fields": "username" });
    if (paginationToken) qs.set("pagination_token", paginationToken);

    const response = await xRequest(tokenData.accessToken, `/users/${encodeURIComponent(tokenData.account.providerAccountId)}/following?${qs.toString()}`);
    const data = await response.json().catch(() => null) as { data?: Array<{ id: string; username?: string }>; meta?: { next_token?: string }; title?: string; detail?: string } | null;

    if (!response.ok || !data?.data) {
      return {
        verified: false,
        reason: data?.detail || data?.title || "X follow verification failed. Check your X API access.",
        evidence: { targetUserId },
      };
    }

    if (data.data.some((user) => user.id === targetUserId)) {
      return { verified: true, evidence: { targetUserId, providerAccountId: tokenData.account.providerAccountId } };
    }

    paginationToken = data.meta?.next_token;
    checkedPages += 1;
  } while (paginationToken && checkedPages < 20);

  return {
    verified: false,
    reason: "The connected X account does not follow the required account",
    evidence: { targetUserId, providerAccountId: tokenData.account.providerAccountId },
  };
}

async function verifyXLike(userId: string, target: string): Promise<VerificationResult> {
  const tokenData = await getXAccessToken(userId);
  if ("error" in tokenData) return { verified: false, reason: tokenData.error };

  const tweetId = extractXTweetId(target);
  if (!tweetId) return { verified: false, reason: "Invalid X post URL or tweet ID configured for this task" };

  let paginationToken: string | undefined;
  let checkedPages = 0;

  do {
    const qs = new URLSearchParams({ max_results: "100" });
    if (paginationToken) qs.set("pagination_token", paginationToken);
    const response = await xRequest(tokenData.accessToken, `/tweets/${encodeURIComponent(tweetId)}/liking_users?${qs.toString()}`);
    const data = await response.json().catch(() => null) as { data?: Array<{ id: string }>; meta?: { next_token?: string }; title?: string; detail?: string } | null;

    if (!response.ok || !data?.data) {
      return { verified: false, reason: data?.detail || data?.title || "X like verification failed. Check your X API access.", evidence: { tweetId } };
    }

    if (data.data.some((user) => user.id === tokenData.account.providerAccountId)) {
      return { verified: true, evidence: { tweetId, providerAccountId: tokenData.account.providerAccountId } };
    }

    paginationToken = data.meta?.next_token;
    checkedPages += 1;
  } while (paginationToken && checkedPages < 20);

  return { verified: false, reason: "The connected X account has not liked the required post", evidence: { tweetId, providerAccountId: tokenData.account.providerAccountId } };
}

async function verifyXRepost(userId: string, target: string): Promise<VerificationResult> {
  const tokenData = await getXAccessToken(userId);
  if ("error" in tokenData) return { verified: false, reason: tokenData.error };

  const tweetId = extractXTweetId(target);
  if (!tweetId) return { verified: false, reason: "Invalid X post URL or tweet ID configured for this task" };

  let paginationToken: string | undefined;
  let checkedPages = 0;

  do {
    const qs = new URLSearchParams({ max_results: "100" });
    if (paginationToken) qs.set("pagination_token", paginationToken);
    const response = await xRequest(tokenData.accessToken, `/tweets/${encodeURIComponent(tweetId)}/retweeted_by?${qs.toString()}`);
    const data = await response.json().catch(() => null) as { data?: Array<{ id: string }>; meta?: { next_token?: string }; title?: string; detail?: string } | null;

    if (!response.ok || !data?.data) {
      return { verified: false, reason: data?.detail || data?.title || "X repost verification failed. Check your X API access.", evidence: { tweetId } };
    }

    if (data.data.some((user) => user.id === tokenData.account.providerAccountId)) {
      return { verified: true, evidence: { tweetId, providerAccountId: tokenData.account.providerAccountId } };
    }

    paginationToken = data.meta?.next_token;
    checkedPages += 1;
  } while (paginationToken && checkedPages < 20);

  return { verified: false, reason: "The connected X account has not reposted the required post", evidence: { tweetId, providerAccountId: tokenData.account.providerAccountId } };
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

  let result: VerificationResult;
  switch (task.type) {
    case "DISCORD_JOIN":
      result = await verifyDiscordJoin(userId, task.targetUrl || task.target);
      break;
    case "X_FOLLOW":
      result = await verifyXFollow(userId, task.targetUrl || task.target, task.raffle.project?.xUrl);
      break;
    case "X_LIKE":
      result = await verifyXLike(userId, task.targetUrl || task.target);
      break;
    case "X_REPOST":
      result = await verifyXRepost(userId, task.targetUrl || task.target);
      break;
    default:
      result = { verified: false, reason: "Unsupported raffle task type" };
  }

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
