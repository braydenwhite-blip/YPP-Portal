"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isLegacyAuthBypassEmail } from "@/lib/legacy-auth-config";
import { clearLegacySession, establishLegacySession } from "@/lib/legacy-auth-server";

export async function signInLegacyBypass(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();

  if (!isLegacyAuthBypassEmail(email)) {
    return { success: false, error: "Legacy sign-in is not enabled for this account." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
    },
  });

  if (!user?.passwordHash) {
    return { success: false, error: "Invalid email or password." };
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    return { success: false, error: "Invalid email or password." };
  }

  await establishLegacySession({ userId: user.id, email: user.email });
  return { success: true };
}

export async function signOutLegacyBypass() {
  await clearLegacySession();
  return { success: true };
}
