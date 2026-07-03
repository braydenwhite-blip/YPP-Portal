-- Mentorship consolidation V1 — MentorshipCheckIn becomes the conversation record
--
-- Extends the thin between-review touchpoint into the single "conversation
-- record" for every logged check-in / meeting / conversation between a leader
-- and a person. Person-anchored (`subjectId`) so the record survives the later
-- unification of the relationship tables, with optional soft links to the
-- relationship it came from (`mentorshipId` today, `advisorAssignmentId`
-- reserved). `mentorshipId` becomes nullable. `kind` + the structured fields are
-- TEXT validated in app code. Additive + idempotent (safe to re-run under
-- `prisma migrate deploy`).

ALTER TABLE "MentorshipCheckIn"
  ADD COLUMN IF NOT EXISTS "subjectId" TEXT,
  ADD COLUMN IF NOT EXISTS "advisorAssignmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "authorId" TEXT,
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'CHECK_IN',
  ADD COLUMN IF NOT EXISTS "wins" TEXT,
  ADD COLUMN IF NOT EXISTS "challenges" TEXT,
  ADD COLUMN IF NOT EXISTS "discussion" TEXT,
  ADD COLUMN IF NOT EXISTS "decisions" TEXT,
  ADD COLUMN IF NOT EXISTS "commitments" TEXT,
  ADD COLUMN IF NOT EXISTS "participantIds" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "followUpDate" TIMESTAMP(3),
  -- Added nullable so the backfill below can stamp each legacy row's true
  -- occurredAt from its createdAt before the column becomes NOT NULL. (Adding it
  -- NOT NULL DEFAULT now() would collapse every existing row onto the deploy
  -- timestamp and break `occurredAt desc` ordering.)
  ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3);

-- The relationship link is now optional (person-anchored records may carry none).
ALTER TABLE "MentorshipCheckIn" ALTER COLUMN "mentorshipId" DROP NOT NULL;

-- Guarded foreign keys (no-op when the constraint already exists).
DO $$ BEGIN
  ALTER TABLE "MentorshipCheckIn" ADD CONSTRAINT "MentorshipCheckIn_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MentorshipCheckIn" ADD CONSTRAINT "MentorshipCheckIn_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MentorshipCheckIn" ADD CONSTRAINT "MentorshipCheckIn_advisorAssignmentId_fkey"
    FOREIGN KEY ("advisorAssignmentId") REFERENCES "StudentAdvisorAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Backfill legacy rows: anchor them on the pairing's mentee and stamp occurredAt
-- from createdAt. Idempotent — only touches rows not yet backfilled.
UPDATE "MentorshipCheckIn" mc
  SET "subjectId" = m."menteeId"
  FROM "Mentorship" m
  WHERE mc."mentorshipId" = m."id" AND mc."subjectId" IS NULL;

-- Stamp each legacy row's occurredAt from its real createdAt, THEN lock the
-- column to NOT NULL DEFAULT now() for new rows. Idempotent: the UPDATE only
-- touches nulls, and SET DEFAULT / SET NOT NULL are safe no-ops on re-run.
UPDATE "MentorshipCheckIn"
  SET "occurredAt" = "createdAt"
  WHERE "occurredAt" IS NULL;

ALTER TABLE "MentorshipCheckIn" ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MentorshipCheckIn" ALTER COLUMN "occurredAt" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "MentorshipCheckIn_subjectId_occurredAt_idx"
  ON "MentorshipCheckIn"("subjectId", "occurredAt");

CREATE INDEX IF NOT EXISTS "MentorshipCheckIn_advisorAssignmentId_createdAt_idx"
  ON "MentorshipCheckIn"("advisorAssignmentId", "createdAt");
