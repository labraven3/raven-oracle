import crypto from "node:crypto";
import tls from "node:tls";
import { env } from "../config/env.js";

function base64url(value: string) { return Buffer.from(value).toString("base64url"); }
function sign(payload: string) { return crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url"); }

export function createEmailVerificationToken(userId: string, email: string, currentEmail: string | null) {
  const payload = base64url(JSON.stringify({ userId, email, currentEmail, exp: Date.now() + 30 * 60 * 1000, nonce: crypto.randomBytes(16).toString("hex") }));
  return `${payload}.${sign(payload)}`;
}

export function verifyEmailVerificationToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Invalid verification link");
  const expected = sign(payload); const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Invalid verification link");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId: string; email: string; currentEmail: string | null; exp: number };
  if (!data.userId || !data.email || !data.exp || data.exp < Date.now()) throw new Error("Verification link expired");
  return data;
}

function requireGmail() {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    // Log full error server-side
    console.error("Email delivery is not configured. Missing GMAIL_USER or GMAIL_APP_PASSWORD.");
    // Throw safe error for client
    throw new Error("Email delivery is not available.");
  }
}

async function readResponse(socket: tls.TLSSocket) {
  return await new Promise<string>((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer | string) => { buffer += chunk.toString(); const lines = buffer.split("\r\n"); const last = lines[lines.length - 2] ?? ""; if (/^\d{3} /.test(last)) { cleanup(); resolve(buffer); } };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const cleanup = () => { socket.off("data", onData); socket.off("error", onError); };
    socket.on("data", onData); socket.on("error", onError);
  });
}

async function command(socket: tls.TLSSocket, value: string, expected: RegExp) {
  socket.write(`${value}\r\n`); const response = await readResponse(socket);
  if (!expected.test(response)) {
    // Log full error server-side
    console.error(`Gmail SMTP error: ${response.trim()}`);
    // Throw safe error for client
    throw new Error("Email delivery failed.");
  }
}

function escapeHeader(value: string) { return value.replace(/[\r\n]/g, " "); }
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

async function sendHtmlEmail(email: string, subject: string, html: string) {
  requireGmail();
  const socket = tls.connect({ host: "smtp.gmail.com", port: 465, servername: "smtp.gmail.com" });
  await new Promise<void>((resolve, reject) => { socket.once("secureConnect", () => resolve()); socket.once("error", reject); });
  try {
    await readResponse(socket);
    await command(socket, "EHLO raven-oracle", /^250[ -]/m);
    await command(socket, "AUTH LOGIN", /^334[ -]/m);
    await command(socket, Buffer.from(env.GMAIL_USER!, "utf8").toString("base64"), /^334[ -]/m);
    await command(socket, Buffer.from(env.GMAIL_APP_PASSWORD!.replace(/\s/g, ""), "utf8").toString("base64"), /^235[ -]/m);
    await command(socket, `MAIL FROM:<${env.GMAIL_USER}>`, /^250[ -]/m);
    await command(socket, `RCPT TO:<${email}>`, /^250[ -]/m);
    await command(socket, "DATA", /^354[ -]/m);
    const body = [`From: ${escapeHeader(env.EMAIL_FROM_NAME)} <${env.GMAIL_USER}>`, `To: ${escapeHeader(email)}`, `Subject: ${escapeHeader(subject)}`, "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8", "", html, "."].join("\r\n");
    await command(socket, body, /^250[ -]/m);
    await command(socket, "QUIT", /^221[ -]/m);
  } finally { socket.end(); }
}

export function sendEmailVerification(email: string, verificationUrl: string) {
  return sendHtmlEmail(email, "Verify your Raven Oracle email", `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px"><h1>Verify your Raven Oracle email</h1><p>Click the button below to verify your email and finish setting up your profile.</p><p><a href="${verificationUrl}" style="display:inline-block;padding:12px 18px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:8px">Verify email</a></p><p style="color:#777">This link expires in 30 minutes.</p></div>`);
}

export function createOtpChallenge(userId: string, email: string) {
  const code = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString("hex");
  const codeHash = crypto.createHash("sha256").update(`${userId}:${email}:${salt}:${code}`).digest("hex");
  const payload = base64url(JSON.stringify({ userId, email, salt, codeHash, exp: Date.now() + 10 * 60 * 1000, nonce: crypto.randomBytes(16).toString("hex") }));
  return { code, challenge: `${payload}.${sign(payload)}` };
}

export function verifyOtpChallenge(challenge: string, userId: string, email: string, code: string) {
  const [payload, signature] = challenge.split(".");
  if (!payload || !signature) throw new Error("Invalid OTP challenge");
  const expected = sign(payload); const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Invalid OTP challenge");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId: string; email: string; salt: string; codeHash: string; exp: number };
  if (data.exp < Date.now()) throw new Error("OTP expired. Request a new code.");
  if (data.userId !== userId || data.email !== email) throw new Error("OTP does not match this email request");
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit OTP");
  const actual = crypto.createHash("sha256").update(`${userId}:${email}:${data.salt}:${code}`).digest("hex");
  const x = Buffer.from(actual); const y = Buffer.from(data.codeHash);
  if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) throw new Error("Incorrect OTP");
  return data;
}

export function sendEmailOtp(email: string, code: string) {
  return sendHtmlEmail(email, "Your Raven Oracle verification code", `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px"><div style="font-size:12px;font-weight:700;letter-spacing:3px;color:#8b5cf6">RAVEN ORACLE</div><h1>Verify your email</h1><p>Use this one-time code to verify the email saved to your Raven Oracle profile:</p><div style="font-size:34px;letter-spacing:10px;font-weight:800;background:#f4f1ff;border-radius:12px;padding:18px;text-align:center">${code}</div><p style="color:#777">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`);
}

export function sendWinnerNotification(email: string, raffleTitle: string, prizeName: string, claimUrl: string) {
  return sendHtmlEmail(email, `You won: ${raffleTitle}`, `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px"><div style="font-size:12px;font-weight:700;letter-spacing:3px;color:#8b5cf6">RAVEN ORACLE</div><h1>You won a raffle 🎉</h1><p>You were selected as a winner for <strong>${escapeHtml(raffleTitle)}</strong>.</p><p>Prize: <strong>${escapeHtml(prizeName)}</strong></p><p><a href="${claimUrl}" style="display:inline-block;padding:12px 18px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:8px">Open winner center</a></p></div>`);
}
