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

export function canUseLocalPasswordFallback() {
  return process.env.NODE_ENV !== "production" && !hasSupabasePublicEnv();
}
