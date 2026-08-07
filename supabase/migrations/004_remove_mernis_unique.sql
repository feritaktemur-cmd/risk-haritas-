-- =====================================================================
-- Migration 004: remove UNIQUE constraint on schools.mernis_address_code
-- Rationale: different institutions sharing the same building/campus can
-- share the same MERNIS address code, so it is NOT a unique identity.
-- schools.id (UUID PRIMARY KEY) remains the true unique system identity.
--
-- Only the UNIQUE constraint is dropped.
-- mernis_address_code stays TEXT NOT NULL.
-- No column changes, no other tables, no data deletion.
-- No RLS/views/triggers/functions.
-- =====================================================================

BEGIN;

-- Inline "UNIQUE" from migration 003 gets the default name
-- schools_mernis_address_code_key.
ALTER TABLE schools
    DROP CONSTRAINT IF EXISTS schools_mernis_address_code_key;

COMMIT;
