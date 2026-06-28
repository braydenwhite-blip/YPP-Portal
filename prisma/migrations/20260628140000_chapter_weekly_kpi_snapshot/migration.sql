-- Chapter OS Phase 3: persistent weekly growth snapshot for the Chapter Growth
-- room. Distinct from the daily, governance-owned "ChapterKpiSnapshot". Written
-- explicitly via the "Save snapshot" room action; read as the prior-week
-- baseline for week-over-week growth (falls back to timestamp reconstruction).

CREATE TABLE IF NOT EXISTS "ChapterWeeklyKpiSnapshot" (
  "id" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "partnersContacted" INTEGER NOT NULL DEFAULT 0,
  "partnerMeetingsScheduled" INTEGER NOT NULL DEFAULT 0,
  "confirmedPartners" INTEGER NOT NULL DEFAULT 0,
  "instructorApplicants" INTEGER NOT NULL DEFAULT 0,
  "interviewsCompleted" INTEGER NOT NULL DEFAULT 0,
  "instructorsHired" INTEGER NOT NULL DEFAULT 0,
  "curriculaSubmitted" INTEGER NOT NULL DEFAULT 0,
  "curriculaApproved" INTEGER NOT NULL DEFAULT 0,
  "classesCreated" INTEGER NOT NULL DEFAULT 0,
  "classesReady" INTEGER NOT NULL DEFAULT 0,
  "studentsEnrolled" INTEGER NOT NULL DEFAULT 0,
  "attendancePercent" INTEGER NOT NULL DEFAULT 0,
  "retentionPercent" INTEGER NOT NULL DEFAULT 0,
  "feedbackCount" INTEGER NOT NULL DEFAULT 0,
  "unresolvedBlockers" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChapterWeeklyKpiSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChapterWeeklyKpiSnapshot_chapterId_weekStart_key"
  ON "ChapterWeeklyKpiSnapshot" ("chapterId", "weekStart");
CREATE INDEX IF NOT EXISTS "ChapterWeeklyKpiSnapshot_chapterId_idx"
  ON "ChapterWeeklyKpiSnapshot" ("chapterId");
CREATE INDEX IF NOT EXISTS "ChapterWeeklyKpiSnapshot_weekStart_idx"
  ON "ChapterWeeklyKpiSnapshot" ("weekStart");

DO $$ BEGIN
  ALTER TABLE "ChapterWeeklyKpiSnapshot" ADD CONSTRAINT "ChapterWeeklyKpiSnapshot_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
