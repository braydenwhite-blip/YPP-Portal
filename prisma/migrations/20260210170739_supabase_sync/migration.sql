-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "learningOutcomes" TEXT[],
    "milestone" TEXT,
    "materialsUrl" TEXT,
    "recordingUrl" TEXT,
    "notesUrl" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "status" "ClassEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "droppedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sessionsAttended" INTEGER NOT NULL DEFAULT 0,
    "outcomesAchieved" TEXT[],
    "instructorNotes" TEXT,
    "waitlistPosition" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassReminder" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "zoomLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAssignment" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ClassAssignmentType" NOT NULL DEFAULT 'PRACTICE',
    "feedbackStyle" "FeedbackStyle" NOT NULL DEFAULT 'NARRATIVE',
    "gradingStyle" "GradingStyle" NOT NULL DEFAULT 'FEEDBACK_ONLY',
    "suggestedDueDate" TIMESTAMP(3),
    "hardDeadline" TIMESTAMP(3),
    "allowLateSubmissions" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "referenceLinks" TEXT[],
    "exampleWorkUrls" TEXT[],
    "attachmentUrl" TEXT,
    "isGroupAssignment" BOOLEAN NOT NULL DEFAULT false,
    "groupSize" INTEGER,
    "allowSelfSelect" BOOLEAN NOT NULL DEFAULT true,
    "encouragementNote" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT,
    "workUrl" TEXT,
    "workText" TEXT,
    "submittedAt" TIMESTAMP(3),
    "status" "ClassSubmissionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "instructorFeedback" TEXT,
    "celebratoryNote" TEXT,
    "suggestionsForNext" TEXT,
    "feedbackGivenAt" TIMESTAMP(3),
    "studentReflection" TEXT,
    "enjoymentRating" INTEGER,
    "difficultyRating" INTEGER,
    "whatWentWell" TEXT,
    "whatToImprove" TEXT,
    "wouldRecommend" BOOLEAN,
    "completionBadge" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassAssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupProject" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "description" TEXT,
    "communicationChannel" TEXT,
    "sharedDocLinks" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMilestone" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "passionArea" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL DEFAULT 'ai',
    "targetSkillLevel" TEXT NOT NULL DEFAULT 'intermediate',
    "timeframeDays" INTEGER NOT NULL DEFAULT 90,
    "weeklyHoursAvailable" INTEGER NOT NULL DEFAULT 5,
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "recommendedClasses" TEXT[],
    "recommendedModules" TEXT[],
    "practiceGoals" JSONB NOT NULL DEFAULT '{}',
    "status" "LearningPathStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "currentMilestone" INTEGER NOT NULL DEFAULT 0,
    "completionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "activePassions" INTEGER NOT NULL DEFAULT 0,
    "practiceMinutesThisWeek" INTEGER NOT NULL DEFAULT 0,
    "practiceMinutesLastWeek" INTEGER NOT NULL DEFAULT 0,
    "practiceMinutesAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "mostProductiveDay" TEXT,
    "mostProductiveHour" INTEGER,
    "preferredSessionLength" INTEGER,
    "totalSessionsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "skillProgressions" JSONB NOT NULL DEFAULT '{}',
    "classesEnrolled" INTEGER NOT NULL DEFAULT 0,
    "classesCompleted" INTEGER NOT NULL DEFAULT 0,
    "assignmentsCompleted" INTEGER NOT NULL DEFAULT 0,
    "averageEnjoymentRating" DOUBLE PRECISION,
    "xpGainedThisWeek" INTEGER NOT NULL DEFAULT 0,
    "xpGainedLastWeek" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressPrediction" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "passionArea" TEXT,
    "predictionType" "PredictionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "predictedDate" TIMESTAMP(3) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "assumedWeeklyHours" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "assumedPace" TEXT NOT NULL DEFAULT 'current',
    "isAchieved" BOOLEAN NOT NULL DEFAULT false,
    "achievedAt" TIMESTAMP(3),
    "accuracyScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "passionArea" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "dailyGoal" TEXT,
    "weeklyGoal" TEXT,
    "submissionRequired" BOOLEAN NOT NULL DEFAULT false,
    "trackProgress" BOOLEAN NOT NULL DEFAULT true,
    "showLeaderboard" BOOLEAN NOT NULL DEFAULT true,
    "completionBadgeId" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 50,
    "specialRecognition" TEXT,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "promptText" TEXT,
    "votingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "votingDeadline" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeParticipant" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "daysCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "leaderboardRank" INTEGER,
    "lastCheckIn" TIMESTAMP(3),

    CONSTRAINT "ChallengeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeSubmission" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "workUrl" TEXT,
    "mediaUrl" TEXT,
    "dayNumber" INTEGER,
    "minutesPracticed" INTEGER,
    "reflection" TEXT,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassionPassport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "passionArea" TEXT NOT NULL,
    "totalStamps" INTEGER NOT NULL DEFAULT 0,
    "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassionPassport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportStamp" (
    "id" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "subArea" TEXT NOT NULL,
    "description" TEXT,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "earnedBy" "StampSource" NOT NULL,
    "hoursLogged" INTEGER,
    "projectsCompleted" INTEGER,
    "evidence" TEXT,

    CONSTRAINT "PassportStamp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeRarity" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "badgeName" TEXT NOT NULL,
    "totalAwarded" INTEGER NOT NULL DEFAULT 0,
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "rarityPercentage" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "rarityTier" "RarityTier" NOT NULL DEFAULT 'COMMON',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BadgeRarity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalCompetition" (
    "id" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "passionArea" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "submissionDeadline" TIMESTAMP(3) NOT NULL,
    "rules" TEXT NOT NULL,
    "judgingCriteria" JSONB NOT NULL DEFAULT '[]',
    "votingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "communityVoteWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'UPCOMING',
    "xpReward" INTEGER NOT NULL DEFAULT 100,
    "firstPlaceReward" TEXT,
    "secondPlaceReward" TEXT,
    "thirdPlaceReward" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonalCompetition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionEntry" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "workUrl" TEXT,
    "mediaUrl" TEXT,
    "judgeScore" DOUBLE PRECISION,
    "communityScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION,
    "placement" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionVote" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "passionArea" TEXT,
    "previewImageUrl" TEXT,
    "layout" TEXT NOT NULL DEFAULT 'grid',
    "colorScheme" TEXT NOT NULL DEFAULT 'default',
    "sections" JSONB NOT NULL DEFAULT '[]',
    "tips" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipListing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "passionArea" TEXT,
    "type" "InternshipType" NOT NULL,
    "location" TEXT,
    "duration" TEXT,
    "hoursPerWeek" INTEGER,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "compensation" TEXT,
    "ageRange" TEXT,
    "requirements" JSONB NOT NULL DEFAULT '[]',
    "applicationUrl" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "status" "InternshipStatus" NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMP(3),
    "postedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipApplication" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "coverLetter" TEXT,
    "portfolioUrl" TEXT,
    "resumeUrl" TEXT,
    "status" "ApplicationState" NOT NULL DEFAULT 'APPLIED',
    "reviewNotes" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceProject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "passionArea" TEXT,
    "partnerOrg" TEXT,
    "location" TEXT,
    "chapterId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "totalHoursGoal" INTEGER,
    "currentHours" INTEGER NOT NULL DEFAULT 0,
    "volunteersNeeded" INTEGER NOT NULL DEFAULT 5,
    "impactSummary" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 50,
    "certificateOnComplete" BOOLEAN NOT NULL DEFAULT false,
    "status" "ServiceProjectStatus" NOT NULL DEFAULT 'RECRUITING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceVolunteer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "hoursLogged" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT,
    "reflection" TEXT,
    "completedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceVolunteer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorCertification" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "certType" TEXT NOT NULL,
    "passionArea" TEXT,
    "requirements" JSONB NOT NULL DEFAULT '[]',
    "totalRequired" INTEGER NOT NULL DEFAULT 5,
    "totalCompleted" INTEGER NOT NULL DEFAULT 0,
    "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "CertificationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,
    "certificateUrl" TEXT,
    "certifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceExchangeListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ExchangeListingType" NOT NULL,
    "category" TEXT NOT NULL,
    "passionArea" TEXT,
    "imageUrl" TEXT,
    "condition" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "status" "ExchangeListingStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceExchangeListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceExchangeRequest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceExchangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CompetitionJudges" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "ClassSession_offeringId_idx" ON "ClassSession"("offeringId");

-- CreateIndex
CREATE INDEX "ClassSession_date_idx" ON "ClassSession"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_offeringId_sessionNumber_key" ON "ClassSession"("offeringId", "sessionNumber");

-- CreateIndex
CREATE INDEX "ClassEnrollment_studentId_idx" ON "ClassEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_offeringId_idx" ON "ClassEnrollment"("offeringId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_status_idx" ON "ClassEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassEnrollment_studentId_offeringId_key" ON "ClassEnrollment"("studentId", "offeringId");

-- CreateIndex
CREATE INDEX "ClassAttendanceRecord_sessionId_idx" ON "ClassAttendanceRecord"("sessionId");

-- CreateIndex
CREATE INDEX "ClassAttendanceRecord_studentId_idx" ON "ClassAttendanceRecord"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassAttendanceRecord_sessionId_studentId_key" ON "ClassAttendanceRecord"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "ClassReminder_offeringId_idx" ON "ClassReminder"("offeringId");

-- CreateIndex
CREATE INDEX "ClassReminder_userId_idx" ON "ClassReminder"("userId");

-- CreateIndex
CREATE INDEX "ClassReminder_scheduledFor_idx" ON "ClassReminder"("scheduledFor");

-- CreateIndex
CREATE INDEX "ClassReminder_status_idx" ON "ClassReminder"("status");

-- CreateIndex
CREATE INDEX "ClassAssignment_offeringId_idx" ON "ClassAssignment"("offeringId");

-- CreateIndex
CREATE INDEX "ClassAssignmentSubmission_studentId_idx" ON "ClassAssignmentSubmission"("studentId");

-- CreateIndex
CREATE INDEX "ClassAssignmentSubmission_assignmentId_idx" ON "ClassAssignmentSubmission"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassAssignmentSubmission_assignmentId_studentId_key" ON "ClassAssignmentSubmission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "GroupProject_assignmentId_idx" ON "GroupProject"("assignmentId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "LearningPath_studentId_idx" ON "LearningPath"("studentId");

-- CreateIndex
CREATE INDEX "LearningPath_passionArea_idx" ON "LearningPath"("passionArea");

-- CreateIndex
CREATE INDEX "LearningPath_status_idx" ON "LearningPath"("status");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_studentId_date_idx" ON "AnalyticsSnapshot"("studentId", "date");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_date_idx" ON "AnalyticsSnapshot"("date");

-- CreateIndex
CREATE INDEX "ProgressPrediction_studentId_idx" ON "ProgressPrediction"("studentId");

-- CreateIndex
CREATE INDEX "ProgressPrediction_predictionType_idx" ON "ProgressPrediction"("predictionType");

-- CreateIndex
CREATE INDEX "ProgressPrediction_predictedDate_idx" ON "ProgressPrediction"("predictedDate");

-- CreateIndex
CREATE INDEX "Challenge_type_status_idx" ON "Challenge"("type", "status");

-- CreateIndex
CREATE INDEX "Challenge_startDate_endDate_idx" ON "Challenge"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Challenge_passionArea_idx" ON "Challenge"("passionArea");

-- CreateIndex
CREATE INDEX "ChallengeParticipant_studentId_idx" ON "ChallengeParticipant"("studentId");

-- CreateIndex
CREATE INDEX "ChallengeParticipant_challengeId_status_idx" ON "ChallengeParticipant"("challengeId", "status");

-- CreateIndex
CREATE INDEX "ChallengeParticipant_leaderboardRank_idx" ON "ChallengeParticipant"("leaderboardRank");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipant_challengeId_studentId_key" ON "ChallengeParticipant"("challengeId", "studentId");

-- CreateIndex
CREATE INDEX "ChallengeSubmission_challengeId_studentId_idx" ON "ChallengeSubmission"("challengeId", "studentId");

-- CreateIndex
CREATE INDEX "ChallengeSubmission_challengeId_voteCount_idx" ON "ChallengeSubmission"("challengeId", "voteCount");

-- CreateIndex
CREATE INDEX "ChallengeSubmission_submittedAt_idx" ON "ChallengeSubmission"("submittedAt");

-- CreateIndex
CREATE INDEX "PassionPassport_studentId_idx" ON "PassionPassport"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PassionPassport_studentId_passionArea_key" ON "PassionPassport"("studentId", "passionArea");

-- CreateIndex
CREATE INDEX "PassportStamp_passportId_idx" ON "PassportStamp"("passportId");

-- CreateIndex
CREATE UNIQUE INDEX "PassportStamp_passportId_subArea_key" ON "PassportStamp"("passportId", "subArea");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeRarity_badgeId_key" ON "BadgeRarity"("badgeId");

-- CreateIndex
CREATE INDEX "BadgeRarity_rarityTier_idx" ON "BadgeRarity"("rarityTier");

-- CreateIndex
CREATE INDEX "BadgeRarity_rarityPercentage_idx" ON "BadgeRarity"("rarityPercentage");

-- CreateIndex
CREATE INDEX "SeasonalCompetition_status_idx" ON "SeasonalCompetition"("status");

-- CreateIndex
CREATE INDEX "SeasonalCompetition_passionArea_idx" ON "SeasonalCompetition"("passionArea");

-- CreateIndex
CREATE INDEX "SeasonalCompetition_startDate_endDate_idx" ON "SeasonalCompetition"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "CompetitionEntry_competitionId_finalScore_idx" ON "CompetitionEntry"("competitionId", "finalScore");

-- CreateIndex
CREATE INDEX "CompetitionEntry_studentId_idx" ON "CompetitionEntry"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionEntry_competitionId_studentId_key" ON "CompetitionEntry"("competitionId", "studentId");

-- CreateIndex
CREATE INDEX "CompetitionVote_competitionId_idx" ON "CompetitionVote"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionVote_entryId_idx" ON "CompetitionVote"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionVote_entryId_voterId_key" ON "CompetitionVote"("entryId", "voterId");

-- CreateIndex
CREATE INDEX "PortfolioTemplate_passionArea_idx" ON "PortfolioTemplate"("passionArea");

-- CreateIndex
CREATE INDEX "PortfolioTemplate_isActive_order_idx" ON "PortfolioTemplate"("isActive", "order");

-- CreateIndex
CREATE INDEX "InternshipListing_status_idx" ON "InternshipListing"("status");

-- CreateIndex
CREATE INDEX "InternshipListing_passionArea_idx" ON "InternshipListing"("passionArea");

-- CreateIndex
CREATE INDEX "InternshipListing_type_idx" ON "InternshipListing"("type");

-- CreateIndex
CREATE INDEX "InternshipListing_deadline_idx" ON "InternshipListing"("deadline");

-- CreateIndex
CREATE INDEX "InternshipApplication_studentId_idx" ON "InternshipApplication"("studentId");

-- CreateIndex
CREATE INDEX "InternshipApplication_status_idx" ON "InternshipApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InternshipApplication_listingId_studentId_key" ON "InternshipApplication"("listingId", "studentId");

-- CreateIndex
CREATE INDEX "ServiceProject_status_idx" ON "ServiceProject"("status");

-- CreateIndex
CREATE INDEX "ServiceProject_passionArea_idx" ON "ServiceProject"("passionArea");

-- CreateIndex
CREATE INDEX "ServiceProject_chapterId_idx" ON "ServiceProject"("chapterId");

-- CreateIndex
CREATE INDEX "ServiceVolunteer_studentId_idx" ON "ServiceVolunteer"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceVolunteer_projectId_studentId_key" ON "ServiceVolunteer"("projectId", "studentId");

-- CreateIndex
CREATE INDEX "InstructorCertification_instructorId_idx" ON "InstructorCertification"("instructorId");

-- CreateIndex
CREATE INDEX "InstructorCertification_status_idx" ON "InstructorCertification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorCertification_instructorId_certType_passionArea_key" ON "InstructorCertification"("instructorId", "certType", "passionArea");

-- CreateIndex
CREATE INDEX "ResourceExchangeListing_type_status_idx" ON "ResourceExchangeListing"("type", "status");

-- CreateIndex
CREATE INDEX "ResourceExchangeListing_category_idx" ON "ResourceExchangeListing"("category");

-- CreateIndex
CREATE INDEX "ResourceExchangeListing_passionArea_idx" ON "ResourceExchangeListing"("passionArea");

-- CreateIndex
CREATE INDEX "ResourceExchangeListing_userId_idx" ON "ResourceExchangeListing"("userId");

-- CreateIndex
CREATE INDEX "ResourceExchangeRequest_requesterId_idx" ON "ResourceExchangeRequest"("requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceExchangeRequest_listingId_requesterId_key" ON "ResourceExchangeRequest"("listingId", "requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "_CompetitionJudges_AB_unique" ON "_CompetitionJudges"("A", "B");

-- CreateIndex
CREATE INDEX "_CompetitionJudges_B_index" ON "_CompetitionJudges"("B");

-- CreateIndex
CREATE INDEX "AlumniQuestion_studentId_idx" ON "AlumniQuestion"("studentId");

-- CreateIndex
CREATE INDEX "AlumniQuestion_advisorId_idx" ON "AlumniQuestion"("advisorId");

-- CreateIndex
CREATE INDEX "AlumniQuestion_status_idx" ON "AlumniQuestion"("status");

-- CreateIndex
CREATE INDEX "Assignment_courseId_idx" ON "Assignment"("courseId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_studentId_idx" ON "AssignmentSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_key" ON "AssignmentSubmission"("assignmentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_name_key" ON "Badge"("name");

-- CreateIndex
CREATE INDEX "Badge_category_idx" ON "Badge"("category");

-- CreateIndex
CREATE INDEX "Badge_rarity_idx" ON "Badge"("rarity");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_resourceType_resourceId_key" ON "Bookmark"("userId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "BookmarkFolder_userId_idx" ON "BookmarkFolder"("userId");

-- CreateIndex
CREATE INDEX "BreakthroughMoment_studentId_idx" ON "BreakthroughMoment"("studentId");

-- CreateIndex
CREATE INDEX "BreakthroughMoment_passionId_idx" ON "BreakthroughMoment"("passionId");

-- CreateIndex
CREATE INDEX "BreakthroughMoment_date_idx" ON "BreakthroughMoment"("date");

-- CreateIndex
CREATE INDEX "ChallengeCompletion_studentId_idx" ON "ChallengeCompletion"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeCompletion_studentId_challengeId_key" ON "ChallengeCompletion"("studentId", "challengeId");

-- CreateIndex
CREATE INDEX "ClassOffering_templateId_idx" ON "ClassOffering"("templateId");

-- CreateIndex
CREATE INDEX "ClassOffering_instructorId_idx" ON "ClassOffering"("instructorId");

-- CreateIndex
CREATE INDEX "ClassOffering_startDate_idx" ON "ClassOffering"("startDate");

-- CreateIndex
CREATE INDEX "ClassOffering_status_idx" ON "ClassOffering"("status");

-- CreateIndex
CREATE INDEX "ClassTemplate_interestArea_idx" ON "ClassTemplate"("interestArea");

-- CreateIndex
CREATE INDEX "ClassTemplate_difficultyLevel_idx" ON "ClassTemplate"("difficultyLevel");

-- CreateIndex
CREATE INDEX "ClassTemplate_createdById_idx" ON "ClassTemplate"("createdById");

-- CreateIndex
CREATE INDEX "CompetitionChecklist_userId_idx" ON "CompetitionChecklist"("userId");

-- CreateIndex
CREATE INDEX "CompetitionChecklistItem_checklistId_sortOrder_idx" ON "CompetitionChecklistItem"("checklistId", "sortOrder");

-- CreateIndex
CREATE INDEX "CourseInstructor_instructorId_idx" ON "CourseInstructor"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseInstructor_courseId_instructorId_key" ON "CourseInstructor"("courseId", "instructorId");

-- CreateIndex
CREATE INDEX "CourseProposal_proposedById_status_idx" ON "CourseProposal"("proposedById", "status");

-- CreateIndex
CREATE INDEX "CourseProposal_status_idx" ON "CourseProposal"("status");

-- CreateIndex
CREATE INDEX "CourseReview_courseId_rating_idx" ON "CourseReview"("courseId", "rating");

-- CreateIndex
CREATE INDEX "CourseReview_userId_idx" ON "CourseReview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseReview_courseId_userId_key" ON "CourseReview"("courseId", "userId");

-- CreateIndex
CREATE INDEX "CuratedResource_passionId_idx" ON "CuratedResource"("passionId");

-- CreateIndex
CREATE INDEX "CuratedResource_resourceType_idx" ON "CuratedResource"("resourceType");

-- CreateIndex
CREATE INDEX "CuratedResource_level_idx" ON "CuratedResource"("level");

-- CreateIndex
CREATE INDEX "CurriculumFeedback_instructorId_idx" ON "CurriculumFeedback"("instructorId");

-- CreateIndex
CREATE INDEX "CurriculumFeedback_status_idx" ON "CurriculumFeedback"("status");

-- CreateIndex
CREATE INDEX "CustomGoal_userId_status_idx" ON "CustomGoal"("userId", "status");

-- CreateIndex
CREATE INDEX "CustomGoalMilestone_goalId_idx" ON "CustomGoalMilestone"("goalId");

-- CreateIndex
CREATE INDEX "CustomGoalUpdate_goalId_createdAt_idx" ON "CustomGoalUpdate"("goalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyInspiration_date_key" ON "DailyInspiration"("date");

-- CreateIndex
CREATE INDEX "FeedbackTemplate_instructorId_idx" ON "FeedbackTemplate"("instructorId");

-- CreateIndex
CREATE INDEX "FileUpload_userId_idx" ON "FileUpload"("userId");

-- CreateIndex
CREATE INDEX "FileUpload_category_idx" ON "FileUpload"("category");

-- CreateIndex
CREATE INDEX "FileUpload_entityId_entityType_idx" ON "FileUpload"("entityId", "entityType");

-- CreateIndex
CREATE INDEX "InterestConnection_passion1Id_idx" ON "InterestConnection"("passion1Id");

-- CreateIndex
CREATE INDEX "InterestConnection_passion2Id_idx" ON "InterestConnection"("passion2Id");

-- CreateIndex
CREATE UNIQUE INDEX "InterestConnection_passion1Id_passion2Id_key" ON "InterestConnection"("passion1Id", "passion2Id");

-- CreateIndex
CREATE INDEX "LearningModule_passionId_idx" ON "LearningModule"("passionId");

-- CreateIndex
CREATE INDEX "LearningModule_level_idx" ON "LearningModule"("level");

-- CreateIndex
CREATE INDEX "LearningModule_isActive_idx" ON "LearningModule"("isActive");

-- CreateIndex
CREATE INDEX "LearningNote_userId_courseId_idx" ON "LearningNote"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningStyleProfile_studentId_key" ON "LearningStyleProfile"("studentId");

-- CreateIndex
CREATE INDEX "LessonPlan_authorId_idx" ON "LessonPlan"("authorId");

-- CreateIndex
CREATE INDEX "MentorAnswer_questionId_idx" ON "MentorAnswer"("questionId");

-- CreateIndex
CREATE INDEX "MentorAnswer_mentorId_idx" ON "MentorAnswer"("mentorId");

-- CreateIndex
CREATE INDEX "MentorFeedbackRequest_studentId_idx" ON "MentorFeedbackRequest"("studentId");

-- CreateIndex
CREATE INDEX "MentorFeedbackRequest_passionId_idx" ON "MentorFeedbackRequest"("passionId");

-- CreateIndex
CREATE INDEX "MentorFeedbackRequest_status_idx" ON "MentorFeedbackRequest"("status");

-- CreateIndex
CREATE INDEX "MentorQuestion_studentId_idx" ON "MentorQuestion"("studentId");

-- CreateIndex
CREATE INDEX "MentorQuestion_passionId_idx" ON "MentorQuestion"("passionId");

-- CreateIndex
CREATE INDEX "MentorQuestion_status_idx" ON "MentorQuestion"("status");

-- CreateIndex
CREATE INDEX "MentorResponse_requestId_idx" ON "MentorResponse"("requestId");

-- CreateIndex
CREATE INDEX "MentorResponse_mentorId_idx" ON "MentorResponse"("mentorId");

-- CreateIndex
CREATE INDEX "ModuleWatchProgress_studentId_idx" ON "ModuleWatchProgress"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleWatchProgress_studentId_moduleId_key" ON "ModuleWatchProgress"("studentId", "moduleId");

-- CreateIndex
CREATE INDEX "MotivationBoost_category_idx" ON "MotivationBoost"("category");

-- CreateIndex
CREATE INDEX "MotivationBoost_isActive_idx" ON "MotivationBoost"("isActive");

-- CreateIndex
CREATE INDEX "OfficeHours_instructorId_isActive_idx" ON "OfficeHours"("instructorId", "isActive");

-- CreateIndex
CREATE INDEX "OfficeHoursBooking_studentId_idx" ON "OfficeHoursBooking"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeHoursBooking_officeHoursId_date_startTime_key" ON "OfficeHoursBooking"("officeHoursId", "date", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "ParentProfile_userId_key" ON "ParentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentSettings_parentId_key" ON "ParentSettings"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudentConnection_parentId_studentId_key" ON "ParentStudentConnection"("parentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PassionArea_name_key" ON "PassionArea"("name");

-- CreateIndex
CREATE INDEX "PassionArea_category_idx" ON "PassionArea"("category");

-- CreateIndex
CREATE INDEX "PassionArea_isActive_idx" ON "PassionArea"("isActive");

-- CreateIndex
CREATE INDEX "PassionCertification_passionId_idx" ON "PassionCertification"("passionId");

-- CreateIndex
CREATE INDEX "PassionCertification_level_idx" ON "PassionCertification"("level");

-- CreateIndex
CREATE INDEX "PassionCertification_isActive_idx" ON "PassionCertification"("isActive");

-- CreateIndex
CREATE INDEX "PassionQuizResult_studentId_idx" ON "PassionQuizResult"("studentId");

-- CreateIndex
CREATE INDEX "PassionQuizResult_quizType_idx" ON "PassionQuizResult"("quizType");

-- CreateIndex
CREATE INDEX "PassionShowcase_date_idx" ON "PassionShowcase"("date");

-- CreateIndex
CREATE INDEX "PassionShowcase_status_idx" ON "PassionShowcase"("status");

-- CreateIndex
CREATE INDEX "PassionShowcase_chapterId_idx" ON "PassionShowcase"("chapterId");

-- CreateIndex
CREATE INDEX "PassionTimeline_studentId_idx" ON "PassionTimeline"("studentId");

-- CreateIndex
CREATE INDEX "PassionTimeline_passionId_idx" ON "PassionTimeline"("passionId");

-- CreateIndex
CREATE UNIQUE INDEX "PassionTimeline_studentId_passionId_key" ON "PassionTimeline"("studentId", "passionId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PeerObservation_observerId_idx" ON "PeerObservation"("observerId");

-- CreateIndex
CREATE INDEX "PeerObservation_observeeId_idx" ON "PeerObservation"("observeeId");

-- CreateIndex
CREATE INDEX "PeerObservation_scheduledAt_idx" ON "PeerObservation"("scheduledAt");

-- CreateIndex
CREATE INDEX "PeerRecognition_toUserId_idx" ON "PeerRecognition"("toUserId");

-- CreateIndex
CREATE INDEX "PeerRecognition_fromUserId_idx" ON "PeerRecognition"("fromUserId");

-- CreateIndex
CREATE INDEX "PeerRecognition_createdAt_idx" ON "PeerRecognition"("createdAt");

-- CreateIndex
CREATE INDEX "PersonalBest_studentId_idx" ON "PersonalBest"("studentId");

-- CreateIndex
CREATE INDEX "PersonalBest_passionId_idx" ON "PersonalBest"("passionId");

-- CreateIndex
CREATE INDEX "PersonalBest_achievedAt_idx" ON "PersonalBest"("achievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalizationSettings_userId_key" ON "PersonalizationSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_userId_key" ON "Portfolio"("userId");

-- CreateIndex
CREATE INDEX "PortfolioItem_portfolioId_sortOrder_idx" ON "PortfolioItem"("portfolioId", "sortOrder");

-- CreateIndex
CREATE INDEX "PortfolioSection_portfolioId_idx" ON "PortfolioSection"("portfolioId");

-- CreateIndex
CREATE INDEX "PortfolioSection_order_idx" ON "PortfolioSection"("order");

-- CreateIndex
CREATE INDEX "PortfolioSectionItem_sectionId_order_idx" ON "PortfolioSectionItem"("sectionId", "order");

-- CreateIndex
CREATE INDEX "PracticeLog_studentId_idx" ON "PracticeLog"("studentId");

-- CreateIndex
CREATE INDEX "PracticeLog_passionId_idx" ON "PracticeLog"("passionId");

-- CreateIndex
CREATE INDEX "PracticeLog_date_idx" ON "PracticeLog"("date");

-- CreateIndex
CREATE INDEX "ProfessionalDevelopment_instructorId_idx" ON "ProfessionalDevelopment"("instructorId");

-- CreateIndex
CREATE INDEX "ProfessionalDevelopment_date_idx" ON "ProfessionalDevelopment"("date");

-- CreateIndex
CREATE INDEX "ProgressComparison_studentId_idx" ON "ProgressComparison"("studentId");

-- CreateIndex
CREATE INDEX "ProgressComparison_passionId_idx" ON "ProgressComparison"("passionId");

-- CreateIndex
CREATE INDEX "ProgressComparison_isPublic_idx" ON "ProgressComparison"("isPublic");

-- CreateIndex
CREATE INDEX "ProjectDocumentation_projectId_docType_idx" ON "ProjectDocumentation"("projectId", "docType");

-- CreateIndex
CREATE INDEX "ProjectFeedback_cycleId_idx" ON "ProjectFeedback"("cycleId");

-- CreateIndex
CREATE INDEX "ProjectFeedback_reviewerId_idx" ON "ProjectFeedback"("reviewerId");

-- CreateIndex
CREATE INDEX "ProjectFeedbackCycle_projectId_idx" ON "ProjectFeedbackCycle"("projectId");

-- CreateIndex
CREATE INDEX "ProjectFeedbackCycle_status_idx" ON "ProjectFeedbackCycle"("status");

-- CreateIndex
CREATE INDEX "ProjectMilestone_projectId_order_idx" ON "ProjectMilestone"("projectId", "order");

-- CreateIndex
CREATE INDEX "ProjectTracker_studentId_idx" ON "ProjectTracker"("studentId");

-- CreateIndex
CREATE INDEX "ProjectTracker_passionId_idx" ON "ProjectTracker"("passionId");

-- CreateIndex
CREATE INDEX "ProjectTracker_status_idx" ON "ProjectTracker"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PublicPortfolio_studentId_key" ON "PublicPortfolio"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicPortfolio_customUrl_key" ON "PublicPortfolio"("customUrl");

-- CreateIndex
CREATE INDEX "PublicPortfolio_customUrl_idx" ON "PublicPortfolio"("customUrl");

-- CreateIndex
CREATE INDEX "PublicPortfolio_isPublic_idx" ON "PublicPortfolio"("isPublic");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizType_idx" ON "QuizQuestion"("quizType");

-- CreateIndex
CREATE INDEX "QuizQuestion_isActive_idx" ON "QuizQuestion"("isActive");

-- CreateIndex
CREATE INDEX "RecognitionAward_category_idx" ON "RecognitionAward"("category");

-- CreateIndex
CREATE INDEX "RecognitionAward_isActive_idx" ON "RecognitionAward"("isActive");

-- CreateIndex
CREATE INDEX "ResourceBookmark_userId_folderId_idx" ON "ResourceBookmark"("userId", "folderId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceBookmark_userId_resourceId_key" ON "ResourceBookmark"("userId", "resourceId");

-- CreateIndex
CREATE INDEX "ResourceRecommendation_passionId_idx" ON "ResourceRecommendation"("passionId");

-- CreateIndex
CREATE INDEX "ResourceRecommendation_resourceType_idx" ON "ResourceRecommendation"("resourceType");

-- CreateIndex
CREATE INDEX "ResourceRecommendation_level_idx" ON "ResourceRecommendation"("level");

-- CreateIndex
CREATE INDEX "ResourceRequest_studentId_idx" ON "ResourceRequest"("studentId");

-- CreateIndex
CREATE INDEX "ResourceRequest_status_idx" ON "ResourceRequest"("status");

-- CreateIndex
CREATE INDEX "ResourceRequest_passionId_idx" ON "ResourceRequest"("passionId");

-- CreateIndex
CREATE UNIQUE INDEX "SelfCheckIn_sessionId_key" ON "SelfCheckIn"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SelfCheckIn_code_key" ON "SelfCheckIn"("code");

-- CreateIndex
CREATE INDEX "SelfCheckIn_code_idx" ON "SelfCheckIn"("code");

-- CreateIndex
CREATE INDEX "SelfCheckIn_sessionId_idx" ON "SelfCheckIn"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRecap_sessionId_key" ON "SessionRecap"("sessionId");

-- CreateIndex
CREATE INDEX "SessionRecap_instructorId_idx" ON "SessionRecap"("instructorId");

-- CreateIndex
CREATE INDEX "SessionWatchHistory_studentId_idx" ON "SessionWatchHistory"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionWatchHistory_studentId_sessionId_key" ON "SessionWatchHistory"("studentId", "sessionId");

-- CreateIndex
CREATE INDEX "ShowcasePresentation_showcaseId_idx" ON "ShowcasePresentation"("showcaseId");

-- CreateIndex
CREATE INDEX "ShowcasePresentation_studentId_idx" ON "ShowcasePresentation"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE INDEX "SkillBadge_userId_idx" ON "SkillBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillBadge_skillId_userId_key" ON "SkillBadge"("skillId", "userId");

-- CreateIndex
CREATE INDEX "SkillChallenge_passionId_idx" ON "SkillChallenge"("passionId");

-- CreateIndex
CREATE INDEX "SkillChallenge_difficulty_idx" ON "SkillChallenge"("difficulty");

-- CreateIndex
CREATE INDEX "SkillChallenge_isActive_idx" ON "SkillChallenge"("isActive");

-- CreateIndex
CREATE INDEX "SkillChallengeCompletion_studentId_idx" ON "SkillChallengeCompletion"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillChallengeCompletion_studentId_challengeId_key" ON "SkillChallengeCompletion"("studentId", "challengeId");

-- CreateIndex
CREATE INDEX "SkillConnection_skill1_idx" ON "SkillConnection"("skill1");

-- CreateIndex
CREATE INDEX "SkillConnection_skill2_idx" ON "SkillConnection"("skill2");

-- CreateIndex
CREATE UNIQUE INDEX "SkillConnection_skill1_skill2_key" ON "SkillConnection"("skill1", "skill2");

-- CreateIndex
CREATE INDEX "SkillNode_treeId_idx" ON "SkillNode"("treeId");

-- CreateIndex
CREATE INDEX "SkillNode_level_idx" ON "SkillNode"("level");

-- CreateIndex
CREATE INDEX "SkillTree_passionId_idx" ON "SkillTree"("passionId");

-- CreateIndex
CREATE INDEX "StudentAward_studentId_idx" ON "StudentAward"("studentId");

-- CreateIndex
CREATE INDEX "StudentAward_awardId_idx" ON "StudentAward"("awardId");

-- CreateIndex
CREATE INDEX "StudentAward_awardedAt_idx" ON "StudentAward"("awardedAt");

-- CreateIndex
CREATE INDEX "StudentBadge_studentId_idx" ON "StudentBadge"("studentId");

-- CreateIndex
CREATE INDEX "StudentBadge_earnedAt_idx" ON "StudentBadge"("earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentBadge_studentId_badgeId_key" ON "StudentBadge"("studentId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCertification_verificationCode_key" ON "StudentCertification"("verificationCode");

-- CreateIndex
CREATE INDEX "StudentCertification_studentId_idx" ON "StudentCertification"("studentId");

-- CreateIndex
CREATE INDEX "StudentCertification_earnedAt_idx" ON "StudentCertification"("earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCertification_studentId_certificationId_key" ON "StudentCertification"("studentId", "certificationId");

-- CreateIndex
CREATE INDEX "StudentInterest_studentId_idx" ON "StudentInterest"("studentId");

-- CreateIndex
CREATE INDEX "StudentInterest_passionId_idx" ON "StudentInterest"("passionId");

-- CreateIndex
CREATE INDEX "StudentInterest_level_idx" ON "StudentInterest"("level");

-- CreateIndex
CREATE UNIQUE INDEX "StudentInterest_studentId_passionId_key" ON "StudentInterest"("studentId", "passionId");

-- CreateIndex
CREATE INDEX "StudentMotivationLog_studentId_idx" ON "StudentMotivationLog"("studentId");

-- CreateIndex
CREATE INDEX "StudentMotivationLog_boostId_idx" ON "StudentMotivationLog"("boostId");

-- CreateIndex
CREATE INDEX "StudentOfMonth_studentId_idx" ON "StudentOfMonth"("studentId");

-- CreateIndex
CREATE INDEX "StudentOfMonth_month_idx" ON "StudentOfMonth"("month");

-- CreateIndex
CREATE INDEX "StudentOfMonth_chapterId_idx" ON "StudentOfMonth"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentOnboarding_userId_key" ON "StudentOnboarding"("userId");

-- CreateIndex
CREATE INDEX "StudentSkillProgress_studentId_idx" ON "StudentSkillProgress"("studentId");

-- CreateIndex
CREATE INDEX "StudentSkillProgress_status_idx" ON "StudentSkillProgress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSkillProgress_studentId_skillNodeId_key" ON "StudentSkillProgress"("studentId", "skillNodeId");

-- CreateIndex
CREATE INDEX "StudentSpotlight_studentId_idx" ON "StudentSpotlight"("studentId");

-- CreateIndex
CREATE INDEX "StudentSpotlight_nominatedById_idx" ON "StudentSpotlight"("nominatedById");

-- CreateIndex
CREATE INDEX "StudentSpotlight_term_idx" ON "StudentSpotlight"("term");

-- CreateIndex
CREATE UNIQUE INDEX "StudentXP_studentId_key" ON "StudentXP"("studentId");

-- CreateIndex
CREATE INDEX "StudentXP_totalXP_idx" ON "StudentXP"("totalXP");

-- CreateIndex
CREATE INDEX "StudentXP_currentLevel_idx" ON "StudentXP"("currentLevel");

-- CreateIndex
CREATE INDEX "StudyGroup_courseId_idx" ON "StudyGroup"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGroupMember_groupId_userId_key" ON "StudyGroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "StudyGroupMessage_groupId_createdAt_idx" ON "StudyGroupMessage"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "StudyGroupResource_groupId_idx" ON "StudyGroupResource"("groupId");

-- CreateIndex
CREATE INDEX "SubstituteRequest_courseId_idx" ON "SubstituteRequest"("courseId");

-- CreateIndex
CREATE INDEX "SubstituteRequest_requestedById_idx" ON "SubstituteRequest"("requestedById");

-- CreateIndex
CREATE INDEX "SubstituteRequest_status_idx" ON "SubstituteRequest"("status");

-- CreateIndex
CREATE INDEX "SuccessStory_passionId_idx" ON "SuccessStory"("passionId");

-- CreateIndex
CREATE INDEX "SuccessStory_featured_idx" ON "SuccessStory"("featured");

-- CreateIndex
CREATE INDEX "SuccessStory_views_idx" ON "SuccessStory"("views");

-- CreateIndex
CREATE INDEX "TalentChallenge_isActive_idx" ON "TalentChallenge"("isActive");

-- CreateIndex
CREATE INDEX "TeamAchievement_awardedAt_idx" ON "TeamAchievement"("awardedAt");

-- CreateIndex
CREATE INDEX "TeamAchievement_category_idx" ON "TeamAchievement"("category");

-- CreateIndex
CREATE INDEX "Technique_passionId_idx" ON "Technique"("passionId");

-- CreateIndex
CREATE INDEX "Technique_level_idx" ON "Technique"("level");

-- CreateIndex
CREATE INDEX "Technique_isActive_idx" ON "Technique"("isActive");

-- CreateIndex
CREATE INDEX "TimelineEntry_studentId_date_idx" ON "TimelineEntry"("studentId", "date");

-- CreateIndex
CREATE INDEX "TimelineEntry_passionId_idx" ON "TimelineEntry"("passionId");

-- CreateIndex
CREATE INDEX "TimelineEntry_entryType_idx" ON "TimelineEntry"("entryType");

-- CreateIndex
CREATE INDEX "TryItSession_passionId_idx" ON "TryItSession"("passionId");

-- CreateIndex
CREATE INDEX "TryItSession_isActive_idx" ON "TryItSession"("isActive");

-- CreateIndex
CREATE INDEX "WaitlistEntry_courseId_status_idx" ON "WaitlistEntry"("courseId", "status");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_idx" ON "WaitlistEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_userId_courseId_key" ON "WaitlistEntry"("userId", "courseId");

-- CreateIndex
CREATE INDEX "WallOfFame_studentId_idx" ON "WallOfFame"("studentId");

-- CreateIndex
CREATE INDEX "WallOfFame_passionId_idx" ON "WallOfFame"("passionId");

-- CreateIndex
CREATE INDEX "WallOfFame_displayOrder_idx" ON "WallOfFame"("displayOrder");

-- CreateIndex
CREATE INDEX "WallOfFame_isActive_idx" ON "WallOfFame"("isActive");

-- CreateIndex
CREATE INDEX "WorkshopEnrollment_studentId_idx" ON "WorkshopEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "WorkshopEnrollment_seriesId_idx" ON "WorkshopEnrollment"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopEnrollment_studentId_seriesId_key" ON "WorkshopEnrollment"("studentId", "seriesId");

-- CreateIndex
CREATE INDEX "WorkshopSeries_passionId_idx" ON "WorkshopSeries"("passionId");

-- CreateIndex
CREATE INDEX "WorkshopSeries_difficulty_idx" ON "WorkshopSeries"("difficulty");

-- CreateIndex
CREATE INDEX "WorkshopSeries_isActive_idx" ON "WorkshopSeries"("isActive");

-- CreateIndex
CREATE INDEX "WorkshopSession_seriesId_sessionNumber_idx" ON "WorkshopSession"("seriesId", "sessionNumber");

-- CreateIndex
CREATE INDEX "XPTransaction_studentId_idx" ON "XPTransaction"("studentId");

-- CreateIndex
CREATE INDEX "XPTransaction_createdAt_idx" ON "XPTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonActivity" ADD CONSTRAINT "LessonActivity_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "LessonPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroup" ADD CONSTRAINT "StudyGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroup" ADD CONSTRAINT "StudyGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMessage" ADD CONSTRAINT "StudyGroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMessage" ADD CONSTRAINT "StudyGroupMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupResource" ADD CONSTRAINT "StudyGroupResource_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupResource" ADD CONSTRAINT "StudyGroupResource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningNote" ADD CONSTRAINT "LearningNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningNote" ADD CONSTRAINT "LearningNote_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillBadge" ADD CONSTRAINT "SkillBadge_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillBadge" ADD CONSTRAINT "SkillBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumniQuestion" ADD CONSTRAINT "AlumniQuestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumniQuestion" ADD CONSTRAINT "AlumniQuestion_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomGoal" ADD CONSTRAINT "CustomGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomGoalMilestone" ADD CONSTRAINT "CustomGoalMilestone_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "CustomGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomGoalUpdate" ADD CONSTRAINT "CustomGoalUpdate_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "CustomGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfCheckIn" ADD CONSTRAINT "SelfCheckIn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerRecognition" ADD CONSTRAINT "PeerRecognition_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerRecognition" ADD CONSTRAINT "PeerRecognition_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeHours" ADD CONSTRAINT "OfficeHours_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeHoursBooking" ADD CONSTRAINT "OfficeHoursBooking_officeHoursId_fkey" FOREIGN KEY ("officeHoursId") REFERENCES "OfficeHours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeHoursBooking" ADD CONSTRAINT "OfficeHoursBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBookmark" ADD CONSTRAINT "ResourceBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBookmark" ADD CONSTRAINT "ResourceBookmark_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBookmark" ADD CONSTRAINT "ResourceBookmark_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "BookmarkFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookmarkFolder" ADD CONSTRAINT "BookmarkFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProposal" ADD CONSTRAINT "CourseProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProposal" ADD CONSTRAINT "CourseProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProposal" ADD CONSTRAINT "CourseProposal_approvedCourseId_fkey" FOREIGN KEY ("approvedCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionChecklist" ADD CONSTRAINT "CompetitionChecklist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionChecklist" ADD CONSTRAINT "CompetitionChecklist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionChecklistItem" ADD CONSTRAINT "CompetitionChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "CompetitionChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerObservation" ADD CONSTRAINT "PeerObservation_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerObservation" ADD CONSTRAINT "PeerObservation_observeeId_fkey" FOREIGN KEY ("observeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerObservation" ADD CONSTRAINT "PeerObservation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackTemplate" ADD CONSTRAINT "FeedbackTemplate_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRecap" ADD CONSTRAINT "SessionRecap_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRecap" ADD CONSTRAINT "SessionRecap_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstituteRequest" ADD CONSTRAINT "SubstituteRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstituteRequest" ADD CONSTRAINT "SubstituteRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstituteRequest" ADD CONSTRAINT "SubstituteRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalDevelopment" ADD CONSTRAINT "ProfessionalDevelopment_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumFeedback" ADD CONSTRAINT "CurriculumFeedback_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumFeedback" ADD CONSTRAINT "CurriculumFeedback_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumFeedback" ADD CONSTRAINT "CurriculumFeedback_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSpotlight" ADD CONSTRAINT "StudentSpotlight_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSpotlight" ADD CONSTRAINT "StudentSpotlight_nominatedById_fkey" FOREIGN KEY ("nominatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSpotlight" ADD CONSTRAINT "StudentSpotlight_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentInterest" ADD CONSTRAINT "StudentInterest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentInterest" ADD CONSTRAINT "StudentInterest_passionId_fkey" FOREIGN KEY ("passionId") REFERENCES "PassionArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassionQuizResult" ADD CONSTRAINT "PassionQuizResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentXP" ADD CONSTRAINT "StudentXP_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBadge" ADD CONSTRAINT "StudentBadge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBadge" ADD CONSTRAINT "StudentBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "TalentChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionWatchHistory" ADD CONSTRAINT "SessionWatchHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionWatchHistory" ADD CONSTRAINT "SessionWatchHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TryItSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillNode" ADD CONSTRAINT "SkillNode_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "SkillTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSkillProgress" ADD CONSTRAINT "StudentSkillProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSkillProgress" ADD CONSTRAINT "StudentSkillProgress_skillNodeId_fkey" FOREIGN KEY ("skillNodeId") REFERENCES "SkillNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleWatchProgress" ADD CONSTRAINT "ModuleWatchProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleWatchProgress" ADD CONSTRAINT "ModuleWatchProgress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "LearningModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeLog" ADD CONSTRAINT "PracticeLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillChallengeCompletion" ADD CONSTRAINT "SkillChallengeCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillChallengeCompletion" ADD CONSTRAINT "SkillChallengeCompletion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "SkillChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningStyleProfile" ADD CONSTRAINT "LearningStyleProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalBest" ADD CONSTRAINT "PersonalBest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "PassionTimeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopSession" ADD CONSTRAINT "WorkshopSession_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "WorkshopSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopEnrollment" ADD CONSTRAINT "WorkshopEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopEnrollment" ADD CONSTRAINT "WorkshopEnrollment_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "WorkshopSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCertification" ADD CONSTRAINT "StudentCertification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCertification" ADD CONSTRAINT "StudentCertification_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "PassionCertification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTracker" ADD CONSTRAINT "ProjectTracker_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectTracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocumentation" ADD CONSTRAINT "ProjectDocumentation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectTracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressComparison" ADD CONSTRAINT "ProgressComparison_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAward" ADD CONSTRAINT "StudentAward_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAward" ADD CONSTRAINT "StudentAward_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "RecognitionAward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAward" ADD CONSTRAINT "StudentAward_awardedBy_fkey" FOREIGN KEY ("awardedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakthroughMoment" ADD CONSTRAINT "BreakthroughMoment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowcasePresentation" ADD CONSTRAINT "ShowcasePresentation_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "PassionShowcase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowcasePresentation" ADD CONSTRAINT "ShowcasePresentation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallOfFame" ADD CONSTRAINT "WallOfFame_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentOfMonth" ADD CONSTRAINT "StudentOfMonth_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorFeedbackRequest" ADD CONSTRAINT "MentorFeedbackRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorResponse" ADD CONSTRAINT "MentorResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MentorFeedbackRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorResponse" ADD CONSTRAINT "MentorResponse_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorQuestion" ADD CONSTRAINT "MentorQuestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAnswer" ADD CONSTRAINT "MentorAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "MentorQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAnswer" ADD CONSTRAINT "MentorAnswer_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessStory" ADD CONSTRAINT "SuccessStory_personId_fkey" FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuratedResource" ADD CONSTRAINT "CuratedResource_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMotivationLog" ADD CONSTRAINT "StudentMotivationLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMotivationLog" ADD CONSTRAINT "StudentMotivationLog_boostId_fkey" FOREIGN KEY ("boostId") REFERENCES "MotivationBoost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ProjectFeedbackCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSectionItem" ADD CONSTRAINT "PortfolioSectionItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PortfolioSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicPortfolio" ADD CONSTRAINT "PublicPortfolio_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentConnection" ADD CONSTRAINT "ParentStudentConnection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentConnection" ADD CONSTRAINT "ParentStudentConnection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentNotification" ADD CONSTRAINT "ParentNotification_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressReport" ADD CONSTRAINT "ProgressReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMessage" ADD CONSTRAINT "ParentMessage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentSettings" ADD CONSTRAINT "ParentSettings_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentOnboarding" ADD CONSTRAINT "StudentOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationSettings" ADD CONSTRAINT "PersonalizationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickAction" ADD CONSTRAINT "QuickAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassOffering" ADD CONSTRAINT "ClassOffering_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ClassTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassOffering" ADD CONSTRAINT "ClassOffering_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAttendanceRecord" ADD CONSTRAINT "ClassAttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAttendanceRecord" ADD CONSTRAINT "ClassAttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassReminder" ADD CONSTRAINT "ClassReminder_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassReminder" ADD CONSTRAINT "ClassReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignmentSubmission" ADD CONSTRAINT "ClassAssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ClassAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignmentSubmission" ADD CONSTRAINT "ClassAssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignmentSubmission" ADD CONSTRAINT "ClassAssignmentSubmission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GroupProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupProject" ADD CONSTRAINT "GroupProject_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ClassAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GroupProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMilestone" ADD CONSTRAINT "GroupMilestone_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GroupProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressPrediction" ADD CONSTRAINT "ProgressPrediction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeSubmission" ADD CONSTRAINT "ChallengeSubmission_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeSubmission" ADD CONSTRAINT "ChallengeSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassionPassport" ADD CONSTRAINT "PassionPassport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportStamp" ADD CONSTRAINT "PassportStamp_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "PassionPassport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "SeasonalCompetition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "SeasonalCompetition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CompetitionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipListing" ADD CONSTRAINT "InternshipListing_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipApplication" ADD CONSTRAINT "InternshipApplication_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "InternshipListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipApplication" ADD CONSTRAINT "InternshipApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProject" ADD CONSTRAINT "ServiceProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVolunteer" ADD CONSTRAINT "ServiceVolunteer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ServiceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVolunteer" ADD CONSTRAINT "ServiceVolunteer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorCertification" ADD CONSTRAINT "InstructorCertification_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceExchangeListing" ADD CONSTRAINT "ResourceExchangeListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceExchangeRequest" ADD CONSTRAINT "ResourceExchangeRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ResourceExchangeListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceExchangeRequest" ADD CONSTRAINT "ResourceExchangeRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompetitionJudges" ADD CONSTRAINT "_CompetitionJudges_A_fkey" FOREIGN KEY ("A") REFERENCES "SeasonalCompetition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompetitionJudges" ADD CONSTRAINT "_CompetitionJudges_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

