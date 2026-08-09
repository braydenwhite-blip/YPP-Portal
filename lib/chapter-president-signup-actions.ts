"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/server";
import { RoleType } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { canUseLocalPasswordFallback } from "@/lib/supabase/config";
import { establishLegacySession } from "@/lib/legacy-auth-server";

type FormState = {
  status: "idle" | "error" | "success";
  message: string;
};

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

/**
 * Minimal account-creation action for Chapter President candidates.
 * Unlike signUp() in signup-actions.ts, this does NOT create an
 * InstructorApplication or any application record — it only creates the
 * account. The candidate is then routed to /chapter/apply, which owns the
 * actual CP application form + submission.
 *
 * In local dev (no Supabase configured), this bypasses Supabase entirely
 * and creates the account + session the same way the legacy/local-password
 * login path does — matching the pattern in lib/legacy-auth-password.ts.
 * In production (Supabase configured), it uses the real Supabase Admin API,
 * same as signUp() in signup-actions.ts.
 */
export async function signUpChapterPresidentCandidate(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const name = getString(formData, "name");
    const email = getString(formData, "email").toLowerCase();
    const password = getString(formData, "password");

    const rl = checkRateLimit(`cp-signup:email:${email}`, 5, 15 * 60 * 1000);
    if (!rl.success) {
      return { status: "error", message: "Too many attempts. Please try again later." };
    }

    if (password.length < 8) {
      return { status: "error", message: "Password must be at least 8 characters." };
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { status: "error", message: "Password must contain at least one letter and one number." };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { status: "error", message: "ACCOUNT_EXISTS_SIGNIN_REQUIRED" };
    }

    // --- Local dev path: no Supabase, bcrypt + legacy session cookie ---
    if (canUseLocalPasswordFallback()) {
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          primaryRole: RoleType.APPLICANT,
          emailVerified: new Date(),
          roles: { create: [{ role: RoleType.APPLICANT }] },
        },
      });

      await establishLegacySession({
        userId: user.id,
        email: user.email,
        mode: "LOCAL_PASSWORD_FALLBACK",
        primaryRole: user.primaryRole,
        roles: [RoleType.APPLICANT],
      });

      return { status: "success", message: "ACCOUNT_CREATED_LOCAL" };
    }

    // --- Production path: real Supabase Admin API ---
    const supabaseAdmin = createServiceClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, primaryRole: RoleType.APPLICANT },
    });

    if (authError || !authData.user?.id) {
      console.error("[CPSignup] Supabase user creation failed:", authError ?? "no user ID returned");
      return { status: "error", message: "Something went wrong creating your account. Please try again." };
    }

    try {
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name,
          passwordHash: "",
          primaryRole: RoleType.APPLICANT,
          emailVerified: new Date(),
          supabaseAuthId: authData.user.id,
        },
        create: {
          name,
          email,
          passwordHash: "",
          primaryRole: RoleType.APPLICANT,
          emailVerified: new Date(),
          supabaseAuthId: authData.user.id,
          roles: { create: [{ role: RoleType.APPLICANT }] },
        },
      });

      await prisma.userRole.upsert({
        where: { userId_role: { userId: user.id, role: RoleType.APPLICANT } },
        update: {},
        create: { userId: user.id, role: RoleType.APPLICANT },
      });
    } catch (portalErr) {
      console.error("[CPSignup] Portal user upsert failed — rolling back Supabase user", portalErr);
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (rollbackErr) {
        console.error("[CPSignup] Supabase rollback also failed:", rollbackErr);
      }
      return { status: "error", message: "Something went wrong creating your account. Please try again." };
    }

    return { status: "success", message: "ACCOUNT_CREATED" };
  } catch (error) {
    console.error("[CPSignup] Unexpected signup error:", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}