-- Migration: align_review_categories_to_goals
-- Aligns the InstructorReviewCategoryKey enum with the 5 official YPP goals.
-- Removes PROFESSIONALISM_AND_FOLLOW_THROUGH and SUBJECT_MATTER_FIT, remapping
-- any existing rows that used them to the closest remaining goal category:
--   PROFESSIONALISM_AND_FOLLOW_THROUGH -> ORGANIZATION_AND_COMMITMENT (GOAL 3)
--   SUBJECT_MATTER_FIT                 -> CURRICULUM_STRENGTH         (GOAL 1)
--
-- A review may already have rows for both the source AND the target category
-- (e.g. a reviewer rated both PROFESSIONALISM_AND_FOLLOW_THROUGH and
-- ORGANIZATION_AND_COMMITMENT on the same review). The (reviewId, category)
-- unique constraint would block a plain UPDATE in that case, so we first
-- drop the legacy source row whenever the target already exists for the same
-- review, then UPDATE the remaining legacy rows.
--
-- Final enum matches the 5 goals exactly:
--   CURRICULUM_STRENGTH          -> GOAL 1 Curriculum & Class Delivery
--   RELATIONSHIP_BUILDING        -> GOAL 2 Student & Family Relationships
--   ORGANIZATION_AND_COMMITMENT  -> GOAL 3 Organization, Commitment & Reliability
--   COMMUNITY_FIT                -> GOAL 4 YPP Community Involvement
--   LONG_TERM_POTENTIAL          -> GOAL 5 Long-Term Growth & Increased Involvement

DO $$
BEGIN
  -- Only run the remap + enum swap if the legacy values still exist on the type.
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'InstructorReviewCategoryKey'
      AND e.enumlabel IN ('PROFESSIONALISM_AND_FOLLOW_THROUGH', 'SUBJECT_MATTER_FIT')
  ) THEN
    -- Create the new, slimmed-down enum.
    IF NOT EXISTS (
      SELECT 1 FROM pg_type WHERE typname = 'InstructorReviewCategoryKey_new'
    ) THEN
      CREATE TYPE "InstructorReviewCategoryKey_new" AS ENUM (
        'CURRICULUM_STRENGTH',
        'RELATIONSHIP_BUILDING',
        'ORGANIZATION_AND_COMMITMENT',
        'COMMUNITY_FIT',
        'LONG_TERM_POTENTIAL'
      );
    END IF;

    -- Remap any rows on tables that reference the enum to the closest surviving goal.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'InstructorApplicationReviewCategory' AND column_name = 'category'
    ) THEN
      -- Drop legacy source rows that would collide with an existing target row
      -- on the same review (otherwise the UPDATE below violates the
      -- (reviewId, category) unique constraint).
      DELETE FROM "InstructorApplicationReviewCategory" src
      WHERE src."category"::text = 'PROFESSIONALISM_AND_FOLLOW_THROUGH'
        AND EXISTS (
          SELECT 1 FROM "InstructorApplicationReviewCategory" tgt
          WHERE tgt."reviewId" = src."reviewId"
            AND tgt."category"::text = 'ORGANIZATION_AND_COMMITMENT'
        );

      DELETE FROM "InstructorApplicationReviewCategory" src
      WHERE src."category"::text = 'SUBJECT_MATTER_FIT'
        AND EXISTS (
          SELECT 1 FROM "InstructorApplicationReviewCategory" tgt
          WHERE tgt."reviewId" = src."reviewId"
            AND tgt."category"::text = 'CURRICULUM_STRENGTH'
        );

      UPDATE "InstructorApplicationReviewCategory"
      SET "category" = 'ORGANIZATION_AND_COMMITMENT'
      WHERE "category"::text = 'PROFESSIONALISM_AND_FOLLOW_THROUGH';

      UPDATE "InstructorApplicationReviewCategory"
      SET "category" = 'CURRICULUM_STRENGTH'
      WHERE "category"::text = 'SUBJECT_MATTER_FIT';

      ALTER TABLE "InstructorApplicationReviewCategory"
        ALTER COLUMN "category" TYPE "InstructorReviewCategoryKey_new"
        USING ("category"::text::"InstructorReviewCategoryKey_new");
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'InstructorInterviewReviewCategory' AND column_name = 'category'
    ) THEN
      -- Same dedup-before-remap dance for the interview review category table.
      DELETE FROM "InstructorInterviewReviewCategory" src
      WHERE src."category"::text = 'PROFESSIONALISM_AND_FOLLOW_THROUGH'
        AND EXISTS (
          SELECT 1 FROM "InstructorInterviewReviewCategory" tgt
          WHERE tgt."reviewId" = src."reviewId"
            AND tgt."category"::text = 'ORGANIZATION_AND_COMMITMENT'
        );

      DELETE FROM "InstructorInterviewReviewCategory" src
      WHERE src."category"::text = 'SUBJECT_MATTER_FIT'
        AND EXISTS (
          SELECT 1 FROM "InstructorInterviewReviewCategory" tgt
          WHERE tgt."reviewId" = src."reviewId"
            AND tgt."category"::text = 'CURRICULUM_STRENGTH'
        );

      UPDATE "InstructorInterviewReviewCategory"
      SET "category" = 'ORGANIZATION_AND_COMMITMENT'
      WHERE "category"::text = 'PROFESSIONALISM_AND_FOLLOW_THROUGH';

      UPDATE "InstructorInterviewReviewCategory"
      SET "category" = 'CURRICULUM_STRENGTH'
      WHERE "category"::text = 'SUBJECT_MATTER_FIT';

      ALTER TABLE "InstructorInterviewReviewCategory"
        ALTER COLUMN "category" TYPE "InstructorReviewCategoryKey_new"
        USING ("category"::text::"InstructorReviewCategoryKey_new");
    END IF;

    -- Swap the types: drop the old, rename the new to take its place.
    DROP TYPE "InstructorReviewCategoryKey";
    ALTER TYPE "InstructorReviewCategoryKey_new" RENAME TO "InstructorReviewCategoryKey";
  END IF;
END $$;
