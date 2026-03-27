-- CreateEnum
CREATE TYPE "StudentIntakeCaseStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'MENTOR_PLAN_LAUNCHED'
);

-- CreateTable
CREATE TABLE "StudentIntakeCase" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentUserId" TEXT,
    "chapterId" TEXT NOT NULL,
    "status" "StudentIntakeCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "studentName" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "studentGrade" INTEGER,
    "studentSchool" TEXT,
    "relationship" TEXT NOT NULL DEFAULT 'Parent',
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supportNeeds" TEXT,
    "parentNotes" TEXT,
    "reviewerNote" TEXT,
    "blockerNote" TEXT,
    "nextAction" TEXT,
    "reviewOwnerId" TEXT,
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "mentorPlanLaunchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentIntakeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentIntakeMilestone" (
    "id" TEXT NOT NULL,
    "intakeCaseId" TEXT NOT NULL,
    "status" "StudentIntakeCaseStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "createdById" TEXT,
    "visibleToParent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentIntakeMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentIntakeCase_parentId_status_idx" ON "StudentIntakeCase"("parentId", "status");

-- CreateIndex
CREATE INDEX "StudentIntakeCase_chapterId_status_idx" ON "StudentIntakeCase"("chapterId", "status");

-- CreateIndex
CREATE INDEX "StudentIntakeCase_studentUserId_idx" ON "StudentIntakeCase"("studentUserId");

-- CreateIndex
CREATE INDEX "StudentIntakeCase_reviewOwnerId_status_idx" ON "StudentIntakeCase"("reviewOwnerId", "status");

-- CreateIndex
CREATE INDEX "StudentIntakeCase_submittedAt_idx" ON "StudentIntakeCase"("submittedAt");

-- CreateIndex
CREATE INDEX "StudentIntakeMilestone_intakeCaseId_createdAt_idx" ON "StudentIntakeMilestone"("intakeCaseId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentIntakeMilestone_status_createdAt_idx" ON "StudentIntakeMilestone"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentIntakeCase"
ADD CONSTRAINT "StudentIntakeCase_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntakeCase"
ADD CONSTRAINT "StudentIntakeCase_studentUserId_fkey"
FOREIGN KEY ("studentUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntakeCase"
ADD CONSTRAINT "StudentIntakeCase_chapterId_fkey"
FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntakeCase"
ADD CONSTRAINT "StudentIntakeCase_reviewOwnerId_fkey"
FOREIGN KEY ("reviewOwnerId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntakeCase"
ADD CONSTRAINT "StudentIntakeCase_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntakeMilestone"
ADD CONSTRAINT "StudentIntakeMilestone_intakeCaseId_fkey"
FOREIGN KEY ("intakeCaseId") REFERENCES "StudentIntakeCase"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntakeMilestone"
ADD CONSTRAINT "StudentIntakeMilestone_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
