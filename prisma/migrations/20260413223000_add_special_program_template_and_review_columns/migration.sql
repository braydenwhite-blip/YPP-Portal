-- Bring SpecialProgram in sync with the Prisma schema used by the
-- program browser and Passion Lab builder flows.

ALTER TABLE "SpecialProgram"
  ADD COLUMN IF NOT EXISTS "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "templateCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SpecialProgram_reviewedById_fkey'
  ) THEN
    ALTER TABLE "SpecialProgram"
      ADD CONSTRAINT "SpecialProgram_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
