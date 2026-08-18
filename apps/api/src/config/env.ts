import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32),

  // X OAuth - optional, only required when X OAuth routes are used
  X_CLIENT_ID: z.string().min(1).optional(),
  X_CLIENT_SECRET: z.string().min(1).optional(),
  X_REDIRECT_URI: z.string().url().optional(),

  // Discord OAuth - optional, only required when Discord OAuth routes are used
  DISCORD_CLIENT_ID: z.string().min(1).optional(),
  DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
  DISCORD_REDIRECT_URI: z.string().url().optional(),

  GMAIL_USER: z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().min(1).optional(),
  EMAIL_FROM_NAME: z.string().min(1).default("Raven Oracle"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid API environment configuration:");
  console.error(z.treeifyError(parsedEnv.error));
  process.exit(1);
}

export const env = parsedEnv.data;
