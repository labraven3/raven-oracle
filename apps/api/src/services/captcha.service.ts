import crypto from "node:crypto";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function secretKey() {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || "";
}

export function captchaConfigured() {
  return Boolean(secretKey());
}

export async function verifyCaptchaToken(token: string | undefined, remoteIp?: string) {
  const secret = secretKey();
  if (!secret) {
    return { verified: false, configured: false, reason: "Captcha verification is not configured" };
  }
  if (!token?.trim()) {
    return { verified: false, configured: true, reason: "Captcha verification token is required" };
  }

  const body = new URLSearchParams({ secret, response: token.trim() });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return { verified: false, configured: true, reason: "Captcha provider request failed" };

  const data = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
  return {
    verified: data.success === true,
    configured: true,
    reason: data.success === true ? undefined : data["error-codes"]?.join(", ") || "Captcha verification failed",
  };
}

export function buildCaptchaNonce(entryId: string) {
  return crypto.createHash("sha256").update(`${entryId}:${process.env.RAVEN_CAPTCHA_SALT ?? "raven"}`).digest("hex");
}
