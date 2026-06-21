-- Add a real chapter assignment field for partners so Missing Chapter can be resolved.
ALTER TABLE "Partner" ADD COLUMN "chapterId" TEXT;

ALTER TABLE "Partner"
ADD CONSTRAINT "Partner_chapterId_fkey"
FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Partner_chapterId_idx" ON "Partner"("chapterId");
