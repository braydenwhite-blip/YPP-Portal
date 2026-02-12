-- Create enums for student content if they do not exist yet.
DO $$
BEGIN
  CREATE TYPE "ContentType" AS ENUM (
    'VIDEO',
    'ARTICLE',
    'PROJECT',
    'TUTORIAL',
    'ART',
    'MUSIC',
    'CODE',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ContentStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'FEATURED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Student content showcase
CREATE TABLE IF NOT EXISTS "StudentContent" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "contentType" "ContentType" NOT NULL,
  "mediaUrl" TEXT,
  "thumbnailUrl" TEXT,
  "passionArea" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewedById" TEXT,
  "reviewNote" TEXT,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "likeCount" INTEGER NOT NULL DEFAULT 0,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "featuredAt" TIMESTAMP(3),
  "xpAwarded" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentContent_pkey" PRIMARY KEY ("id")
);

-- Likes on content
CREATE TABLE IF NOT EXISTS "ContentLike" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentLike_pkey" PRIMARY KEY ("id")
);

-- Comments on content
CREATE TABLE IF NOT EXISTS "ContentComment" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentComment_pkey" PRIMARY KEY ("id")
);

-- Random rewards
CREATE TABLE IF NOT EXISTS "RandomReward" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rewardType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "xpAmount" INTEGER NOT NULL DEFAULT 0,
  "badgeId" TEXT,
  "isRedeemed" BOOLEAN NOT NULL DEFAULT false,
  "redeemedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RandomReward_pkey" PRIMARY KEY ("id")
);

-- Mystery boxes
CREATE TABLE IF NOT EXISTS "MysteryBox" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "triggerDetail" TEXT,
  "rewardType" TEXT NOT NULL,
  "rewardTitle" TEXT NOT NULL,
  "rewardDescription" TEXT,
  "xpAmount" INTEGER NOT NULL DEFAULT 0,
  "badgeId" TEXT,
  "metadata" JSONB,
  "isOpened" BOOLEAN NOT NULL DEFAULT false,
  "openedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MysteryBox_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "StudentContent_studentId_idx" ON "StudentContent"("studentId");
CREATE INDEX IF NOT EXISTS "StudentContent_status_idx" ON "StudentContent"("status");
CREATE INDEX IF NOT EXISTS "StudentContent_contentType_idx" ON "StudentContent"("contentType");
CREATE INDEX IF NOT EXISTS "StudentContent_passionArea_idx" ON "StudentContent"("passionArea");
CREATE INDEX IF NOT EXISTS "StudentContent_isFeatured_idx" ON "StudentContent"("isFeatured");

CREATE UNIQUE INDEX IF NOT EXISTS "ContentLike_contentId_userId_key" ON "ContentLike"("contentId", "userId");
CREATE INDEX IF NOT EXISTS "ContentLike_userId_idx" ON "ContentLike"("userId");

CREATE INDEX IF NOT EXISTS "ContentComment_contentId_idx" ON "ContentComment"("contentId");
CREATE INDEX IF NOT EXISTS "ContentComment_authorId_idx" ON "ContentComment"("authorId");

CREATE INDEX IF NOT EXISTS "RandomReward_userId_idx" ON "RandomReward"("userId");
CREATE INDEX IF NOT EXISTS "RandomReward_isRedeemed_idx" ON "RandomReward"("isRedeemed");

CREATE INDEX IF NOT EXISTS "MysteryBox_userId_idx" ON "MysteryBox"("userId");
CREATE INDEX IF NOT EXISTS "MysteryBox_isOpened_idx" ON "MysteryBox"("isOpened");

-- Foreign keys
DO $$
BEGIN
  ALTER TABLE "StudentContent"
  ADD CONSTRAINT "StudentContent_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ContentLike"
  ADD CONSTRAINT "ContentLike_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "StudentContent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ContentLike"
  ADD CONSTRAINT "ContentLike_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ContentComment"
  ADD CONSTRAINT "ContentComment_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "StudentContent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ContentComment"
  ADD CONSTRAINT "ContentComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "RandomReward"
  ADD CONSTRAINT "RandomReward_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MysteryBox"
  ADD CONSTRAINT "MysteryBox_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Keep leaderboard "global" entries consistent with code that uses empty string.
DO $$
BEGIN
  IF to_regclass('"LeaderboardEntry"') IS NOT NULL THEN
    UPDATE "LeaderboardEntry"
    SET "passionArea" = ''
    WHERE "passionArea" IS NULL;
  END IF;
END $$;
