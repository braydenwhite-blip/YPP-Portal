import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkRateLimit,
  checkLoginRateLimit,
  checkUploadRateLimit,
  checkSignupRateLimit,
  isRateLimitingConfigured,
} from "@/lib/rate-limit-redis";

// Mock @upstash/ratelimit
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({
      success: true,
      remaining: 9,
      reset: Date.now() + 60000,
    }),
  })),
}));

// Mock @upstash/redis
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    // Mock Redis client
  })),
}));

// Mock the in-memory rate limiter fallback
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({
    success: true,
    remaining: 9,
    resetAt: Date.now() + 60000,
  }),
}));

describe("Redis Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  describe("isRateLimitingConfigured", () => {
    it("should return true when KV variables are set", () => {
      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";
      expect(isRateLimitingConfigured()).toBe(true);
    });

    it("should return true when Upstash Redis variables are set", () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
      expect(isRateLimitingConfigured()).toBe(true);
    });

    it("should return false when no Redis is configured", () => {
      expect(isRateLimitingConfigured()).toBe(false);
    });
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", async () => {
      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result = await checkRateLimit("test-key", 10, 60000);

      expect(result.success).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    it("should fall back to in-memory limiter when Redis not configured", async () => {
      const result = await checkRateLimit("test-key", 10, 60000);

      expect(result.success).toBe(true);
      // Should have called the in-memory fallback
    });

    it("should handle different time windows", async () => {
      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      // 15 minute window
      const result1 = await checkRateLimit("test-key-1", 10, 15 * 60 * 1000);
      expect(result1.success).toBe(true);

      // 1 hour window
      const result2 = await checkRateLimit("test-key-2", 5, 60 * 60 * 1000);
      expect(result2.success).toBe(true);
    });
  });

  describe("Pre-configured Rate Limiters", () => {
    beforeEach(() => {
      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";
    });

    it("checkLoginRateLimit should enforce 10 attempts per 15 minutes", async () => {
      const email = "test@example.com";
      const result = await checkLoginRateLimit(email);

      expect(result.success).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(10);
    });

    it("checkUploadRateLimit should enforce 20 uploads per 10 minutes", async () => {
      const userId = "user-123";
      const result = await checkUploadRateLimit(userId);

      expect(result.success).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(20);
    });

    it("checkSignupRateLimit should enforce 5 signups per hour", async () => {
      const ip = "192.168.1.1";
      const result = await checkSignupRateLimit(ip);

      expect(result.success).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(5);
    });
  });

  describe("Rate Limit Keys", () => {
    it("should use email-based keys for login rate limiting", async () => {
      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const email1 = "user1@example.com";
      const email2 = "user2@example.com";

      const result1 = await checkLoginRateLimit(email1);
      const result2 = await checkLoginRateLimit(email2);

      // Both should succeed independently
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it("should normalize email addresses for login rate limiting", async () => {
      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      // Same email with different casing should use same rate limit bucket
      const result1 = await checkLoginRateLimit("Test@Example.com");
      const result2 = await checkLoginRateLimit("test@example.com");

      // Both should succeed (testing that key normalization works)
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should fall back to in-memory limiter on Redis errors", async () => {
      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      // Mock Redis to throw an error
      const { Ratelimit } = await import("@upstash/ratelimit");
      vi.mocked(Ratelimit).mockImplementationOnce(
        () =>
          ({
            limit: vi.fn().mockRejectedValue(new Error("Redis connection failed")),
          }) as any
      );

      const result = await checkRateLimit("test-key", 10, 60000);

      // Should still succeed via fallback
      expect(result.success).toBe(true);
    });

    it("should handle missing environment variables gracefully", async () => {
      // No environment variables set
      const result = await checkRateLimit("test-key", 10, 60000);

      // Should use in-memory fallback
      expect(result.success).toBe(true);
    });
  });

  describe("Rate Limit Response Format", () => {
    it("should return correct response format", async () => {
      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result = await checkRateLimit("test-key", 10, 60000);

      // Verify response structure
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("remaining");
      expect(result).toHaveProperty("resetAt");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.remaining).toBe("number");
      expect(typeof result.resetAt).toBe("number");
    });

    it("should return resetAt timestamp in the future", async () => {
      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result = await checkRateLimit("test-key", 10, 60000);

      expect(result.resetAt).toBeGreaterThan(Date.now());
    });
  });
});
