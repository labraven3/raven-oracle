import crypto from "node:crypto";
import tls from "node:tls";
import { env } from "../config/env.js";

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: string) {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");
}

export function createEmailVerificationToken(userId: string, email: string) {
  const payload = base64url(JSON.stringify({ userId, email, exp: Date.now() + 30 * 60 * 1000, nonce: crypto.randomBytes(16).toString("hex") }));
  return `${payload}.${sign(payload)}`;
}

export function verifyEmailVerificationToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Invalid verification link");
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Invalid verification link");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId: string; email: string; exp: number };
  if (!data.userId || !data.email || !data.exp || data.exp < Date.now()) throw new Error("Verification link expired");
  return data;
}

function requireGmail() {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    throw new Error("Gmail delivery is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to the API environment.");
  }
}

async function readResponse(socket: tls.TLSSocket) {
  return await new Promise<string>((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const lines = buffer.split("\r\n");
      const last = lines[lines.length - 2] ?? "";
      if (/^\d{3} /.test(last)) {
        cleanup();
        resolve(buffer);
      }
    };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const cleanup = () => { socket.off("data", onData); socket.off("error", onError); };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function command(socket: tls.TLSSocket, value: string, expected: RegExp) {
  socket.write(`${value}\r\n`);
  const response = await readResponse(socket);
  if (!expected.test(response)) throw new Error(`Gmail SMTP error: ${response.trim()}`);
}

function escapeHeader(value: string) {
  return value.replace(/[\r\n]/g, " ");
}

export async function sendEmailVerification(email: string, verificationUrl: string) {
  requireGmail();
  const socket = tls.connect({ host: "smtp.gmail.com", port: 465, servername: "smtp.gmail.com" });
  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", () => resolve());
    socket.once("error", reject);
  });

  try {
    await readResponse(socket);
    await command(socket, `EHLO raven-oracle`, /^250[ -]/m);
    await command(socket, "AUTH LOGIN", /^334[ -]/m);
    await command(socket, Buffer.from(env.GMAIL_USER!, "utf8").toString("base64"), /^334[ -]/m);
    await command(socket, Buffer.from(env.GMAIL_APP_PASSWORD!.replace(/\s/g, ""), "utf8").toString("base64"), /^235[ -]/m);
    await command(socket, `MAIL FROM:<${env.GMAIL_USER}>`, /^250[ -]/m);
    await command(socket, `RCPT TO:<${email}>`, /^250[ -]/m);
    await command(socket, "DATA", /^354[ -]/m);

    const subject = "Verify your Raven Oracle email";
    const body = [
      `From: ${escapeHeader(env.EMAIL_FROM_NAME)} <${env.GMAIL_USER}>`,
      `To: ${escapeHeader(email)}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "",
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px">`,
      `<h1>Verify your Raven Oracle email</h1>`,
      `<p>Click the button below to verify your email and finish setting up your account.</p>`,
      `<p><a href="${verificationUrl}" style="display:inline-block;padding:12px 18px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:8px">Verify email</a></p>`,
      `<p style="color:#777">This link expires in 30 minutes.</p>`,
      `<p style="color:#777">If you did not request this, you can ignore this email.</p>`,
      `</div>`,
      ".",
    ].join("\r\n");

    await command(socket, body, /^250[ -]/m);
    await command(socket, "QUIT", /^221[ -]/m);
  } finally {
    socket.end();
  }
}
