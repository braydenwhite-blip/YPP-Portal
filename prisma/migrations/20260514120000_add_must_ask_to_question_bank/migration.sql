-- Migration: add_must_ask_to_question_bank
-- Adds isMustAsk flag so the live runner can highlight the must-ask interview question
-- (e.g. the "teach a concept in 60 seconds" demo question).

ALTER TABLE "InstructorInterviewQuestionBank"
  ADD COLUMN IF NOT EXISTS "isMustAsk" BOOLEAN NOT NULL DEFAULT false;
