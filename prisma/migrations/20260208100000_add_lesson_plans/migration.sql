-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('WARM_UP', 'INSTRUCTION', 'PRACTICE', 'DISCUSSION', 'ASSESSMENT', 'BREAK', 'REFLECTION', 'GROUP_WORK');

-- CreateTable
CREATE TABLE "LessonPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "courseId" TEXT,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonActivity" (
    "id" TEXT NOT NULL,
    "lessonPlanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ActivityType" NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "resources" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonPlan_authorId_idx" ON "LessonPlan"("authorId");

-- AddForeignKey
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonActivity" ADD CONSTRAINT "LessonActivity_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "LessonPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
