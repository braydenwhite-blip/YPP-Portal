CREATE TYPE "IncubatorMilestoneStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED');
CREATE TYPE "IncubatorLaunchStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

ALTER TABLE "IncubatorCohort"
ADD COLUMN "passionAreaIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "IncubatorApplication"
ADD COLUMN "passionId" TEXT,
ADD COLUMN "reviewRubric" JSONB;

ALTER TABLE "IncubatorProject"
ADD COLUMN "applicationId" TEXT,
ADD COLUMN "passionId" TEXT,
ADD COLUMN "mentorRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mentorAssignedAt" TIMESTAMP(3),
ADD COLUMN "launchStatus" "IncubatorLaunchStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "publicSlug" TEXT,
ADD COLUMN "launchTitle" TEXT,
ADD COLUMN "launchTagline" TEXT,
ADD COLUMN "launchSummary" TEXT,
ADD COLUMN "problemStatement" TEXT,
ADD COLUMN "solutionSummary" TEXT,
ADD COLUMN "targetAudience" TEXT,
ADD COLUMN "buildHighlights" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "launchGalleryUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "demoUrl" TEXT,
ADD COLUMN "repositoryUrl" TEXT,
ADD COLUMN "waitlistUrl" TEXT,
ADD COLUMN "launchSubmittedAt" TIMESTAMP(3),
ADD COLUMN "launchApprovedAt" TIMESTAMP(3),
ADD COLUMN "launchApprovedById" TEXT;

CREATE TABLE "IncubatorMilestoneTemplate" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "phase" "IncubatorPhase" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deliverableLabel" TEXT,
    "dueDayOffset" INTEGER,
    "order" INTEGER NOT NULL,
    "requiresMentorApproval" BOOLEAN NOT NULL DEFAULT false,
    "requiredForPhase" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncubatorMilestoneTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncubatorMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT,
    "phase" "IncubatorPhase" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deliverableLabel" TEXT,
    "order" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "requiresMentorApproval" BOOLEAN NOT NULL DEFAULT false,
    "requiredForPhase" BOOLEAN NOT NULL DEFAULT true,
    "status" "IncubatorMilestoneStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "submissionNote" TEXT,
    "artifactUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncubatorMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncubatorProject_applicationId_key" ON "IncubatorProject"("applicationId");
CREATE UNIQUE INDEX "IncubatorProject_publicSlug_key" ON "IncubatorProject"("publicSlug");
CREATE INDEX "IncubatorApplication_passionId_idx" ON "IncubatorApplication"("passionId");
CREATE INDEX "IncubatorApplication_reviewedById_idx" ON "IncubatorApplication"("reviewedById");
CREATE INDEX "IncubatorProject_passionId_idx" ON "IncubatorProject"("passionId");
CREATE INDEX "IncubatorProject_launchStatus_idx" ON "IncubatorProject"("launchStatus");
CREATE INDEX "IncubatorProject_launchApprovedById_idx" ON "IncubatorProject"("launchApprovedById");
CREATE INDEX "IncubatorMilestoneTemplate_cohortId_phase_order_idx" ON "IncubatorMilestoneTemplate"("cohortId", "phase", "order");
CREATE INDEX "IncubatorMilestone_projectId_phase_order_idx" ON "IncubatorMilestone"("projectId", "phase", "order");
CREATE INDEX "IncubatorMilestone_status_idx" ON "IncubatorMilestone"("status");
CREATE INDEX "IncubatorMilestone_approvedById_idx" ON "IncubatorMilestone"("approvedById");

ALTER TABLE "IncubatorApplication"
ADD CONSTRAINT "IncubatorApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IncubatorProject"
ADD CONSTRAINT "IncubatorProject_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "IncubatorApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "IncubatorProject_launchApprovedById_fkey" FOREIGN KEY ("launchApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IncubatorMilestoneTemplate"
ADD CONSTRAINT "IncubatorMilestoneTemplate_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "IncubatorCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncubatorMilestone"
ADD CONSTRAINT "IncubatorMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IncubatorProject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "IncubatorMilestone_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "IncubatorMilestoneTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "IncubatorMilestone_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "IncubatorApplication" AS application
SET "passionId" = matched.id
FROM (
  SELECT
    app.id AS application_id,
    passion.id
  FROM "IncubatorApplication" app
  JOIN "PassionArea" passion
    ON passion.id = app."passionArea"
    OR lower(passion.name) = lower(app."passionArea")
) AS matched
WHERE application.id = matched.application_id
  AND application."passionId" IS NULL;

UPDATE "IncubatorProject" AS project
SET "passionId" = matched.id
FROM (
  SELECT
    incubator.id AS project_id,
    passion.id
  FROM "IncubatorProject" incubator
  JOIN "PassionArea" passion
    ON passion.id = incubator."passionArea"
    OR lower(passion.name) = lower(incubator."passionArea")
) AS matched
WHERE project.id = matched.project_id
  AND project."passionId" IS NULL;

UPDATE "IncubatorCohort" AS cohort
SET "passionAreaIds" = COALESCE(mapped.ids, ARRAY[]::TEXT[])
FROM (
  SELECT
    source.id,
    ARRAY_AGG(DISTINCT passion.id) AS ids
  FROM "IncubatorCohort" source
  LEFT JOIN LATERAL unnest(source."passionAreas") AS legacy(value) ON true
  LEFT JOIN "PassionArea" passion
    ON passion.id = legacy.value
    OR lower(passion.name) = lower(legacy.value)
  GROUP BY source.id
) AS mapped
WHERE cohort.id = mapped.id;

UPDATE "IncubatorProject" AS project
SET "applicationId" = application.id
FROM "IncubatorApplication" AS application
WHERE application."cohortId" = project."cohortId"
  AND application."studentId" = project."studentId"
  AND project."applicationId" IS NULL;

UPDATE "IncubatorProject" AS project
SET "mentorAssignedAt" = assignments.first_assigned_at
FROM (
  SELECT "projectId", MIN("assignedAt") AS first_assigned_at
  FROM "IncubatorMentor"
  WHERE "isActive" = true
  GROUP BY "projectId"
) AS assignments
WHERE project.id = assignments."projectId";
