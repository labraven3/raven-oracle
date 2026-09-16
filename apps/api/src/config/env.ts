import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url("WEB_ORIGIN must be a valid URL").default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").optional(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  X_CLIENT_ID: z.string().min(1).optional(), X_CLIENT_SECRET: z.string().min(1).optional(), X_REDIRECT_URI: z.string().url().optional(),
  DISCORD_CLIENT_ID: z.string().min(1).optional(), DISCORD_CLIENT_SECRET: z.string().min(1).optional(), DISCORD_REDIRECT_URI: z.string().url().optional(),
  DISCORD_BOT_TOKEN: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(), GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(), GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().trim().min(1).optional(), GOOGLE_SHEETS_WORKSHEET_NAME: z.string().trim().min(1).max(80).default("Winners"),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(), TELEGRAM_BOT_USERNAME: z.string().min(1).optional(), TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  GMAIL_USER: z.string().email().optional(), GMAIL_APP_PASSWORD: z.string().min(1).optional(), EMAIL_FROM_NAME: z.string().min(1).default("Raven Oracle"),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error("❌ Invalid API environment configuration:");
  console.error(parsedEnv.error.issues.map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`).join("\n"));
  process.exit(1);
}

export const env = parsedEnv.data;

if (env.NODE_ENV === "production") {
  const productionErrors: string[] = [];
  if (!env.DATABASE_URL) productionErrors.push("  • DATABASE_URL is required in production");
  // A private PostgreSQL instance on the same VPS is a valid production setup.
  // Do not reject localhost/127.0.0.1: the API and database may intentionally
  // share the server and the database is not exposed by the web proxy.
  if (env.WEB_ORIGIN && !env.WEB_ORIGIN.startsWith("https://")) console.warn("⚠️ WEB_ORIGIN should use HTTPS in production");
  if (env.JWT_SECRET.length < 64) console.warn("⚠️ JWT_SECRET should be at least 64 characters in production");
  if (productionErrors.length) {
    console.error("❌ Production configuration errors:\n" + productionErrors.join("\n"));
    process.exit(1);
  }
}

console.log("✓ Environment configuration loaded:");
console.log(`  • NODE_ENV: ${env.NODE_ENV}`);
console.log(`  • PORT: ${env.PORT}`);
console.log(`  • WEB_ORIGIN: ${env.WEB_ORIGIN}`);
console.log(`  • DATABASE_URL: ${env.DATABASE_URL ? "configured" : "not configured"}`);
console.log(`  • JWT_SECRET: ${env.JWT_SECRET ? "configured" : "missing"}`);
console.log(`  • X OAuth: ${env.X_CLIENT_ID && env.X_CLIENT_SECRET ? "configured" : "not configured"}`);
console.log(`  • Discord OAuth: ${env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET ? "configured" : "not configured"}`);
console.log(`  • Discord Bot: ${env.DISCORD_BOT_TOKEN ? "configured" : "not configured"}`);
console.log(`  • Google Sheets OAuth: ${env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && env.GOOGLE_OAUTH_REDIRECT_URI ? "configured" : "not configured"}`);
console.log(`  • Google Sheets target: ${env.GOOGLE_SHEETS_SPREADSHEET_ID ? "configured spreadsheet" : "new spreadsheet per export"}`);
console.log(`  • Telegram Bot: ${env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME ? "configured" : "not configured"}`);
console.log(`  • Email: ${env.GMAIL_USER && env.GMAIL_APP_PASSWORD ? "configured" : "not configured"}`);
console.log("");
