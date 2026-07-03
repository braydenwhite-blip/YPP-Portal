-- Fix P2011 on prisma.reviewCycle.create(): "Null constraint violation on
-- the fields: (`revieweeId`)".
--
-- Root cause: an earlier prototype of the mentorship review-cycle feature
-- (single-reviewee model: revieweeId / reviewerId / type all NOT NULL) was
-- provisioned straight to production via `prisma db push`, with no migration
-- file. It was later replaced in prisma/schema.prisma by the current
-- cohort-capable model (ReviewCycle + ReviewCycleParticipant, see
-- 20260702170000_review_cycles), but the physical "ReviewCycle" table was
-- never altered — the prior migration's `CREATE TABLE IF NOT EXISTS` is a
-- no-op against it. The old NOT NULL columns are still there; every current
-- reviewCycle.create() omits them (they don't exist in the schema anymore),
-- so Postgres rejects the insert. revieweeId is reported first because it's
-- the first NOT NULL column of the three in the table's column order.
--
-- Fix: drop NOT NULL from the obsolete columns. Additive/data-preserving —
-- no code reads or writes revieweeId/reviewerId/type anymore (the model that
-- used them was fully removed from prisma/schema.prisma), so relaxing the
-- constraint is safe; existing rows are untouched. Guarded per the repo's
-- db-push-drift convention (see 20260702150000_user_delete_cascade): on a
-- fresh database these columns were never created by any migration, so the
-- ALTER is a no-op there.
DO $$ BEGIN
  ALTER TABLE "ReviewCycle" ALTER COLUMN "revieweeId" DROP NOT NULL;
EXCEPTION WHEN undefined_column OR undefined_table THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ReviewCycle" ALTER COLUMN "reviewerId" DROP NOT NULL;
EXCEPTION WHEN undefined_column OR undefined_table THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ReviewCycle" ALTER COLUMN "type" DROP NOT NULL;
EXCEPTION WHEN undefined_column OR undefined_table THEN null; END $$;
