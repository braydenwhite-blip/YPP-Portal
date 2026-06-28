-- Class Runtime OS Phase 5: per-session instructor reflection. 1:1 with
-- ClassSession; produces operating signals (needsCpHelp / logistics feed
-- interventions, completion clears the "reflection due" runtime state). FK-less
-- instructor reference + denormalized name, matching the repo convention.

CREATE TABLE IF NOT EXISTS "ClassSessionReflection" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "instructorId" TEXT,
  "instructorName" TEXT,
  "wentWell" TEXT,
  "struggled" TEXT,
  "studentToWatch" TEXT,
  "changeNextTime" TEXT,
  "logisticsIssue" TEXT,
  "needsCpHelp" BOOLEAN NOT NULL DEFAULT false,
  "confidence" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassSessionReflection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClassSessionReflection_sessionId_key"
  ON "ClassSessionReflection" ("sessionId");
CREATE INDEX IF NOT EXISTS "ClassSessionReflection_offeringId_createdAt_idx"
  ON "ClassSessionReflection" ("offeringId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ClassSessionReflection" ADD CONSTRAINT "ClassSessionReflection_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
