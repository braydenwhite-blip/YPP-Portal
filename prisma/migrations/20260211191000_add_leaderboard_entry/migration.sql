-- Create enum used by LeaderboardEntry if it does not exist yet.
DO $$
BEGIN
    CREATE TYPE "LeaderboardPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- Create leaderboard table used by /leaderboards.
CREATE TABLE IF NOT EXISTS "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "period" "LeaderboardPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "passionArea" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    ALTER TABLE "LeaderboardEntry"
        ADD CONSTRAINT "LeaderboardEntry_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "LeaderboardEntry_userId_category_period_periodStart_passionArea_key"
    ON "LeaderboardEntry"("userId", "category", "period", "periodStart", "passionArea");

CREATE INDEX IF NOT EXISTS "LeaderboardEntry_category_period_periodStart_idx"
    ON "LeaderboardEntry"("category", "period", "periodStart");

CREATE INDEX IF NOT EXISTS "LeaderboardEntry_category_period_score_idx"
    ON "LeaderboardEntry"("category", "period", "score");

CREATE INDEX IF NOT EXISTS "LeaderboardEntry_userId_idx"
    ON "LeaderboardEntry"("userId");
