-- CreateEnum
CREATE TYPE "ChapterOperationsReportType" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ChapterOperationsReportStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "ChapterOperationsTarget" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "activeStudentsTarget" INTEGER NOT NULL DEFAULT 80,
    "activeInstructorsTarget" INTEGER NOT NULL DEFAULT 15,
    "instructorPipelineTarget" INTEGER NOT NULL DEFAULT 30,
    "activePartnersTarget" INTEGER NOT NULL DEFAULT 8,
    "classesRunningTarget" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterOperationsTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterOperationsReport" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "type" "ChapterOperationsReportType" NOT NULL,
    "status" "ChapterOperationsReportStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "sourceRecordRefs" JSONB NOT NULL,
    "biggestWin" TEXT,
    "biggestChallenge" TEXT,
    "mainFocus" TEXT,
    "decisionNeeded" TEXT,
    "supportNeeded" TEXT,
    "nextPeriodFocus" TEXT,
    "createdById" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterOperationsReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChapterOperationsTarget_chapterId_key" ON "ChapterOperationsTarget"("chapterId");
CREATE UNIQUE INDEX "ChapterOperationsReport_chapterId_type_periodStart_key" ON "ChapterOperationsReport"("chapterId", "type", "periodStart");
CREATE INDEX "ChapterOperationsReport_chapterId_type_periodStart_idx" ON "ChapterOperationsReport"("chapterId", "type", "periodStart");
CREATE INDEX "ChapterOperationsReport_status_idx" ON "ChapterOperationsReport"("status");
CREATE INDEX "ChapterOperationsReport_createdById_idx" ON "ChapterOperationsReport"("createdById");

-- AddForeignKey
ALTER TABLE "ChapterOperationsTarget" ADD CONSTRAINT "ChapterOperationsTarget_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterOperationsReport" ADD CONSTRAINT "ChapterOperationsReport_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterOperationsReport" ADD CONSTRAINT "ChapterOperationsReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
