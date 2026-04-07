-- CreateEnum
CREATE TYPE "AdminSubtype" AS ENUM (
    'SUPER_ADMIN',
    'HIRING_ADMIN',
    'MENTORSHIP_ADMIN',
    'INTAKE_ADMIN',
    'CONTENT_ADMIN',
    'COMMUNICATIONS_ADMIN'
);

-- CreateEnum
CREATE TYPE "WorkflowKind" AS ENUM (
    'INSTRUCTOR_APPLICATION',
    'CHAPTER_PRESIDENT_APPLICATION',
    'INTERVIEW_DECISION',
    'MENTORSHIP_REVIEW',
    'MENTORSHIP_CHAIR_APPROVAL',
    'MENTORSHIP_AWARD',
    'STUDENT_INTAKE',
    'CONTENT_APPROVAL',
    'NOTIFICATION_ROUTING',
    'MESSAGE_ROUTING'
);

-- CreateEnum
CREATE TYPE "WorkflowStage" AS ENUM (
    'INBOX',
    'CHAPTER_REVIEW',
    'REVIEW',
    'INTERVIEW',
    'DECISION',
    'CHAIR_REVIEW',
    'FINAL_APPROVAL',
    'LAUNCH',
    'DELIVERY',
    'COMPLETE',
    'ARCHIVED'
);

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'BLOCKED',
    'COMPLETE',
    'CANCELLED'
);

-- CreateEnum
CREATE TYPE "WorkflowCommentKind" AS ENUM (
    'COMMENT',
    'SYSTEM_ASSIGNMENT',
    'SYSTEM_STAGE_CHANGE',
    'MANUAL_OVERRIDE'
);

-- CreateEnum
CREATE TYPE "WorkflowAssignmentTargetType" AS ENUM (
    'USER',
    'ADMIN_SUBTYPE',
    'ROLE',
    'SUPER_ADMIN_QUEUE'
);

-- CreateTable
CREATE TABLE "UserAdminSubtype" (
    "userId" TEXT NOT NULL,
    "subtype" "AdminSubtype" NOT NULL,
    "isDefaultOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAdminSubtype_pkey" PRIMARY KEY ("userId","subtype")
);

-- CreateTable
CREATE TABLE "WorkflowItem" (
    "id" TEXT NOT NULL,
    "kind" "WorkflowKind" NOT NULL,
    "stage" "WorkflowStage" NOT NULL DEFAULT 'INBOX',
    "status" "WorkflowStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "href" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "chapterId" TEXT,
    "subjectUserId" TEXT,
    "dueAt" TIMESTAMP(3),
    "assigneeUserId" TEXT,
    "assigneeSubtype" "AdminSubtype",
    "assignmentTargetType" "WorkflowAssignmentTargetType",
    "allowedAssigneeRole" "RoleType",
    "allowedAdminSubtype" "AdminSubtype",
    "assignmentReason" TEXT,
    "manualOverrideById" TEXT,
    "manualOverrideAt" TIMESTAMP(3),
    "lastRoutedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowComment" (
    "id" TEXT NOT NULL,
    "workflowItemId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" "WorkflowCommentKind" NOT NULL DEFAULT 'COMMENT',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowActionItem" (
    "id" TEXT NOT NULL,
    "workflowItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowAssignmentRule" (
    "id" TEXT NOT NULL,
    "kind" "WorkflowKind" NOT NULL,
    "stage" "WorkflowStage" NOT NULL,
    "chapterId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assigneeUserId" TEXT,
    "assigneeSubtype" "AdminSubtype",
    "assigneeRole" "RoleType",
    "note" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowAssignmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAdminSubtype_subtype_isDefaultOwner_idx" ON "UserAdminSubtype"("subtype", "isDefaultOwner");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowItem_sourceType_sourceId_kind_key" ON "WorkflowItem"("sourceType", "sourceId", "kind");

-- CreateIndex
CREATE INDEX "WorkflowItem_kind_stage_status_idx" ON "WorkflowItem"("kind", "stage", "status");

-- CreateIndex
CREATE INDEX "WorkflowItem_chapterId_kind_stage_status_idx" ON "WorkflowItem"("chapterId", "kind", "stage", "status");

-- CreateIndex
CREATE INDEX "WorkflowItem_assigneeUserId_status_dueAt_idx" ON "WorkflowItem"("assigneeUserId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkflowItem_subjectUserId_status_dueAt_idx" ON "WorkflowItem"("subjectUserId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkflowComment_workflowItemId_createdAt_idx" ON "WorkflowComment"("workflowItemId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowActionItem_workflowItemId_status_idx" ON "WorkflowActionItem"("workflowItemId", "status");

-- CreateIndex
CREATE INDEX "WorkflowActionItem_ownerId_status_dueAt_idx" ON "WorkflowActionItem"("ownerId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkflowAssignmentRule_kind_stage_chapterId_isActive_priority_idx" ON "WorkflowAssignmentRule"("kind", "stage", "chapterId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "WorkflowAssignmentRule_assigneeSubtype_isActive_idx" ON "WorkflowAssignmentRule"("assigneeSubtype", "isActive");

-- AddForeignKey
ALTER TABLE "UserAdminSubtype"
ADD CONSTRAINT "UserAdminSubtype_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowItem"
ADD CONSTRAINT "WorkflowItem_chapterId_fkey"
FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowItem"
ADD CONSTRAINT "WorkflowItem_subjectUserId_fkey"
FOREIGN KEY ("subjectUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowItem"
ADD CONSTRAINT "WorkflowItem_assigneeUserId_fkey"
FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowItem"
ADD CONSTRAINT "WorkflowItem_manualOverrideById_fkey"
FOREIGN KEY ("manualOverrideById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowItem"
ADD CONSTRAINT "WorkflowItem_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowItem"
ADD CONSTRAINT "WorkflowItem_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowComment"
ADD CONSTRAINT "WorkflowComment_workflowItemId_fkey"
FOREIGN KEY ("workflowItemId") REFERENCES "WorkflowItem"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowComment"
ADD CONSTRAINT "WorkflowComment_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowActionItem"
ADD CONSTRAINT "WorkflowActionItem_workflowItemId_fkey"
FOREIGN KEY ("workflowItemId") REFERENCES "WorkflowItem"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowActionItem"
ADD CONSTRAINT "WorkflowActionItem_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowActionItem"
ADD CONSTRAINT "WorkflowActionItem_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAssignmentRule"
ADD CONSTRAINT "WorkflowAssignmentRule_chapterId_fkey"
FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAssignmentRule"
ADD CONSTRAINT "WorkflowAssignmentRule_assigneeUserId_fkey"
FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAssignmentRule"
ADD CONSTRAINT "WorkflowAssignmentRule_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAssignmentRule"
ADD CONSTRAINT "WorkflowAssignmentRule_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
