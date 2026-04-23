-- Drop Google OAuth support — safe / online-compatible subset.
--
-- Supabase now handles all auth (email + password, magic links, password
-- reset, 2FA). The NextAuth-style OAuth adapter tables below are unused
-- by runtime code and can be dropped without user impact.
--
-- What this migration does:
--   1. Drops OAuthAccount, OAuthSession, VerificationToken. These tables
--      have no active writers (Google OAuth disabled in Supabase, NextAuth
--      retired to 410), so ACCESS EXCLUSIVE locks acquire instantly.
--
-- What this migration DOES NOT do (intentionally):
--   - Does NOT run `ALTER TABLE "User" DROP COLUMN` for oauthProvider /
--     oauthId / image. DROP COLUMN requires ACCESS EXCLUSIVE on User,
--     which cannot be acquired under live traffic and causes deploys to
--     fail with SQLSTATE 55P03 (lock_timeout). These columns are harmless
--     dead columns once removed from prisma/schema.prisma — Prisma Client
--     never references them. Drop them manually during a quiet window:
--
--       ALTER TABLE "User" DROP COLUMN IF EXISTS "oauthProvider";
--       ALTER TABLE "User" DROP COLUMN IF EXISTS "oauthId";
--       ALTER TABLE "User" DROP COLUMN IF EXISTS "image";
--       DROP INDEX IF EXISTS "User_oauthProvider_oauthId_idx";
--
--   - Does NOT drop the Supabase user-sync trigger (lives in auth.*,
--     requires service-role). Run these manually from the Supabase
--     Dashboard SQL Editor:
--
--       DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--       DROP FUNCTION IF EXISTS public.handle_new_supabase_user();
--
--     The trigger already skips email-provider signups, so with Google
--     OAuth disabled in Supabase it will never fire.

-- Give the session-pooler connection enough slack for DDL and bound
-- lock waits so a stuck lock fails fast instead of timing the whole
-- build out at the pooler level.
SET statement_timeout = 0;
SET lock_timeout = '2min';

-- Drop NextAuth adapter tables. No active writers → locks acquire fast.
DROP TABLE IF EXISTS "OAuthSession";
DROP TABLE IF EXISTS "OAuthAccount";
DROP TABLE IF EXISTS "VerificationToken";
