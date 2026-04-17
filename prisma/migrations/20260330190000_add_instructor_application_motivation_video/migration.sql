ALTER TABLE "InstructorApplication"
ALTER COLUMN "motivation" DROP NOT NULL;

ALTER TABLE "InstructorApplication"
ADD COLUMN "motivationVideoUrl" TEXT;
