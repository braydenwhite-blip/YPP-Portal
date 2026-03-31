"use server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@supabase/supabase-js";

export type PasswordResetFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

const GENERIC_SUCCESS_MESSAGE =
  "If an account exists with that email, a password reset link has been sent.";

function createSupabaseAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

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

    const supabaseAuth = createSupabaseAuthClient();
    const redirectTo = `${getBaseUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("[PasswordReset] Failed to trigger Supabase recovery email:", error.message);
      return {
        status: "error",
        message: "We could not send a reset email right now. Please check the Supabase email settings and try again.",
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
