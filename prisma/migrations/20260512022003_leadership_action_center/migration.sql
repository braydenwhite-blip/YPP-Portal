-- Migration: leadership_action_center
--
-- Adds the Leadership Action Center: a structured tracker that turns the
-- "Action Items Tracker" spreadsheet + weekly leadership email into one
-- portal-native dataset officers can both edit and read off of.
--
-- All changes are strictly additive. Replays are safe (IF NOT EXISTS +
-- guarded enum DO blocks).
--
-- Adds:
--   * Enum `LeadershipActionCategory`     (INSTRUCTION | TECHNOLOGY |
--                                          COMMUNICATION | STAFF_MANAGEMENT)
--   * Enum `LeadershipActionStatus`       (NOT_STARTED | IN_PROGRESS |
--                                          BLOCKED | COMPLETE)
--   * Enum `LeadershipActionPriority`     (LOW | NORMAL | HIGH | URGENT)
--   * Enum `LeadershipActionSource`       (MANUAL | SPREADSHEET | EMAIL | IMPORT)
--   * Enum `LeadershipMeetingKind`        (OFFICERS | MARKETING | TECH |
--                                          INSTRUCTION | STAFF | OTHER)
--   * Enum `LeadershipActionUpdateKind`   (COMMENT | STATUS_CHANGE |
--                                          ASSIGNEE_CHANGE | DEADLINE_CHANGE |
--                                          CREATED | IMPORTED)
--   * Table `LeadershipMeeting`
--   * Table `LeadershipActionItem`
--   * Table `LeadershipActionItemInput`
--   * Table `LeadershipActionItemUpdate`

