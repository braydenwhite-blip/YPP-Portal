-- Many-to-many teams on an action item (primary team stays on ActionItem.departmentId).

CREATE TABLE "ActionItemDepartment" (
    "actionItemId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionItemDepartment_pkey" PRIMARY KEY ("actionItemId","departmentId")
);

CREATE INDEX "ActionItemDepartment_departmentId_idx" ON "ActionItemDepartment"("departmentId");

ALTER TABLE "ActionItemDepartment" ADD CONSTRAINT "ActionItemDepartment_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionItemDepartment" ADD CONSTRAINT "ActionItemDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from the existing single departmentId column.
INSERT INTO "ActionItemDepartment" ("actionItemId", "departmentId")
SELECT "id", "departmentId"
FROM "ActionItem"
WHERE "departmentId" IS NOT NULL
ON CONFLICT DO NOTHING;
