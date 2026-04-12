import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { LegacySessionMode } from "@/lib/legacy-auth";
import { isLegacyAuthBypassEmail } from "@/lib/legacy-auth-config";
import { canUseLocalPasswordFallback } from "@/lib/supabase/config";

type LegacyPasswordAuthResult =
  | {
      success: true;
      userId: string;
      email: string;
      mode: LegacySessionMode;
    }
  | {
      success: false;
      error: string;
    };

export async function authenticateLegacyPassword(
  input: { email: string; password: string }
): Promise<LegacyPasswordAuthResult> {
  const email = input.email.trim().toLowerCase();
  const localPasswordFallbackEnabled = canUseLocalPasswordFallback();
  const legacyBypassEnabled = isLegacyAuthBypassEmail(email);

  if (!legacyBypassEnabled && !localPasswordFallbackEnabled) {
    return {
      success: false,
      error: "Legacy sign-in is not enabled for this account.",
    };
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

  return {
    success: true,
    userId: user.id,
    email: user.email,
    mode:
      legacyBypassEnabled || !localPasswordFallbackEnabled
        ? "BYPASS"
        : "LOCAL_PASSWORD_FALLBACK",
  };
}
