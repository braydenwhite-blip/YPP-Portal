-- AlterTable: add notification failure tracking columns to InstructorApplication
ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "lastNotificationError" TEXT,
  ADD COLUMN IF NOT EXISTS "lastNotificationErrorAt" TIMESTAMP(3);
