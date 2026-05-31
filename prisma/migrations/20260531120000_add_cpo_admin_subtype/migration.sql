-- Add CPO (Co-President & Chief People Officer) to the AdminSubtype enum.
--
-- CPO is the top people-strategy role introduced by the People Strategy layer.
-- It is modelled as an admin subtype (like SUPER_ADMIN / HIRING_ADMIN), so a
-- CPO is an ADMIN-role user carrying the CPO subtype via UserAdminSubtype.
--
-- ADD VALUE runs in its own statement. PostgreSQL raises 55P04 ("unsafe use of
-- new value of enum type") if a freshly added enum value is referenced in the
-- same transaction that added it, so do not consume 'CPO' here.
ALTER TYPE "AdminSubtype" ADD VALUE IF NOT EXISTS 'CPO';
