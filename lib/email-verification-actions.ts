"use server";

import { prisma } from "@/lib/prisma";
import { sendEmailVerificationEmail, isEmailConfigured } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

const TOKEN_EXPIRY_HOURS = 24;

function getBaseUrl() {
  const raw =
    (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.trim()) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return raw.replace(/\/$/, "");
}

// ------------------------------------
// Send (or re-send) a verification email to the given userId.
// Called internally by signUp and by resendVerificationEmail.
// ------------------------------------
export async function sendVerificationEmail(
  userId: string
): Promise<{ status: "success" | "error"; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerified: true },
  });

  if (!user) return { status: "error", message: "User not found." };

  if (user.emailVerified) {
    return { status: "success", message: "Email is already verified." };
  }

  const rateLimit = checkRateLimit(`email-verify:${user.email}`, 3, 60 * 60 * 1000);
  if (!rateLimit.success) {
    return {
      status: "error",
      message: "Too many verification emails sent. Please wait an hour and try again.",
    };
  }

  // Invalidate any existing unused tokens
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { token, userId, expiresAt },
  });

  const verifyUrl = `${getBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;

  if (!isEmailConfigured()) {
    console.warn("[EmailVerification] Email not configured — verification link:", verifyUrl);
    return { status: "success", message: "Verification email sent." };
  }

  const emailResult = await sendEmailVerificationEmail({
    to: user.email,
    name: user.name,
    verifyUrl,
  });

  if (!emailResult.success) {
    console.error("[EmailVerification] Failed to send email:", emailResult.error);
  }

  return { status: "success", message: "Verification email sent." };
}

// ------------------------------------
// Validate a token from the /verify-email?token= link.
// ------------------------------------
export async function verifyEmailToken(
  token: string
): Promise<{ status: "success" | "error"; message: string }> {
  if (!token) {
    return { status: "error", message: "No verification token provided." };
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, emailVerified: true } } },
  });

  if (!record) {
    return { status: "error", message: "Invalid or expired verification link." };
  }

  if (record.usedAt) {
    return {
      status: "error",
      message: "This verification link has already been used. Please request a new one.",
    };
  }

  if (record.expiresAt < new Date()) {
    return {
      status: "error",
      message: "This verification link has expired. Please request a new one.",
    };
  }

  if (record.user.emailVerified) {
    return { status: "success", message: "Your email is already verified. You can sign in." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return {
    status: "success",
    message: "Email verified successfully! You can now sign in.",
  };
}

// ------------------------------------
// Request a magic login link (password-free sign-in).
// useFormState-compatible. Enumeration-safe.
// ------------------------------------
export async function requestMagicLink(
  _prevState: { status: string; message: string } | null,
  formData: FormData
): Promise<{ status: "success" | "error"; message: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { status: "error", message: "Please enter your email address." };
  }

  const rateLimit = checkRateLimit(`magic-link:${email}`, 3, 60 * 60 * 1000);
  if (!rateLimit.success) {
    return {
      status: "error",
      message: "Too many requests. Please wait an hour before requesting another link.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  // Always return success to prevent enumeration
  if (!user) {
    return {
      status: "success",
      message: "If that email is registered, we've sent a magic sign-in link.",
    };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await prisma.emailVerificationToken.create({
    data: { token, userId: user.id, expiresAt },
  });

  const magicUrl = `${getBaseUrl()}/magic-link?token=${encodeURIComponent(token)}`;

  if (!isEmailConfigured()) {
    console.warn("[MagicLink] Email not configured — magic link:", magicUrl);
    return {
      status: "success",
      message: "If that email is registered, we've sent a magic sign-in link.",
    };
  }

  const { sendMagicLinkEmail } = await import("@/lib/email");
  await sendMagicLinkEmail({ to: user.email, name: user.name, magicUrl });

  return {
    status: "success",
    message: "If that email is registered, we've sent a magic sign-in link.",
  };
}

// ------------------------------------
// useFormState-compatible resend action.
// Used on both the signup confirmation screen and the login page.
// ------------------------------------
export async function resendVerificationEmail(
  _prevState: { status: string; message: string } | null,
  formData: FormData
): Promise<{ status: "success" | "error"; message: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { status: "error", message: "Please enter your email address." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  // Return generic success to prevent enumeration — caller can't tell if user exists
  if (!user) {
    return {
      status: "success",
      message: "If that email is registered and unverified, we've sent a new link.",
    };
  }

  if (user.emailVerified) {
    return {
      status: "success",
      message: "This email is already verified. You can sign in.",
    };
  }

  await sendVerificationEmail(user.id);

  return {
    status: "success",
    message: "Verification email sent! Check your inbox.",
  };
}
