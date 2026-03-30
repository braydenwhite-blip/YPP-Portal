-- Add supabase_auth_id column to User table for Supabase Auth integration
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supabase_auth_id" TEXT;

-- Create unique index on supabase_auth_id
CREATE UNIQUE INDEX IF NOT EXISTS "User_supabase_auth_id_key" ON "User"("supabase_auth_id");
