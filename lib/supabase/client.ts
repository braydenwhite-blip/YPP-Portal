import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";
import {
  getSupabasePublicEnv,
  SUPABASE_PUBLIC_ENV_MISSING_MESSAGE,
} from "@/lib/supabase/config";

export function createBrowserClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(SUPABASE_PUBLIC_ENV_MISSING_MESSAGE);
  }

  return _createBrowserClient(
    env.url,
    env.anonKey
  );
}

export function createBrowserClientOrNull() {
  const env = getSupabasePublicEnv();
  if (!env) {
    return null;
  }

  return _createBrowserClient(env.url, env.anonKey);
}
