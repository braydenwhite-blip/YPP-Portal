-- CreateEnum
CREATE TYPE "LaunchTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "RolloutAudience" AS ENUM ('ALL', 'INSTRUCTORS', 'STUDENTS', 'PARENTS', 'CHAPTER_LEADS', 'STAFF', 'MENTORS');

-- CreateEnum
CREATE TYPE "RolloutCampaignStatus" AS ENUM ('DRAFT', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "LessonPlan" ADD COLUMN     "classTemplateId" TEXT;

-- CreateTable
CREATE TABLE "LaunchTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerLabel" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "LaunchTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "blocker" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "chapterId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolloutCampaign" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "audience" "RolloutAudience" NOT NULL DEFAULT 'ALL',
    "targetRoles" "RoleType"[],
    "linkUrl" TEXT,
    "chapterId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "RolloutCampaignStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolloutCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaunchTask_scope_isActive_idx" ON "LaunchTask"("scope", "isActive");

-- CreateIndex
CREATE INDEX "LaunchTask_chapterId_isActive_idx" ON "LaunchTask"("chapterId", "isActive");

-- CreateIndex
CREATE INDEX "LaunchTask_status_dueDate_idx" ON "LaunchTask"("status", "dueDate");

-- CreateIndex
CREATE INDEX "RolloutCampaign_chapterId_idx" ON "RolloutCampaign"("chapterId");

-- CreateIndex
CREATE INDEX "RolloutCampaign_audience_status_idx" ON "RolloutCampaign"("audience", "status");

-- CreateIndex
CREATE INDEX "RolloutCampaign_createdAt_idx" ON "RolloutCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "LessonPlan_classTemplateId_idx" ON "LessonPlan"("classTemplateId");

-- AddForeignKey
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_classTemplateId_fkey" FOREIGN KEY ("classTemplateId") REFERENCES "ClassTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchTask" ADD CONSTRAINT "LaunchTask_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchTask" ADD CONSTRAINT "LaunchTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchTask" ADD CONSTRAINT "LaunchTask_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutCampaign" ADD CONSTRAINT "RolloutCampaign_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutCampaign" ADD CONSTRAINT "RolloutCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

