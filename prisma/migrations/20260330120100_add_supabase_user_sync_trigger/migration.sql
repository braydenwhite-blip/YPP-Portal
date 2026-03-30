-- Auto-create a Prisma "User" row when a new Supabase auth user signs up.
-- This handles users who sign up directly through Supabase Auth (e.g. OAuth)
-- without going through the app's server-side signup flow.
--
-- NOTE: This trigger only fires for users created directly in auth.users
-- (e.g. via Supabase OAuth). The app's signup actions create both the
-- auth user and Prisma user in a single server action, so the trigger
-- acts as a safety net, not the primary path.

CREATE OR REPLACE FUNCTION public.handle_new_supabase_user()
RETURNS trigger AS $$
BEGIN
  -- Only create if no User row exists for this supabase auth id
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE supabase_auth_id = NEW.id::text) THEN
    -- Also skip if a User row already exists with the same email
    IF NOT EXISTS (SELECT 1 FROM public."User" WHERE email = NEW.email) THEN
      INSERT INTO public."User" (
        id,
        email,
        name,
        "passwordHash",
        supabase_auth_id,
        "primaryRole",
        "emailVerified",
        "oauthProvider",
        "createdAt",
        "updatedAt"
      ) VALUES (
        -- Generate a cuid-like id (26 chars alphanumeric)
        'sb_' || substr(md5(random()::text || clock_timestamp()::text), 1, 23),
        NEW.email,
        COALESCE(
          NEW.raw_user_meta_data->>'name',
          NEW.raw_user_meta_data->>'full_name',
          split_part(NEW.email, '@', 1)
        ),
        '', -- No password hash for OAuth users
        NEW.id::text,
        COALESCE(NEW.raw_user_meta_data->>'primaryRole', 'STUDENT'),
        CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN NOW() ELSE NULL END,
        COALESCE(NEW.raw_app_meta_data->>'provider', 'google'),
        NOW(),
        NOW()
      );

      -- Also create the UserRole entry
      INSERT INTO public."UserRole" ("userId", "role")
      SELECT u.id, COALESCE(NEW.raw_user_meta_data->>'primaryRole', 'STUDENT')::"RoleType"
      FROM public."User" u
      WHERE u.supabase_auth_id = NEW.id::text;
    ELSE
      -- Email already exists, just link the supabase auth id
      UPDATE public."User"
      SET supabase_auth_id = NEW.id::text,
          "updatedAt" = NOW()
      WHERE email = NEW.email
        AND supabase_auth_id IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger (drop first if it already exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_supabase_user();
