import { prisma } from "../lib/prisma.js";
import { decrypt as decryptXToken } from "./x-oauth.service.js";
import { decrypt as decryptDiscordToken } from "./discord-oauth.service.js";

type VerificationResult = { verified: boolean; reason?: string; evidence?: Record<string, unknown>; manual?: boolean };

async function xRequest(accessToken: string, path: string) { return fetch(`https://api.x.com/2${path}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }); }
async function getXAccount(userId: string) { return prisma.socialAccount.findFirst({ where: { userId, provider: "X", isActive: true } }); }
async function getXAccessToken(userId: string): Promise<{ account: { providerAccountId: string }; accessToken: string } | { error: string }> {
  const account = await getXAccount(userId);
  if (!account) return { error: "Connect your X account first" };
  if (!account.accessTokenEncrypted) return { error: "X account has no usable access token" };
  try { return { account, accessToken: decryptXToken(account.accessTokenEncrypted) }; } catch { return { error: "Unable to decrypt X access token" }; }
}
function extractXUsername(value: string): string | null {
  const raw = value.trim(); if (!raw) return null; if (/^\d+$/.test(raw)) return raw;
  const at = raw.match(/@([A-Za-z0-9_]{1,15})/); if (at?.[1]) return at[1];
  try { const url = new URL(raw); if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname.toLowerCase())) return null; const first = url.pathname.split("/").filter(Boolean)[0]; return first && /^[A-Za-z0-9_]{1,15}$/.test(first) ? first : null; }
  catch { return /^[A-Za-z0-9_]{1,15}$/.test(raw) ? raw : null; }
}
function extractXTweetId(value: string): string | null {
  const raw = value.trim(); if (/^\d{1,19}$/.test(raw)) return raw;
  try { const url = new URL(raw); if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname.toLowerCase())) return null; const parts = url.pathname.split("/").filter(Boolean); const statusIndex = parts.findIndex((part) => part === "status" || part === "statuses"); const id = statusIndex >= 0 ? parts[statusIndex + 1] : null; return id && /^\d{1,19}$/.test(id) ? id : null; }
  catch { return null; }
}
async function resolveXUserId(accessToken: string, target: string): Promise<string | null> {
  const usernameOrId = extractXUsername(target); if (!usernameOrId) return null; if (/^\d+$/.test(usernameOrId)) return usernameOrId;
  const response = await xRequest(accessToken, `/users/by/username/${encodeURIComponent(usernameOrId)}`); const data = await response.json().catch(() => null) as { data?: { id: string } } | null; return response.ok ? data?.data?.id ?? null : null;
}
async function verifyXFollow(userId: string, target: string, projectXUrl?: string | null): Promise<VerificationResult> {
  const tokenData = await getXAccessToken(userId); if ("error" in tokenData) return { verified: false, reason: tokenData.error };
  const targetValue = [target, projectXUrl ?? ""].find((value) => extractXUsername(value)) ?? target; const targetUserId = await resolveXUserId(tokenData.accessToken, targetValue); if (!targetUserId) return { verified: false, reason: "Unable to resolve the required X account" };
  // One bounded page only. The old implementation paginated up to 20 pages;
  // one click therefore consumed hundreds of billable user resources.
  const qs = new URLSearchParams({ max_results: "100", "user.fields": "username" });
  const response = await xRequest(tokenData.accessToken, `/users/${encodeURIComponent(tokenData.account.providerAccountId)}/following?${qs.toString()}`); const data = await response.json().catch(() => null) as { data?: Array<{ id: string; username?: string }>; title?: string; detail?: string } | null;
  if (!response.ok || !data?.data) return { verified: false, reason: data?.detail || data?.title || "X follow verification failed. Check your X API access." };
  return data.data.some((user) => user.id === targetUserId) ? { verified: true, evidence: { targetUserId, providerAccountId: tokenData.account.providerAccountId, checkedPages: 1, maxResults: 100 } } : { verified: false, reason: "The connected X account was not found in the first 100 followed accounts. Raven Oracle will not paginate through more pages automatically." };
}
async function verifyXTweetEngagement(userId: string, taskType: "X_LIKE" | "X_REPOST", target: string): Promise<VerificationResult> {
  const tokenData = await getXAccessToken(userId); if ("error" in tokenData) return { verified: false, reason: tokenData.error }; const tweetId = extractXTweetId(target); if (!tweetId) return { verified: false, reason: "The task target must be an X post URL or tweet ID" };
  const endpoint = taskType === "X_LIKE" ? `/tweets/${tweetId}/liking_users?max_results=100` : `/tweets/${tweetId}/retweeted_by?max_results=100`; const response = await xRequest(tokenData.accessToken, endpoint); const data = await response.json().catch(() => null) as { data?: Array<{ id: string }>; title?: string; detail?: string } | null;
  if (!response.ok || !data?.data) return { verified: false, reason: data?.detail || data?.title || `X ${taskType === "X_LIKE" ? "like" : "repost"} verification failed. Check your X API access.` };
  return data.data.some((user) => user.id === tokenData.account.providerAccountId) ? { verified: true, evidence: { tweetId, providerAccountId: tokenData.account.providerAccountId } } : { verified: false, reason: `The connected X account has not ${taskType === "X_LIKE" ? "liked" : "reposted"} the required post` };
}
async function verifyDiscordJoin(userId: string, target: string): Promise<VerificationResult> {
  const account = await prisma.socialAccount.findFirst({ where: { userId, provider: "DISCORD", isActive: true } }); if (!account) return { verified: false, reason: "Connect your Discord account first" }; if (!account.accessTokenEncrypted) return { verified: false, reason: "Discord account has no usable access token" };
  let accessToken: string; try { accessToken = decryptDiscordToken(account.accessTokenEncrypted); } catch { return { verified: false, reason: "Unable to decrypt Discord access token" }; }
  const raw = target.trim(); const guildId = /^\d{5,25}$/.test(raw) ? raw : raw.match(/discord(?:app)?\.com\/channels\/(\d{5,25})/)?.[1]; if (!guildId) return { verified: false, reason: "Discord task target must contain the server/guild ID" };
  const response = await fetch("https://discord.com/api/users/@me/guilds", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }); const data = await response.json().catch(() => null) as Array<{ id: string; name?: string }> | { message?: string } | null;
  if (!response.ok || !Array.isArray(data)) return { verified: false, reason: !Array.isArray(data) && data?.message ? data.message : "Discord membership verification failed" };
  const guild = data.find((item) => item.id === guildId); return guild ? { verified: true, evidence: { guildId, guildName: guild.name ?? null } } : { verified: false, reason: "The connected Discord account is not a member of the required server" };
}
export async function verifyRaffleTask(taskId: string, entryId: string, userId: string): Promise<VerificationResult> {
  const task = await prisma.raffleTask.findUnique({ where: { id: taskId }, include: { raffle: { select: { project: { select: { xUrl: true } } } } } }); if (!task) throw new Error("Raffle task not found");
  const entry = await prisma.raffleEntry.findUnique({ where: { id: entryId } }); if (!entry) throw new Error("Raffle entry not found"); if (entry.userId !== userId) throw new Error("This raffle entry does not belong to you");
  const result = task.type === "X_FOLLOW" ? await verifyXFollow(userId, task.targetUrl || task.target, task.raffle.project?.xUrl) : task.type === "X_LIKE" || task.type === "X_REPOST" ? await verifyXTweetEngagement(userId, task.type, task.targetUrl || task.target) : await verifyDiscordJoin(userId, task.target);
  const verificationData = { status: result.verified ? "VERIFIED" : "FAILED", verifiedAt: result.verified ? new Date() : null, failureReason: result.verified ? null : result.reason ?? null, evidence: result.evidence ? JSON.parse(JSON.stringify(result.evidence)) : null } as const;
  await prisma.raffleTaskVerification.upsert({ where: { raffleTaskId_entryId: { raffleTaskId: task.id, entryId } }, create: { raffleTaskId: task.id, entryId, userId, ...verificationData }, update: verificationData });
  return result;
}
