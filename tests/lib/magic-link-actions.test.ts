import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isEmailConfigured, sendMagicLinkEmail } from "@/lib/email";
import { requestMagicLink } from "@/lib/magic-link-actions";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

vi.mock("@/lib/email", () => ({
  isEmailConfigured: vi.fn(),
  sendMagicLinkEmail: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

describe("magic-link-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockReturnValue(new Headers());
    vi.mocked(checkRateLimit).mockReturnValue({
      success: true,
      remaining: 4,
      reset: Date.now() + 60_000,
    } as any);
    vi.mocked(isEmailConfigured).mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the generic success message when the user does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const formData = new FormData();
    formData.set("email", "missing@example.com");
    formData.set("next", "/dashboard");

    await expect(
      requestMagicLink({ status: "idle", message: "" }, formData)
    ).resolves.toEqual({
      status: "success",
      message: "If an account exists with that email, you will receive a sign-in link shortly.",
    });

    expect(createServiceClient).not.toHaveBeenCalled();
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("generates a Supabase magic link and sends it with the app email helper", async () => {
    const generateLink = vi.fn().mockResolvedValue({
      data: {
        properties: {
          action_link: "https://example.supabase.co/auth/v1/verify?type=magiclink&token=abc",
        },
      },
      error: null,
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    } as any);
    vi.mocked(createServiceClient).mockReturnValue({
      auth: {
        admin: {
          generateLink,
        },
      },
    } as any);
    vi.mocked(sendMagicLinkEmail).mockResolvedValue({
      success: true,
      messageId: "message-1",
    });
    vi.mocked(headers).mockReturnValue(
      new Headers([
        ["x-forwarded-host", "youthpassionproject-portal.vercel.app"],
        ["x-forwarded-proto", "https"],
      ])
    );

    const formData = new FormData();
    formData.set("email", "TEST@example.com");
    formData.set("next", "/instructor");

    await expect(
      requestMagicLink({ status: "idle", message: "" }, formData)
    ).resolves.toEqual({
      status: "success",
      message: "If an account exists with that email, you will receive a sign-in link shortly.",
    });

    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "test@example.com",
      options: {
        redirectTo:
          "https://youthpassionproject-portal.vercel.app/auth/callback?next=%2Finstructor",
      },
    });
    expect(sendMagicLinkEmail).toHaveBeenCalledWith({
      to: "test@example.com",
      name: "Test User",
      magicUrl: "https://example.supabase.co/auth/v1/verify?type=magiclink&token=abc",
    });
  });

  it("returns an error when email is not configured", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(false);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await expect(
      requestMagicLink({ status: "idle", message: "" }, formData)
    ).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining("outbound email is not configured"),
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
