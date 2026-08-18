-- Optional country on chapters (details form: name, city, state, country, partners, notes).

ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "country" TEXT;
