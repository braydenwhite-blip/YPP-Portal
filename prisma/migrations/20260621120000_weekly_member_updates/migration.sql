-- Migration: weekly_member_updates
-- Adds the per-person Weekly Impact form header (WeeklyMemberUpdate) that sits on
-- top of an existing WeeklyTeamBrief. One row per person per team-week holds the
-- person-level parts of the YPP Weekly Impact template — Section 1 (overall
-- objective + deliverable + target date) and Section 4 (input needed) — plus that
-- person's own submit state and carry-forward provenance. Purely additive: it
-- reuses the existing "WeeklyBriefStatus" enum and touches no existing table.

-- CreateTable: WeeklyMemberUpdate
CREATE TABLE IF NOT EXISTS "WeeklyMemberUpdate" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalObjective" TEXT,
    "personalDeliverable" TEXT,
    "targetDate" TIMESTAMP(3),
    "inputNeeded" TEXT,
    "inputNeededFrom" TEXT,
    "inputNeededBy" TIMESTAMP(3),
    "status" "WeeklyBriefStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "carriedForwardFromId" TEXT,
    "inputNeededCarried" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyMemberUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: WeeklyMemberUpdate
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyMemberUpdate_briefId_userId_key" ON "WeeklyMemberUpdate"("briefId", "userId");
CREATE INDEX IF NOT EXISTS "WeeklyMemberUpdate_briefId_idx" ON "WeeklyMemberUpdate"("briefId");
CREATE INDEX IF NOT EXISTS "WeeklyMemberUpdate_userId_idx" ON "WeeklyMemberUpdate"("userId");
CREATE INDEX IF NOT EXISTS "WeeklyMemberUpdate_status_idx" ON "WeeklyMemberUpdate"("status");

-- AddForeignKey: WeeklyMemberUpdate
DO $$ BEGIN
  ALTER TABLE "WeeklyMemberUpdate" ADD CONSTRAINT "WeeklyMemberUpdate_briefId_fkey"
    FOREIGN KEY ("briefId") REFERENCES "WeeklyTeamBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WeeklyMemberUpdate" ADD CONSTRAINT "WeeklyMemberUpdate_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WeeklyMemberUpdate" ADD CONSTRAINT "WeeklyMemberUpdate_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
