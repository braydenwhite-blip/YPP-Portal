-- CreateEnum
CREATE TYPE "MentorshipPointCategory" AS ENUM (
    'STUDENT',
    'INSTRUCTOR',
    'CHAPTER_PRESIDENT',
    'GLOBAL_LEADERSHIP',
    'STAFF',
    'CUSTOM'
);

-- CreateEnum
CREATE TYPE "MentorCommitteeMemberRole" AS ENUM (
    'CHAIR',
    'MEMBER',
    'MANAGER'
);

-- CreateEnum
CREATE TYPE "MentorshipReviewStatus" AS ENUM (
    'DRAFT',
    'PENDING_CHAIR_APPROVAL',
    'APPROVED',
    'RETURNED'
);

-- CreateEnum
CREATE TYPE "QuarterlyCommitteeReviewStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED'
);

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM (
    'DRAFT',
    'PENDING_CHAIR_APPROVAL',
    'PENDING_BOARD_APPROVAL',
    'APPROVED',
    'REJECTED'
);

-- CreateEnum
CREATE TYPE "MentorshipAwardLevel" AS ENUM (
    'BRONZE',
    'SILVER',
    'GOLD',
    'LIFETIME'
);

-- AlterTable
ALTER TABLE "Mentorship"
ADD COLUMN "trackId" TEXT,
ADD COLUMN "chairId" TEXT,
ADD COLUMN "kickoffScheduledAt" TIMESTAMP(3),
ADD COLUMN "kickoffCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProgressUpdate"
ADD COLUMN "monthlyReviewId" TEXT;

-- AlterTable
ALTER TABLE "ReflectionQuestion"
ADD COLUMN "sectionTitle" TEXT,
ADD COLUMN "helperText" TEXT;

-- CreateTable
CREATE TABLE "MentorshipTrack" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "pointCategory" "MentorshipPointCategory" NOT NULL DEFAULT 'CUSTOM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorCommittee" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "chairUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorCommittee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorCommitteeMember" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MentorCommitteeMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorCommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyGoalReview" (
    "id" TEXT NOT NULL,
    "mentorshipId" TEXT NOT NULL,
    "trackId" TEXT,
    "menteeId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "chairId" TEXT,
    "reflectionSubmissionId" TEXT,
    "month" TIMESTAMP(3) NOT NULL,
    "status" "MentorshipReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "overallStatus" "ProgressStatus",
    "overallComments" TEXT,
    "strengths" TEXT,
    "focusAreas" TEXT,
    "collaborationNotes" TEXT,
    "promotionReadiness" TEXT,
    "nextMonthPlan" TEXT,
    "mentorInternalNotes" TEXT,
    "chairDecisionNotes" TEXT,
    "characterCulturePoints" INTEGER NOT NULL DEFAULT 0,
    "baseAchievementPoints" INTEGER NOT NULL DEFAULT 0,
    "totalAchievementPoints" INTEGER NOT NULL DEFAULT 0,
    "mentorSubmittedAt" TIMESTAMP(3),
    "chairDecisionAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyGoalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyGoalRating" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyGoalRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementPointLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewId" TEXT,
    "points" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementPointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuarterlyCommitteeReview" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT,
    "trackId" TEXT,
    "menteeId" TEXT NOT NULL,
    "createdById" TEXT,
    "quarterStart" TIMESTAMP(3) NOT NULL,
    "includedReviewIds" TEXT[],
    "status" "QuarterlyCommitteeReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "overallTrajectory" TEXT,
    "committeePerspective" TEXT,
    "supportRecommendations" TEXT,
    "promotionReadiness" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuarterlyCommitteeReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorshipAwardRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewId" TEXT,
    "trackId" TEXT,
    "level" "MentorshipAwardLevel" NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "recommendedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipAwardRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewId" TEXT,
    "quarterlyReviewId" TEXT,
    "trackId" TEXT,
    "targetRole" TEXT,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "recommendedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MentorshipTrack_slug_key" ON "MentorshipTrack"("slug");

-- CreateIndex
CREATE INDEX "Mentorship_trackId_idx" ON "Mentorship"("trackId");

-- CreateIndex
CREATE INDEX "Mentorship_chairId_idx" ON "Mentorship"("chairId");

-- CreateIndex
CREATE INDEX "ProgressUpdate_monthlyReviewId_idx" ON "ProgressUpdate"("monthlyReviewId");

-- CreateIndex
CREATE INDEX "MentorCommittee_trackId_idx" ON "MentorCommittee"("trackId");

