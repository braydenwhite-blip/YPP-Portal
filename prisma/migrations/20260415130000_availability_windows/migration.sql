-- CreateTable: ApplicantAvailabilityWindow
CREATE TABLE IF NOT EXISTS "ApplicantAvailabilityWindow" (
    "id"                            TEXT NOT NULL,
    "chapterPresidentApplicationId" TEXT,
    "instructorApplicationId"       TEXT,
    "dayOfWeek"                     INTEGER NOT NULL,
    "startTime"                     TEXT NOT NULL,
    "endTime"                       TEXT NOT NULL,
    "timezone"                      TEXT NOT NULL,
    "createdAt"                     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicantAvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: chapterPresidentApplicationId → ChapterPresidentApplication
DO $$ BEGIN
    ALTER TABLE "ApplicantAvailabilityWindow"
        ADD CONSTRAINT "ApplicantAvailabilityWindow_cpAppId_fkey"
        FOREIGN KEY ("chapterPresidentApplicationId")
        REFERENCES "ChapterPresidentApplication"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: instructorApplicationId → InstructorApplication
DO $$ BEGIN
    ALTER TABLE "ApplicantAvailabilityWindow"
        ADD CONSTRAINT "ApplicantAvailabilityWindow_instrAppId_fkey"
        FOREIGN KEY ("instructorApplicationId")
        REFERENCES "InstructorApplication"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicantAvailabilityWindow_cpAppId_idx"
    ON "ApplicantAvailabilityWindow"("chapterPresidentApplicationId");

CREATE INDEX IF NOT EXISTS "ApplicantAvailabilityWindow_instrAppId_idx"
    ON "ApplicantAvailabilityWindow"("instructorApplicationId");

-- AlterTable: add schedulingNoMatchAt to ChapterPresidentApplication
ALTER TABLE "ChapterPresidentApplication"
    ADD COLUMN IF NOT EXISTS "schedulingNoMatchAt" TIMESTAMP(3);

-- AlterTable: add schedulingNoMatchAt to InstructorApplication
ALTER TABLE "InstructorApplication"
    ADD COLUMN IF NOT EXISTS "schedulingNoMatchAt" TIMESTAMP(3);
