import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");
const STATE_TTL_SECONDS = 10 * 60;

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

type OAuthState = { userId: string; returnTo: string; purpose: "google-sheets" };

function oauthConfig() {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URI) {
    throw new Error("Google Drive OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI.");
  }
  return {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
  };
}

function encryptionKey() {
  return createHash("sha256").update(env.JWT_SECRET).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decrypt(value: string) {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("Stored Google OAuth token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
}

function validReturnTo(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export function createGoogleOAuthState(userId: string, returnTo?: string) {
  return jwt.sign({ userId, returnTo: validReturnTo(returnTo), purpose: "google-sheets" } satisfies OAuthState, env.JWT_SECRET, { expiresIn: STATE_TTL_SECONDS });
}

export function verifyGoogleOAuthState(state: string) {
  const decoded = jwt.verify(state, env.JWT_SECRET) as OAuthState;
  if (decoded.purpose !== "google-sheets" || !decoded.userId) throw new Error("Invalid Google OAuth state.");
  return { userId: decoded.userId, returnTo: validReturnTo(decoded.returnTo) };
}

export function buildGoogleAuthorizationUrl(userId: string, returnTo?: string) {
  const { clientId, redirectUri } = oauthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES,
    state: createGoogleOAuthState(userId, returnTo),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code: string) {
  const { clientId, clientSecret, redirectUri } = oauthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const data = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok || !data.access_token) throw new Error(`Google OAuth exchange failed: ${data.error_description ?? data.error ?? response.statusText}`);
  return data;
}

async function fetchUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = (await response.json().catch(() => ({}))) as GoogleUserInfo & { error?: string };
  if (!response.ok || !data.sub) throw new Error(`Google account lookup failed: ${data.error ?? response.statusText}`);
  return data;
}

export async function completeGoogleOAuth(userId: string, code: string) {
  const token = await exchangeCode(code);
  const identity = await fetchUserInfo(token.access_token as string);
  const existing = await prisma.$queryRaw<Array<{ id: string; user_id: string; refresh_token_encrypted: string }>>`
    SELECT "id", "user_id", "refresh_token_encrypted"
    FROM "GoogleOAuthConnection"
    WHERE "google_subject" = ${identity.sub}
       OR "user_id" = ${userId}::uuid
    ORDER BY "updated_at" DESC
    LIMIT 2
  `;
  const conflicting = existing.find((row) => row.user_id !== userId);
  if (conflicting) throw new Error("This Google account is already connected to another Raven Oracle account.");

  const current = existing.find((row) => row.user_id === userId);
  const refreshToken = token.refresh_token ?? current?.refresh_token_encrypted ? decrypt(current.refresh_token_encrypted) : "";
  if (!refreshToken) throw new Error("Google did not return a refresh token. Reconnect Google and approve offline access.");

  const accessExpiresAt = new Date(Date.now() + Math.max(60, Number(token.expires_in ?? 3600)) * 1000);
  const refreshEncrypted = encrypt(refreshToken);
  const accessEncrypted = encrypt(token.access_token as string);
  if (current) {
    await prisma.$executeRaw`
      UPDATE "GoogleOAuthConnection"
      SET "google_subject" = ${identity.sub}, "email" = ${identity.email ?? null}, "display_name" = ${identity.name ?? null},
          "refresh_token_encrypted" = ${refreshEncrypted}, "access_token_encrypted" = ${accessEncrypted},
          "token_expires_at" = ${accessExpiresAt}, "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${current.id}::uuid
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "GoogleOAuthConnection" ("user_id", "google_subject", "email", "display_name", "refresh_token_encrypted", "access_token_encrypted", "token_expires_at")
      VALUES (${userId}::uuid, ${identity.sub}, ${identity.email ?? null}, ${identity.name ?? null}, ${refreshEncrypted}, ${accessEncrypted}, ${accessExpiresAt})
    `;
  }
  return { email: identity.email ?? null, name: identity.name ?? null };
}

export async function getGoogleConnectionStatus(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ email: string | null; display_name: string | null; connected_at: Date }>>`
    SELECT "email", "display_name", "connected_at"
    FROM "GoogleOAuthConnection"
    WHERE "user_id" = ${userId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  return row ? { connected: true, email: row.email, name: row.display_name, connectedAt: row.connected_at } : { connected: false, email: null, name: null, connectedAt: null };
}

export async function disconnectGoogle(userId: string) {
  await prisma.$executeRaw`DELETE FROM "GoogleOAuthConnection" WHERE "user_id" = ${userId}::uuid`;
}

export async function getGoogleOAuthAccessToken(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; access_token_encrypted: string | null; refresh_token_encrypted: string; token_expires_at: Date | null }>>`
    SELECT "id", "access_token_encrypted", "refresh_token_encrypted", "token_expires_at"
    FROM "GoogleOAuthConnection"
    WHERE "user_id" = ${userId}::uuid
    LIMIT 1
  `;
  const connection = rows[0];
  if (!connection) throw new Error("Connect your Google account before exporting winners.");
  if (connection.access_token_encrypted && connection.token_expires_at && connection.token_expires_at.getTime() > Date.now() + 60_000) {
    return decrypt(connection.access_token_encrypted);
  }

  const { clientId, clientSecret } = oauthConfig();
  const refreshToken = decrypt(connection.refresh_token_encrypted);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const data = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok || !data.access_token) {
    if (data.error === "invalid_grant") throw new Error("Your Google connection expired. Please reconnect Google Drive.");
    throw new Error(`Google token refresh failed: ${data.error_description ?? data.error ?? response.statusText}`);
  }
  const expiresAt = new Date(Date.now() + Math.max(60, Number(data.expires_in ?? 3600)) * 1000);
  await prisma.$executeRaw`
    UPDATE "GoogleOAuthConnection"
    SET "access_token_encrypted" = ${encrypt(data.access_token as string)}, "token_expires_at" = ${expiresAt}, "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${connection.id}::uuid
  `;
  return data.access_token as string;
}
