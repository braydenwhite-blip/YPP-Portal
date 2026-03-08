-- CreateEnum
CREATE TYPE "MenteeRoleType" AS ENUM ('INSTRUCTOR', 'CHAPTER_PRESIDENT', 'GLOBAL_LEADERSHIP');

-- CreateEnum
CREATE TYPE "GoalRatingColor" AS ENUM ('BEHIND_SCHEDULE', 'GETTING_STARTED', 'ACHIEVED', 'ABOVE_AND_BEYOND');

-- CreateEnum
CREATE TYPE "GoalReviewStatus" AS ENUM ('DRAFT', 'PENDING_CHAIR_APPROVAL', 'CHANGES_REQUESTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "AchievementAwardTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'LIFETIME');

-- CreateEnum
CREATE TYPE "AwardNominationStatus" AS ENUM ('PENDING_CHAIR', 'PENDING_BOARD', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MentorshipProgramGoal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "roleType" "MenteeRoleType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipProgramGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySelfReflection" (
    "id" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "mentorshipId" TEXT NOT NULL,
    "cycleMonth" TIMESTAMP(3) NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "overallReflection" TEXT NOT NULL,
    "engagementOverall" TEXT NOT NULL,
    "workingWell" TEXT NOT NULL,
    "supportNeeded" TEXT NOT NULL,
    "mentorHelpfulness" TEXT NOT NULL,
    "collaborationAssessment" TEXT NOT NULL,
    "teamMembersAboveAndBeyond" TEXT,
    "collaborationImprovements" TEXT,
    "additionalReflections" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlySelfReflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfReflectionGoalResponse" (
    "id" TEXT NOT NULL,
    "reflectionId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "progressMade" TEXT NOT NULL,
    "objectiveAchieved" BOOLEAN NOT NULL,
    "accomplishments" TEXT NOT NULL,
    "blockers" TEXT,
    "nextMonthPlans" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelfReflectionGoalResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorGoalReview" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "mentorshipId" TEXT NOT NULL,
    "selfReflectionId" TEXT NOT NULL,
    "cycleMonth" TIMESTAMP(3) NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "isQuarterly" BOOLEAN NOT NULL DEFAULT false,
    "overallRating" "GoalRatingColor" NOT NULL,
    "overallComments" TEXT NOT NULL,
    "planOfAction" TEXT NOT NULL,
    "projectedFuturePath" TEXT,
    "promotionReadiness" TEXT,
    "status" "GoalReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "chairReviewerId" TEXT,
    "chairComments" TEXT,
    "chairApprovedAt" TIMESTAMP(3),
    "releasedToMenteeAt" TIMESTAMP(3),
    "pointsAwarded" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorGoalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalReviewRating" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "rating" "GoalRatingColor" NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalReviewRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementPointSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "currentTier" "AchievementAwardTier",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementPointSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementPointLog" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "cycleMonth" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementPointLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardNomination" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "nomineeId" TEXT NOT NULL,
    "nominatedBy" TEXT NOT NULL,
    "tier" "AchievementAwardTier" NOT NULL,
    "status" "AwardNominationStatus" NOT NULL DEFAULT 'PENDING_CHAIR',
    "chairApproverId" TEXT,
    "chairApprovedAt" TIMESTAMP(3),
    "boardApproverId" TEXT,
    "boardApprovedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardNomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorCommitteeChair" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleType" "MenteeRoleType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorCommitteeChair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentorshipProgramGoal_roleType_idx" ON "MentorshipProgramGoal"("roleType");

-- CreateIndex
CREATE INDEX "MonthlySelfReflection_menteeId_idx" ON "MonthlySelfReflection"("menteeId");

-- CreateIndex
CREATE INDEX "MonthlySelfReflection_mentorshipId_idx" ON "MonthlySelfReflection"("mentorshipId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySelfReflection_mentorshipId_cycleNumber_key" ON "MonthlySelfReflection"("mentorshipId", "cycleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SelfReflectionGoalResponse_reflectionId_goalId_key" ON "SelfReflectionGoalResponse"("reflectionId", "goalId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorGoalReview_selfReflectionId_key" ON "MentorGoalReview"("selfReflectionId");

-- CreateIndex
CREATE INDEX "MentorGoalReview_menteeId_idx" ON "MentorGoalReview"("menteeId");

-- CreateIndex
CREATE INDEX "MentorGoalReview_mentorId_idx" ON "MentorGoalReview"("mentorId");

-- CreateIndex
CREATE INDEX "MentorGoalReview_mentorshipId_idx" ON "MentorGoalReview"("mentorshipId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalReviewRating_reviewId_goalId_key" ON "GoalReviewRating"("reviewId", "goalId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementPointSummary_userId_key" ON "AchievementPointSummary"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementPointLog_reviewId_key" ON "AchievementPointLog"("reviewId");

-- CreateIndex
CREATE INDEX "AchievementPointLog_summaryId_idx" ON "AchievementPointLog"("summaryId");

-- CreateIndex
CREATE INDEX "AwardNomination_nomineeId_idx" ON "AwardNomination"("nomineeId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorCommitteeChair_userId_roleType_key" ON "MentorCommitteeChair"("userId", "roleType");

-- CreateIndex
CREATE INDEX "MentorCommitteeChair_roleType_idx" ON "MentorCommitteeChair"("roleType");

-- AddForeignKey
ALTER TABLE "MentorshipProgramGoal" ADD CONSTRAINT "MentorshipProgramGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySelfReflection" ADD CONSTRAINT "MonthlySelfReflection_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySelfReflection" ADD CONSTRAINT "MonthlySelfReflection_mentorshipId_fkey" FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfReflectionGoalResponse" ADD CONSTRAINT "SelfReflectionGoalResponse_reflectionId_fkey" FOREIGN KEY ("reflectionId") REFERENCES "MonthlySelfReflection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfReflectionGoalResponse" ADD CONSTRAINT "SelfReflectionGoalResponse_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "MentorshipProgramGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorGoalReview" ADD CONSTRAINT "MentorGoalReview_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorGoalReview" ADD CONSTRAINT "MentorGoalReview_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorGoalReview" ADD CONSTRAINT "MentorGoalReview_mentorshipId_fkey" FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorGoalReview" ADD CONSTRAINT "MentorGoalReview_selfReflectionId_fkey" FOREIGN KEY ("selfReflectionId") REFERENCES "MonthlySelfReflection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorGoalReview" ADD CONSTRAINT "MentorGoalReview_chairReviewerId_fkey" FOREIGN KEY ("chairReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalReviewRating" ADD CONSTRAINT "GoalReviewRating_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "MentorGoalReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalReviewRating" ADD CONSTRAINT "GoalReviewRating_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "MentorshipProgramGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementPointSummary" ADD CONSTRAINT "AchievementPointSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementPointLog" ADD CONSTRAINT "AchievementPointLog_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "AchievementPointSummary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementPointLog" ADD CONSTRAINT "AchievementPointLog_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "MentorGoalReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardNomination" ADD CONSTRAINT "AwardNomination_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "AchievementPointSummary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardNomination" ADD CONSTRAINT "AwardNomination_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardNomination" ADD CONSTRAINT "AwardNomination_nominatedBy_fkey" FOREIGN KEY ("nominatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardNomination" ADD CONSTRAINT "AwardNomination_chairApproverId_fkey" FOREIGN KEY ("chairApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardNomination" ADD CONSTRAINT "AwardNomination_boardApproverId_fkey" FOREIGN KEY ("boardApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorCommitteeChair" ADD CONSTRAINT "MentorCommitteeChair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
