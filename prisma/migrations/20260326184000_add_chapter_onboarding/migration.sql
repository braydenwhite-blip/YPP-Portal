CREATE TYPE "OnboardingStepType" AS ENUM (
  'INTRO_VIDEO',
  'MEET_THE_TEAM',
  'JOIN_CHANNELS',
  'SET_INTERESTS',
  'INTRODUCE_SELF',
  'COMPLETE_PROFILE',
  'FIRST_PATHWAY',
  'CUSTOM'
);

CREATE TABLE "ChapterOnboardingStep" (
  "id"          TEXT        NOT NULL,
  "chapterId"   TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "description" TEXT,
  "type"        "OnboardingStepType" NOT NULL,
  "sortOrder"   INTEGER     NOT NULL,
  "isRequired"  BOOLEAN     NOT NULL DEFAULT true,
  "metadata"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChapterOnboardingStep_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChapterOnboardingStep_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ChapterOnboardingStep_chapterId_sortOrder_idx"
  ON "ChapterOnboardingStep"("chapterId", "sortOrder");

CREATE TABLE "MemberOnboardingProgress" (
  "id"          TEXT        NOT NULL,
  "userId"      TEXT        NOT NULL,
  "chapterId"   TEXT        NOT NULL,
  "stepId"      TEXT        NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberOnboardingProgress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MemberOnboardingProgress_userId_stepId_key" UNIQUE ("userId", "stepId"),
  CONSTRAINT "MemberOnboardingProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemberOnboardingProgress_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemberOnboardingProgress_stepId_fkey"
    FOREIGN KEY ("stepId") REFERENCES "ChapterOnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemberOnboardingProgress_userId_chapterId_idx"
  ON "MemberOnboardingProgress"("userId", "chapterId");
