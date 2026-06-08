-- Migration: add_partner_pipeline
-- Camp & Partner Pipeline (Phase 4 of the YPP Operating System pass).
-- Turns the bare Partner directory into a relationship pipeline: stage, priority,
-- structured type, contact + program-needs fields, follow-up dates, and an
-- append-only PartnerNote timeline.
--
-- `stage`, `priority`, `partnerType` and the note `kind` are TEXT vocabularies
-- validated in application code (lib/partners-constants.ts), mirroring the repo's
-- `actionType` / `relatedEntityType` / `goalCategory` convention — no Postgres
-- enums, so the vocabulary stays editable without a migration.
--
-- Every column is nullable/defaulted so existing rows are unaffected, and the
-- feature stays dark behind ENABLE_PARTNER_PIPELINE until it is turned on.
-- Written idempotently (ADD COLUMN / CREATE TABLE / CREATE INDEX IF NOT EXISTS,
-- guarded foreign key) to match the repo's hand-written migration convention.

-- AlterTable: Partner pipeline fields
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "stage" TEXT DEFAULT 'NOT_STARTED';
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'MEDIUM';
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "partnerType" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "contactTitle" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "lastContactedAt" TIMESTAMP(3);
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3);
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "meetingDate" TIMESTAMP(3);
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "requestedSubjects" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "requestedAgeGroups" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "requestedDates" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "programFormat" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "expectedStudents" INTEGER;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "instructorCountNeeded" INTEGER;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "constraints" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "outcome" TEXT;

-- CreateIndex: Partner pipeline lookups
CREATE INDEX IF NOT EXISTS "Partner_stage_idx" ON "Partner"("stage");
CREATE INDEX IF NOT EXISTS "Partner_nextFollowUpAt_idx" ON "Partner"("nextFollowUpAt");

-- CreateTable: PartnerNote (append-only relationship timeline)
CREATE TABLE IF NOT EXISTS "PartnerNote" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartnerNote_partnerId_createdAt_idx" ON "PartnerNote"("partnerId", "createdAt");

-- AddForeignKey (guarded — Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PartnerNote_partnerId_fkey'
  ) THEN
    ALTER TABLE "PartnerNote"
      ADD CONSTRAINT "PartnerNote_partnerId_fkey"
      FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
