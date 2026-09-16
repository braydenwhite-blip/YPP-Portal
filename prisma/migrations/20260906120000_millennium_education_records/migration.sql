-- Millennium Education student tracking (admin + chapter president).

DO $$ BEGIN
  CREATE TYPE "MillenniumEducationStatus" AS ENUM (
    'ENROLLED',
    'IN_PROGRESS',
    'COMPLETED',
    'WITHDRAWN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "MillenniumEducationRecord" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "MillenniumEducationStatus" NOT NULL DEFAULT 'ENROLLED',
  "startDate" TIMESTAMP(3),
  "completionDate" TIMESTAMP(3),
  "hoursCompleted" INTEGER NOT NULL DEFAULT 0,
  "certificateIssued" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MillenniumEducationRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MillenniumEducationRecord_studentId_idx"
  ON "MillenniumEducationRecord"("studentId");

DO $$ BEGIN
  ALTER TABLE "MillenniumEducationRecord"
    ADD CONSTRAINT "MillenniumEducationRecord_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
