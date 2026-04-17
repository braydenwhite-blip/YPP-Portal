-- Fix the Supabase auth sync trigger so it casts primaryRole text metadata
-- into the RoleType enum before inserting into public."User".
-- Without this cast, auth user creation fails with:
--   column "primaryRole" is of type "RoleType" but expression is of type text

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
        'sb_' || substr(md5(random()::text || clock_timestamp()::text), 1, 23),
        NEW.email,
        COALESCE(
          NEW.raw_user_meta_data->>'name',
          NEW.raw_user_meta_data->>'full_name',
          split_part(NEW.email, '@', 1)
        ),
        '',
        NEW.id::text,
        COALESCE(NEW.raw_user_meta_data->>'primaryRole', 'STUDENT')::"RoleType",
        CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN NOW() ELSE NULL END,
        COALESCE(NULLIF(NEW.raw_app_meta_data->>'provider', ''), 'email'),
        NOW(),
        NOW()
      );

      INSERT INTO public."UserRole" ("userId", "role")
      SELECT u.id, COALESCE(NEW.raw_user_meta_data->>'primaryRole', 'STUDENT')::"RoleType"
      FROM public."User" u
      WHERE u.supabase_auth_id = NEW.id::text;
    ELSE
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
