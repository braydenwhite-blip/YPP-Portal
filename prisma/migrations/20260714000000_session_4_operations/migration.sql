-- Session 4 operational workflow persistence (idempotent; safe if family tables arrive later)

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "deliveryState" TEXT NOT NULL DEFAULT 'SENT';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "eventType" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "relatedEntityType" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "relatedEntityId" TEXT;

-- Existing production data can contain multiple notifications for the same
-- user/dedupeKey pair because dedupeKey was previously indexed but not unique.
-- Keep the earliest row as the canonical deduped notification and preserve the
-- duplicate notifications by clearing only their dedupeKey before adding the
-- uniqueness guard. This makes the migration safe to re-run after a failed
-- deploy without deleting user-visible notification history.
WITH duplicate_notifications AS (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "userId", "dedupeKey"
        ORDER BY "createdAt" ASC, "id" ASC
      ) AS duplicate_rank
    FROM "Notification"
    WHERE "dedupeKey" IS NOT NULL
  ) ranked_notifications
  WHERE duplicate_rank > 1
)
UPDATE "Notification"
SET "dedupeKey" = NULL
WHERE "id" IN (SELECT "id" FROM duplicate_notifications);

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey") WHERE "dedupeKey" IS NOT NULL;

ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "operationalSourceKey" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "operationalSourceType" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "operationalIssueType" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ActionItem_chapterId_operationalSourceKey_key" ON "ActionItem"("chapterId", "operationalSourceKey") WHERE "operationalSourceKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ActionItem_operationalSourceType_operationalIssueType_idx" ON "ActionItem"("operationalSourceType", "operationalIssueType");

-- Family portal tables may not exist yet on DBs that apply session_4 before
-- family_portal_session_2. Guard ALTERs; later CREATE TABLE migrations include
-- these columns for fresh installs.
DO $$ BEGIN
  IF to_regclass('public."FamilySupportRequest"') IS NOT NULL THEN
    ALTER TABLE "FamilySupportRequest" ADD COLUMN IF NOT EXISTS "internalOwnerId" TEXT;
    ALTER TABLE "FamilySupportRequest" ADD COLUMN IF NOT EXISTS "internalCategory" TEXT;
    ALTER TABLE "FamilySupportRequest" ADD COLUMN IF NOT EXISTS "internalSeverity" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public."FamilySupportResponse"') IS NOT NULL THEN
    ALTER TABLE "FamilySupportResponse" ADD COLUMN IF NOT EXISTS "responseType" TEXT NOT NULL DEFAULT 'FAMILY_VISIBLE';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public."FamilyFormRequirement"') IS NOT NULL THEN
    ALTER TABLE "FamilyFormRequirement" ADD COLUMN IF NOT EXISTS "blocksEnrollment" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "FamilyFormRequirement" ADD COLUMN IF NOT EXISTS "blocksAttendance" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "FamilyFormRequirement" ADD COLUMN IF NOT EXISTS "staffReviewRequired" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public."FamilyFormSubmission"') IS NOT NULL THEN
    ALTER TABLE "FamilyFormSubmission" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
    ALTER TABLE "FamilyFormSubmission" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
    ALTER TABLE "FamilyFormSubmission" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;
  END IF;
END $$;

ALTER TABLE "ClassAnnouncement" ADD COLUMN IF NOT EXISTS "announcementType" TEXT NOT NULL DEFAULT 'CLASS_REMINDER';
ALTER TABLE "ClassAnnouncement" ADD COLUMN IF NOT EXISTS "audience" TEXT NOT NULL DEFAULT 'ADMITTED_FAMILIES';
ALTER TABLE "ClassAnnouncement" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "ClassAnnouncement" ADD COLUMN IF NOT EXISTS "approvalRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClassAnnouncement" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "ClassAnnouncement" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "ClassAnnouncement" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "ClassAnnouncement" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

CREATE TABLE IF NOT EXISTS "InstructorAssignmentHistory" (
  "id" TEXT PRIMARY KEY,
  "offeringId" TEXT NOT NULL,
  "previousInstructorId" TEXT,
  "newInstructorId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "assignmentSource" TEXT NOT NULL DEFAULT 'CHAPTER_OPERATIONS',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "readinessOverride" BOOLEAN NOT NULL DEFAULT false,
  "readinessSnapshot" JSONB
);
CREATE INDEX IF NOT EXISTS "InstructorAssignmentHistory_offeringId_active_idx" ON "InstructorAssignmentHistory"("offeringId", "active");
CREATE INDEX IF NOT EXISTS "InstructorAssignmentHistory_newInstructorId_idx" ON "InstructorAssignmentHistory"("newInstructorId");

CREATE TABLE IF NOT EXISTS "OperationalAuditEvent" (
  "id" TEXT PRIMARY KEY,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "previousState" JSONB,
  "newState" JSONB,
  "reason" TEXT,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "OperationalAuditEvent_sourceType_sourceId_createdAt_idx" ON "OperationalAuditEvent"("sourceType", "sourceId", "createdAt");

CREATE TABLE IF NOT EXISTS "BiweeklyActionPacket" (
  "id" TEXT PRIMARY KEY,
  "chapterId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'GENERATED',
  "generatedById" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedById" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "notes" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "BiweeklyActionPacket_chapterId_periodStart_periodEnd_key" ON "BiweeklyActionPacket"("chapterId", "periodStart", "periodEnd");

CREATE TABLE IF NOT EXISTS "BiweeklyActionPacketItem" (
  "id" TEXT PRIMARY KEY,
  "packetId" TEXT NOT NULL REFERENCES "BiweeklyActionPacket"("id") ON DELETE CASCADE,
  "actionItemId" TEXT,
  "sourceKey" TEXT NOT NULL,
  "ownerId" TEXT,
  "dueAt" TIMESTAMP(3),
  "state" TEXT NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "completedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "BiweeklyActionPacketItem_packetId_sourceKey_key" ON "BiweeklyActionPacketItem"("packetId", "sourceKey");

CREATE TABLE IF NOT EXISTS "LeadershipIntervention" (
  "id" TEXT PRIMARY KEY,
  "chapterId" TEXT NOT NULL,
  "actionItemId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "ownerId" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "note" TEXT NOT NULL,
  "meetingId" TEXT,
  "dueAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "ClassOffering" ALTER COLUMN "instructorId" DROP NOT NULL;
