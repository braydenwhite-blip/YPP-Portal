ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE "UserProfile"
ADD COLUMN IF NOT EXISTS "dateOfBirth" TEXT;

ALTER TABLE "UserProfile"
ADD COLUMN IF NOT EXISTS "city" TEXT;

ALTER TABLE "UserProfile"
ADD COLUMN IF NOT EXISTS "stateProvince" TEXT;

ALTER TABLE "UserProfile"
ADD COLUMN IF NOT EXISTS "usesParentPhone" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ParentStudent"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ParentStudent_parentId_archivedAt_approvalStatus_idx"
ON "ParentStudent"("parentId", "archivedAt", "approvalStatus");
