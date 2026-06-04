-- Migration: add_action_templates_and_saved_views
-- People Strategy — Action Tracker, Phase 9.
-- 1. ActionTemplate: reusable templates for common YPP leadership tasks, seeded
--    with the standard playbook.
-- 2. SavedActionView: per-user saved filter sets on the Action Tracker.
-- Written idempotently to match the repo's migration convention.

-- CreateTable: ActionTemplate
CREATE TABLE IF NOT EXISTS "ActionTemplate" (
  "id"                  TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "description"         TEXT,
  "category"            TEXT,
  "titleTemplate"       TEXT NOT NULL,
  "descriptionTemplate" TEXT,
  "goalCategory"        TEXT,
  "defaultPriority"     "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
  "defaultVisibility"   "ActionItemVisibility" NOT NULL DEFAULT 'ALL_LEADERSHIP',
  "deadlineOffsetDays"  INTEGER,
  "checklist"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isStandard"          BOOLEAN NOT NULL DEFAULT false,
  "archivedAt"          TIMESTAMP(3),
  "createdById"         TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ActionTemplate_name_key" ON "ActionTemplate"("name");
CREATE INDEX IF NOT EXISTS "ActionTemplate_archivedAt_idx" ON "ActionTemplate"("archivedAt");
CREATE INDEX IF NOT EXISTS "ActionTemplate_category_idx" ON "ActionTemplate"("category");

DO $$ BEGIN
  ALTER TABLE "ActionTemplate"
    ADD CONSTRAINT "ActionTemplate_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable: SavedActionView
CREATE TABLE IF NOT EXISTS "SavedActionView" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "query"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedActionView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SavedActionView_userId_name_key" ON "SavedActionView"("userId", "name");
CREATE INDEX IF NOT EXISTS "SavedActionView_userId_idx" ON "SavedActionView"("userId");

DO $$ BEGIN
  ALTER TABLE "SavedActionView"
    ADD CONSTRAINT "SavedActionView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Seed the standard YPP leadership playbook. ON CONFLICT keeps this idempotent.
INSERT INTO "ActionTemplate"
  ("id", "name", "description", "category", "titleTemplate", "descriptionTemplate",
   "defaultPriority", "deadlineOffsetDays", "checklist", "isStandard", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Onboard new instructor', 'Get a new instructor fully set up to teach.', 'Instruction',
   'Onboard new instructor: [name]', 'Run the new instructor through onboarding end to end.',
   'HIGH', 14, ARRAY['Send welcome + portal access','Confirm training completion','Assign a mentor','Schedule first class shadow'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Follow up with applicant', 'Move an applicant to a decision.', 'Hiring',
   'Follow up with applicant: [name]', 'Review the application and reach a clear next step.',
   'HIGH', 5, ARRAY['Review application materials','Schedule / complete interview','Record decision','Notify applicant'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Schedule officer meeting', 'Stand up the next officer meeting.', 'Operations',
   'Schedule officer meeting', 'Pick a time, build the agenda, and confirm attendance.',
   'MEDIUM', 7, ARRAY['Poll availability','Draft agenda from open actions','Send invite'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Review chapter president', 'Quarterly check on a chapter president.', 'Chapters',
   'Review chapter president: [name]', 'Assess progress, blockers, and support needs.',
   'MEDIUM', 14, ARRAY['Review chapter metrics','1:1 conversation','Agree on next-quarter goals'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Confirm camp partnership', 'Lock in a camp / program partnership.', 'Partnerships',
   'Confirm camp partnership: [organization]', 'Finalize terms and logistics with the partner.',
   'HIGH', 21, ARRAY['Confirm dates + scope','Sign agreement','Assign staffing','Add to calendar'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Assign instructor to class', 'Staff an upcoming class.', 'Instruction',
   'Assign instructor to class: [class]', 'Match an instructor and confirm readiness.',
   'MEDIUM', 7, ARRAY['Identify candidate instructor','Confirm availability','Share curriculum'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Collect training completion', 'Chase outstanding training.', 'Instruction',
   'Collect training completion: [name]', 'Ensure required training is finished and recorded.',
   'MEDIUM', 10, ARRAY['Identify outstanding modules','Send reminder','Verify completion'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Check inactive volunteer', 'Re-engage a volunteer who has gone quiet.', 'People',
   'Check in with inactive volunteer: [name]', 'Reach out supportively and find a path forward.',
   'MEDIUM', 7, ARRAY['Review recent activity','Send supportive check-in','Offer a clear next step'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Prepare leadership meeting agenda', 'Build the next leadership agenda.', 'Operations',
   'Prepare leadership meeting agenda', 'Pull this week''s priorities into a clear agenda.',
   'MEDIUM', 5, ARRAY['Review Command Center pulse','List decisions needed','Circulate in advance'], true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
