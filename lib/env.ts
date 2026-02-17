import { z } from "zod";

/**
 * Environment variable validation
 *
 * This file validates all required and optional environment variables
 * at application startup to catch configuration errors early.
 *
 * Usage:
 *   import { env } from "@/lib/env";
 *   const dbUrl = env.DATABASE_URL;
 */

// Define the schema for environment variables
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Database (Required)
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid database connection URL"),
  DIRECT_URL: z.string().url("DIRECT_URL must be a valid database connection URL"),

  // NextAuth (Required)
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters for security"),
  NEXTAUTH_URL: z
    .string()
    .url("NEXTAUTH_URL must be a valid URL")
    .optional()
    .or(z.literal("")),

  // File Storage (Optional - but required for production)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  STORAGE_PROVIDER: z.enum(["auto", "local", "blob"]).default("auto"),

  // Rate Limiting (Optional - but recommended for production)
  KV_REST_API_URL: z.string().url().optional().or(z.literal("")),
  KV_REST_API_TOKEN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Email (Optional)
  EMAIL_PROVIDER: z.enum(["auto", "smtp", "resend"]).default("auto"),
  EMAIL_FROM: z.string().email().optional().or(z.literal("")),

  // Resend
  RESEND_API_KEY: z.string().optional(),

  // SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().regex(/^\d+$/).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.string().optional(),

  // Vercel (Auto-set in Vercel deployments)
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  VERCEL_URL: z.string().optional(),
});

/**
 * Validate environment variables and provide helpful error messages
 */
function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error(
      "Environment validation failed. Check your .env file and ensure all required variables are set."
    );
  }

  // Production-specific warnings
  if (result.data.NODE_ENV === "production" || result.data.VERCEL_ENV === "production") {
    const warnings: string[] = [];

    // Warn about missing cloud storage
    if (!result.data.BLOB_READ_WRITE_TOKEN) {
      warnings.push(
        "⚠️  BLOB_READ_WRITE_TOKEN not set. File uploads will fail in production (ephemeral filesystem)."
      );
    }

    // Warn about missing rate limiting
    const hasRedis =
      (result.data.KV_REST_API_URL && result.data.KV_REST_API_TOKEN) ||
      (result.data.UPSTASH_REDIS_REST_URL && result.data.UPSTASH_REDIS_REST_TOKEN);

    if (!hasRedis) {
      warnings.push(
        "⚠️  Redis not configured. Rate limiting will use in-memory storage (won't work across serverless instances)."
      );
    }

    // Warn about missing email
    const hasEmail =
      result.data.RESEND_API_KEY ||
      (result.data.SMTP_HOST && result.data.SMTP_PORT && result.data.SMTP_USER && result.data.SMTP_PASS);

    if (!hasEmail) {
      warnings.push(
        "⚠️  Email not configured. Password resets and notifications will not work."
      );
    }

    // Print warnings
    if (warnings.length > 0) {
      console.warn("\n" + "=".repeat(70));
      console.warn("  PRODUCTION CONFIGURATION WARNINGS");
      console.warn("=".repeat(70));
      warnings.forEach((warning) => console.warn(warning));
      console.warn("=".repeat(70) + "\n");
    }
  }

  return result.data;
}

// Export validated environment variables
export const env = validateEnv();

/**
 * Helper functions to check feature availability
 */

export function isCloudStorageConfigured(): boolean {
  return !!(env.BLOB_READ_WRITE_TOKEN || env.STORAGE_PROVIDER === "local");
}

export function isRedisConfigured(): boolean {
  return !!(
    (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) ||
    (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
  );
}

export function isEmailConfigured(): boolean {
  return !!(
    env.RESEND_API_KEY ||
    (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS)
  );
}

export function isProduction(): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export function isVercelDeployment(): boolean {
  return env.VERCEL === "1";
}
