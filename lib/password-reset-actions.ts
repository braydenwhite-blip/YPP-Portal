"use server";

import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

export type PasswordResetFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

const GENERIC_SUCCESS_MESSAGE =
  "If an account exists with that email, a password reset link has been sent.";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return value ? String(value).trim() : "";
}

function getBaseUrl() {
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl) return nextAuthUrl.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}

export async function requestPasswordReset(
  prevState: PasswordResetFormState,
  formData: FormData
): Promise<PasswordResetFormState> {
  try {
    const email = getString(formData, "email").toLowerCase();

    if (!email) {
      return { status: "error", message: "Please enter your email address." };
    }

    const rl = checkRateLimit(`password-reset:${email}`, 5, 15 * 60 * 1000);
    if (!rl.success) {
      return { status: "error", message: "Too many attempts. Please try again later." };
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    // Keep the public response generic so the form does not reveal which emails exist.
    if (!user) {
      return { status: "success", message: GENERIC_SUCCESS_MESSAGE };
    }

    const supabaseAdmin = createServiceClient();
    const redirectTo = `${getBaseUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    const resetUrl = data?.properties?.action_link;

    if (error || !resetUrl) {
      console.error(
        "[PasswordReset] Failed to generate Supabase recovery link:",
        error?.message || "No recovery link returned."
      );
      return {
        status: "error",
        message: "We could not send a reset email right now. Please check the password reset configuration and try again.",
      };
    }

    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      name: user.name || "there",
      resetUrl,
    });

    if (!emailResult.success) {
      console.error(
        "[PasswordReset] Failed to send recovery email:",
        emailResult.error || "Unknown email delivery error."
      );
      return {
        status: "error",
        message: "We could not send a reset email right now. Please check the password reset configuration and try again.",
      };
    }

    return { status: "success", message: GENERIC_SUCCESS_MESSAGE };
  } catch (error) {
    console.error("[PasswordReset] Unexpected error:", error);
    return {
      status: "error",
      message: "We could not send a reset email right now. Please try again later.",
    };
  }
}
