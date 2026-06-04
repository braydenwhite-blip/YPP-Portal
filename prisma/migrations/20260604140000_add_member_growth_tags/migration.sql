-- Migration: add_member_growth_tags
-- People Strategy — Growth Signals (Phase 8).
-- Human-curated growth tags on a member, feeding the Responsibility Map and the
-- People Risk Radar. Written idempotently to match the repo's convention.

-- CreateEnum: GrowthTag (guarded; CREATE TYPE has no IF NOT EXISTS).
DO $$ BEGIN
  CREATE TYPE "GrowthTag" AS ENUM (
    'READY_FOR_MORE',
    'NEEDS_TRAINING',
    'RELIABLE_EXECUTOR',
    'STRONG_COMMUNICATOR',
    'POTENTIAL_TEAM_LEAD',
    'AT_RISK_OF_DISENGAGING'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MemberGrowthTag" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "tag"         "GrowthTag" NOT NULL,
  "note"        TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberGrowthTag_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "MemberGrowthTag_userId_tag_key" ON "MemberGrowthTag"("userId", "tag");
CREATE INDEX IF NOT EXISTS "MemberGrowthTag_userId_idx" ON "MemberGrowthTag"("userId");
CREATE INDEX IF NOT EXISTS "MemberGrowthTag_tag_idx" ON "MemberGrowthTag"("tag");
CREATE INDEX IF NOT EXISTS "MemberGrowthTag_createdById_idx" ON "MemberGrowthTag"("createdById");

-- Foreign keys (guarded so re-running the migration is safe).
DO $$ BEGIN
  ALTER TABLE "MemberGrowthTag"
    ADD CONSTRAINT "MemberGrowthTag_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MemberGrowthTag"
    ADD CONSTRAINT "MemberGrowthTag_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
