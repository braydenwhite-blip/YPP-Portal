-- Migration: weekly_impact_repeatable_rows
-- Makes the Weekly Impact form table-based with unlimited add/remove rows.
-- Section 1 (Objective & Deliverables), Section 3 (Next Steps), and Section 4
-- (Input Needed) each get their own child table hanging off WeeklyMemberUpdate.
-- Section 2 (This Week's Progress) keeps using WeeklyTaskUpdate; this migration
-- lets a person author ad-hoc progress rows on it (no tracked ActionItem) via
-- "memberUpdateId" + a single inline "adhocLink" field. Purely additive.

-- WeeklyTaskUpdate: ad-hoc Section 2 row support
ALTER TABLE "WeeklyTaskUpdate" ADD COLUMN IF NOT EXISTS "memberUpdateId" TEXT;
ALTER TABLE "WeeklyTaskUpdate" ADD COLUMN IF NOT EXISTS "adhocLinkLabel" TEXT;
ALTER TABLE "WeeklyTaskUpdate" ADD COLUMN IF NOT EXISTS "adhocLinkUrl" TEXT;

CREATE INDEX IF NOT EXISTS "WeeklyTaskUpdate_memberUpdateId_idx" ON "WeeklyTaskUpdate"("memberUpdateId");

DO $$ BEGIN
  ALTER TABLE "WeeklyTaskUpdate" ADD CONSTRAINT "WeeklyTaskUpdate_memberUpdateId_fkey"
    FOREIGN KEY ("memberUpdateId") REFERENCES "WeeklyMemberUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: WeeklyImpactObjective (Section 1)
CREATE TABLE IF NOT EXISTS "WeeklyImpactObjective" (
    "id" TEXT NOT NULL,
    "memberUpdateId" TEXT NOT NULL,
    "objective" TEXT,
    "deliverable" TEXT,
    "targetDate" TIMESTAMP(3),
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyImpactObjective_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WeeklyImpactObjective_memberUpdateId_idx" ON "WeeklyImpactObjective"("memberUpdateId");

DO $$ BEGIN
  ALTER TABLE "WeeklyImpactObjective" ADD CONSTRAINT "WeeklyImpactObjective_memberUpdateId_fkey"
    FOREIGN KEY ("memberUpdateId") REFERENCES "WeeklyMemberUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: WeeklyImpactNextStep (Section 3)
CREATE TABLE IF NOT EXISTS "WeeklyImpactNextStep" (
    "id" TEXT NOT NULL,
    "memberUpdateId" TEXT NOT NULL,
    "action" TEXT,
    "deliverableNextWeek" TEXT,
    "dueDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyImpactNextStep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WeeklyImpactNextStep_memberUpdateId_idx" ON "WeeklyImpactNextStep"("memberUpdateId");

DO $$ BEGIN
  ALTER TABLE "WeeklyImpactNextStep" ADD CONSTRAINT "WeeklyImpactNextStep_memberUpdateId_fkey"
    FOREIGN KEY ("memberUpdateId") REFERENCES "WeeklyMemberUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: WeeklyImpactInputRequest (Section 4)
CREATE TABLE IF NOT EXISTS "WeeklyImpactInputRequest" (
    "id" TEXT NOT NULL,
    "memberUpdateId" TEXT NOT NULL,
    "request" TEXT,
    "neededFrom" TEXT,
    "neededBy" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyImpactInputRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WeeklyImpactInputRequest_memberUpdateId_idx" ON "WeeklyImpactInputRequest"("memberUpdateId");

DO $$ BEGIN
  ALTER TABLE "WeeklyImpactInputRequest" ADD CONSTRAINT "WeeklyImpactInputRequest_memberUpdateId_fkey"
    FOREIGN KEY ("memberUpdateId") REFERENCES "WeeklyMemberUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
