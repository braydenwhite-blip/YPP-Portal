import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { checkRateLimit as checkInMemory } from "./rate-limit";

/**
 * Production-grade rate limiting using Upstash Redis (Vercel KV)
 *
 * In production (Vercel), this uses Redis for distributed rate limiting.
 * In development, falls back to in-memory rate limiting.
 *
 * Environment variables (auto-set by Vercel when you add Upstash Redis):
 * - KV_REST_API_URL or UPSTASH_REDIS_REST_URL
 * - KV_REST_API_TOKEN or UPSTASH_REDIS_REST_TOKEN
 */

let redis: Redis | null = null;
let rateLimiters: Map<string, Ratelimit> = new Map();

/**
 * Check if Redis is configured
 */
function isRedisConfigured(): boolean {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  return !!(url && token);
}

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }

  if (!redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    redis = new Redis({
      url: url!,
      token: token!
    });
  }

  return redis;
}

/**
 * Get or create rate limiter for a specific limit config
 */
function getRateLimiter(limit: number, windowMs: number): Ratelimit | null {
  const redisClient = getRedisClient();
  if (!redisClient) {
    return null;
  }

  const key = `${limit}:${windowMs}`;
  if (rateLimiters.has(key)) {
    return rateLimiters.get(key)!;
  }

  // Convert milliseconds to seconds for Upstash
  const windowSeconds = Math.floor(windowMs / 1000);

  const limiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: true, // Enable analytics in Upstash dashboard
    prefix: "ratelimit" // Namespace for Redis keys
  });

  rateLimiters.set(key, limiter);
  return limiter;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit using Redis (production) or in-memory (development)
 *
 * @param key - Unique identifier for the rate limit bucket (e.g., `login:user@example.com`)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit result
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  const limiter = getRateLimiter(limit, windowMs);

  // Fallback to in-memory if Redis not configured
  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[RateLimit] Redis not configured in production - using in-memory rate limiting. " +
        "This will not work correctly with multiple serverless instances. " +
        "Add Upstash Redis integration in Vercel dashboard."
      );
    }

    // Use synchronous in-memory limiter
    return checkInMemory(key, limit, windowMs);
  }

  try {
    const result = await limiter.limit(key);

    return {
      success: result.success,
      remaining: result.remaining,
      resetAt: result.reset
    };
  } catch (error) {
    console.error("[RateLimit] Redis error, falling back to in-memory:", error);

    // Graceful fallback to in-memory if Redis fails
    return checkInMemory(key, limit, windowMs);
  }
}

/**
 * Rate limiters for common operations
 */

/**
 * Login rate limiter: 10 attempts per 15 minutes per email
 */
export async function checkLoginRateLimit(email: string): Promise<RateLimitResult> {
  return checkRateLimit(`login:${email.toLowerCase()}`, 10, 15 * 60 * 1000);
}

/**
 * Upload rate limiter: 20 uploads per 10 minutes per user
 */
export async function checkUploadRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(`upload:${userId}`, 20, 10 * 60 * 1000);
}

/**
 * API rate limiter: 100 requests per minute per IP
 */
export async function checkApiRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(`api:${ip}`, 100, 60 * 1000);
}

/**
 * Signup rate limiter: 5 signups per hour per IP
 */
export async function checkSignupRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
}

/**
 * Password reset rate limiter: 3 requests per hour per email
 */
export async function checkPasswordResetRateLimit(email: string): Promise<RateLimitResult> {
  return checkRateLimit(`password-reset:${email.toLowerCase()}`, 3, 60 * 60 * 1000);
}

/**
 * Check if Redis rate limiting is available
 */
export function isRateLimitingConfigured(): boolean {
  return isRedisConfigured();
}
