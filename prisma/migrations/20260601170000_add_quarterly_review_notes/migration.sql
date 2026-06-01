-- Migration: add_quarterly_review_notes
-- People Strategy — Quarterly Reviews (ENABLE_QUARTERLY_REVIEWS).
-- Adds an optional free-text `notes` rationale captured by the reviewer when
-- submitting a Quarterly Review. Idempotent (ADD COLUMN IF NOT EXISTS) to match
-- repo convention.

-- AlterTable
ALTER TABLE "QuarterlyReview" ADD COLUMN IF NOT EXISTS "notes" TEXT;
