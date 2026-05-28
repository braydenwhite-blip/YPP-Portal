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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/";

  if (!tokenHash) {
    return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
  }

  const supabase = await createServerClientOrNull();
  if (!supabase) {
    return NextResponse.redirect(
      new URL("/login?error=supabase_unavailable", origin)
    );
  }

  const type =
    typeParam && VALID_OTP_TYPES.has(typeParam) ? typeParam : "magiclink";
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error || !data.user) {
    console.error("[Auth Callback] verifyOtp failed:", error?.message);
    return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
  }

  const authUser = data.user;
  if (authUser.user_metadata?.portalArchived === true) {
    return NextResponse.redirect(new URL("/login?error=account_archived", origin));
  }

  let prismaUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
    select: { id: true, archivedAt: true },
  });

  if (!prismaUser && authUser.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: authUser.email },
      select: { id: true, supabaseAuthId: true, archivedAt: true },
    });

    if (byEmail?.archivedAt) {
      return NextResponse.redirect(new URL("/login?error=account_archived", origin));
    }

    if (byEmail && !byEmail.supabaseAuthId) {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { supabaseAuthId: authUser.id },
      });
      prismaUser = { id: byEmail.id, archivedAt: byEmail.archivedAt };
    } else if (!byEmail) {
      return NextResponse.redirect(new URL("/signup", origin));
    }
  }

  if (prismaUser?.archivedAt) {
    return NextResponse.redirect(new URL("/login?error=account_archived", origin));
  }

  if (prismaUser?.id) {
    await prisma.user
      .updateMany({
        where: { id: prismaUser.id, emailVerified: null },
        data: { emailVerified: new Date() },
      })
      .catch((e) => {
        console.error("[Auth Callback] Failed to stamp emailVerified:", e);
      });
  }

  if (next.startsWith("/reset-password")) {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
