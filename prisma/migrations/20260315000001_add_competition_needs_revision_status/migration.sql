-- Migration: add_competition_needs_revision_status
-- Adds NEEDS_REVISION value to CompetitionStatus enum for the draft review flow.

ALTER TYPE "CompetitionStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVISION';
