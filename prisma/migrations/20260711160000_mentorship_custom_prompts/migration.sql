-- Mentor follow-up prompts on a mentorship (answered anytime on Feedback).
ALTER TABLE "Mentorship" ADD COLUMN IF NOT EXISTS "customPromptsJson" JSONB;
