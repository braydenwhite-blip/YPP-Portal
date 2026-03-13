import { describe, it, expect, vi, beforeEach } from "vitest";

const upstashLimitMock = vi.fn();
const upstashSlidingWindowMock = vi.fn((limit: number, window: string) => ({ limit, window }));
const redisConstructorMock = vi.fn(function Redis(this: object) {
  return { kind: "redis-client" };
});
const ratelimitConstructorMock = vi.fn(function Ratelimit(this: object) {
  return { limit: upstashLimitMock };
}) as unknown as {
  (...args: unknown[]): unknown;
  slidingWindow: typeof upstashSlidingWindowMock;
};

ratelimitConstructorMock.slidingWindow = upstashSlidingWindowMock;

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: ratelimitConstructorMock,
}));

vi.mock("@upstash/redis", () => ({
  Redis: redisConstructorMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

async function loadRateLimitRedis() {
  return await import("@/lib/rate-limit-redis");
}

describe("Redis Rate Limiting", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    upstashLimitMock.mockResolvedValue({
      success: true,
      remaining: 9,
      reset: Date.now() + 60_000,
    });

    const inMemoryRateLimit = await import("@/lib/rate-limit");
    vi.mocked(inMemoryRateLimit.checkRateLimit).mockReturnValue({
      success: true,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });

    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  describe("isRateLimitingConfigured", () => {
    it("should return true when KV variables are set", async () => {
      const { isRateLimitingConfigured } = await loadRateLimitRedis();

      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      expect(isRateLimitingConfigured()).toBe(true);
    });

    it("should return true when Upstash Redis variables are set", async () => {
      const { isRateLimitingConfigured } = await loadRateLimitRedis();

      process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

      expect(isRateLimitingConfigured()).toBe(true);
    });

    it("should return false when no Redis is configured", async () => {
      const { isRateLimitingConfigured } = await loadRateLimitRedis();

      expect(isRateLimitingConfigured()).toBe(false);
    });
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", async () => {
      const { checkRateLimit } = await loadRateLimitRedis();

      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result = await checkRateLimit("test-key", 10, 60_000);

      expect(result.success).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.resetAt).toBeGreaterThan(Date.now());
      expect(redisConstructorMock).toHaveBeenCalledTimes(1);
      expect(upstashSlidingWindowMock).toHaveBeenCalledWith(10, "60 s");
      expect(upstashLimitMock).toHaveBeenCalledWith("test-key");
    });

    it("should fall back to in-memory limiter when Redis not configured", async () => {
      const { checkRateLimit } = await loadRateLimitRedis();
      const inMemoryRateLimit = await import("@/lib/rate-limit");

      const result = await checkRateLimit("test-key", 10, 60_000);

      expect(result.success).toBe(true);
      expect(inMemoryRateLimit.checkRateLimit).toHaveBeenCalledWith("test-key", 10, 60_000);
    });

    it("should handle different time windows", async () => {
      const { checkRateLimit } = await loadRateLimitRedis();

      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result1 = await checkRateLimit("test-key-1", 10, 15 * 60 * 1000);
      const result2 = await checkRateLimit("test-key-2", 5, 60 * 60 * 1000);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(upstashSlidingWindowMock).toHaveBeenCalledWith(10, "900 s");
      expect(upstashSlidingWindowMock).toHaveBeenCalledWith(5, "3600 s");
    });
  });

  describe("Pre-configured Rate Limiters", () => {
    it("checkLoginRateLimit should enforce 10 attempts per 15 minutes", async () => {
      const { checkLoginRateLimit } = await loadRateLimitRedis();

      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result = await checkLoginRateLimit("test@example.com");

      expect(result.success).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(10);
      expect(upstashLimitMock).toHaveBeenCalledWith("login:test@example.com");
    });

    it("checkUploadRateLimit should enforce 20 uploads per 10 minutes", async () => {
      const { checkUploadRateLimit } = await loadRateLimitRedis();

      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result = await checkUploadRateLimit("user-123");

      expect(result.success).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(20);
      expect(upstashLimitMock).toHaveBeenCalledWith("upload:user-123");
    });

    it("checkSignupRateLimit should enforce 5 signups per hour", async () => {
      const { checkSignupRateLimit } = await loadRateLimitRedis();

      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result = await checkSignupRateLimit("192.168.1.1");

      expect(result.success).toBe(true);
      expect(upstashLimitMock).toHaveBeenCalledWith("signup:192.168.1.1");
      expect(upstashSlidingWindowMock).toHaveBeenCalledWith(5, "3600 s");
    });
  });

  describe("Rate Limit Keys", () => {
    it("should use email-based keys for login rate limiting", async () => {
      const { checkLoginRateLimit } = await loadRateLimitRedis();

      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result1 = await checkLoginRateLimit("user1@example.com");
      const result2 = await checkLoginRateLimit("user2@example.com");

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(upstashLimitMock).toHaveBeenNthCalledWith(1, "login:user1@example.com");
      expect(upstashLimitMock).toHaveBeenNthCalledWith(2, "login:user2@example.com");
    });

    it("should normalize email addresses for login rate limiting", async () => {
      const { checkLoginRateLimit } = await loadRateLimitRedis();

      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result1 = await checkLoginRateLimit("Test@Example.com");
      const result2 = await checkLoginRateLimit("test@example.com");

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(upstashLimitMock).toHaveBeenNthCalledWith(1, "login:test@example.com");
      expect(upstashLimitMock).toHaveBeenNthCalledWith(2, "login:test@example.com");
    });
  });

  describe("Error Handling", () => {
    it("should fall back to in-memory limiter on Redis errors", async () => {
      const { checkRateLimit } = await loadRateLimitRedis();
      const inMemoryRateLimit = await import("@/lib/rate-limit");

      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      upstashLimitMock.mockRejectedValueOnce(new Error("Redis connection failed"));

      const result = await checkRateLimit("test-key", 10, 60_000);

      expect(result.success).toBe(true);
      expect(inMemoryRateLimit.checkRateLimit).toHaveBeenCalledWith("test-key", 10, 60_000);
    });

    it("should handle missing environment variables gracefully", async () => {
      const { checkRateLimit } = await loadRateLimitRedis();
      const inMemoryRateLimit = await import("@/lib/rate-limit");

      const result = await checkRateLimit("test-key", 10, 60_000);

      expect(result.success).toBe(true);
      expect(inMemoryRateLimit.checkRateLimit).toHaveBeenCalledWith("test-key", 10, 60_000);
    });
  });

  describe("Rate Limit Response Format", () => {
    it("should return correct response format", async () => {
      const { checkRateLimit } = await loadRateLimitRedis();

      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result = await checkRateLimit("test-key", 10, 60_000);

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("remaining");
      expect(result).toHaveProperty("resetAt");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.remaining).toBe("number");
      expect(typeof result.resetAt).toBe("number");
    });

    it("should return resetAt timestamp in the future", async () => {
      const { checkRateLimit } = await loadRateLimitRedis();

      process.env.KV_REST_API_URL = "https://test.upstash.io";
      process.env.KV_REST_API_TOKEN = "test-token";

      const result = await checkRateLimit("test-key", 10, 60_000);

      expect(result.resetAt).toBeGreaterThan(Date.now());
    });
  });
});
