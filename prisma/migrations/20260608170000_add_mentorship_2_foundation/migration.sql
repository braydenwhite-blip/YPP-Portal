-- Migration: add_mentorship_2_foundation
-- Mentorship 2.0 (Action Tracker 3.0, Phase M1).
--
-- Adds the mentor EXPERTISE TAXONOMY the audit found missing (ExpertiseArea +
-- MentorExpertise join), the two profile goal signals the matching engine needs
-- (UserProfile.careerGoal / leadershipGoal), and the mentee APPLICATION intake
-- stage (MentorshipApplication) — the lifecycle entry point that did not exist.
--
-- `status` / `proficiency` are TEXT vocabularies validated in application code
-- (lib/mentorship-2/constants.ts), mirroring the repo's actionType / partner.stage
-- convention — no Postgres enums, so the vocabulary stays editable without a
-- migration. `programGroup` reuses the existing "MentorshipProgramGroup" enum.
--
-- Every column is nullable/defaulted so existing rows are unaffected, and the
-- runtime stays dark behind ENABLE_MENTORSHIP_2 until it is turned on. Written
-- idempotently (ADD COLUMN / CREATE TABLE / CREATE INDEX IF NOT EXISTS, guarded
-- foreign keys) to match the repo's hand-written migration convention.

-- AlterTable: UserProfile goal signals (Part C matching inputs)
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "careerGoal" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "leadershipGoal" TEXT;

-- CreateTable: ExpertiseArea (reusable mentor specialization taxonomy)
CREATE TABLE IF NOT EXISTS "ExpertiseArea" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpertiseArea_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpertiseArea_slug_key" ON "ExpertiseArea"("slug");

-- CreateTable: MentorExpertise (mentor <-> ExpertiseArea join)
CREATE TABLE IF NOT EXISTS "MentorExpertise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expertiseAreaId" TEXT NOT NULL,
    "proficiency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MentorExpertise_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MentorExpertise_userId_expertiseAreaId_key" ON "MentorExpertise"("userId", "expertiseAreaId");
CREATE INDEX IF NOT EXISTS "MentorExpertise_expertiseAreaId_idx" ON "MentorExpertise"("expertiseAreaId");

-- CreateTable: MentorshipApplication (mentee-initiated intake)
CREATE TABLE IF NOT EXISTS "MentorshipApplication" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "programGroup" "MentorshipProgramGroup" NOT NULL DEFAULT 'STUDENT',
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "goals" TEXT,
    "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "preferredExpertise" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "availability" TEXT,
    "motivation" TEXT,
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "matchedMentorshipId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MentorshipApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MentorshipApplication_status_idx" ON "MentorshipApplication"("status");
CREATE INDEX IF NOT EXISTS "MentorshipApplication_applicantId_idx" ON "MentorshipApplication"("applicantId");

-- AddForeignKey (guarded — Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorExpertise_userId_fkey') THEN
    ALTER TABLE "MentorExpertise"
      ADD CONSTRAINT "MentorExpertise_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorExpertise_expertiseAreaId_fkey') THEN
    ALTER TABLE "MentorExpertise"
      ADD CONSTRAINT "MentorExpertise_expertiseAreaId_fkey"
      FOREIGN KEY ("expertiseAreaId") REFERENCES "ExpertiseArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipApplication_applicantId_fkey') THEN
    ALTER TABLE "MentorshipApplication"
      ADD CONSTRAINT "MentorshipApplication_applicantId_fkey"
      FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipApplication_reviewerId_fkey') THEN
    ALTER TABLE "MentorshipApplication"
      ADD CONSTRAINT "MentorshipApplication_reviewerId_fkey"
      FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- Seed a standing expertise taxonomy (idempotent; safe to re-run). Stable ids so
-- re-applying is a no-op. Mirrors the repo's "seed a playbook via migration INSERT"
-- pattern (ActionTemplate). The taxonomy is editable in-app afterwards.
INSERT INTO "ExpertiseArea" ("id", "slug", "name", "category", "sortOrder") VALUES
  ('xparea_stem_research',      'stem-research',       'STEM Research',          'STEM',        10),
  ('xparea_computer_science',   'computer-science',    'Computer Science',       'STEM',        20),
  ('xparea_robotics_eng',       'robotics-engineering','Robotics & Engineering', 'STEM',        30),
  ('xparea_math',               'math',                'Mathematics',            'STEM',        40),
  ('xparea_visual_arts',        'visual-arts',         'Visual Arts',            'Arts',        50),
  ('xparea_music',              'music',               'Music',                  'Arts',        60),
  ('xparea_creative_writing',   'creative-writing',    'Creative Writing',       'Arts',        70),
  ('xparea_film_media',         'film-media',          'Film & Media',           'Arts',        80),
  ('xparea_debate_speech',      'debate-speech',       'Debate & Speech',        'Humanities',  90),
  ('xparea_history_civics',     'history-civics',      'History & Civics',       'Humanities', 100),
  ('xparea_entrepreneurship',   'entrepreneurship',    'Entrepreneurship',       'Life',       110),
  ('xparea_community_service',  'community-service',   'Community Service',      'Life',       120),
  ('xparea_college_essays',     'college-essays',      'College Essays',         'Life',       130),
  ('xparea_leadership',         'leadership',          'Leadership',             'Life',       140)
ON CONFLICT ("slug") DO NOTHING;
