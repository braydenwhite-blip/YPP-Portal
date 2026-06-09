-- Migration: add_action_system_4_contract
-- Action System 4.0 — honest source provenance + strategic linkage + quality
-- fields on ActionItem. Every change is additive, nullable, and idempotent
-- (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / DO $$ guards) so
-- existing actions, queries, and create/update flows keep working unchanged.
-- No data backfill: legacy rows normalize to a derived source in application
-- code (lib/people-strategy/action-source.ts).

-- AlterTable: ActionItem — source provenance (how the action came to exist)
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "sourceActionId" TEXT;

-- AlterTable: ActionItem — explicit, registry-validated strategic linkage
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "strategicInitiativeId" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "strategicProjectId" TEXT;

-- AlterTable: ActionItem — action-quality fields
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "successDefinition" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "blockedReason" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "completionNote" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "completionOutcome" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3);

-- AddForeignKey: ActionItem.sourceActionId -> ActionItem.id (self-relation,
-- follow-up → parent). SetNull keeps the follow-up if its parent is deleted.
DO $$ BEGIN
  ALTER TABLE "ActionItem"
    ADD CONSTRAINT "ActionItem_sourceActionId_fkey"
    FOREIGN KEY ("sourceActionId") REFERENCES "ActionItem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateIndex: read paths for source + strategic + follow-up + follow-up date
CREATE INDEX IF NOT EXISTS "ActionItem_sourceType_idx" ON "ActionItem"("sourceType");
CREATE INDEX IF NOT EXISTS "ActionItem_sourceActionId_idx" ON "ActionItem"("sourceActionId");
CREATE INDEX IF NOT EXISTS "ActionItem_strategicInitiativeId_idx" ON "ActionItem"("strategicInitiativeId");
CREATE INDEX IF NOT EXISTS "ActionItem_strategicProjectId_idx" ON "ActionItem"("strategicProjectId");
CREATE INDEX IF NOT EXISTS "ActionItem_nextFollowUpAt_idx" ON "ActionItem"("nextFollowUpAt");
