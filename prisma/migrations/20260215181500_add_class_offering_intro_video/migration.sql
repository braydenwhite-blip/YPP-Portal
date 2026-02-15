-- Add optional instructor intro video fields to class offerings
ALTER TABLE "ClassOffering"
ADD COLUMN "introVideoTitle" TEXT,
ADD COLUMN "introVideoDescription" TEXT,
ADD COLUMN "introVideoProvider" "VideoProvider",
ADD COLUMN "introVideoUrl" TEXT,
ADD COLUMN "introVideoThumbnail" TEXT;
