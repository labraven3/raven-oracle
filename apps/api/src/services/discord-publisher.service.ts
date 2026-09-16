import { env } from "../config/env.js";

const DISCORD_API = "https://discord.com/api/v10";

export type DiscordPromotionConfig = {
  enabled?: boolean;
  guildId?: string | null | undefined;
  channelId?: string | null;
  mentionRoleId?: string | null | undefined;
  messageId?: string | null;
  postedAt?: string | null;
  winnerAnnouncedAt?: string | null;
};

type DiscordEmbed = {
  title: string;
  description: string;
  url: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
};

function botHeaders() {
  return {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "RavenOracle/1.0",
  };
}

function assertDiscordBotConfigured() {
  if (!env.DISCORD_BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN is not configured");
}

async function discordRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${DISCORD_API}${path}`, { ...init, headers: { ...botHeaders(), ...(init.headers ?? {}) } });
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const detail = typeof body === "object" && body !== null && "message" in body ? String((body as { message?: unknown }).message) : response.statusText;
    throw new Error(`Discord API ${response.status}: ${detail}`);
  }
  return body as T;
}

export async function verifyDiscordChannel(channelId: string, expectedGuildId?: string | null) {
  assertDiscordBotConfigured();
  const channel = await discordRequest<{ id: string; guild_id?: string; type: number }>(`/channels/${encodeURIComponent(channelId)}`, { method: "GET" });
  if (![0, 5].includes(channel.type)) throw new Error("Selected Discord channel must be a text or announcement channel");
  if (expectedGuildId && channel.guild_id && channel.guild_id !== expectedGuildId) throw new Error("Discord channel does not belong to the selected server");
  return channel;
}

export async function publishDiscordGiveaway(input: {
  channelId: string;
  guildId?: string | null | undefined;
  mentionRoleId?: string | null | undefined;
  title: string;
  description?: string | null;
  prizeName: string;
  prizeQuantity: number;
  winnerCount: number;
  startsAt: Date;
  endsAt: Date;
  raffleUrl: string;
}) {
  assertDiscordBotConfigured();
  await verifyDiscordChannel(input.channelId, input.guildId);

  const content = input.mentionRoleId ? `<@&${input.mentionRoleId}>` : undefined;
  const embed: DiscordEmbed = {
    title: `🎁 ${input.title}`,
    description: input.description?.trim() || "A new giveaway is live on Raven Oracle.",
    url: input.raffleUrl,
    color: 0x8b5cf6,
    fields: [
      { name: "Prize", value: `${input.prizeName} × ${input.prizeQuantity}`, inline: true },
      { name: "Winners", value: String(input.winnerCount), inline: true },
      { name: "Ends", value: `<t:${Math.floor(input.endsAt.getTime() / 1000)}:F>`, inline: false },
    ],
    footer: { text: "Raven Oracle • Complete the tasks, then enter the giveaway" },
  };

  const created = await discordRequest<{ id: string }>(`/channels/${encodeURIComponent(input.channelId)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content,
      embeds: [embed],
      components: [{
        type: 1,
        components: [{ type: 2, style: 5, label: "Join Giveaway", url: input.raffleUrl }],
      }],
      allowed_mentions: input.mentionRoleId ? { roles: [input.mentionRoleId] } : { parse: [] },
    }),
  });

  return { messageId: created.id, postedAt: new Date().toISOString() };
}

export async function announceDiscordWinners(input: {
  channelId: string;
  title: string;
  winners: Array<{ username: string | null; discordAccountId?: string | null }>;
  raffleUrl: string;
}) {
  assertDiscordBotConfigured();
  await verifyDiscordChannel(input.channelId);
  const mentions = input.winners.map((winner) => winner.discordAccountId ? `<@${winner.discordAccountId}>` : winner.username ? `@${winner.username}` : "winner");
  const content = `🏆 **${input.title} — Winners**\n${mentions.map((mention, index) => `${index + 1}. ${mention}`).join("\n")}\n\nView the raffle: ${input.raffleUrl}`;
  const created = await discordRequest<{ id: string }>(`/channels/${encodeURIComponent(input.channelId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, allowed_mentions: { parse: ["users"] } }),
  });
  return { messageId: created.id, announcedAt: new Date().toISOString() };
}
