-- Add co-applicant / availability fields that exist on ChapterPresidentApplication
-- in schema.prisma but were never migrated.

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "applyingWith" TEXT;

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "coCandidateName" TEXT;

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "availabilityConflicts" TEXT;
