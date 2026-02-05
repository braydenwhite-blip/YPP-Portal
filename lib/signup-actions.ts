"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { RoleType } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";

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

export async function signUp(prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    const name = getString(formData, "name");
    const email = getString(formData, "email").toLowerCase();
    const password = getString(formData, "password");
    const phone = getString(formData, "phone", false);
    const chapterId = getString(formData, "chapterId", false);

    // Rate limit: 5 signup attempts per email per 15 minutes
    const rl = checkRateLimit(`signup:${email}`, 5, 15 * 60 * 1000);
    if (!rl.success) {
      return { status: "error", message: "Too many attempts. Please try again later." };
    }

    // M1: Stronger password policy (8+ chars, at least one number and one letter)
    if (password.length < 8) {
      return { status: "error", message: "Password must be at least 8 characters." };
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { status: "error", message: "Password must contain at least one letter and one number." };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // M2: Generic message to prevent user enumeration
      return {
        status: "success",
        message: "If this email is not already registered, your account has been created. Please check your email or try signing in."
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash,
        primaryRole: RoleType.STUDENT,
        chapterId: chapterId || null,
        roles: {
          create: [{ role: RoleType.STUDENT }]
        }
      }
    });

    return {
      status: "success",
      message: "If this email is not already registered, your account has been created. Please check your email or try signing in."
    };
  } catch (error) {
    return {
      status: "error",
      message: "Something went wrong. Please try again."
    };
  }
}