-- CreateIndex
CREATE INDEX "MentorCommittee_chairUserId_idx" ON "MentorCommittee"("chairUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorCommitteeMember_committeeId_userId_key" ON "MentorCommitteeMember"("committeeId", "userId");

-- CreateIndex
CREATE INDEX "MentorCommitteeMember_userId_idx" ON "MentorCommitteeMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyGoalReview_mentorshipId_month_key" ON "MonthlyGoalReview"("mentorshipId", "month");

-- CreateIndex
CREATE INDEX "MonthlyGoalReview_menteeId_month_idx" ON "MonthlyGoalReview"("menteeId", "month");

-- CreateIndex
CREATE INDEX "MonthlyGoalReview_mentorId_month_idx" ON "MonthlyGoalReview"("mentorId", "month");

-- CreateIndex
CREATE INDEX "MonthlyGoalReview_status_month_idx" ON "MonthlyGoalReview"("status", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyGoalRating_reviewId_goalId_key" ON "MonthlyGoalRating"("reviewId", "goalId");

-- CreateIndex
CREATE INDEX "MonthlyGoalRating_goalId_idx" ON "MonthlyGoalRating"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementPointLedger_reviewId_key" ON "AchievementPointLedger"("reviewId");

-- CreateIndex
CREATE INDEX "AchievementPointLedger_userId_createdAt_idx" ON "AchievementPointLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AchievementPointLedger_approvedById_idx" ON "AchievementPointLedger"("approvedById");

-- CreateIndex
CREATE UNIQUE INDEX "QuarterlyCommitteeReview_menteeId_quarterStart_key" ON "QuarterlyCommitteeReview"("menteeId", "quarterStart");

-- CreateIndex
CREATE INDEX "QuarterlyCommitteeReview_committeeId_idx" ON "QuarterlyCommitteeReview"("committeeId");

-- CreateIndex
CREATE INDEX "QuarterlyCommitteeReview_trackId_idx" ON "QuarterlyCommitteeReview"("trackId");

-- CreateIndex
CREATE INDEX "QuarterlyCommitteeReview_status_idx" ON "QuarterlyCommitteeReview"("status");

-- CreateIndex
CREATE INDEX "MentorshipAwardRecommendation_userId_status_idx" ON "MentorshipAwardRecommendation"("userId", "status");

-- CreateIndex
CREATE INDEX "MentorshipAwardRecommendation_trackId_idx" ON "MentorshipAwardRecommendation"("trackId");

-- CreateIndex
CREATE INDEX "PromotionRecommendation_userId_status_idx" ON "PromotionRecommendation"("userId", "status");

-- CreateIndex
CREATE INDEX "PromotionRecommendation_trackId_idx" ON "PromotionRecommendation"("trackId");

-- AddForeignKey
ALTER TABLE "Mentorship" ADD CONSTRAINT "Mentorship_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "MentorshipTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mentorship" ADD CONSTRAINT "Mentorship_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_monthlyReviewId_fkey" FOREIGN KEY ("monthlyReviewId") REFERENCES "MonthlyGoalReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorCommittee" ADD CONSTRAINT "MentorCommittee_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "MentorshipTrack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorCommittee" ADD CONSTRAINT "MentorCommittee_chairUserId_fkey" FOREIGN KEY ("chairUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorCommitteeMember" ADD CONSTRAINT "MentorCommitteeMember_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "MentorCommittee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorCommitteeMember" ADD CONSTRAINT "MentorCommitteeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGoalReview" ADD CONSTRAINT "MonthlyGoalReview_mentorshipId_fkey" FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGoalReview" ADD CONSTRAINT "MonthlyGoalReview_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "MentorshipTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGoalReview" ADD CONSTRAINT "MonthlyGoalReview_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGoalReview" ADD CONSTRAINT "MonthlyGoalReview_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGoalReview" ADD CONSTRAINT "MonthlyGoalReview_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGoalReview" ADD CONSTRAINT "MonthlyGoalReview_reflectionSubmissionId_fkey" FOREIGN KEY ("reflectionSubmissionId") REFERENCES "ReflectionSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGoalRating" ADD CONSTRAINT "MonthlyGoalRating_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "MonthlyGoalReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGoalRating" ADD CONSTRAINT "MonthlyGoalRating_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementPointLedger" ADD CONSTRAINT "AchievementPointLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementPointLedger" ADD CONSTRAINT "AchievementPointLedger_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "MonthlyGoalReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementPointLedger" ADD CONSTRAINT "AchievementPointLedger_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarterlyCommitteeReview" ADD CONSTRAINT "QuarterlyCommitteeReview_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "MentorCommittee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarterlyCommitteeReview" ADD CONSTRAINT "QuarterlyCommitteeReview_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "MentorshipTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarterlyCommitteeReview" ADD CONSTRAINT "QuarterlyCommitteeReview_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarterlyCommitteeReview" ADD CONSTRAINT "QuarterlyCommitteeReview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipAwardRecommendation" ADD CONSTRAINT "MentorshipAwardRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipAwardRecommendation" ADD CONSTRAINT "MentorshipAwardRecommendation_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "MonthlyGoalReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipAwardRecommendation" ADD CONSTRAINT "MentorshipAwardRecommendation_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "MentorshipTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipAwardRecommendation" ADD CONSTRAINT "MentorshipAwardRecommendation_recommendedById_fkey" FOREIGN KEY ("recommendedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipAwardRecommendation" ADD CONSTRAINT "MentorshipAwardRecommendation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "MonthlyGoalReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_quarterlyReviewId_fkey" FOREIGN KEY ("quarterlyReviewId") REFERENCES "QuarterlyCommitteeReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "MentorshipTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_recommendedById_fkey" FOREIGN KEY ("recommendedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
