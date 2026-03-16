-- Mentorship redesign backbone: support circles, sessions, requests, and resources.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportRole') THEN
    CREATE TYPE "SupportRole" AS ENUM (
      'PRIMARY_MENTOR',
      'CHAIR',
      'SPECIALIST_MENTOR',
      'COLLEGE_ADVISOR',
      'ALUMNI_ADVISOR',
      'PEER_SUPPORT'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorshipSessionType') THEN
    CREATE TYPE "MentorshipSessionType" AS ENUM (
      'KICKOFF',
      'CHECK_IN',
      'REVIEW_PREP',
      'QUARTERLY_REVIEW',
      'OFFICE_HOURS'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorshipActionItemStatus') THEN
    CREATE TYPE "MentorshipActionItemStatus" AS ENUM (
      'OPEN',
      'IN_PROGRESS',
      'BLOCKED',
      'COMPLETE'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorshipRequestKind') THEN
    CREATE TYPE "MentorshipRequestKind" AS ENUM (
      'PROJECT_FEEDBACK',
      'SUBJECT_GUIDANCE',
      'CAREER_GUIDANCE',
      'ESCALATION',
      'GENERAL_QNA'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorshipRequestVisibility') THEN
    CREATE TYPE "MentorshipRequestVisibility" AS ENUM (
      'PRIVATE',
      'PUBLIC'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorshipRequestStatus') THEN
    CREATE TYPE "MentorshipRequestStatus" AS ENUM (
      'OPEN',
      'ANSWERED',
      'CLOSED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorshipResourceType') THEN
    CREATE TYPE "MentorshipResourceType" AS ENUM (
      'LINK',
      'PLAYBOOK',
      'TOOL',
      'VIDEO',
      'TEMPLATE',
      'ANSWER'
    );
  END IF;
END $$;

ALTER TABLE "UserProfile"
  ADD COLUMN IF NOT EXISTS "mentorCapacity" INTEGER,
  ADD COLUMN IF NOT EXISTS "mentorAvailability" TEXT;

CREATE TABLE IF NOT EXISTS "MentorshipCircleMember" (
  "id" TEXT NOT NULL,
  "mentorshipId" TEXT,
  "menteeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "SupportRole" NOT NULL,
  "source" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "availabilityNotes" TEXT,
  "capacityOverride" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MentorshipCircleMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MentorshipSession" (
  "id" TEXT NOT NULL,
  "mentorshipId" TEXT,
  "menteeId" TEXT NOT NULL,
  "type" "MentorshipSessionType" NOT NULL,
  "title" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "durationMinutes" INTEGER,
  "agenda" TEXT,
  "notes" TEXT,
  "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "attendedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdById" TEXT NOT NULL,
  "ledById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MentorshipSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MentorshipActionItem" (
  "id" TEXT NOT NULL,
  "mentorshipId" TEXT,
  "menteeId" TEXT NOT NULL,
  "sessionId" TEXT,
  "title" TEXT NOT NULL,
  "details" TEXT,
  "status" "MentorshipActionItemStatus" NOT NULL DEFAULT 'OPEN',
  "ownerId" TEXT,
  "createdById" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MentorshipActionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MentorshipRequest" (
  "id" TEXT NOT NULL,
  "mentorshipId" TEXT,
  "menteeId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "assignedToId" TEXT,
  "trackId" TEXT,
  "kind" "MentorshipRequestKind" NOT NULL,
  "visibility" "MentorshipRequestVisibility" NOT NULL,
  "status" "MentorshipRequestStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
  "passionId" TEXT,
  "projectId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "lastResponseAt" TIMESTAMP(3),
  CONSTRAINT "MentorshipRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MentorshipRequestResponse" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "responderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "videoUrl" TEXT,
  "resourceLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isHelpful" BOOLEAN,
  "helpfulCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MentorshipRequestResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MentorshipResource" (
  "id" TEXT NOT NULL,
  "mentorshipId" TEXT,
  "menteeId" TEXT,
  "requestId" TEXT,
  "responseId" TEXT,
  "trackId" TEXT,
  "createdById" TEXT NOT NULL,
  "type" "MentorshipResourceType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "url" TEXT,
  "body" TEXT,
  "passionId" TEXT,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MentorshipResource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MentorshipCircleMember_menteeId_userId_role_key"
  ON "MentorshipCircleMember"("menteeId", "userId", "role");

CREATE INDEX IF NOT EXISTS "MentorshipCircleMember_mentorshipId_idx"
  ON "MentorshipCircleMember"("mentorshipId");
CREATE INDEX IF NOT EXISTS "MentorshipCircleMember_menteeId_isActive_idx"
  ON "MentorshipCircleMember"("menteeId", "isActive");
CREATE INDEX IF NOT EXISTS "MentorshipCircleMember_userId_isActive_idx"
  ON "MentorshipCircleMember"("userId", "isActive");

CREATE INDEX IF NOT EXISTS "MentorshipSession_mentorshipId_idx"
  ON "MentorshipSession"("mentorshipId");
CREATE INDEX IF NOT EXISTS "MentorshipSession_menteeId_scheduledAt_idx"
  ON "MentorshipSession"("menteeId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "MentorshipSession_createdById_idx"
  ON "MentorshipSession"("createdById");

CREATE INDEX IF NOT EXISTS "MentorshipActionItem_mentorshipId_idx"
  ON "MentorshipActionItem"("mentorshipId");
CREATE INDEX IF NOT EXISTS "MentorshipActionItem_menteeId_status_idx"
  ON "MentorshipActionItem"("menteeId", "status");
CREATE INDEX IF NOT EXISTS "MentorshipActionItem_ownerId_status_idx"
  ON "MentorshipActionItem"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "MentorshipActionItem_sessionId_idx"
  ON "MentorshipActionItem"("sessionId");

CREATE INDEX IF NOT EXISTS "MentorshipRequest_mentorshipId_idx"
  ON "MentorshipRequest"("mentorshipId");
CREATE INDEX IF NOT EXISTS "MentorshipRequest_menteeId_status_idx"
  ON "MentorshipRequest"("menteeId", "status");
CREATE INDEX IF NOT EXISTS "MentorshipRequest_assignedToId_status_idx"
  ON "MentorshipRequest"("assignedToId", "status");
CREATE INDEX IF NOT EXISTS "MentorshipRequest_visibility_status_idx"
  ON "MentorshipRequest"("visibility", "status");
CREATE INDEX IF NOT EXISTS "MentorshipRequest_kind_status_idx"
  ON "MentorshipRequest"("kind", "status");
CREATE INDEX IF NOT EXISTS "MentorshipRequest_trackId_idx"
  ON "MentorshipRequest"("trackId");

CREATE INDEX IF NOT EXISTS "MentorshipRequestResponse_requestId_createdAt_idx"
  ON "MentorshipRequestResponse"("requestId", "createdAt");
CREATE INDEX IF NOT EXISTS "MentorshipRequestResponse_responderId_idx"
  ON "MentorshipRequestResponse"("responderId");

CREATE INDEX IF NOT EXISTS "MentorshipResource_mentorshipId_idx"
  ON "MentorshipResource"("mentorshipId");
CREATE INDEX IF NOT EXISTS "MentorshipResource_menteeId_idx"
  ON "MentorshipResource"("menteeId");
CREATE INDEX IF NOT EXISTS "MentorshipResource_requestId_idx"
  ON "MentorshipResource"("requestId");
CREATE INDEX IF NOT EXISTS "MentorshipResource_responseId_idx"
  ON "MentorshipResource"("responseId");
CREATE INDEX IF NOT EXISTS "MentorshipResource_trackId_idx"
  ON "MentorshipResource"("trackId");
CREATE INDEX IF NOT EXISTS "MentorshipResource_type_isPublished_idx"
  ON "MentorshipResource"("type", "isPublished");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipCircleMember_mentorshipId_fkey') THEN
    ALTER TABLE "MentorshipCircleMember"
      ADD CONSTRAINT "MentorshipCircleMember_mentorshipId_fkey"
      FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipCircleMember_menteeId_fkey') THEN
    ALTER TABLE "MentorshipCircleMember"
      ADD CONSTRAINT "MentorshipCircleMember_menteeId_fkey"
      FOREIGN KEY ("menteeId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipCircleMember_userId_fkey') THEN
    ALTER TABLE "MentorshipCircleMember"
      ADD CONSTRAINT "MentorshipCircleMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipSession_mentorshipId_fkey') THEN
    ALTER TABLE "MentorshipSession"
      ADD CONSTRAINT "MentorshipSession_mentorshipId_fkey"
      FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipSession_menteeId_fkey') THEN
    ALTER TABLE "MentorshipSession"
      ADD CONSTRAINT "MentorshipSession_menteeId_fkey"
      FOREIGN KEY ("menteeId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipSession_createdById_fkey') THEN
    ALTER TABLE "MentorshipSession"
      ADD CONSTRAINT "MentorshipSession_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipSession_ledById_fkey') THEN
    ALTER TABLE "MentorshipSession"
      ADD CONSTRAINT "MentorshipSession_ledById_fkey"
      FOREIGN KEY ("ledById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipActionItem_mentorshipId_fkey') THEN
    ALTER TABLE "MentorshipActionItem"
      ADD CONSTRAINT "MentorshipActionItem_mentorshipId_fkey"
      FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipActionItem_menteeId_fkey') THEN
    ALTER TABLE "MentorshipActionItem"
      ADD CONSTRAINT "MentorshipActionItem_menteeId_fkey"
      FOREIGN KEY ("menteeId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipActionItem_sessionId_fkey') THEN
    ALTER TABLE "MentorshipActionItem"
      ADD CONSTRAINT "MentorshipActionItem_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "MentorshipSession"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipActionItem_ownerId_fkey') THEN
    ALTER TABLE "MentorshipActionItem"
      ADD CONSTRAINT "MentorshipActionItem_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipActionItem_createdById_fkey') THEN
    ALTER TABLE "MentorshipActionItem"
      ADD CONSTRAINT "MentorshipActionItem_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipRequest_mentorshipId_fkey') THEN
    ALTER TABLE "MentorshipRequest"
      ADD CONSTRAINT "MentorshipRequest_mentorshipId_fkey"
      FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipRequest_menteeId_fkey') THEN
    ALTER TABLE "MentorshipRequest"
      ADD CONSTRAINT "MentorshipRequest_menteeId_fkey"
      FOREIGN KEY ("menteeId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipRequest_requesterId_fkey') THEN
    ALTER TABLE "MentorshipRequest"
      ADD CONSTRAINT "MentorshipRequest_requesterId_fkey"
      FOREIGN KEY ("requesterId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipRequest_assignedToId_fkey') THEN
    ALTER TABLE "MentorshipRequest"
      ADD CONSTRAINT "MentorshipRequest_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipRequest_trackId_fkey') THEN
    ALTER TABLE "MentorshipRequest"
      ADD CONSTRAINT "MentorshipRequest_trackId_fkey"
      FOREIGN KEY ("trackId") REFERENCES "MentorshipTrack"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipRequestResponse_requestId_fkey') THEN
    ALTER TABLE "MentorshipRequestResponse"
      ADD CONSTRAINT "MentorshipRequestResponse_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "MentorshipRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipRequestResponse_responderId_fkey') THEN
    ALTER TABLE "MentorshipRequestResponse"
      ADD CONSTRAINT "MentorshipRequestResponse_responderId_fkey"
      FOREIGN KEY ("responderId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipResource_mentorshipId_fkey') THEN
    ALTER TABLE "MentorshipResource"
      ADD CONSTRAINT "MentorshipResource_mentorshipId_fkey"
      FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipResource_menteeId_fkey') THEN
    ALTER TABLE "MentorshipResource"
      ADD CONSTRAINT "MentorshipResource_menteeId_fkey"
      FOREIGN KEY ("menteeId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipResource_requestId_fkey') THEN
    ALTER TABLE "MentorshipResource"
      ADD CONSTRAINT "MentorshipResource_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "MentorshipRequest"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipResource_responseId_fkey') THEN
    ALTER TABLE "MentorshipResource"
      ADD CONSTRAINT "MentorshipResource_responseId_fkey"
      FOREIGN KEY ("responseId") REFERENCES "MentorshipRequestResponse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipResource_trackId_fkey') THEN
    ALTER TABLE "MentorshipResource"
      ADD CONSTRAINT "MentorshipResource_trackId_fkey"
      FOREIGN KEY ("trackId") REFERENCES "MentorshipTrack"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipResource_createdById_fkey') THEN
    ALTER TABLE "MentorshipResource"
      ADD CONSTRAINT "MentorshipResource_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "MentorshipCircleMember" (
  "id",
  "mentorshipId",
  "menteeId",
  "userId",
  "role",
  "source",
  "isPrimary",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'support-primary-' || m."id",
  m."id",
  m."menteeId",
  m."mentorId",
  'PRIMARY_MENTOR'::"SupportRole",
  'MENTORSHIP_BACKFILL',
  true,
  CASE WHEN m."status" = 'ACTIVE' THEN true ELSE false END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Mentorship" m
ON CONFLICT ("menteeId", "userId", "role") DO NOTHING;

INSERT INTO "MentorshipCircleMember" (
  "id",
  "mentorshipId",
  "menteeId",
  "userId",
  "role",
  "source",
  "isPrimary",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'support-chair-' || m."id",
  m."id",
  m."menteeId",
  m."chairId",
  'CHAIR'::"SupportRole",
  'MENTORSHIP_BACKFILL',
  false,
  CASE WHEN m."status" = 'ACTIVE' THEN true ELSE false END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Mentorship" m
WHERE m."chairId" IS NOT NULL
ON CONFLICT ("menteeId", "userId", "role") DO NOTHING;

INSERT INTO "MentorshipCircleMember" (
  "id",
  "mentorshipId",
  "menteeId",
  "userId",
  "role",
  "source",
  "notes",
  "isPrimary",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'support-college-' || ca."id",
  active_m."id",
  ca."adviseeId",
  advisor."userId",
  'COLLEGE_ADVISOR'::"SupportRole",
  'COLLEGE_ADVISOR_BACKFILL',
  ca."notes",
  false,
  CASE WHEN ca."endDate" IS NULL THEN true ELSE false END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CollegeAdvisorship" ca
JOIN "CollegeAdvisor" advisor ON advisor."id" = ca."advisorId"
LEFT JOIN "Mentorship" active_m
  ON active_m."menteeId" = ca."adviseeId"
 AND active_m."status" = 'ACTIVE'
ON CONFLICT ("menteeId", "userId", "role") DO NOTHING;
