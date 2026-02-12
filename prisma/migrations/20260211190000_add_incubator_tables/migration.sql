-- CreateEnum
CREATE TYPE "IncubatorPhase" AS ENUM ('IDEATION', 'PLANNING', 'BUILDING', 'FEEDBACK', 'POLISHING', 'SHOWCASE');

-- CreateEnum
CREATE TYPE "IncubatorCohortStatus" AS ENUM ('DRAFT', 'ACCEPTING_APPLICATIONS', 'IN_PROGRESS', 'SHOWCASE_PHASE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IncubatorAppStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'WAITLISTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "IncubatorCohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "season" TEXT,
    "year" INTEGER NOT NULL,
    "applicationOpen" TIMESTAMP(3),
    "applicationClose" TIMESTAMP(3),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "showcaseDate" TIMESTAMP(3),
    "maxProjects" INTEGER NOT NULL DEFAULT 20,
    "passionAreas" TEXT[],
    "status" "IncubatorCohortStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncubatorCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncubatorApplication" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "projectTitle" TEXT NOT NULL,
    "projectIdea" TEXT NOT NULL,
    "passionArea" TEXT NOT NULL,
    "whyThisProject" TEXT NOT NULL,
    "priorExperience" TEXT,
    "goals" TEXT NOT NULL,
    "needsMentor" BOOLEAN NOT NULL DEFAULT true,
    "mentorPreference" TEXT,
    "status" "IncubatorAppStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncubatorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncubatorProject" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "projectTrackerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "passionArea" TEXT NOT NULL,
    "currentPhase" "IncubatorPhase" NOT NULL DEFAULT 'IDEATION',
    "ideationComplete" BOOLEAN NOT NULL DEFAULT false,
    "planningComplete" BOOLEAN NOT NULL DEFAULT false,
    "buildingComplete" BOOLEAN NOT NULL DEFAULT false,
    "feedbackComplete" BOOLEAN NOT NULL DEFAULT false,
    "polishingComplete" BOOLEAN NOT NULL DEFAULT false,
    "showcaseComplete" BOOLEAN NOT NULL DEFAULT false,
    "pitchVideoUrl" TEXT,
    "pitchDeckUrl" TEXT,
    "finalShowcaseUrl" TEXT,
    "pitchDate" TIMESTAMP(3),
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncubatorProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncubatorMentor" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MENTOR',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncubatorMentor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncubatorUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "phase" "IncubatorPhase" NOT NULL,
    "mediaUrls" TEXT[],
    "hoursSpent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncubatorUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchFeedback" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "clarityScore" INTEGER,
    "passionScore" INTEGER,
    "executionScore" INTEGER,
    "impactScore" INTEGER,
    "overallScore" INTEGER,
    "strengths" TEXT,
    "improvements" TEXT,
    "encouragement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PitchFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncubatorCohort_status_idx" ON "IncubatorCohort"("status");

-- CreateIndex
CREATE INDEX "IncubatorCohort_year_season_idx" ON "IncubatorCohort"("year", "season");

-- CreateIndex
CREATE UNIQUE INDEX "IncubatorApplication_cohortId_studentId_key" ON "IncubatorApplication"("cohortId", "studentId");

-- CreateIndex
CREATE INDEX "IncubatorApplication_studentId_idx" ON "IncubatorApplication"("studentId");

-- CreateIndex
CREATE INDEX "IncubatorApplication_status_idx" ON "IncubatorApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IncubatorProject_cohortId_studentId_key" ON "IncubatorProject"("cohortId", "studentId");

-- CreateIndex
CREATE INDEX "IncubatorProject_cohortId_idx" ON "IncubatorProject"("cohortId");

-- CreateIndex
CREATE INDEX "IncubatorProject_studentId_idx" ON "IncubatorProject"("studentId");

-- CreateIndex
CREATE INDEX "IncubatorProject_currentPhase_idx" ON "IncubatorProject"("currentPhase");

-- CreateIndex
CREATE UNIQUE INDEX "IncubatorMentor_projectId_mentorId_key" ON "IncubatorMentor"("projectId", "mentorId");

-- CreateIndex
CREATE INDEX "IncubatorMentor_mentorId_idx" ON "IncubatorMentor"("mentorId");

-- CreateIndex
CREATE INDEX "IncubatorMentor_cohortId_idx" ON "IncubatorMentor"("cohortId");

-- CreateIndex
CREATE INDEX "IncubatorUpdate_projectId_idx" ON "IncubatorUpdate"("projectId");

-- CreateIndex
CREATE INDEX "IncubatorUpdate_authorId_idx" ON "IncubatorUpdate"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "PitchFeedback_projectId_reviewerId_key" ON "PitchFeedback"("projectId", "reviewerId");

-- CreateIndex
CREATE INDEX "PitchFeedback_projectId_idx" ON "PitchFeedback"("projectId");

-- CreateIndex
CREATE INDEX "PitchFeedback_reviewerId_idx" ON "PitchFeedback"("reviewerId");

-- AddForeignKey
ALTER TABLE "IncubatorApplication" ADD CONSTRAINT "IncubatorApplication_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "IncubatorCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubatorApplication" ADD CONSTRAINT "IncubatorApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubatorProject" ADD CONSTRAINT "IncubatorProject_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "IncubatorCohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubatorProject" ADD CONSTRAINT "IncubatorProject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubatorMentor" ADD CONSTRAINT "IncubatorMentor_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "IncubatorCohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubatorMentor" ADD CONSTRAINT "IncubatorMentor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IncubatorProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubatorMentor" ADD CONSTRAINT "IncubatorMentor_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubatorUpdate" ADD CONSTRAINT "IncubatorUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IncubatorProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubatorUpdate" ADD CONSTRAINT "IncubatorUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchFeedback" ADD CONSTRAINT "PitchFeedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IncubatorProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchFeedback" ADD CONSTRAINT "PitchFeedback_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
