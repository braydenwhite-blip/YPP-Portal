-- Migration: training_module_archive
-- Adds soft-delete support to TrainingModule via an `archivedAt` timestamp.
-- Archived modules remain in the database (preserving assignments, evidence,
-- and quiz attempts) but are hidden from learner-facing views; admins can
-- unarchive to restore visibility.

ALTER TABLE "TrainingModule" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "TrainingModule_archivedAt_idx" ON "TrainingModule"("archivedAt");
