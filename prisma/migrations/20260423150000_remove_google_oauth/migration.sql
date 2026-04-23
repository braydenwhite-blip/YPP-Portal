-- Drop Google OAuth support.
--
-- Supabase now handles all auth (email + password, magic links, password
-- reset, 2FA). The NextAuth-style OAuth adapter tables and the user-level
-- oauthProvider/oauthId/image columns are no longer referenced by any code
-- path. emailVerified is retained — native signup flows still set it.

-- Drop the User OAuth index if present.
DROP INDEX IF EXISTS "User_oauthProvider_oauthId_idx";

-- Drop OAuth columns on User.
ALTER TABLE "User" DROP COLUMN IF EXISTS "oauthProvider";
ALTER TABLE "User" DROP COLUMN IF EXISTS "oauthId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "image";

-- Drop the Supabase user-sync triggers that referenced oauthProvider, if they
-- still exist from earlier migrations. A later migration (below) will need to
-- be added to rebuild the sync trigger without oauthProvider if the project
-- still relies on auto-syncing Supabase auth users into Prisma. For now we
-- simply drop them so the trigger doesn't reference a non-existent column.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_supabase_user();

-- Drop NextAuth adapter tables (no runtime code uses these anymore).
DROP TABLE IF EXISTS "OAuthSession";
DROP TABLE IF EXISTS "OAuthAccount";
DROP TABLE IF EXISTS "VerificationToken";
