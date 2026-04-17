import { createServerClient as _createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  getSupabasePublicEnv,
  SUPABASE_PUBLIC_ENV_MISSING_MESSAGE,
} from "@/lib/supabase/config";

export async function createServerClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(SUPABASE_PUBLIC_ENV_MISSING_MESSAGE);
  }

  const cookieStore = await cookies();

  return _createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>
        ) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options as any);
            }
          } catch {
            // setAll can fail when called from a Server Component.
            // This is safe to ignore if middleware refreshes the session.
          }
        },
      },
    }
  );
}

export async function createServerClientOrNull() {
  const env = getSupabasePublicEnv();
  if (!env) {
    return null;
  }

  const cookieStore = await cookies();

  return _createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }>
      ) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options as any);
          }
        } catch {
          // setAll can fail when called from a Server Component.
          // This is safe to ignore if middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Admin client using service role key.
 * Use only for server-side admin operations (user migration, etc.).
 * Never expose the service role key to the client.
 */
export function createServiceClient() {
  const env = getSupabasePublicEnv();
  if (!env || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error(
      "Supabase service client requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(
    env.url,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
