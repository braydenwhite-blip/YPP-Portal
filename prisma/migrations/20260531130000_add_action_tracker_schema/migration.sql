-- Migration: add_action_tracker_schema
-- People Strategy — Action Tracker (Phase 1, schema only).
-- Adds the ActionItem layer with explicit Lead / Executing / Input roles,
-- per-item visibility, threaded comments, and file links, plus a minimal
-- functional Department model. Runtime surfaces are gated behind
-- ENABLE_ACTION_TRACKER. Distinct from the older Leadership Action Center.
-- Written idempotently (IF NOT EXISTS / DO $$ guards) to match the repo's
-- migration convention.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ActionItemStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'OVERDUE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ActionItemVisibility" AS ENUM ('OFFICERS_ONLY', 'ALL_LEADERSHIP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ActionAssignmentRole" AS ENUM ('LEAD', 'EXECUTING', 'INPUT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ActionCommentType" AS ENUM ('NOTE', 'INPUT_REQUESTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActionItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "goalCategory" TEXT,
    "departmentId" TEXT NOT NULL,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "deadlineStart" TIMESTAMP(3) NOT NULL,
    "deadlineEnd" TIMESTAMP(3),
    "visibility" "ActionItemVisibility" NOT NULL DEFAULT 'ALL_LEADERSHIP',
    "leadId" TEXT NOT NULL,
    "officerMeetingId" TEXT,
    "createdById" TEXT NOT NULL,
    "flaggedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActionAssignment" (
    "id" TEXT NOT NULL,
    "actionItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ActionAssignmentRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActionComment" (
    "id" TEXT NOT NULL,
    "actionItemId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "ActionCommentType" NOT NULL DEFAULT 'NOTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActionFileLink" (
    "id" TEXT NOT NULL,
    "actionItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionFileLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_slug_key" ON "Department"("slug");
CREATE INDEX IF NOT EXISTS "Department_archivedAt_idx" ON "Department"("archivedAt");

CREATE INDEX IF NOT EXISTS "ActionItem_deadlineStart_idx" ON "ActionItem"("deadlineStart");
CREATE INDEX IF NOT EXISTS "ActionItem_status_deadlineStart_idx" ON "ActionItem"("status", "deadlineStart");
CREATE INDEX IF NOT EXISTS "ActionItem_departmentId_status_idx" ON "ActionItem"("departmentId", "status");
CREATE INDEX IF NOT EXISTS "ActionItem_visibility_idx" ON "ActionItem"("visibility");
CREATE INDEX IF NOT EXISTS "ActionItem_leadId_idx" ON "ActionItem"("leadId");
CREATE INDEX IF NOT EXISTS "ActionItem_officerMeetingId_idx" ON "ActionItem"("officerMeetingId");
CREATE INDEX IF NOT EXISTS "ActionItem_flaggedAt_idx" ON "ActionItem"("flaggedAt");

CREATE INDEX IF NOT EXISTS "ActionAssignment_userId_role_idx" ON "ActionAssignment"("userId", "role");
CREATE INDEX IF NOT EXISTS "ActionAssignment_actionItemId_idx" ON "ActionAssignment"("actionItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "ActionAssignment_actionItemId_userId_role_key" ON "ActionAssignment"("actionItemId", "userId", "role");

CREATE INDEX IF NOT EXISTS "ActionComment_actionItemId_createdAt_idx" ON "ActionComment"("actionItemId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActionComment_authorId_idx" ON "ActionComment"("authorId");

CREATE INDEX IF NOT EXISTS "ActionFileLink_actionItemId_idx" ON "ActionFileLink"("actionItemId");
CREATE INDEX IF NOT EXISTS "ActionFileLink_addedById_idx" ON "ActionFileLink"("addedById");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ActionAssignment" ADD CONSTRAINT "ActionAssignment_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ActionAssignment" ADD CONSTRAINT "ActionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ActionComment" ADD CONSTRAINT "ActionComment_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ActionComment" ADD CONSTRAINT "ActionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ActionFileLink" ADD CONSTRAINT "ActionFileLink_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ActionFileLink" ADD CONSTRAINT "ActionFileLink_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
