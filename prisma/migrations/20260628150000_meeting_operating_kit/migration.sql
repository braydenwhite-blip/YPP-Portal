-- Universal meeting operating kit: agenda, proposal, next steps, outcome, linked partner.

ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "agenda" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "proposal" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "nextSteps" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "outcome" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;

CREATE INDEX IF NOT EXISTS "Meeting_partnerId_idx" ON "Meeting"("partnerId");

DO $$ BEGIN
  ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
