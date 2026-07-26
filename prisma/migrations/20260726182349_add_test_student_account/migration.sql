-- Create a test student account for development and testing purposes.
-- Email: test.student@ypp.test
-- Password: password123 (bcrypt hash below)
-- This migration is idempotent and safe to re-run.

DO $$
DECLARE
  v_user_id text;
BEGIN
  -- Check if the test student already exists
  SELECT id INTO v_user_id FROM public."User" WHERE email = 'test.student@ypp.test';

  -- If user doesn't exist, create it
  IF v_user_id IS NULL THEN
    INSERT INTO public."User" (
      id,
      name,
      email,
      phone,
      "passwordHash",
      "primaryRole",
      "createdAt",
      "updatedAt"
    ) VALUES (
      'cuid_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20),
      'Test Student',
      'test.student@ypp.test',
      '+1-555-0100',
      '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86AGR0Hs1RW',
      'STUDENT'::public."RoleType",
      NOW(),
      NOW()
    ) RETURNING id INTO v_user_id;

    -- Add the STUDENT role entry
    INSERT INTO public."UserRole" ("userId", "role")
    VALUES (v_user_id, 'STUDENT'::public."RoleType");

    RAISE NOTICE 'Created test student account with ID: %', v_user_id;
  ELSE
    RAISE NOTICE 'Test student account already exists with ID: %', v_user_id;
  END IF;
END $$;
