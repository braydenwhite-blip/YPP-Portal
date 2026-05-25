-- Migration: instructor_ops_v2
-- Adds the Instructor Operations V2 layer:
--   InstructorProfile, Tag, InstructorTag, InstructorNote,
--   InstructorTask, InstructorSavedView, InstructorMetricSnapshot
-- plus three new enums: InstructorLifecycleStage, TagNamespace, InstructorTaskKind.

-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "InstructorLifecycleStage" AS ENUM (
    'APPLICANT',
    'ONBOARDING',
    'ACTIVE',
    'BENCH',
    'PAUSED',
    'ALUMNI'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TagNamespace" AS ENUM (
    'SKILL',
    'INTEREST',
    'LANGUAGE',
    'AVAILABILITY',
    'TRAIT',
    'CERTIFICATION',
    'CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InstructorTaskKind" AS ENUM (
    'CERT_EXPIRING',
    'STALLED_STAGE',
    'IDLE_30D',
    'DECLINED_REPEAT',
    'GHOSTING_MENTEE',
    'TRAINING_OVERDUE',
    'MANUAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── InstructorProfile ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "InstructorProfile" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "lifecycleStage"   "InstructorLifecycleStage" NOT NULL DEFAULT 'ACTIVE',
  "stageEnteredAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "weeklyHoursAvail" INTEGER,
  "maxConcurrent"    INTEGER NOT NULL DEFAULT 2,
  "isLeadershipTrack" BOOLEAN NOT NULL DEFAULT false,
  "isOnHold"         BOOLEAN NOT NULL DEFAULT false,
  "readinessScore"   INTEGER,
  "reliabilityScore" INTEGER,
  "lastActiveAt"     TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorProfile_userId_key"
  ON "InstructorProfile"("userId");

CREATE INDEX IF NOT EXISTS "InstructorProfile_lifecycleStage_idx"
  ON "InstructorProfile"("lifecycleStage");

CREATE INDEX IF NOT EXISTS "InstructorProfile_isLeadershipTrack_idx"
  ON "InstructorProfile"("isLeadershipTrack");

CREATE INDEX IF NOT EXISTS "InstructorProfile_isOnHold_idx"
  ON "InstructorProfile"("isOnHold");

CREATE INDEX IF NOT EXISTS "InstructorProfile_readinessScore_idx"
  ON "InstructorProfile"("readinessScore");

CREATE INDEX IF NOT EXISTS "InstructorProfile_lastActiveAt_idx"
  ON "InstructorProfile"("lastActiveAt");

DO $$ BEGIN
  ALTER TABLE "InstructorProfile"
    ADD CONSTRAINT "InstructorProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tag ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Tag" (
  "id"        TEXT NOT NULL,
  "namespace" "TagNamespace" NOT NULL,
  "slug"      TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "color"     TEXT,
  "isSystem"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tag_namespace_slug_key"
  ON "Tag"("namespace", "slug");

CREATE INDEX IF NOT EXISTS "Tag_namespace_idx"
  ON "Tag"("namespace");

-- ── InstructorTag ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "InstructorTag" (
  "profileId" TEXT NOT NULL,
  "tagId"     TEXT NOT NULL,
  "source"    TEXT NOT NULL DEFAULT 'manual',
  "addedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorTag_pkey" PRIMARY KEY ("profileId", "tagId")
);

CREATE INDEX IF NOT EXISTS "InstructorTag_tagId_idx"
  ON "InstructorTag"("tagId");

DO $$ BEGIN
  ALTER TABLE "InstructorTag"
    ADD CONSTRAINT "InstructorTag_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorTag"
    ADD CONSTRAINT "InstructorTag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── InstructorNote ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "InstructorNote" (
  "id"         TEXT NOT NULL,
  "profileId"  TEXT NOT NULL,
  "authorId"   TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "isPinned"   BOOLEAN NOT NULL DEFAULT false,
  "visibility" TEXT NOT NULL DEFAULT 'global',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InstructorNote_profileId_isPinned_createdAt_idx"
  ON "InstructorNote"("profileId", "isPinned", "createdAt");

CREATE INDEX IF NOT EXISTS "InstructorNote_authorId_idx"
  ON "InstructorNote"("authorId");

DO $$ BEGIN
  ALTER TABLE "InstructorNote"
    ADD CONSTRAINT "InstructorNote_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorNote"
    ADD CONSTRAINT "InstructorNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── InstructorTask ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "InstructorTask" (
  "id"           TEXT NOT NULL,
  "profileId"    TEXT NOT NULL,
  "kind"         "InstructorTaskKind" NOT NULL DEFAULT 'MANUAL',
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "dueAt"        TIMESTAMP(3),
  "assigneeId"   TEXT,
  "resolvedAt"   TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InstructorTask_profileId_resolvedAt_idx"
  ON "InstructorTask"("profileId", "resolvedAt");

CREATE INDEX IF NOT EXISTS "InstructorTask_dueAt_idx"
  ON "InstructorTask"("dueAt");

CREATE INDEX IF NOT EXISTS "InstructorTask_assigneeId_resolvedAt_idx"
  ON "InstructorTask"("assigneeId", "resolvedAt");

DO $$ BEGIN
  ALTER TABLE "InstructorTask"
    ADD CONSTRAINT "InstructorTask_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorTask"
    ADD CONSTRAINT "InstructorTask_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── InstructorSavedView ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "InstructorSavedView" (
  "id"        TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "filters"   JSONB NOT NULL DEFAULT '{}',
  "isShared"  BOOLEAN NOT NULL DEFAULT false,
  "scope"     TEXT NOT NULL DEFAULT 'personal',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorSavedView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InstructorSavedView_ownerId_idx"
  ON "InstructorSavedView"("ownerId");

CREATE INDEX IF NOT EXISTS "InstructorSavedView_isShared_scope_idx"
  ON "InstructorSavedView"("isShared", "scope");

DO $$ BEGIN
  ALTER TABLE "InstructorSavedView"
    ADD CONSTRAINT "InstructorSavedView_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── InstructorMetricSnapshot ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "InstructorMetricSnapshot" (
  "id"             TEXT NOT NULL,
  "profileId"      TEXT NOT NULL,
  "weekStart"      TIMESTAMP(3) NOT NULL,
  "classesTaught"  INTEGER NOT NULL DEFAULT 0,
  "hoursTaught"    INTEGER NOT NULL DEFAULT 0,
  "noShows"        INTEGER NOT NULL DEFAULT 0,
  "ratingAvg"      DOUBLE PRECISION,
  "studentsServed" INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorMetricSnapshot_profileId_weekStart_key"
  ON "InstructorMetricSnapshot"("profileId", "weekStart");

CREATE INDEX IF NOT EXISTS "InstructorMetricSnapshot_profileId_weekStart_idx"
  ON "InstructorMetricSnapshot"("profileId", "weekStart");

DO $$ BEGIN
  ALTER TABLE "InstructorMetricSnapshot"
    ADD CONSTRAINT "InstructorMetricSnapshot_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
