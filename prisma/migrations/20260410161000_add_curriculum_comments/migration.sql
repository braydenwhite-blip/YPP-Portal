-- CreateTable
CREATE TABLE "CurriculumComment" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "anchorType" TEXT NOT NULL,
    "anchorId" TEXT,
    "anchorField" TEXT,
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurriculumComment_draftId_idx" ON "CurriculumComment"("draftId");

-- CreateIndex
CREATE INDEX "CurriculumComment_parentId_idx" ON "CurriculumComment"("parentId");

-- CreateIndex
CREATE INDEX "CurriculumComment_anchorType_anchorId_anchorField_idx" ON "CurriculumComment"("anchorType", "anchorId", "anchorField");

-- CreateIndex
CREATE INDEX "CurriculumComment_draftId_resolved_createdAt_idx" ON "CurriculumComment"("draftId", "resolved", "createdAt");

-- AddForeignKey
ALTER TABLE "CurriculumComment" ADD CONSTRAINT "CurriculumComment_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "CurriculumDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumComment" ADD CONSTRAINT "CurriculumComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumComment" ADD CONSTRAINT "CurriculumComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CurriculumComment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumComment" ADD CONSTRAINT "CurriculumComment_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
