-- Migration: add_action_related_entity
-- People Strategy Operating System (Phase 1) — polymorphic related-entity link
-- on Action Items. `relatedEntityType` / `relatedEntityId` let an action point
-- at the domain object it is about (CLASS_OFFERING / MENTORSHIP / USER /
-- INSTRUCTOR_APPLICATION). String-typed (no FK, no enum) to mirror the
-- loosely-typed goalCategory field and keep cross-domain linking flexible;
-- validated in application code (TS union + Zod + write-time existence check).
-- Department and officer-meeting links continue to use the existing
-- departmentId / officerMeetingId FK columns, NOT this polymorphic field.
-- Written idempotently (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS)
-- to match the repo's hand-written migration convention.

-- AlterTable
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "relatedEntityType" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "relatedEntityId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionItem_relatedEntityType_relatedEntityId_idx"
  ON "ActionItem"("relatedEntityType", "relatedEntityId");
