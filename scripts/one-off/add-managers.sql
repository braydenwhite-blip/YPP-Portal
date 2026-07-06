-- Add two new Managers (Jackson Faber, Jennifer Chen) as STAFF users with
-- internalLevel 4 on the LEADERSHIP ladder.
--
-- Run this once in the Supabase SQL editor (or via psql against DATABASE_URL).
-- It creates both the Supabase Auth account (auth.users + auth.identities)
-- and the matching portal "User" / "UserRole" rows in one transaction.
--
-- Each account gets a random one-time password (printed via RAISE NOTICE when
-- the block runs, never stored in this file). Have each person reset their
-- password via "forgot password" on first login instead of relying on it.

create extension if not exists pgcrypto;

do $$
declare
  jackson_auth_id  uuid := gen_random_uuid();
  jennifer_auth_id uuid := gen_random_uuid();
  jackson_user_id  text := gen_random_uuid()::text;
  jennifer_user_id text := gen_random_uuid()::text;
  jackson_password text := encode(gen_random_bytes(18), 'base64');
  jennifer_password text := encode(gen_random_bytes(18), 'base64');
  jackson_hash text := crypt(jackson_password, gen_salt('bf'));
  jennifer_hash text := crypt(jennifer_password, gen_salt('bf'));
begin
  -- 1. Supabase Auth accounts
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', jackson_auth_id, 'authenticated', 'authenticated',
     'jackson.faber@youthpassionproject.org', jackson_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', jennifer_auth_id, 'authenticated', 'authenticated',
     'jennifer.chen@youthpassionproject.org', jennifer_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '');

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values
    (gen_random_uuid(), jackson_auth_id,
     jsonb_build_object('sub', jackson_auth_id::text, 'email', 'jackson.faber@youthpassionproject.org', 'email_verified', true),
     'email', jackson_auth_id::text, now(), now(), now()),
    (gen_random_uuid(), jennifer_auth_id,
     jsonb_build_object('sub', jennifer_auth_id::text, 'email', 'jennifer.chen@youthpassionproject.org', 'email_verified', true),
     'email', jennifer_auth_id::text, now(), now(), now());

  -- 2. Portal "User" rows (public schema, Prisma-managed table)
  insert into "User" (
    id, name, email, "passwordHash", "primaryRole", title,
    "internalLevel", ladder, "emailVerified", "supabaseAuthId"
  ) values
    (jackson_user_id, 'Jackson Faber', 'jackson.faber@youthpassionproject.org', jackson_hash,
     'STAFF', 'Manager', 4, 'LEADERSHIP', now(), jackson_auth_id::text),
    (jennifer_user_id, 'Jennifer Chen', 'jennifer.chen@youthpassionproject.org', jennifer_hash,
     'STAFF', 'Manager', 4, 'LEADERSHIP', now(), jennifer_auth_id::text);

  -- 3. Role grants
  insert into "UserRole" ("userId", role) values
    (jackson_user_id, 'STAFF'),
    (jennifer_user_id, 'STAFF');

  raise notice 'Created Jackson Faber (temp password: %)', jackson_password;
  raise notice 'Created Jennifer Chen (temp password: %)', jennifer_password;
end $$;
