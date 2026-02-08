"use server";

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, isEmailConfigured } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const TOKEN_EXPIRY_HOURS = 1;
const MIN_PASSWORD_LENGTH = 8;

export interface ActionResult {
  status: "idle" | "success" | "error";
  message: string;
}

/**
 * Request a password reset email
 * Always returns success message to prevent user enumeration
 */
export async function requestPasswordReset(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get("email");

  if (!email || typeof email !== "string") {
    return { status: "error", message: "Email is required." };
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Rate limit: 3 reset requests per email per hour
  const rateLimit = checkRateLimit(`password-reset:${normalizedEmail}`, 3, 60 * 60 * 1000);
  if (!rateLimit.success) {
    return { status: "error", message: "Too many reset requests. Please try again later." };
  }

  // Generic success message (prevents user enumeration)
  const successMessage = "If an account exists with this email, you will receive a password reset link shortly.";

  // Check if email service is configured
  if (!isEmailConfigured()) {
    console.warn("[Password Reset] Email service not configured");
    return { status: "success", message: successMessage };
  }

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true }
    });

    // If user doesn't exist, return success anyway (prevents enumeration)
    if (!user) {
      return { status: "success", message: successMessage };
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null
      },
      data: {
        usedAt: new Date() // Mark as used/invalidated
      }
    });

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store token in database
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt
      }
    });

    // Build reset URL
    const rawBaseUrl =
      (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.trim()) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const baseUrl = rawBaseUrl.replace(/\/$/, "");
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    // Send email
    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl
    });

    if (!emailResult.success) {
      console.error("[Password Reset] Failed to send email:", emailResult.error);
      // Still return success to prevent enumeration
    }

    return { status: "success", message: successMessage };
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    // Return success to prevent enumeration
    return { status: "success", message: successMessage };
  }
}

/**
 * Validate a password reset token
 */
export async function validateResetToken(token: string): Promise<{
  valid: boolean;
  email?: string;
  error?: string;
}> {
  if (!token) {
    return { valid: false, error: "Invalid reset link." };
  }

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: {
          select: { email: true }
        }
      }
    });

    if (!resetToken) {
      return { valid: false, error: "Invalid or expired reset link." };
    }

    if (resetToken.usedAt) {
      return { valid: false, error: "This reset link has already been used." };
    }

    if (resetToken.expiresAt < new Date()) {
      return { valid: false, error: "This reset link has expired. Please request a new one." };
    }

    return { valid: true, email: resetToken.user.email };
  } catch (error) {
    console.error("[Password Reset] Token validation error:", error);
    return { valid: false, error: "An error occurred. Please try again." };
  }
}

/**
 * Reset password with valid token
 */
export async function resetPassword(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const token = formData.get("token");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (!token || typeof token !== "string") {
    return { status: "error", message: "Invalid reset link." };
  }

  if (!password || typeof password !== "string") {
    return { status: "error", message: "Password is required." };
  }

  if (password !== confirmPassword) {
    return { status: "error", message: "Passwords do not match." };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { status: "error", message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { status: "error", message: "Password must contain at least one letter and one number." };
  }

  try {
    // Validate token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!resetToken) {
      return { status: "error", message: "Invalid or expired reset link." };
    }

    if (resetToken.usedAt) {
      return { status: "error", message: "This reset link has already been used." };
    }

    if (resetToken.expiresAt < new Date()) {
      return { status: "error", message: "This reset link has expired. Please request a new one." };
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user password and mark token as used (atomic transaction)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      })
    ]);

    return { status: "success", message: "Your password has been reset successfully. You can now sign in." };
  } catch (error) {
    console.error("[Password Reset] Reset error:", error);
    return { status: "error", message: "An error occurred. Please try again." };
  }
}
