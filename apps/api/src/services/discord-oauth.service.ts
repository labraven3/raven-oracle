import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

const DISCORD_AUTHORIZE_URL =
  "https://discord.com/oauth2/authorize";

const DISCORD_TOKEN_URL =
  "https://discord.com/api/oauth2/token";

const DISCORD_ME_URL =
  "https://discord.com/api/users/@me";

const SCOPES = ["identify", "guilds"];

function encryptionKey() {
  return crypto
    .createHash("sha256")
    .update(env.JWT_SECRET)
    .digest();
}

function encrypt(value: string) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    encryptionKey(),
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decrypt(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");

  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted value");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivRaw, "base64url"),
  );

  decipher.setAuthTag(
    Buffer.from(tagRaw, "base64url"),
  );

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(encryptedRaw, "base64url"),
    ),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function encryptState(payload: {
  userId: string;
  createdAt: number;
  nonce: string;
}) {
  return encrypt(JSON.stringify(payload));
}

function decryptState(state: string) {
  const parsed = JSON.parse(decrypt(state)) as {
    userId: string;
    createdAt: number;
    nonce: string;
  };

  if (
    !parsed.userId ||
    !parsed.createdAt ||
    !parsed.nonce
  ) {
    throw new Error("Invalid Discord OAuth state");
  }

  if (
    Date.now() - parsed.createdAt >
    10 * 60 * 1000
  ) {
    throw new Error("Discord OAuth state expired");
  }

  return parsed;
}

export function createDiscordAuthorizationUrl(
  userId: string,
) {
  const state = encryptState({
    userId,
    createdAt: Date.now(),
    nonce: crypto.randomBytes(24).toString("base64url"),
  });

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
  });

  return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.DISCORD_REDIRECT_URI,
  });

  const response = await fetch(
    DISCORD_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  const data = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        "Discord token exchange failed",
    );
  }

  return data;
}

async function getDiscordUser(
  accessToken: string,
) {
  const response = await fetch(
    DISCORD_ME_URL,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const data = await response.json() as {
    id: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
  };

  if (!response.ok || !data.id) {
    throw new Error(
      "Unable to retrieve Discord profile",
    );
  }

  return data;
}

function discordAvatarUrl(
  userId: string,
  avatar: string | null | undefined,
) {
  if (!avatar) {
    return null;
  }

  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}

export async function connectDiscordAccount(
  code: string,
  state: string,
) {
  const stateData = decryptState(state);

  const token = await exchangeCode(code);

  const discordUser = await getDiscordUser(
    token.access_token!,
  );

  const existing =
    await prisma.socialAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "DISCORD",
          providerAccountId: discordUser.id,
        },
      },
    });

  if (
    existing &&
    existing.userId !== stateData.userId
  ) {
    throw new Error(
      "This Discord account is already connected to another Raven Oracle account",
    );
  }

  const account =
    await prisma.socialAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: "DISCORD",
          providerAccountId: discordUser.id,
        },
      },

      create: {
        userId: stateData.userId,
        provider: "DISCORD",
        providerAccountId: discordUser.id,
        providerUsername:
          discordUser.username ?? null,
        displayName:
          discordUser.global_name ??
          discordUser.username ??
          null,
        avatarUrl: discordAvatarUrl(
          discordUser.id,
          discordUser.avatar,
        ),
        accessTokenEncrypted: encrypt(
          token.access_token!,
        ),
        refreshTokenEncrypted:
          token.refresh_token
            ? encrypt(token.refresh_token)
            : null,
        tokenExpiresAt: token.expires_in
          ? new Date(
              Date.now() +
                token.expires_in * 1000,
            )
          : null,
        isActive: true,
        disconnectedAt: null,
      },

      update: {
        userId: stateData.userId,
        providerUsername:
          discordUser.username ?? null,
        displayName:
          discordUser.global_name ??
          discordUser.username ??
          null,
        avatarUrl: discordAvatarUrl(
          discordUser.id,
          discordUser.avatar,
        ),
        accessTokenEncrypted: encrypt(
          token.access_token!,
        ),
        ...(token.refresh_token
          ? {
              refreshTokenEncrypted:
                encrypt(token.refresh_token),
            }
          : {}),
        tokenExpiresAt: token.expires_in
          ? new Date(
              Date.now() +
                token.expires_in * 1000,
            )
          : null,
        isActive: true,
        disconnectedAt: null,
      },

      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        providerUsername: true,
        displayName: true,
        avatarUrl: true,
        isActive: true,
        connectedAt: true,
      },
    });

  return account;
}
