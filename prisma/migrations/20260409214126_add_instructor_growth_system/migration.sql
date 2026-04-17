DO $$ BEGIN
  CREATE TYPE "InstructorGrowthTier" AS ENUM (
    'SPARK',
    'PRACTITIONER',
    'CATALYST',
    'PATHMAKER',
    'LEADER',
    'LUMINARY',
    'FELLOW'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InstructorGrowthCategory" AS ENUM (
    'TEACHING',
    'GROWTH',
    'COMMUNITY',
    'IMPACT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InstructorGrowthSourceMethod" AS ENUM (
    'AUTO',
    'CLAIM',
    'MANUAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InstructorGrowthStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'REVOKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUCTOR_GROWTH_CLAIM_SUBMITTED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUCTOR_GROWTH_CLAIM_APPROVED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUCTOR_GROWTH_CLAIM_REJECTED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUCTOR_GROWTH_EVENT_REVOKED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "InstructorGrowthProfile" (
  "id" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "currentTier" "InstructorGrowthTier" NOT NULL,
  "lifetimeXp" INTEGER NOT NULL DEFAULT 0,
  "currentSemesterLabel" TEXT,
  "currentSemesterXp" INTEGER NOT NULL DEFAULT 0,
  "approvedEventCount" INTEGER NOT NULL DEFAULT 0,
  "pendingEventCount" INTEGER NOT NULL DEFAULT 0,
  "badgeCount" INTEGER NOT NULL DEFAULT 0,
  "lastEvaluatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstructorGrowthProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstructorGrowthProfile_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "InstructorGrowthEvent" (
  "id" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "category" "InstructorGrowthCategory" NOT NULL,
  "sourceMethod" "InstructorGrowthSourceMethod" NOT NULL,
  "status" "InstructorGrowthStatus" NOT NULL DEFAULT 'PENDING',
  "eventKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "xpAmount" INTEGER NOT NULL DEFAULT 0,
  "semesterLabel" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "dedupeKey" TEXT,
  "relatedUserId" TEXT,
  "submittedById" TEXT,
  "assignedMentorId" TEXT,
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "claimContext" TEXT,
  "evidenceUrl" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstructorGrowthEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstructorGrowthEvent_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InstructorGrowthEvent_relatedUserId_fkey"
    FOREIGN KEY ("relatedUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InstructorGrowthEvent_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InstructorGrowthEvent_assignedMentorId_fkey"
    FOREIGN KEY ("assignedMentorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InstructorGrowthEvent_reviewerId_fkey"
    FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InstructorGrowthEvent_revokedById_fkey"
    FOREIGN KEY ("revokedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "InstructorGrowthBadgeDefinition" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "flavorText" TEXT,
  "icon" TEXT NOT NULL,
  "accentColor" TEXT,
  "perkText" TEXT,
  "criteria" JSONB NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstructorGrowthBadgeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InstructorGrowthBadgeAward" (
  "id" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "badgeId" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "semesterLabel" TEXT,
  "metadata" JSONB,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InstructorGrowthBadgeAward_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstructorGrowthBadgeAward_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InstructorGrowthBadgeAward_badgeId_fkey"
    FOREIGN KEY ("badgeId") REFERENCES "InstructorGrowthBadgeDefinition"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InstructorGrowthBadgeAward_sourceEventId_fkey"
    FOREIGN KEY ("sourceEventId") REFERENCES "InstructorGrowthEvent"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "InstructorGrowthSemesterStat" (
  "id" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "semesterLabel" TEXT NOT NULL,
  "totalXp" INTEGER NOT NULL DEFAULT 0,
  "teachingXp" INTEGER NOT NULL DEFAULT 0,
  "growthXp" INTEGER NOT NULL DEFAULT 0,
  "communityXp" INTEGER NOT NULL DEFAULT 0,
  "impactXp" INTEGER NOT NULL DEFAULT 0,
  "approvedEventCount" INTEGER NOT NULL DEFAULT 0,
  "pendingEventCount" INTEGER NOT NULL DEFAULT 0,
  "badgeCount" INTEGER NOT NULL DEFAULT 0,
  "lastEventAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstructorGrowthSemesterStat_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstructorGrowthSemesterStat_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorGrowthProfile_instructorId_key"
  ON "InstructorGrowthProfile"("instructorId");

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorGrowthEvent_instructorId_dedupeKey_key"
  ON "InstructorGrowthEvent"("instructorId", "dedupeKey");

CREATE INDEX IF NOT EXISTS "InstructorGrowthEvent_instructorId_status_createdAt_idx"
  ON "InstructorGrowthEvent"("instructorId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "InstructorGrowthEvent_assignedMentorId_status_createdAt_idx"
  ON "InstructorGrowthEvent"("assignedMentorId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "InstructorGrowthEvent_reviewerId_status_createdAt_idx"
  ON "InstructorGrowthEvent"("reviewerId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "InstructorGrowthEvent_semesterLabel_idx"
  ON "InstructorGrowthEvent"("semesterLabel");

CREATE INDEX IF NOT EXISTS "InstructorGrowthEvent_eventKey_idx"
  ON "InstructorGrowthEvent"("eventKey");

CREATE INDEX IF NOT EXISTS "InstructorGrowthEvent_sourceType_sourceId_idx"
  ON "InstructorGrowthEvent"("sourceType", "sourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorGrowthBadgeDefinition_slug_key"
  ON "InstructorGrowthBadgeDefinition"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorGrowthBadgeAward_instructorId_badgeId_key"
  ON "InstructorGrowthBadgeAward"("instructorId", "badgeId");

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorGrowthSemesterStat_instructorId_semesterLabel_key"
  ON "InstructorGrowthSemesterStat"("instructorId", "semesterLabel");
