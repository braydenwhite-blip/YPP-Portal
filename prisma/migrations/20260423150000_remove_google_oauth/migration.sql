-- Drop Google OAuth support.
--
-- Supabase now handles all auth (email + password, magic links, password
-- reset, 2FA). The NextAuth-style OAuth adapter tables and the user-level
-- oauthProvider/oauthId/image columns are no longer referenced by any code
-- path. emailVerified is retained — native signup flows still set it.
--
-- NOTE: The Supabase user-sync trigger (handle_new_supabase_user / on_auth_user_created)
-- lived in the auth schema and referenced oauthProvider. Supabase restricts
-- DDL on auth.* to the service-role, so the trigger must be dropped via the
-- Supabase Dashboard → SQL Editor (once, manually):
--
--   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--   DROP FUNCTION IF EXISTS public.handle_new_supabase_user();
--
-- The trigger skipped email-provider signups, so removing Google OAuth from
-- the Supabase dashboard means it will never fire again regardless.

-- Give the session-pooler connection enough time for DDL.
SET statement_timeout = 0;
SET lock_timeout = '30s';

-- Drop the User OAuth index.
DROP INDEX IF EXISTS "User_oauthProvider_oauthId_idx";

-- Drop OAuth columns on User.
ALTER TABLE "User" DROP COLUMN IF EXISTS "oauthProvider";
ALTER TABLE "User" DROP COLUMN IF EXISTS "oauthId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "image";

-- Drop NextAuth adapter tables (no runtime code uses these anymore).
DROP TABLE IF EXISTS "OAuthSession";
DROP TABLE IF EXISTS "OAuthAccount";
DROP TABLE IF EXISTS "VerificationToken";