-- 1) Enums -------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "LeadershipActionCategory" AS ENUM (
    'INSTRUCTION',
    'TECHNOLOGY',
    'COMMUNICATION',
    'STAFF_MANAGEMENT'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadershipActionStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'BLOCKED',
    'COMPLETE'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadershipActionPriority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadershipActionSource" AS ENUM (
    'MANUAL',
    'SPREADSHEET',
    'EMAIL',
    'IMPORT'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadershipMeetingKind" AS ENUM (
    'OFFICERS',
    'MARKETING',
    'TECH',
    'INSTRUCTION',
    'STAFF',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadershipActionUpdateKind" AS ENUM (
    'COMMENT',
    'STATUS_CHANGE',
    'ASSIGNEE_CHANGE',
    'DEADLINE_CHANGE',
    'CREATED',
    'IMPORTED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2) LeadershipMeeting -------------------------------------------------------

CREATE TABLE IF NOT EXISTS "LeadershipMeeting" (
  "id"          TEXT                   NOT NULL,
  "title"       TEXT                   NOT NULL,
  "kind"        "LeadershipMeetingKind" NOT NULL DEFAULT 'OFFICERS',
  "scheduledAt" TIMESTAMP(3),
  "notes"       TEXT,
  "ownerId"     TEXT,
  "archivedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)           NOT NULL,
  CONSTRAINT "LeadershipMeeting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadershipMeeting_kind_scheduledAt_idx"
  ON "LeadershipMeeting" ("kind", "scheduledAt");
CREATE INDEX IF NOT EXISTS "LeadershipMeeting_scheduledAt_idx"
  ON "LeadershipMeeting" ("scheduledAt");

DO $$ BEGIN
  ALTER TABLE "LeadershipMeeting"
    ADD CONSTRAINT "LeadershipMeeting_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3) LeadershipActionItem ---------------------------------------------------

CREATE TABLE IF NOT EXISTS "LeadershipActionItem" (
  "id"                    TEXT                       NOT NULL,
  "title"                 TEXT                       NOT NULL,
  "description"           TEXT,
  "category"              "LeadershipActionCategory" NOT NULL DEFAULT 'INSTRUCTION',
  "status"                "LeadershipActionStatus"   NOT NULL DEFAULT 'NOT_STARTED',
  "priority"              "LeadershipActionPriority" NOT NULL DEFAULT 'NORMAL',
  "source"                "LeadershipActionSource"   NOT NULL DEFAULT 'MANUAL',
  "sourceLabel"           TEXT,
  "sourceNotes"           TEXT,
  "dueDate"               TIMESTAMP(3),
  "weekStart"             TIMESTAMP(3),
  "needsOfficerDiscussion" BOOLEAN                    NOT NULL DEFAULT false,
  "officerDiscussionDate"  TIMESTAMP(3),
  "meetingId"             TEXT,
  "primaryOwnerId"        TEXT,
  "ownerNames"            TEXT[]                     NOT NULL DEFAULT ARRAY[]::TEXT[],
  "inputNeededNames"      TEXT[]                     NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes"                 TEXT,
  "completedAt"           TIMESTAMP(3),
  "createdById"           TEXT,
  "updatedById"           TEXT,
  "archivedAt"            TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3)               NOT NULL,
  CONSTRAINT "LeadershipActionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadershipActionItem_status_dueDate_idx"
  ON "LeadershipActionItem" ("status", "dueDate");
CREATE INDEX IF NOT EXISTS "LeadershipActionItem_category_status_idx"
  ON "LeadershipActionItem" ("category", "status");
CREATE INDEX IF NOT EXISTS "LeadershipActionItem_weekStart_status_idx"
  ON "LeadershipActionItem" ("weekStart", "status");
CREATE INDEX IF NOT EXISTS "LeadershipActionItem_primaryOwnerId_status_idx"
  ON "LeadershipActionItem" ("primaryOwnerId", "status");
CREATE INDEX IF NOT EXISTS "LeadershipActionItem_needsOfficerDiscussion_officerDiscussionDate_idx"
  ON "LeadershipActionItem" ("needsOfficerDiscussion", "officerDiscussionDate");
CREATE INDEX IF NOT EXISTS "LeadershipActionItem_meetingId_idx"
  ON "LeadershipActionItem" ("meetingId");
CREATE INDEX IF NOT EXISTS "LeadershipActionItem_archivedAt_idx"
  ON "LeadershipActionItem" ("archivedAt");

DO $$ BEGIN
  ALTER TABLE "LeadershipActionItem"
    ADD CONSTRAINT "LeadershipActionItem_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "LeadershipMeeting"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadershipActionItem"
    ADD CONSTRAINT "LeadershipActionItem_primaryOwnerId_fkey"
    FOREIGN KEY ("primaryOwnerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadershipActionItem"
    ADD CONSTRAINT "LeadershipActionItem_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadershipActionItem"
    ADD CONSTRAINT "LeadershipActionItem_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 4) LeadershipActionItemInput ----------------------------------------------

CREATE TABLE IF NOT EXISTS "LeadershipActionItemInput" (
  "id"           TEXT         NOT NULL,
  "actionItemId" TEXT         NOT NULL,
  "userId"       TEXT         NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadershipActionItemInput_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadershipActionItemInput_actionItemId_userId_key"
  ON "LeadershipActionItemInput" ("actionItemId", "userId");
CREATE INDEX IF NOT EXISTS "LeadershipActionItemInput_userId_idx"
  ON "LeadershipActionItemInput" ("userId");

DO $$ BEGIN
  ALTER TABLE "LeadershipActionItemInput"
    ADD CONSTRAINT "LeadershipActionItemInput_actionItemId_fkey"
    FOREIGN KEY ("actionItemId") REFERENCES "LeadershipActionItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadershipActionItemInput"
    ADD CONSTRAINT "LeadershipActionItemInput_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 5) LeadershipActionItemUpdate ---------------------------------------------

CREATE TABLE IF NOT EXISTS "LeadershipActionItemUpdate" (
  "id"           TEXT                         NOT NULL,
  "actionItemId" TEXT                         NOT NULL,
  "authorId"     TEXT,
  "kind"         "LeadershipActionUpdateKind" NOT NULL DEFAULT 'COMMENT',
  "body"         TEXT                         NOT NULL,
  "createdAt"    TIMESTAMP(3)                 NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadershipActionItemUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadershipActionItemUpdate_actionItemId_createdAt_idx"
  ON "LeadershipActionItemUpdate" ("actionItemId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "LeadershipActionItemUpdate"
    ADD CONSTRAINT "LeadershipActionItemUpdate_actionItemId_fkey"
    FOREIGN KEY ("actionItemId") REFERENCES "LeadershipActionItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadershipActionItemUpdate"
    ADD CONSTRAINT "LeadershipActionItemUpdate_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
