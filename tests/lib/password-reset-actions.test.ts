import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendPasswordResetEmail } from "@/lib/email";
import { requestPasswordReset } from "@/lib/password-reset-actions";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

describe("password-reset-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockReturnValue(new Headers());
    vi.mocked(checkRateLimit).mockReturnValue({
      success: true,
      remaining: 4,
      reset: Date.now() + 60_000,
    } as any);
  });

  it("returns the generic success message when the user does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const formData = new FormData();
    formData.set("email", "missing@example.com");

    await expect(
      requestPasswordReset({ status: "idle", message: "" }, formData)
    ).resolves.toEqual({
      status: "success",
      message: "If an account exists with that email, a password reset link has been sent.",
    });

    expect(createServiceClient).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("generates a Supabase recovery link and sends it with the app email helper", async () => {
    const generateLink = vi.fn().mockResolvedValue({
      data: {
        properties: {
          action_link: "https://example.supabase.co/auth/v1/verify?token=abc",
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
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({
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

    await expect(
      requestPasswordReset({ status: "idle", message: "" }, formData)
    ).resolves.toEqual({
      status: "success",
      message: "If an account exists with that email, a password reset link has been sent.",
    });

    expect(generateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "test@example.com",
      options: {
        redirectTo:
          "https://youthpassionproject-portal.vercel.app/auth/callback?next=%2Freset-password",
      },
    });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({
      to: "test@example.com",
      name: "Test User",
      resetUrl: "https://example.supabase.co/auth/v1/verify?token=abc",
    });
  });

  it("returns a controlled error when the app email helper cannot send the message", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    } as any);
    vi.mocked(createServiceClient).mockReturnValue({
      auth: {
        admin: {
          generateLink: vi.fn().mockResolvedValue({
            data: {
              properties: {
                action_link: "https://example.supabase.co/auth/v1/verify?token=abc",
              },
            },
            error: null,
          }),
        },
      },
    } as any);
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({
      success: false,
      error: "Invalid from field",
    });

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await expect(
      requestPasswordReset({ status: "idle", message: "" }, formData)
    ).resolves.toEqual({
      status: "error",
      message:
        "We could not send a reset email right now. Please check the password reset configuration and try again.",
    });

    consoleErrorSpy.mockRestore();
  });
});
