-- CPO People & Performance — reviewable monthly feedback requests.
--
-- The legacy "Request Monthly Feedback" flow created bare
-- (subject, collaborator, month) rows with no record of who asked, why the
-- collaborator was chosen, or what shared work justified the ask. The new
-- review-before-send workflow persists that context so the recipient's form
-- and the request email can show it, and so Leadership can audit requests.
--
-- All columns are nullable and additive — legacy rows and the legacy bulk
-- sender keep working unchanged. Written idempotently
-- (ADD COLUMN IF NOT EXISTS) per the repo convention.

ALTER TABLE "FeedbackRequest" ADD COLUMN IF NOT EXISTS "requestedById" TEXT;
ALTER TABLE "FeedbackRequest" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "FeedbackRequest" ADD COLUMN IF NOT EXISTS "contextItems" JSONB;
ALTER TABLE "FeedbackRequest" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3);

-- Guarded foreign key + index (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FeedbackRequest_requestedById_fkey'
  ) THEN
    ALTER TABLE "FeedbackRequest"
      ADD CONSTRAINT "FeedbackRequest_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "FeedbackRequest_requestedById_idx"
  ON "FeedbackRequest"("requestedById");
