-- Add CHAPTER_PRESIDENT to RoleType enum in its own transaction so it is
-- committed before the offering_approval_and_learner_fit migration uses it.
-- PostgreSQL error 55P04 ("unsafe use of new value of enum type") occurs when
-- a newly added enum value is referenced in the same transaction that added it.
ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'CHAPTER_PRESIDENT';
