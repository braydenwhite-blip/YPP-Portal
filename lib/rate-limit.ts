/**
 * Simple in-memory rate limiter for server actions and API routes.
 * For production at scale, replace with Redis-based solution (e.g. @upstash/ratelimit).
 */

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries periodically (every 60 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (e.g. IP address, user ID).
 * @param key - Unique identifier for the rate limit bucket
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60 seconds)
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
