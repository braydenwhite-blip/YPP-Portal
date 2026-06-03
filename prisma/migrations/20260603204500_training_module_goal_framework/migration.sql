-- Maps each TrainingModule onto YPP's official role framework (the 5 GOALS)
-- so the Instructor Academy roadmap can group and label sections by GOAL and
-- surface a per-card outcome statement.
--
-- `goalKey`: WELCOME | GOAL_1 | GOAL_2 | GOAL_3 | GOAL_4 | GOAL_5 | CAPSTONE
--   (nullable; legacy/admin-created modules predate the framework).
-- `outcomeStatement`: one-line Instructor-column competency shown on the card.

ALTER TABLE "TrainingModule" ADD COLUMN IF NOT EXISTS "goalKey" TEXT;
ALTER TABLE "TrainingModule" ADD COLUMN IF NOT EXISTS "outcomeStatement" TEXT;

CREATE INDEX IF NOT EXISTS "TrainingModule_goalKey_idx" ON "TrainingModule"("goalKey");
