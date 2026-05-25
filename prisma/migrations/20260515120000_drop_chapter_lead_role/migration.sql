-- Migration: drop_chapter_lead_role
-- Converges CHAPTER_LEAD into CHAPTER_PRESIDENT in both RoleType and
-- JourneyAudienceRole. The two values were never separate authorization
-- buckets in the app code (every gate uses CHAPTER_PRESIDENT) and the
-- earlier offering_approval_and_learner_fit migration already started
-- moving escalateToRoles entries. This drops the dead value for good.
--
-- All scalar columns are remapped CHAPTER_LEAD -> CHAPTER_PRESIDENT.
-- Array columns (Announcement.targetRoles, ChapterUpdate.targetRoles,
-- RolloutCampaign.targetRoles) are remapped + de-duplicated. Two tables
-- have unique constraints that could collide on the remap, so we delete
-- the legacy duplicate row first:
--   * UserRole (composite PK userId, role)
--   * JourneyAssignmentRule (@@unique journeyId, audience)
--
-- Then we swap each enum to a new copy without CHAPTER_LEAD.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'RoleType' AND e.enumlabel = 'CHAPTER_LEAD'
  ) THEN
    -- Scalar columns
    UPDATE "User"
      SET "primaryRole" = 'CHAPTER_PRESIDENT'
      WHERE "primaryRole" = 'CHAPTER_LEAD';

    DELETE FROM "UserRole" ur1
    WHERE ur1.role = 'CHAPTER_LEAD'
      AND EXISTS (
        SELECT 1 FROM "UserRole" ur2
        WHERE ur2."userId" = ur1."userId"
          AND ur2.role = 'CHAPTER_PRESIDENT'
      );
    UPDATE "UserRole"
      SET role = 'CHAPTER_PRESIDENT'
      WHERE role = 'CHAPTER_LEAD';

    UPDATE "WorkflowItem"
      SET "allowedAssigneeRole" = 'CHAPTER_PRESIDENT'
      WHERE "allowedAssigneeRole" = 'CHAPTER_LEAD';

    UPDATE "WorkflowAssignmentRule"
      SET "assigneeRole" = 'CHAPTER_PRESIDENT'
      WHERE "assigneeRole" = 'CHAPTER_LEAD';

    UPDATE "GoalTemplate"
      SET "roleType" = 'CHAPTER_PRESIDENT'
      WHERE "roleType" = 'CHAPTER_LEAD';

    UPDATE "ReflectionForm"
      SET "roleType" = 'CHAPTER_PRESIDENT'
      WHERE "roleType" = 'CHAPTER_LEAD';

    UPDATE "FeatureGateRule"
      SET role = 'CHAPTER_PRESIDENT'
      WHERE role = 'CHAPTER_LEAD';

    -- Array columns: replace + dedup
    UPDATE "Announcement"
    SET "targetRoles" = ARRAY(
      SELECT DISTINCT v FROM unnest(
        array_replace("targetRoles", 'CHAPTER_LEAD'::"RoleType", 'CHAPTER_PRESIDENT'::"RoleType")
      ) AS v
    )
    WHERE 'CHAPTER_LEAD' = ANY("targetRoles");

    UPDATE "ChapterUpdate"
    SET "targetRoles" = ARRAY(
      SELECT DISTINCT v FROM unnest(
        array_replace("targetRoles", 'CHAPTER_LEAD'::"RoleType", 'CHAPTER_PRESIDENT'::"RoleType")
      ) AS v
    )
    WHERE 'CHAPTER_LEAD' = ANY("targetRoles");

    UPDATE "RolloutCampaign"
    SET "targetRoles" = ARRAY(
      SELECT DISTINCT v FROM unnest(
        array_replace("targetRoles", 'CHAPTER_LEAD'::"RoleType", 'CHAPTER_PRESIDENT'::"RoleType")
      ) AS v
    )
    WHERE 'CHAPTER_LEAD' = ANY("targetRoles");

    -- Swap the enum to drop CHAPTER_LEAD
    CREATE TYPE "RoleType_new" AS ENUM (
      'ADMIN',
      'INSTRUCTOR',
      'STUDENT',
      'MENTOR',
      'CHAPTER_PRESIDENT',
      'STAFF',
      'PARENT',
      'APPLICANT',
      'HIRING_CHAIR'
    );

    ALTER TABLE "User"
      ALTER COLUMN "primaryRole" TYPE "RoleType_new"
      USING ("primaryRole"::text::"RoleType_new");

    ALTER TABLE "UserRole"
      ALTER COLUMN role TYPE "RoleType_new"
      USING (role::text::"RoleType_new");

    ALTER TABLE "WorkflowItem"
      ALTER COLUMN "allowedAssigneeRole" TYPE "RoleType_new"
      USING ("allowedAssigneeRole"::text::"RoleType_new");

    ALTER TABLE "WorkflowAssignmentRule"
      ALTER COLUMN "assigneeRole" TYPE "RoleType_new"
      USING ("assigneeRole"::text::"RoleType_new");

    ALTER TABLE "Announcement"
      ALTER COLUMN "targetRoles" TYPE "RoleType_new"[]
      USING ("targetRoles"::text[]::"RoleType_new"[]);

    ALTER TABLE "GoalTemplate"
      ALTER COLUMN "roleType" TYPE "RoleType_new"
      USING ("roleType"::text::"RoleType_new");

    ALTER TABLE "ReflectionForm"
      ALTER COLUMN "roleType" TYPE "RoleType_new"
      USING ("roleType"::text::"RoleType_new");

    ALTER TABLE "ChapterUpdate"
      ALTER COLUMN "targetRoles" TYPE "RoleType_new"[]
      USING ("targetRoles"::text[]::"RoleType_new"[]);

    ALTER TABLE "RolloutCampaign"
      ALTER COLUMN "targetRoles" TYPE "RoleType_new"[]
      USING ("targetRoles"::text[]::"RoleType_new"[]);

    ALTER TABLE "FeatureGateRule"
      ALTER COLUMN role TYPE "RoleType_new"
      USING (role::text::"RoleType_new");

    DROP TYPE "RoleType";
    ALTER TYPE "RoleType_new" RENAME TO "RoleType";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'JourneyAudienceRole' AND e.enumlabel = 'CHAPTER_LEAD'
  ) THEN
    DELETE FROM "JourneyAssignmentRule" jar1
    WHERE jar1.audience = 'CHAPTER_LEAD'
      AND EXISTS (
        SELECT 1 FROM "JourneyAssignmentRule" jar2
        WHERE jar2."journeyId" = jar1."journeyId"
          AND jar2.audience = 'CHAPTER_PRESIDENT'
      );
    UPDATE "JourneyAssignmentRule"
      SET audience = 'CHAPTER_PRESIDENT'
      WHERE audience = 'CHAPTER_LEAD';

    CREATE TYPE "JourneyAudienceRole_new" AS ENUM (
      'STUDENT',
      'INSTRUCTOR',
      'CHAPTER_PRESIDENT',
      'LEADERSHIP',
      'SUMMER_WORKSHOP_INSTRUCTOR',
      'MENTOR'
    );

    ALTER TABLE "JourneyAssignmentRule"
      ALTER COLUMN audience TYPE "JourneyAudienceRole_new"
      USING (audience::text::"JourneyAudienceRole_new");

    DROP TYPE "JourneyAudienceRole";
    ALTER TYPE "JourneyAudienceRole_new" RENAME TO "JourneyAudienceRole";
  END IF;
END $$;
