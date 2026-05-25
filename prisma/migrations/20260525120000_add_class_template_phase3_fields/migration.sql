-- Migration: add_class_template_phase3_fields
-- Adds three YPP Curriculum Template "Phase 3" columns to ClassTemplate that
-- were declared in the Prisma schema but never had a corresponding migration:
--   * targetAgeGroup    – optional string, e.g. "12-14", "16-18"
--   * classDurationMin  – optional int, length of each class session in minutes
--   * engagementStrategy – optional JSONB, e.g. { energyStyle, differentiationPlan, ... }

ALTER TABLE "ClassTemplate"
  ADD COLUMN IF NOT EXISTS "targetAgeGroup" TEXT;

ALTER TABLE "ClassTemplate"
  ADD COLUMN IF NOT EXISTS "classDurationMin" INTEGER;

ALTER TABLE "ClassTemplate"
  ADD COLUMN IF NOT EXISTS "engagementStrategy" JSONB;
