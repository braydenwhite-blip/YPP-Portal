import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bcryptMocks = vi.hoisted(() => ({
  compare: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: bcryptMocks.compare,
  },
}));

import { prisma } from "@/lib/prisma";
import { LEGACY_AUTH_BYPASS_EMAILS } from "@/lib/legacy-auth-config";
import { authenticateLegacyPassword } from "@/lib/legacy-auth-password";

describe("authenticateLegacyPassword", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.mocked(prisma.user.findUnique).mockReset();
    bcryptMocks.compare.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a local fallback session mode when Supabase public auth is missing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "e2e.instructor.blocked.alpha@ypp.test",
      passwordHash: "hashed-password",
    } as never);
    bcryptMocks.compare.mockResolvedValue(true);

    const result = await authenticateLegacyPassword({
      email: "e2e.instructor.blocked.alpha@ypp.test",
      password: "CodexE2E!2026",
    });

    expect(result).toEqual({
      success: true,
      userId: "user-1",
      email: "e2e.instructor.blocked.alpha@ypp.test",
      mode: "LOCAL_PASSWORD_FALLBACK",
    });
  });

  it("blocks non-bypass accounts when Supabase public auth is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    const result = await authenticateLegacyPassword({
      email: "e2e.instructor.blocked.alpha@ypp.test",
      password: "CodexE2E!2026",
    });

    expect(result).toEqual({
      success: false,
      error: "Legacy sign-in is not enabled for this account.",
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("keeps bypass accounts in BYPASS mode even when Supabase public auth is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-2",
      email: LEGACY_AUTH_BYPASS_EMAILS[0],
      passwordHash: "hashed-password",
    } as never);
    bcryptMocks.compare.mockResolvedValue(true);

    const result = await authenticateLegacyPassword({
      email: LEGACY_AUTH_BYPASS_EMAILS[0],
      password: "CodexE2E!2026",
    });

    expect(result).toEqual({
      success: true,
      userId: "user-2",
      email: LEGACY_AUTH_BYPASS_EMAILS[0],
      mode: "BYPASS",
    });
  });
});
