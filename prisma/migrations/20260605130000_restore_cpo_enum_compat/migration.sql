-- Migration: restore_cpo_enum_compat
-- People Strategy Command Center — hotfix for the CPO -> LEADERSHIP rename.
--
-- WHY THIS EXISTS
-- ---------------
-- The previous migration (20260605120000_rename_cpo_to_leadership) renamed the
-- enum value in place:  ALTER TYPE "AdminSubtype" RENAME VALUE 'CPO' -> 'LEADERSHIP'.
-- That database is SHARED across deployments (production + Vercel previews all
-- point at it). The moment a preview build ran `prisma migrate deploy`, the
-- live enum label flipped to LEADERSHIP, but the *production* deployment was
-- still running pre-rename code whose Prisma client only knew 'CPO'. Reading a
-- renamed row then threw, on every request, in the root layout's session query:
--   PrismaClientUnknownRequestError: Value 'LEADERSHIP' not found in enum 'AdminSubtype'
--
-- An in-place enum RENAME is not a backward-compatible change on a shared
-- database. The safe pattern is expand/contract: ADD the new value, let every
-- deployment learn to read both, backfill, and only later drop the old value.
--
-- WHAT THIS DOES
-- --------------
-- Re-adds the legacy values alongside the new ones so the enum carries BOTH.
-- A client generated from either the old or the new schema can then deserialize
-- whatever the database holds, instead of 500ing. No data backfill is needed:
-- the earlier RENAME already moved existing rows onto the new label; this only
-- restores the labels themselves. Application code normalizes the legacy value
-- to the canonical one (see lib/admin-subtypes.ts), so nothing writes CPO.
--
-- ADD VALUE runs in its own statement and the new value is never consumed in
-- the same transaction (avoids Postgres 55P04). IF NOT EXISTS makes every
-- statement idempotent and safe to re-run.

-- AdminSubtype: restore legacy 'CPO' next to 'LEADERSHIP'.
ALTER TYPE "AdminSubtype" ADD VALUE IF NOT EXISTS 'CPO';

-- ActionEmailType: restore legacy 'CPO_ESCALATION' next to 'LEADERSHIP_ESCALATION'.
ALTER TYPE "ActionEmailType" ADD VALUE IF NOT EXISTS 'CPO_ESCALATION';
