-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "NominationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROMOTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "StudentNominatedChallenge" (
  "id" TEXT NOT NULL,
  "nominatorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT,
  "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
  "suggestedXp" INTEGER NOT NULL DEFAULT 25,
  "suggestedDuration" TEXT,
  "upvotes" INTEGER NOT NULL DEFAULT 0,
  "downvotes" INTEGER NOT NULL DEFAULT 0,
  "status" "NominationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewNote" TEXT,
  "promotedChallengeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudentNominatedChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NominationVote" (
  "id" TEXT NOT NULL,
  "nominationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isUpvote" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NominationVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentNominatedChallenge_nominatorId_idx"
  ON "StudentNominatedChallenge"("nominatorId");
CREATE INDEX IF NOT EXISTS "StudentNominatedChallenge_status_idx"
  ON "StudentNominatedChallenge"("status");
CREATE INDEX IF NOT EXISTS "StudentNominatedChallenge_upvotes_idx"
  ON "StudentNominatedChallenge"("upvotes");
CREATE UNIQUE INDEX IF NOT EXISTS "NominationVote_nominationId_userId_key"
  ON "NominationVote"("nominationId", "userId");
CREATE INDEX IF NOT EXISTS "NominationVote_userId_idx"
  ON "NominationVote"("userId");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "StudentNominatedChallenge"
  ADD CONSTRAINT "StudentNominatedChallenge_nominatorId_fkey"
  FOREIGN KEY ("nominatorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "NominationVote"
  ADD CONSTRAINT "NominationVote_nominationId_fkey"
  FOREIGN KEY ("nominationId") REFERENCES "StudentNominatedChallenge"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "NominationVote"
  ADD CONSTRAINT "NominationVote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
