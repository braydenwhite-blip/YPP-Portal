-- CreateEnum
CREATE TYPE "CurriculumDraftStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'SUBMITTED');

-- CreateTable
CREATE TABLE "CurriculumDraft" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT,
    "interestArea" TEXT NOT NULL DEFAULT '',
    "outcomes" TEXT[],
    "weeklyPlans" JSONB NOT NULL DEFAULT '[]',
    "status" "CurriculumDraftStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurriculumDraft_authorId_idx" ON "CurriculumDraft"("authorId");

-- AddForeignKey
ALTER TABLE "CurriculumDraft" ADD CONSTRAINT "CurriculumDraft_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
