-- Migration: weekly_team_briefs_team_meetings
-- Adds the team-facing weekly brief and Team Meeting workflow while preserving
-- OfficerMeeting as the separate leadership meeting system. Every existing
-- meeting/action path remains compatible: new Officer Meeting agenda/follow-up
-- columns are nullable and all new tables are additive.

-- CreateEnum: WeeklyBriefStatus
DO $$ BEGIN
  CREATE TYPE "WeeklyBriefStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PRESENTED', 'FINALIZED', 'REOPENED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: TeamMeetingStatus
DO $$ BEGIN
  CREATE TYPE "TeamMeetingStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'FINALIZED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: PreparedPresentationStatus
DO $$ BEGIN
  CREATE TYPE "PreparedPresentationStatus" AS ENUM ('DRAFT', 'READY', 'SUBMITTED', 'ACCEPTED', 'REVISION_REQUESTED', 'PRESENTED', 'WITHDRAWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: PresentationExpectationKind
DO $$ BEGIN
  CREATE TYPE "PresentationExpectationKind" AS ENUM ('PRESENT_DELIVERABLE', 'SHOW_STATUS', 'ANSWER_QUESTION', 'MAKE_DECISION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: PresentationExpectationStatus
DO $$ BEGIN
  CREATE TYPE "PresentationExpectationStatus" AS ENUM ('OPEN', 'ADDRESSED', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: AgendaItemKind
DO $$ BEGIN
  CREATE TYPE "AgendaItemKind" AS ENUM (
    'INITIATIVE_OVERVIEW',
    'TEAM_STATUS',
    'DELIVERABLE_REVIEW',
    'DECISION',
    'LEADERSHIP_INPUT',
    'CROSS_TEAM_COORDINATION',
    'ESCALATED_BLOCKER',
    'MISSED_COMMITMENT_REVIEW',
    'WRITTEN_REVIEW',
    'EXPECTATION_SETTING'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: WeeklyTeamBrief
CREATE TABLE IF NOT EXISTS "WeeklyTeamBrief" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "workstreamId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "WeeklyBriefStatus" NOT NULL DEFAULT 'DRAFT',
    "teamObjective" TEXT,
    "overallStatus" TEXT,
    "lastCommitments" TEXT,
    "blockersSummary" TEXT,
    "decisionsNeeded" TEXT,
    "nextActionsSummary" TEXT,
    "nextCycleCommitments" TEXT,
    "teamLeadId" TEXT,
    "readyForTeamMeeting" BOOLEAN NOT NULL DEFAULT false,
    "readyForOfficerMeeting" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "officerMeetingId" TEXT,
    "snapshotJson" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyTeamBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamMeeting
CREATE TABLE IF NOT EXISTS "TeamMeeting" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "workstreamId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "TeamMeetingStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "briefId" TEXT NOT NULL,
    "teamLeadId" TEXT,
    "targetOfficerMeetingId" TEXT,
    "agendaSnapshotJson" JSONB,
    "commitmentsJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WeeklyTaskUpdate
CREATE TABLE IF NOT EXISTS "WeeklyTaskUpdate" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "actionItemId" TEXT,
    "taskTitleSnapshot" TEXT NOT NULL,
    "commitmentSnapshot" TEXT,
    "statusNarrative" TEXT,
    "workCompleted" TEXT,
    "currentResult" TEXT,
    "remainingWork" TEXT,
    "blockerNote" TEXT,
    "explanation" TEXT,
    "decisionNeeded" TEXT,
    "nextAction" TEXT,
    "teamMeetingPresenterId" TEXT,
    "officerMeetingPresenterId" TEXT,
    "teamMeetingReady" BOOLEAN NOT NULL DEFAULT false,
    "officerMeetingReady" BOOLEAN NOT NULL DEFAULT false,
    "escalationNeeded" BOOLEAN NOT NULL DEFAULT false,
    "officerReviewRequested" BOOLEAN NOT NULL DEFAULT false,
    "carriedForward" BOOLEAN NOT NULL DEFAULT false,
    "deliverableLinkIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expectationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "snapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyTaskUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamPresentationExpectation
CREATE TABLE IF NOT EXISTS "TeamPresentationExpectation" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "workstreamId" TEXT NOT NULL,
    "actionItemId" TEXT,
    "kind" "PresentationExpectationKind" NOT NULL,
    "prompt" TEXT NOT NULL,
    "requiredQuestion" TEXT,
    "requiredDeliverable" TEXT,
    "responsibleOwnerId" TEXT,
    "presenterId" TEXT,
    "dueDate" TIMESTAMP(3),
    "dueWeekStart" TIMESTAMP(3),
    "returnToNextAgenda" BOOLEAN NOT NULL DEFAULT true,
    "status" "PresentationExpectationStatus" NOT NULL DEFAULT 'OPEN',
    "sourceMeetingId" TEXT,
    "targetOfficerMeetingId" TEXT,
    "addressedInBriefId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamPresentationExpectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PreparedPresentationItem
CREATE TABLE IF NOT EXISTS "PreparedPresentationItem" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "workstreamId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "teamMeetingId" TEXT,
    "weeklyTaskUpdateId" TEXT,
    "actionItemId" TEXT,
    "presentationExpectationId" TEXT,
    "targetOfficerMeetingId" TEXT,
    "reasonForOfficerReview" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statusSummary" TEXT,
    "requestedDecision" TEXT,
    "readiness" "PreparedPresentationStatus" NOT NULL DEFAULT 'DRAFT',
    "deliverableLinkIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "presenterId" TEXT,
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "presentedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreparedPresentationItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable: MeetingAgendaItem — source links for prepared team presentations.
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "presenterId" TEXT;
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "itemKind" "AgendaItemKind";
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "sourceInitiativeId" TEXT;
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "sourceWorkstreamId" TEXT;
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "briefId" TEXT;
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "teamMeetingId" TEXT;
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "preparedPresentationItemId" TEXT;
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "sourceActionId" TEXT;
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "presentationExpectationId" TEXT;
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "requestedDecision" TEXT;
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "readinessState" TEXT;

-- AlterTable: MeetingFollowUp — target a follow-up back to a team/task/brief.
ALTER TABLE "MeetingFollowUp" ADD COLUMN IF NOT EXISTS "initiativeId" TEXT;
ALTER TABLE "MeetingFollowUp" ADD COLUMN IF NOT EXISTS "workstreamId" TEXT;
ALTER TABLE "MeetingFollowUp" ADD COLUMN IF NOT EXISTS "sourceActionId" TEXT;
ALTER TABLE "MeetingFollowUp" ADD COLUMN IF NOT EXISTS "briefId" TEXT;
ALTER TABLE "MeetingFollowUp" ADD COLUMN IF NOT EXISTS "presentationExpectationId" TEXT;

-- CreateIndex: WeeklyTeamBrief
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyTeamBrief_initiativeId_workstreamId_weekStart_key" ON "WeeklyTeamBrief"("initiativeId", "workstreamId", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyTeamBrief_initiativeId_weekStart_idx" ON "WeeklyTeamBrief"("initiativeId", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyTeamBrief_workstreamId_weekStart_idx" ON "WeeklyTeamBrief"("workstreamId", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyTeamBrief_status_idx" ON "WeeklyTeamBrief"("status");
CREATE INDEX IF NOT EXISTS "WeeklyTeamBrief_officerMeetingId_idx" ON "WeeklyTeamBrief"("officerMeetingId");
CREATE INDEX IF NOT EXISTS "WeeklyTeamBrief_teamLeadId_idx" ON "WeeklyTeamBrief"("teamLeadId");
CREATE INDEX IF NOT EXISTS "WeeklyTeamBrief_createdById_idx" ON "WeeklyTeamBrief"("createdById");

-- CreateIndex: TeamMeeting
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMeeting_briefId_key" ON "TeamMeeting"("briefId");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMeeting_initiativeId_workstreamId_weekStart_key" ON "TeamMeeting"("initiativeId", "workstreamId", "weekStart");
CREATE INDEX IF NOT EXISTS "TeamMeeting_initiativeId_weekStart_idx" ON "TeamMeeting"("initiativeId", "weekStart");
CREATE INDEX IF NOT EXISTS "TeamMeeting_workstreamId_weekStart_idx" ON "TeamMeeting"("workstreamId", "weekStart");
CREATE INDEX IF NOT EXISTS "TeamMeeting_status_idx" ON "TeamMeeting"("status");
CREATE INDEX IF NOT EXISTS "TeamMeeting_targetOfficerMeetingId_idx" ON "TeamMeeting"("targetOfficerMeetingId");
CREATE INDEX IF NOT EXISTS "TeamMeeting_teamLeadId_idx" ON "TeamMeeting"("teamLeadId");
CREATE INDEX IF NOT EXISTS "TeamMeeting_createdById_idx" ON "TeamMeeting"("createdById");

-- CreateIndex: WeeklyTaskUpdate
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyTaskUpdate_briefId_actionItemId_key" ON "WeeklyTaskUpdate"("briefId", "actionItemId");
CREATE INDEX IF NOT EXISTS "WeeklyTaskUpdate_briefId_idx" ON "WeeklyTaskUpdate"("briefId");
CREATE INDEX IF NOT EXISTS "WeeklyTaskUpdate_actionItemId_idx" ON "WeeklyTaskUpdate"("actionItemId");
CREATE INDEX IF NOT EXISTS "WeeklyTaskUpdate_teamMeetingPresenterId_idx" ON "WeeklyTaskUpdate"("teamMeetingPresenterId");
CREATE INDEX IF NOT EXISTS "WeeklyTaskUpdate_officerMeetingPresenterId_idx" ON "WeeklyTaskUpdate"("officerMeetingPresenterId");

-- CreateIndex: TeamPresentationExpectation
CREATE INDEX IF NOT EXISTS "TeamPresentationExpectation_workstreamId_status_idx" ON "TeamPresentationExpectation"("workstreamId", "status");
CREATE INDEX IF NOT EXISTS "TeamPresentationExpectation_initiativeId_status_idx" ON "TeamPresentationExpectation"("initiativeId", "status");
CREATE INDEX IF NOT EXISTS "TeamPresentationExpectation_actionItemId_idx" ON "TeamPresentationExpectation"("actionItemId");
CREATE INDEX IF NOT EXISTS "TeamPresentationExpectation_sourceMeetingId_idx" ON "TeamPresentationExpectation"("sourceMeetingId");
CREATE INDEX IF NOT EXISTS "TeamPresentationExpectation_targetOfficerMeetingId_idx" ON "TeamPresentationExpectation"("targetOfficerMeetingId");
CREATE INDEX IF NOT EXISTS "TeamPresentationExpectation_addressedInBriefId_idx" ON "TeamPresentationExpectation"("addressedInBriefId");
CREATE INDEX IF NOT EXISTS "TeamPresentationExpectation_dueDate_idx" ON "TeamPresentationExpectation"("dueDate");
CREATE INDEX IF NOT EXISTS "TeamPresentationExpectation_dueWeekStart_idx" ON "TeamPresentationExpectation"("dueWeekStart");
CREATE INDEX IF NOT EXISTS "TeamPresentationExpectation_responsibleOwnerId_idx" ON "TeamPresentationExpectation"("responsibleOwnerId");
CREATE INDEX IF NOT EXISTS "TeamPresentationExpectation_presenterId_idx" ON "TeamPresentationExpectation"("presenterId");
CREATE INDEX IF NOT EXISTS "TeamPresentationExpectation_createdById_idx" ON "TeamPresentationExpectation"("createdById");

-- CreateIndex: PreparedPresentationItem
CREATE UNIQUE INDEX IF NOT EXISTS "PreparedPresentationItem_dedupeKey_key" ON "PreparedPresentationItem"("dedupeKey");
CREATE INDEX IF NOT EXISTS "PreparedPresentationItem_initiativeId_workstreamId_idx" ON "PreparedPresentationItem"("initiativeId", "workstreamId");
CREATE INDEX IF NOT EXISTS "PreparedPresentationItem_briefId_idx" ON "PreparedPresentationItem"("briefId");
CREATE INDEX IF NOT EXISTS "PreparedPresentationItem_teamMeetingId_idx" ON "PreparedPresentationItem"("teamMeetingId");
CREATE INDEX IF NOT EXISTS "PreparedPresentationItem_weeklyTaskUpdateId_idx" ON "PreparedPresentationItem"("weeklyTaskUpdateId");
CREATE INDEX IF NOT EXISTS "PreparedPresentationItem_actionItemId_idx" ON "PreparedPresentationItem"("actionItemId");
CREATE INDEX IF NOT EXISTS "PreparedPresentationItem_presentationExpectationId_idx" ON "PreparedPresentationItem"("presentationExpectationId");
CREATE INDEX IF NOT EXISTS "PreparedPresentationItem_targetOfficerMeetingId_idx" ON "PreparedPresentationItem"("targetOfficerMeetingId");
CREATE INDEX IF NOT EXISTS "PreparedPresentationItem_readiness_idx" ON "PreparedPresentationItem"("readiness");
CREATE INDEX IF NOT EXISTS "PreparedPresentationItem_presenterId_idx" ON "PreparedPresentationItem"("presenterId");
CREATE INDEX IF NOT EXISTS "PreparedPresentationItem_createdById_idx" ON "PreparedPresentationItem"("createdById");

-- CreateIndex: MeetingAgendaItem additions
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingAgendaItem_preparedPresentationItemId_key" ON "MeetingAgendaItem"("preparedPresentationItemId");
CREATE INDEX IF NOT EXISTS "MeetingAgendaItem_presenterId_idx" ON "MeetingAgendaItem"("presenterId");
CREATE INDEX IF NOT EXISTS "MeetingAgendaItem_itemKind_idx" ON "MeetingAgendaItem"("itemKind");
CREATE INDEX IF NOT EXISTS "MeetingAgendaItem_briefId_idx" ON "MeetingAgendaItem"("briefId");
CREATE INDEX IF NOT EXISTS "MeetingAgendaItem_teamMeetingId_idx" ON "MeetingAgendaItem"("teamMeetingId");
CREATE INDEX IF NOT EXISTS "MeetingAgendaItem_sourceInitiativeId_sourceWorkstreamId_idx" ON "MeetingAgendaItem"("sourceInitiativeId", "sourceWorkstreamId");
CREATE INDEX IF NOT EXISTS "MeetingAgendaItem_sourceActionId_idx" ON "MeetingAgendaItem"("sourceActionId");
CREATE INDEX IF NOT EXISTS "MeetingAgendaItem_presentationExpectationId_idx" ON "MeetingAgendaItem"("presentationExpectationId");

-- CreateIndex: MeetingFollowUp additions
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_initiativeId_workstreamId_idx" ON "MeetingFollowUp"("initiativeId", "workstreamId");
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_sourceActionId_idx" ON "MeetingFollowUp"("sourceActionId");
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_briefId_idx" ON "MeetingFollowUp"("briefId");
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_presentationExpectationId_idx" ON "MeetingFollowUp"("presentationExpectationId");

-- AddForeignKey: WeeklyTeamBrief
DO $$ BEGIN
  ALTER TABLE "WeeklyTeamBrief" ADD CONSTRAINT "WeeklyTeamBrief_teamLeadId_fkey"
    FOREIGN KEY ("teamLeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WeeklyTeamBrief" ADD CONSTRAINT "WeeklyTeamBrief_officerMeetingId_fkey"
    FOREIGN KEY ("officerMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WeeklyTeamBrief" ADD CONSTRAINT "WeeklyTeamBrief_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: TeamMeeting
DO $$ BEGIN
  ALTER TABLE "TeamMeeting" ADD CONSTRAINT "TeamMeeting_briefId_fkey"
    FOREIGN KEY ("briefId") REFERENCES "WeeklyTeamBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamMeeting" ADD CONSTRAINT "TeamMeeting_teamLeadId_fkey"
    FOREIGN KEY ("teamLeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamMeeting" ADD CONSTRAINT "TeamMeeting_targetOfficerMeetingId_fkey"
    FOREIGN KEY ("targetOfficerMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamMeeting" ADD CONSTRAINT "TeamMeeting_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: WeeklyTaskUpdate
DO $$ BEGIN
  ALTER TABLE "WeeklyTaskUpdate" ADD CONSTRAINT "WeeklyTaskUpdate_briefId_fkey"
    FOREIGN KEY ("briefId") REFERENCES "WeeklyTeamBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WeeklyTaskUpdate" ADD CONSTRAINT "WeeklyTaskUpdate_actionItemId_fkey"
    FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WeeklyTaskUpdate" ADD CONSTRAINT "WeeklyTaskUpdate_teamMeetingPresenterId_fkey"
    FOREIGN KEY ("teamMeetingPresenterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WeeklyTaskUpdate" ADD CONSTRAINT "WeeklyTaskUpdate_officerMeetingPresenterId_fkey"
    FOREIGN KEY ("officerMeetingPresenterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: TeamPresentationExpectation
DO $$ BEGIN
  ALTER TABLE "TeamPresentationExpectation" ADD CONSTRAINT "TeamPresentationExpectation_actionItemId_fkey"
    FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamPresentationExpectation" ADD CONSTRAINT "TeamPresentationExpectation_responsibleOwnerId_fkey"
    FOREIGN KEY ("responsibleOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamPresentationExpectation" ADD CONSTRAINT "TeamPresentationExpectation_presenterId_fkey"
    FOREIGN KEY ("presenterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamPresentationExpectation" ADD CONSTRAINT "TeamPresentationExpectation_sourceMeetingId_fkey"
    FOREIGN KEY ("sourceMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamPresentationExpectation" ADD CONSTRAINT "TeamPresentationExpectation_targetOfficerMeetingId_fkey"
    FOREIGN KEY ("targetOfficerMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamPresentationExpectation" ADD CONSTRAINT "TeamPresentationExpectation_addressedInBriefId_fkey"
    FOREIGN KEY ("addressedInBriefId") REFERENCES "WeeklyTeamBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamPresentationExpectation" ADD CONSTRAINT "TeamPresentationExpectation_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: PreparedPresentationItem
DO $$ BEGIN
  ALTER TABLE "PreparedPresentationItem" ADD CONSTRAINT "PreparedPresentationItem_briefId_fkey"
    FOREIGN KEY ("briefId") REFERENCES "WeeklyTeamBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreparedPresentationItem" ADD CONSTRAINT "PreparedPresentationItem_teamMeetingId_fkey"
    FOREIGN KEY ("teamMeetingId") REFERENCES "TeamMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreparedPresentationItem" ADD CONSTRAINT "PreparedPresentationItem_weeklyTaskUpdateId_fkey"
    FOREIGN KEY ("weeklyTaskUpdateId") REFERENCES "WeeklyTaskUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreparedPresentationItem" ADD CONSTRAINT "PreparedPresentationItem_actionItemId_fkey"
    FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreparedPresentationItem" ADD CONSTRAINT "PreparedPresentationItem_presentationExpectationId_fkey"
    FOREIGN KEY ("presentationExpectationId") REFERENCES "TeamPresentationExpectation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreparedPresentationItem" ADD CONSTRAINT "PreparedPresentationItem_targetOfficerMeetingId_fkey"
    FOREIGN KEY ("targetOfficerMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreparedPresentationItem" ADD CONSTRAINT "PreparedPresentationItem_presenterId_fkey"
    FOREIGN KEY ("presenterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreparedPresentationItem" ADD CONSTRAINT "PreparedPresentationItem_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingAgendaItem additions
DO $$ BEGIN
  ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_presenterId_fkey"
    FOREIGN KEY ("presenterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_briefId_fkey"
    FOREIGN KEY ("briefId") REFERENCES "WeeklyTeamBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_teamMeetingId_fkey"
    FOREIGN KEY ("teamMeetingId") REFERENCES "TeamMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_preparedPresentationItemId_fkey"
    FOREIGN KEY ("preparedPresentationItemId") REFERENCES "PreparedPresentationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_sourceActionId_fkey"
    FOREIGN KEY ("sourceActionId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_presentationExpectationId_fkey"
    FOREIGN KEY ("presentationExpectationId") REFERENCES "TeamPresentationExpectation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingFollowUp additions
DO $$ BEGIN
  ALTER TABLE "MeetingFollowUp" ADD CONSTRAINT "MeetingFollowUp_sourceActionId_fkey"
    FOREIGN KEY ("sourceActionId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetingFollowUp" ADD CONSTRAINT "MeetingFollowUp_briefId_fkey"
    FOREIGN KEY ("briefId") REFERENCES "WeeklyTeamBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetingFollowUp" ADD CONSTRAINT "MeetingFollowUp_presentationExpectationId_fkey"
    FOREIGN KEY ("presentationExpectationId") REFERENCES "TeamPresentationExpectation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
