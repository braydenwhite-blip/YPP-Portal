-- Create the Bronx chapter and make Esther Mopono its full Chapter President.
--
-- "Full CP" means three things, all handled here:
--   1. A Supabase Auth account for her.
--   2. A portal "User" row with primaryRole = CHAPTER_PRESIDENT, a
--      CHAPTER_PRESIDENT "UserRole" grant, chapterId pointing at Bronx, and
--      the org-authority spine (title/internalLevel/ladder) set to match.
--   3. Chapter.presidentId on Bronx pointing back at her — this is the field
--      that makes her *the* president of record, not just someone who holds
--      the role.
--
-- Run once in the Supabase SQL editor (or via psql against DATABASE_URL).
-- Esther's temp password is generated at runtime and only surfaced via
-- RAISE NOTICE — it is never stored in this file. Have her reset it via
-- "forgot password" on first login.

create extension if not exists pgcrypto;

do $$
declare
  bronx_chapter_id text := gen_random_uuid()::text;
  esther_auth_id   uuid := gen_random_uuid();
  esther_user_id   text := gen_random_uuid()::text;
  esther_password  text := encode(gen_random_bytes(18), 'base64');
  esther_hash      text := crypt(esther_password, gen_salt('bf'));
begin
  -- 1. The Bronx chapter (skip if it already exists).
  select id into bronx_chapter_id from "Chapter" where name = 'Bronx';
  if bronx_chapter_id is null then
    bronx_chapter_id := gen_random_uuid()::text;
    insert into "Chapter" (id, name, city, region, "createdAt", "updatedAt")
    values (bronx_chapter_id, 'Bronx', 'Bronx', 'Northeast', now(), now());
  end if;

  -- 2. Esther's Supabase Auth account.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', esther_auth_id, 'authenticated', 'authenticated',
    'esthermopono247@gmail.com', esther_hash, now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), esther_auth_id,
    jsonb_build_object('sub', esther_auth_id::text, 'email', 'esthermopono247@gmail.com', 'email_verified', true),
    'email', esther_auth_id::text, now(), now(), now()
  );

  -- 3. Esther's portal "User" row — full Chapter President.
  insert into "User" (
    id, name, email, "passwordHash", "primaryRole", title,
    "canonicalTitle", "internalLevel", ladder, "chapterId",
    "emailVerified", supabase_auth_id, "createdAt", "updatedAt"
  ) values (
    esther_user_id, 'Esther Mopono', 'esthermopono247@gmail.com', esther_hash,
    'CHAPTER_PRESIDENT', 'Chapter President', 'Chapter President', 4, 'INSTRUCTION',
    bronx_chapter_id, now(), esther_auth_id::text, now(), now()
  );

  insert into "UserRole" ("userId", role) values (esther_user_id, 'CHAPTER_PRESIDENT');

  -- 4. Point the Bronx chapter's presidentId back at her.
  update "Chapter" set "presidentId" = esther_user_id, "updatedAt" = now() where id = bronx_chapter_id;

  raise notice 'Created Bronx chapter (id: %)', bronx_chapter_id;
  raise notice 'Created Esther Mopono as Chapter President (temp password: %)', esther_password;
end $$;
