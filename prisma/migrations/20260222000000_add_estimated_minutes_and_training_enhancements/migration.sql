-- Add estimatedMinutes to TrainingModule (fixes "column does not exist" error)
ALTER TABLE "TrainingModule"
  ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER;

-- ============================================
-- TRAINING ACADEMY ENHANCEMENTS
-- ============================================

-- VideoProgress: tracks per-user video watch progress
CREATE TABLE IF NOT EXISTS "VideoProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "lastPosition" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VideoProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VideoProgress_userId_moduleId_key"
  ON "VideoProgress"("userId", "moduleId");

-- TrainingVideo: multiple videos per module
CREATE TABLE IF NOT EXISTS "TrainingVideo" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "videoUrl" TEXT NOT NULL,
  "videoProvider" "VideoProvider" NOT NULL,
  "videoDuration" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 1,
  "isSupplementary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainingVideo_moduleId_sortOrder_idx"
  ON "TrainingVideo"("moduleId", "sortOrder");

-- VideoSegment: chapters/segments within a video
CREATE TABLE IF NOT EXISTS "VideoSegment" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startTime" INTEGER NOT NULL,
  "endTime" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VideoSegment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VideoSegment_videoId_sortOrder_idx"
  ON "VideoSegment"("videoId", "sortOrder");

-- TrainingResource: downloadable/linkable resources per module
CREATE TABLE IF NOT EXISTS "TrainingResource" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "resourceUrl" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 1,
  "downloads" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingResource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainingResource_moduleId_sortOrder_idx"
  ON "TrainingResource"("moduleId", "sortOrder");

-- TrainingCohort: groups of trainees
CREATE TABLE IF NOT EXISTS "TrainingCohort" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "facilitatorId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingCohort_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainingCohort_isActive_startDate_idx"
  ON "TrainingCohort"("isActive", "startDate");

-- PeerReview: peer review of evidence submissions
CREATE TABLE IF NOT EXISTS "PeerReview" (
  "id" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "feedback" TEXT,
  "rating" INTEGER,
  "strengths" TEXT,
  "areasForImprovement" TEXT,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PeerReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PeerReview_evidenceId_reviewerId_key"
  ON "PeerReview"("evidenceId", "reviewerId");

CREATE INDEX IF NOT EXISTS "PeerReview_reviewerId_idx"
  ON "PeerReview"("reviewerId");

-- ModuleDiscussion: discussion boards per module (optionally scoped to a cohort)
CREATE TABLE IF NOT EXISTS "ModuleDiscussion" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "cohortId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ModuleDiscussion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ModuleDiscussion_moduleId_cohortId_key"
  ON "ModuleDiscussion"("moduleId", "cohortId");

CREATE INDEX IF NOT EXISTS "ModuleDiscussion_moduleId_idx"
  ON "ModuleDiscussion"("moduleId");

-- DiscussionThread: threads within a discussion board
CREATE TABLE IF NOT EXISTS "DiscussionThread" (
  "id" TEXT NOT NULL,
  "discussionId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiscussionThread_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DiscussionThread_discussionId_createdAt_idx"
  ON "DiscussionThread"("discussionId", "createdAt");

CREATE INDEX IF NOT EXISTS "DiscussionThread_authorId_idx"
  ON "DiscussionThread"("authorId");

-- DiscussionReply: replies to threads
CREATE TABLE IF NOT EXISTS "DiscussionReply" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiscussionReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DiscussionReply_threadId_createdAt_idx"
  ON "DiscussionReply"("threadId", "createdAt");

CREATE INDEX IF NOT EXISTS "DiscussionReply_authorId_idx"
  ON "DiscussionReply"("authorId");

-- ============================================
-- FOREIGN KEYS (all wrapped to avoid errors if already exist)
-- ============================================

DO $$
BEGIN
  ALTER TABLE "VideoProgress"
    ADD CONSTRAINT "VideoProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "VideoProgress"
    ADD CONSTRAINT "VideoProgress_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TrainingVideo"
    ADD CONSTRAINT "TrainingVideo_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "VideoSegment"
    ADD CONSTRAINT "VideoSegment_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "TrainingVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TrainingResource"
    ADD CONSTRAINT "TrainingResource_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TrainingCohort"
    ADD CONSTRAINT "TrainingCohort_facilitatorId_fkey"
    FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add cohortId column to TrainingAssignment before the FK that references it
ALTER TABLE "TrainingAssignment"
  ADD COLUMN IF NOT EXISTS "cohortId" TEXT;

DO $$
BEGIN
  ALTER TABLE "TrainingAssignment"
    ADD CONSTRAINT "TrainingAssignment_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "TrainingCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PeerReview"
    ADD CONSTRAINT "PeerReview_evidenceId_fkey"
    FOREIGN KEY ("evidenceId") REFERENCES "TrainingEvidenceSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PeerReview"
    ADD CONSTRAINT "PeerReview_reviewerId_fkey"
    FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ModuleDiscussion"
    ADD CONSTRAINT "ModuleDiscussion_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ModuleDiscussion"
    ADD CONSTRAINT "ModuleDiscussion_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "TrainingCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "DiscussionThread"
    ADD CONSTRAINT "DiscussionThread_discussionId_fkey"
    FOREIGN KEY ("discussionId") REFERENCES "ModuleDiscussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "DiscussionThread"
    ADD CONSTRAINT "DiscussionThread_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "DiscussionReply"
    ADD CONSTRAINT "DiscussionReply_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "DiscussionThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "DiscussionReply"
    ADD CONSTRAINT "DiscussionReply_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

