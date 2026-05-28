ALTER TABLE "OfferedInterviewSlot"
ADD COLUMN "choiceReminderSentAt" TIMESTAMP(3),
ADD COLUMN "reminder24SentAt" TIMESTAMP(3),
ADD COLUMN "reminder2SentAt" TIMESTAMP(3);

CREATE INDEX "OfferedInterviewSlot_choiceReminderSentAt_createdAt_idx" ON "OfferedInterviewSlot"("choiceReminderSentAt", "createdAt");
CREATE INDEX "OfferedInterviewSlot_reminder24SentAt_scheduledAt_idx" ON "OfferedInterviewSlot"("reminder24SentAt", "scheduledAt");
CREATE INDEX "OfferedInterviewSlot_reminder2SentAt_scheduledAt_idx" ON "OfferedInterviewSlot"("reminder2SentAt", "scheduledAt");
