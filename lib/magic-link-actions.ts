"use server";

import { isEmailConfigured, sendMagicLinkEmail } from "@/lib/email";
import { buildAuthRedirectUrl, sanitizeAuthNextPath } from "@/lib/portal-auth-utils";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

export type MagicLinkFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

const GENERIC_SUCCESS_MESSAGE =
  "If an account exists with that email, you will receive a sign-in link shortly.";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return value ? String(value).trim() : "";
}

export async function requestMagicLink(
  _prevState: MagicLinkFormState,
  formData: FormData
): Promise<MagicLinkFormState> {
  try {
    const email = getString(formData, "email").toLowerCase();
    const nextPath = sanitizeAuthNextPath(getString(formData, "next") || "/");

    if (!email) {
      return { status: "error", message: "Please enter your email address." };
    }

    if (!isEmailConfigured()) {
      return {
        status: "error",
        message:
          "Sign-in links cannot be sent because outbound email is not configured. Add RESEND_API_KEY or SMTP settings for this environment.",
      };
    }

    const rl = checkRateLimit(`magic-link:${email}`, 5, 15 * 60 * 1000);
    if (!rl.success) {
      return { status: "error", message: "Too many attempts. Please try again later." };
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return { status: "success", message: GENERIC_SUCCESS_MESSAGE };
    }

    const supabaseAdmin = createServiceClient();
    const redirectTo = buildAuthRedirectUrl(nextPath);

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    const magicUrl = data?.properties?.action_link;

    if (error || !magicUrl) {
      console.error(
        "[MagicLink] Failed to generate Supabase magic link:",
        error?.message || "No magic link returned."
      );
      return {
        status: "error",
        message:
          "We could not send a sign-in link right now. Please try again later or use password sign-in.",
      };
    }

    const emailResult = await sendMagicLinkEmail({
      to: user.email,
      name: user.name || "there",
      magicUrl,
    });

    if (!emailResult.success) {
      console.error(
        "[MagicLink] Failed to send sign-in email:",
        emailResult.error || "Unknown email delivery error."
      );
      return {
        status: "error",
        message:
          "We could not send a sign-in link right now. Check the email configuration or try password sign-in.",
      };
    }

    return { status: "success", message: GENERIC_SUCCESS_MESSAGE };
  } catch (error) {
    console.error("[MagicLink] Unexpected error:", error);
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY") || msg.includes("NEXT_PUBLIC_SUPABASE")) {
      return {
        status: "error",
        message:
          "Sign-in links are unavailable until Supabase server credentials (URL, anon key, and service role key) are configured.",
      };
    }
    return {
      status: "error",
      message: "We could not send a sign-in link right now. Please try again later.",
    };
  }
}
