-- Add revision history tracking for InstructorApplicationReview.
-- After a review is submitted, any subsequent edits are snapshotted here.

-- New columns on InstructorApplicationReview to track the last edit
ALTER TABLE "InstructorApplicationReview"
  ADD COLUMN IF NOT EXISTS "editedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "editedById" TEXT;

-- Foreign key from InstructorApplicationReview.editedById → User.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InstructorApplicationReview_editedById_fkey'
  ) THEN
    ALTER TABLE "InstructorApplicationReview"
      ADD CONSTRAINT "InstructorApplicationReview_editedById_fkey"
      FOREIGN KEY ("editedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Revision snapshot table
CREATE TABLE IF NOT EXISTS "InstructorApplicationReviewRevision" (
  "id"                 TEXT         NOT NULL,
  "reviewId"           TEXT         NOT NULL,
  "editedById"         TEXT         NOT NULL,
  "editedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "summary"            TEXT,
  "notes"              TEXT,
  "concerns"           TEXT,
  "nextStep"           "InstructorApplicationNextStep",
  "categoriesSnapshot" JSONB        NOT NULL,

  CONSTRAINT "InstructorApplicationReviewRevision_pkey" PRIMARY KEY ("id")
);

-- Foreign key: revision → review (cascade delete)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InstructorApplicationReviewRevision_reviewId_fkey'
  ) THEN
    ALTER TABLE "InstructorApplicationReviewRevision"
      ADD CONSTRAINT "InstructorApplicationReviewRevision_reviewId_fkey"
      FOREIGN KEY ("reviewId") REFERENCES "InstructorApplicationReview"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Foreign key: revision → user (editor)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InstructorApplicationReviewRevision_editedById_fkey'
  ) THEN
    ALTER TABLE "InstructorApplicationReviewRevision"
      ADD CONSTRAINT "InstructorApplicationReviewRevision_editedById_fkey"
      FOREIGN KEY ("editedById") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Index for efficient per-review revision lookups ordered by time
CREATE INDEX IF NOT EXISTS "InstructorApplicationReviewRevision_reviewId_editedAt_idx"
  ON "InstructorApplicationReviewRevision"("reviewId", "editedAt");
