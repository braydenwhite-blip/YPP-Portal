import { NextResponse, type NextRequest } from "next/server";
import { createServerClientOrNull } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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
  const next = searchParams.get("next") || "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const supabase = await createServerClientOrNull();
  if (!supabase) {
    return NextResponse.redirect(
      new URL("/login?error=supabase_unavailable", origin)
    );
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[Auth Callback] Error exchanging code:", error?.message);
    return NextResponse.redirect(new URL("/login", origin));
  }

  const authUser = data.user;
  if (authUser.user_metadata?.portalArchived === true) {
    return NextResponse.redirect(new URL("/login?error=account_archived", origin));
  }

  let prismaUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
    select: { id: true, archivedAt: true },
  });

  if (!prismaUser) {
    const byEmail = await prisma.user.findUnique({
      where: { email: authUser.email! },
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
      // No Prisma user — portal accounts are provisioned via signup flows, not
      // auto-created from email links. Send the visitor to signup.
      return NextResponse.redirect(new URL("/signup", origin));
    }
  }

  if (prismaUser?.archivedAt) {
    return NextResponse.redirect(new URL("/login?error=account_archived", origin));
  }

  if (next === "/reset-password" || next.startsWith("/reset-password")) {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
