
import { prisma } from "../lib/prisma.js";
import { decrypt as decryptDiscordToken } from "./discord-oauth.service.js";
import { decrypt as decryptXToken } from "./x-oauth.service.js";

type VerificationResult = {
  verified: boolean;
  reason?: string;
  evidence?: Record<string, unknown>;
};

async function discordRequest(
  accessToken: string,
  path: string,
) {
  return fetch(`https://discord.com/api/v10${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

async function verifyDiscordJoin(
  userId: string,
  targetGuildId: string,
): Promise<VerificationResult> {
  const account = await prisma.socialAccount.findFirst({
    where: {
      userId,
      provider: "DISCORD",
      isActive: true,
    },
  });

  if (!account) {
    return {
      verified: false,
      reason: "Connect your Discord account first",
    };
  }

  if (!account.accessTokenEncrypted) {
    return {
      verified: false,
      reason: "Discord account has no usable access token",
    };
  }

  let accessToken: string;

  try {
    accessToken = decryptDiscordToken(
      account.accessTokenEncrypted,
    );
  } catch {
    return {
      verified: false,
      reason: "Unable to decrypt Discord access token",
    };
  }

  const response = await discordRequest(
    accessToken,
    "/users/@me/guilds",
  );

  const data = await response.json() as
    | Array<{
        id: string;
        name?: string;
      }>
    | {
        message?: string;
        code?: number;
      };

  if (!response.ok || !Array.isArray(data)) {
    return {
      verified: false,
      reason:
        !Array.isArray(data) && data.message
          ? data.message
          : "Discord membership verification failed",
    };
  }

  const guild = data.find(
    (item) => item.id === targetGuildId,
  );

  if (!guild) {
    return {
      verified: false,
      reason: "Discord account is not a member of the required server",
      evidence: {
        guildId: targetGuildId,
        providerAccountId: account.providerAccountId,
      },
    };
  }

  return {
    verified: true,
    evidence: {
      guildId: guild.id,
      guildName: guild.name ?? null,
      providerAccountId: account.providerAccountId,
    },
  };
}

async function xRequest(
  accessToken: string,
  path: string,
) {
  return fetch(`https://api.x.com/2${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

async function getXAccount(userId: string) {
  return prisma.socialAccount.findFirst({
    where: {
      userId,
      provider: "X",
      isActive: true,
    },
  });
}

async function getXAccessToken(
  account: {
    accessTokenEncrypted: string | null;
  },
) {
  if (!account.accessTokenEncrypted) {
    throw new Error("X account has no usable access token");
  }

  return decryptXToken(account.accessTokenEncrypted);
}


function extractXUsername(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) return raw;

  const at = raw.match(/@([A-Za-z0-9_]{1,15})/);
  const atUsername = at?.[1];
  if (atUsername) return atUsername;

  try {
    const url = new URL(raw);
    if (
      ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
        url.hostname.toLowerCase(),
      )
    ) {
      const username = url.pathname.split("/").filter(Boolean)[0];
      if (username && /^[A-Za-z0-9_]{1,15}$/.test(username)) {
        return username;
      }
    }
  } catch {}

  if (/^[A-Za-z0-9_]{1,15}$/.test(raw)) {
    return raw;
  }

  return null;
}

function extractXTweetId(value: string): string | null {
  const raw = value.trim();

  if (/^\d+$/.test(raw)) return raw;

  const match = raw.match(
    /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i,
  );

  return match?.[1] ?? null;
}

async function resolveXUserId(
  accessToken: string,
  target: string,
): Promise<string | null> {
  const usernameOrId = extractXUsername(target);

  if (!usernameOrId) {
    return null;
  }

  if (/^\d+$/.test(usernameOrId)) {
    return usernameOrId;
  }

  const response = await xRequest(
    accessToken,
    `/users/by/username/${encodeURIComponent(usernameOrId)}`,
  );

  const data = await response.json() as {
    data?: {
      id: string;
      username?: string;
    };
    title?: string;
    detail?: string;
  };

  if (!response.ok || !data.data?.id) {
    return null;
  }

  return data.data.id;
}
async function verifyXFollow(
  userId: string,
  target: string,
): Promise<VerificationResult> {
  const account = await getXAccount(userId);

  if (!account) {
    return {
      verified: false,
      reason: "Connect your X account first",
    };
  }

  let accessToken: string;

  try {
    accessToken = await getXAccessToken(account);
  } catch {
    return {
      verified: false,
      reason: "Unable to decrypt X access token",
    };
  }

  const targetUserId = await resolveXUserId(
    accessToken,
    target,
  );

  if (!targetUserId) {
    return {
      verified: false,
      reason: "Unable to resolve the required X account",
    };
  }

  const response = await xRequest(
    accessToken,
    `/users/${encodeURIComponent(account.providerAccountId)}/following?max_results=1000`,
  );

  const data = await response.json() as {
    data?: Array<{
      id: string;
      username?: string;
    }>;
    title?: string;
    detail?: string;
  };

  if (!response.ok || !data.data) {
    return {
      verified: false,
      reason:
        data.detail ||
        data.title ||
        "X follow verification failed. Check your X API access.",
      evidence: {
        targetUserId,
      },
    };
  }

  const following = data.data.some(
    (user) => user.id === targetUserId,
  );

  return {
    verified: following,
    ...(following
      ? {}
      : {
          reason: "The connected X account does not follow the required account",
        }),
    evidence: {
      targetUserId,
      providerAccountId: account.providerAccountId,
    },
  };
}

