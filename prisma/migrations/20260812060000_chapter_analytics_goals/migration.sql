-- Chapter Analytics: DB-backed goal targets (replacing the hardcoded ramp),
-- per-chapter exceptions, and notes on category detail views.

CREATE TABLE IF NOT EXISTS "ChapterAnalyticsGoal" (
  "id" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "targetValue" DOUBLE PRECISION NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChapterAnalyticsGoal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChapterAnalyticsGoal_metric_monthKey_key"
  ON "ChapterAnalyticsGoal"("metric", "monthKey");
CREATE INDEX IF NOT EXISTS "ChapterAnalyticsGoal_monthKey_idx"
  ON "ChapterAnalyticsGoal"("monthKey");

DO $$ BEGIN
  ALTER TABLE "ChapterAnalyticsGoal"
    ADD CONSTRAINT "ChapterAnalyticsGoal_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ChapterAnalyticsGoalException" (
  "id" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "targetValue" DOUBLE PRECISION NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChapterAnalyticsGoalException_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChapterAnalyticsGoalException_chapterId_metric_monthKey_key"
  ON "ChapterAnalyticsGoalException"("chapterId", "metric", "monthKey");
CREATE INDEX IF NOT EXISTS "ChapterAnalyticsGoalException_chapterId_monthKey_idx"
  ON "ChapterAnalyticsGoalException"("chapterId", "monthKey");

DO $$ BEGIN
  ALTER TABLE "ChapterAnalyticsGoalException"
    ADD CONSTRAINT "ChapterAnalyticsGoalException_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChapterAnalyticsGoalException"
    ADD CONSTRAINT "ChapterAnalyticsGoalException_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ChapterAnalyticsNote" (
  "id" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChapterAnalyticsNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChapterAnalyticsNote_chapterId_category_monthKey_key"
  ON "ChapterAnalyticsNote"("chapterId", "category", "monthKey");
CREATE INDEX IF NOT EXISTS "ChapterAnalyticsNote_chapterId_monthKey_idx"
  ON "ChapterAnalyticsNote"("chapterId", "monthKey");

DO $$ BEGIN
  ALTER TABLE "ChapterAnalyticsNote"
    ADD CONSTRAINT "ChapterAnalyticsNote_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChapterAnalyticsNote"
    ADD CONSTRAINT "ChapterAnalyticsNote_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
