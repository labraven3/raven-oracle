import "dotenv/config";
import { z } from "zod";

/**
 * Environment Configuration Validation
 * 
 * SECURITY RULES:
 * - NEVER log secret values
 * - NEVER expose secrets in error messages
 * - Validate all required configuration at startup
 * - Fail fast with safe error messages
 * - Production requires stricter validation
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url("WEB_ORIGIN must be a valid URL").default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").optional(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),

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
  console.error("❌ Invalid API environment configuration:");
  
  // Format errors safely without exposing secret values
  const errors = parsedEnv.error.issues.map((issue) => {
    const field = issue.path.join(".");
    const message = issue.message;
    
    // Never log actual values of secrets
    const isSecret = field.includes("SECRET") || 
                     field.includes("PASSWORD") || 
                     field.includes("TOKEN") ||
                     field === "DATABASE_URL";
    
    if (isSecret) {
      return `  • ${field}: ${message} (value hidden for security)`;
    }
    
    return `  • ${field}: ${message}`;
  });
  
  console.error(errors.join("\n"));
  console.error("\n❌ Server startup aborted due to configuration errors.\n");
  process.exit(1);
}

export const env = parsedEnv.data;

// Additional production validation
if (env.NODE_ENV === "production") {
  const productionErrors: string[] = [];

  // DATABASE_URL is required in production
  if (!env.DATABASE_URL) {
    productionErrors.push("  • DATABASE_URL is required in production");
  }

  // Validate DATABASE_URL doesn't expose credentials in error logs
  if (env.DATABASE_URL && env.DATABASE_URL.includes("localhost")) {
    console.warn("⚠️  Warning: DATABASE_URL points to localhost in production mode");
  }

  // WEB_ORIGIN should be HTTPS in production
  if (env.WEB_ORIGIN && !env.WEB_ORIGIN.startsWith("https://")) {
    console.warn("⚠️  Warning: WEB_ORIGIN should use HTTPS in production");
  }

  // JWT_SECRET should be strong in production
  if (env.JWT_SECRET.length < 64) {
    console.warn("⚠️  Warning: JWT_SECRET should be at least 64 characters in production for enhanced security");
  }

  if (productionErrors.length > 0) {
    console.error("❌ Production configuration errors:");
    console.error(productionErrors.join("\n"));
    console.error("\n❌ Server startup aborted.\n");
    process.exit(1);
  }
}

// Log startup configuration (SAFE VALUES ONLY)
console.log("✓ Environment configuration loaded:");
console.log(`  • NODE_ENV: ${env.NODE_ENV}`);
console.log(`  • PORT: ${env.PORT}`);
console.log(`  • WEB_ORIGIN: ${env.WEB_ORIGIN}`);
console.log(`  • DATABASE_URL: ${env.DATABASE_URL ? "configured" : "not configured"}`);
console.log(`  • JWT_SECRET: ${env.JWT_SECRET ? "configured" : "missing"}`);
console.log(`  • X OAuth: ${env.X_CLIENT_ID && env.X_CLIENT_SECRET ? "configured" : "not configured"}`);
console.log(`  • Discord OAuth: ${env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET ? "configured" : "not configured"}`);
console.log(`  • Email: ${env.GMAIL_USER && env.GMAIL_APP_PASSWORD ? "configured" : "not configured"}`);
console.log("");
