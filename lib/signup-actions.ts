"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { RoleType } from "@prisma/client";

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

    if (password.length < 6) {
      return { status: "error", message: "Password must be at least 6 characters." };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { status: "error", message: "An account with this email already exists." };
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
      message: "Account created. Please sign in."
    };
  } catch (error) {
    return {
      status: "error",
      message: "Something went wrong. Please try again."
    };
  }
}
