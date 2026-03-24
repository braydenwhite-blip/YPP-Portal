ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'CHAPTER_PRESIDENT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ClassOfferingApprovalStatus'
      AND e.enumlabel = 'NOT_REQUESTED'
  ) THEN
    CREATE TYPE "ClassOfferingApprovalStatus" AS ENUM (
      'NOT_REQUESTED',
      'REQUESTED',
      'UNDER_REVIEW',
      'APPROVED',
      'CHANGES_REQUESTED',
      'REJECTED'
    );
  END IF;
END
$$;

ALTER TABLE "ClassTemplate"
  ADD COLUMN IF NOT EXISTS "learnerFitLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "learnerFitDescription" TEXT;

ALTER TABLE "ClassTemplate"
  ALTER COLUMN "learnerFitLabel" DROP NOT NULL,
  ALTER COLUMN "learnerFitDescription" DROP NOT NULL;

UPDATE "ClassTemplate"
SET
  "learnerFitLabel" = COALESCE("learnerFitLabel", CASE "difficultyLevel"
    WHEN 'LEVEL_101' THEN 'Best for first-time learners'
    WHEN 'LEVEL_201' THEN 'Great if you''ve tried the basics'
    WHEN 'LEVEL_301' THEN 'Best if you can work more independently'
    WHEN 'LEVEL_401' THEN 'Best if you''re ready for advanced project work'
    ELSE 'Best for first-time learners'
  END),
  "learnerFitDescription" = COALESCE("learnerFitDescription", CASE "difficultyLevel"
    WHEN 'LEVEL_101' THEN 'No prior experience needed.'
    WHEN 'LEVEL_201' THEN 'Some early experience helps, but support is still built in.'
    WHEN 'LEVEL_301' THEN 'Learners should be ready for faster pacing and lighter scaffolding.'
    WHEN 'LEVEL_401' THEN 'Learners should be comfortable owning complex work with creative freedom.'
    ELSE 'No prior experience needed.'
  END);

CREATE TABLE IF NOT EXISTS "ClassOfferingApproval" (
  "id" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "status" "ClassOfferingApprovalStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "requestedById" TEXT,
  "requestNotes" TEXT,
  "requestedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassOfferingApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassOfferingApproval_offeringId_key" UNIQUE ("offeringId"),
  CONSTRAINT "ClassOfferingApproval_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClassOfferingApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ClassOfferingApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClassOfferingApproval_status_idx"
  ON "ClassOfferingApproval"("status");

CREATE INDEX IF NOT EXISTS "ClassOfferingApproval_requestedById_idx"
  ON "ClassOfferingApproval"("requestedById");

CREATE INDEX IF NOT EXISTS "ClassOfferingApproval_reviewedById_idx"
  ON "ClassOfferingApproval"("reviewedById");

INSERT INTO "ClassOfferingApproval" (
  "id",
  "offeringId",
  "status",
  "requestNotes",
  "requestedAt",
  "reviewNotes",
  "reviewedAt"
)
SELECT
  gen_random_uuid()::text,
  o."id",
  CASE
    WHEN o."status" IN ('PUBLISHED', 'IN_PROGRESS', 'COMPLETED') OR o."grandfatheredTrainingExemption" = true THEN 'APPROVED'::"ClassOfferingApprovalStatus"
    ELSE 'REQUESTED'::"ClassOfferingApprovalStatus"
  END,
  CASE
    WHEN o."status" IN ('PUBLISHED', 'IN_PROGRESS', 'COMPLETED') OR o."grandfatheredTrainingExemption" = true
      THEN 'Auto-created from legacy publish state during offering approval migration.'
    ELSE 'Auto-created from legacy draft offering during offering approval migration. Review before the next publish.'
  END,
  o."createdAt",
  CASE
    WHEN o."status" IN ('PUBLISHED', 'IN_PROGRESS', 'COMPLETED') OR o."grandfatheredTrainingExemption" = true
      THEN 'Auto-approved during offering approval migration.'
    ELSE NULL
  END,
  CASE
    WHEN o."status" IN ('PUBLISHED', 'IN_PROGRESS', 'COMPLETED') OR o."grandfatheredTrainingExemption" = true
      THEN o."updatedAt"
    ELSE NULL
  END
FROM "ClassOffering" o
LEFT JOIN "ClassOfferingApproval" approval ON approval."offeringId" = o."id"
WHERE approval."id" IS NULL;

UPDATE "User"
SET "primaryRole" = 'CHAPTER_PRESIDENT'
WHERE "primaryRole" = 'CHAPTER_LEAD';

UPDATE "UserRole"
SET "role" = 'CHAPTER_PRESIDENT'
WHERE "role" = 'CHAPTER_LEAD';

UPDATE "OpsRule"
SET "escalateToRoles" = array_replace("escalateToRoles", 'CHAPTER_LEAD', 'CHAPTER_PRESIDENT')
WHERE "escalateToRoles" @> ARRAY['CHAPTER_LEAD'];
