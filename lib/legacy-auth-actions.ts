"use server";

import { clearLegacySession, establishLegacySession } from "@/lib/legacy-auth-server";
import { authenticateLegacyPassword } from "@/lib/legacy-auth-password";

export async function signInLegacyBypass(input: { email: string; password: string }) {
  const result = await authenticateLegacyPassword(input);
  if (!result.success) {
    return result;
  }

  await establishLegacySession({
    userId: result.userId,
    email: result.email,
    mode: result.mode,
  });
  return { success: true };
}

export async function signOutLegacyBypass() {
  await clearLegacySession();
  return { success: true };
}
