import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Auth callback handler for OAuth redirects and email link confirmations.
 *
 * Supabase redirects here after:
 *  - Google OAuth sign-in
 *  - Magic link (OTP) click
 *  - Email confirmation click
 *  - Password reset link click
 *
 * The `code` query parameter is exchanged for a Supabase session.
 * If the user doesn't yet have a Prisma User record (new OAuth user),
 * one is created automatically.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[Auth Callback] Error exchanging code:", error?.message);
    return NextResponse.redirect(new URL("/login", origin));
  }

  const authUser = data.user;

  // Check if this Supabase user already has a linked Prisma user
  let prismaUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
    select: { id: true },
  });

  if (!prismaUser) {
    // Check if there's an existing Prisma user with the same email (e.g. pre-migration)
    prismaUser = await prisma.user.findUnique({
      where: { email: authUser.email! },
      select: { id: true, supabaseAuthId: true },
    });

    if (prismaUser && !(prismaUser as any).supabaseAuthId) {
      // Link existing Prisma user to this Supabase auth user
      await prisma.user.update({
        where: { id: prismaUser.id },
        data: { supabaseAuthId: authUser.id },
      });
    } else if (!prismaUser) {
      // Create a new Prisma user for this OAuth sign-in
      const name =
        authUser.user_metadata?.name ||
        authUser.user_metadata?.full_name ||
        authUser.email?.split("@")[0] ||
        "User";

      const primaryRole =
        (authUser.user_metadata?.primaryRole as string) || "STUDENT";

      prismaUser = await prisma.user.create({
        data: {
          name,
          email: authUser.email!,
          passwordHash: "", // OAuth user, no password
          primaryRole: primaryRole as any,
          supabaseAuthId: authUser.id,
          emailVerified: new Date(),
          image: authUser.user_metadata?.avatar_url || null,
          oauthProvider: authUser.app_metadata?.provider || "google",
          oauthId: authUser.user_metadata?.provider_id || authUser.id,
          roles: {
            create: [{ role: primaryRole as any }],
          },
        },
        select: { id: true },
      });
    }
  }

  // If the next URL is the reset-password page, redirect there
  // (Supabase sends password reset links through this callback too)
  if (next === "/reset-password" || next.startsWith("/reset-password")) {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
