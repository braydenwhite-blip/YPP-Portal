-- Per-class banner / accent color for the instructor class home.

ALTER TABLE "ClassOffering"
  ADD COLUMN IF NOT EXISTS "themeColor" TEXT DEFAULT '#6b21c8';