async function verifyXLike(
  userId: string,
  targetTweetId: string,
): Promise<VerificationResult> {
  const account = await getXAccount(userId);

  if (!account) {
    return {
      verified: false,
      reason: "Connect your X account first",
    };
  }

  let accessToken: string;

  try {
    accessToken = await getXAccessToken(account);
  } catch {
    return {
      verified: false,
      reason: "Unable to decrypt X access token",
    };
  }

  const tweetId = extractXTweetId(targetTweetId);

  if (!tweetId) {
    return {
      verified: false,
      reason: "Invalid X post URL or tweet ID configured for this task",
    };
  }

  const response = await xRequest(
    accessToken,
    `/users/${encodeURIComponent(account.providerAccountId)}/liked_tweets?max_results=100`,
  );

  const data = await response.json() as {
    data?: Array<{
      id: string;
    }>;
    title?: string;
    detail?: string;
  };

  if (!response.ok || !data.data) {
    return {
      verified: false,
      reason:
        data.detail ||
        data.title ||
        "X like verification failed. Check your X API access.",
      evidence: {
        tweetId: targetTweetId,
      },
    };
  }

  const liked = data.data.some(
    (tweet) => tweet.id === tweetId,
  );

  return {
    verified: liked,
    ...(liked
      ? {}
      : {
          reason: "The connected X account has not liked the required post",
        }),
    evidence: {
      tweetId: targetTweetId,
      providerAccountId: account.providerAccountId,
    },
  };
}

async function verifyXRepost(
  userId: string,
  targetTweetId: string,
): Promise<VerificationResult> {
  const account = await getXAccount(userId);

  if (!account) {
    return {
      verified: false,
      reason: "Connect your X account first",
    };
  }

  let accessToken: string;

  try {
    accessToken = await getXAccessToken(account);
  } catch {
    return {
      verified: false,
      reason: "Unable to decrypt X access token",
    };
  }

  const tweetId = extractXTweetId(targetTweetId);

  if (!tweetId) {
    return {
      verified: false,
      reason: "Invalid X post URL or tweet ID configured for this task",
    };
  }

  const response = await xRequest(
    accessToken,
    `/tweets/${encodeURIComponent(tweetId)}/retweeted_by?max_results=100`,
  );

  const data = await response.json() as {
    data?: Array<{
      id: string;
      username?: string;
    }>;
    title?: string;
    detail?: string;
  };

  if (!response.ok || !data.data) {
    return {
      verified: false,
      reason:
        data.detail ||
        data.title ||
        "X repost verification failed. Check your X API access.",
      evidence: {
        tweetId: targetTweetId,
      },
    };
  }

  const reposted = data.data.some(
    (user) => user.id === account.providerAccountId,
  );

  return {
    verified: reposted,
    ...(reposted
      ? {}
      : {
          reason: "The connected X account has not reposted the required post",
        }),
    evidence: {
      tweetId: targetTweetId,
      providerAccountId: account.providerAccountId,
    },
  };
}

export async function verifyRaffleTask(
  taskId: string,
  entryId: string,
  userId: string,
): Promise<VerificationResult> {
  const task = await prisma.raffleTask.findUnique({
    where: { id: taskId },
    include: {
      raffle: {
        select: {
          project: {
            select: {
              xUrl: true,
            },
          },
        },
      },
    },
  });

  if (!task) {
    throw new Error("Raffle task not found");
  }

  const entry = await prisma.raffleEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) {
    throw new Error("Raffle entry not found");
  }

  if (entry.userId !== userId) {
    throw new Error("This raffle entry does not belong to you");
  }

  let result: VerificationResult;

  switch (task.type) {
    case "DISCORD_JOIN":
      result = await verifyDiscordJoin(
        userId,
        task.target,
      );
      break;

    case "X_FOLLOW": {
      const target =
        task.targetUrl ||
        task.target ||
        task.raffle.project?.xUrl ||
        "";

      result = await verifyXFollow(userId, target);
      break;
    }

    case "X_LIKE":
      result = await verifyXLike(
        userId,
        task.targetUrl || task.target,
      );
      break;

    case "X_REPOST":
      result = await verifyXRepost(
        userId,
        task.targetUrl || task.target,
      );
      break;

    default:
      result = {
        verified: false,
        reason: "Unsupported raffle task type",
      };
  }

  const verificationData = {
    status: result.verified ? "VERIFIED" : "FAILED",
    verifiedAt: result.verified ? new Date() : null,
    failureReason: result.verified
      ? null
      : result.reason ?? null,
    ...(result.evidence
      ? {
          evidence: JSON.parse(
            JSON.stringify(result.evidence),
          ),
        }
      : {
          evidence: null,
        }),
  } as const;

  await prisma.raffleTaskVerification.upsert({
    where: {
      raffleTaskId_entryId: {
        raffleTaskId: task.id,
        entryId,
      },
    },
    create: {
      raffleTaskId: task.id,
      entryId,
      userId,
      ...verificationData,
    },
    update: verificationData,
  });

  return result;
}
