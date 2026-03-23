-- Phase 4: Gamification streaks on Mentorship, Peer Recognition, College Platform, Alumni Network, Award Ceremony

-- -----------------------------------------------
-- 4A: Mentorship streak fields
-- -----------------------------------------------
ALTER TABLE "Mentorship"
  ADD COLUMN IF NOT EXISTS "reflectionStreak" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "longestReflectionStreak" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reviewStreak" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "longestReviewStreak" INTEGER NOT NULL DEFAULT 0;

-- -----------------------------------------------
-- 4B: Peer Recognition Feed
-- -----------------------------------------------
CREATE TYPE "KudosCategory" AS ENUM (
  'HELPFULNESS',
  'LEADERSHIP',
  'CREATIVITY',
  'ABOVE_AND_BEYOND',
  'TEAMWORK',
  'PROBLEM_SOLVING'
);

CREATE TABLE "PeerKudos" (
  "id"                   TEXT NOT NULL,
  "giverId"              TEXT NOT NULL,
  "receiverId"           TEXT NOT NULL,
  "category"             "KudosCategory" NOT NULL,
  "message"              TEXT NOT NULL,
  "isPublic"             BOOLEAN NOT NULL DEFAULT true,
  "referencedInReviewId" TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PeerKudos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PeerKudos_receiverId_idx" ON "PeerKudos"("receiverId");
CREATE INDEX "PeerKudos_giverId_idx"    ON "PeerKudos"("giverId");
CREATE INDEX "PeerKudos_createdAt_idx"  ON "PeerKudos"("createdAt");

ALTER TABLE "PeerKudos"
  ADD CONSTRAINT "PeerKudos_giverId_fkey"
    FOREIGN KEY ("giverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PeerKudos"
  ADD CONSTRAINT "PeerKudos_receiverId_fkey"
    FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------
-- 4E: College Readiness Roadmap
-- -----------------------------------------------
CREATE TYPE "CollegeStage" AS ENUM (
  'EXPLORING',
  'BUILDING_PROFILE',
  'TEST_PREP',
  'COLLEGE_LIST',
  'APPLICATIONS',
  'FINANCIAL_AID',
  'DECISION',
  'TRANSITION'
);

CREATE TABLE "CollegeReadinessRoadmap" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "currentStage"   "CollegeStage" NOT NULL DEFAULT 'EXPLORING',
  "graduationYear" INTEGER,
  "dreamColleges"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "intendedMajors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CollegeReadinessRoadmap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CollegeReadinessRoadmap_userId_key" ON "CollegeReadinessRoadmap"("userId");
CREATE INDEX "CollegeReadinessRoadmap_userId_idx" ON "CollegeReadinessRoadmap"("userId");

ALTER TABLE "CollegeReadinessRoadmap"
  ADD CONSTRAINT "CollegeReadinessRoadmap_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CollegeRoadmapTask" (
  "id"          TEXT NOT NULL,
  "roadmapId"   TEXT NOT NULL,
  "stage"       "CollegeStage" NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "category"    TEXT NOT NULL,
  "isRequired"  BOOLEAN NOT NULL DEFAULT false,
  "isTemplate"  BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "dueDate"     TIMESTAMP(3),
  "notes"       TEXT,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CollegeRoadmapTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollegeRoadmapTask_roadmapId_stage_idx" ON "CollegeRoadmapTask"("roadmapId", "stage");

ALTER TABLE "CollegeRoadmapTask"
  ADD CONSTRAINT "CollegeRoadmapTask_roadmapId_fkey"
    FOREIGN KEY ("roadmapId") REFERENCES "CollegeReadinessRoadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------
-- 4F: Activities & Extracurricular Builder
-- -----------------------------------------------
CREATE TYPE "ActivityCategory" AS ENUM (
  'LEADERSHIP',
  'COMMUNITY_SERVICE',
  'ATHLETICS',
  'ARTS_CREATIVE',
  'ACADEMIC',
  'WORK_INTERNSHIP',
  'PERSONAL_PROJECT',
  'STEM',
  'OTHER'
);

CREATE TABLE "CollegeActivity" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "category"        "ActivityCategory" NOT NULL,
  "organization"    TEXT,
  "role"            TEXT,
  "description"     TEXT,
  "hoursPerWeek"    DOUBLE PRECISION,
  "weeksPerYear"    INTEGER,
  "yearsInvolved"   INTEGER,
  "startDate"       TIMESTAMP(3),
  "endDate"         TIMESTAMP(3),
  "isOngoing"       BOOLEAN NOT NULL DEFAULT true,
  "impactStatement" TEXT,
  "advisorNotes"    TEXT,
  "isYppActivity"   BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CollegeActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollegeActivity_userId_idx" ON "CollegeActivity"("userId");

ALTER TABLE "CollegeActivity"
  ADD CONSTRAINT "CollegeActivity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ActivityMilestone" (
  "id"          TEXT NOT NULL,
  "activityId"  TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "date"        TIMESTAMP(3),
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ActivityMilestone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityMilestone_activityId_idx" ON "ActivityMilestone"("activityId");

ALTER TABLE "ActivityMilestone"
  ADD CONSTRAINT "ActivityMilestone_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "CollegeActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------
-- 4G: Alumni Network Hub
-- -----------------------------------------------
CREATE TABLE "AlumniPanelEvent" (
  "id"              TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "description"     TEXT NOT NULL,
  "topic"           TEXT NOT NULL,
  "scheduledAt"     TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 60,
  "meetingLink"     TEXT,
  "maxAttendees"    INTEGER,
  "recording"       TEXT,
  "isPublic"        BOOLEAN NOT NULL DEFAULT false,
  "createdById"     TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlumniPanelEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlumniPanelEvent_scheduledAt_idx" ON "AlumniPanelEvent"("scheduledAt");

CREATE TABLE "AlumniPanelist" (
  "id"          TEXT NOT NULL,
  "eventId"     TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "college"     TEXT NOT NULL,
  "yearStarted" INTEGER,
  "bio"         TEXT,

  CONSTRAINT "AlumniPanelist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlumniPanelist_eventId_userId_key" ON "AlumniPanelist"("eventId", "userId");

ALTER TABLE "AlumniPanelist"
  ADD CONSTRAINT "AlumniPanelist_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "AlumniPanelEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlumniPanelist"
  ADD CONSTRAINT "AlumniPanelist_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AlumniPanelRsvp" (
  "id"      TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId"  TEXT NOT NULL,
  "status"  TEXT NOT NULL,

  CONSTRAINT "AlumniPanelRsvp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlumniPanelRsvp_eventId_userId_key" ON "AlumniPanelRsvp"("eventId", "userId");
CREATE INDEX "AlumniPanelRsvp_eventId_idx" ON "AlumniPanelRsvp"("eventId");

ALTER TABLE "AlumniPanelRsvp"
  ADD CONSTRAINT "AlumniPanelRsvp_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "AlumniPanelEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlumniPanelRsvp"
  ADD CONSTRAINT "AlumniPanelRsvp_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AlumniIntroRequest" (
  "id"          TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "alumniId"    TEXT NOT NULL,
  "message"     TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "acceptedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AlumniIntroRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlumniIntroRequest_requesterId_idx" ON "AlumniIntroRequest"("requesterId");
CREATE INDEX "AlumniIntroRequest_alumniId_idx"    ON "AlumniIntroRequest"("alumniId");

ALTER TABLE "AlumniIntroRequest"
  ADD CONSTRAINT "AlumniIntroRequest_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlumniIntroRequest"
  ADD CONSTRAINT "AlumniIntroRequest_alumniId_fkey"
    FOREIGN KEY ("alumniId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------
-- 4H: Award Certificate
-- -----------------------------------------------
CREATE TABLE "AwardCertificate" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "tier"         TEXT NOT NULL,
  "nominationId" TEXT NOT NULL,
  "svgData"      TEXT NOT NULL,
  "issuedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AwardCertificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AwardCertificate_nominationId_key" ON "AwardCertificate"("nominationId");
CREATE INDEX "AwardCertificate_userId_idx" ON "AwardCertificate"("userId");
