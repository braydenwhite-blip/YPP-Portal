-- Officer approval after an action is marked complete.
ALTER TABLE "ActionItem" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "ActionItem" ADD COLUMN "approvedById" TEXT;

CREATE INDEX "ActionItem_approvedById_idx" ON "ActionItem"("approvedById");
CREATE INDEX "ActionItem_approvedAt_idx" ON "ActionItem"("approvedAt");

ALTER TABLE "ActionItem"
ADD CONSTRAINT "ActionItem_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Already-complete rows are treated as approved so the hub does not backlog.
UPDATE "ActionItem"
SET "approvedAt" = COALESCE("completedAt", "updatedAt")
WHERE "status" = 'COMPLETE' AND "approvedAt" IS NULL;
