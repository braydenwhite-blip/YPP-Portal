ALTER TABLE "MentorGoalReview"
ADD COLUMN "bonusPoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MentorGoalReview"
ADD COLUMN "bonusReason" TEXT;

ALTER TABLE "MentorGoalReview"
ADD COLUMN "chairAdjustedBonusPoints" INTEGER;
