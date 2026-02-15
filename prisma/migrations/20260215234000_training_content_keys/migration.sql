-- Add stable content keys for import/export workflows and optional quiz explanations.

ALTER TABLE "TrainingModule"
  ADD COLUMN IF NOT EXISTS "contentKey" TEXT;

ALTER TABLE "TrainingCheckpoint"
  ADD COLUMN IF NOT EXISTS "contentKey" TEXT;

ALTER TABLE "TrainingQuizQuestion"
  ADD COLUMN IF NOT EXISTS "contentKey" TEXT,
  ADD COLUMN IF NOT EXISTS "explanation" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "TrainingModule_contentKey_key"
  ON "TrainingModule"("contentKey");

CREATE UNIQUE INDEX IF NOT EXISTS "TrainingCheckpoint_moduleId_contentKey_key"
  ON "TrainingCheckpoint"("moduleId", "contentKey");

CREATE UNIQUE INDEX IF NOT EXISTS "TrainingQuizQuestion_moduleId_contentKey_key"
  ON "TrainingQuizQuestion"("moduleId", "contentKey");
