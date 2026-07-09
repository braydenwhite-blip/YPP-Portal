export const SUPABASE_PUBLIC_ENV_MISSING_MESSAGE =
  "Supabase public auth is not configured in this environment yet.";

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function hasSupabasePublicEnv() {
  return getSupabasePublicEnv() !== null;
}

/**
 * Dev-only Prisma password sign-in when Supabase public auth is absent or
 * explicitly skipped (`LOCAL_PASSWORD_FALLBACK=true`).
 */
export function canUseLocalPasswordFallback() {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.LOCAL_PASSWORD_FALLBACK === "true") return true;
  if (process.env.LOCAL_PASSWORD_FALLBACK === "false") return false;
  return !hasSupabasePublicEnv();
}
