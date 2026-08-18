import crypto from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const X_AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_ME_URL = "https://api.x.com/2/users/me";

// Permissions required to verify raffle tasks automatically.
const SCOPES = [
  "users.read",
  "tweet.read",
  "follows.read",
  "like.read",
  "offline.access",
];

function encryptionKey() {
  return crypto
    .createHash("sha256")
    .update(env.JWT_SECRET)
    .digest();
}

function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decrypt(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted token");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function base64Url(value: Buffer) {
  return value.toString("base64url");
}

function createPkce() {
  const codeVerifier = base64Url(crypto.randomBytes(48));
  const codeChallenge = base64Url(
    crypto.createHash("sha256").update(codeVerifier).digest(),
  );
  return { codeVerifier, codeChallenge };
}

function encryptState(payload: { userId: string; codeVerifier: string; createdAt: number }) {
  return encrypt(JSON.stringify(payload));
}

function decryptState(state: string) {
  const parsed = JSON.parse(decrypt(state)) as {
    userId: string;
    codeVerifier: string;
    createdAt: number;
  };

  if (!parsed.userId || !parsed.codeVerifier || !parsed.createdAt) {
    throw new Error("Invalid OAuth state");
  }
  if (Date.now() - parsed.createdAt > 10 * 60 * 1000) {
    throw new Error("OAuth state expired");
  }
  return parsed;
}

function validateXOAuthConfig() {
  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET || !env.X_REDIRECT_URI) {
    throw new Error("X OAuth is not configured. Please set X_CLIENT_ID, X_CLIENT_SECRET, and X_REDIRECT_URI environment variables.");
  }
}

export function createXAuthorizationUrl(userId: string) {
  validateXOAuthConfig();
  const { codeVerifier, codeChallenge } = createPkce();
  const state = encryptState({ userId, codeVerifier, createdAt: Date.now() });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.X_CLIENT_ID!,
    redirect_uri: env.X_REDIRECT_URI!,
    scope: SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${X_AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCode(code: string, codeVerifier: string) {
  validateXOAuthConfig();
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: env.X_CLIENT_ID!,
    redirect_uri: env.X_REDIRECT_URI!,
    code_verifier: codeVerifier,
  });
  const credentials = Buffer.from(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`).toString("base64");

  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body,
  });

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
    throw new Error(data.error_description || data.error || "X token exchange failed");
  }
  return data;
}

async function getXUser(accessToken: string) {
  const response = await fetch(`${X_ME_URL}?user.fields=profile_image_url,name,username`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json() as {
    data?: { id: string; name?: string; username?: string; profile_image_url?: string };
    title?: string;
    detail?: string;
  };

  if (!response.ok || !data.data?.id) {
    throw new Error(data.detail || data.title || "Unable to retrieve X profile");
  }
  return data.data;
}

export async function connectXAccount(code: string, state: string) {
  const stateData = decryptState(state);
  const token = await exchangeCode(code, stateData.codeVerifier);
  const xUser = await getXUser(token.access_token!);

  const existing = await prisma.socialAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "X",
        providerAccountId: xUser.id,
      },
    },
  });

  if (existing && existing.userId !== stateData.userId) {
    throw new Error("This X account is already connected to another Raven Oracle account");
  }

  return prisma.socialAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: "X",
        providerAccountId: xUser.id,
      },
    },
    create: {
      userId: stateData.userId,
      provider: "X",
      providerAccountId: xUser.id,
      providerUsername: xUser.username ?? null,
      displayName: xUser.name ?? null,
      avatarUrl: xUser.profile_image_url ?? null,
      accessTokenEncrypted: encrypt(token.access_token!),
      refreshTokenEncrypted: token.refresh_token ? encrypt(token.refresh_token) : null,
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      isActive: true,
      disconnectedAt: null,
    },
    update: {
      userId: stateData.userId,
      providerUsername: xUser.username ?? null,
      displayName: xUser.name ?? null,
      avatarUrl: xUser.profile_image_url ?? null,
      accessTokenEncrypted: encrypt(token.access_token!),
      ...(token.refresh_token ? { refreshTokenEncrypted: encrypt(token.refresh_token) } : {}),
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
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
}
