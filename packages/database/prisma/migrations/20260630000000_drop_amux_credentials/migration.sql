-- Drop the amux_credentials table (and its FK constraint) that was used for
-- AMUX integration credentials. The feature has been removed; any dependent
-- FK constraints (e.g. to users) are automatically dropped by Postgres when
-- the table is dropped.
DROP TABLE IF EXISTS "amux_credentials";
