import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClientOrNull } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const VALID_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/**
 * Auth callback handler for Supabase email-link redirects.
 *
 * Supabase redirects here after:
 *  - Magic link (OTP) click
 *  - Email confirmation click
 *  - Password reset link click
 *
 * The `code` query parameter is exchanged for a Supabase session. Every user
 * arriving here is expected to have a pre-existing Prisma record — magic links
 * and password resets only go to already-registered users.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const next = searchParams.get("next") || "/";

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL("/login?error=missing_token", origin));
  }

  const supabase = await createServerClientOrNull();
  if (!supabase) {
    return NextResponse.redirect(
      new URL("/login?error=supabase_unavailable", origin)
    );
  }

  let authUserId: string | null = null;
  let authUserEmail: string | null = null;
  let authUserMetadata: Record<string, unknown> | undefined;

  if (tokenHash) {
    const type = (typeParam && VALID_OTP_TYPES.has(typeParam as EmailOtpType)
      ? (typeParam as EmailOtpType)
      : "magiclink") as EmailOtpType;
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error || !data.user) {
      console.error("[Auth Callback] verifyOtp failed:", error?.message);
      return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
    }
    authUserId = data.user.id;
    authUserEmail = data.user.email ?? null;
    authUserMetadata = data.user.user_metadata;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error("[Auth Callback] Error exchanging code:", error?.message);
      return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
    }
    authUserId = data.user.id;
    authUserEmail = data.user.email ?? null;
    authUserMetadata = data.user.user_metadata;
  }

  if (!authUserId) {
    return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
  }

  if ((authUserMetadata as { portalArchived?: boolean } | undefined)?.portalArchived === true) {
    return NextResponse.redirect(new URL("/login?error=account_archived", origin));
  }

  let prismaUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUserId },
    select: { id: true, archivedAt: true },
  });

  if (!prismaUser && authUserEmail) {
    const byEmail = await prisma.user.findUnique({
      where: { email: authUserEmail },
      select: { id: true, supabaseAuthId: true, archivedAt: true },
    });

    if (byEmail?.archivedAt) {
      return NextResponse.redirect(new URL("/login?error=account_archived", origin));
    }

    if (byEmail && !byEmail.supabaseAuthId) {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { supabaseAuthId: authUserId },
      });
      prismaUser = { id: byEmail.id, archivedAt: byEmail.archivedAt };
    } else if (!byEmail) {
      // No Prisma user — portal accounts are provisioned via signup flows, not
      // auto-created from email links. Send the visitor to signup.
      return NextResponse.redirect(new URL("/signup", origin));
    }
  }

  if (prismaUser?.archivedAt) {
    return NextResponse.redirect(new URL("/login?error=account_archived", origin));
  }

  // Stamp emailVerified for verification flows when the Prisma record hasn't
  // been marked verified yet. verifyOtp success means Supabase confirmed the
  // address belongs to this user.
  if (prismaUser?.id && tokenHash) {
    await prisma.user
      .updateMany({
        where: { id: prismaUser.id, emailVerified: null },
        data: { emailVerified: new Date() },
      })
      .catch((e) => {
        console.error("[Auth Callback] Failed to stamp emailVerified:", e);
      });
  }

  if (next === "/reset-password" || next.startsWith("/reset-password")) {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
