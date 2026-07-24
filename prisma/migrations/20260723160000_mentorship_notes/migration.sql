-- Ongoing mentorship notes attached to a mentee (visible during monthly reviews).

CREATE TABLE IF NOT EXISTS "MentorshipNote" (
  "id" TEXT NOT NULL,
  "menteeId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MentorshipNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MentorshipNote_menteeId_createdAt_idx"
  ON "MentorshipNote"("menteeId", "createdAt");
CREATE INDEX IF NOT EXISTS "MentorshipNote_authorId_idx"
  ON "MentorshipNote"("authorId");

DO $$ BEGIN
  ALTER TABLE "MentorshipNote"
    ADD CONSTRAINT "MentorshipNote_menteeId_fkey"
    FOREIGN KEY ("menteeId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MentorshipNote"
    ADD CONSTRAINT "MentorshipNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
