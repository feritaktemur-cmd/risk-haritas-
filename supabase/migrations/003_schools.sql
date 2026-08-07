-- =====================================================================
-- Migration 003: schools (minimal school identity records)
-- Scope (STRICT): schools table ONLY.
-- First release is ADANA only. Province/il is NOT stored (no province col).
-- Every school belongs to an Adana district (districts table).
-- Schools are bulk-loaded later by RAM Admin from Excel -> NO seed here.
-- MERNIS address code is the unique external identity (stored as TEXT).
-- No address/phone/fax/website/email/MEB code. No extra fields.
-- No RLS/views/triggers/functions. 001 & 002 tables untouched.
-- Auth / Storage untouched.
-- NOTE: school_type_id <-> education_level_id compatibility is enforced
--       later at the app/backend layer (NO trigger/function here).
-- =====================================================================

BEGIN;

CREATE TABLE schools (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mernis_address_code TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    district_id         SMALLINT NOT NULL
                        REFERENCES districts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    education_level_id  SMALLINT NOT NULL
                        REFERENCES education_levels(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    management_type_id  SMALLINT NOT NULL
                        REFERENCES management_types(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    school_type_id      UUID NOT NULL
                        REFERENCES school_types(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    is_active           BOOLEAN NOT NULL DEFAULT true
);

-- No seed data: schools are bulk-loaded later by RAM Admin from Excel.

COMMIT;
