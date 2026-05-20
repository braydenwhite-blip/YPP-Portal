"use server";

/**
 * Thin wrapper for sending email-verification flows to users created by
 * server actions (intake approvals, signup follow-ups, etc.). Uses the
 * existing `sendEmailVerificationEmail` template and asks Supabase Auth to
 * mint the link via its admin API. Idempotent — does nothing if the user is
 * already verified or has no email on file.
 */

import { prisma } from "@/lib/prisma";
import { sendEmailVerificationEmail, isEmailConfigured } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/portal-auth-utils";

export async function sendVerificationEmail(userId: string): Promise<void> {
  if (!userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerified: true },
  });

  if (!user || !user.email) return;
  if (user.emailVerified) return;
  if (!isEmailConfigured()) {
    // No transport configured — skip silently in dev/test environments.
    return;
  }

  let verifyUrl: string;
  try {
    const supabaseAdmin = createServiceClient();
    const baseUrl = await getBaseUrl();
    const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent("/verify-email?source=intake")}`;
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
      options: { redirectTo },
    });
    if (error) {
      console.error("[sendVerificationEmail] generateLink failed:", error.message);
      return;
    }
    // Admin-generated links cannot use PKCE — build our own callback URL with
    // `hashed_token` so the callback can verify via verifyOtp.
    const hashedToken = data?.properties?.hashed_token;
    verifyUrl = hashedToken
      ? `${redirectTo}&token_hash=${encodeURIComponent(hashedToken)}&type=magiclink`
      : (data?.properties?.action_link ?? "");
    if (!verifyUrl) {
      console.error("[sendVerificationEmail] generateLink returned no link");
      return;
    }
  } catch (e) {
    console.error("[sendVerificationEmail] supabase admin call failed:", e);
    return;
  }

  try {
    await sendEmailVerificationEmail({
      to: user.email,
      name: user.name ?? user.email,
      verifyUrl,
    });
  } catch (e) {
    console.error("[sendVerificationEmail] email send failed:", e);
  }
}
