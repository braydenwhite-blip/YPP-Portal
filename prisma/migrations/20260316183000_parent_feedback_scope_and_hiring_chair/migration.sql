-- Parent feedback instructor scoping + hiring Chair review workflow

ALTER TABLE "Decision"
  ADD COLUMN IF NOT EXISTS "hiringChairStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "hiringChairNote" TEXT,
  ADD COLUMN IF NOT EXISTS "hiringChairId" TEXT,
  ADD COLUMN IF NOT EXISTS "hiringChairAt" TIMESTAMP(3);

ALTER TABLE "ParentChapterFeedback"
  ADD COLUMN IF NOT EXISTS "studentId" TEXT,
  ADD COLUMN IF NOT EXISTS "courseId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Decision_hiringChairId_fkey'
  ) THEN
    ALTER TABLE "Decision"
      ADD CONSTRAINT "Decision_hiringChairId_fkey"
      FOREIGN KEY ("hiringChairId") REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentChapterFeedback_studentId_fkey'
  ) THEN
    ALTER TABLE "ParentChapterFeedback"
      ADD CONSTRAINT "ParentChapterFeedback_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentChapterFeedback_courseId_fkey'
  ) THEN
    ALTER TABLE "ParentChapterFeedback"
      ADD CONSTRAINT "ParentChapterFeedback_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Decision_hiringChairStatus_idx"
  ON "Decision"("hiringChairStatus");

CREATE INDEX IF NOT EXISTS "Decision_hiringChairId_idx"
  ON "Decision"("hiringChairId");

CREATE INDEX IF NOT EXISTS "ParentChapterFeedback_studentId_idx"
  ON "ParentChapterFeedback"("studentId");

CREATE INDEX IF NOT EXISTS "ParentChapterFeedback_courseId_idx"
  ON "ParentChapterFeedback"("courseId");
