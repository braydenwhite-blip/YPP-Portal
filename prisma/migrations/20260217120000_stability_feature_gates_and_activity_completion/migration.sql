-- CreateEnum
CREATE TYPE "FeatureGateScope" AS ENUM ('GLOBAL', 'CHAPTER', 'USER', 'ROLE');

-- CreateTable
CREATE TABLE "ActivityCompletion" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "title" TEXT,
    "passionId" TEXT,
    "notes" TEXT,
    "minutesSpent" INTEGER,
    "awardedXp" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureGateRule" (
    "id" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "scope" "FeatureGateScope" NOT NULL DEFAULT 'GLOBAL',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "chapterId" TEXT,
    "userId" TEXT,
    "role" "RoleType",
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureGateRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCompletion_studentId_sourceType_activityId_key" ON "ActivityCompletion"("studentId", "sourceType", "activityId");

-- CreateIndex
CREATE INDEX "ActivityCompletion_studentId_completedAt_idx" ON "ActivityCompletion"("studentId", "completedAt");

-- CreateIndex
CREATE INDEX "ActivityCompletion_sourceType_activityId_idx" ON "ActivityCompletion"("sourceType", "activityId");

-- CreateIndex
CREATE INDEX "FeatureGateRule_featureKey_scope_enabled_idx" ON "FeatureGateRule"("featureKey", "scope", "enabled");

-- CreateIndex
CREATE INDEX "FeatureGateRule_featureKey_chapterId_enabled_idx" ON "FeatureGateRule"("featureKey", "chapterId", "enabled");

-- CreateIndex
CREATE INDEX "FeatureGateRule_featureKey_userId_enabled_idx" ON "FeatureGateRule"("featureKey", "userId", "enabled");

-- CreateIndex
CREATE INDEX "FeatureGateRule_featureKey_role_enabled_idx" ON "FeatureGateRule"("featureKey", "role", "enabled");

-- CreateIndex
CREATE INDEX "FeatureGateRule_startsAt_endsAt_idx" ON "FeatureGateRule"("startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "ActivityCompletion" ADD CONSTRAINT "ActivityCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureGateRule" ADD CONSTRAINT "FeatureGateRule_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureGateRule" ADD CONSTRAINT "FeatureGateRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureGateRule" ADD CONSTRAINT "FeatureGateRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureGateRule" ADD CONSTRAINT "FeatureGateRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
