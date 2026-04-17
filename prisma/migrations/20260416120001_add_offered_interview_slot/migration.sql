-- CreateTable: OfferedInterviewSlot
-- Stores reviewer-proposed time slots for the curriculum overview/interview.
-- Replaces the old applicant-submits-availability flow.
CREATE TABLE IF NOT EXISTS "OfferedInterviewSlot" (
    "id"                      TEXT          NOT NULL,
    "instructorApplicationId" TEXT          NOT NULL,
    "scheduledAt"             TIMESTAMP(3)  NOT NULL,
    "durationMinutes"         INTEGER       NOT NULL DEFAULT 60,
    "offeredByUserId"         TEXT          NOT NULL,
    "confirmedAt"             TIMESTAMP(3),
    "createdAt"               TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfferedInterviewSlot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: instructorApplicationId → InstructorApplication
DO $$ BEGIN
    ALTER TABLE "OfferedInterviewSlot"
        ADD CONSTRAINT "OfferedInterviewSlot_instrAppId_fkey"
        FOREIGN KEY ("instructorApplicationId")
        REFERENCES "InstructorApplication"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: offeredByUserId → User
DO $$ BEGIN
    ALTER TABLE "OfferedInterviewSlot"
        ADD CONSTRAINT "OfferedInterviewSlot_offeredByUserId_fkey"
        FOREIGN KEY ("offeredByUserId")
        REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OfferedInterviewSlot_instrAppId_idx"
    ON "OfferedInterviewSlot"("instructorApplicationId");

CREATE INDEX IF NOT EXISTS "OfferedInterviewSlot_offeredByUserId_idx"
    ON "OfferedInterviewSlot"("offeredByUserId");
